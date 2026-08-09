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

// Tuning sections, from the hand-drawn circles in the performance notebook.
//
// Each circle is one section of the set: a song, a timestamp range, and a
// ring of fifteen notes with exact octaves - the same fifteen positions the
// instrument's shell has. Buttons sit at ring positions 3-15; the two
// lowest positions have no buttons.
//
// `erased` lists the circled notes: the ones the song does not need. They
// are removed from the on-screen keyboard for the section, and a button
// whose position holds an erased note is tuned to a rest, so pressing it
// stays silent. The two buttonless low notes are circled in the notebook
// for the same reason - there is nothing there to press.
//
// While a track with sections is playing, these override the key/octave
// selectors, and every boundary retunes the Pico mid-song.

// "For X-Files" - all naturals from F4.
const XFILES_SCALE = [
  "F4", "G4", "A4", "B4", "C5", "D5", "E5",
  "F5", "G5", "A5", "B5", "C6", "D6", "E6", "F6",
];
const XFILES_ERASED = ["F4", "G4", "C5", "F5", "D6", "E6", "F6"];

// "For Television Rules the Nation" - the replacement circle (the E-minor
// one above it is scribbled out). D3 to D5 with F# only, and every D
// circled off, so the playable run starts at E3.
const TELEVISION_SCALE = [
  "D3", "E3", "F#3", "G3", "A3", "B3", "C4",
  "D4", "E4", "F#4", "G4", "A4", "B4", "C5", "D5",
];
const TELEVISION_ERASED = ["D3", "D4", "D5"];

// "For Da Funk" - D natural minor from D3, A# spelled as drawn.
const DAFUNK_SCALE = [
  "D3", "E3", "F3", "G3", "A3", "A#3", "C4",
  "D4", "E4", "F4", "G4", "A4", "A#4", "C5", "D5",
];
const DAFUNK_ERASED = ["D3", "E3", "F3", "E4", "A4", "C5", "D5"];

// The medley's circles tile its whole timeline: 0s -> 40s -> 2m12s -> end.
// `until: null` means "until the track ends".
const MEDLEY_SECTIONS = [
  {
    at: 0,
    until: 40,
    title: "X-Files",
    scale: XFILES_SCALE,
    erased: XFILES_ERASED,
  },
  {
    at: 40,
    until: 132,
    title: "Television Rules the Nation",
    scale: TELEVISION_SCALE,
    erased: TELEVISION_ERASED,
  },
  {
    at: 132,
    until: null,
    title: "Da Funk",
    scale: DAFUNK_SCALE,
    erased: DAFUNK_ERASED,
  },
];

// Which section is active at `seconds` into a track, or null.
export function sectionAt(song, seconds) {
  if (!song?.sections) return null;

  return (
    song.sections.find(
      (section) =>
        seconds >= section.at &&
        (section.until === null || seconds < section.until)
    ) ?? null
  );
}

export const SONGS = [
  // Backing tracks with no chart - they just play and you improvise over
  // them. The files live in web/public/audio and play through the computer's
  // speakers, as every backing track does.
  //
  // The standalone X-Files theme is the same song as the medley's opening
  // section, so it carries the same circle. Open-ended rather than 0-40s:
  // on the medley that boundary exists because Television takes over there,
  // and this track has nothing to take over.
  makeSong(
    "x-files",
    "The X-Files (theme)",
    120,
    [],
    {
      audioUrl: "/audio/x-files-theme.mp3",
      sections: [
        {
          at: 0,
          until: null,
          title: "X-Files",
          scale: XFILES_SCALE,
          erased: XFILES_ERASED,
        },
      ],
    }
  ),

  makeSong(
    "singularity-hack",
    "Singularity Hack 2026",
    120,
    [],
    {
      audioUrl: "/audio/SingularityHAcK2026.mp3",
      sections: MEDLEY_SECTIONS,
    }
  ),
];

export function totalSetlistSeconds() {
  return SONGS.reduce((sum, song) => sum + song.duration, 0);
}
