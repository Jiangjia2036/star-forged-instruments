// Song charts for the performance mode.
//
// A song is a sequence of [note, beats] pairs. `null` is a rest. Times are
// derived from bpm so the chart stays readable and easy to edit.
//
// Notes are limited to C4 / D4 / E4 because those are the three physical
// buttons wired to the Pico (GP16, GP17, GP18). Add more once more buttons
// exist - nothing else needs to change.

// Which physical button plays each note. Mirrors NOTES in PicoCode/main.py.
export const NOTE_TO_BUTTON = {
  C4: 1,
  D4: 2,
  E4: 3,
};

function buildTrack(bpm, sequence) {
  const secondsPerBeat = 60 / bpm;

  let cursor = 0;
  const notes = [];

  for (const [note, beats] of sequence) {
    const span = beats * secondsPerBeat;

    if (note) {
      notes.push({
        note,
        time: cursor,
        // slight gap so repeated notes retrigger audibly
        duration: span * 0.88,
      });
    }

    cursor += span;
  }

  return { notes, duration: cursor };
}

function makeSong(id, title, bpm, sequence, extra = {}) {
  const track = buildTrack(bpm, sequence);

  return {
    id,
    title,
    bpm,
    notes: track.notes,
    duration: track.duration,
    // Drop an audio file in web/public and set audioUrl to play a real
    // recording as the timing source instead of the internal clock.
    audioUrl: null,
    ...extra,
  };
}

export const SONGS = [
  makeSong(
    "forge-call",
    "Forge Call",
    100,
    [
      ["C4", 1], ["E4", 1], ["D4", 1], [null, 1],
      ["C4", 1], ["E4", 1], ["D4", 2],
      ["E4", 1], ["D4", 1], ["C4", 1], [null, 1],
      ["D4", 1], ["C4", 1], ["C4", 2],

      ["E4", 1], ["E4", 1], ["D4", 1], ["C4", 1],
      ["D4", 2], ["E4", 2],
      ["C4", 1], ["D4", 1], ["E4", 1], ["D4", 1],
      ["C4", 4],
    ]
  ),

  makeSong(
    "ember-drift",
    "Ember Drift (Encore I)",
    84,
    [
      ["E4", 2], ["D4", 1], ["C4", 1],
      ["D4", 2], [null, 1], ["C4", 1],
      ["E4", 1], ["E4", 1], ["D4", 2],
      ["C4", 4],

      ["D4", 1], ["E4", 1], ["D4", 1], ["C4", 1],
      ["E4", 2], ["D4", 2],
      ["C4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
      ["C4", 4],
    ]
  ),

  makeSong(
    "last-light",
    "Last Light (Encore II)",
    120,
    [
      ["C4", 1], ["C4", 1], ["E4", 2],
      ["D4", 1], ["D4", 1], ["C4", 2],
      ["E4", 1], ["D4", 1], ["C4", 1], ["D4", 1],
      ["E4", 4],

      ["D4", 1], ["C4", 1], ["D4", 1], ["E4", 1],
      ["D4", 2], ["C4", 2],
      ["C4", 1], ["E4", 1], ["D4", 1], ["C4", 1],
      ["C4", 4],
    ]
  ),
];

export function totalSetlistSeconds() {
  return SONGS.reduce((sum, song) => sum + song.duration, 0);
}
