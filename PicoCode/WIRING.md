# Wiring and circuit schematic

Raspberry Pi Pico 2 W (RP2350) running CircuitPython 10.2.1.

## Pin map

| Pin   | Component            | Mode              | Notes |
| ----- | -------------------- | ----------------- | ----- |
| GP0   | Note button **A**    | Input, pull-up    | A4 in the key of C |
| GP1   | Note button **B**    | Input, pull-up    | B4 in the key of C |
| GP2   | Note button **C**    | Input, pull-up    | C5 in the key of C |
| GP3   | Note button **D**    | Input, pull-up    | D5 in the key of C |
| GP4   | Note button **F**    | Input, pull-up    | F5 in the key of C |
| GP5   | Note button **E**    | Input, pull-up    | E5 in the key of C |
| GP10  | Note button          | Input, pull-up    | G5 — top of the range |
| GP11  | Note button          | Input, pull-up    | G4 in the key of C |
| GP12  | Note button          | Input, pull-up    | F4 in the key of C |
| GP13  | I2S amp `DIN`        | I2S TX data       | Audio out |
| GP14  | I2S amp `BCLK`       | I2S bit clock     | |
| GP15  | I2S amp `LRC`        | I2S word select   | |
| GP16  | Note button          | Input, pull-up    | C4 — bottom of the range |
| GP17  | Note button          | Input, pull-up    | D4 in the key of C |
| GP18  | Note button          | Input, pull-up    | E4 in the key of C |
| GP19  | Echo switch          | Input, pull-up    | Toggles delay line |
| GP20  | **Sustain pedal**    | Input, pull-up    | Damper — released keys ring out |
| GP26  | Flex sensor          | ADC0              | Fires the alien sound effect |
| GP27  | Volume potentiometer | ADC1              | Master level |
| GND   | Common ground        | —                 | Shared by every switch and the amp |
| 3V3   | Sensor supply        | —                 | Flex divider and pot high side |

No GPIO is used twice. GP6–GP9 and GP21–GP22 remain free.

### The twelve keys

Twelve buttons play one continuous scale, **C4 up to G5** in the key of C:

| Order | Pin | Note | |
| ----- | --- | ---- | --- |
| 1 | GP16 | C4 | |
| 2 | GP17 | D4 | |
| 3 | GP18 | E4 | |
| 4 | GP12 | F4 | |
| 5 | GP11 | G4 | |
| 6 | GP0 | A4 | **A** |
| 7 | GP1 | B4 | **B** |
| 8 | GP2 | C5 | **C** |
| 9 | GP3 | D5 | **D** |
| 10 | GP4 | F5 | **F** |
| 11 | GP5 | E5 | **E** |
| 12 | GP10 | G5 | |

A button's note comes from its *position in* `BUTTON_PINS` — `keypad.Keys`
reports the index and the engine plays `note_names[index]`. So `BUTTON_PINS`
is written in **pitch order, not pin order**, which lets the note list read
as a plain rising scale.

Positions 10 and 11 are the one place pitch does not rise, because the board
has F assigned to GP4 and E to GP5:

```python
BUTTON_PINS   = (..., GP3,  GP4,  GP5,  GP10)
DEFAULT_NOTES = [..., "D5", "F5", "E5", "G5"]
                             ^^^   ^^^
```

**Two places must agree.** `DEFAULT_NOTES` in `config.py`, and
`buttonNotes()` in `web/src/scales.js`. If they disagree the buttons change
note the moment the website connects and retunes the board — the boot notes
are only what the board plays before that.

### Only one layout now

The `chord` and `wide` spreads are gone. They existed to make six buttons
useful by skipping scale degrees, since a triad reaches further than six
adjacent notes. Twelve buttons already cover a full scale, and a skipping
layout across twelve keys would climb past 2 kHz, where this speaker and the
`TONE_HZ` filter give up. Use the octave +/- control to move the range.

### Adding or moving a button

Two edits in `config.py`: its pin in `BUTTON_PINS`, and a note name at the
same index in `DEFAULT_NOTES`. Then match the count in every branch of
`buttonNotes()` in `web/src/scales.js` — the Pico rejects a `TUNE_` command
whose note count differs from its button count, and the site retunes the
board on connect, so a mismatch silently leaves the board on its boot notes.

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

The strip is an **Adafruit 1070** (Spectra Symbol, 78 mm): about **25 kΩ
flat, rising to about 100 kΩ fully flexed**. A resistor changes it from a
resistance into a voltage the ADC can read:

```
   3V3 ───── flex strip ─────┬───── GP26 (ADC0)
                             │
                 ~3.9 kΩ ────┴───── GND
```

Note the direction: with the strip on the high side, **bending lowers the
reading**. The trigger measures distance travelled from rest, so it does not
care which way — but it matters when reading `flex=` during calibration.

### Choosing the resistor

The reading spans the widest range when the fixed resistor is the geometric
mean of the strip's two extremes, √(25 kΩ × 100 kΩ) ≈ **50 kΩ**:

| Resistor | bent | flat | usable span |
| -------- | ---- | ---- | ----------- |
| ~3.9 kΩ (what the calibration implies is fitted) | 2460 | 8844 | 6384 counts, 9.7% of range |
| 47 kΩ | 20953 | 42780 | 21826 counts, 33.3% of range |

The current value works — the trigger threshold lands 140 ADC steps above
the noise floor, and the RP2350's ADC only resolves 16-count steps anyway.
Swapping to 47 kΩ would roughly triple the resolution, which is worth doing
if the trigger ever feels imprecise. Recalibrate `FLEX_RAW_MIN`/`MAX` after
changing it. Either way the strip dissipates well under a milliwatt.

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

**The calibration in `config.py` is already correct for this build.**
`FLEX_RAW_MIN = 2368` and `FLEX_RAW_MAX = 8548` match what an Adafruit 1070
produces through a ~3.9 kΩ divider (predicted 2460 and 8844, within 4%),
so they are measured values rather than stale guesses — leave them alone
unless the hardware changes.

Recalibrate only after swapping the strip or the resistor: set
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
