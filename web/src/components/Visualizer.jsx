import * as THREE from "three";
import { useRef, useEffect } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function Visualizer({ analyzer, activeNotes = [] }) {
  const mountRef = useRef(null);

  // Pico notes no longer play through the browser synth, so the analyser sees
  // nothing when the instrument is played. Mirroring the held notes into a ref
  // lets the animation loop react to the instrument itself.
  const notesRef = useRef([]);
  notesRef.current = activeNotes;

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
          0
        );

        sceneRef.current.add(ufo);
      },

      undefined,

      (error) => {
        console.log(error);
      }
    );

    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const t =
        clock.getElapsedTime();

      // How hard the instrument is being played right now
      const held = notesRef.current.length;
      const drive = held > 0 ? 1 : 0;

      // Stars accelerate while notes are held, so the whole field responds
      stars.rotation.y += 0.0005 + held * 0.0016;
      stars.rotation.x += 0.0002 + held * 0.0006;

      if (ufo) {
        const values =
          analyzer.current.getValue();

        let sum = 0;

        for (let i = 0; i < values.length; i++) {
          sum += values[i] * values[i];
        }

        const rms = Math.sqrt(
          sum / values.length
        );

        // Browser audio (mouse-played keys) plus the instrument itself
        const audioMovement =
          rms * 4 + drive * 0.55;

        ufo.position.y =
          Math.sin(t * 0.8) * 0.15 +
          audioMovement;

        // Each held note tilts and spins it harder, so two notes look
        // different from one
        ufo.rotation.z =
          Math.sin(t * 0.6) * 0.06 +
          Math.sin(t * 7) * 0.04 * held;

        ufo.rotation.y += 0.002 + held * 0.02;

        const pulse = 0.02 + drive * 0.004;
        ufo.scale.set(pulse, pulse, pulse);
      }

      rendererRef.current.render(
        sceneRef.current,
        cameraRef.current
      );
    }

    animate();

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
      className="visualizer"
      ref={mountRef}
    ></div>
  );
}

export default Visualizer;