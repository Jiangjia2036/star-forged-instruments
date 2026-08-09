// Song charts for the performance mode.
//
// A song is a sequence of [note, beats] pairs. `null` is a rest. Times are
// derived from bpm so the chart stays readable and easy to edit.
//
// Notes are limited to C4 and E4 because those are the two physical buttons
// currently wired to the Pico (GP16, GP17). Every note in these charts is
// playable on the instrument as it stands, so the cues never ask for a key
// that does not exist. Add G4 once the third button is soldered.

// Which button plays a given note is no longer fixed - it depends on the
// selected key, octave and button layout. See buttonFor() in scales.js.

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
      ["C4", 1], ["E4", 1], ["C4", 1], [null, 1],
      ["C4", 1], ["E4", 1], ["C4", 2],
      ["E4", 1], ["C4", 1], ["E4", 1], [null, 1],
      ["E4", 1], ["C4", 1], ["C4", 2],

      ["E4", 1], ["E4", 1], ["C4", 1], ["C4", 1],
      ["E4", 2], ["C4", 2],
      ["C4", 1], ["E4", 1], ["C4", 1], ["E4", 1],
      ["C4", 4],
    ]
  ),

  // Backing track with no chart - it just plays and you improvise over it.
  // The file lives in web/public/audio and plays through the computer's
  // speakers, as every backing track does.
  makeSong(
    "dark-horse",
    "Dark Horse (backing)",
    132,
    [],
    { audioUrl: "/audio/dark-horse.m4a" }
  ),

  makeSong(
    "x-files",
    "The X-Files (theme)",
    120,
    [],
    { audioUrl: "/audio/x-files-theme.mp3" }
  ),
];

export function totalSetlistSeconds() {
  return SONGS.reduce((sum, song) => sum + song.duration, 0);
}
