import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
import SongPlayer from "./components/SongPlayer";
import { PicoSerial, isSerialSupported } from "./pico-serial";
import { buttonNotes as computeButtonNotes } from "./scales";

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

  // Song progress, surfaced as a bar across the top of the page
  const [songProgress, setSongProgress] = useState(0);

  // WAV backing tracks stored in the Pico's own flash
  const [picoTracks, setPicoTracks] = useState([]);
  const [picoTrackPlaying, setPicoTrackPlaying] = useState(null);

  // Scale / octave / button layout. Changing any of these retunes the Pico.
  const [root, setRoot] = useState("C");
  const [octave, setOctave] = useState(4);
  const [spread, setSpread] = useState("steps");

  const picoNotes = computeButtonNotes(root, octave, spread);

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


  // Effects on the instrument itself. Warp changes the oscillator timbre and
  // Chorus drives the tremolo, so all three buttons produce a distinct sound
  // from the Pico rather than only affecting browser audio.
  useEffect(() => {
    if (!picoConnected) return;

    const pico = serialRef.current;
    if (!pico) return;

    if (selectedEffect === "Warp") {
      pico.send("FX_WAVE_SAW");
      pico.send("FX_TREM_0");
    } else if (selectedEffect === "Chorus") {
      pico.send("FX_WAVE_SQUARE");
      pico.send("FX_TREM_" + Math.round(effectStrength));
    } else {
      pico.send("FX_WAVE_SINE");
      pico.send("FX_TREM_0");
    }
  }, [picoConnected, selectedEffect, effectStrength]);


  // Digital volume control from the website, riding on the physical knob
  useEffect(() => {
    if (!picoConnected) return;

    // slider is -40..0 dB; map to 0..100 for the Pico
    const level = Math.round(((volume + 40) / 40) * 100);
    serialRef.current?.send("VOL_" + Math.max(0, Math.min(100, level)));
  }, [picoConnected, volume]);

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

    // Backing tracks living in the Pico's flash
    if (line.startsWith("TRACKS_")) {
      const names = line
        .slice(7)
        .split("|")
        .filter(Boolean);
      console.log("Pico tracks:", names);
      setPicoTracks(names);
      return;
    }

    const posMatch = line.match(/^TRACK_POS_(\d+)$/);
    if (posMatch) {
      // Position reported by the Pico as it plays, so the bar follows the
      // speaker instead of a timer that could drift
      setSongProgress(Math.min(100, Number(posMatch[1])));
      return;
    }

    if (line === "TRACK_END" || line === "TRACK_STOPPED") {
      setPicoTrackPlaying(null);
      setSongProgress(0);
      return;
    }

    if (line.startsWith("TRACK_ERROR_")) {
      console.log("Pico track error:", line.slice(12));
      setPicoTrackPlaying(null);
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
        onConnect: () => {
          setPicoConnected(true);
          // ask what backing tracks are on the board
          setTimeout(() => {
            serialRef.current?.send("TRACK_LIST");
          }, 200);
        },
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


  // Backing tracks played by the Pico itself, mixed with your beeps
  const playPicoTrack = (name) => {
    console.log("Pico track play:", name);
    setPicoTrackPlaying(name);
    serialRef.current?.send("TRACK_PLAY_" + name);
  };

  const stopPicoTrack = () => {
    serialRef.current?.send("TRACK_STOP");
    setPicoTrackPlaying(null);
    setSongProgress(0);
  };


  // Retune the instrument whenever the key, octave or button layout changes,
  // so the physical buttons always play the scale shown on screen.
  const tuneCommand = "TUNE_" + picoNotes.join("_");

  useEffect(() => {
    if (!picoConnected) return;

    console.log("Tuning Pico:", tuneCommand);
    serialRef.current?.send(tuneCommand);
  }, [picoConnected, tuneCommand]);

  return (
    <div className="app">
      <Visualizer analyzer={analyzer} activeNotes={activeNotes} />

      {/* Song progress across the very top of the page */}
      <div className="top-progress">
        <div
          className="top-progress-fill"
          style={{ width: songProgress + "%" }}
        />
      </div>

      <div className="ui">
        <header className="topbar">
          <h1 className="brand">Star Forged Instruments</h1>

          <div className="pico-bar">
            <span
              className={
                picoConnected
                  ? "pico-status on"
                  : "pico-status off"
              }
            >
              {picoConnected ? "Connected" : "Disconnected"}
            </span>

            <button
              className="connect-btn"
              onClick={picoConnected ? disconnectPico : connectPico}
            >
              {picoConnected ? "Disconnect" : "Connect Pico"}
            </button>
          </div>
        </header>

        <SongPlayer
          onNoteOn={songNoteOn}
          onNoteOff={songNoteOff}
          onTargetsChange={setTargetNotes}
          onProgress={setSongProgress}
          buttonNotes={picoNotes}
          picoTracks={picoTracks}
          picoTrackPlaying={picoTrackPlaying}
          onPlayPicoTrack={playPicoTrack}
          onStopPicoTrack={stopPicoTrack}
        />

        <Keyboard
          synth={synth}
          activeNotes={activeNotes}
          targetNotes={targetNotes}
          root={root}
          setRoot={setRoot}
          octave={octave}
          setOctave={setOctave}
          spread={spread}
          setSpread={setSpread}
          buttonNotes={picoNotes}
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
  );
}

export default App;
