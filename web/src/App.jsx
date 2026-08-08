import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";
import Visualizer from "./components/Visualizer";

function App() {
  const delay = useRef(
    new Tone.FeedbackDelay("8n", 0.4)
  );

  const analyzer = useRef(
    new Tone.Analyser("waveform", 256)
  );

  const synth = useRef(
    new Tone.Synth().connect(delay.current)
  );

  delay.current.connect(analyzer.current);
  analyzer.current.toDestination();

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

  useEffect(() => {
    const interval = setInterval(() => {
      const values = analyzer.current.getValue();

      console.log(values);
    }, 100);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="app">
      <Visualizer analyzer={analyzer} />

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