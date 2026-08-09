import { useState, useRef, useEffect } from "react";

import { SONGS } from "../songs";
import { buttonFor } from "../scales";
import {
  detectNote,
  accumulateChroma,
  estimateKey,
  makeChroma,
  decayChroma,
} from "../pitch";

// Plays a track and shows the performer what to press.
//
// Every backing track plays through the computer's speakers. The browser
// decodes the file and is also the only thing that can analyse it, which is
// what drives the heard-note readout and the automatic key following. The
// Pico's own speaker carries just the notes you play on the buttons.
//
// When a track has an audio file, that file is the clock, so the cues and the
// progress bar stay locked to the recording.

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function SongPlayer({
  onTargetsChange,
  onProgress,
  buttonNotes = [],
  onDetectedKey,
}) {
  // What the site hears in the backing track right now
  const [heard, setHeard] = useState(null);
  const [heardKey, setHeardKey] = useState(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const specRef = useRef(null);
  const chromaRef = useRef(makeChroma());
  const sourceRef = useRef(null);
  const keyHoldRef = useRef({ name: null, frames: 0 });
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const tracks = SONGS;
  const track = tracks[Math.min(trackIndex, tracks.length - 1)];

  const notes = track.notes ?? [];
  const duration = track.duration || 0;

  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);
  const statesRef = useRef([]);

  const cbRef = useRef({});
  cbRef.current = {
    onTargetsChange,
    onProgress,
    onDetectedKey,
  };

  const silenceAll = () => {
    const states = statesRef.current;

    notes.forEach((n, i) => {
      if (states[i] === "on") states[i] = "done";
    });

    cbRef.current.onTargetsChange([]);
  };

  const stop = () => {
    setPlaying(false);

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // A MediaElementSource is bound to its element for life, so drop the
    // graph when playback stops rather than trying to reuse it
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // already torn down
      }
      sourceRef.current = null;
    }

    analyserRef.current = null;
    setHeard(null);
    setHeardKey(null);

    silenceAll();
    setElapsed(0);
    cbRef.current.onProgress(0);
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (audioRef.current) audioRef.current.pause();
      cbRef.current.onTargetsChange([]);
      cbRef.current.onProgress(0);
    };
  }, []);

  const play = async () => {
    if (playing) {
      stop();
      return;
    }

    statesRef.current = notes.map(() => "pending");

    let audio = null;

    if (track.audioUrl) {
      audio = new Audio(track.audioUrl);
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      // Route the track through an analyser so the site can hear what is
      // playing. It still reaches the speakers - the analyser passes audio
      // through to the destination.
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext ||
            window.webkitAudioContext)();
        }

        const ctx = audioCtxRef.current;
        await ctx.resume();

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 8192;
        analyser.smoothingTimeConstant = 0.55;

        const source = ctx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        analyserRef.current = analyser;
        sourceRef.current = source;
        specRef.current = new Float32Array(analyser.frequencyBinCount);

        chromaRef.current = makeChroma();
        keyHoldRef.current = { name: null, frames: 0 };
      } catch (err) {
        console.log("Pitch analysis unavailable:", err.message);
        analyserRef.current = null;
      }

      try {
        await audio.play();
      } catch (err) {
        console.log("Backing track failed to play:", err.message);
        audioRef.current = null;
        audio = null;
      }
    }

    startedAtRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const a = audioRef.current;

      const now = a
        ? a.currentTime
        : (performance.now() - startedAtRef.current) / 1000;

      // A loaded file knows its own length; a chart uses its computed length
      const total = a && isFinite(a.duration) && a.duration
        ? a.duration
        : duration;

      setElapsed(now);
      cbRef.current.onProgress(
        total ? Math.min(100, (now / total) * 100) : 0
      );

      // ---- listen to the backing track ----
      const analyser = analyserRef.current;

      if (analyser && specRef.current) {
        analyser.getFloatFrequencyData(specRef.current);

        const ctx = audioCtxRef.current;

        const note = detectNote(
          specRef.current,
          ctx.sampleRate,
          analyser.fftSize
        );

        setHeard(note);

        // Chroma decays so the key estimate follows the music rather than
        // averaging the whole song into mush
        decayChroma(chromaRef.current, 0.985);
        accumulateChroma(
          specRef.current,
          ctx.sampleRate,
          analyser.fftSize,
          chromaRef.current
        );

        const key = estimateKey(chromaRef.current);

        if (key) {
          setHeardKey(key);

          // Only follow a key once it has held steady, and only when it is
          // clearly ahead of the runner up. Retuning the instrument on a
          // passing chord would be unplayable.
          const hold = keyHoldRef.current;

          if (key.name === hold.name) {
            hold.frames += 1;
          } else {
            hold.name = key.name;
            hold.frames = 1;
          }

          if (hold.frames === 90 && key.margin > 0.06) {
            cbRef.current.onDetectedKey?.(key.name);
          }
        }
      }

      const states = statesRef.current;
      const targets = [];

      notes.forEach((n, i) => {
        const end = n.time + n.duration;

        if (states[i] === "pending" && now >= n.time) states[i] = "on";
        if (states[i] === "on" && now >= end) states[i] = "done";

        if (states[i] === "on") targets.push(n.note);
      });

      cbRef.current.onTargetsChange(targets);

      const finished = a ? a.ended : now >= total;

      if (finished) {
        stop();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  };

  const currentNote = playing
    ? notes.find((n) => elapsed >= n.time && elapsed < n.time + n.duration)
    : null;

  const upcoming = notes.filter((n) => n.time > elapsed).slice(0, 4);

  const shownTotal =
    audioRef.current && isFinite(audioRef.current.duration)
      ? audioRef.current.duration
      : duration;

  const progress = shownTotal
    ? Math.min(100, (elapsed / shownTotal) * 100)
    : 0;

  const freePlay = notes.length === 0;

  return (
    <section className="stage">
      <div className="song-tabs">
        {tracks.map((t, i) => (
          <button
            key={t.id}
            className={i === trackIndex ? "song-tab active" : "song-tab"}
            onClick={() => {
              if (playing) stop();
              setTrackIndex(i);
            }}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div className="transport">
        <button className="play-btn" onClick={play}>
          {playing ? "Stop" : "Play"}
        </button>

        <span className="time">
          {formatTime(elapsed)} / {formatTime(shownTotal)}
        </span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: progress + "%" }}
        />
      </div>

      {freePlay ? (
        // No chart, so the site listens to the track instead and reports
        // what it hears
        <div className={heard ? "cue" : "cue idle"}>
          <div className="label">
            {playing ? "Heard in the track" : "Free play"}
          </div>

          <div className="cue-note">
            <span className="cue-name">
              {playing ? (heard ? heard.name : "...") : "--"}
            </span>

            {heard && (
              <span
                className={
                  buttonFor(heard.name, buttonNotes)
                    ? "cue-badge"
                    : "cue-badge cue-badge-off"
                }
              >
                {buttonFor(heard.name, buttonNotes)
                  ? "Button " + buttonFor(heard.name, buttonNotes)
                  : "not on a button"}
              </span>
            )}
          </div>

          {playing && heardKey && (
            <div className="key-readout">
              Key: <b>{heardKey.name} {heardKey.mode}</b>
              <span className="key-conf">
                {heardKey.margin > 0.06 ? "locked" : "listening"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={currentNote ? "cue" : "cue idle"}>
            <div className="label">Press now</div>

            {currentNote ? (
              <div className="cue-note">
                <span className="cue-name">{currentNote.note}</span>
                <span className="cue-badge">
                  Button {buttonFor(currentNote.note, buttonNotes) ?? "-"}
                </span>
              </div>
            ) : (
              <div className="cue-note">
                <span className="cue-name">{playing ? "rest" : "--"}</span>
              </div>
            )}
          </div>

          <div className="next-row">
            {upcoming.map((n, i) => (
              <span key={n.note + n.time + i} className="next-chip">
                <b>{n.note}</b>
                btn {buttonFor(n.note, buttonNotes) ?? "-"}
              </span>
            ))}
          </div>
        </>
      )}

    </section>
  );
}

export default SongPlayer;
