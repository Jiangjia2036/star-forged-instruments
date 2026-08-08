// Listens to a playing audio track and works out what note is sounding and
// what key the music is in, so the site can tell the performer what to press
// and retune the instrument to match.
//
// Two separate jobs:
//
//   note - the strongest partial in the spectrum right now. Fast and twitchy,
//          which is what you want for "press this".
//   key  - the distribution of pitch classes over several seconds, compared
//          against known key profiles. Slow and stable, which is what you
//          want before retuning an instrument mid-song.

const NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Krumhansl-Schmuckler key profiles: how prominent each scale degree tends
// to be in music written in a given key. Correlating a piece's actual pitch
// class distribution against these, rotated to all twelve roots, is the
// standard way to estimate a key.
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
  2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];

const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53,
  2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

// Musical range worth searching. Below this is bass thump and room rumble,
// above it is mostly cymbals and harmonics of notes already counted.
const MIN_HZ = 70;
const MAX_HZ = 1400;

export function midiToName(midi) {
  return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

export function freqToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

// Strongest spectral peak, refined by fitting a parabola across the peak bin
// and its neighbours so the estimate is not quantised to bin width.
export function detectNote(spectrum, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;

  const first = Math.max(1, Math.floor(MIN_HZ / binHz));
  const last = Math.min(spectrum.length - 2, Math.ceil(MAX_HZ / binHz));

  let peak = -1;
  let peakDb = -Infinity;

  for (let i = first; i <= last; i++) {
    if (spectrum[i] > peakDb) {
      peakDb = spectrum[i];
      peak = i;
    }
  }

  // Nothing meaningfully above the noise floor
  if (peak < 0 || peakDb < -70) return null;

  const left = spectrum[peak - 1];
  const right = spectrum[peak + 1];
  const denom = left - 2 * peakDb + right;

  const offset = denom === 0 ? 0 : (0.5 * (left - right)) / denom;

  const freq = (peak + offset) * binHz;

  if (!isFinite(freq) || freq < MIN_HZ || freq > MAX_HZ) return null;

  const midi = freqToMidi(freq);

  return {
    freq,
    midi,
    name: midiToName(midi),
    pitchClass: ((midi % 12) + 12) % 12,
    level: peakDb,
  };
}

// Energy per pitch class across the whole spectrum, for key estimation.
export function accumulateChroma(spectrum, sampleRate, fftSize, chroma) {
  const binHz = sampleRate / fftSize;

  const first = Math.max(1, Math.floor(MIN_HZ / binHz));
  const last = Math.min(spectrum.length - 1, Math.ceil(MAX_HZ / binHz));

  for (let i = first; i <= last; i++) {
    const db = spectrum[i];
    if (db < -80) continue;

    const freq = i * binHz;

    // dB back to a linear weight so loud partials count for more
    const weight = Math.pow(10, db / 20);

    const midi = 69 + 12 * Math.log2(freq / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;

    chroma[pc] += weight;
  }
}

function correlate(chroma, profile, rotation) {
  let sumC = 0;
  let sumP = 0;

  for (let i = 0; i < 12; i++) {
    sumC += chroma[i];
    sumP += profile[i];
  }

  const meanC = sumC / 12;
  const meanP = sumP / 12;

  let num = 0;
  let denC = 0;
  let denP = 0;

  for (let i = 0; i < 12; i++) {
    const c = chroma[(i + rotation) % 12] - meanC;
    const p = profile[i] - meanP;

    num += c * p;
    denC += c * c;
    denP += p * p;
  }

  const den = Math.sqrt(denC * denP);
  return den === 0 ? 0 : num / den;
}

// Best matching key, with the runner up so callers can judge confidence.
export function estimateKey(chroma) {
  let total = 0;
  for (let i = 0; i < 12; i++) total += chroma[i];
  if (total <= 0) return null;

  let best = null;
  let second = -Infinity;

  for (let root = 0; root < 12; root++) {
    for (const [mode, profile] of [
      ["major", MAJOR_PROFILE],
      ["minor", MINOR_PROFILE],
    ]) {
      const score = correlate(chroma, profile, root);

      if (!best || score > best.score) {
        if (best) second = best.score;
        best = { root, mode, score, name: NAMES[root] };
      } else if (score > second) {
        second = score;
      }
    }
  }

  if (!best) return null;

  return {
    ...best,
    // How far clear of the next best guess. Small margins mean the music is
    // ambiguous and the key should not be swapped on that evidence.
    margin: best.score - second,
  };
}

export function makeChroma() {
  return new Float64Array(12);
}

export function decayChroma(chroma, factor) {
  for (let i = 0; i < 12; i++) chroma[i] *= factor;
}
