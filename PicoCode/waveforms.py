"""Full-resolution wave tables used directly by synthio."""

import array
import math


TABLE_LEN = 512


def _build(kind):
    table = array.array("h", [0] * TABLE_LEN)

    for i in range(TABLE_LEN):
        phase = i / TABLE_LEN
        if kind == "SINE":
            value = math.sin(2 * math.pi * phase)
        elif kind == "SQUARE":
            value = 1.0 if phase < 0.5 else -1.0
        else:
            value = 2.0 * phase - 1.0
        table[i] = int(32767 * value)

    return table


WAVES = {name: _build(name) for name in ("SINE", "SQUARE", "SAW")}
WAVE_NAMES = tuple(WAVES)
