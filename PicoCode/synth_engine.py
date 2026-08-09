"""The instrument's voice, built on synthio.

Everything audible lives here: notes, envelopes, timbres, vibrato, tremolo,
the wah filter and the echo. synthio renders it all in C, which is what
makes chords clean - no Python runs per sample.
"""

import synthio

import config
from tuning import note_to_freq
from waveforms import WAVES


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

        # One live Note object per button while it sounds
        self._sounding = {}

        self.wave_name = "SINE"
        self.vibrato_depth = 0
        self.tremolo_depth = 0
        self.sustain = False

        self._short_env = _envelope(config.RELEASE_S)
        self._long_env = _envelope(config.PEDAL_RELEASE_S)

        # Wah filter, shared by every note so the flex sensor sweeps them all
        # together. synthio.Biquad takes a FilterMode and lets frequency be
        # changed live, which is what makes the sweep possible.
        self._filter = None
        self._filter_hz = config.FILTER_HZ_MAX

        if not config.WAH_ENABLED:
            return

        try:
            self._filter = synthio.Biquad(
                synthio.FilterMode.LOW_PASS,
                frequency=self._filter_hz,
                Q=config.FILTER_Q,
            )
        except (AttributeError, TypeError) as err:
            # Older builds spell this differently; the instrument still plays,
            # it just loses the wah sweep.
            print("Wah filter unavailable:", err)

    # ---- what the mixer should play ----

    @property
    def source(self):
        return self.synth

    @property
    def held_note_count(self):
        """Number of keys/commands that are still being held."""
        return len(self._sounding)

    # ---- notes ----

    def note_on(self, index):
        if index in self._sounding:
            return

        if index >= len(self.note_names):
            return

        freq = note_to_freq(self.note_names[index])
        if freq is None:
            return

        note = synthio.Note(
            frequency=freq,
            waveform=WAVES[self.wave_name],
            envelope=self._short_env,
        )

        if self._filter is not None:
            note.filter = self._filter

        if self.vibrato_depth:
            note.bend = synthio.LFO(
                rate=config.VIBRATO_RATE_HZ,
                scale=(self.vibrato_depth / 100.0)
                * (config.VIBRATO_SEMITONES / 12.0),
            )

        if self.tremolo_depth:
            depth = self.tremolo_depth / 100.0
            note.amplitude = synthio.LFO(
                rate=config.TREMOLO_RATE_HZ,
                scale=depth / 2.0,
                offset=1.0 - depth / 2.0,
            )

        self._sounding[index] = note
        self.synth.press(note)

    def note_off(self, index):
        note = self._sounding.pop(index, None)
        if note is None:
            return

        # The damper pedal swaps in the long release at the moment of
        # letting go, which is exactly what lifting a piano damper does
        note.envelope = self._long_env if self.sustain else self._short_env

        self.synth.release(note)

    def all_notes_off(self):
        for index in list(self._sounding):
            self.note_off(index)

    # ---- live controls ----

    def set_filter_hz(self, hz):
        self._filter_hz = hz
        if self._filter is not None:
            self._filter.frequency = hz

    def set_wave(self, name):
        if name in WAVES:
            self.wave_name = name

    def set_vibrato(self, depth):
        self.vibrato_depth = max(0, min(100, depth))

    def set_tremolo(self, depth):
        self.tremolo_depth = max(0, min(100, depth))

    def retune(self, names):
        """New note names for the buttons. Anything sounding is released so
        no note is left ringing under a tuning that no longer exists."""

        freqs = [note_to_freq(n) for n in names]
        if any(f is None for f in freqs):
            return False

        self.all_notes_off()
        self.note_names = list(names)
        return True
