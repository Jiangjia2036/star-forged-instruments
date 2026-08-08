import * as THREE from "three";
import { useRef, useEffect } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function Visualizer() {
  const mountRef = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x000000);

    cameraRef.current = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      1000
    );

    cameraRef.current.position.set(0, 1, 6);

    rendererRef.current = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    rendererRef.current.setPixelRatio(window.devicePixelRatio);

    rendererRef.current.setSize(width, height);

    mountRef.current.appendChild(
      rendererRef.current.domElement
    );

    const ambientLight = new THREE.AmbientLight(
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

      const t = clock.getElapsedTime();

      stars.rotation.y += 0.0005;
      stars.rotation.x += 0.0002;

      if (ufo) {
        ufo.position.y =
          Math.sin(t * 0.8) * 0.15;

        ufo.rotation.z =
          Math.sin(t * 0.6) * 0.06;

        ufo.rotation.y += 0.002;
      }

      rendererRef.current.render(
        sceneRef.current,
        cameraRef.current
      );
    }

    animate();

    function onWindowResize() {
      const width = window.innerWidth;
      const height = window.innerHeight;

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
  }, []);

  return (
    <div
      className="visualizer"
      ref={mountRef}
    ></div>
  );
}

export default Visualizer;