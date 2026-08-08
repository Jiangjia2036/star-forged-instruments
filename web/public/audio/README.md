# Backing tracks

Drop audio files in this folder and they can be played as backing tracks
while you play along on the Pico.

## Two ways to use a track

**1. Quick / temporary — no file copying**

Click **Load track** in the site's setlist panel and pick any file from your
computer (Downloads, Music, anywhere). It plays immediately. Nothing is
copied into the repo, and the choice is forgotten on refresh. Good for
rehearsing and for trying things out.

**2. Permanent — part of the project**

Copy the file into this folder, then add an entry in `web/src/songs.js`:

```js
makeSong(
  "dark-horse",
  "Dark Horse",
  132,                       // bpm, only used if you write a chart
  [],                        // chart goes here, or leave empty for free play
  { audioUrl: "/audio/dark-horse.m4a" }
)
```

Anything in `web/public` is served from the site root, so a file saved as
`web/public/audio/dark-horse.m4a` is reachable at `/audio/dark-horse.m4a`.

## Formats

Chrome and Edge play `.mp3`, `.m4a`, `.aac`, `.ogg`, `.wav`, and the audio
track inside an `.mp4`. An `.mp4` works fine — only its audio is used.

Very large files make the repo heavy. If a track is more than ~20 MB,
consider converting it:

```bash
ffmpeg -i "input.mp4" -vn -c:a aac -b:a 128k "web/public/audio/track.m4a"
```

`-vn` drops the video, which is dead weight when only the audio is played.

## How playing along works

The backing track is the clock. When a song has a chart, the site highlights
which key to press and shows the button number, and the progress bar follows
the recording rather than an internal timer.

The **Pico plays / You play** toggle decides who performs the melody:

- **You play** — the Pico stays quiet until you press a button. This is the
  play-along mode.
- **Pico plays** — the site drives the instrument through the melody itself,
  useful for checking a chart or for a hands-free demo.

A track with no chart just plays, and you improvise over it.

## A note on copyright

Commercial recordings are fine for rehearsing privately. Before committing
one to a shared or public repository, or using it in a graded performance,
check what your event actually allows.
