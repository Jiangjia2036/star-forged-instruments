import { useEffect, useRef, useState } from "react";

import { SONGS, sectionAt } from "../songs";

// Plays backing tracks and reports progress. Note detection, suggested
// buttons, keyboard highlighting, and automatic key following are
// intentionally omitted so playback remains a simple listen-and-play mode.
//
// What playback DOES drive is the tuning: a track can carry `sections` -
// the hand-drawn circles, each a timestamp range and a fifteen-note scale.
// Crossing a boundary reports the new section upward, which retunes both
// the on-screen keyboard and the instrument itself in time with the song.

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const s = Math.max(0, Math.floor(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

function SongPlayer({ onProgress, onSectionChange }) {
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const frameRef = useRef(null);
  const startedAtRef = useRef(0);
  const audioRef = useRef(null);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  const sectionChangeRef = useRef(onSectionChange);
  sectionChangeRef.current = onSectionChange;

  // Section objects are module constants, so identity comparison is enough
  // to notice a boundary crossing without re-reporting every frame.
  const lastSectionRef = useRef(null);

  // Mirrored into state for the transport chip. Deliberately NOT derived
  // from `elapsed`: that clock runs on animation frames, which freeze in a
  // hidden tab, while sections ride the audio's own timeupdate events. The
  // chip has to follow the section that is actually in force.
  const [activeSection, setActiveSection] = useState(null);

  const track = SONGS[Math.min(trackIndex, SONGS.length - 1)];
  const duration = track.duration || 0;

  const reportSection = (section) => {
    if (section === lastSectionRef.current) return;

    lastSectionRef.current = section;
    setActiveSection(section);
    sectionChangeRef.current?.(section);
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

    setElapsed(0);
    progressRef.current?.(0);

    // Stopping hands the keyboard back to the manual key/octave selectors
    reportSection(null);
  };

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (audioRef.current) audioRef.current.pause();
      progressRef.current?.(0);

      if (lastSectionRef.current !== null) {
        lastSectionRef.current = null;
        sectionChangeRef.current?.(null);
      }
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

      // Retunes ride on the media clock, not the animation frame. rAF
      // freezes whenever the tab is hidden, and a section change that
      // waits for the tab to be foregrounded again would leave the
      // instrument tuned to the previous part of the song. timeupdate
      // keeps firing (~4/s) while audio plays, hidden or not.
      audio.addEventListener("timeupdate", () => {
        if (audioRef.current === audio) {
          reportSection(sectionAt(track, audio.currentTime));
        }
      });

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

    // The opening section takes effect the moment Play lands, not a frame
    // later - the first thing the performer sees is the right tuning.
    reportSection(sectionAt(track, 0));

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

      // The audio clock decides which circle is in force, so the retune
      // lands with the song rather than with a separate timer.
      reportSection(sectionAt(track, now));

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

  // Where later circles take over, as marks on the progress bar
  const boundaries = (track.sections ?? [])
    .filter((section) => section.at > 0 && shownTotal > 0)
    .map((section) => ({
      title: section.title,
      percent: Math.min(100, (section.at / shownTotal) * 100),
    }));

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

        {activeSection && (
          <span className="section-chip" title="The keyboard and instrument are tuned to this part of the song">
            ♪ {activeSection.title}
          </span>
        )}

        <span className="time">
          {formatTime(elapsed)} / {formatTime(shownTotal)}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: progress + "%" }} />

        {boundaries.map((mark) => (
          <span
            key={mark.title + mark.percent}
            className="progress-mark"
            style={{ left: mark.percent + "%" }}
            title={mark.title + " starts here"}
          />
        ))}
      </div>
    </section>
  );
}

export default SongPlayer;
