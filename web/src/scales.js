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

// Which three notes the physical buttons play.
//
// GP16 and GP17 are the two currently wired to the board, so the first two
// entries are what you can actually play. GP18 is the third voice.
//
// "chord"  - root / third / fifth, so the wired pair gives C and E in C major
// "steps"  - first three scale degrees, adjacent notes for melodies
// "wide"   - root / third / root an octave up, for cross-octave chords
export const SPREADS = ["chord", "steps", "wide"];

export function buttonNotes(root, octave, spread) {
  const notes = scaleNotes(root, octave, 2);

  if (spread === "steps") {
    return [notes[0], notes[1], notes[2]];
  }

  if (spread === "wide") {
    return [notes[0], notes[2], notes[7]];
  }

  return [notes[0], notes[2], notes[4]];
}

// Map a note name to the physical button that currently plays it, or null.
export function buttonFor(note, notesForButtons) {
  const index = notesForButtons.indexOf(note);
  return index === -1 ? null : index + 1;
}
