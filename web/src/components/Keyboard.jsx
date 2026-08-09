import { ROOTS, SPREADS, scaleNotes, buttonFor } from "../scales";

// Two octaves are shown at once so cross-octave chords and wide melodies are
// reachable without switching scales mid-song.

const noteHues = {
  C: 205,
  D: 275,
  E: 330,
  F: 15,
  G: 45,
  A: 95,
  B: 160,
};

function hueFor(note) {
  const base = noteHues[note[0]] ?? 205;
  return note.includes("#") ? base + 18 : base;
}

function Keyboard({
  synth,
  activeNotes,
  root,
  setRoot,
  octave,
  setOctave,
  spread,
  setSpread,
  buttonNotes,
}) {
  const notes = scaleNotes(root, octave, 2);

  const startNote = async (note) => {
    await synth.current.context.resume();
    synth.current.triggerAttack(note);
  };

  const stopNote = (note) => {
    synth.current.triggerRelease(note);
  };

  return (
    <section className="board">
      <div className="scale-row">
        <span className="label">Key</span>

        {ROOTS.map((name) => (
          <button
            key={name}
            className={root === name ? "scale-btn active" : "scale-btn"}
            onClick={() => setRoot(name)}
          >
            {name}
          </button>
        ))}

        <span className="divider" />

        <span className="label">Octave</span>

        <button
          className="scale-btn"
          onClick={() => setOctave(Math.max(2, octave - 1))}
        >
          -
        </button>

        <span className="octave-value">{octave}</span>

        <button
          className="scale-btn"
          onClick={() => setOctave(Math.min(6, octave + 1))}
        >
          +
        </button>

        <span className="divider" />

        <span className="label">Buttons</span>

        {SPREADS.map((name) => (
          <button
            key={name}
            className={spread === name ? "scale-btn active" : "scale-btn"}
            onClick={() => setSpread(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="keyboard">
        {notes.map((note, i) => {
          const btn = buttonFor(note, buttonNotes);

          return (
            <button
              key={note + i}
              style={{ "--glow-hue": hueFor(note) }}
              className={
                [
                  "key",
                  activeNotes.includes(note) ? "pico-active" : "",
                  btn ? "key-mapped" : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
              onMouseDown={() => startNote(note)}
              onMouseUp={() => stopNote(note)}
              onMouseLeave={(e) => {
                if (e.buttons) stopNote(note);
              }}
            >
              {btn && <span className="key-badge">{btn}</span>}
              <span className="key-name">{note}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default Keyboard;
