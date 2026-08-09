"""All tuning knobs and pin assignments in one place.

Change behaviour here rather than digging through the engine modules.
"""

import board

# ------------------------------------------------------------
# Audio
# ------------------------------------------------------------

SAMPLE_RATE = 22050

# Mixer voice levels, 0.0 - 1.0. These balance synth against backing track.
SYNTH_LEVEL = 1.0
TRACK_LEVEL = 0.45

# The MAX98357A can run out of analogue output swing before the digital I2S
# samples clip, especially when its GAIN pin is tied to GND. Ease the synth
# down only while a chord is held, then ramp smoothly back up for one note.
# This keeps single notes loud without making two-button chords crackle.
CHORD_LEVEL = 0.70
CHORD_GAIN_SMOOTHING = 0.04

# Most notes expected to sound at once.
#
# This is the single most important number for how chords sound. synthio
# sums every sounding note into one 16 bit buffer, and it does NOT limit -
# if the total exceeds full scale it clips, which is harsh. So the peak of
# each waveform is full scale divided by this.
#
# Raising it makes chords clean but every single note quieter, so set it to
# the most keys you actually hold down at once, not the number of buttons.
# With 16 buttons wired, 4 or 5 is realistic; you will never hold all 16.
# Set to the number of buttons wired, since that is the real ceiling today.
# At 5 a single note only reached 18% of full scale, which is audibly quiet;
# at 3 it reaches 31%.
MAX_POLYPHONY = 3

# Leaves a little room under full scale for the envelope attack
_HEADROOM = 31000

WAVE_PEAK = _HEADROOM // MAX_POLYPHONY

# NOTE ON LOUDNESS
#
# There is no free lunch here in software. Voices sum, synthio does not
# limit, and a mixer voice level cannot go above 1.0 - so nothing downstream
# can amplify. A single note is always full scale divided by MAX_POLYPHONY.
#
# The real fix for loudness is the amplifier's GAIN pin, which costs nothing
# and does not eat headroom:
#     floating          9 dB   (default, what you have now)
#     100k to GND      12 dB
#     wired to GND     15 dB   <- +6 dB, doubles the amplitude
# See PicoCode/WIRING.md.

# ------------------------------------------------------------
# Pins
# ------------------------------------------------------------

I2S_BCLK = board.GP14
I2S_LRC = board.GP15
I2S_DATA = board.GP13

# Note buttons, in order. Button N plays NOTES[N]. Add the next soldered
# button to this tuple and a name to DEFAULT_NOTES - nothing else changes.
BUTTON_PINS = (board.GP16, board.GP17, board.GP18)

ECHO_SWITCH_PIN = board.GP19
SUSTAIN_SWITCH_PIN = board.GP20

FLEX_PIN = board.A0    # GP26
VOLUME_PIN = board.A1  # GP27

# ------------------------------------------------------------
# Notes
# ------------------------------------------------------------

# What the wired buttons play. Rewritten live by the website's TUNE command.
DEFAULT_NOTES = ["C4", "E4", "G4"]

# ------------------------------------------------------------
# Envelope (synthio.Envelope parameters)
# ------------------------------------------------------------

ATTACK_S = 0.010
DECAY_S = 0.140
SUSTAIN_LEVEL = 0.8
RELEASE_S = 0.120

# Release used instead when the damper pedal is held
PEDAL_RELEASE_S = 2.6

# ------------------------------------------------------------
# Effects
# ------------------------------------------------------------

# Wah filter sweep driven by the flex sensor.
#
# Set WAH_ENABLED = False if the flex sensor is not wired. A floating analog
# pin reads noise, and noise on a filter cutoff is far worse than no filter:
# it modulates every note and sounds like buzzing.
WAH_ENABLED = True

FLEX_RAW_MIN = 2368
FLEX_RAW_MAX = 8548
FILTER_HZ_MIN = 430
FILTER_HZ_MAX = 3500
FILTER_Q = 0.9

# How often the cutoff may be updated, and how far it must move first.
#
# The main loop runs ~500 times a second. Pushing a new cutoff that often is
# not a control change, it is MODULATION at audio rate, and it puts sidebands
# around every note - which is heard as harshness. 50 Hz updates are far
# faster than a hand can bend a sensor and cause no such artefacts.
FILTER_UPDATE_S = 0.02
FILTER_DEADBAND_HZ = 25

# Smoothing applied to raw ADC reads, 0-1. Lower is smoother and slower.
ADC_SMOOTHING = 0.06

# Echo effect sits in the signal path even when its mix is zero. Set False to
# remove it from the chain entirely for A/B testing.
ECHO_ENABLED = True

# Echo
ECHO_DELAY_MS = 300
ECHO_DECAY = 0.5
ECHO_MIX = 0.5

# LFO rates
VIBRATO_RATE_HZ = 5.5
TREMOLO_RATE_HZ = 5.0

# Full-depth vibrato swing in semitones
VIBRATO_SEMITONES = 1.0

# ------------------------------------------------------------
# Volume pot
# ------------------------------------------------------------

# Floor so an unwired pot still makes sound; 0 lets the pot fully mute
VOL_FLOOR = 0.12

# Reporting: percent change needed before telling the website, and the
# minimum seconds between reports
VOL_DEADBAND = 2
VOL_REPORT_S = 0.1

# ------------------------------------------------------------
# Backing tracks
# ------------------------------------------------------------

TRACK_DIR = "/audio"
POS_REPORT_S = 0.25
