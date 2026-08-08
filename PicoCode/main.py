import math
import struct
import array
import time
import sys
import select
import os
import micropython

from machine import I2S, Pin, ADC


# ============================================================
# Startup Grace Period
# ============================================================

# Guarantees a window at boot where the USB serial port is healthy, so a
# terminal or MicroPico can attach and interrupt before audio starts.

print("Booting. 5 second window to connect before audio starts...")

for _remaining in range(5, 0, -1):
    print("Starting in %d..." % _remaining)
    time.sleep(1)


# ============================================================
# Audio Parameters
# ============================================================

SAMPLE_RATE = 22000

CHUNK_SAMPLES = 250


# ------------------------------------------------------------
# Output Level
# ------------------------------------------------------------

# Peak of a single oscillator, out of 32767. Three oscillators plus the echo
# tail can exceed full scale, so the output stage clips rather than wrapping.
# A single note is the common case, and it should be LOUD.
AMPLITUDE = 10000

# Makeup gain applied after the volume pot, 8.8 fixed point.
# 256 = 1.0x, 384 = 1.5x, 512 = 2.0x.
# Lower this first if chords sound gritty.
OUTPUT_GAIN = 384

# Floor for the volume pot so an unwired or dirty pot still makes sound.
# Set to 0 if you want the pot to be able to silence the instrument.
VOL_MIN = 8192

# Level of the backing track relative to the beeps, 8.8 fixed point.
#
# Headroom budget, because the track and the beeps share one output:
#   beeps          ~8000  (AMPLITUDE 10000 through the filter)
#   track          32767 * TRACK_GAIN / 256
#   their sum is then multiplied by OUTPUT_GAIN (1.5x), so the sum must
#   stay under 32767 / 1.5 = 21845.
# 96 leaves the track at ~12300, which fits alongside a note without
# clipping. Raise it for a louder backing track, lower it to hear yourself
# more clearly over the song.
TRACK_GAIN = 96


# ------------------------------------------------------------
# Backing Tracks
# ------------------------------------------------------------

# WAV files streamed from flash and mixed into the same I2S output as the
# oscillators, so the speaker plays the song AND your beeps together.
#
# Files must be 16-bit mono at SAMPLE_RATE. Convert with:
#   ffmpeg -i input.mp4 -vn -ac 1 -ar 22000 -c:a pcm_s16le track.wav
#
# Flash is the limit: roughly 44 KB per second of audio, so budget about
# 60 seconds. See PicoCode/AUDIO.md.

TRACK_DIR = "/audio"

# How often to report playback position to the website, in chunks.
# 22 chunks is roughly 250 ms.
POS_REPORT_CHUNKS = 22


# ------------------------------------------------------------
# Flex Filter Range
# ------------------------------------------------------------

# One-pole lowpass coefficient. The old floor of 1000 put the cutoff near
# 50 Hz, which buried the notes - that was the main reason the speaker was
# quiet. Raise ALPHA_MIN further for an even brighter resting tone.
ALPHA_MIN = 8000
ALPHA_MAX = 65535

# One shared sine table read with a phase accumulator, instead of a
# precomputed table per note. Any frequency is available instantly, so the
# website can retune the instrument mid-performance. It also drops the wave
# memory from ~132 KB to 4 KB.
TABLE_LEN = 2048
TABLE_MASK = TABLE_LEN - 1

# Phase is fixed point: high bits index the table, low 16 bits are fraction
PHASE_MASK = (TABLE_LEN << 16) - 1


# ============================================================
# Serial Protocol
# ============================================================

# Note names sent to the website for btn_1, btn_2, btn_3. Rewritten by the
# TUNE command so NOTE_* messages always match what the buttons actually play.
NOTES = ["C4", "D4", "E4"]

SEMITONES = {
    "C": 0,
    "C#": 1,
    "D": 2,
    "D#": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "G": 7,
    "G#": 8,
    "A": 9,
    "A#": 10,
    "B": 11,
}


def note_to_freq(name):
    """'C4' or 'F#4' -> Hz. None if unparseable."""

    if len(name) < 2:
        return None

    if name[1] == "#":
        letter = name[0:2]
        octave_text = name[2:]
    else:
        letter = name[0:1]
        octave_text = name[1:]

    if letter not in SEMITONES:
        return None

    try:
        octave = int(octave_text)
    except ValueError:
        return None

    midi = (octave + 1) * 12 + SEMITONES[letter]

    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def freq_to_inc(freq):
    """Phase increment per sample for a frequency."""
    return int(freq * TABLE_LEN * 65536 / SAMPLE_RATE)


def list_tracks():
    """WAV files available in flash."""
    try:
        return [f for f in os.listdir(TRACK_DIR) if f.lower().endswith(".wav")]
    except OSError:
        return []


def wav_data_span(f):
    """Locate the data chunk. Returns (offset, length) or None.

    Walks the RIFF chunks rather than assuming a 44 byte header, because
    encoders often insert LIST/INFO chunks before the audio.
    """

    f.seek(0)
    riff = f.read(12)

    if len(riff) < 12 or riff[0:4] != b"RIFF" or riff[8:12] != b"WAVE":
        return None

    while True:
        header = f.read(8)

        if len(header) < 8:
            return None

        chunk_id = header[0:4]
        size = int.from_bytes(header[4:8], "little")

        if chunk_id == b"data":
            return (f.tell(), size)

        # chunks are word aligned
        f.seek(size + (size & 1), 1)


# ============================================================
# Hardware Configuration
# ============================================================

# I2S
bclk = Pin(14)
lrc = Pin(15)
din = Pin(13)

# Buttons
btn_1 = Pin(16, Pin.IN, Pin.PULL_UP)
btn_2 = Pin(17, Pin.IN, Pin.PULL_UP)
btn_3 = Pin(18, Pin.IN, Pin.PULL_UP)

# Echo switch
echo_switch = Pin(19, Pin.IN, Pin.PULL_UP)

# Flex sensor
flex_sensor = ADC(26)

SENSOR_MIN = 2368
SENSOR_MAX = 8548

# Volume potentiometer
volume_pot = ADC(27)


# ============================================================
# I2S Output
# ============================================================

audio_out = I2S(
    0,
    sck=bclk,
    ws=lrc,
    sd=din,
    mode=I2S.TX,
    bits=16,
    format=I2S.MONO,
    rate=SAMPLE_RATE,
    ibuf=4000
)


# ============================================================
# Memory Allocation
# ============================================================

print("Building wave tables...")

# Three timbres. Switching between them is a distinct sound change that is
# neither pitch nor volume, which is what the brief asks for.
# Square and saw carry far more harmonic energy than a sine, so they are
# scaled back to keep the perceived loudness even across the three.
WAVE_NAMES = ["SINE", "SQUARE", "SAW"]

WAVES = []

for _kind in WAVE_NAMES:

    _table = array.array('h', [0] * TABLE_LEN)

    for n in range(TABLE_LEN):

        _phase = n / TABLE_LEN

        if _kind == "SINE":
            _value = math.sin(2 * math.pi * _phase)
            _trim = 1.0

        elif _kind == "SQUARE":
            _value = 1.0 if _phase < 0.5 else -1.0
            _trim = 0.6

        else:
            _value = 2.0 * _phase - 1.0
            _trim = 0.7

        _table[n] = int(AMPLITUDE * _value * _trim)

    WAVES.append(_table)

# The LFO reads the sine table regardless of the selected voice timbre
sine_table = WAVES[0]


# 6600 / 22000 = 0.3 second echo delay
DELAY_SAMPLES = 6600

delay_buffer = array.array('h', [0] * DELAY_SAMPLES)

out_buf = bytearray(CHUNK_SAMPLES * 2)

# Backing track samples for the current chunk. readinto() fills this directly
# as int16, so the render loop can index it without unpacking.
wav_buf = array.array('h', [0] * CHUNK_SAMPLES)


# ============================================================
# Sample Renderer
# ============================================================

# ONLY the per-sample inner loop is native. Code compiled with
# @micropython.native never returns to the interpreter's event hook, so USB
# serial is not serviced while it runs. Keeping this function short and
# calling it from an ordinary Python loop means the runtime regains control
# 88 times a second, which keeps the serial port alive.

@micropython.native
def render_chunk(
    play_1,
    play_2,
    play_3,
    echo_active,
    vol_multiplier,
    alpha,
    ph_1,
    ph_2,
    ph_3,
    inc_1,
    inc_2,
    inc_3,
    delay_ptr,
    y_prev,
    track_on,
    tbl
):

    # Local aliases avoid a global lookup per sample
    buf = out_buf
    db = delay_buffer
    wavb = wav_buf

    mask = TABLE_MASK
    pmask = PHASE_MASK
    gain = OUTPUT_GAIN
    tgain = TRACK_GAIN

    for i in range(CHUNK_SAMPLES):

        # ------------------------------------------------
        # A. Dry signal
        # ------------------------------------------------

        dry_signal = 0

        if play_1:
            dry_signal += tbl[(ph_1 >> 16) & mask]

        if play_2:
            dry_signal += tbl[(ph_2 >> 16) & mask]

        if play_3:
            dry_signal += tbl[(ph_3 >> 16) & mask]

        # Oscillators run continuously so a key never restarts mid-cycle
        ph_1 = (ph_1 + inc_1) & pmask
        ph_2 = (ph_2 + inc_2) & pmask
        ph_3 = (ph_3 + inc_3) & pmask


        # ------------------------------------------------
        # B. Flex-controlled filter
        # ------------------------------------------------

        y_prev += (
            alpha
            * (dry_signal - y_prev)
        ) >> 16


        # ------------------------------------------------
        # C. Echo
        # ------------------------------------------------

        if echo_active:

            historic_sample = db[delay_ptr]

            # Arithmetic shift floors toward negative infinity, so a sample
            # can rest at -1 instead of reaching 0. That is 1/32768 of full
            # scale and inaudible, and it avoids a float divide per sample.
            echo_tail = historic_sample >> 1

            delay_internal = y_prev + echo_tail

            # Hard clipping
            if delay_internal > 32767:
                delay_internal = 32767

            elif delay_internal < -32768:
                delay_internal = -32768

            db[delay_ptr] = delay_internal

            pre_vol_out = delay_internal

        else:

            # Echo disabled
            db[delay_ptr] = 0

            pre_vol_out = y_prev


        # ------------------------------------------------
        # E. Volume
        # ------------------------------------------------

        # ------------------------------------------------
        # D. Mix the backing track in
        # ------------------------------------------------

        # Added after the filter and echo so the recording stays clean and
        # only the beeps get the wah and the delay tail.

        if track_on:
            pre_vol_out += (wavb[i] * tgain) >> 8


        final_out = (
            pre_vol_out
            * vol_multiplier
        ) >> 16

        final_out = (final_out * gain) >> 8

        # Final safety clip. The echo branch clipped its own feedback, but
        # nothing clipped the dry path, so a loud chord could wrap around
        # into harsh distortion or overflow the int16 pack below.
        if final_out > 32767:
            final_out = 32767

        elif final_out < -32768:
            final_out = -32768

        struct.pack_into('<h', buf, i * 2, final_out)


        delay_ptr += 1

        if delay_ptr >= DELAY_SAMPLES:
            delay_ptr = 0


    return ph_1, ph_2, ph_3, delay_ptr, y_prev


# ============================================================
# DSP Engine
# ============================================================

# Deliberately NOT native: this loop reads inputs, prints serial messages and
# hands control back to MicroPython between chunks.

def run_dsp_engine():

    delay_ptr = 0
    y_prev = 0

    ph_1 = 0
    ph_2 = 0
    ph_3 = 0

    inc_1 = freq_to_inc(note_to_freq(NOTES[0]))
    inc_2 = freq_to_inc(note_to_freq(NOTES[1]))
    inc_3 = freq_to_inc(note_to_freq(NOTES[2]))

    # Previous input states for edge detection
    prev_1 = False
    prev_2 = False
    prev_3 = False
    prev_echo = False

    # Notes switched on by the website during song playback. These are OR'd
    # with the physical buttons, so the player can always play along.
    remote = [False, False, False]

    # Non-blocking stdin so incoming commands never stall the audio loop
    poller = select.poll()
    poller.register(sys.stdin, select.POLLIN)

    rx = ""

    # Effects controlled from the website
    wave_index = 0

    # Tremolo is computed once per chunk rather than per sample. At 88 chunks
    # a second that is far above the few Hz an LFO needs, and it costs the
    # inner loop nothing.
    trem_depth = 0
    trem_rate = 5.0
    trem_tick = 0

    # Digital volume from the website, 0-256. Multiplied with the pot so both
    # the physical knob and the site have control.
    web_volume = 256

    # Backing track streaming state
    track_file = None
    track_on = False
    track_start = 0
    track_bytes = 0
    track_read = 0
    pos_counter = 0

    print("Ready. DSP Engine Running.")
    print("PICO_READY")
    print("TUNED_%s_%s_%s" % (NOTES[0], NOTES[1], NOTES[2]))

    while True:

        # ====================================================
        # Commands From The Website
        # ====================================================

        # CMD_ON_<note> / CMD_OFF_<note> / CMD_ALLOFF
        # TUNE_<note1>_<note2>_<note3>
        # Bounded per iteration so a burst cannot stall audio.

        for _ in range(32):

            if not poller.poll(0):
                break

            ch = sys.stdin.read(1)

            if not ch:
                break

            if ch == "\n":

                if rx.startswith("CMD_ON_") and rx[7:] in NOTES:
                    remote[NOTES.index(rx[7:])] = True

                elif rx.startswith("CMD_OFF_") and rx[8:] in NOTES:
                    remote[NOTES.index(rx[8:])] = False

                elif rx == "CMD_ALLOFF":
                    remote[0] = False
                    remote[1] = False
                    remote[2] = False

                elif rx.startswith("FX_WAVE_"):

                    name = rx[8:]

                    if name in WAVE_NAMES:
                        wave_index = WAVE_NAMES.index(name)
                        print("FX_WAVE_%s_OK" % name)

                elif rx.startswith("FX_TREM_"):

                    try:
                        depth = int(rx[8:])
                    except ValueError:
                        depth = -1

                    if 0 <= depth <= 100:
                        trem_depth = depth
                        print("FX_TREM_%d_OK" % depth)

                elif rx.startswith("VOL_"):

                    try:
                        level = int(rx[4:])
                    except ValueError:
                        level = -1

                    if 0 <= level <= 100:
                        web_volume = (level * 256) // 100
                        print("VOL_%d_OK" % level)

                elif rx == "TRACK_LIST":
                    print("TRACKS_" + "|".join(list_tracks()))

                elif rx == "TRACK_STOP":
                    if track_file:
                        track_file.close()
                        track_file = None
                    track_on = False
                    print("TRACK_STOPPED")

                elif rx.startswith("TRACK_PLAY_"):

                    name = rx[11:]

                    if track_file:
                        track_file.close()
                        track_file = None
                        track_on = False

                    try:
                        f = open(TRACK_DIR + "/" + name, "rb")
                        span = wav_data_span(f)

                        if span is None:
                            f.close()
                            print("TRACK_ERROR_badwav")
                        else:
                            track_start = span[0]
                            track_bytes = span[1]
                            track_read = 0
                            f.seek(track_start)
                            track_file = f
                            track_on = True
                            pos_counter = 0
                            print(
                                "TRACK_PLAYING_%s_%d"
                                % (name, track_bytes // 2)
                            )

                    except OSError:
                        print("TRACK_ERROR_notfound")

                elif rx.startswith("TUNE_"):

                    parts = rx[5:].split("_")

                    if len(parts) == 3:

                        freqs = []

                        for name in parts:
                            f = note_to_freq(name)
                            if f is None:
                                break
                            freqs.append(f)

                        if len(freqs) == 3:
                            inc_1 = freq_to_inc(freqs[0])
                            inc_2 = freq_to_inc(freqs[1])
                            inc_3 = freq_to_inc(freqs[2])

                            NOTES[0] = parts[0]
                            NOTES[1] = parts[1]
                            NOTES[2] = parts[2]

                            # Any note held under the old tuning is stale
                            remote[0] = False
                            remote[1] = False
                            remote[2] = False

                            print(
                                "TUNED_%s_%s_%s"
                                % (parts[0], parts[1], parts[2])
                            )

                rx = ""

            elif ch != "\r":

                rx += ch

                # discard anything absurdly long rather than growing forever
                if len(rx) > 60:
                    rx = ""


        # ====================================================
        # Read Hardware
        # ====================================================

        press_1 = not btn_1.value()
        press_2 = not btn_2.value()
        press_3 = not btn_3.value()

        # Website playback and physical buttons both sound the oscillators
        play_1 = press_1 or remote[0]
        play_2 = press_2 or remote[1]
        play_3 = press_3 or remote[2]

        echo_active = not echo_switch.value()

        vol_multiplier = volume_pot.read_u16()

        if vol_multiplier < VOL_MIN:
            vol_multiplier = VOL_MIN

        # Website volume rides on top of the physical knob
        vol_multiplier = (vol_multiplier * web_volume) >> 8

        # Tremolo: one LFO value per chunk, folded into the volume so the
        # render loop stays untouched.
        if trem_depth:

            trem_tick += 1

            lfo = math.sin(
                2 * math.pi * trem_rate
                * trem_tick * CHUNK_SAMPLES / SAMPLE_RATE
            )

            # depth 100 swings from full down to silence
            shaped = 1.0 - (trem_depth / 100.0) * (1.0 - lfo) / 2.0

            vol_multiplier = int(vol_multiplier * shaped)


        # ====================================================
        # USB Serial Messages
        # ====================================================

        # Reports PHYSICAL presses only. Using play_* here would echo the
        # website's own song commands straight back at it.

        if press_1 != prev_1:
            prev_1 = press_1
            print("NOTE_%s_%s" % (NOTES[0], "ON" if press_1 else "OFF"))

        if press_2 != prev_2:
            prev_2 = press_2
            print("NOTE_%s_%s" % (NOTES[1], "ON" if press_2 else "OFF"))

        if press_3 != prev_3:
            prev_3 = press_3
            print("NOTE_%s_%s" % (NOTES[2], "ON" if press_3 else "OFF"))

        if echo_active != prev_echo:
            prev_echo = echo_active
            print("EFFECT_ECHO_%s" % ("ON" if echo_active else "OFF"))


        # ====================================================
        # Flex Sensor / Filter
        # ====================================================

        raw_flex = flex_sensor.read_u16()

        if raw_flex < SENSOR_MIN:
            raw_flex = SENSOR_MIN

        if raw_flex > SENSOR_MAX:
            raw_flex = SENSOR_MAX

        normalized_ratio_scaled = (
            (raw_flex - SENSOR_MIN) * (ALPHA_MAX - ALPHA_MIN)
        ) // (
            SENSOR_MAX - SENSOR_MIN
        )

        alpha = ALPHA_MIN + normalized_ratio_scaled


        # ====================================================
        # Stream The Backing Track
        # ====================================================

        if track_on and track_file:

            got = track_file.readinto(wav_buf)

            if not got:
                # reached the end
                track_file.close()
                track_file = None
                track_on = False
                print("TRACK_END")

            else:
                track_read += got

                # Partial final chunk: silence the tail so the previous
                # chunk's samples are not replayed as a stutter.
                if got < CHUNK_SAMPLES * 2:
                    for i in range(got // 2, CHUNK_SAMPLES):
                        wav_buf[i] = 0

                pos_counter += 1

                if pos_counter >= POS_REPORT_CHUNKS:
                    pos_counter = 0

                    if track_bytes:
                        print(
                            "TRACK_POS_%d"
                            % ((track_read * 100) // track_bytes)
                        )


        # ====================================================
        # Render + Send Audio
        # ====================================================

        ph_1, ph_2, ph_3, delay_ptr, y_prev = render_chunk(
            play_1,
            play_2,
            play_3,
            echo_active,
            vol_multiplier,
            alpha,
            ph_1,
            ph_2,
            ph_3,
            inc_1,
            inc_2,
            inc_3,
            delay_ptr,
            y_prev,
            track_on,
            WAVES[wave_index]
        )

        audio_out.write(out_buf)


# ============================================================
# Start Program
# ============================================================

try:
    run_dsp_engine()

except KeyboardInterrupt:
    print("Stopping audio...")
    audio_out.deinit()
