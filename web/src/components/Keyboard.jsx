import * as Tone from "tone";

function Keyboard() {
  const synth = new Tone.Synth().toDestination();

  const notes = [
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5",
  ];

  const startNote = async (note) => {
    await Tone.start();
    synth.triggerAttack(note);
  };

  const stopNote = () => {
    synth.triggerRelease();
  };

  return (
    <section>
      <h2>Keyboard</h2>

      <div className="keyboard">
        {notes.map((note) => (
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