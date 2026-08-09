"""Polyphonic synthio engine with a clean sine default and optional effects."""

import array

import synthio

import config
from tuning import note_to_freq
from waveforms import WAVES


_GAIN_RAMP = array.array("h", (0, 32767))


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
        self._volume = 1.0
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

    def _level_per_note(self):
        count = len(self._voices)
        if count <= 0:
            return 0.0
        if count == 1:
            return config.SINGLE_NOTE_LEVEL * self._volume
        return config.CHORD_TOTAL_LEVEL * self._volume / count

    def _rebalance(self):
        target = self._level_per_note()
        for _note, gain, _tremolo, _vibrato in self._voices.values():
            current = gain.value
            gain.offset = current
            gain.scale = target - current
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

    def set_volume(self, value):
        value = max(0.0, min(1.0, value))
        if abs(value - self._volume) < config.VOLUME_CHANGE_MIN:
            return
        self._volume = value
        self._rebalance()

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
