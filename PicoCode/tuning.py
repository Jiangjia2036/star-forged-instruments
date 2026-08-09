"""Note-name maths shared by the synth engine and the serial protocol."""

SEMITONES = {
    "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5,
    "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11,
}


def note_to_freq(name):
    """'C4' or 'F#4' -> frequency in Hz, or None if unparseable."""

    if len(name) < 2:
        return None

    if name[1] == "#":
        letter, octave_text = name[0:2], name[2:]
    else:
        letter, octave_text = name[0:1], name[1:]

    if letter not in SEMITONES:
        return None

    try:
        octave = int(octave_text)
    except ValueError:
        return None

    midi = (octave + 1) * 12 + SEMITONES[letter]
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))
