import { useState, useEffect } from "react";

function Keyboard({ synth, onReady }) {
  const scales = {
    C: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"],
    D: ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5", "D5"],
    G: ["G4", "A4", "B4", "C5", "D5", "E5", "F#5", "G5"],
  };

  const [scale, setScale] = useState("C");

  const [pressedKey, setPressedKey] = useState(null);


  const startNote = async (note) => {
    await synth.current.context.resume();

    synth.current.triggerAttack(note);

    setPressedKey(note);
  };


  const stopNote = () => {
    synth.current.triggerRelease();

    setPressedKey(null);
  };

  useEffect(() => {
    if (!onReady) {
      return;
    }

    const firstNote = scales[scale][0];

    onReady({
      playFirstKey: async () => {
        console.log(
          "Keyboard: Pico pressed →",
          firstNote
        );

        await startNote(firstNote);
      },

      stopFirstKey: () => {
        console.log(
          "Keyboard: Pico released"
        );

        stopNote();
      },
    });
  }, [scale, onReady]);

  return (
    <section className="keyboard-section">
      <h2>Keyboard</h2>


      <div className="scale-selector">
        <span>Scale</span>

        <div className="scale-buttons">

          <button
            className={
              scale === "C"
                ? "scale-btn active"
                : "scale-btn"
            }
            onClick={() => setScale("C")}
          >
            C
          </button>

          <button
            className={
              scale === "D"
                ? "scale-btn active"
                : "scale-btn"
            }
            onClick={() => setScale("D")}
          >
            D
          </button>

          <button
            className={
              scale === "G"
                ? "scale-btn active"
                : "scale-btn"
            }
            onClick={() => setScale("G")}
          >
            G
          </button>

        </div>
      </div>

    
      <div className="keyboard-wrapper">

        <div className="keyboard">

          {scales[scale].map((note) => (
            <button
              key={note}

              className={
                pressedKey === note
                  ? "key pressed"
                  : "key"
              }

              onMouseDown={() =>
                startNote(note)
              }

              onMouseUp={
                stopNote
              }

              onMouseLeave={
                stopNote
              }
            >
              {note
                .replace("4", "")
                .replace("5", "")}
            </button>
          ))}

        </div>

      </div>
    </section>
  );
}

export default Keyboard;