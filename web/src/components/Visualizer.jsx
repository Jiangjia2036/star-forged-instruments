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
    const mount = mountRef.current;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );
    cameraRef.current = camera;

    camera.position.set(0, 1, 6);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    rendererRef.current = renderer;

    renderer.setPixelRatio(window.devicePixelRatio);

    renderer.setSize(width, height);

    mount.appendChild(renderer.domElement);

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        2
      );

    scene.add(ambientLight);

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

    scene.add(directionalLight);

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

    scene.add(stars);

    const loader = new GLTFLoader();

    let ufo = null;
    let disposed = false;

    function disposeObject(root) {
      root.traverse((child) => {
        child.geometry?.dispose();

        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];

        materials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value?.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
    }

    loader.load(
      "/models/ufo.glb",

      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }

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

        scene.add(ufo);
      },

      undefined,

      (error) => {
        console.log(error);
      }
    );

    const timer = new THREE.Timer();
    timer.connect(document);
    let animationFrame = 0;

    function animate(timestamp) {
      animationFrame = requestAnimationFrame(animate);
      timer.update(timestamp);

      const t = timer.getElapsed();

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

      renderer.render(scene, camera);
    }

    animate();

    function onWindowResize() {
      const width =
        window.innerWidth;

      const height =
        window.innerHeight;

      camera.aspect = width / height;

      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
    }

    window.addEventListener(
      "resize",
      onWindowResize
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      timer.disconnect();
      timer.dispose();

      window.removeEventListener(
        "resize",
        onWindowResize
      );

      starGeometry.dispose();
      starMaterial.dispose();

      if (ufo) disposeObject(ufo);

      renderer.dispose();

      if (
        renderer.domElement.parentNode ===
        mount
      ) {
        mount.removeChild(renderer.domElement);
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
