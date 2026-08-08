# Backing tracks on the Pico

The Pico streams WAV files from its own flash and mixes them into the same
I2S output as the oscillators. The speaker plays the song **and** your beeps
together, so you can play along on the buttons.

This is the approach from
[miketeachman/micropython-i2s-examples](https://github.com/miketeachman/micropython-i2s-examples):
seek past the WAV header, `readinto()` a buffer, write to I2S. The addition
here is that each chunk is summed with the synthesiser output before being
sent, rather than written straight through.

## Required format

The I2S peripheral is configured once, so a file must match it exactly:

| Property    | Value            |
| ----------- | ---------------- |
| Encoding    | PCM signed 16-bit |
| Channels    | 1 (mono)         |
| Sample rate | 22000 Hz         |

Anything else plays at the wrong speed or as noise.

## Converting a file

From an mp4, mp3, or anything else ffmpeg reads:

```bash
ffmpeg -i "Dark Horse.mp4" -vn -ac 1 -ar 22000 -c:a pcm_s16le "darkhorse.wav"
```

- `-vn` drops the video stream
- `-ac 1` downmixes to mono
- `-ar 22000` resamples to match the I2S rate
- `-c:a pcm_s16le` writes plain 16-bit PCM

To trim to a chorus rather than a whole song, add `-ss` (start) and `-t`
(duration) before `-i`:

```bash
ffmpeg -ss 00:00:48 -t 40 -i "Dark Horse.mp4" -vn -ac 1 -ar 22000 -c:a pcm_s16le "darkhorse.wav"
```

## The flash budget

This is the real constraint. At 22000 Hz, 16-bit mono, audio costs about
**44 KB per second**.

| Length | Size    |
| ------ | ------- |
| 15 s   | ~660 KB |
| 30 s   | ~1.3 MB |
| 60 s   | ~2.6 MB |

A Pico 2 W has 4 MB of flash with roughly 3 MB free after MicroPython, so
**about 60 seconds total** across all tracks. A 40 second excerpt is a
sensible target. Uploading a file that size over MicroPico takes a few
minutes, so do not be alarmed when it seems to hang.

If you need more, an SD card over SPI is the usual answer, and the same
examples repo has `play_wav_from_sdcard_blocking.py` showing the wiring.

## Getting files onto the Pico

1. Create a folder named `audio` in the Pico's filesystem root.
2. Upload your `.wav` files into it (MicroPico: right click the file →
   *Upload file to Pico*, then move it into `/audio`, or use Thonny's file
   browser which lets you drag straight into a folder).
3. Unplug and replug so `main.py` boots normally.

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

Because the position reports come from the Pico as it actually plays, the
progress bar on the website follows the speaker rather than a separate timer
that could drift out of sync.

## Mix levels

In `main.py`:

- `TRACK_GAIN` (default 200, where 256 is 1.0x) sets the backing track level.
  Lower it so your playing sits on top of the track.
- `AMPLITUDE` sets the beep level.
- `OUTPUT_GAIN` is the final makeup gain.

The track is mixed in *after* the filter and echo, so the recording stays
clean and only your beeps get the wah sweep and the delay tail.
