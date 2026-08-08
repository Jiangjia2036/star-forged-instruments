import { useState, useRef, useEffect } from "react";

import { SONGS, NOTE_TO_BUTTON } from "../songs";

// Plays a song chart. Drives the Pico's speaker over serial, shows a progress
// bar, and tells the performer which button to press and when.

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function SongPlayer({ onNoteOn, onNoteOff, onTargetsChange }) {
  const [songIndex, setSongIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const song = SONGS[songIndex];

  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);

  // Per-note playback status for the current run
  const statesRef = useRef([]);

  // Latest callbacks, so the animation loop never uses stale closures
  const cbRef = useRef({ onNoteOn, onNoteOff, onTargetsChange });
  cbRef.current = { onNoteOn, onNoteOff, onTargetsChange };

  const stopAllSounding = () => {
    const states = statesRef.current;

    song.notes.forEach((n, i) => {
      if (states[i] === "on") {
        cbRef.current.onNoteOff(n.note);
        states[i] = "done";
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
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    stopAllSounding();
    setElapsed(0);
  };

  // Stop cleanly if the song is switched or the component goes away
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  const play = async () => {
    if (playing) {
      stop();
      return;
    }

    statesRef.current = song.notes.map(() => "pending");

    // An optional real audio file is the authoritative clock when present,
    // so the chart stays locked to the recording.
    if (song.audioUrl) {
      const el = new Audio(song.audioUrl);
      audioRef.current = el;

      try {
        await el.play();
      } catch (err) {
        console.log("Audio file failed to play:", err.message);
        audioRef.current = null;
      }
    }

    startedAtRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const audio = audioRef.current;

      const now = audio
        ? audio.currentTime
        : (performance.now() - startedAtRef.current) / 1000;

      setElapsed(now);

      const states = statesRef.current;
      const targets = [];

      song.notes.forEach((n, i) => {
        const noteEnd = n.time + n.duration;

        if (states[i] === "pending" && now >= n.time) {
          states[i] = "on";
          cbRef.current.onNoteOn(n.note);
        }

        if (states[i] === "on" && now >= noteEnd) {
          states[i] = "done";
          cbRef.current.onNoteOff(n.note);
        }

        if (states[i] === "on") {
          targets.push(n.note);
        }
      });

      cbRef.current.onTargetsChange(targets);

      if (now >= song.duration) {
        stop();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  };

  // What to show the performer
  const currentNote = song.notes.find(
    (n) => elapsed >= n.time && elapsed < n.time + n.duration
  );

  const upcoming = song.notes
    .filter((n) => n.time > elapsed)
    .slice(0, 4);

  const progress = song.duration
    ? Math.min(100, (elapsed / song.duration) * 100)
    : 0;

  return (
    <section className="song-section">
      <h2>Setlist</h2>

      <div className="song-picker">
        {SONGS.map((s, i) => (
          <button
            key={s.id}
            className={i === songIndex ? "song-btn active" : "song-btn"}
            onClick={() => {
              if (playing) stop();
              setSongIndex(i);
            }}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="song-transport">
        <button className="play-btn" onClick={play}>
          {playing ? "Stop" : "Play"}
        </button>

        <span className="song-time">
          {formatTime(elapsed)} / {formatTime(song.duration)}
        </span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: progress + "%" }}
        />
      </div>

      <div className="now-playing">
        <div className="now-label">Press now</div>

        {currentNote ? (
          <div className="now-note">
            <span className="now-button">
              Button {NOTE_TO_BUTTON[currentNote.note] ?? "-"}
            </span>
            <span className="now-name">{currentNote.note}</span>
          </div>
        ) : (
          <div className="now-note idle">
            <span className="now-name">{playing ? "rest" : "-"}</span>
          </div>
        )}
      </div>

      <div className="upcoming">
        <div className="now-label">Next</div>

        <div className="upcoming-list">
          {upcoming.length === 0 && (
            <span className="upcoming-empty">-</span>
          )}

          {upcoming.map((n, i) => (
            <span key={n.note + n.time + i} className="upcoming-chip">
              <strong>{n.note}</strong>
              <em>btn {NOTE_TO_BUTTON[n.note] ?? "-"}</em>
              <span className="upcoming-in">
                in {Math.max(0, n.time - elapsed).toFixed(1)}s
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SongPlayer;
