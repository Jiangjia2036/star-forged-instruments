import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";
import PicoController from "./components/PicoController";

function App() {

  const delay = useRef(
    new Tone.FeedbackDelay("8n", 0.4)
  );

  const synth = useRef(
    new Tone.Synth()
  );

  const analyzer = useRef(
    new Tone.Analyser("waveform", 256)
  );

  useEffect(() => {
    synth.current.connect(delay.current);

    delay.current.connect(analyzer.current);

    delay.current.toDestination();

    return () => {
      synth.current.dispose();
      delay.current.dispose();
      analyzer.current.dispose();
    };
  }, []);

  const keyboardRef = useRef(null);


  const [volume, setVolume] = useState(-10);
  const [effectStrength, setEffectStrength] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState("");

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

  const handleKeyboardReady = (keyboardControls) => {
    keyboardRef.current = keyboardControls;
  };

  const handlePicoDown = () => {
    console.log("Pico → First Key DOWN");

    keyboardRef.current?.playFirstKey();
  };

  const handlePicoUp = () => {
    console.log("Pico → First Key UP");

    keyboardRef.current?.stopFirstKey();
  };

  return (
    <div className="app">

      <Visualizer analyzer={analyzer} />

      <div className="ui">

        <h1>
          Star Forged Instruments
        </h1>

        <PicoController
          onButtonDown={handlePicoDown}
          onButtonUp={handlePicoUp}
        />

        <div className="bottom-ui">

          <Keyboard
            synth={synth}
            onReady={handleKeyboardReady}
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