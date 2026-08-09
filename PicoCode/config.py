"""Configuration for the bare synthio instrument.

The default audio path is deliberately minimal: synthio feeds I2SOut directly.
There is no mixer, filter, or backing-track stage. Echo is inserted only while
the Echo control is on and is completely bypassed when it is off.
"""

import board


# Audio -----------------------------------------------------------------

# A conventional audio rate gives each sine wave more samples per cycle than
# the previous 22.05 kHz engine while remaining easy for the RP2350 to render.
SAMPLE_RATE = 44100

# One held note can be loud. For a chord, this is the TOTAL level shared by
# every held note.
#
# The chord budget used to be well under full scale because nothing caught
# peaks. There is now a real limiter in the chain (see below), so chords can
# run much closer to full level and let it round the peaks - which is why
# CHORD_TOTAL_LEVEL is no longer punishing.
SINGLE_NOTE_LEVEL = 0.90
CHORD_TOTAL_LEVEL = 0.88


# Limiter ---------------------------------------------------------------

# audiofilters.Distortion in CLIP mode with soft_clip is CircuitPython's own
# soft knee limiter, running in compiled code. It sits last in the chain and
# rounds peaks rather than chopping them square, which is what made chords
# sound harsh before.
#
# drive stays at 0 because we want limiting, not colouration. Raise it only
# if you actually want an overdriven tone.
LIMIT_DRIVE = 0.0
LIMIT_PRE_GAIN_DB = 0.0
LIMIT_POST_GAIN_DB = 0.0

# Shared buffer size for every effect stage. Larger is safer against
# dropouts, smaller is lower latency.
EFFECT_BUFFER = 1024
MIXER_BUFFER = 2048

# Mixer voice levels
SYNTH_LEVEL = 1.0
TRACK_LEVEL = 0.55


# Backing tracks --------------------------------------------------------

# WAV files on the CIRCUITPY drive, played through the mixer's second voice
# so the speaker carries the song and your playing at once.
# Must be 16-bit mono at SAMPLE_RATE.
TRACK_DIR = "/audio"

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
VOLUME_CHANGE_MIN = 0.015


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

# Seconds between automatic STATUS lines. The website logs everything it
# receives, so this makes the real levels visible in the browser console
# while the browser is the thing connected. Set to 0 to switch off.
STATUS_BROADCAST_S = 2.0
