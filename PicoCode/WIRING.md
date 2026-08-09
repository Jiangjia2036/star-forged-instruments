# Wiring and circuit schematic

Raspberry Pi Pico 2 W (RP2350) running CircuitPython 10.2.1.

## Pin map

| Pin   | Component            | Mode              | Notes |
| ----- | -------------------- | ----------------- | ----- |
| GP13  | I2S amp `DIN`        | I2S TX data       | Audio out |
| GP14  | I2S amp `BCLK`       | I2S bit clock     | |
| GP15  | I2S amp `LRC`        | I2S word select   | |
| GP16  | Note button 1        | Input, pull-up    | Root — C in the key of C |
| GP17  | Note button 2        | Input, pull-up    | Third — E in the key of C |
| GP18  | Note button 3        | Input, pull-up    | Fifth — G in the key of C |
| GP19  | Echo switch          | Input, pull-up    | Toggles delay line |
| GP20  | **Sustain pedal**    | Input, pull-up    | Damper — released keys ring out |
| GP26  | Flex sensor          | ADC0              | Wah filter cutoff |
| GP27  | Volume potentiometer | ADC1              | Master level |
| GND   | Common ground        | —                 | Shared by every switch and the amp |
| 3V3   | Sensor supply        | —                 | Flex divider and pot high side |

No GPIO is used twice, and GP0–GP12 plus GP21–GP22 remain free for the
remaining note buttons needed to reach a full octave.

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

## Analogue sensors

Both analogue inputs are voltage dividers feeding an ADC:

```
   3V3 ───── flex sensor ────┬──── GP26 (ADC0)
                             │
                         10 kΩ
                             │
                            GND
```

```
   3V3 ───── pot end ────────┐
                     wiper ──┴──── GP27 (ADC1)
             pot other end ─────── GND
```

The flex divider's calibration constants live in `config.py` as
`FLEX_RAW_MIN` and `FLEX_RAW_MAX`.

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

Voices sum and the synth has to leave headroom for chords, so a single note
can never use the full output range. Software cannot recover that — a mixer
level tops out at 1.0. The amplifier can:

| GAIN pin        | Gain  |
| --------------- | ----- |
| 100 kΩ to VDD   | 3 dB  |
| wired to VDD    | 6 dB  |
| **floating**    | **9 dB**  ← default, what you have |
| 100 kΩ to GND   | 12 dB |
| **wired to GND**| **15 dB** ← +6 dB, twice the amplitude |

A single wire from GAIN to GND doubles the voltage gain, but it also makes the
amplifier reach its analogue limit sooner. If chords crackle at high volume,
leave GAIN floating (9 dB), turn the volume pot down, or reduce `CHORD_LEVEL`
in `config.py`.

Audio is configured as mono, signed 16-bit, 22,050 Hz.

## Signal flow

```
  buttons ─┐
  switches ├─→ Pico ─→ oscillators ─→ filter ─→ echo ─┐
  sensors ─┘      │                                   ├─→ volume ─→ I2S ─→ speaker
                  └─→ WAV from flash ─────────────────┘
                  │
                  └─→ USB serial ─→ website (keys light, visuals react)
```

## Adding the sustain pedal

The newest addition. Wire one leg to **GP20** and the other to any **GND**
pin — the same two-wire pattern as the note buttons.

A momentary footswitch gives true piano behaviour: notes ring only while it
is held. A latching toggle works too and is easier to reach by hand, at the
cost of having to switch it off deliberately.

With the pedal open, a released key fades in about 110 ms. With it closed,
the release stretches to roughly 2.6 seconds, so notes overlap into chords
the way a piano's dampers allow.

The website mirrors this: the Sustain button lights amber whether the pedal
was engaged physically or on screen, and the board reports every change as
`SUSTAIN_ON` / `SUSTAIN_OFF` over USB.
