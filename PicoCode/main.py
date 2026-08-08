import math
import struct
import array
import micropython

from machine import I2S, Pin, ADC


# ============================================================
# Audio Parameters
# ============================================================

SAMPLE_RATE = 22000

# Lower amplitude so multiple notes + echo do not overflow int16
AMPLITUDE = 4500

FREQS = [
    440,
    554,
    659
]


# ============================================================
# Serial Protocol
# ============================================================

# These names are sent over USB serial to the website.
# They intentionally do not have to match FREQS.
NOTES = [
    "C4",
    "D4",
    "E4"
]


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

print("Pre-calculating Oscillator Arrays...")

note_arrays = []

for f in FREQS:

    wave = array.array(
        'h',
        [0] * SAMPLE_RATE
    )

    for n in range(SAMPLE_RATE):

        wave[n] = int(
            AMPLITUDE
            * math.sin(
                2 * math.pi * f * (n / SAMPLE_RATE)
            )
        )

    note_arrays.append(wave)


# 6600 / 22000 = 0.3 second echo delay
DELAY_SAMPLES = 6600

delay_buffer = array.array(
    'h',
    [0] * DELAY_SAMPLES
)


# ============================================================
# DSP Engine
# ============================================================

@micropython.native
def run_dsp_engine():

    CHUNK_SAMPLES = 250

    out_buf = bytearray(
        CHUNK_SAMPLES * 2
    )

    time_ptr = 0
    delay_ptr = 0

    y_prev = 0

    # Previous button states for edge detection
    prev_1 = False
    prev_2 = False
    prev_3 = False
    prev_echo = False

    print("Ready. DSP Engine Running.")
    print("PICO_READY")

    while True:

        # ====================================================
        # Read Hardware
        # ====================================================

        play_1 = not btn_1.value()
        play_2 = not btn_2.value()
        play_3 = not btn_3.value()

        echo_active = not echo_switch.value()

        vol_multiplier = volume_pot.read_u16()


        # ====================================================
        # USB Serial Messages
        # ====================================================

        if play_1 != prev_1:

            prev_1 = play_1

            print(
                "NOTE_%s_%s"
                % (
                    NOTES[0],
                    "ON" if play_1 else "OFF"
                )
            )


        if play_2 != prev_2:

            prev_2 = play_2

            print(
                "NOTE_%s_%s"
                % (
                    NOTES[1],
                    "ON" if play_2 else "OFF"
                )
            )


        if play_3 != prev_3:

            prev_3 = play_3

            print(
                "NOTE_%s_%s"
                % (
                    NOTES[2],
                    "ON" if play_3 else "OFF"
                )
            )


        if echo_active != prev_echo:

            prev_echo = echo_active

            print(
                "EFFECT_ECHO_%s"
                % (
                    "ON" if echo_active else "OFF"
                )
            )


        # ====================================================
        # Flex Sensor / Filter
        # ====================================================

        raw_flex = flex_sensor.read_u16()

        if raw_flex < SENSOR_MIN:
            raw_flex = SENSOR_MIN

        if raw_flex > SENSOR_MAX:
            raw_flex = SENSOR_MAX


        normalized_ratio_scaled = (
            (raw_flex - SENSOR_MIN) * 64535
        ) // (
            SENSOR_MAX - SENSOR_MIN
        )

        alpha = 1000 + normalized_ratio_scaled


        # ====================================================
        # Generate Audio Chunk
        # ====================================================

        for i in range(CHUNK_SAMPLES):

            # ------------------------------------------------
            # A. Dry signal
            # ------------------------------------------------

            dry_signal = 0

            if play_1:
                dry_signal += note_arrays[0][time_ptr]

            if play_2:
                dry_signal += note_arrays[1][time_ptr]

            if play_3:
                dry_signal += note_arrays[2][time_ptr]


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

                historic_sample = delay_buffer[delay_ptr]

                # Arithmetic shift floors toward negative infinity, so a
                # sample can rest at -1 instead of reaching 0. That is 1/32768
                # of full scale and inaudible, and the shift avoids a float
                # divide in the hot loop.
                echo_tail = historic_sample >> 1

                delay_internal = (
                    y_prev
                    + echo_tail
                )

                # Hard clipping
                if delay_internal > 32767:
                    delay_internal = 32767

                elif delay_internal < -32768:
                    delay_internal = -32768

                delay_buffer[delay_ptr] = delay_internal

                pre_vol_out = delay_internal

            else:

                # Echo disabled
                delay_buffer[delay_ptr] = 0

                pre_vol_out = y_prev


            # ------------------------------------------------
            # D. Volume
            # ------------------------------------------------

            final_out = (
                pre_vol_out
                * vol_multiplier
            ) >> 16


            # Store 16-bit sample
            struct.pack_into(
                '<h',
                out_buf,
                i * 2,
                final_out
            )


            # ------------------------------------------------
            # Advance oscillator pointer
            # ------------------------------------------------

            time_ptr += 1

            if time_ptr >= SAMPLE_RATE:
                time_ptr = 0


            # ------------------------------------------------
            # Advance delay pointer
            # ------------------------------------------------

            delay_ptr += 1

            if delay_ptr >= DELAY_SAMPLES:
                delay_ptr = 0


        # ====================================================
        # Send Audio to I2S
        # ====================================================

        audio_out.write(out_buf)


# ============================================================
# Start Program
# ============================================================

try:
    run_dsp_engine()

except KeyboardInterrupt:
    print("Stopping audio...")
    audio_out.deinit()
