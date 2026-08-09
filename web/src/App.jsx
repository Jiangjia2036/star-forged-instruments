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

  // build the audio graph exactly once, not on every render
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

  // Damper pedal. Either the GP20 switch or the on-screen toggle.
  const [sustain, setSustain] = useState(false);

  const [picoEcho, setPicoEcho] = useState(false);

  // Where the physical volume knob is sitting, 0-100
  const [potVolume, setPotVolume] = useState(0);

  // Song progress, surfaced as a bar across the top of the page
  const [songProgress, setSongProgress] = useState(0);

  // Each section has its own hash URL. The UFO visualizer stays mounted behind
  // every view, while the keyboard remains exclusive to the Perform page.
  const [page, setPage] = useState(pageFromHash);

  // Scale / octave / button layout. Changing any of these retunes the Pico.
  const [root, setRoot] = useState("C");
  const [octave, setOctave] = useState(4);
  // "chord" puts C and E on the two wired buttons, with G on the third
  const [spread, setSpread] = useState("chord");

  const picoNotes = computeButtonNotes(root, octave, spread);

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
        if (!response.ok) throw new Error("API health check failed");
        return response.json();
      })
      .then((health) => setApiOnline(health.status === "ok"))
      .catch((error) => {
        if (error.name !== "AbortError") setApiOnline(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncPageToHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", syncPageToHash);

    return () => window.removeEventListener("hashchange", syncPageToHash);
  }, []);

  const navigateToPage = (nextPage) => {
    setPage(nextPage);
    window.location.hash = nextPage === "perform" ? "" : nextPage;
  };

  // Browsers start the audio context suspended and only Tone.start() reliably
  // unlocks it. pointerdown fires before mousedown, so the very first click
  // anywhere - a key, a scale button, Connect Pico - starts audio in time.
  useEffect(() => {
    const unlock = async () => {
      try {
        await Tone.start();
      } catch (err) {
        console.log("Audio unlock failed:", err.message);
      }

      if (Tone.getContext().state === "running") {
        console.log("Audio context running");
        window.removeEventListener("pointerdown", unlock);
      }
    };

    window.addEventListener("pointerdown", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  useEffect(() => {
    delay.current.wet.value =
      selectedEffect === "Echo" ? effectStrength / 100 : 0;
  }, [effectStrength, selectedEffect]);

  useEffect(() => {
    if (!picoConnected) return;

    const pico = serialRef.current;
    if (!pico) return;

    const depth = Math.round(effectStrength);

    if (selectedEffect === "Warp") {
      pico.send("FX_WAVE_SAW");
      pico.send("FX_VIB_" + depth);
      pico.send("FX_TREM_0");
      pico.send("FX_ECHO_OFF");
    } else if (selectedEffect === "Echo") {
      pico.send("FX_WAVE_SINE");
      pico.send("FX_VIB_0");
      pico.send("FX_TREM_0");
      pico.send("FX_ECHO_ON");
    } else if (selectedEffect === "Chorus") {
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
  }, [picoConnected, selectedEffect, effectStrength]);

  // Volume is set by the potentiometer alone. The site only mirrors it, so
  // nothing is sent to the Pico here - see the VOL_ handler in handleLine.

  const updateActiveNotes = (notes) => {
    activeNotesRef.current = notes;
    setActiveNotes(notes);
  };

  // Pico input is VISUAL ONLY. The sound for a physical button press comes
  // from the speaker wired to the Pico's own I2S output, so the browser must
  // not play the note as well or it would double up and lag behind.

  const picoNoteOn = (note) => {
    console.log("Visual:", note, "ON");
    const next = [
      ...activeNotesRef.current.filter((n) => n !== note),
      note,
    ];
    updateActiveNotes(next);
  };

  const picoNoteOff = (note) => {
    console.log("Visual:", note, "OFF");
    updateActiveNotes(
      activeNotesRef.current.filter((n) => n !== note)
    );
  };

  const handleLine = (line) => {
    const noteMatch = line.match(/^NOTE_([A-G]#?[0-8])_(ON|OFF)$/);
    if (noteMatch) {
      const [, note, action] = noteMatch;
      if (action === "ON") {
        picoNoteOn(note);
      } else {
        picoNoteOff(note);
      }
      return;
    }

    // Echo state reported by the board. This is display only on purpose.
    // Feeding it into selectedEffect made the site answer the report with
    // FX_ECHO_ON, which latched web_echo true on the Pico so the physical
    // switch could never turn echo back off.
    const effectMatch = line.match(/^EFFECT_ECHO_(ON|OFF)$/);
    if (effectMatch) {
      setPicoEcho(effectMatch[1] === "ON");
      return;
    }

    // Potentiometer position, 0-100. Read only: the knob is the sole volume
    // control and this just moves the bar to match it.
    const volMatch = line.match(/^VOL_(\d+)$/);
    if (volMatch) {
      setPotVolume(Math.min(100, Number(volMatch[1])));
      return;
    }

    // Damper pedal state reported by the board
    const sustainMatch = line.match(/^SUSTAIN_(ON|OFF)$/);
    if (sustainMatch) {
      setSustain(sustainMatch[1] === "ON");
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
        if (!up) setMirrored(false);
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
      alert("Web Serial is not supported in this browser. Use Chrome or Edge.");
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
          setPicoConnected(true);
          bridgeRef.current?.publish("PICO_LINK_ON");
        },
        onDisconnect: () => {
          setPicoConnected(false);
          updateActiveNotes([]);
          bridgeRef.current?.publish("PICO_LINK_OFF");
        },
      });
      await serialRef.current.connect();
    } catch (err) {
      console.log("Connect failed:", err.message);
    }
  };

  const disconnectPico = () => {
    serialRef.current?.disconnect();
  };


  // Retune the instrument whenever the key, octave or button layout changes,
  // so the physical buttons always play the scale shown on screen.
  const tuneCommand = "TUNE_" + picoNotes.join("_");

  useEffect(() => {
    if (!picoConnected) return;

    console.log("Tuning Pico:", tuneCommand);
    serialRef.current?.send(tuneCommand);
  }, [picoConnected, tuneCommand]);

  // The team view takes over the whole screen rather than sitting inside the
  // instrument layout. The starfield stays mounted behind it, so the UFO can
  // fly out of frame on the way there and back in on the way home.
  if (page === "team") {
    return (
      <div className="app">
        <Visualizer
          analyzer={analyzer}
          activeNotes={activeNotes}
          currentPage="team"
        />

        <TeamPage onBack={() => navigateToPage("perform")} />
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

      {/* Song progress across the very top of the page */}
      <div className="top-progress">
        <div
          className="top-progress-fill"
          style={{ width: songProgress + "%" }}
        />
      </div>

      <div className="ui">
        <header className="topbar">
          <h1 className="brand">Star Forged</h1>

          <nav className="nav">
            {[
              ["perform", "Perform"],
              ["instrument", "Instrument"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={page === id ? "nav-btn active" : "nav-btn"}
                type="button"
                aria-current={page === id ? "page" : undefined}
                onClick={() => navigateToPage(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="pico-bar">
            <button
              className="page-btn"
              type="button"
              onClick={() => navigateToPage("team")}
            >
              Meet The Team
            </button>

            <span
              className={apiOnline ? "api-status on" : "api-status"}
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

        {/* Scrolling section. The starfield behind it and the keyboard
            below it stay where they are. */}
        <main className="page-area">
          {page === "perform" && (
            <SongPlayer
              onProgress={setSongProgress}
            />
          )}

          {page === "instrument" && <InstrumentPage />}

        </main>

        {page === "perform" && (
          <div className="dock">
            <Keyboard
              synth={synth}
              activeNotes={activeNotes}
              root={root}
              setRoot={setRoot}
              octave={octave}
              setOctave={setOctave}
              spread={spread}
              setSpread={setSpread}
              buttonNotes={picoNotes}
            />

            <Controls
              effectStrength={effectStrength}
              setEffectStrength={setEffectStrength}
              selectedEffect={selectedEffect}
              setSelectedEffect={setSelectedEffect}
              picoEcho={picoEcho}
              potVolume={potVolume}
              picoConnected={picoConnected}
              sustain={sustain}
              onToggleSustain={() => {
                const next = !sustain;
                setSustain(next);
                serialRef.current?.send(
                  "FX_SUSTAIN_" + (next ? "ON" : "OFF")
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
