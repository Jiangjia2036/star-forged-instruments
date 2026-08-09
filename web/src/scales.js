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

// Which notes the twelve physical buttons play.
//
// Only one layout now. The "chord" and "wide" spreads existed to make six
// buttons useful by skipping degrees - a triad reaches further than six
// adjacent notes do. Twelve buttons already span a full scale from the root
// to the fifth above the octave, and a skipping layout across twelve keys
// would run past 2 kHz, where this speaker and the tone filter give up.
// Use the octave +/- control to move the range instead.
export const SPREADS = ["steps"];

// Twelve buttons, in BUTTON_PINS order - which is pitch order, not pin
// order. See the table above BUTTON_PINS in PicoCode/config.py.
//
// Indices 9 and 10 are deliberately out of pitch order: the board has F
// assigned to GP4 and E to GP5, so index 9 carries the higher of that pair.
// This has to match DEFAULT_NOTES in config.py, or the buttons swap note the
// moment the website connects and retunes the board.
//
// Must return exactly twelve notes. The Pico rejects a TUNE_ command whose
// note count differs from its button count.
export function buttonNotes(root, octave) {
  const notes = scaleNotes(root, octave, 2);

  return [
    notes[0], notes[1], notes[2], notes[3], notes[4],
    notes[5], notes[6], notes[7], notes[8],
    notes[10], notes[9],
    notes[11],
  ];
}

// Map a note name to the physical button that currently plays it, or null.
export function buttonFor(note, notesForButtons) {
  const index = notesForButtons.indexOf(note);
  return index === -1 ? null : index + 1;
}

// A song section hands the keyboard an explicit fifteen-note scale instead
// of one derived from the key selector. The buttons take the lowest twelve,
// through the same index 9/10 swap as buttonNotes above - the physical F key
// sits where the higher of that pair belongs, whatever the notes are called
// this section.
export function sectionButtonNotes(scale) {
  return [
    scale[0], scale[1], scale[2], scale[3], scale[4],
    scale[5], scale[6], scale[7], scale[8],
    scale[10], scale[9],
    scale[11],
  ];
}
