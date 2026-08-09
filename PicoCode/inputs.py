"""Buttons, switches, and volume for the bare synthio instrument."""

import time

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

        # The flex strip is optional; an absent one leaves the pin floating,
        # so it is not opened at all rather than read as noise.
        self._flex = None
        self._flex_smooth = 0.0

        # Where the strip has been sitting, and whether it is still bent from
        # a trigger. The cooldown starts in the past so the very first bend
        # after boot fires immediately instead of waiting it out.
        self._flex_rest = 0.0
        self._flex_fired = False
        self._flex_fired_at = -1000.0

        if config.FLEX_ENABLED:
            self._flex = analogio.AnalogIn(config.FLEX_PIN)
            self._flex_smooth = self._flex_position()
            self._flex_rest = self._flex_smooth

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

    @property
    def has_flex(self):
        return self._flex is not None

    def flex_raw(self):
        """Uncalibrated 16-bit read, for setting FLEX_RAW_MIN / MAX."""
        return self._flex.value if self._flex else 0

    def _flex_position(self):
        """Bend as 0.0-1.0 across the calibrated span, unsmoothed."""
        span = config.FLEX_RAW_MAX - config.FLEX_RAW_MIN
        if span <= 0:
            return 0.0

        position = (self._flex.value - config.FLEX_RAW_MIN) / span

        return max(0.0, min(1.0, position))

    def flex(self):
        """Smoothed bend, 0.0-1.0. Returns None when no strip is fitted."""
        if self._flex is None:
            return None

        target = self._flex_position()

        self._flex_smooth += (target - self._flex_smooth) * config.FLEX_SMOOTHING

        return self._flex_smooth

    def flex_triggered(self):
        """True on the single loop a deliberate bend fires the effect.

        Measured against a slowly drifting resting reference rather than an
        absolute reading, so it still works if the strip is left holding a
        new shape or the calibration is a little off.
        """
        if self._flex is None:
            return False

        position = self.flex()
        now = time.monotonic()

        # The resting reference always follows, slowly. It has to run before
        # the fired check, not after: a strip mounted or left with a
        # permanent bend would otherwise stay latched and never fire again.
        self._flex_rest += (position - self._flex_rest) * config.FLEX_REST_TRACKING

        travel = abs(position - self._flex_rest)

        if self._flex_fired:
            # Re-arm only once the strip is back near rest, so holding it
            # bent cannot fire again the moment the cooldown expires.
            if travel < config.FLEX_RELEASE_DELTA:
                self._flex_fired = False

            return False

        if travel < config.FLEX_TRIGGER_DELTA:
            return False

        self._flex_fired = True

        if now - self._flex_fired_at < config.FLEX_COOLDOWN_S:
            return False

        self._flex_fired_at = now

        return True

    @property
    def flex_cooldown_left(self):
        """Seconds until the effect can fire again, for diagnostics."""
        if self._flex is None:
            return 0.0

        left = config.FLEX_COOLDOWN_S - (time.monotonic() - self._flex_fired_at)

        return max(0.0, left)
