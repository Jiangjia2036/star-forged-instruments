import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";

function App() {
  const delay = useRef(
    new Tone.FeedbackDelay("8n", 0.4).toDestination()
  );

  const synth = useRef(
    new Tone.Synth().connect(delay.current)
  );

  const [volume, setVolume] = useState(-10);
  const [effectStrength, setEffectStrength] = useState(0);
  const [selectedEffect, setSelectedEffect] = useState("");

  useEffect(() => {
    synth.current.volume.value = volume;
  }, [volume]);

  useEffect(() => {
    if (selectedEffect === "Echo") {
      delay.current.wet.value = effectStrength / 100;
    } else {
      delay.current.wet.value = 0;
    }
  }, [effectStrength, selectedEffect]);

  return (
    <div className="app">
      <Visualizer />

      <div className="ui">
        <h1>Star Forged Instruments</h1>

        <div className="bottom-ui">
          <Keyboard synth={synth} />

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