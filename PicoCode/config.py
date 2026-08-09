"""Configuration for the modular CircuitPython synth and track player."""

import board


# Audio -----------------------------------------------------------------

# A conventional audio rate gives each sine wave more samples per cycle than
# the previous 22.05 kHz engine while remaining easy for the RP2350 to render.
SAMPLE_RATE = 44100

# One held note can be loud. For a chord, CHORD_TOTAL_LEVEL is the clean peak
# budget shared by every held note.
#
# CircuitPython 10.2's synthio has a built-in hard-knee compressor at about
# 0.855 full scale. An effect placed after synthio cannot undo the colour that
# compressor adds. Both values therefore stay below its knee, with a little
# margin for rounding. Do not change chord gain back to budget / sqrt(N): it
# makes two-button combinations louder by driving that compressor, and that
# loudness is the harsh/gritty sound we are trying to remove.
SINGLE_NOTE_LEVEL = 0.82
CHORD_TOTAL_LEVEL = 0.82

# Shared buffer size for every effect stage. Larger is safer against
# dropouts, smaller is lower latency.
EFFECT_BUFFER = 1024
MIXER_BUFFER = 2048

# Mixer voice levels
SYNTH_LEVEL = 1.0
TRACK_LEVEL = 0.55


# Backing tracks --------------------------------------------------------

# Audio files on the CIRCUITPY drive, played through the mixer's second
# voice so the speaker carries the song and your playing at once.
#
# WAV and MP3 both work, but MP3 is what you want: flash is the binding
# constraint here, and 128 kbps MP3 costs ~1 MB per minute against ~5 MB per
# minute for 44.1 kHz mono WAV.
#
# The mixer does not resample, so a file MUST be mono at SAMPLE_RATE.
# A mismatch is the usual reason a track plays silently.
TRACK_DIR = "/audio"

# Used to estimate MP3 duration from file size, since MP3 headers carry no
# frame count. Accurate for constant bitrate.
MP3_BITRATE_KBPS = 128

# How often the Pico reports playback position to the website
POS_REPORT_S = 0.25


# Master tone -----------------------------------------------------------

# A gentle low pass across everything. The instrument's voices are simple
# waveforms, so almost nothing musical lives in the top octaves - what does
# live there is aliasing and wave table quantisation, and that is what puts
# a gritty edge on a chord. Rolling it off is the cheapest way to make two
# notes sound smooth together.
#
# Lower this if chords still sound harsh; raise it if the tone gets muffled.
TONE_HZ = 2000 # change to 3000 or lower if it sounds harsh
TONE_Q = 0.707

# Gain changes ramp inside synthio instead of jumping and creating a click.
GAIN_RAMP_HZ = 40.0

# Ignore tiny ADC changes before writing a new mixer level. This prevents
# potentiometer noise from becoming low-level amplitude modulation.
VOLUME_CHANGE_MIN = 0.005


# I2S pins ---------------------------------------------------------------

I2S_BCLK = board.GP14
I2S_LRC = board.GP15
I2S_DATA = board.GP13


# Physical controls -----------------------------------------------------

# Button N plays DEFAULT_NOTES[N], so order here maps to note order.
# New buttons are appended, which leaves the existing keys on their notes.
BUTTON_PINS = (
    board.GP16,
    board.GP17,
    board.GP18,
    board.GP12,
    board.GP11,
    board.GP10,
)
ECHO_SWITCH_PIN = board.GP19       # retained for wiring compatibility
SUSTAIN_SWITCH_PIN = board.GP20
VOLUME_PIN = board.A1              # GP27

# A major triad arpeggiated across two octaves: root, third, fifth, then the
# same three an octave higher.
DEFAULT_NOTES = ["C4", "E4", "G4", "C5", "E5", "G5"]


# Click-free envelope ---------------------------------------------------

ATTACK_S = 0.008
DECAY_S = 0.045
SUSTAIN_LEVEL = 0.96
RELEASE_S = 0.045
PEDAL_RELEASE_S = 1.5


# Optional effects ------------------------------------------------------

# Effects are bypassed when off. Echo is the only object inserted between
# synthio and I2S, and it is inserted only while enabled.
ECHO_DELAY_MS = 300
ECHO_DECAY = 0.45
ECHO_MIX = 0.40

# A real chorus, from audiodelays. Several detuned copies spread across a
# short delay - this is what "chorus" actually means, rather than the square
# wave plus tremolo we were substituting for it.
CHORUS_MAX_DELAY_MS = 50
CHORUS_DELAY_MS = 35.0
CHORUS_VOICES = 3.0
CHORUS_MIX = 0.5

# Reverb, from audiofreeverb. Worth having on for chords: a little space
# masks the beating between notes and makes intervals sit together.
REVERB_ROOMSIZE = 0.55
REVERB_DAMP = 0.5
REVERB_MIX = 0.35

VIBRATO_RATE_HZ = 5.5
VIBRATO_SEMITONES = 1.0
TREMOLO_RATE_HZ = 5.0


# Volume reporting ------------------------------------------------------

# An absent or bottomed-out potentiometer never makes diagnostics entirely
# silent. A wired pot still covers most of the useful range.
VOL_FLOOR = 0.15
VOL_DEADBAND = 3
VOL_REPORT_S = 0.1

# One-pole smoothing on the raw ADC read, 0-1. Lower is smoother.
# Without this the pot jitters a couple of percent, which is enough to keep
# re-triggering a gain rebalance and to spam the serial link with VOL_
# messages that the website does not need.
VOL_SMOOTHING = 0.08


# Diagnostics ------------------------------------------------------------

# Seconds between automatic STATUS lines. Leave disabled for normal playing;
# set to 2.0 temporarily when diagnosing levels in the browser console.
STATUS_BROADCAST_S = 0.0
