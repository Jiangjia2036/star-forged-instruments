import { useState, useEffect, useRef } from "react";
import * as Tone from "tone";

function Keyboard() {
  const synth = useRef(new Tone.Synth().toDestination());

  const scales = {
    C: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    D: ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"],
    G: ["G4", "A4", "B4", "C5", "D5", "E5", "F#5", "G5"],
  };

  const [scale, setScale] = useState("C");
  const [volume, setVolume] = useState(-10);

  useEffect(() => {
    synth.current.volume.value = volume;
  }, [volume]);

  const startNote = async (note) => {
    await Tone.start();
    synth.current.triggerAttack(note);
  };

  const stopNote = () => {
    synth.current.triggerRelease();
  };

  return (
    <section>
      <h2>Keyboard</h2>

      <div className="scale-selector">
        <span>Scale</span>

        <div className="scale-buttons">
          <button
            className={scale === "C" ? "scale-btn active" : "scale-btn"}
            onClick={() => setScale("C")}
          >
            C
          </button>

          <button
            className={scale === "D" ? "scale-btn active" : "scale-btn"}
            onClick={() => setScale("D")}
          >
            D
          </button>

          <button
            className={scale === "G" ? "scale-btn active" : "scale-btn"}
            onClick={() => setScale("G")}
          >
            G
          </button>
        </div>
      </div>

      <div className="keyboard">
        {scales[scale].map((note) => (
          <button
            key={note}
            className="key"
            onMouseDown={() => startNote(note)}
            onMouseUp={stopNote}
            onMouseLeave={stopNote}
          >
            {note.replace("4", "").replace("5", "")}
          </button>
        ))}
      </div>

      <div className="volume-control">
        <label>Volume: {volume} dB</label>

        <br />

        <input
          type="range"
          min="-40"
          max="0"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </div>
    </section>
  );
}

export default Keyboard;