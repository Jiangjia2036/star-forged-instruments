# CircuitPython audio

The project should use the modular CircuitPython firmware in this folder:

- `code.py` is the entry point.
- `synth_engine.py` owns notes, envelopes, waveforms, and chord gain.
- `effects.py` owns the optional effects, synth tone filter, track mixer, and
  I2S route.
- `inputs.py`, `serial_link.py`, and `track_player.py` keep hardware and web
  communication out of the audio engine.

Do not replace these with `micropython-legacy/main.py`; that is the older
Python-per-buffer engine and costs more CPU. `audio_test.py` is only a bench
test to separate a software problem from an amplifier, speaker, or wiring
problem.

The normal route is:

```text
buttons -> synthio -> optional effects -> tone -> mixer -> I2S -> amplifier
audio file -------------------------------------> mixer
```

The mixer remains necessary because backing tracks and live notes must play
at the same time. Tracks bypass the synth tone filter, so they are not made
dull by the instrument's 2 kHz cutoff.

## Output format

| Property | Value |
| --- | --- |
| Sample rate | 44,100 Hz |
| Encoding | signed 16-bit |
| Channels | 1 (mono) |
| Default waveform | 512-sample sine |

## Clean chord gain

`config.py` contains the two loudness controls:

- `SINGLE_NOTE_LEVEL = 0.82` makes one note substantially louder than the old
  one-third-scale wave table.
- `CHORD_TOTAL_LEVEL = 0.82` is divided across every held note. Two notes use
  0.41 each, so their combined peak stays within the clean budget.

Gain changes ramp over roughly 25 ms inside synthio. Adding a second key does
not cause a sudden amplitude step or a clipped sum.

CircuitPython 10.2 compresses the synthesizer output above roughly 85% of
full scale. The former `CHORD_TOTAL_LEVEL / sqrt(note_count)` formula crossed
that knee. A later distortion/limiter block could not undo the resulting
grit, so the firmware now avoids the nonlinear region and does not include
that redundant block.

If a chord still crackles with effects off, reduce `CHORD_TOTAL_LEVEL` or
lower the MAX98357A gain. A GAIN pin tied to GND selects 15 dB and can overload
the amplifier/speaker even when the digital samples themselves do not clip.

## Optional effects

- Wave selection provides sine, square, and saw tables.
- Chorus uses `audiodelays.Chorus`.
- Echo uses `audiodelays.Echo`.
- Reverb uses `audiofreeverb.Freeverb`.
- Sustain changes the synthio envelope release.

Effects are created only when first enabled. Turning one off removes it from
the live synth route.
