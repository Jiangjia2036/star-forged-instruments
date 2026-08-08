import * as THREE from "three";
import { useRef, useEffect } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function Visualizer({ analyzer }) {
  const mountRef = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background =
      new THREE.Color(0x000000);

    cameraRef.current =
      new THREE.PerspectiveCamera(
        75,
        width / height,
        0.1,
        1000
      );

    cameraRef.current.position.set(0, 1, 6);

    rendererRef.current =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

    rendererRef.current.setPixelRatio(
      window.devicePixelRatio
    );

    rendererRef.current.setSize(
      width,
      height
    );

    mountRef.current.appendChild(
      rendererRef.current.domElement
    );

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        2
      );

    sceneRef.current.add(ambientLight);

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

    sceneRef.current.add(
      directionalLight
    );

    const starGeometry =
      new THREE.BufferGeometry();

    const starVertices = [];

    for (let i = 0; i < 1000; i++) {
      starVertices.push(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
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

    const stars = new THREE.Points(
      starGeometry,
      starMaterial
    );

    sceneRef.current.add(stars);

    const loader = new GLTFLoader();

    let ufo = null;

    loader.load(
      "/models/ufo.glb",

      (gltf) => {
        ufo = gltf.scene;

        ufo.scale.set(
          0.02,
          0.02,
          0.02
        );

        ufo.position.set(
          0,
          0,
          -30
        );

        sceneRef.current.add(ufo);
      },

      undefined,

      (error) => {
        console.log(error);
      }
    );

    const clock = new THREE.Clock();

    // -------------------------
    // UFO Entrance Animation
    // -------------------------

    const entranceDuration = 4.0;

    let entranceStartTime = null;

    let entranceComplete = false;

    function animate() {
      requestAnimationFrame(animate);

      const t =
        clock.getElapsedTime();

      // -------------------------
      // Audio Analysis
      // -------------------------

      let rms = 0;

      if (analyzer?.current) {
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

        rms = Math.sqrt(
          sum / values.length
        );
      }

      // -------------------------
      // Stars
      // -------------------------

      const starSpeed =
        0.0005 + rms * 0.003;

      stars.rotation.y +=
        starSpeed;

      stars.rotation.x +=
        0.0002 + rms * 0.001;

      // -------------------------
      // UFO
      // -------------------------

      if (ufo) {

        // Start the entrance timer
        if (entranceStartTime === null) {
          entranceStartTime = t;
        }

        const entranceElapsed =
          t - entranceStartTime;

        // -------------------------
        // UFO Entrance
        // -------------------------

        if (!entranceComplete) {

          let progress =
            entranceElapsed /
            entranceDuration;

          if (progress >= 1) {
            progress = 1;
            entranceComplete = true;
          }

          const easedProgress =
            1 -
            Math.pow(
              1 - progress,
              3
            );

          const startZ = -30;
          const endZ = 0;

          ufo.position.z =
            startZ +
            (endZ - startZ) *
              easedProgress;

          ufo.position.y =
            Math.sin(
              progress * Math.PI
            ) * 0.4;

          ufo.rotation.y +=
            0.006;

          ufo.rotation.z =
            Math.sin(t * 0.8) *
            0.08;
        }

        // -------------------------
        // Normal UFO Mode
        // -------------------------

        else {

          // -------------------------
          // UFO approaching camera
          // -------------------------

          const targetZ =
            rms * 3;

          ufo.position.z +=
            (targetZ - ufo.position.z) *
            0.08;

          // -------------------------
          // UFO floating
          // -------------------------

          const audioMovement =
            rms * 2;

          ufo.position.y =
            Math.sin(t * 0.8) * 0.15 +
            audioMovement;

          // -------------------------
          // UFO rotation
          // -------------------------

          ufo.rotation.z =
            Math.sin(t * 0.6) *
            0.06;

          ufo.rotation.y +=
            0.002 + rms * 0.01;

          // -------------------------
          // UFO Color
          // -------------------------

          const color = new THREE.Color();

          const hue =
            (0.55 + rms * 0.8) % 1;

          color.setHSL(
            hue,
            0.85,
            0.55
          );

          ufo.traverse((child) => {
            if (
              child.isMesh &&
              child.material
            ) {
              if (
                Array.isArray(
                  child.material
                )
              ) {
                child.material.forEach(
                  (material) => {
                    if (material.color) {
                      material.color.lerp(
                        color,
                        0.08
                      );
                    }
                  }
                );
              } else {
                if (
                  child.material.color
                ) {
                  child.material.color.lerp(
                    color,
                    0.08
                  );
                }
              }
            }
          });
        }
      }

      rendererRef.current.render(
        sceneRef.current,
        cameraRef.current
      );
    }

    animate();

    // -------------------------
    // Resize
    // -------------------------

    function onWindowResize() {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      cameraRef.current.aspect =
        width / height;

      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(
        width,
        height
      );
    }

    window.addEventListener(
      "resize",
      onWindowResize
    );

    // -------------------------
    // Cleanup
    // -------------------------

    return () => {
      window.removeEventListener(
        "resize",
        onWindowResize
      );

      starGeometry.dispose();
      starMaterial.dispose();

      rendererRef.current.dispose();

      if (
        mountRef.current &&
        rendererRef.current.domElement
          .parentNode
      ) {
        mountRef.current.removeChild(
          rendererRef.current.domElement
        );
      }
    };
  }, [analyzer]);

  return (
    <div
      ref={mountRef}
      className="visualizer"
    />
  );
}

export default Visualizer;