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
import { PicoBridge } from "./pico-bridge";
import {
  buttonNotes as computeButtonNotes,
  sectionButtonNotes,
} from "./scales";

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
  const picoConnectedRef = useRef(false);
  const [activeNotes, setActiveNotes] = useState([]);
  const [apiOnline, setApiOnline] = useState(null);

  // Damper pedal. Either the GP20 switch or the on-screen toggle.
  const [sustain, setSustain] = useState(false);

  const [picoEcho, setPicoEcho] = useState(false);

  const [potVolume, setPotVolume] = useState(0);

  const [songProgress, setSongProgress] = useState(0);

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
  // Twelve keys span a full scale, so there is only one layout left to pick.
  // Kept as state because the Keyboard still renders the selector, and to
  // leave room for a second layout later.
  const [spread, setSpread] = useState("steps");

  // The tuning circle currently in force, reported by SongPlayer as the
  // backing track crosses its section boundaries. While set, it overrides
  // the key/octave selectors: the keyboard shows the circle's fifteen keys
  // and the buttons take its lowest twelve. Null outside playback.
  const [songSection, setSongSection] = useState(null);

  const picoNotes = songSection
    ? sectionButtonNotes(songSection.scale)
    : computeButtonNotes(root, octave);

  // A board plugged into ANOTHER computer, reaching us through the mirror.
  // Kept apart from picoConnected, which means "this browser owns the port".
  const [mirrored, setMirrored] = useState(false);

  const serialRef = useRef(null);
  const bridgeRef = useRef(null);
  // mirror of activeNotes for use inside serial callbacks
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
    const notesSnapshot = line.match(/^PICO_NOTES_(.*)$/);
    if (notesSnapshot) {
      const notes = notesSnapshot[1]
        ? notesSnapshot[1]
            .split(",")
            .filter((note) => /^[A-G]#?[0-8]$/.test(note))
        : [];

      updateActiveNotes([...new Set(notes)]);
      return;
    }

    const noteMatch = line.match(/^NOTE_([A-G]#?[0-8])_(ON|OFF)$/);
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

    // Published by whichever machine owns the serial port, so viewers on
    // other computers can show the board as connected rather than sitting
    // on "Disconnected" while someone is clearly playing it.
    const linkMatch = line.match(/^PICO_LINK_(ON|OFF)$/);
    if (linkMatch) {
      const up = linkMatch[1] === "ON";

      setMirrored(up);
      if (!up) updateActiveNotes([]);

      return;
    }

    // TRACK_* lines are ignored. Backing tracks play through the computer's
    // speakers now, so the board's own player is never asked to start and
    // the progress bar is driven by the browser's audio element instead.
    // PICO_READY and any debug lines land here too.
  };

  // handleLine closes over current state, so it is rebuilt every render. The
  // bridge is created once, so it calls through this ref rather than
  // capturing a stale copy.
  const handleLineRef = useRef(null);
  handleLineRef.current = handleLine;

  useEffect(() => {
    const bridge = new PicoBridge({
      onLine: (line) => handleLineRef.current?.(line),
      onStatus: (up) => {
        // Losing the hub tells us nothing about a board on another machine,
        // so stop claiming one is there.
        if (!up) {
          setMirrored(false);
          return;
        }

        // A reconnect may have missed any number of NOTE_ON/OFF messages.
        // Reclaim the publisher role and replace the hub's held-note set with
        // one authoritative snapshot from the serial-owning browser.
        if (picoConnectedRef.current) {
          bridge.publish("PICO_LINK_ON");
          bridge.publish(
            "PICO_NOTES_" + activeNotesRef.current.join(",")
          );
        }
      },
    });

    bridgeRef.current = bridge;
    bridge.connect();

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
    };
  }, []);

  const connectPico = async () => {
    if (!isSerialSupported()) {
      alert(
        "Web Serial is not supported in this browser. Use Chrome or Edge."
      );

      return;
    }

    try {
      serialRef.current = new PicoSerial({
        // Handle it here, then hand the same line to every other computer
        // watching, so their pages stay identical to this one.
        onLine: (line) => {
          handleLine(line);
          bridgeRef.current?.publish(line);
        },
        onConnect: () => {
          picoConnectedRef.current = true;
          setPicoConnected(true);
          bridgeRef.current?.publish("PICO_LINK_ON");
          bridgeRef.current?.publish(
            "PICO_NOTES_" + activeNotesRef.current.join(",")
          );
        },
        onDisconnect: () => {
          picoConnectedRef.current = false;
          setPicoConnected(false);
          updateActiveNotes([]);
          bridgeRef.current?.publish("PICO_LINK_OFF");
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
                picoConnected || mirrored
                  ? "pico-status on"
                  : "pico-status off"
              }
              title={
                mirrored && !picoConnected
                  ? "The board is plugged into another computer. This page is following it."
                  : undefined
              }
            >
              {picoConnected
                ? "Connected"
                : mirrored
                  ? "Mirroring"
                  : "Disconnected"}
            </span>

            {/* Web Serial needs a secure context, so it exists on localhost
                and not over a plain http:// IP. Offering the button to a
                viewer would only produce an error, so they get the mirror
                instead. */}
            {isSerialSupported() ? (
              <button
                className="connect-btn"
                onClick={picoConnected ? disconnectPico : connectPico}
              >
                {picoConnected ? "Disconnect" : "Connect Pico"}
              </button>
            ) : (
              <span
                className="api-status"
                title="Open the site on the host machine at http://localhost:5173 to connect the board."
              >
                Viewer
              </span>
            )}
          </div>
        </header>

        <main className="page-area">
          {page === "perform" && (
            <SongPlayer
              onProgress={setSongProgress}
              onSectionChange={setSongSection}
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
              activeNotes={activeNotes}
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
              sectionNotes={
                songSection?.scale ?? null
              }
              sectionTitle={
                songSection?.title ?? null
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
