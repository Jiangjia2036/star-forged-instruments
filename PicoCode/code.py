"""Star Forged Instruments - CircuitPython synthio firmware.

Live audio path:

    buttons -> synthio -> [chorus] -> [echo] -> [reverb] -> tone -> I2S

Every stage is a CircuitPython DSP block running in compiled code. Optional
stages are inserted only while enabled. Chord gain stays below synthio's
internal compressor knee instead of distorting and trying to repair the
signal later. Physical button messages still go to the website for visuals,
while sound stays on the Pico.
"""

import time

import audiobusio

import config
from effects import EffectChain
from inputs import Inputs
from serial_link import SerialLink
from synth_engine import SynthEngine
from track_player import TrackPlayer
from waveforms import WAVE_NAMES


engine = SynthEngine()
inputs = Inputs()
link = SerialLink()

i2s = audiobusio.I2SOut(
    bit_clock=config.I2S_BCLK,
    word_select=config.I2S_LRC,
    data=config.I2S_DATA,
)

# Builds and rewires the whole chain, and plays it into the amplifier
chain = EffectChain(engine.source, i2s)

# Backing tracks share the output through the mixer's second voice
tracks = TrackPlayer(chain.track_voice)

web_sustain = False
web_echo = False

# The flex strip fires the alien sound effect. Toggleable from the website
# so it can be silenced without reflashing.
flex_enabled = config.FLEX_ENABLED


def apply_sustain():
    engine.sustain = inputs.sustain_on or web_sustain


def echo_active():
    return inputs.echo_on or web_echo


def apply_echo():
    chain.set_echo(echo_active())


def handle(line):
    global web_echo, web_sustain, flex_enabled

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

    elif line.startswith("FX_CHORUS_"):
        chain.set_chorus(line[10:] == "ON")
        link.send("FX_CHORUS_%s_OK" % ("ON" if chain.chorus_on else "OFF"))

    elif line.startswith("FX_REVERB_"):
        chain.set_reverb(line[10:] == "ON")
        link.send("FX_REVERB_%s_OK" % ("ON" if chain.reverb_on else "OFF"))

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

    elif line == "STATUS":
        # Diagnostic: report the actual levels so a volume complaint can be
        # traced to the pot, the mixer, or the per-note balance.
        link.send(
            "STATUS pot=%.3f mix0=%.3f mix1=%.3f voices=%d wave=%s"
            % (
                inputs.volume(),
                chain.mixer.voice[0].level,
                chain.mixer.voice[1].level,
                engine.held_note_count,
                engine.wave_name,
            )
        )
        link.send(
            "STATUS echo=%s chorus=%s reverb=%s notes=%s"
            % (
                chain.echo_on,
                chain.chorus_on,
                chain.reverb_on,
                ",".join(engine.note_names),
            )
        )
        link.send(
            "STATUS flex=%d enabled=%s cooldown=%.1fs"
            % (
                inputs.flex_raw(),
                "ON" if flex_enabled else "OFF",
                inputs.flex_cooldown_left,
            )
        )

    elif line == "TRACK_LIST":
        link.send("TRACKS_" + "|".join(tracks.list_tracks()))

    elif line.startswith("TRACK_PLAY_"):
        tracks.play(line[11:], link)

    elif line == "TRACK_STOP":
        tracks.stop(link)

    elif line.startswith("FX_TONE_"):
        try:
            chain.set_tone_hz(int(line[8:]))
            link.send("FX_TONE_OK")
        except ValueError:
            pass

    elif line.startswith("FX_FLEX_"):
        flex_enabled = line[8:] == "ON"
        link.send("FX_FLEX_%s_OK" % ("ON" if flex_enabled else "OFF"))


link.send("PICO_READY")
link.send("AUDIO_HEADROOM_SAFE")
link.send("TUNED_" + "_".join(engine.note_names))

vol_reported = -1
last_vol_report = 0.0
last_status = 0.0
loop_prev = time.monotonic()

while True:
    for index, pressed in inputs.button_events():
        name = engine.note_names[index] if index < len(engine.note_names) else "?"

        if pressed:
            engine.note_on(index)
            link.send("NOTE_%s_ON" % name)
        else:
            engine.note_off(index)
            link.send("NOTE_%s_OFF" % name)

    for which, _closed in inputs.switch_events():
        if which == Inputs.SWITCH_SUSTAIN:
            apply_sustain()
            link.send("SUSTAIN_%s" % ("ON" if engine.sustain else "OFF"))
        else:
            apply_echo()
            link.send("EFFECT_ECHO_%s" % ("ON" if echo_active() else "OFF"))

    for line in link.poll():
        handle(line)

    now = time.monotonic()
    volume = inputs.volume()
    chain.set_volume(volume)

    # Bending the strip fires the alien effect out of the instrument's own
    # speaker, through the mixer's second voice so it layers over whatever
    # is being played rather than interrupting it.
    if flex_enabled and inputs.flex_triggered():
        link.send("FLEX_ALIEN")
        tracks.play(config.FLEX_SOUND, link)

    tracks.tick(link)

    # Diagnostic broadcast. The website logs every line it receives, so this
    # exposes the real levels while the browser is the thing connected -
    # something a simulated connection over this same port cannot show.
    if config.STATUS_BROADCAST_S and now - last_status >= config.STATUS_BROADCAST_S:
        last_status = now
        link.send(
            "STATUS pot=%.3f mix0=%.3f voices=%d flex=%d loop=%.1fms"
            % (
                volume,
                chain.mixer.voice[0].level,
                engine.held_note_count,
                inputs.flex_raw(),
                (now - loop_prev) * 1000.0,
            )
        )

    if now - last_vol_report >= config.VOL_REPORT_S:
        last_vol_report = now
        pct = int(volume * 100)
        if abs(pct - vol_reported) >= config.VOL_DEADBAND:
            vol_reported = pct
            link.send("VOL_%d" % min(100, pct))

    loop_prev = now
    time.sleep(0.002)
