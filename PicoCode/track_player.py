"""WAV backing tracks streamed from the CIRCUITPY drive's /audio folder.

audiocore decodes and the mixer blends the track with the synth, so the
speaker plays the song and the performance together.
"""

import os
import time

import audiocore

import config


class TrackPlayer:
    def __init__(self, mixer_voice):
        self._voice = mixer_voice
        self._file = None
        self._wave = None

        self._started = 0.0
        self._duration = 0.0
        self._last_pos_report = 0.0

        self.playing_name = None

    def list_tracks(self):
        try:
            return sorted(
                f for f in os.listdir(config.TRACK_DIR)
                if f.lower().endswith(".wav")
            )
        except OSError:
            return []

    def play(self, name, link):
        self.stop(link, silent=True)

        # The command comes from the browser. Keep it inside /audio even if a
        # malformed or manually typed serial command contains path segments.
        if name not in self.list_tracks():
            link.send("TRACK_ERROR_notfound")
            return

        path = config.TRACK_DIR + "/" + name

        try:
            file = open(path, "rb")
        except OSError:
            link.send("TRACK_ERROR_notfound")
            return

        try:
            wave = audiocore.WaveFile(file)
        except (ValueError, OSError):
            file.close()
            link.send("TRACK_ERROR_badwav")
            return

        if (
            wave.sample_rate != config.SAMPLE_RATE
            or wave.bits_per_sample != 16
            or wave.channel_count != 1
        ):
            file.close()
            link.send("TRACK_ERROR_badformat")
            return

        # Duration from the header, for progress reporting
        try:
            frames = os.stat(path)[6] // (wave.bits_per_sample // 8)
            self._duration = frames / wave.sample_rate
        except (OSError, ZeroDivisionError):
            self._duration = 0.0

        self._file = file
        self._wave = wave
        self._started = time.monotonic()
        self._last_pos_report = 0.0
        self.playing_name = name

        try:
            self._voice.play(wave)
        except (ValueError, RuntimeError):
            file.close()
            self._file = None
            self._wave = None
            self.playing_name = None
            link.send("TRACK_ERROR_badformat")
            return

        link.send("TRACK_PLAYING_%s_%d" % (name, int(self._duration)))

    def stop(self, link, silent=False):
        if self._wave is not None:
            self._voice.stop()
            self._file.close()
            self._file = None
            self._wave = None
            self.playing_name = None

            if not silent:
                link.send("TRACK_STOPPED")

    def tick(self, link):
        """Report progress; detect the track finishing on its own."""

        if self._wave is None:
            return

        if not self._voice.playing:
            self._voice.stop()
            self._file.close()
            self._file = None
            self._wave = None
            self.playing_name = None
            link.send("TRACK_END")
            return

        now = time.monotonic()

        if now - self._last_pos_report >= config.POS_REPORT_S:
            self._last_pos_report = now

            if self._duration > 0:
                pct = int(100 * (now - self._started) / self._duration)
                link.send("TRACK_POS_%d" % min(100, pct))
