# Direct synthio audio

The normal audio path is intentionally bare:

```text
buttons -> synthio.Synthesizer -> I2SOut -> MAX98357A -> speaker
```

There is no `audiomixer`, filter, or WAV player in that path. Echo uses an
`audiodelays.Echo` object only while Echo is enabled; switching Echo off sends
the synthesizer directly to I2S again.

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
- `CHORD_TOTAL_LEVEL = 0.64` is divided across every held note. Two notes use
  0.32 each, so their combined peak stays within the clean budget.

Gain changes ramp over roughly 25 ms inside synthio. Adding a second key does
not cause a sudden amplitude step or a clipped sum.

If a chord still crackles with effects off, reduce `CHORD_TOTAL_LEVEL` or
lower the MAX98357A gain. A GAIN pin tied to GND selects 15 dB and can overload
the amplifier/speaker even when the digital samples themselves do not clip.

## Optional effects

- **Warp** selects the saw table and adds synthio pitch vibrato.
- **Chorus** selects the square table and adds synthio tremolo.
- **Echo** temporarily routes synthio through `audiodelays.Echo`.
- **Sustain** changes only the synthio envelope release.

Turning an effect off restores sine/no-modulation/direct-I2S output. Pico WAV
backing tracks are disabled in this mode because simultaneous track playback
would require putting a mixer back into the clean path.
