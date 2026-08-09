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
SINGLE_NOTE_LEVEL = 0.85 # was 0.82 before
CHORD_TOTAL_LEVEL = 0.79 # 0.82 before

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
TONE_HZ = 1750 # change to 3000 or lower if it sounds harsh, was 2000 before
TONE_Q = 0.707

# Gain changes ramp inside synthio instead of jumping and creating a click.
GAIN_RAMP_HZ = 40.0


# Flex sensor -----------------------------------------------------------

# Bending the strip fires an alien sound effect. The board reports the bend
# over USB as FLEX_ALIEN and the website plays the file, for two reasons:
# the clip is 44.1 kHz stereo and this mixer is mono with no resampler, and
# keeping recordings off the board leaves its ~2.5 MB of flash for firmware.
#
# This deliberately does NOT touch the synth. An earlier version swept the
# tone filter as a wah, but its resonance had to be paid for out of the note
# levels, which made the whole instrument quieter whenever the strip moved.
#
# Set False if no strip is fitted. An unconnected ADC pin floats, and its
# noise would fire the effect on its own.
FLEX_ENABLED = True

# Raw 16-bit endpoints of the divider, measured on the legacy build.
#
# These check out for the hardware actually fitted: an Adafruit 1070 strip
# (~25k flat, ~100k flexed) through a ~3.9k divider gives 2460 and 8844,
# which is within 4% of these against a sensor spec'd at +/-30%. Leave them
# unless the strip or the resistor changes.
#
# Bending LOWERS the reading, since the strip is on the high side of the
# divider. The trigger uses distance from rest, so the direction does not
# matter to it.
FLEX_RAW_MIN = 2368
FLEX_RAW_MAX = 8548

# One-pole smoothing on the raw read, as with the volume knob.
FLEX_SMOOTHING = 0.18

# How far the strip must travel from where it has been resting before it
# counts as a deliberate bend, as a fraction of the calibrated span. Well
# above the ADC's own jitter so the effect never fires on its own.
FLEX_TRIGGER_DELTA = 0.35

# How close to rest it must return before it can fire again. Lower than the
# trigger so a hand wavering near the threshold cannot machine-gun it.
FLEX_RELEASE_DELTA = 0.15

# Silence enforced after a trigger. The clip runs about 8.5 seconds, but a
# retrigger restarts it from the top, so this is a floor on how often the
# effect can start rather than a guarantee it has finished.
FLEX_COOLDOWN_S = 3.0

# How quickly the resting reference follows a strip that is being held in a
# new position, per loop. At the ~2 ms loop this is a time constant of about
# four seconds: slow enough that a normal bend is still measured against the
# true rest, fast enough that a strip left in a new shape recovers instead
# of latching the trigger off.
FLEX_REST_TRACKING = 0.0005

# The clip itself, in TRACK_DIR on the board. It plays through the mixer's
# second voice, so it layers over whatever is being played rather than
# cutting the notes off.
#
# It MUST be mono at SAMPLE_RATE - this mixer has no resampler and no
# downmixer. The source download was 44.1 kHz stereo; PicoCode/audio/alien.wav
# is the converted mono version.
FLEX_SOUND = "alien.wav"


# Low note compensation --------------------------------------------------

# A small speaker moves far less air at C4 (262 Hz) than at G5 (784 Hz), so
# equal digital amplitudes do not arrive as equal loudness - the bottom of
# the range sounds weak even though its samples are as large as the top's.
#
# The fix has to be a tilt rather than a boost. SINGLE_NOTE_LEVEL is already
# at the ceiling, so there is no headroom above C4 to raise it into; what is
# available is room below the high notes. Notes above the reference are
# attenuated on a per-octave slope, which lifts the low end *relative* to
# the rest. Recover absolute loudness with the volume knob, or with the
# amplifier's GAIN pin (see WIRING.md).
#
# Set LOW_BOOST_DB_PER_OCTAVE = 0 to switch this off entirely.
LOW_BOOST_REF_HZ = 262.0
LOW_BOOST_DB_PER_OCTAVE = 3.0
LOW_BOOST_MAX_DB = 6.0

# Ignore tiny ADC changes before writing a new mixer level. This prevents
# potentiometer noise from becoming low-level amplitude modulation.
VOLUME_CHANGE_MIN = 0.005


# I2S pins ---------------------------------------------------------------

I2S_BCLK = board.GP14
I2S_LRC = board.GP15
I2S_DATA = board.GP13


# Physical controls -----------------------------------------------------

# Button N plays DEFAULT_NOTES[N], so a pin's note is whatever sits at the
# same index in the note list.
#
# Thirteen buttons, from the shell diagram in the performance notebook. The
# instrument's keys sit on a ring of FIFTEEN pitch positions - the same ring
# the tuning circles draw - but the two lowest positions, just left of the
# hole, have no buttons. Physical keys occupy positions 3-15, ascending
# clockwise: up the left side of the egg, over the top, down the right.
#
#   ring pos  index  pin    boot note   place on the shell
#   --------  -----  -----  ---------   ------------------
#      1        -     -        -        no button (left of hole)
#      2        -     -        -        no button
#      3        0    GP18      E4       lower left
#      4        1    GP17      F4
#      5        2    GP9       G4
#      6        3    GP5       A4
#      7        4    GP16      B4
#      8        5    GP12      C5       upper left
#      9        6    GP11      D5       top of the egg
#     10        7    GP4       E5
#     11        8    GP10      F5       upper right
#     12        9    GP0       G5
#     13       10    GP2       A5
#     14       11    GP3       B5
#     15       12    GP1       C6       lower right, ends at the hole
#
# This rewiring supersedes the old layouts entirely - including the old
# "F on GP4, E on GP5" swap. Position on the shell is the only truth now,
# and pitch rises strictly with position.
BUTTON_PINS = (
    board.GP18,
    board.GP17,
    board.GP9,
    board.GP5,
    board.GP16,
    board.GP12,
    board.GP11,
    board.GP4,
    board.GP10,
    board.GP0,
    board.GP2,
    board.GP3,
    board.GP1,
)
ECHO_SWITCH_PIN = board.GP19       # retained for wiring compatibility
SUSTAIN_SWITCH_PIN = board.GP20
VOLUME_PIN = board.A1              # GP27
FLEX_PIN = board.A0                # GP26

# Boot notes: ring positions 3-15 of a C major ring that starts at C4 - the
# same thirteen the website assigns for C when nothing is playing. C4 and D4
# belong to the buttonless positions 1-2, so they are not here.
#
# "-" is a rest: a button tuned to it stays silent. The website uses rests
# during song sections for keys whose notes are crossed off in the notebook.
#
# Only what the board boots with: the website retunes it with TUNE_ as soon
# as it connects, from buttonNotes() in web/src/scales.js. Keep the two in
# step or the buttons change note the moment the site connects.
DEFAULT_NOTES = [
    "E4", "F4", "G4", "A4", "B4",
    "C5", "D5", "E5", "F5", "G5",
    "A5", "B5", "C6",
]


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
