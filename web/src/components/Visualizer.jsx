import * as THREE from "three";
import { useRef, useEffect } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

function Visualizer({ analyzer, currentPage }) {
  const mountRef = useRef(null);

  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  const currentPageRef = useRef(currentPage);

  const transitionRef = useRef(null);

  const ufoAwayRef = useRef(false);

  const photoStarRef = useRef(null);

  useEffect(() => {
    if (
      currentPageRef.current === currentPage
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
      currentPageRef.current === "instrument" &&
      currentPage === "team"
    ) {
      transitionRef.current = {
        type: "fly-away",
        startTime: performance.now(),
      };

      ufoAwayRef.current = false;
    }

    if (
      currentPageRef.current === "team" &&
      currentPage === "instrument"
    ) {
      transitionRef.current = {
        type: "fly-in",
        startTime: performance.now(),
      };

      ufoAwayRef.current = true;
    }

    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();

    scene.background =
      new THREE.Color(0x000000);

    sceneRef.current = scene;

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

    cameraRef.current = camera;

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

    rendererRef.current = renderer;

    mountRef.current.appendChild(
      renderer.domElement
    );

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

    scene.add(
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

    const stars =
      new THREE.Points(
        starGeometry,
        starMaterial
      );

    scene.add(stars);

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
          0.8,
          0.8,
          1
        );

        photoStar.position.set(
          -7,
          3,
          -10
        );

        photoStar.visible = true;

        scene.add(
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

        scene.add(ufo);

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

    let entranceStartTime = null;

    let entranceComplete = false;

    let animationFrameId;

    function animate() {
      animationFrameId =
        requestAnimationFrame(
          animate
        );

      const t =
        clock.getElapsedTime();

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

      const starSpeed =
        0.0005 +
        rms * 0.003;

      stars.rotation.y +=
        starSpeed;

      stars.rotation.x +=
        0.0002 +
        rms * 0.001;

      if (photoStarRef.current) {
        const photoStar =
          photoStarRef.current;

        photoStar.visible = true;

        photoStar.position.x =
          Math.sin(
            t * 0.45
          ) * 7;

        photoStar.position.y =
          Math.cos(
            t * 0.35
          ) * 3.5;

        photoStar.position.z =
          -10 +
          Math.sin(
            t * 0.22
          ) * 2;

        photoStar.rotation.z =
          Math.sin(
            t * 0.5
          ) * 0.15;

        const twinkle =
          0.75 +
          Math.sin(
            t * 2.2
          ) * 0.25;

        photoStar.material.opacity =
          twinkle;
      }

      if (ufo) {
        if (
          !entranceComplete &&
          transitionRef.current === null
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

          if (progress >= 1) {
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
            0.006;

          ufo.rotation.z =
            Math.sin(
              t * 0.8
            ) *
            0.08;
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

          if (progress >= 1) {
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
              0.02;

            stars.rotation.y +=
              0.002;

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
              ) *
              0.08;

            ufo.rotation.y +=
              0.02;

            stars.rotation.y +=
              0.002;

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
            0.002;
        }

        else {
          const audioMovement =
            rms * 2;

          ufo.position.y =
            Math.sin(
              t * 0.8
            ) *
              0.15 +
            audioMovement;

          ufo.rotation.x *=
            0.95;

          ufo.rotation.z =
            Math.sin(
              t * 0.6
            ) *
            0.06;

          ufo.rotation.y +=
            0.002 +
            rms * 0.01;

          const color =
            new THREE.Color();

          const hue =
            (0.55 +
              rms * 0.8) %
            1;

          color.setHSL(
            hue,
            0.85,
            0.55
          );

          ufo.traverse(
            (child) => {
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
                      if (
                        material.color
                      ) {
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
            }
          );
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

      cancelAnimationFrame(
        animationFrameId
      );

      starGeometry.dispose();
      starMaterial.dispose();

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