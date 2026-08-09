"""Polyphonic synthio engine with a clean sine default and safe chord gain."""

import array
import math

import synthio

import config
from tuning import note_to_freq
from waveforms import WAVES


_GAIN_RAMP = array.array("h", (0, 32767))

_LN2 = math.log(2.0)


def _loudness_weight(frequency):
    """Relative level for a note, 0-1, compensating small-speaker roll-off.

    1.0 at and below LOW_BOOST_REF_HZ, sloping down above it. Attenuating
    the top is the only direction available: the low notes already sit at
    the peak budget, so the tilt has to come out of the treble.
    """

    if config.LOW_BOOST_DB_PER_OCTAVE <= 0 or frequency <= config.LOW_BOOST_REF_HZ:
        return 1.0

    octaves = math.log(frequency / config.LOW_BOOST_REF_HZ) / _LN2
    decibels = min(
        config.LOW_BOOST_DB_PER_OCTAVE * octaves,
        config.LOW_BOOST_MAX_DB,
    )

    return 10.0 ** (-decibels / 20.0)


def _envelope(release_s):
    return synthio.Envelope(
        attack_time=config.ATTACK_S,
        decay_time=config.DECAY_S,
        release_time=release_s,
        attack_level=1.0,
        sustain_level=config.SUSTAIN_LEVEL,
    )


class SynthEngine:
    def __init__(self):
        self.synth = synthio.Synthesizer(
            sample_rate=config.SAMPLE_RATE,
            channel_count=1,
        )
        self.note_names = list(config.DEFAULT_NOTES)

        # index -> (Note, gain ramp, tremolo LFO, vibrato LFO)
        self._voices = {}
        self.sustain = False

        self.wave_name = "SINE"
        self.vibrato_depth = 0
        self.tremolo_depth = 0

        self._short_env = _envelope(config.RELEASE_S)
        self._long_env = _envelope(config.PEDAL_RELEASE_S)

    @property
    def source(self):
        return self.synth

    @property
    def held_note_count(self):
        return len(self._voices)

    def _targets(self):
        """Per-voice level, keyed by button index.

        synthio mixes all notes before anything in effects.py can process
        them. CircuitPython 10.2 applies its own hard-knee compression when
        that sum exceeds roughly 85% of full scale. Dividing by sqrt(N)
        kept average loudness high but repeatedly crossed that knee, which
        created the gritty intermodulation heard with two buttons.

        Sharing one peak budget between the voices keeps every possible
        phase alignment clean. The downstream volume knob then changes the
        already-clean chord as a whole.

        The loudness tilt divides that same budget unevenly instead of
        enlarging it, so the headroom guarantee is unchanged: a chord still
        sums to exactly CHORD_TOTAL_LEVEL, and a single note still peaks at
        SINGLE_NOTE_LEVEL.

        Nothing outside this method scales these levels. A previous version
        let the flex sensor's wah trim them for its resonance, which made
        the instrument quieter whenever the strip moved; the flex sensor now
        fires a sound effect and leaves the synth alone.
        """

        weights = {
            index: _loudness_weight(voice[0].frequency)
            for index, voice in self._voices.items()
        }

        if not weights:
            return {}

        if len(weights) == 1:
            index = next(iter(weights))
            return {index: config.SINGLE_NOTE_LEVEL * weights[index]}

        total = sum(weights.values())
        if total <= 0:
            return {index: 0.0 for index in weights}

        return {
            index: config.CHORD_TOTAL_LEVEL * weight / total
            for index, weight in weights.items()
        }

    def _rebalance(self):
        targets = self._targets()

        for index, voice in self._voices.items():
            gain = voice[1]
            current = gain.value

            gain.offset = current
            gain.scale = targets[index] - current
            gain.retrigger()

    def _new_tremolo(self):
        depth = self.tremolo_depth / 100.0
        return synthio.LFO(
            rate=config.TREMOLO_RATE_HZ,
            scale=depth / 2.0,
            offset=1.0 - depth / 2.0,
        )

    def _new_vibrato(self):
        scale = (
            self.vibrato_depth
            / 100.0
            * (config.VIBRATO_SEMITONES / 12.0)
        )
        return synthio.LFO(rate=config.VIBRATO_RATE_HZ, scale=scale)

    def note_on(self, index):
        if index in self._voices or index >= len(self.note_names):
            return

        frequency = note_to_freq(self.note_names[index])
        if frequency is None:
            return

        gain = synthio.LFO(
            waveform=_GAIN_RAMP,
            rate=config.GAIN_RAMP_HZ,
            scale=0.0,
            offset=0.0,
            once=True,
            interpolate=True,
        )
        tremolo = self._new_tremolo()
        vibrato = self._new_vibrato()
        amplitude = synthio.Math(
            synthio.MathOperation.PRODUCT,
            gain,
            tremolo,
            1.0,
        )
        note = synthio.Note(
            frequency=frequency,
            waveform=WAVES[self.wave_name],
            envelope=self._short_env,
            amplitude=amplitude,
            bend=vibrato,
        )

        self._voices[index] = (note, gain, tremolo, vibrato)
        self._rebalance()
        self.synth.press(note)

    def note_off(self, index):
        voice = self._voices.pop(index, None)
        if voice is None:
            return

        note = voice[0]
        note.envelope = self._long_env if self.sustain else self._short_env
        self.synth.release(note)
        self._rebalance()

    def all_notes_off(self):
        for index in list(self._voices):
            self.note_off(index)

    def set_wave(self, name):
        if name not in WAVES:
            return
        self.wave_name = name
        for note, _gain, _tremolo, _vibrato in self._voices.values():
            note.waveform = WAVES[name]

    def set_vibrato(self, depth):
        self.vibrato_depth = max(0, min(100, depth))
        scale = (
            self.vibrato_depth
            / 100.0
            * (config.VIBRATO_SEMITONES / 12.0)
        )
        for _note, _gain, _tremolo, vibrato in self._voices.values():
            vibrato.scale = scale

    def set_tremolo(self, depth):
        self.tremolo_depth = max(0, min(100, depth))
        amount = self.tremolo_depth / 100.0
        for _note, _gain, tremolo, _vibrato in self._voices.values():
            tremolo.scale = amount / 2.0
            tremolo.offset = 1.0 - amount / 2.0

    def retune(self, names):
        frequencies = [note_to_freq(name) for name in names]
        if any(frequency is None for frequency in frequencies):
            return False

        self.all_notes_off()
        self.note_names = list(names)
        return True
