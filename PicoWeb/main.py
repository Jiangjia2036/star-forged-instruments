from machine import Pin
import time

button = Pin(15, Pin.IN, Pin.PULL_UP)

last_state = button.value()

while True:
    current_state = button.value()

    if current_state != last_state:
        if current_state == 0:
            print("BUTTON_DOWN")
        else:
            print("BUTTON_UP")

        last_state = current_state

    time.sleep(0.01)