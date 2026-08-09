# Wiring and circuit schematic

Raspberry Pi Pico 2 W (RP2350) running CircuitPython 10.2.1.

## Pin map

| Pin   | Component            | Mode              | Notes |
| ----- | -------------------- | ----------------- | ----- |
| GP0   | Note button          | Input, pull-up    | Ring position 12 |
| GP1   | Note button          | Input, pull-up    | Ring position 15 — highest, lower right |
| GP2   | Note button          | Input, pull-up    | Ring position 13 |
| GP3   | Note button          | Input, pull-up    | Ring position 14 |
| GP4   | Note button          | Input, pull-up    | Ring position 10 |
| GP5   | Note button          | Input, pull-up    | Ring position 6 |
| GP9   | Note button          | Input, pull-up    | Ring position 5 |
| GP10  | Note button          | Input, pull-up    | Ring position 11 |
| GP11  | Note button          | Input, pull-up    | Ring position 9 — top of the egg |
| GP12  | Note button          | Input, pull-up    | Ring position 8 |
| GP13  | I2S amp `DIN`        | I2S TX data       | Audio out |
| GP14  | I2S amp `BCLK`       | I2S bit clock     | |
| GP15  | I2S amp `LRC`        | I2S word select   | |
| GP16  | Note button          | Input, pull-up    | Ring position 7 |
| GP17  | Note button          | Input, pull-up    | Ring position 4 |
| GP18  | Note button          | Input, pull-up    | Ring position 3 — lowest button |
| GP19  | Echo switch          | Input, pull-up    | Toggles delay line |
| GP20  | **Sustain pedal**    | Input, pull-up    | Damper — released keys ring out |
| GP26  | Flex sensor          | ADC0              | Fires the alien sound effect |
| GP27  | Volume potentiometer | ADC1              | Master level |
| GND   | Common ground        | —                 | Shared by every switch and the amp |
| 3V3   | Sensor supply        | —                 | Flex divider and pot high side |

No GPIO is used twice. GP6–GP8 and GP21–GP22 remain free.

### The ring of thirteen keys

The shell is a ring of **fifteen pitch positions** — the same fifteen the
notebook's tuning circles draw. The two lowest positions, just left of the
hole at the bottom, have **no buttons**; the thirteen keys occupy positions
3–15, pitch ascending clockwise: up the left side of the egg, over the top,
down the right side, ending just right of the hole.

| Ring pos | Pin | Boot note (key of C) |
| -------- | ---- | -------------------- |
| 1 | — | *(C4 — no button)* |
| 2 | — | *(D4 — no button)* |
| 3 | GP18 | E4 |
| 4 | GP17 | F4 |
| 5 | GP9 | G4 |
| 6 | GP5 | A4 |
| 7 | GP16 | B4 |
| 8 | GP12 | C5 |
| 9 | GP11 | D5 |
| 10 | GP4 | E5 |
| 11 | GP10 | F5 |
| 12 | GP0 | G5 |
| 13 | GP2 | A5 |
| 14 | GP3 | B5 |
| 15 | GP1 | C6 |

A button's note comes from its *position in* `BUTTON_PINS` — `keypad.Keys`
reports the index and the engine plays `note_names[index]`. `BUTTON_PINS` is
written in **ring order (pitch order), not pin order**, so the note lists
read as plain rising scales. This rewiring supersedes every earlier layout,
including the old "F on GP4, E on GP5" swap — position on the shell is the
only truth now.

### Rests: buttons that stay silent

A note name of `-` in a tuning is a **rest**: the button exists but plays
nothing while that tuning is active. The website uses rests during song
sections for the notes crossed off in the notebook — the keyboard erases
those keys from the screen, and the matching physical buttons go quiet, so
the performer cannot hit a note the song does not want.

**Two places must agree.** `DEFAULT_NOTES` in `config.py`, and
`buttonNotes()` in `web/src/scales.js`. If they disagree the buttons change
note the moment the website connects and retunes the board — the boot notes
are only what the board plays before that.

### Adding or moving a button

Two edits in `config.py`: its pin at the right ring position in
`BUTTON_PINS`, and a note name at the same index in `DEFAULT_NOTES`. Then
match the count in `buttonNotes()` in `web/src/scales.js` — the Pico rejects
a `TUNE_` command whose note count differs from its button count, and the
site retunes the board on connect, so a mismatch silently leaves the board
on its boot notes.

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
