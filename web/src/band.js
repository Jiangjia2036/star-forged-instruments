import bandPhoto from "./assets/Star Forge Group - Logo.png";

// Band and instrument copy for the site.
//
// Edit this file rather than the components. Swap the placeholder text for
// your own, and drop images in web/public/images.

export const BAND = {
  name: "Star Forged",
  tagline: "Synth-forged signals from somewhere past the asteroid belt.",

  // Images inside src/assets must be imported so Vite includes them.
  photo: bandPhoto,

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
    // role: "Setter",
    // photo: "/images/member1.jpg",
    // bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
  {
    name: "Member Two",
    // role: "Setter",
    // photo: "/images/member2.jpg",
    // bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
  {
    name: "Alejandro Padilla",
    // role: "Setter",
    // photo: "/images/member3.jpg",
    // bio: "Replace this with a sentence or two about yourself.",
    linkedin: "",
  },
  {
    name: "Member",
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
    name: "Sustain",
    control: "Damper switch (GP20)",
    detail:
      "A piano's damper pedal. Holding it swaps the fast 110 ms release for " +
      "a 2.6 second decay, so lifting a key leaves the note ringing and " +
      "successive notes overlap into chords instead of cutting each other " +
      "off. Engaging it on the website does the same thing.",
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
    title: "Why chords needed a limiter",
    body:
      "Voices sum, so two notes are twice the amplitude of one. The first " +
      "build put a pair at 92 percent of full scale with no margin, and any " +
      "attack transient crossed the line. Hard clipping chops the peaks " +
      "flat, which turns a chord into something closer to a square wave and " +
      "sounds harsh. A soft knee limiter compresses the peaks instead: a " +
      "single note passes through untouched, and up to eight together stay " +
      "inside full scale.",
  },
  {
    title: "Aesthetic",
    body:
      "Cold starfield, warm keys. The instrument is meant to look like " +
      "salvaged equipment: exposed wiring routed deliberately, a chassis " +
      "that hides the electronics without hiding that it was hand built.",
  },
];
