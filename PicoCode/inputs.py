"""Physical controls: buttons, switches, and the two analogue sensors.

Buttons and switches use the keypad module, which scans and debounces in C
and hands back clean press/release events - no hand rolled debouncing.
"""

import analogio
import keypad

import config


class Inputs:
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

        self._flex = analogio.AnalogIn(config.FLEX_PIN)
        self._volume = analogio.AnalogIn(config.VOLUME_PIN)

        # One pole smoothing; raw ADC jitter would warble the filter cutoff
        self._flex_s = 0.0
        self._vol_s = 0.0

        self.echo_on = False
        self.sustain_on = False

    SWITCH_ECHO = 0
    SWITCH_SUSTAIN = 1

    def button_events(self):
        """Yield (index, pressed) for each button edge since last call."""
        while True:
            event = self.keys.events.get()
            if event is None:
                return
            yield event.key_number, event.pressed

    def switch_events(self):
        """Yield (which, closed) for each switch edge; updates state too."""
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
        """Smoothed pot position 0.0 - 1.0, with the configured floor."""
        raw = self._volume.value / 65535
        self._vol_s += (raw - self._vol_s) * config.ADC_SMOOTHING

        span = 1.0 - config.VOL_FLOOR
        return config.VOL_FLOOR + self._vol_s * span

    def filter_hz(self):
        """Flex sensor mapped to the wah filter's cutoff frequency."""
        raw = self._flex.value

        lo, hi = config.FLEX_RAW_MIN, config.FLEX_RAW_MAX
        clamped = min(max(raw, lo), hi)

        self._flex_s += (
            (clamped - lo) / (hi - lo) - self._flex_s
        ) * config.ADC_SMOOTHING

        return (
            config.FILTER_HZ_MIN
            + self._flex_s * (config.FILTER_HZ_MAX - config.FILTER_HZ_MIN)
        )
