import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
import SongPlayer from "./components/SongPlayer";
import { PicoSerial, isSerialSupported } from "./pico-serial";

function App() {
  const delay = useRef(null);
  const analyzer = useRef(null);
  const synth = useRef(null);

  // build the audio graph exactly once, not on every render
  if (synth.current === null) {
    delay.current = new Tone.FeedbackDelay("8n", 0.4);
    analyzer.current = new Tone.Analyser("waveform", 256);
    synth.current = new Tone.Synth().connect(delay.current);
    delay.current.connect(analyzer.current);
    analyzer.current.toDestination();
  }

  const [volume, setVolume] = useState(-10);
  const [effectStrength, setEffectStrength] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState("");

  const [picoConnected, setPicoConnected] = useState(false);
  const [activeNotes, setActiveNotes] = useState([]);

  // Notes the current song wants the performer to press right now
  const [targetNotes, setTargetNotes] = useState([]);

  const serialRef = useRef(null);
  // mirror of activeNotes for use inside serial callbacks
  const activeNotesRef = useRef([]);

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
    synth.current.volume.value = volume;
  }, [volume]);

  useEffect(() => {
    if (selectedEffect === "Echo") {
      delay.current.wet.value =
        effectStrength / 100;
    } else {
      delay.current.wet.value = 0;
    }
  }, [effectStrength, selectedEffect]);

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

    const effectMatch = line.match(/^EFFECT_ECHO_(ON|OFF)$/);
    if (effectMatch) {
      setSelectedEffect(effectMatch[1] === "ON" ? "Echo" : "");
      return;
    }
    // PICO_READY and any debug lines land here
  };

  const connectPico = async () => {
    if (!isSerialSupported()) {
      alert("Web Serial is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    try {
      serialRef.current = new PicoSerial({
        onLine: handleLine,
        onConnect: () => setPicoConnected(true),
        onDisconnect: () => {
          setPicoConnected(false);
          updateActiveNotes([]);
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


  // Song playback drives the speaker wired to the Pico, so the instrument
  // itself produces the sound. The browser only shows what to play.

  const songNoteOn = (note) => {
    console.log("Song:", note, "ON");
    serialRef.current?.send("CMD_ON_" + note);
  };

  const songNoteOff = (note) => {
    serialRef.current?.send("CMD_OFF_" + note);
  };

  return (
    <div className="app">
      <Visualizer analyzer={analyzer} />

      <div className="ui">
        <h1>Star Forged Instruments</h1>

        <div className="pico-bar">
          <button
            className="connect-btn"
            onClick={picoConnected ? disconnectPico : connectPico}
          >
            {picoConnected ? "Disconnect Pico" : "Connect Pico"}
          </button>

          <span
            className={
              picoConnected
                ? "pico-status on"
                : "pico-status off"
            }
          >
            Pico: {picoConnected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <SongPlayer
          onNoteOn={songNoteOn}
          onNoteOff={songNoteOff}
          onTargetsChange={setTargetNotes}
        />

        <div className="bottom-ui">
          <Keyboard
            synth={synth}
            activeNotes={activeNotes}
            targetNotes={targetNotes}
          />

          <Controls
            volume={volume}
            setVolume={setVolume}
            effectStrength={effectStrength}
            setEffectStrength={setEffectStrength}
            selectedEffect={selectedEffect}
            setSelectedEffect={setSelectedEffect}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
