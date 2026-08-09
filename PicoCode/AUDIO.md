# Backing tracks on the Pico

The Pico streams WAV files from its own flash and mixes them into the same
I2S output as the oscillators. The speaker plays the song **and** your beeps
together, so you can play along on the buttons.

CircuitPython's `audiocore.WaveFile` streams the WAV while `audiomixer` blends
it with `synthio`. Both sources therefore reach the same I2S amplifier without
doing per-sample work in Python.

## Required format

The I2S peripheral is configured once, so a file must match it exactly:

| Property    | Value            |
| ----------- | ---------------- |
| Encoding    | PCM signed 16-bit |
| Channels    | 1 (mono)         |
| Sample rate | 22050 Hz         |

Anything else plays at the wrong speed or as noise.

## Converting a file

From an mp4, mp3, or anything else ffmpeg reads:

```bash
ffmpeg -i "Dark Horse.mp4" -vn -ac 1 -ar 22050 -c:a pcm_s16le "darkhorse.wav"
```

- `-vn` drops the video stream
- `-ac 1` downmixes to mono
- `-ar 22050` resamples to match the I2S rate
- `-c:a pcm_s16le` writes plain 16-bit PCM

To trim to a chorus rather than a whole song, add `-ss` (start) and `-t`
(duration) before `-i`:

```bash
ffmpeg -ss 00:00:48 -t 40 -i "Dark Horse.mp4" -vn -ac 1 -ar 22050 -c:a pcm_s16le "darkhorse.wav"
```

## The flash budget

This is the real constraint. At 22050 Hz, 16-bit mono, audio costs about
**44 KB per second**.

| Length | Size    |
| ------ | ------- |
| 15 s   | ~660 KB |
| 30 s   | ~1.3 MB |
| 60 s   | ~2.6 MB |

A Pico 2 W has limited CIRCUITPY flash, so leave room for the firmware and use
short excerpts. About 40 seconds is a sensible target for one track.

If you need more, an SD card over SPI is the usual answer, and the same
examples repo has `play_wav_from_sdcard_blocking.py` showing the wiring.

## Getting files onto the Pico

1. Create a folder named `audio` in the Pico's filesystem root.
2. Copy your `.wav` files into `CIRCUITPY/audio` in File Explorer.
3. Copy `code.py` last, or unplug and replug, to reload the firmware after all
   file writes are complete.

## Controlling playback

The website sends these over USB serial:

| Command             | Effect                                  |
| ------------------- | --------------------------------------- |
| `TRACK_LIST`        | Pico replies `TRACKS_a.wav\|b.wav`      |
| `TRACK_PLAY_<file>` | Starts streaming that file              |
| `TRACK_STOP`        | Stops and closes the file               |

And the Pico reports back:

| Message                     | Meaning                          |
| --------------------------- | -------------------------------- |
| `TRACK_PLAYING_<file>_<n>`  | Started, `n` samples long        |
| `TRACK_POS_<percent>`       | Position, about 4 times a second |
| `TRACK_END`                 | Finished                         |
| `TRACK_ERROR_notfound`      | No such file in `/audio`         |
| `TRACK_ERROR_badwav`        | No RIFF data chunk found         |
| `TRACK_ERROR_badformat`     | Wrong sample rate/channels/width |

Because the position reports come from the Pico as it actually plays, the
progress bar on the website follows the speaker rather than a separate timer
that could drift out of sync.

## Mix levels

In `config.py`:

- `TRACK_LEVEL` sets the backing-track level.
- `SYNTH_LEVEL` sets the instrument level.
- `CHORD_LEVEL` protects the amplifier's analogue headroom only while a chord
  is held, leaving a single note loud.

The track bypasses the synth's filter and echo, so the recording stays clean
and only the instrument notes receive those effects.
