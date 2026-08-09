"""Star Forged Instruments - CircuitPython entry point.

Wiring diagram of the modules:

    inputs.py ──── buttons / switches / sensors
        │
    code.py ────── this file: the event loop, nothing else
        │
    serial_link.py ─ USB protocol to the website
    synth_engine.py ─ notes and effects (synthio, renders in C)
    track_player.py ─ WAV backing tracks
    config.py ────── every pin and tuning constant

The audio chain: synth ─→ (echo) ─→ mixer voice 0
                 WAV file ─────────→ mixer voice 1 ─→ I2S amp
"""

import time

import audiobusio
import audiomixer

import config
from inputs import Inputs
from serial_link import SerialLink
from synth_engine import SynthEngine
from track_player import TrackPlayer
from waveforms import WAVE_NAMES

# Echo is a supported effect on RP2350 builds; degrade gracefully elsewhere
try:
    import audiodelays

    _HAS_ECHO = True
except ImportError:
    _HAS_ECHO = False


# ------------------------------------------------------------
# Audio chain
# ------------------------------------------------------------

engine = SynthEngine()

mixer = audiomixer.Mixer(
    voice_count=2,
    sample_rate=config.SAMPLE_RATE,
    channel_count=1,
    bits_per_sample=16,
    samples_signed=True,
    buffer_size=4096,
)

if _HAS_ECHO and config.ECHO_ENABLED:
    echo = audiodelays.Echo(
        max_delay_ms=config.ECHO_DELAY_MS,
        delay_ms=config.ECHO_DELAY_MS,
        decay=config.ECHO_DECAY,
        mix=0.0,  # dry until the switch or the site turns it on
        buffer_size=1024,
        channel_count=1,
        sample_rate=config.SAMPLE_RATE,
    )
    echo.play(engine.source)
    synth_source = echo
else:
    echo = None
    synth_source = engine.source

i2s = audiobusio.I2SOut(
    bit_clock=config.I2S_BCLK,
    word_select=config.I2S_LRC,
    data=config.I2S_DATA,
)

i2s.play(mixer)
mixer.voice[0].play(synth_source)

inputs = Inputs()
link = SerialLink()
tracks = TrackPlayer(mixer.voice[1])

# Echo can come from the physical switch or the website; either engages it
web_echo = False
web_sustain = False


def echo_active():
    return inputs.echo_on or web_echo


def apply_echo():
    if echo is not None:
        echo.mix = config.ECHO_MIX if echo_active() else 0.0


def apply_sustain():
    engine.sustain = inputs.sustain_on or web_sustain


# ------------------------------------------------------------
# Serial commands from the website
# ------------------------------------------------------------

def handle(line):
    global web_echo, web_sustain

    if line.startswith("CMD_ON_"):
        name = line[7:]
        if name in engine.note_names:
            engine.note_on(engine.note_names.index(name))

    elif line.startswith("CMD_OFF_"):
        name = line[8:]
        if name in engine.note_names:
            engine.note_off(engine.note_names.index(name))

    elif line == "CMD_ALLOFF":
        engine.all_notes_off()

    elif line.startswith("TUNE_"):
        parts = line[5:].split("_")
        if len(parts) == len(engine.note_names) and engine.retune(parts):
            link.send("TUNED_" + "_".join(parts))

    elif line.startswith("FX_WAVE_"):
        name = line[8:]
        if name in WAVE_NAMES:
            engine.set_wave(name)
            link.send("FX_WAVE_%s_OK" % name)

    elif line.startswith("FX_VIB_"):
        try:
            engine.set_vibrato(int(line[7:]))
        except ValueError:
            pass

    elif line.startswith("FX_TREM_"):
        try:
            engine.set_tremolo(int(line[8:]))
        except ValueError:
            pass

    elif line.startswith("FX_ECHO_"):
        web_echo = line[8:] == "ON"
        apply_echo()

    elif line.startswith("FX_SUSTAIN_"):
        web_sustain = line[11:] == "ON"
        apply_sustain()

    elif line == "TRACK_LIST":
        link.send("TRACKS_" + "|".join(tracks.list_tracks()))

    elif line.startswith("TRACK_PLAY_"):
        tracks.play(line[11:], link)

    elif line == "TRACK_STOP":
        tracks.stop(link)


# ------------------------------------------------------------
# Main loop
# ------------------------------------------------------------

link.send("PICO_READY")
link.send("TUNED_" + "_".join(engine.note_names))

vol_reported = -1
last_vol_report = 0.0
last_filter_update = 0.0
last_filter_hz = 0.0
chord_gain = 1.0

while True:
    # Physical playing
    for index, pressed in inputs.button_events():
        name = engine.note_names[index] if index < len(engine.note_names) else "?"

        if pressed:
            engine.note_on(index)
            link.send("NOTE_%s_ON" % name)
        else:
            engine.note_off(index)
            link.send("NOTE_%s_OFF" % name)

    # Switches
    for which, _closed in inputs.switch_events():
        if which == Inputs.SWITCH_ECHO:
            apply_echo()
            link.send("EFFECT_ECHO_%s" % ("ON" if echo_active() else "OFF"))
        else:
            apply_sustain()
            link.send("SUSTAIN_%s" % ("ON" if engine.sustain else "OFF"))

    # Website commands
    for line in link.poll():
        handle(line)

    # Continuous controls.
    #
    # The wah cutoff is updated at ~50 Hz, not on every pass. Changing a
    # filter's frequency 500 times a second modulates it at audio rate and
    # puts sidebands around every note, which sounds like buzzing.
    now = time.monotonic()

    if now - last_filter_update >= config.FILTER_UPDATE_S:
        last_filter_update = now
        hz = inputs.filter_hz()

        if abs(hz - last_filter_hz) >= config.FILTER_DEADBAND_HZ:
            last_filter_hz = hz
            engine.set_filter_hz(hz)

    volume = inputs.volume()
    chord_target = (
        config.CHORD_LEVEL if engine.held_note_count > 1 else 1.0
    )
    chord_gain += (
        chord_target - chord_gain
    ) * config.CHORD_GAIN_SMOOTHING

    mixer.voice[0].level = volume * config.SYNTH_LEVEL * chord_gain
    mixer.voice[1].level = volume * config.TRACK_LEVEL

    # Report the knob to the website, deadbanded and rate limited
    if now - last_vol_report >= config.VOL_REPORT_S:
        last_vol_report = now
        pct = int(volume * 100)

        if abs(pct - vol_reported) >= config.VOL_DEADBAND:
            vol_reported = pct
            link.send("VOL_%d" % min(100, pct))

    # Track housekeeping
    tracks.tick(link)

    # Audio renders in C in the background; this loop only handles events
    time.sleep(0.002)
