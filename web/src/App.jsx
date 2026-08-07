import "./App.css";
import { useRef, useState, useEffect } from "react";
import * as Tone from "tone";

import Keyboard from "./components/Keyboard";
import Controls from "./components/Controls";

function App() {
  const delay = useRef(
    new Tone.FeedbackDelay("8n", 0.4).toDestination()
  );

  const synth = useRef(
    new Tone.Synth().connect(delay.current)
  );

  const [volume, setVolume] = useState(-10);

  const [effectStrength, setEffectStrength] = useState(0);

  useEffect(() => {
    synth.current.volume.value = volume;
  }, [volume]);

  useEffect(() => {
    delay.current.wet.value = effectStrength / 100;
  }, [effectStrength]);

  return (
    <div className="app">
      <h1>Star Forged Instruments</h1>

      <Keyboard synth={synth} />

      <Controls
        volume={volume}
        setVolume={setVolume}
        effectStrength={effectStrength}
        setEffectStrength={setEffectStrength}
        delay={delay}
      />
    </div>
  );
}

export default App;