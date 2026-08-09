"""Backing tracks streamed from the CIRCUITPY drive's /audio folder.

Both WAV and MP3 are supported. MP3 is strongly preferred: the board has
very little free flash, and at 128 kbps a minute of audio costs about 1 MB
against roughly 5 MB for the same minute as 44.1 kHz WAV.

The decoded audio goes into the mixer's second voice, so the speaker carries
the song and your playing at the same time.
"""

import os
import time

import audiocore
import audiomp3

import config


class TrackPlayer:
    def __init__(self, mixer_voice):
        self._voice = mixer_voice
        self._file = None
        self._source = None

        self._started = 0.0
        self._duration = 0.0
        self._last_pos_report = 0.0

        self.playing_name = None

    def list_tracks(self):
        try:
            return sorted(
                f for f in os.listdir(config.TRACK_DIR)
                if f.lower().endswith((".wav", ".mp3"))
            )
        except OSError:
            return []

    def _open_source(self, path, file):
        """Return (source, duration_seconds) or raise ValueError/OSError."""

        if path.lower().endswith(".mp3"):
            source = audiomp3.MP3Decoder(file)

            # MP3 has no frame count in the header, so estimate from size.
            # Accurate for constant bitrate, which is what AUDIO.md tells
            # you to encode.
            size = os.stat(path)[6]
            duration = size / (config.MP3_BITRATE_KBPS * 1000 / 8)

            return source, duration

        source = audiocore.WaveFile(file)

        frames = os.stat(path)[6] // (source.bits_per_sample // 8)
        duration = frames / source.sample_rate

        return source, duration

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
            source, duration = self._open_source(path, file)
        except (ValueError, OSError, MemoryError):
            file.close()
            link.send("TRACK_ERROR_baddecode")
            return

        # The mixer resamples nothing, so the file has to match the chain.
        # Report the actual numbers rather than a bare failure, because a
        # rate mismatch is by far the most common reason a track is silent.
        if (
            source.sample_rate != config.SAMPLE_RATE
            or source.channel_count != 1
        ):
            link.send(
                "TRACK_ERROR_format_%dHz_%dch_need_%dHz_1ch"
                % (
                    source.sample_rate,
                    source.channel_count,
                    config.SAMPLE_RATE,
                )
            )
            file.close()
            return

        self._file = file
        self._source = source
        self._duration = duration
        self._started = time.monotonic()
        self._last_pos_report = 0.0
        self.playing_name = name

        try:
            self._voice.play(source)
        except (ValueError, RuntimeError) as err:
            file.close()
            self._file = None
            self._source = None
            self.playing_name = None
            link.send("TRACK_ERROR_play_%s" % err)
            return

        link.send("TRACK_PLAYING_%s_%d" % (name, int(duration)))

    def stop(self, link, silent=False):
        if self._source is not None:
            self._voice.stop()
            self._file.close()
            self._file = None
            self._source = None
            self.playing_name = None

            if not silent:
                link.send("TRACK_STOPPED")

    def tick(self, link):
        """Report progress, and notice the track finishing on its own."""

        if self._source is None:
            return

        if not self._voice.playing:
            self._voice.stop()
            self._file.close()
            self._file = None
            self._source = None
            self.playing_name = None
            link.send("TRACK_END")
            return

        now = time.monotonic()

        if now - self._last_pos_report >= config.POS_REPORT_S:
            self._last_pos_report = now

            if self._duration > 0:
                pct = int(100 * (now - self._started) / self._duration)
                link.send("TRACK_POS_%d" % min(100, pct))
