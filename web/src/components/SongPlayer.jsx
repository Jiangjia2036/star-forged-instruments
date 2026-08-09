import { useEffect, useRef, useState } from "react";

import { SONGS } from "../songs";

// Plays backing tracks and reports progress. Note detection, suggested
// buttons, keyboard highlighting, and automatic key following are
// intentionally omitted so playback remains a simple listen-and-play mode.

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function SongPlayer({ onProgress }) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const track = SONGS[Math.min(trackIndex, SONGS.length - 1)];
  const duration = track.duration || 0;

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

    setElapsed(0);
    progressRef.current?.(0);
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (audioRef.current) audioRef.current.pause();
      progressRef.current?.(0);
    };
  }, []);

  const play = async () => {
    if (playing) {
      stop();
      return;
    }

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
      const currentAudio = audioRef.current;
      const now = currentAudio
        ? currentAudio.currentTime
        : (performance.now() - startedAtRef.current) / 1000;
      const total =
        currentAudio && isFinite(currentAudio.duration) && currentAudio.duration
          ? currentAudio.duration
          : duration;

      setElapsed(now);
      progressRef.current?.(
        total ? Math.min(100, (now / total) * 100) : 0
      );

      const finished = currentAudio ? currentAudio.ended : now >= total;

      if (finished) {
        stop();
        return;
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);
  };

  const shownTotal =
    audioRef.current && isFinite(audioRef.current.duration)
      ? audioRef.current.duration
      : duration;
  const progress = shownTotal
    ? Math.min(100, (elapsed / shownTotal) * 100)
    : 0;

  return (
    <section className="stage">
      <div className="song-tabs">
        {SONGS.map((song, index) => (
          <button
            key={song.id}
            className={index === trackIndex ? "song-tab active" : "song-tab"}
            onClick={() => {
              if (playing) stop();
              setTrackIndex(index);
            }}
          >
            {song.title}
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
        <div className="progress-fill" style={{ width: progress + "%" }} />
      </div>
    </section>
  );
}

export default SongPlayer;
