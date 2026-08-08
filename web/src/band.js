// Band and instrument copy for the site.
//
// Edit this file rather than the components. Swap the placeholder text for
// your own, and drop images in web/public/images.

export const BAND = {
  name: "Star Forged",
  tagline: "Synth-forged signals from somewhere past the asteroid belt.",

  // Put a photo at web/public/images/band.jpg and it appears automatically.
  photo: "/images/band.jpg",

  // ===== EDIT THE BAND DESCRIPTION HERE =====
  // blurb:
  //   "We build our own instruments and play them badly on purpose. " +
  //   "Everything you hear on this page came out of a Raspberry Pi Pico " +
  //   "we soldered ourselves.",
};

export const MEMBERS = [
  // ===== EDIT NAMES, BIOS, PHOTOS, AND LINKEDIN URLS HERE =====
  // Leave linkedin empty until a profile URL is ready. The Band page will
  // show a highlighted placeholder instead of creating a broken link.
  {
    name: "Member One",
    role: "Instrument design / firmware",
    photo: "/images/member1.jpg",
    bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
  {
    name: "Member Two",
    role: "Web / visuals",
    photo: "/images/member2.jpg",
    bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
  {
    name: "Member Three",
    role: "Chassis / fabrication",
    photo: "/images/member3.jpg",
    bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
];

// Sound profiles the instrument can produce. These mirror what main.py
// actually implements, so keep them in sync if you change the firmware.
export const SOUND_PROFILES = [
  {
    name: "Sine",
    kind: "Timbre",
    detail:
      "The default voice. A pure tone with no harmonics, read from a " +
      "2048 entry wave table by a phase accumulator.",
  },
  {
    name: "Saw",
    kind: "Timbre — Warp",
    detail:
      "Every harmonic present, falling off gently. Bright and buzzy, the " +
      "closest this instrument gets to a lead guitar.",
  },
  {
    name: "Square",
    kind: "Timbre — Chorus",
    detail:
      "Odd harmonics only, which gives it a hollow woodwind character. " +
      "Trimmed in level so switching voices does not jump in volume.",
  },
];

export const EFFECTS = [
  {
    name: "Echo",
    control: "Toggle switch (GP19)",
    detail:
      "A 0.3 second delay line with the tail halved on each pass, so it " +
      "decays instead of running away. The buffer is cleared while the " +
      "switch is off, so flipping it on never replays stale audio.",
  },
  {
    name: "Wah",
    control: "Flex sensor (ADC26)",
    detail:
      "A one pole low pass filter whose cutoff follows how far the strip " +
      "is bent, sweeping from roughly 430 Hz to 3.5 kHz. Bending the " +
      "sensor while holding a note gives the classic vowel sweep.",
  },
  {
    name: "Tremolo",
    control: "Chorus + Depth slider",
    detail:
      "An LFO shaping the output level a few times a second. Computed once " +
      "per audio chunk rather than per sample, which is plenty smooth for " +
      "an LFO and costs the render loop nothing.",
  },
  {
    name: "Vibrato",
    control: "Warp + Depth slider",
    detail:
      "The same LFO idea applied to pitch instead of volume, nudging the " +
      "oscillator's phase increment by up to a semitone either side. " +
      "Modelled on how CircuitPython's synthio drives Note.bend.",
  },
];

export const DESIGN_NOTES = [
  {
    title: "Why a phase accumulator",
    body:
      "The first build pre-computed a full wave table per note, which meant " +
      "retuning took seconds and ate 132 KB of RAM. Reading one shared table " +
      "with a fixed point phase increment made any frequency instant and cut " +
      "the memory to 4 KB, so the website can change key mid-song.",
  },
  {
    title: "Splitting the audio loop",
    body:
      "The whole DSP engine used to be compiled with @micropython.native. " +
      "Native code never hands control back to the interpreter, so USB " +
      "serial was starved and the port could not even be opened. Only the " +
      "per-sample inner loop is native now; the outer loop is ordinary " +
      "Python and services USB about 88 times a second.",
  },
  {
    title: "One speaker, two sources",
    body:
      "Backing tracks stream from the Pico's own flash as 22 kHz mono WAV " +
      "and are mixed into the same I2S output as the oscillators. The track " +
      "is added after the filter and echo, so the recording stays clean " +
      "while your playing keeps the wah sweep and the delay tail.",
  },
  {
    title: "Borrowing from CircuitPython",
    body:
      "Gating an oscillator on and off leaves a step in the waveform, which " +
      "a speaker reproduces as a click on every press. Adopting the ADSR " +
      "envelope from CircuitPython's synthio removed that, and gave the " +
      "instrument an attack and a tail so it sounds played rather than " +
      "switched. synthio recalculates its LFOs every 256 samples; a chunk " +
      "here is 250, so the same trick works at no cost.",
  },
  {
    title: "Aesthetic",
    body:
      "Cold starfield, warm keys. The instrument is meant to look like " +
      "salvaged equipment: exposed wiring routed deliberately, a chassis " +
      "that hides the electronics without hiding that it was hand built.",
  },
];
