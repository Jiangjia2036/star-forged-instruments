import math
import struct
import array
from machine import I2S, Pin, ADC

# --- Audio Parameters ---
SAMPLE_RATE = 22000
# Lowered to 4500 to prevent the geometric echo series from exceeding 32767
AMPLITUDE = 4500 
FREQS = [440, 554, 659]

# --- Hardware Configuration ---
bclk = Pin(14)
lrc = Pin(15)
din = Pin(13)

btn_1 = Pin(16, Pin.IN, Pin.PULL_UP)
btn_2 = Pin(17, Pin.IN, Pin.PULL_UP)
btn_3 = Pin(18, Pin.IN, Pin.PULL_UP)
echo_switch = Pin(19, Pin.IN, Pin.PULL_UP)

flex_sensor = ADC(26)
SENSOR_MIN = 2368
SENSOR_MAX = 8548
volume_pot = ADC(27)

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

# --- Memory Allocation ---
print("Pre-calculating Oscillator Arrays...")
note_arrays = []
for f in FREQS:
    wave = array.array('h', [0] * SAMPLE_RATE)
    for n in range(SAMPLE_RATE):
        wave[n] = int(AMPLITUDE * math.sin(2 * math.pi * f * (n / SAMPLE_RATE)))
    note_arrays.append(wave)

DELAY_SAMPLES = 6600 
delay_buffer = array.array('h', [0] * DELAY_SAMPLES)

# --- The DSP Engine ---
# The @micropython.native decorator pre-compiles this function into raw machine code
@micropython.native
def run_dsp_engine():
    CHUNK_SAMPLES = 250
    out_buf = bytearray(CHUNK_SAMPLES * 2)
    time_ptr = 0
    delay_ptr = 0
    y_prev = 0 
    
    print("Ready. DSP Engine Running.")
    
    while True:
        # Read Hardware Inputs
        play_1 = not btn_1.value()
        play_2 = not btn_2.value()
        play_3 = not btn_3.value()
        echo_active = not echo_switch.value()
        vol_multiplier = volume_pot.read_u16()
        
        # Calculate Wah-Wah Alpha
        raw_flex = flex_sensor.read_u16()
        if raw_flex < SENSOR_MIN: raw_flex = SENSOR_MIN
        if raw_flex > SENSOR_MAX: raw_flex = SENSOR_MAX
        
        # Avoid floating point in the main loop to save CPU
        normalized_ratio_scaled = ((raw_flex - SENSOR_MIN) * 64535) // (SENSOR_MAX - SENSOR_MIN)
        alpha = 1000 + normalized_ratio_scaled
        
        # Fast Inner Loop
        for i in range(CHUNK_SAMPLES):
            # A. Sum Dry Signal
            dry_signal = 0
            if play_1: dry_signal += note_arrays[0][time_ptr]
            if play_2: dry_signal += note_arrays[1][time_ptr]
            if play_3: dry_signal += note_arrays[2][time_ptr]
            
            # B. Wah-Wah Filter
            y_prev += (alpha * (dry_signal - y_prev)) >> 16
            
            # C. Echo Generation
            historic_sample = delay_buffer[delay_ptr]
            # Integer division strictly decays to zero, preventing negative DC offsets
            echo_tail = int(historic_sample / 2) 
            
            delay_internal = y_prev + echo_tail
            
            # Final Hard Clipping Net (Rarely triggered now due to lowered amplitude)
            if delay_internal > 32767: delay_internal = 32767
            elif delay_internal < -32768: delay_internal = -32768
            
            delay_buffer[delay_ptr] = delay_internal
            
            # D. Routing & Volume Matrix
            if echo_active:
                pre_vol_out = delay_internal
            else:
                pre_vol_out = y_prev
                
            final_out = (pre_vol_out * vol_multiplier) >> 16
            
            struct.pack_into('<h', out_buf, i * 2, final_out)
            
            # Advance Pointers
            time_ptr += 1
            if time_ptr >= SAMPLE_RATE: time_ptr = 0
                
            delay_ptr += 1
            if delay_ptr >= DELAY_SAMPLES: delay_ptr = 0
                
        # Transmit buffer chunk
        audio_out.write(out_buf)

# Execute the engine
try:
    run_dsp_engine()
except KeyboardInterrupt:
    print("Stopping audio...")
    audio_out.deinit()