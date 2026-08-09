"""Audio chain, built entirely from CircuitPython's own DSP blocks.

Nothing here touches audio samples from Python; every stage runs compiled.

    synth -> [chorus] -> [echo] -> [reverb] -> tone -> voice[0] --+
    WAV / MP3 ---------------------------------------> voice[1] --+-> I2S

Bracketed stages are built lazily and inserted only while enabled. The tone
filter is always last on the synth branch:

  tone     a gentle low pass that keeps square and saw harmonics from making
           chords overly bright. Sine remains the clean default waveform.

There is deliberately no Distortion block pretending to be a limiter. The
synth engine keeps its mix below synthio's own compressor knee, which avoids
creating distortion in the first place.
"""

import audiodelays
import audiofilters
import audiofreeverb
import audiomixer
import synthio

import config


class EffectChain:
    def __init__(self, synth_source, output_device):
        self._synth_source = synth_source
        self._out = output_device

        # Two voices: the instrument, and a backing track
        self.mixer = audiomixer.Mixer(
            voice_count=2,
            sample_rate=config.SAMPLE_RATE,
            channel_count=1,
            bits_per_sample=16,
            samples_signed=True,
            buffer_size=config.MIXER_BUFFER,
        )

        self.mixer.voice[0].level = config.SYNTH_LEVEL
        self.mixer.voice[1].level = config.TRACK_LEVEL

        # Synth tone control. A Biquad whose cutoff can be changed live.
        self._tone_filter = synthio.Biquad(
            synthio.FilterMode.LOW_PASS,
            frequency=config.TONE_HZ,
            Q=config.TONE_Q,
        )

        self.tone = audiofilters.Filter(
            filter=self._tone_filter,
            mix=1.0,
            buffer_size=config.EFFECT_BUFFER,
            sample_rate=config.SAMPLE_RATE,
            channel_count=1,
            bits_per_sample=16,
            samples_signed=True,
        )

        # Built on demand; an effect that is off costs no RAM and no CPU
        self._chorus = None
        self._echo = None
        self._reverb = None

        self.chorus_on = False
        self.echo_on = False
        self.reverb_on = False

        self._master_level = 1.0

        # The mixer output is fixed; only the synth side gets rewired. The
        # backing track bypasses the synth tone filter so music files retain
        # their full frequency range.
        self._out.play(self.mixer)

        self._route_synth()

    # ---- the voice a backing track plays into ----

    @property
    def track_voice(self):
        return self.mixer.voice[1]

    # ---- lazily constructed stages ----

    def _get_chorus(self):
        if self._chorus is None:
            self._chorus = audiodelays.Chorus(
                max_delay_ms=config.CHORUS_MAX_DELAY_MS,
                delay_ms=config.CHORUS_DELAY_MS,
                voices=config.CHORUS_VOICES,
                mix=config.CHORUS_MIX,
                buffer_size=config.EFFECT_BUFFER,
                sample_rate=config.SAMPLE_RATE,
                channel_count=1,
            )
        return self._chorus

    def _get_echo(self):
        if self._echo is None:
            self._echo = audiodelays.Echo(
                max_delay_ms=config.ECHO_DELAY_MS,
                delay_ms=config.ECHO_DELAY_MS,
                decay=config.ECHO_DECAY,
                mix=config.ECHO_MIX,
                freq_shift=False,
                buffer_size=config.EFFECT_BUFFER,
                sample_rate=config.SAMPLE_RATE,
                channel_count=1,
            )
        return self._echo

    def _get_reverb(self):
        if self._reverb is None:
            self._reverb = audiofreeverb.Freeverb(
                roomsize=config.REVERB_ROOMSIZE,
                damp=config.REVERB_DAMP,
                mix=config.REVERB_MIX,
                buffer_size=config.EFFECT_BUFFER,
                sample_rate=config.SAMPLE_RATE,
                channel_count=1,
            )
        return self._reverb

    # ---- wiring ----

    def _route_synth(self):
        """Rebuild the synth side of the chain into mixer voice 0."""

        for stage in (self._chorus, self._echo, self._reverb, self.tone):
            if stage is not None:
                try:
                    stage.stop()
                except (AttributeError, RuntimeError):
                    pass

        node = self._synth_source

        if self.chorus_on:
            node = self._get_chorus().play(node)

        if self.echo_on:
            node = self._get_echo().play(node)

        if self.reverb_on:
            node = self._get_reverb().play(node)

        node = self.tone.play(node)
        self.mixer.voice[0].play(node)

    # ---- controls ----

    def set_chorus(self, on):
        if on != self.chorus_on:
            self.chorus_on = on
            self._route_synth()

    def set_echo(self, on):
        if on != self.echo_on:
            self.echo_on = on
            self._route_synth()

    def set_reverb(self, on):
        if on != self.reverb_on:
            self.reverb_on = on
            self._route_synth()

    @property
    def tone_hz(self):
        """Where the low pass currently sits."""
        return self._tone_filter.frequency

    def set_tone_hz(self, hz):
        """Master low pass cutoff. Lower is warmer and removes more grit."""
        self._tone_filter.frequency = max(200, min(18000, hz))

    def set_volume(self, level):
        """Master level from the potentiometer."""
        level = max(0.0, min(1.0, level))
        if abs(level - self._master_level) < config.VOLUME_CHANGE_MIN:
            return

        self._master_level = level
        self.mixer.voice[0].level = level * config.SYNTH_LEVEL
        self.mixer.voice[1].level = level * config.TRACK_LEVEL
