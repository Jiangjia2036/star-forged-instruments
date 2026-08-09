"""Audio chain, built entirely from CircuitPython's own DSP blocks.

Nothing here touches audio samples from Python; every stage runs compiled.

    synth ─→ [chorus] ─→ [echo] ─→ [reverb] ─→ mixer.voice[0] ─┐
    WAV / MP3 ────────────────────────────────→ mixer.voice[1] ─┤
                                                                ↓
                                        tone ─→ limiter ─→ I2S

Bracketed stages are built lazily and inserted only while enabled. The tone
filter and limiter are always present and always last:

  tone     a gentle low pass. Pure tones carry no harmonics, so anything up
           in the top octaves is artefact, not music. Removing it is what
           takes the grit off a chord.
  limiter  audiofilters.Distortion in CLIP mode with soft_clip - a real soft
           knee limiter, so peaks round over instead of squaring off.
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

        # Master tone control. A Biquad whose cutoff can be changed live.
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

        self.limiter = audiofilters.Distortion(
            mode=audiofilters.DistortionMode.CLIP,
            soft_clip=True,
            drive=config.LIMIT_DRIVE,
            pre_gain=config.LIMIT_PRE_GAIN_DB,
            post_gain=config.LIMIT_POST_GAIN_DB,
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

        # Master output is fixed; only the synth side gets rewired
        self._out.play(self.limiter.play(self.tone.play(self.mixer)))

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

        for stage in (self._chorus, self._echo, self._reverb):
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

    def set_tone_hz(self, hz):
        """Master low pass cutoff. Lower is warmer and removes more grit."""
        self._tone_filter.frequency = max(200, min(18000, hz))

    def set_volume(self, level):
        """Master level from the potentiometer."""
        self.mixer.voice[0].level = level * config.SYNTH_LEVEL
        self.mixer.voice[1].level = level * config.TRACK_LEVEL
