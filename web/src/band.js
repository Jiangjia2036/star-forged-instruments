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

// Sound profiles the instrument can produce. These mirror what code.py
// actually implements, so keep them in sync if you change the firmware.
export const SOUND_PROFILES = [
  {
    name: "Sine",
    kind: "Timbre",
    detail:
      "The default voice. A pure tone with no harmonics, read from a " +
      "512-entry wave table by CircuitPython's synthio engine.",
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
      "decays instead of running away. Its dry/wet mix can be controlled " +
      "from either the GP19 switch or the website.",
  },
  {
    name: "Wah",
    control: "Flex sensor (ADC26)",
    detail:
      "A biquad low-pass filter whose cutoff follows how far the strip " +
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
    title: "Why shared wave tables",
    body:
      "The first build pre-computed a full wave table per note, which meant " +
      "retuning took seconds and used too much RAM. Three shared 512-sample " +
      "tables now provide sine, square, and saw timbres while synthio handles " +
      "every note's pitch in compiled code.",
  },
  {
    title: "Audio outside the Python loop",
    body:
      "CircuitPython renders synthio, the mixer, effects, and I2S audio in " +
      "native code. The Python loop only handles button edges, controls, " +
      "track status, and USB messages, so serial input cannot starve audio.",
  },
  {
    title: "One speaker, two sources",
    body:
      "Backing tracks stream from the Pico's own flash as 22.05 kHz mono WAV " +
      "and are mixed into the same I2S output as the oscillators. The track " +
      "is added after the filter and echo, so the recording stays clean " +
      "while your playing keeps the wah sweep and the delay tail.",
  },
  {
    title: "Click-free envelopes",
    body:
      "Gating an oscillator on and off leaves a step in the waveform, which " +
      "a speaker reproduces as a click. synthio's ADSR envelope ramps each " +
      "note in and out, and the sustain switch swaps in a longer release " +
      "without blocking the button or serial event loop.",
  },
  {
    title: "Why chords need headroom",
    body:
      "Voices sum, so the wave tables reserve digital headroom for all three " +
      "buttons. A separate smoothed chord gain protects the I2S amplifier's " +
      "analogue output swing only while multiple notes are held, keeping one " +
      "note loud without letting a chord crackle.",
  },
  {
    title: "Aesthetic",
    body:
      "Cold starfield, warm keys. The instrument is meant to look like " +
      "salvaged equipment: exposed wiring routed deliberately, a chassis " +
      "that hides the electronics without hiding that it was hand built.",
  },
];
