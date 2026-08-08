import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
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

  const serialRef = useRef(null);
  // mirror of activeNotes for use inside serial callbacks
  const activeNotesRef = useRef([]);

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

  const picoNoteOn = (note) => {
    console.log("Playing:", note);
    console.log("Visual:", note, "ON");
    const next = [
      ...activeNotesRef.current.filter((n) => n !== note),
      note,
    ];
    updateActiveNotes(next);
    synth.current.triggerAttack(note);
  };

  const picoNoteOff = (note) => {
    console.log("Visual:", note, "OFF");
    const next = activeNotesRef.current.filter((n) => n !== note);
    updateActiveNotes(next);
    if (next.length > 0) {
      // the synth is monophonic: fall back to the most recent held note
      synth.current.triggerAttack(next[next.length - 1]);
    } else {
      synth.current.triggerRelease();
    }
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
      await Tone.start(); // the click gesture unlocks audio for serial-driven notes
      serialRef.current = new PicoSerial({
        onLine: handleLine,
        onConnect: () => setPicoConnected(true),
        onDisconnect: () => {
          setPicoConnected(false);
          updateActiveNotes([]);
          synth.current.triggerRelease();
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

        <div className="bottom-ui">
          <Keyboard synth={synth} activeNotes={activeNotes} />

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
