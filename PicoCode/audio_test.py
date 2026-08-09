"""Isolation test for the chord problem.

Deploy this AS code.py to hear it; restore the real code.py afterwards.

It plays the same three things over and over, with a gap between each, using
the BAREST possible chain: synthio straight into the I2S amp. No mixer, no
echo, no filter, no wave tables of ours, no envelopes, no pot.

If chords sound clean here, the fault is in our audio chain and we bisect it.
If they still sound bad here, the fault is the amplifier, the speaker or the
wiring, and no amount of code will fix it.
"""

import array
import math
import time

import audiobusio
import board
import synthio

SAMPLE_RATE = 22050

# Well under full scale, so nothing can clip no matter what
LEVEL = 0.3

# synthio's built-in waveform is a square wave. A square-wave major third is
# naturally buzzy and made this test report a false "distortion" result. Use
# an explicit sine table so any roughness we hear really comes after synthio.
TABLE_LEN = 256
SINE = array.array(
    "h",
    (
        int(32767 * math.sin(2 * math.pi * i / TABLE_LEN))
        for i in range(TABLE_LEN)
    ),
)

C4 = 261.63
E4 = 329.63
G4 = 392.00

i2s = audiobusio.I2SOut(
    bit_clock=board.GP14,
    word_select=board.GP15,
    data=board.GP13,
)

synth = synthio.Synthesizer(
    sample_rate=SAMPLE_RATE,
    channel_count=1,
)

i2s.play(synth)

print("AUDIO TEST RUNNING - bare synthio, nothing else in the chain")


def play(freqs, seconds, label):
    print(label)

    notes = [
        synthio.Note(frequency=f, waveform=SINE, amplitude=LEVEL)
        for f in freqs
    ]

    for note in notes:
        synth.press(note)

    time.sleep(seconds)

    synth.release_all()
    time.sleep(0.7)


while True:
    play([C4], 2.0, "1: single note C4")
    play([C4, E4], 3.0, "2: C4 + E4 together  <-- the problem case")
    play([C4, G4], 3.0, "3: C4 + G4 (a fifth, simpler interval)")
    play([E4], 2.0, "4: single note E4")

    print("--- looping ---")
    time.sleep(1.5)
