"""Buttons, switches, and volume for the bare synthio instrument."""

import analogio
import keypad

import config


class Inputs:
    SWITCH_ECHO = 0
    SWITCH_SUSTAIN = 1

    def __init__(self):
        self.keys = keypad.Keys(
            config.BUTTON_PINS,
            value_when_pressed=False,
            pull=True,
        )
        self.switches = keypad.Keys(
            (config.ECHO_SWITCH_PIN, config.SUSTAIN_SWITCH_PIN),
            value_when_pressed=False,
            pull=True,
        )
        self._volume = analogio.AnalogIn(config.VOLUME_PIN)

        # Seeded from the first reading so the knob does not sweep up from
        # zero at boot
        self._vol_smooth = self._volume.value / 65535

        self.echo_on = False
        self.sustain_on = False

    def button_events(self):
        while True:
            event = self.keys.events.get()
            if event is None:
                return
            yield event.key_number, event.pressed

    def switch_events(self):
        while True:
            event = self.switches.events.get()
            if event is None:
                return

            if event.key_number == self.SWITCH_ECHO:
                self.echo_on = event.pressed
            else:
                self.sustain_on = event.pressed

            yield event.key_number, event.pressed

    def volume(self):
        raw = self._volume.value / 65535

        self._vol_smooth += (raw - self._vol_smooth) * config.VOL_SMOOTHING

        return config.VOL_FLOOR + self._vol_smooth * (1.0 - config.VOL_FLOOR)
