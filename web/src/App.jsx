import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
import SongPlayer from "./components/SongPlayer";
import InstrumentPage from "./components/InstrumentPage";
import TeamPage from "./components/TeamPage";
import { PicoSerial, isSerialSupported } from "./pico-serial";
import { buttonNotes as computeButtonNotes } from "./scales";

const PAGE_IDS = new Set(["perform", "instrument", "team"]);

function pageFromHash() {
  const requested = window.location.hash.replace(/^#\/?/, "");
  return PAGE_IDS.has(requested) ? requested : "perform";
}

function App() {
  const delay = useRef(null);
  const analyzer = useRef(null);
  const synth = useRef(null);
  const backgroundMusicRef = useRef(null);

  if (synth.current === null) {
    delay.current = new Tone.FeedbackDelay("8n", 0.4);
    analyzer.current = new Tone.Analyser("waveform", 256);
    synth.current = new Tone.PolySynth(Tone.Synth).connect(delay.current);
    delay.current.connect(analyzer.current);
    analyzer.current.toDestination();
  }

  const [effectStrength, setEffectStrength] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState("");

  const [picoConnected, setPicoConnected] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const [apiOnline, setApiOnline] = useState(null);

  const [targetNotes, setTargetNotes] = useState([]);

  const [sustain, setSustain] = useState(false);

  const [picoEcho, setPicoEcho] = useState(false);

  const [potVolume, setPotVolume] = useState(0);

  const [songProgress, setSongProgress] = useState(0);

  const [picoTracks, setPicoTracks] = useState([]);
  const [picoTrackPlaying, setPicoTrackPlaying] = useState(null);

  // Each section has its own hash URL. The UFO visualizer stays mounted behind
  // every view, while the keyboard remains exclusive to the Perform page.
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    const music = new Audio("/audio/space-ambient.mp3");

    music.loop = true;
    music.volume = 0.1;
    music.preload = "auto";

    backgroundMusicRef.current = music;

    return () => {
      music.pause();
      music.currentTime = 0;
      backgroundMusicRef.current = null;
    };
  }, []);

  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0.1);

  const toggleBackgroundMusic = async () => {
    const music = backgroundMusicRef.current;

    if (!music) return;

    if (musicPlaying) {
      music.pause();
      setMusicPlaying(false);
      return;
    }

    try {
      await Tone.start();
      music.volume = musicVolume;
      await music.play();
      setMusicPlaying(true);
    } catch (err) {
      console.log(
        "Background music failed:",
        err.message
      );
    }
  };

  const changeMusicVolume = (event) => {
    const volume = Number(event.target.value);
    setMusicVolume(volume);

    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.volume = volume;
    }
  };

  const [root, setRoot] = useState("C");
  const [octave, setOctave] = useState(4);
  const [spread, setSpread] = useState("chord");

  const picoNotes = computeButtonNotes(
    root,
    octave,
    spread
  );

  const serialRef = useRef(null);

  const activeNotesRef = useRef([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("API health check failed");
        }

        return response.json();
      })
      .then((health) => {
        setApiOnline(health.status === "ok");
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setApiOnline(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncPageToHash = () => {
      setPage(pageFromHash());
    };

    window.addEventListener(
      "hashchange",
      syncPageToHash
    );

    return () => {
      window.removeEventListener(
        "hashchange",
        syncPageToHash
      );
    };
  }, []);

  const navigateToPage = (nextPage) => {
    setPage(nextPage);

    window.location.hash =
      nextPage === "perform"
        ? ""
        : nextPage;
  };

  useEffect(() => {
    const unlock = async () => {
      try {
        await Tone.start();
      } catch (err) {
        console.log(
          "Audio unlock failed:",
          err.message
        );
      }

      if (
        Tone.getContext().state ===
        "running"
      ) {
        console.log(
          "Audio context running"
        );

        window.removeEventListener(
          "pointerdown",
          unlock
        );
      }
    };

    window.addEventListener(
      "pointerdown",
      unlock
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        unlock
      );
    };
  }, []);

  useEffect(() => {
    delay.current.wet.value =
      selectedEffect === "Echo"
        ? effectStrength / 100
        : 0;
  }, [
    effectStrength,
    selectedEffect
  ]);

  useEffect(() => {
    if (!picoConnected) return;

    const pico = serialRef.current;

    if (!pico) return;

    const depth =
      Math.round(effectStrength);

    if (selectedEffect === "Warp") {
      pico.send("FX_WAVE_SAW");
      pico.send("FX_VIB_" + depth);
      pico.send("FX_TREM_0");
      pico.send("FX_ECHO_OFF");
    } else if (
      selectedEffect === "Echo"
    ) {
      pico.send("FX_WAVE_SINE");
      pico.send("FX_VIB_0");
      pico.send("FX_TREM_0");
      pico.send("FX_ECHO_ON");
    } else if (
      selectedEffect === "Chorus"
    ) {
      pico.send("FX_WAVE_SQUARE");
      pico.send("FX_VIB_0");
      pico.send("FX_TREM_" + depth);
      pico.send("FX_ECHO_OFF");
    } else {
      pico.send("FX_WAVE_SINE");
      pico.send("FX_VIB_0");
      pico.send("FX_TREM_0");
      pico.send("FX_ECHO_OFF");
    }
  }, [
    picoConnected,
    selectedEffect,
    effectStrength
  ]);

  const updateActiveNotes = (notes) => {
    activeNotesRef.current = notes;
    setActiveNotes(notes);
  };

  const picoNoteOn = (note) => {
    console.log(
      "Visual:",
      note,
      "ON"
    );

    const next = [
      ...activeNotesRef.current.filter(
        (n) => n !== note
      ),
      note,
    ];

    updateActiveNotes(next);
  };

  const picoNoteOff = (note) => {
    console.log(
      "Visual:",
      note,
      "OFF"
    );

    updateActiveNotes(
      activeNotesRef.current.filter(
        (n) => n !== note
      )
    );
  };

  const handleLine = (line) => {
    const noteMatch =
      line.match(
        /^NOTE_([A-G]#?[0-8])_(ON|OFF)$/
      );

    if (noteMatch) {
      const [
        ,
        note,
        action
      ] = noteMatch;

      if (action === "ON") {
        picoNoteOn(note);
      } else {
        picoNoteOff(note);
      }

      return;
    }

    const effectMatch =
      line.match(
        /^EFFECT_ECHO_(ON|OFF)$/
      );

    if (effectMatch) {
      setPicoEcho(
        effectMatch[1] === "ON"
      );

      return;
    }

    const volMatch =
      line.match(
        /^VOL_(\d+)$/
      );

    if (volMatch) {
      setPotVolume(
        Math.min(
          100,
          Number(volMatch[1])
        )
      );

      return;
    }

    const sustainMatch =
      line.match(
        /^SUSTAIN_(ON|OFF)$/
      );

    if (sustainMatch) {
      setSustain(
        sustainMatch[1] === "ON"
      );

      return;
    }

    if (
      line.startsWith("TRACKS_")
    ) {
      const names =
        line
          .slice(7)
          .split("|")
          .filter(Boolean);

      console.log(
        "Pico tracks:",
        names
      );

      setPicoTracks(names);

      return;
    }

    const posMatch =
      line.match(
        /^TRACK_POS_(\d+)$/
      );

    if (posMatch) {
      setSongProgress(
        Math.min(
          100,
          Number(posMatch[1])
        )
      );

      return;
    }

    if (
      line === "TRACK_END" ||
      line === "TRACK_STOPPED"
    ) {
      setPicoTrackPlaying(null);
      setSongProgress(0);

      return;
    }

    if (
      line.startsWith(
        "TRACK_ERROR_"
      )
    ) {
      console.log(
        "Pico track error:",
        line.slice(12)
      );

      setPicoTrackPlaying(null);

      return;
    }

    // Keep unknown TRACK_* / PICO_READY / debug lines harmlessly ignored.
  };

  const connectPico = async () => {
    if (!isSerialSupported()) {
      alert(
        "Web Serial is not supported in this browser. Use Chrome or Edge."
      );

      return;
    }

    try {
      serialRef.current =
        new PicoSerial({
          onLine: handleLine,

          onConnect: () => {
            setPicoConnected(true);

            // Keep the Pico track list available for the SongPlayer UI.
            setTimeout(() => {
              serialRef.current?.send(
                "TRACK_LIST"
              );
            }, 200);
          },

          onDisconnect: () => {
            setPicoConnected(false);
            updateActiveNotes([]);
          },
        });
      await serialRef.current.connect();
    } catch (err) {
      console.log(
        "Connect failed:",
        err.message
      );
    }
  };

  const disconnectPico = () => {
    serialRef.current?.disconnect();
  };

  const songNoteOn = (note) => {
    console.log(
      "Song:",
      note,
      "ON"
    );

    serialRef.current?.send(
      "CMD_ON_" + note
    );
  };

  const songNoteOff = (note) => {
    serialRef.current?.send(
      "CMD_OFF_" + note
    );
  };

  const silenceSongNotes = () => {
    serialRef.current?.send(
      "CMD_ALLOFF"
    );
  };

  const playPicoTrack = (name) => {
    console.log(
      "Pico track play:",
      name
    );

    setPicoTrackPlaying(name);

    serialRef.current?.send(
      "TRACK_PLAY_" + name
    );
  };

  // The site can follow a stable key detected in the backing track. This
  // retunes the instrument so the buttons stay aligned with the song.
  const handleDetectedKey = (name) => {
    setRoot((current) => {
      if (current === name) {
        return current;
      }

      console.log(
        "Following detected key:",
        name
      );

      return name;
    });
  };

  const stopPicoTrack = () => {
    serialRef.current?.send(
      "TRACK_STOP"
    );

    setPicoTrackPlaying(null);
    setSongProgress(0);
  };

  // Retune the instrument whenever the key, octave or button layout changes,
  // so the physical buttons always play the scale shown on screen.
  const tuneCommand =
    "TUNE_" +
    picoNotes.join("_");

  useEffect(() => {
    if (!picoConnected) return;

    console.log(
      "Tuning Pico:",
      tuneCommand
    );

    serialRef.current?.send(
      tuneCommand
    );
  }, [
    picoConnected,
    tuneCommand
  ]);

  if (page === "team") {
    return (
      <div className="app">
        <Visualizer
          analyzer={analyzer}
          activeNotes={activeNotes}
          currentPage="team"
        />

        <TeamPage
          onBack={() =>
            navigateToPage("perform")
          }
        />
      </div>
    );
  }

  return (
    <div className="app">
      <Visualizer
        analyzer={analyzer}
        activeNotes={activeNotes}
        currentPage="instrument"
      />

      <div className="top-progress">
        <div
          className="top-progress-fill"
          style={{
            width:
              songProgress + "%"
          }}
        />
      </div>

      <div className="ui">
      <div className="music-control">
        <button
          className="music-toggle"
          type="button"
          onClick={toggleBackgroundMusic}
          aria-label={
            musicPlaying
              ? "Pause background music"
              : "Play background music"
          }
        >
          {musicPlaying ? "♫" : "♪"}
        </button>

        <div className="music-panel">
          <span>
            {musicPlaying
              ? "BGM On"
              : "BGM Off"}
          </span>

          <input
            type="range"
            min="0"
            max="0.3"
            step="0.01"
            value={musicVolume}
            onChange={changeMusicVolume}
            aria-label="Background music volume"
          />
        </div>
      </div>

        <header className="topbar">
          <div className="brand">
            <img
              src="/photos/StarForged2.png"
              alt="Star Forged"
              className="brand-logo"
            />

            <span>
              Singularity
            </span>
      </div>

          <nav className="nav">
            {[
              [
                "perform",
                "Perform"
              ],
              [
                "instrument",
                "Instrument"
              ],
            ].map(
              ([id, label]) => (
                <button
                  key={id}
                  className={
                    page === id
                      ? "nav-btn active"
                      : "nav-btn"
                  }
                  type="button"
                  aria-current={
                    page === id
                      ? "page"
                      : undefined
                  }
                  onClick={() =>
                    navigateToPage(
                      id
                    )
                  }
                >
                  {label}
                </button>
              )
            )}
          </nav>

          <div className="pico-bar">
            <button
              className="page-btn"
              type="button"
              onClick={() =>
                navigateToPage(
                  "team"
                )
              }
            >
              Meet The Team
            </button>

            <span
              className={
                apiOnline
                  ? "api-status on"
                  : "api-status"
              }
              title="FastAPI backend status"
            >
              {apiOnline === null
                ? "Checking API"
                : apiOnline
                ? "API online"
                : "Local mode"}
            </span>

            <span
              className={
                picoConnected
                  ? "pico-status on"
                  : "pico-status off"
              }
            >
              {picoConnected
                ? "Connected"
                : "Disconnected"}
            </span>

            <button
              className="connect-btn"
              onClick={
                picoConnected
                  ? disconnectPico
                  : connectPico
              }
            >
              {picoConnected
                ? "Disconnect"
                : "Connect Pico"}
            </button>
          </div>
        </header>

        <main className="page-area">
          {page === "perform" && (
            <SongPlayer
              onNoteOn={
                songNoteOn
              }
              onNoteOff={
                songNoteOff
              }
              onAllNotesOff={
                silenceSongNotes
              }
              onTargetsChange={
                setTargetNotes
              }
              onProgress={
                setSongProgress
              }
              buttonNotes={
                picoNotes
              }
              picoTracks={
                picoTracks
              }
              picoTrackPlaying={
                picoTrackPlaying
              }
              onPlayPicoTrack={
                playPicoTrack
              }
              onStopPicoTrack={
                stopPicoTrack
              }
              onDetectedKey={
                handleDetectedKey
              }
            />
          )}

          {page === "instrument" && (
            <InstrumentPage />
          )}
        </main>

        {page === "perform" && (
          <div className="dock">
            <Keyboard
              synth={synth}
              activeNotes={
                activeNotes
              }
              targetNotes={
                targetNotes
              }
              root={root}
              setRoot={setRoot}
              octave={octave}
              setOctave={
                setOctave
              }
              spread={spread}
              setSpread={
                setSpread
              }
              buttonNotes={
                picoNotes
              }
            />

            <Controls
              effectStrength={
                effectStrength
              }
              setEffectStrength={
                setEffectStrength
              }
              selectedEffect={
                selectedEffect
              }
              setSelectedEffect={
                setSelectedEffect
              }
              picoEcho={
                picoEcho
              }
              potVolume={
                potVolume
              }
              picoConnected={
                picoConnected
              }
              sustain={
                sustain
              }
              onToggleSustain={() => {
                const next =
                  !sustain;

                setSustain(next);

                serialRef.current?.send(
                  "FX_SUSTAIN_" +
                    (next
                      ? "ON"
                      : "OFF")
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;