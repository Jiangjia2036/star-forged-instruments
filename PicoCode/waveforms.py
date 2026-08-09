"""Wave tables for the three voice timbres.

synthio reads a Note's waveform from an array of int16. One shared table per
timbre is enough - synthio handles pitch by stepping through it at the right
rate, in C.
"""

import array
import math

import config

TABLE_LEN = 512

# Square and saw carry far more harmonic energy than a sine, so they are
# trimmed to keep perceived loudness even when switching timbres.
_LEVELS = {"SINE": 1.0, "SQUARE": 0.6, "SAW": 0.7}

# Sized so MAX_POLYPHONY notes sum without exceeding full scale. synthio has
# no limiter, so this division is the only thing preventing chords clipping.
_PEAK = config.WAVE_PEAK


def _build(kind):
    table = array.array("h", [0] * TABLE_LEN)
    level = _LEVELS[kind]

    for i in range(TABLE_LEN):
        phase = i / TABLE_LEN

        if kind == "SINE":
            value = math.sin(2 * math.pi * phase)
        elif kind == "SQUARE":
            value = 1.0 if phase < 0.5 else -1.0
        else:
            value = 2.0 * phase - 1.0

        table[i] = int(_PEAK * level * value)

    return table


WAVES = {name: _build(name) for name in ("SINE", "SQUARE", "SAW")}

WAVE_NAMES = list(WAVES.keys())
