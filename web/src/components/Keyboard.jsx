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
  const base =
    noteHues[note[0]] ?? 205;

  return note.includes("#")
    ? base + 18
    : base;
}

function Keyboard({
  synth,
  activeNotes,
  sustain,
  root,
  setRoot,
  octave,
  setOctave,
  spread,
  setSpread,
  buttonNotes,
  sectionNotes = null,
  sectionTitle = null,
}) {
  // While a song section is in force its fifteen notes ARE the keyboard -
  // exact octaves from the tuning circle. Otherwise the key/octave
  // selectors decide, as always.
  const tunedBySong = Boolean(sectionNotes);
  const notes = sectionNotes ?? scaleNotes(root, octave, 2);

  const startNote = async (note) => {
    await synth.current.context.resume();

    synth.current.triggerAttack(note);

    // Let the visualizer know that the browser keyboard is being played.
    window.dispatchEvent(
      new CustomEvent(
        "star-forged-note-on",
        {
          detail: { note },
        }
      )
    );
  };

  const stopNote = (note) => {
    // Normal release:
    // 1 second when Sustain is OFF
    //
    // Sustain release:
    // 6 seconds when Sustain is ON
    synth.current.set({
      envelope: {
        release: sustain
          ? 6
          : 1,
      },
    });

    synth.current.triggerRelease(note);

    window.dispatchEvent(
      new CustomEvent(
        "star-forged-note-off",
        {
          detail: { note },
        }
      )
    );
  };

  return (
    <section className="board">
      <div className="scale-row">
        {/* A playing section owns the tuning; the selectors would be
            overridden silently, so they are disabled rather than lying. */}
        {tunedBySong && (
          <span
            className="section-chip"
            title="This part of the song sets the notes. Stop playback to tune by hand."
          >
            ♪ {sectionTitle}
          </span>
        )}

        <span className="label">Key</span>

        {ROOTS.map((name) => (
          <button
            key={name}
            className={root === name ? "scale-btn active" : "scale-btn"}
            disabled={tunedBySong}
            onClick={() => setRoot(name)}
          >
            {name}
          </button>
        ))}

        <span className="divider" />

        <span className="label">
          Octave
        </span>

        <button
          className="scale-btn"
          disabled={tunedBySong}
          onClick={() => setOctave(Math.max(2, octave - 1))}
        >
          -
        </button>

        <span className="octave-value">
          {octave}
        </span>

        <button
          className="scale-btn"
          disabled={tunedBySong}
          onClick={() => setOctave(Math.min(6, octave + 1))}
        >
          +
        </button>

        <span className="divider" />

        <span className="label">
          Buttons
        </span>

        {SPREADS.map((name) => (
          <button
            key={name}
            className={spread === name ? "scale-btn active" : "scale-btn"}
            disabled={tunedBySong}
            onClick={() => setSpread(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="keyboard">
        {notes.map((note, i) => {
          const btn =
            buttonFor(
              note,
              buttonNotes
            );

          return (
            <button
              key={note + i}
              style={{
                "--glow-hue":
                  hueFor(note),
              }}
              className={[
                "key",
                activeNotes.includes(
                  note
                )
                  ? "pico-active"
                  : "",
                btn
                  ? "key-mapped"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={() =>
                startNote(note)
              }
              onMouseUp={() =>
                stopNote(note)
              }
              onMouseLeave={(e) => {
                if (e.buttons) {
                  stopNote(note);
                }
              }}
            >
              {btn && (
                <span className="key-badge">
                  {btn}
                </span>
              )}

              <span className="key-name">
                {note}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default Keyboard;
