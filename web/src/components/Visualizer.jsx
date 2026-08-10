import * as THREE from "three";
import { useRef, useEffect } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function Visualizer({
  analyzer,
  currentPage,
  activeNotes = [],
  musicVolume = 0.1
}) {
  const mountRef =
    useRef(null);

  const notesRef =
    useRef([]);

  const browserNotesRef =
    useRef([]);

  const visualHeldNotesRef =
    useRef([]);

  const musicVolumeRef =
    useRef(musicVolume);

  notesRef.current =
    activeNotes;

  musicVolumeRef.current =
    musicVolume;

  const sceneRef =
    useRef(null);

  const cameraRef =
    useRef(null);

  const rendererRef =
    useRef(null);

  const currentPageRef =
    useRef(currentPage);

  const transitionRef =
    useRef(null);

  const ufoAwayRef =
    useRef(false);

  const photoStarRef =
    useRef(null);

  useEffect(() => {
    if (
      currentPageRef.current ===
      currentPage
    ) {
      return;
    }

    console.log(
      "Page changed:",
      currentPageRef.current,
      "→",
      currentPage
    );

    if (
      currentPageRef.current ===
        "instrument" &&
      currentPage === "team"
    ) {
      transitionRef.current = {
        type: "fly-away",
        startTime:
          performance.now(),
      };

      ufoAwayRef.current =
        false;
    }

    if (
      currentPageRef.current ===
        "team" &&
      currentPage ===
        "instrument"
    ) {
      transitionRef.current = {
        type: "fly-in",
        startTime:
          performance.now(),
      };

      ufoAwayRef.current =
        true;
    }

    currentPageRef.current =
      currentPage;
  }, [currentPage]);

  useEffect(() => {
    const handleBrowserNoteOn =
      (event) => {
        const note =
          event.detail?.note;

        if (!note) return;

        if (
          !browserNotesRef.current.includes(
            note
          )
        ) {
          browserNotesRef.current = [
            ...browserNotesRef.current,
            note,
          ];
        }
      };

    const handleBrowserNoteOff =
      (event) => {
        const note =
          event.detail?.note;

        if (!note) return;

        browserNotesRef.current =
          browserNotesRef.current.filter(
            (n) => n !== note
          );
      };

    window.addEventListener(
      "star-forged-note-on",
      handleBrowserNoteOn
    );

    window.addEventListener(
      "star-forged-note-off",
      handleBrowserNoteOff
    );

    const handleBeamNoteOn =
      () => {
      };

    window.addEventListener(
      "star-forged-note-on",
      handleBeamNoteOn
    );

    const width =
      window.innerWidth;

    const height =
      window.innerHeight;

    const scene =
      new THREE.Scene();

    scene.background =
      new THREE.Color(
        0x000000
      );

    sceneRef.current =
      scene;

    const camera =
      new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
      );

    camera.position.set(
      0,
      1,
      6
    );

    cameraRef.current =
      camera;

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

    renderer.setPixelRatio(
      window.devicePixelRatio
    );

    renderer.setSize(
      width,
      height
    );

    renderer.domElement.style.position =
      "fixed";

    renderer.domElement.style.top =
      "0";

    renderer.domElement.style.left =
      "0";

    renderer.domElement.style.width =
      "100%";

    renderer.domElement.style.height =
      "100%";

    renderer.domElement.style.pointerEvents =
      "none";

    renderer.domElement.style.zIndex =
      "0";

    rendererRef.current =
      renderer;

    mountRef.current.appendChild(
      renderer.domElement
    );

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        2
      );

    scene.add(
      ambientLight
    );

    const directionalLight =
      new THREE.DirectionalLight(
        0xffffff,
        3
      );

    directionalLight.position.set(
      5,
      5,
      5
    );

    scene.add(
      directionalLight
    );

    const starGeometry =
      new THREE.BufferGeometry();

    const starVertices = [];

    for (
      let i = 0;
      i < 1000;
      i++
    ) {
      starVertices.push(
        (Math.random() - 0.5) *
          200,
        (Math.random() - 0.5) *
          200,
        (Math.random() - 0.5) *
          200
      );
    }

    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        starVertices,
        3
      )
    );

    const starMaterial =
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
      });

    const starGroup =
      new THREE.Group();

    scene.add(
      starGroup
    );

    const stars =
      new THREE.Points(
        starGeometry,
        starMaterial
      );

    starGroup.add(
      stars
    );

    const photoStarLoader =
      new THREE.TextureLoader();

    photoStarLoader.load(
      "/photos/JamesTao.png",

      (texture) => {
        console.log(
          "James Tao photo loaded!"
        );

        const photoStarMaterial =
          new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
          });

        const photoStar =
          new THREE.Sprite(
            photoStarMaterial
          );

        photoStar.scale.set(
            0.45,
            0.45,
            1
        );

        photoStar.position.set(
          -5,
          2.5,
          -8
        );

        photoStar.visible =
          true;

        starGroup.add(
          photoStar
        );

        photoStarRef.current =
          photoStar;

        console.log(
          "James Tao star added to scene"
        );
      },

      undefined,

      (error) => {
        console.error(
          "James Tao photo failed to load:",
          error
        );
      }
    );

    const loader =
      new GLTFLoader();

    let ufo = null;

    let ufoBeam = null;
    let ufoBeamGlow = null;
    let ufoBeamMaterial = null;
    let ufoBeamGlowMaterial = null;

    let forwardBeam = null;
    let forwardBeamMaterial = null;
    let forwardBeamGlow = null;
    let forwardBeamGlowMaterial = null;

    let randomUfoEffect = "none";
    let randomUfoEffectStart = 0;

    let starRushIntensity = 0;

    let ufoBasePosition =
      new THREE.Vector3(0, 0, -30);

    const ufoBaseScale =
      new THREE.Vector3(
        0.02,
        0.02,
        0.02
      );

    let laserAudioContext = null;

    let forwardBeamDirection =
      new THREE.Vector3(0, 0, -1);
    let previousForwardBeamDirection =
      new THREE.Vector3(0, 0, -1);

    loader.load(
      "/models/ufo.glb",

      (gltf) => {
        ufo =
          gltf.scene;

        ufo.scale.copy(
          ufoBaseScale
        );

        ufo.position.set(
          0,
          0,
          -30
        );

        scene.add(ufo);

        const beamGeometry =
          new THREE.ConeGeometry(
            82,
            190,
            64,
            1,
            true
          );

        ufoBeamMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x63d8ff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending:
              THREE.AdditiveBlending,
          });

        ufoBeam =
          new THREE.Mesh(
            beamGeometry,
            ufoBeamMaterial
          );

        ufoBeam.position.set(
          0,
          -115,
          0
        );

        ufo.add(ufoBeam);

        const glowGeometry =
          new THREE.ConeGeometry(
            96,
            194,
            48,
            1,
            true
          );

        ufoBeamGlowMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x63d8ff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending:
              THREE.AdditiveBlending,
          });

        ufoBeamGlow =
          new THREE.Mesh(
            glowGeometry,
            ufoBeamGlowMaterial
          );

        ufoBeamGlow.position.set(
          0,
          -116,
          0
        );

        ufo.add(ufoBeamGlow);

        const forwardBeamLength = 1500;

        const forwardGeometry =
          new THREE.CylinderGeometry(
            0.75,
            0.75,
            forwardBeamLength,
            32,
            1,
            true
          );

        forwardBeamMaterial =
          new THREE.MeshBasicMaterial({
            color: 0xeaf4ff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending:
              THREE.AdditiveBlending,
          });

        forwardBeam =
          new THREE.Mesh(
            forwardGeometry,
            forwardBeamMaterial
          );

        ufo.add(forwardBeam);

        const forwardGlowGeometry =
          new THREE.CylinderGeometry(
            2.8,
            2.8,
            forwardBeamLength,
            32,
            1,
            true
          );

        forwardBeamGlowMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x9fb7d1,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending:
              THREE.AdditiveBlending,
          });

        forwardBeamGlow =
          new THREE.Mesh(
            forwardGlowGeometry,
            forwardBeamGlowMaterial
          );

        ufo.add(forwardBeamGlow);

        console.log(
          "UFO loaded"
        );
      },

      undefined,

      (error) => {
        console.log(
          "UFO loading error:",
          error
        );
      }
    );

    const clock =
      new THREE.Clock();

    const entranceDuration =
      4.0;

    let entranceStartTime =
      null;

    let entranceComplete =
      false;

    let animationFrameId;
    let lastFrameTime = 0;
    let smoothedHeld = 0;

    function playLaserSound() {
      try {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;

        if (!AudioCtx) return;

        if (!laserAudioContext) {
          laserAudioContext =
            new AudioCtx();
        }

        const ctx =
          laserAudioContext;

        const play = () => {
          const start =
            ctx.currentTime;

          const osc =
            ctx.createOscillator();

          const gain =
            ctx.createGain();

          const filter =
            ctx.createBiquadFilter();

          osc.type =
            "sawtooth";

          osc.frequency.setValueAtTime(
            1250,
            start
          );

          osc.frequency.exponentialRampToValueAtTime(
            170,
            start + 0.22
          );

          filter.type =
            "lowpass";

          filter.frequency.setValueAtTime(
            4200,
            start
          );

          gain.gain.setValueAtTime(
            0.0001,
            start
          );

          gain.gain.exponentialRampToValueAtTime(
            0.16,
            start + 0.012
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + 0.24
          );

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);

          osc.start(start);
          osc.stop(start + 0.25);

          const click =
            ctx.createOscillator();

          const clickGain =
            ctx.createGain();

          click.type =
            "square";

          click.frequency.setValueAtTime(
            2600,
            start
          );

          clickGain.gain.setValueAtTime(
            0.0001,
            start
          );

          clickGain.gain.exponentialRampToValueAtTime(
            0.045,
            start + 0.004
          );

          clickGain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + 0.045
          );

          click.connect(clickGain);
          clickGain.connect(ctx.destination);

          click.start(start);
          click.stop(start + 0.05);
        };

        if (
          ctx.state ===
          "suspended"
        ) {
          ctx.resume()
            .then(play)
            .catch(() => {
            });
        } else {
          play();
        }
      } catch (error) {
        console.warn(
          "Laser sound unavailable:",
          error
        );
      }
    }

    function playRushSound(direction = "toward") {
      try {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!laserAudioContext) {
          laserAudioContext = new AudioCtx();
        }

        const ctx = laserAudioContext;
        const start = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        oscillator.type = "sawtooth";

        const startFreq =
          direction === "toward" ? 180 : 420;
        const endFreq =
          direction === "toward" ? 620 : 95;

        oscillator.frequency.setValueAtTime(
          startFreq, start
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          endFreq, start + 0.42
        );

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(
          1800, start
        );
        filter.frequency.exponentialRampToValueAtTime(
          700, start + 0.42
        );

        gain.gain.setValueAtTime(
          0.0001, start
        );
        gain.gain.exponentialRampToValueAtTime(
          0.11, start + 0.025
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001, start + 0.46
        );

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.48);
      } catch (error) {
        console.warn("Rush sound unavailable:", error);
      }
    }

    function playJumpSound() {
      try {
        const AudioCtx =
          window.AudioContext ||
          window.webkitAudioContext;
        if (!AudioCtx) return;

        if (!laserAudioContext) {
          laserAudioContext = new AudioCtx();
        }

        const ctx = laserAudioContext;
        const start = ctx.currentTime;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          180, start
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          780, start + 0.18
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          420, start + 0.32
        );

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(
          2600, start
        );

        gain.gain.setValueAtTime(
          0.0001, start
        );
        gain.gain.exponentialRampToValueAtTime(
          0.13, start + 0.015
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001, start + 0.34
        );

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.36);
      } catch (error) {
        console.warn("Jump sound unavailable:", error);
      }
    }

    function chooseRandomUfoEffect() {
      const choices = [
        "laser",
        "beam",
        "jump",
      ];

      randomUfoEffect =
        choices[
          Math.floor(
            Math.random() *
              choices.length
          )
        ];

      randomUfoEffectStart =
        performance.now();

      starRushIntensity = 0;

      if (ufoBeamMaterial) {
        ufoBeamMaterial.opacity = 0;
      }

      if (ufoBeamGlowMaterial) {
        ufoBeamGlowMaterial.opacity = 0;
      }

      if (forwardBeamMaterial) {
        forwardBeamMaterial.opacity = 0;
      }

      if (forwardBeamGlowMaterial) {
        forwardBeamGlowMaterial.opacity = 0;
      }

      if (
        randomUfoEffect ===
        "laser"
      ) {
        chooseRandomForwardBeamDirection();
        playLaserSound();
      }

      if (
        randomUfoEffect ===
        "jump"
      ) {
        playJumpSound();
      }

    }

    function updateVolumeUfoDistance() {
      if (!ufo) return;

      const volume = Math.max(
        0,
        Math.min(
          1,
          Number(musicVolumeRef.current) || 0
        )
      );

      const baseVolume = 0.1;
      const control =
        (volume - baseVolume) /
        (1 - baseVolume);

      const clampedControl =
        Math.max(
          -1,
          Math.min(1, control)
        );

      const distance =
        clampedControl * 22;

      ufo.position.z =
        ufoBasePosition.z -
        distance;

      const baseScale = 0.65;

      const scale =
        baseScale -
        clampedControl * 0.35;

      const safeScale =
        Math.max(
          0.35,
          Math.min(1.05, scale)
        );

      ufo.scale.set(
        ufoBaseScale.x * safeScale,
        ufoBaseScale.y * safeScale,
        ufoBaseScale.z * safeScale
      );
    }

    function updateUfoJump(time) {
      if (!ufo) return;

      if (
        randomUfoEffect !==
        "jump"
      ) {
        return;
      }

      const elapsed =
        time -
        randomUfoEffectStart;

      const duration = 700;

      const progress =
        Math.min(
          1,
          elapsed / duration
        );

      const jumpHeight =
        Math.sin(
          progress * Math.PI
        ) * 2.8;

      ufo.position.x =
        ufoBasePosition.x;

      ufo.position.y =
        ufoBasePosition.y +
        jumpHeight;

      ufo.position.z =
        ufoBasePosition.z;

      if (
        progress >= 1
      ) {
        randomUfoEffect =
          "none";

        ufo.position.copy(
          ufoBasePosition
        );
      }
    }

    function beamColorForNotes(notes) {
      if (!notes || notes.length === 0) {
        return new THREE.Color(0x63d8ff);
      }

      const noteHues = {
        C: 0.57,
        D: 0.76,
        E: 0.92,
        F: 0.04,
        G: 0.12,
        A: 0.27,
        B: 0.47,
      };

      let hue = 0;

      notes.forEach((note) => {
        hue +=
          noteHues[note[0]] ??
          0.57;
      });

      hue /= notes.length;

      return new THREE.Color().setHSL(
        hue,
        0.85,
        0.62
      );
    }

    function updateUfoBeam(
      rms,
      held,
      time
    ) {
      if (
        !ufoBeam ||
        !ufoBeamMaterial ||
        !ufoBeamGlow ||
        !ufoBeamGlowMaterial
      ) {
        return;
      }

      if (
        randomUfoEffect !==
        "beam"
      ) {
        ufoBeamMaterial.opacity +=
          (0 -
            ufoBeamMaterial.opacity) *
          0.22;

        ufoBeamGlowMaterial.opacity +=
          (0 -
            ufoBeamGlowMaterial.opacity) *
          0.18;

        return;
      }

      const elapsed =
        time -
        randomUfoEffectStart;

      const noteActivity =
        Math.max(
          0,
          1 -
            elapsed / 900
        );

      const audioActivity =
        Math.min(
          1,
          rms * 3
        );

      const activity =
        Math.min(
          1,
          noteActivity * 1.15 +
            audioActivity * 0.25
        );

      const pulse =
        0.92 +
        Math.sin(time * 0.006) *
          0.08;

      const targetOpacity =
        activity > 0.01
          ? Math.min(
              0.62,
              (0.18 +
                activity * 0.38) *
                pulse
            )
          : 0;

      ufoBeamMaterial.opacity +=
        (targetOpacity -
          ufoBeamMaterial.opacity) *
        0.18;

      ufoBeamGlowMaterial.opacity +=
        (targetOpacity * 0.28 -
          ufoBeamGlowMaterial.opacity) *
        0.12;

      const visualNotes = [
        ...new Set([
          ...notesRef.current,
          ...browserNotesRef.current,
        ]),
      ];

      const color =
        beamColorForNotes(
          visualNotes
        );

      ufoBeamMaterial.color.lerp(
        color,
        0.12
      );

      ufoBeamGlowMaterial.color.lerp(
        color,
        0.10
      );

      const beamScale =
        0.94 +
        activity * 0.12 +
        Math.sin(time * 0.004) *
          0.018;

      ufoBeam.scale.x =
        beamScale;
      ufoBeam.scale.z =
        beamScale;

      ufoBeamGlow.scale.x =
        beamScale * 1.05;
      ufoBeamGlow.scale.z =
        beamScale * 1.05;
    }

    function chooseRandomForwardBeamDirection() {
      let direction;
      let attempts = 0;

      do {
        direction = new THREE.Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        ).normalize();

        attempts += 1;
      } while (
        direction.dot(
          previousForwardBeamDirection
        ) > 0.55 &&
        attempts < 20
      );

      previousForwardBeamDirection.copy(
        direction
      );

      forwardBeamDirection.copy(
        direction
      );

      if (
        forwardBeam &&
        forwardBeamGlow
      ) {
        const axis =
          new THREE.Vector3(
            0,
            1,
            0
          );

        const quaternion =
          new THREE.Quaternion();

        quaternion.setFromUnitVectors(
          axis,
          forwardBeamDirection
        );

        forwardBeam.quaternion.copy(
          quaternion
        );

        forwardBeamGlow.quaternion.copy(
          quaternion
        );

        const center =
          forwardBeamDirection
            .clone()
            .multiplyScalar(
              1500 / 2
            );

        forwardBeam.position.copy(
          center
        );

        forwardBeamGlow.position.copy(
          center
        );
      }
    }

    function updateForwardBeam(
      rms,
      held,
      time
    ) {
      if (
        !forwardBeam ||
        !forwardBeamMaterial ||
        !forwardBeamGlow ||
        !forwardBeamGlowMaterial
      ) {
        return;
      }

      if (
        randomUfoEffect !==
        "laser"
      ) {
        forwardBeamMaterial.opacity +=
          (0 -
            forwardBeamMaterial.opacity) *
          0.24;

        forwardBeamGlowMaterial.opacity +=
          (0 -
            forwardBeamGlowMaterial.opacity) *
          0.18;

        return;
      }

      const elapsed =
        time -
        randomUfoEffectStart;

      const noteActivity =
        Math.max(
          0,
          1 -
            elapsed / 850
        );

      const audioActivity =
        Math.min(
          1,
          rms * 2.5
        );

      const activity =
        Math.min(
          1,
          noteActivity * 1.1 +
            audioActivity * 0.18
        );

      const pulse =
        0.92 +
        Math.sin(time * 0.008) *
          0.08;

      const targetOpacity =
        activity > 0.01
          ? Math.min(
              0.72,
              (0.20 +
                activity * 0.46) *
                pulse
            )
          : 0;

      forwardBeamMaterial.opacity +=
        (targetOpacity -
          forwardBeamMaterial.opacity) *
        0.20;

      forwardBeamGlowMaterial.opacity +=
        (targetOpacity * 0.22 -
          forwardBeamGlowMaterial.opacity) *
        0.14;

      const thickness =
        0.94 +
        activity * 0.12 +
        Math.sin(time * 0.005) *
          0.025;

      forwardBeam.scale.x =
        thickness;
      forwardBeam.scale.z =
        thickness;

      forwardBeamGlow.scale.x =
        thickness * 1.05;
      forwardBeamGlow.scale.z =
        thickness * 1.05;
    }

    function animate() {
      animationFrameId =
        requestAnimationFrame(
          animate
        );

      const t =
        clock.getElapsedTime();

      const frameSeconds =
        Math.min(Math.max(t - lastFrameTime, 0), 0.05);
      const frameScale = frameSeconds * 60;
      lastFrameTime = t;

      let rms = 0;

      if (
        analyzer?.current
      ) {
        const values =
          analyzer.current.getValue();

        let sum = 0;

        for (
          let i = 0;
          i < values.length;
          i++
        ) {
          sum +=
            values[i] *
            values[i];
        }

        rms =
          Math.sqrt(
            sum /
              values.length
          );
      }

      const visualHeldNotes = [
        ...new Set([
          ...notesRef.current,
          ...browserNotesRef.current,
        ]),
      ];

      const previousVisualNotes =
        visualHeldNotesRef.current ?? [];

      const hasNewVisualNote =
        visualHeldNotes.some(
          (note) =>
            !previousVisualNotes.includes(
              note
            )
        );

      if (hasNewVisualNote) {
        chooseRandomUfoEffect();
      }

      visualHeldNotesRef.current =
        visualHeldNotes;

      const heldTarget =
        visualHeldNotes.length;

      const heldBlend =
        1 - Math.exp(
          -frameSeconds * 20
        );
      smoothedHeld += (heldTarget - smoothedHeld) * heldBlend;
      const held = smoothedHeld;

      updateUfoBeam(
        rms,
        held,
        performance.now()
      );

      updateForwardBeam(
        rms,
        held,
        performance.now()
      );

      updateUfoJump(
        performance.now()
      );

      const starSpeed =
        0.0005 +
        rms * 0.003 +
        held * 0.0016;

      starGroup.rotation.y +=
        starSpeed * frameScale;

      starGroup.rotation.x +=
        (0.0002 +
          rms * 0.001 +
          held * 0.0006) *
        frameScale;

      if (
        photoStarRef.current
      ) {
        const photoStar =
          photoStarRef.current;

        photoStar.visible =
          true;

        const twinkle =
          0.8 +
          Math.sin(
            t * 1.8
          ) * 0.2;

        photoStar.material.opacity =
          twinkle;
      }

      if (ufo) {
        if (
          !entranceComplete &&
          transitionRef.current ===
            null
        ) {
          if (
            entranceStartTime ===
            null
          ) {
            entranceStartTime =
              t;
          }

          const elapsed =
            t -
            entranceStartTime;

          let progress =
            elapsed /
            entranceDuration;

          if (
            progress >= 1
          ) {
            progress = 1;

            entranceComplete =
              true;
          }

          const eased =
            1 -
            Math.pow(
              1 - progress,
              3
            );

          const startZ =
            -30;

          const endZ =
            0;

          ufo.position.z =
            startZ +
            (endZ - startZ) *
              eased;

          ufo.position.y =
            Math.sin(
              progress *
                Math.PI
            ) *
            0.4;

          ufo.rotation.y +=
            0.006 * frameScale;

          ufo.rotation.z =
            Math.sin(
              t * 0.8
            ) * 0.08;
        }

        else if (
          transitionRef.current
        ) {
          const transition =
            transitionRef.current;

          const elapsed =
            (performance.now() -
              transition.startTime) /
            1000;

          const duration =
            1.8;

          let progress =
            elapsed /
            duration;

          if (
            progress >= 1
          ) {
            progress = 1;
          }

          const eased =
            1 -
            Math.pow(
              1 - progress,
              3
            );

          if (
            transition.type ===
            "fly-away"
          ) {
            const startY =
              0;

            const endY =
              8;

            const startZ =
              0;

            const endZ =
              1;

            ufo.position.y =
              startY +
              (endY - startY) *
                eased;

            ufo.position.z =
              startZ +
              (endZ - startZ) *
                eased;

            ufo.rotation.x =
              eased * 0.45;

            ufo.rotation.z =
              Math.sin(
                t * 5
              ) *
                0.08 +
              eased * 0.2;

            ufo.rotation.y +=
              0.02 * frameScale;

            starGroup.rotation.y +=
              0.002 * frameScale;

            if (
              progress >= 1
            ) {
              transitionRef.current =
                null;

              ufoAwayRef.current =
                true;

              ufo.position.set(
                0,
                8,
                1
              );

              ufo.rotation.x =
                0.45;
            }
          }

          if (
            transition.type ===
            "fly-in"
          ) {
            const startY =
              8;

            const endY =
              0;

            const startZ =
              1;

            const endZ =
              0;

            ufo.position.y =
              startY +
              (endY - startY) *
                eased;

            ufo.position.z =
              startZ +
              (endZ - startZ) *
                eased;

            ufo.rotation.x =
              (1 - eased) *
              0.45;

            ufo.rotation.z =
              Math.sin(
                t * 5
              ) * 0.08;

            ufo.rotation.y +=
              0.02 * frameScale;

            starGroup.rotation.y +=
              0.002 * frameScale;

            if (
              progress >= 1
            ) {
              transitionRef.current =
                null;

              ufoAwayRef.current =
                false;

              ufo.position.set(
                0,
                0,
                0
              );

              ufo.rotation.x =
                0;
            }
          }
        }

        else if (
          ufoAwayRef.current
        ) {
          ufo.position.set(
            0,
            8,
            1
          );

          ufo.rotation.x =
            0.45;

          ufo.rotation.y +=
            0.002 * frameScale;
        }

        else {
          const audioMovement =
            rms * 2 +
            Math.min(1, held) * 0.45;

          ufoBasePosition.x =
            0;

          ufoBasePosition.y = 0.5 +
            Math.sin(
              t * 0.8
            ) *
              0.15 +
            audioMovement;

          ufoBasePosition.z =
            0;

          if (
            randomUfoEffect !==
              "jump"
          ) {
            ufo.position.x =
              ufoBasePosition.x;

            ufo.position.y =
              ufoBasePosition.y;

            ufo.position.z =
              ufoBasePosition.z;
          }

          if (
            randomUfoEffect !==
              "jump"
          ) {
            updateVolumeUfoDistance();
          }

          ufo.rotation.x *=
            Math.pow(0.95, frameScale);

          ufo.rotation.z =
            Math.sin(
              t * 0.6
            ) * 0.06;

          ufo.rotation.y +=
            (0.002 +
              rms * 0.01 +
              held * 0.02) *
            frameScale;

        }
      }

      renderer.render(
        scene,
        camera
      );
    }

    animate();

    function onWindowResize() {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(
        width,
        height
      );
    }

    window.addEventListener(
      "resize",
      onWindowResize
    );

    return () => {
      window.removeEventListener(
        "resize",
        onWindowResize
      );

      window.removeEventListener(
        "star-forged-note-on",
        handleBrowserNoteOn
      );

      window.removeEventListener(
        "star-forged-note-off",
        handleBrowserNoteOff
      );

      window.removeEventListener(
        "star-forged-note-on",
        handleBeamNoteOn
      );

      browserNotesRef.current =
        [];

      visualHeldNotesRef.current =
        [];

      cancelAnimationFrame(
        animationFrameId
      );

      starGeometry.dispose();
      starMaterial.dispose();

      if (ufoBeam) {
        ufoBeam.geometry.dispose();
      }

      if (ufoBeamMaterial) {
        ufoBeamMaterial.dispose();
      }

      if (ufoBeamGlow) {
        ufoBeamGlow.geometry.dispose();
      }

      if (ufoBeamGlowMaterial) {
        ufoBeamGlowMaterial.dispose();
      }

      if (forwardBeam) {
        forwardBeam.geometry.dispose();
      }

      if (forwardBeamMaterial) {
        forwardBeamMaterial.dispose();
      }

      if (forwardBeamGlow) {
        forwardBeamGlow.geometry.dispose();
      }

      if (forwardBeamGlowMaterial) {
        forwardBeamGlowMaterial.dispose();
      }

      if (laserAudioContext) {
        laserAudioContext.close();
        laserAudioContext =
          null;
      }

      if (stars) {
        stars.scale.set(
          1,
          1,
          1
        );
      }

      if (starMaterial) {
        starMaterial.size = 0.5;
      }

      if (
        photoStarRef.current
      ) {
        photoStarRef.current.material.map?.dispose();
        photoStarRef.current.material.dispose();
      }

      renderer.dispose();

      if (
        mountRef.current &&
        renderer.domElement
          .parentNode
      ) {
        mountRef.current.removeChild(
          renderer.domElement
        );
      }
    };
  }, [analyzer]);

  return (
    <div
      ref={mountRef}
      className="visualizer-background"
    />
  );
}

export default Visualizer;