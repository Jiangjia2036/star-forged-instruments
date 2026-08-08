import { useState, useRef, useEffect } from "react";

import { SONGS } from "../songs";
import { buttonFor } from "../scales";

// Plays a track and shows the performer what to press.
//
// A backing track (mp3/m4a/mp4) plays through the browser, because the Pico
// can only synthesise its three oscillators - it cannot decode audio. The
// Pico's speaker provides the beeps you play on top.
//
// When a track has an audio file, that file is the clock, so the cues and the
// progress bar stay locked to the recording.

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function SongPlayer({
  onNoteOn,
  onNoteOff,
  onTargetsChange,
  onProgress,
  buttonNotes = [],
  picoTracks = [],
  picoTrackPlaying = null,
  onPlayPicoTrack,
  onStopPicoTrack,
}) {
  const [imported, setImported] = useState(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // "along" - you press the buttons. "auto" - the site drives the Pico.
  const [mode, setMode] = useState("along");

  const tracks = imported ? [...SONGS, imported] : SONGS;
  const track = tracks[Math.min(trackIndex, tracks.length - 1)];

  const notes = track.notes ?? [];
  const duration = track.duration || 0;

  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);
  const fileRef = useRef(null);
  const statesRef = useRef([]);

  const cbRef = useRef({});
  cbRef.current = { onNoteOn, onNoteOff, onTargetsChange, onProgress, mode };

  const silenceAll = () => {
    const states = statesRef.current;

    notes.forEach((n, i) => {
      if (states[i] === "on") {
        states[i] = "done";
        if (cbRef.current.mode === "auto") {
          cbRef.current.onNoteOff(n.note);
        }
      }
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

    silenceAll();
    setElapsed(0);
    cbRef.current.onProgress(0);
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
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
      audioRef.current = audio;

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

      const states = statesRef.current;
      const targets = [];
      const auto = cbRef.current.mode === "auto";

      notes.forEach((n, i) => {
        const end = n.time + n.duration;

        if (states[i] === "pending" && now >= n.time) {
          states[i] = "on";
          if (auto) cbRef.current.onNoteOn(n.note);
        }

        if (states[i] === "on" && now >= end) {
          states[i] = "done";
          if (auto) cbRef.current.onNoteOff(n.note);
        }

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

  const loadFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (playing) stop();

    // Release the previous object URL so it is not leaked
    if (imported?.audioUrl) {
      URL.revokeObjectURL(imported.audioUrl);
    }

    const url = URL.createObjectURL(file);
    const probe = new Audio(url);

    probe.addEventListener("loadedmetadata", () => {
      const entry = {
        id: "imported",
        title: file.name.replace(/\.[^.]+$/, ""),
        audioUrl: url,
        notes: [],
        duration: isFinite(probe.duration) ? probe.duration : 0,
      };

      setImported(entry);
      setTrackIndex(SONGS.length);
    });

    probe.addEventListener("error", () => {
      console.log("Could not read that file as audio:", file.name);
    });

    // allow re-picking the same file later
    event.target.value = "";
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

        <div className="mode-toggle">
          <button
            className={mode === "along" ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode("along")}
          >
            You play
          </button>

          <button
            className={mode === "auto" ? "mode-btn active" : "mode-btn"}
            onClick={() => setMode("auto")}
          >
            Pico plays
          </button>
        </div>

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
        <div className="cue idle">
          <div className="label">Free play</div>
          <div className="cue-note">
            <span className="cue-name">
              {playing ? "beep along" : "--"}
            </span>
          </div>
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

      {/* WAV files stored on the Pico. These come out of the instrument's
          own speaker, mixed with your beeps, so you can play along. */}
      {picoTracks.length > 0 && (
        <div className="pico-tracks">
          <div className="label">On the instrument</div>

          <div className="pico-track-list">
            {picoTracks.map((name) => {
              const active = picoTrackPlaying === name;

              return (
                <button
                  key={name}
                  className={active ? "pico-track active" : "pico-track"}
                  onClick={() =>
                    active ? onStopPicoTrack?.() : onPlayPicoTrack?.(name)
                  }
                >
                  {active ? "■" : "▶"} {name.replace(/\.wav$/i, "")}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="track-load">
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,video/mp4"
          onChange={loadFile}
          hidden
        />

        <button
          className="load-btn"
          onClick={() => fileRef.current?.click()}
        >
          Load track
        </button>

        <span className="load-hint">
          Plays in the browser. For speaker playback put a 22 kHz mono WAV in
          the Pico's /audio folder — see PicoCode/AUDIO.md
        </span>
      </div>
    </section>
  );
}

export default SongPlayer;
