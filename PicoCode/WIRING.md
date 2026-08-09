# Wiring and circuit schematic

Raspberry Pi Pico 2 W (RP2350) running CircuitPython 10.2.1.

## Pin map

| Pin   | Component            | Mode              | Notes |
| ----- | -------------------- | ----------------- | ----- |
| GP10  | Note button 6        | Input, pull-up    | Fifth up — G5 in the key of C |
| GP11  | Note button 5        | Input, pull-up    | Third up — E5 in the key of C |
| GP12  | Note button 4        | Input, pull-up    | Octave — C5 in the key of C |
| GP13  | I2S amp `DIN`        | I2S TX data       | Audio out |
| GP14  | I2S amp `BCLK`       | I2S bit clock     | |
| GP15  | I2S amp `LRC`        | I2S word select   | |
| GP16  | Note button 1        | Input, pull-up    | Root — C in the key of C |
| GP17  | Note button 2        | Input, pull-up    | Third — E in the key of C |
| GP18  | Note button 3        | Input, pull-up    | Fifth — G in the key of C |
| GP19  | Echo switch          | Input, pull-up    | Toggles delay line |
| GP20  | **Sustain pedal**    | Input, pull-up    | Damper — released keys ring out |
| GP26  | Flex sensor          | ADC0              | Fires the alien sound effect |
| GP27  | Volume potentiometer | ADC1              | Master level |
| GND   | Common ground        | —                 | Shared by every switch and the amp |
| 3V3   | Sensor supply        | —                 | Flex divider and pot high side |

No GPIO is used twice. GP0–GP9 plus GP21–GP22 remain free for the remaining
note buttons needed to reach a full octave.

Adding another button is two edits: append its pin to `BUTTON_PINS` and a
note name to `DEFAULT_NOTES`, both in `config.py`. Append rather than insert,
so the existing buttons keep the notes they already play. Then add a matching
entry to each branch of `buttonNotes()` in `web/src/scales.js` — the Pico
rejects a `TUNE_` command whose note count differs from its button count.

## Switches and buttons

Every button and switch is wired identically:

```
   GPIO pin ──────┬────── switch ────── GND
                  │
            (internal pull-up,
             enabled in software)
```

No external resistor is required. CircuitPython's `keypad.Keys(...,
value_when_pressed=False, pull=True)` enables the internal pull-up, so the pin
idles at 3.3 V and is pulled to ground when the switch closes.

On a four-legged tactile switch, the two legs on the *same* side are already
connected internally. Use legs on opposite sides.

## Volume potentiometer

The volume input is a voltage divider feeding ADC1:

```
   3V3 ───── pot end ────────┐
                     wiper ──┴──── GP27 (ADC1)
             pot other end ─────── GND
```

## Flex sensor (alien sound effect)

A flex strip is a resistor that changes value as it bends, so it needs a
fixed resistor to become a voltage the ADC can read:

```
   3V3 ───── flex strip ─────┬───── GP26 (ADC0)
                             │
                      10 kΩ ─┴───── GND
```

Bending the strip plays `FLEX_SOUND` (`alien.wav`) out of the instrument's
own speaker, through the mixer's second voice — so it layers over whatever
you are playing rather than cutting the notes off. The board also sends
`FLEX_ALIEN` over USB, so the website can react to it.

The trigger deliberately does **not** touch the synth. An earlier version
swept the tone filter as a wah, but its resonance had to be paid for out of
the note levels, which made the whole instrument quieter whenever the strip
moved.

### How the trigger behaves

- Fires when the bend travels `FLEX_TRIGGER_DELTA` (0.35 of the calibrated
  span) away from where the strip has been resting.
- Then goes quiet for `FLEX_COOLDOWN_S` (5 s), and additionally will not
  fire again until the strip returns within `FLEX_RELEASE_DELTA` of rest —
  so holding it bent gives one sound, not a stream of them.
- The resting reference drifts slowly (about a 4 s time constant), so a
  strip left in a new shape becomes the new baseline instead of latching
  the trigger off permanently.

Because it measures *travel from rest* rather than an absolute reading, it
still works if the calibration is a little off.

**The sound file must be mono at 44,100 Hz.** The mixer has no resampler and
no downmixer, so a stereo file is rejected with `TRACK_ERROR_format_...`.
`PicoCode/audio/alien.wav` is the converted mono version of the original
stereo download.

**Calibrate if a normal bend does not reach the trigger.** The defaults in
`config.py` (`FLEX_RAW_MIN = 2368`, `FLEX_RAW_MAX = 8548`) came from the
older build and depend on the exact strip and resistor. Set
`STATUS_BROADCAST_S = 2.0`, watch the `flex=` field in the browser console
while bending fully each way, and put the two extremes into those constants.

With no strip fitted, set `FLEX_ENABLED = False`. An unconnected ADC pin
floats, and its noise would fire the effect on its own.

It can also be toggled at runtime with `FX_FLEX_ON` / `FX_FLEX_OFF` over
USB, which is the quick way to silence it without redeploying.

## I2S amplifier

A MAX98357A-class breakout:

| Amp pin | Connects to |
| ------- | ----------- |
| VIN     | VBUS (5 V) or 3V3 |
| GND     | GND |
| DIN     | GP13 |
| BCLK    | GP14 |
| LRC     | GP15 |
| SD      | leave floating (enabled) |
| GAIN    | see below |

### The GAIN pin is the answer to "it's too quiet"

The synthio engine raises a single note while automatically sharing a clean
peak budget across every voice in a chord. The amplifier's GAIN pin still
controls the final analogue gain:

| GAIN pin        | Gain  |
| --------------- | ----- |
| 100 kΩ to VDD   | 3 dB  |
| wired to VDD    | 6 dB  |
| **floating**    | **9 dB**  ← default, what you have |
| 100 kΩ to GND   | 12 dB |
| **wired to GND**| **15 dB** ← +6 dB, twice the amplitude |

A single wire from GAIN to GND doubles the voltage gain, but it also makes the
amplifier reach its analogue limit sooner. If chords crackle at high volume,
leave GAIN floating (9 dB), turn the volume pot down, or reduce
`CHORD_TOTAL_LEVEL` in `config.py`.

Audio is configured as mono, signed 16-bit, 44,100 Hz.

## Signal flow

```
  buttons ─→ synthio ─→ optional effects ─→ tone ─┐
  audio file ──────────────────────────────────────┴─→ mixer ─→ I2S ─→ speaker
  volume pot ───────────────────────────────────────────┘
  buttons ─→ USB serial ─→ website (keys light, visuals react)
```

## Adding the sustain pedal

The newest addition. Wire one leg to **GP20** and the other to any **GND**
pin — the same two-wire pattern as the note buttons.

A momentary footswitch gives true piano behaviour: notes ring only while it
is held. A latching toggle works too and is easier to reach by hand, at the
cost of having to switch it off deliberately.

With the pedal open, a released key fades in about 45 ms. With it closed,
the release stretches to roughly 1.5 seconds, so notes overlap into chords
the way a piano's dampers allow.

The website mirrors this: the Sustain button lights amber whether the pedal
was engaged physically or on screen, and the board reports every change as
`SUSTAIN_ON` / `SUSTAIN_OFF` over USB.
