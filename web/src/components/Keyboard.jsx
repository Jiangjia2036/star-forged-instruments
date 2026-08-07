import { useState } from "react";

function Keyboard({ synth }) {
  const scales = {
    C: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    D: ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"],
    G: ["G4", "A4", "B4", "C5", "D5", "E5", "F#5", "G5"],
  };

  const [scale, setScale] = useState("C");

  const startNote = async (note) => {
    await synth.current.context.resume();
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
    </section>
  );
}

export default Keyboard;