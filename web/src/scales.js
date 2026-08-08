// Scale and octave maths shared by the keyboard, the song cues and the
// TUNE command sent to the Pico.

const NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

const ROOT_SEMITONE = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
};

// Interval patterns in semitones from the root
const PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

export const ROOTS = Object.keys(ROOT_SEMITONE);
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

// Which three notes the physical buttons play.
//
// "steps"  - first three scale degrees, good for melodies
// "chord"  - root / third / fifth, so the three buttons form a triad
// "wide"   - root / third / root an octave up, for cross-octave chords
export const SPREADS = ["steps", "chord", "wide"];

export function buttonNotes(root, octave, spread) {
  const notes = scaleNotes(root, octave, 2);

  if (spread === "chord") {
    return [notes[0], notes[2], notes[4]];
  }

  if (spread === "wide") {
    return [notes[0], notes[2], notes[7]];
  }

  return [notes[0], notes[1], notes[2]];
}

// Map a note name to the physical button that currently plays it, or null.
export function buttonFor(note, notesForButtons) {
  const index = notesForButtons.indexOf(note);
  return index === -1 ? null : index + 1;
}
