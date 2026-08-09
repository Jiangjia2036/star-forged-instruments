# Minimal button + serial test. No I2S, no DSP, no native code.
#
# Purpose: prove the button wiring and USB serial output work on their own.
# If this prints when you press the button, the hardware is fine and any
# remaining fault is in the DSP loop or the website.
#
# Run it from MicroPico/Thonny and watch the terminal. It does not need the
# browser and does not conflict with anything.

from machine import Pin
import time

BUTTON_PIN = 16

button = Pin(BUTTON_PIN, Pin.IN, Pin.PULL_UP)

print("=== BUTTON TEST ===")
print("Pin GP%d, internal pull-up." % BUTTON_PIN)
print("Idle reads 1. Pressed should read 0.")
print("Press the button. Ctrl-C to stop.")
print("")

previous = button.value()

print("Resting state: %d %s" % (
    previous,
    "(good - wired and released)" if previous == 1
    else "(pressed, or wired to ground permanently)"
))

ticks = 0

while True:

    current = button.value()

    if current != previous:

        previous = current

        if current == 0:
            print("NOTE_C4_ON")
        else:
            print("NOTE_C4_OFF")

    # Heartbeat once per second proves serial output is flowing even when
    # the button never changes, which separates "no press detected" from
    # "no serial output at all".
    ticks += 1

    if ticks >= 100:
        ticks = 0
        print("alive, GP%d reads %d" % (BUTTON_PIN, current))

    time.sleep_ms(10)
