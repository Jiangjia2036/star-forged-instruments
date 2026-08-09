// Scale and octave maths shared by the keyboard, the song cues and the
// TUNE command sent to the Pico.

const NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Every chromatic root, so a key detected from an audio track can always be
// matched. The on-screen buttons show the naturals; the sharps are reachable
// when automatic key following picks one.
const ROOT_SEMITONE = {
  C: 0,
  "C#": 1,
  D: 2,
  "D#": 3,
  E: 4,
  F: 5,
  "F#": 6,
  G: 7,
  "G#": 8,
  A: 9,
  "A#": 10,
  B: 11,
};

// Interval patterns in semitones from the root
const PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// Naturals only, for the key selector buttons
export const ROOTS = ["C", "D", "E", "F", "G", "A", "B"];

export const ALL_ROOTS = Object.keys(ROOT_SEMITONE);
export const MODES = Object.keys(PATTERNS);

export function noteName(midi) {
  return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

export function midiOf(root, octave) {
  return (octave + 1) * 12 + ROOT_SEMITONE[root];
}

// Two octaves by default, plus the closing root, so wide melodies and
// cross-octave chords are reachable without switching scales mid-song.
export function scaleNotes(root, octave, octaveCount = 2) {
  const base = midiOf(root, octave);
  const pattern = PATTERNS.major;

  const notes = [];

  for (let o = 0; o < octaveCount; o++) {
    for (const step of pattern) {
      notes.push(noteName(base + step + 12 * o));
    }
  }

  notes.push(noteName(base + 12 * octaveCount));

  return notes;
}

// Only one layout now: the shell's ring of positions IS the layout.
export const SPREADS = ["steps"];

// A rest. A button tuned to this stays silent on the Pico, and no key on
// the screen ever carries it. Must match the firmware's rest token.
export const REST = "-";

// The instrument's shell is a ring of FIFTEEN pitch positions - the same
// ring the notebook's tuning circles draw. The two lowest positions, just
// left of the hole, have no buttons; the THIRTEEN buttons occupy positions
// 3-15, ascending clockwise around the egg. See BUTTON_PINS in
// PicoCode/config.py for which GPIO sits at which position.
//
// So the buttons take a scale's notes from index 2 upward, and the two
// notes below stay screen-only. Must return exactly thirteen entries - the
// Pico rejects a TUNE_ whose count differs from its button count.
export function buttonNotes(root, octave) {
  return scaleNotes(root, octave, 2).slice(2);
}

// Map a note name to the physical button that currently plays it, or null.
// Rest entries never match a real note name, so rested buttons simply have
// no number.
export function buttonFor(note, notesForButtons) {
  const index = notesForButtons.indexOf(note);
  return index === -1 ? null : index + 1;
}

// Buttons for a song section: the section's fifteen-note ring, positions
// 3-15, with crossed-off notes replaced by rests so those buttons fall
// silent instead of playing something the song does not want.
export function sectionButtonNotes(section) {
  const erased = new Set(section.erased ?? []);

  return section.scale
    .slice(2)
    .map((note) => (erased.has(note) ? REST : note));
}

// What the on-screen keyboard shows during a section: the ring with the
// crossed-off notes erased, exactly as the notebook draws it.
export function sectionVisibleNotes(section) {
  const erased = new Set(section.erased ?? []);

  return section.scale.filter((note) => !erased.has(note));
}
