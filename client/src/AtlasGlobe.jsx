import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export default function AtlasGlobe({
  listening = false,
  speaking = false,
}) {
  const containerRef = useRef(null);

  const voiceStateRef = useRef({
    listening,
    speaking,
  });

  useEffect(() => {
    voiceStateRef.current.listening = listening;
    voiceStateRef.current.speaking = speaking;
  }, [listening, speaking]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // =========================================================
    // SCENE
    // =========================================================

    const scene = new THREE.Scene();

    const width = Math.max(
      container.clientWidth,
      1
    );

    const height = Math.max(
      container.clientHeight,
      1
    );

    const camera = new THREE.PerspectiveCamera(
      35,
      width / height,
      0.1,
      100
    );

    camera.position.set(0, 0, 4.8);

    // =========================================================
    // RENDERER
    // =========================================================

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        2
      )
    );

    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);

    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace =
        THREE.SRGBColorSpace;
    }

    renderer.domElement.style.position =
      "absolute";

    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.background =
      "transparent";

    container.appendChild(
      renderer.domElement
    );

    // =========================================================
    // LIGHTING
    // =========================================================

    const ambientLight =
      new THREE.AmbientLight(
        0xffffff,
        1.7
      );

    scene.add(ambientLight);

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        2.7
      );

    keyLight.position.set(
      4,
      3,
      5
    );

    scene.add(keyLight);

    const cyanLight =
      new THREE.DirectionalLight(
        0x49e8ff,
        1.5
      );

    cyanLight.position.set(
      -4,
      1,
      3
    );

    scene.add(cyanLight);

    const rimLight =
      new THREE.PointLight(
        0x28dfff,
        1.8,
        8
      );

    rimLight.position.set(
      -3,
      2,
      -4
    );

    scene.add(rimLight);

    // =========================================================
    // GLOBE GROUP
    // =========================================================

    const globeGroup =
      new THREE.Group();

    scene.add(globeGroup);

    // =========================================================
    // DRACO
    // =========================================================

    const dracoLoader =
      new DRACOLoader();

    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
    );

    // =========================================================
    // EARTH MODEL
    // =========================================================

    const loader =
      new GLTFLoader();

    loader.setDRACOLoader(
      dracoLoader
    );

    loader.load(
      "/models/atlas_earth_globe_only.glb",

      (gltf) => {
        const model =
          gltf.scene;

        console.log(
          "ATLAS // EARTH CORE ONLINE"
        );

        const removeObjects = [];

        model.traverse((child) => {
          const name =
            (
              child.name || ""
            ).toLowerCase();

          if (
            name.includes("ray") ||
            name.includes("beam") ||
            name.includes("projection") ||
            name.includes("cone")
          ) {
            removeObjects.push(child);
          }
        });

        removeObjects.forEach(
          (object) => {
            if (object.parent) {
              object.parent.remove(
                object
              );
            }
          }
        );

        // -----------------------------------------------------
        // CENTER
        // -----------------------------------------------------

        const box =
          new THREE.Box3().setFromObject(
            model
          );

        const center =
          new THREE.Vector3();

        const size =
          new THREE.Vector3();

        box.getCenter(center);
        box.getSize(size);

        model.position.sub(
          center
        );

        // -----------------------------------------------------
        // YOUR 1.75 EARTH SIZE
        // -----------------------------------------------------

        const maxDimension =
          Math.max(
            size.x,
            size.y,
            size.z
          );

        if (maxDimension > 0) {
          const targetSize = 1.75;

          model.scale.setScalar(
            targetSize /
              maxDimension
          );
        }

        // -----------------------------------------------------
        // MATERIAL
        // -----------------------------------------------------

        model.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = false;
          child.receiveShadow = false;

          const materials =
            Array.isArray(
              child.material
            )
              ? child.material
              : [child.material];

          materials.forEach(
            (material) => {
              if (!material) return;

              material.transparent = true;
              material.opacity = 1;

              if (
                "roughness" in material
              ) {
                material.roughness = 0.4;
              }

              if (
                "metalness" in material
              ) {
                material.metalness = 0.45;
              }

              material.needsUpdate = true;
            }
          );
        });

        globeGroup.add(model);
      },

      undefined,

      (error) => {
        console.error(
          "ATLAS // EARTH LOAD FAILED",
          error
        );
      }
    );

    // =========================================================
    // THIN ATMOSPHERE
    // =========================================================

    const atmosphereGeometry =
      new THREE.SphereGeometry(
        0.91,
        64,
        64
      );

    const atmosphereMaterial =
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending:
          THREE.AdditiveBlending,

        uniforms: {
          uPulse: {
            value: 0,
          },
        },

        vertexShader: `
          varying vec3 vNormalWorld;
          varying vec3 vWorldPosition;

          void main() {

            vNormalWorld =
              normalize(
                mat3(modelMatrix) * normal
              );

            vec4 worldPosition =
              modelMatrix *
              vec4(position, 1.0);

            vWorldPosition =
              worldPosition.xyz;

            gl_Position =
              projectionMatrix *
              viewMatrix *
              worldPosition;
          }
        `,

        fragmentShader: `
          uniform float uPulse;

          varying vec3 vNormalWorld;
          varying vec3 vWorldPosition;

          void main() {

            vec3 viewDirection =
              normalize(
                cameraPosition -
                vWorldPosition
              );

            float edge =
              1.0 -
              abs(
                dot(
                  normalize(vNormalWorld),
                  viewDirection
                )
              );

            edge =
              pow(
                max(edge, 0.0),
                3.8
              );

            float intensity =
              0.25 +
              uPulse * 0.22;

            vec3 cyan =
              vec3(
                0.02,
                0.75,
                1.0
              );

            gl_FragColor =
              vec4(
                cyan,
                edge * intensity
              );
          }
        `,
      });

    const atmosphere =
      new THREE.Mesh(
        atmosphereGeometry,
        atmosphereMaterial
      );

    globeGroup.add(atmosphere);

    // =========================================================
    // BREATHING AURA
    // =========================================================

    const auraGeometry =
      new THREE.SphereGeometry(
        0.92,
        64,
        64
      );

    const auraMaterial =
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        blending:
          THREE.AdditiveBlending,

        uniforms: {
          uBreath: {
            value: 0,
          },

          uActivity: {
            value: 0,
          },
        },

        vertexShader: `
          varying vec3 vNormalWorld;
          varying vec3 vWorldPosition;

          void main() {

            vNormalWorld =
              normalize(
                mat3(modelMatrix) * normal
              );

            vec4 worldPosition =
              modelMatrix *
              vec4(position, 1.0);

            vWorldPosition =
              worldPosition.xyz;

            gl_Position =
              projectionMatrix *
              viewMatrix *
              worldPosition;
          }
        `,

        fragmentShader: `
          uniform float uBreath;
          uniform float uActivity;

          varying vec3 vNormalWorld;
          varying vec3 vWorldPosition;

          void main() {

            vec3 viewDirection =
              normalize(
                cameraPosition -
                vWorldPosition
              );

            float edge =
              1.0 -
              abs(
                dot(
                  normalize(vNormalWorld),
                  viewDirection
                )
              );

            edge =
              pow(
                max(edge, 0.0),
                4.5
              );

            float intensity =
              0.06 +
              uBreath * 0.05 +
              uActivity * 0.08;

            vec3 cyan =
              vec3(
                0.02,
                0.55,
                0.9
              );

            gl_FragColor =
              vec4(
                cyan,
                edge * intensity
              );
          }
        `,
      });

    const aura =
      new THREE.Mesh(
        auraGeometry,
        auraMaterial
      );

    globeGroup.add(aura);

    // =========================================================
    // NEURAL WAVE
    // =========================================================

    const waveGeometry =
      new THREE.SphereGeometry(
        0.885,
        128,
        128
      );

    const waveMaterial =
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending:
          THREE.AdditiveBlending,

        uniforms: {
          uTime: {
            value: 0,
          },

          uActivity: {
            value: 0,
          },
        },

        vertexShader: `
          varying vec3 vPosition;

          void main() {

            vPosition =
              normalize(position);

            gl_Position =
              projectionMatrix *
              modelViewMatrix *
              vec4(position, 1.0);
          }
        `,

        fragmentShader: `
          uniform float uTime;
          uniform float uActivity;

          varying vec3 vPosition;

          void main() {

            float longitude =
              atan(
                vPosition.z,
                vPosition.x
              );

            float latitude =
              asin(
                clamp(
                  vPosition.y,
                  -1.0,
                  1.0
                )
              );

            float waveCenter =
              sin(
                longitude * 2.4 +
                uTime * 0.75
              ) * 0.16;

            float distanceToWave =
              abs(
                latitude -
                waveCenter
              );

            float wave =
              1.0 -
              smoothstep(
                0.0,
                0.035,
                distanceToWave
              );

            float wave2Center =
              sin(
                longitude * 1.7 -
                uTime * 0.45
              ) * 0.28;

            float distanceToWave2 =
              abs(
                latitude -
                wave2Center
              );

            float wave2 =
              1.0 -
              smoothstep(
                0.0,
                0.045,
                distanceToWave2
              );

            float brightness =
              wave *
              (
                0.10 +
                uActivity * 0.42
              );

            brightness +=
              wave2 *
              (
                0.025 +
                uActivity * 0.10
              );

            vec3 cyan =
              vec3(
                0.03,
                0.85,
                1.0
              );

            gl_FragColor =
              vec4(
                cyan,
                brightness
              );
          }
        `,
      });

    const neuralWave =
      new THREE.Mesh(
        waveGeometry,
        waveMaterial
      );

    globeGroup.add(
      neuralWave
    );

    // =========================================================
    // SURFACE DATA NODES
    // =========================================================

    const nodeGroup =
      new THREE.Group();

    globeGroup.add(nodeGroup);

    const nodeCoordinates = [
      [0.30, 0.75, 0.60],
      [-0.48, 0.40, 0.78],
      [0.65, -0.15, 0.74],
      [-0.60, -0.32, 0.68],
      [0.12, -0.70, 0.70],
      [-0.10, 0.25, 0.95],
    ];

    const nodes = [];

    nodeCoordinates.forEach(
      ([x, y, z], index) => {
        const position =
          new THREE.Vector3(
            x,
            y,
            z
          )
            .normalize()
            .multiplyScalar(
              0.895
            );

        const geometry =
          new THREE.SphereGeometry(
            index === 0
              ? 0.025
              : 0.014,
            12,
            12
          );

        const material =
          new THREE.MeshBasicMaterial({
            color: 0x63efff,
            transparent: true,
            opacity: 0.22,
            blending:
              THREE.AdditiveBlending,
            depthWrite: false,
          });

        const node =
          new THREE.Mesh(
            geometry,
            material
          );

        node.position.copy(
          position
        );

        nodeGroup.add(node);
        nodes.push(node);
      }
    );

    // =========================================================
    // NEURAL CONNECTION LINES
    // =========================================================

    const connectionGroup =
      new THREE.Group();

    globeGroup.add(
      connectionGroup
    );

    const connections = [
      [0, 1],
      [1, 5],
      [5, 2],
      [2, 4],
      [4, 3],
    ];

    connections.forEach(
      ([a, b]) => {
        const points = [
          nodes[a].position,
          nodes[b].position,
        ];

        const geometry =
          new THREE.BufferGeometry().setFromPoints(
            points
          );

        const material =
          new THREE.LineBasicMaterial({
            color: 0x39ddff,
            transparent: true,
            opacity: 0.08,
            blending:
              THREE.AdditiveBlending,
            depthWrite: false,
          });

        const line =
          new THREE.Line(
            geometry,
            material
          );

        connectionGroup.add(
          line
        );
      }
    );

    // =========================================================
    // SCAN SWEEP
    // =========================================================

    const scanGeometry =
      new THREE.TorusGeometry(
        0.895,
        0.006,
        8,
        96,
        Math.PI * 0.34
      );

    const scanMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x72f4ff,
        transparent: true,
        opacity: 0.55,
        blending:
          THREE.AdditiveBlending,
        depthWrite: false,
      });

    const scanSweep =
      new THREE.Mesh(
        scanGeometry,
        scanMaterial
      );

    scanSweep.rotation.x =
      Math.PI * 0.5;

    globeGroup.add(
      scanSweep
    );

    // =========================================================
    // TARGET LOCK
    // =========================================================

    const targetGroup =
      new THREE.Group();

    globeGroup.add(
      targetGroup
    );

    const targetRingGeometry =
      new THREE.TorusGeometry(
        0.055,
        0.004,
        6,
        32
      );

    const targetRingMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x73f7ff,
        transparent: true,
        opacity: 0,
        blending:
          THREE.AdditiveBlending,
        depthWrite: false,
      });

    const targetRing =
      new THREE.Mesh(
        targetRingGeometry,
        targetRingMaterial
      );

    targetGroup.add(
      targetRing
    );

    const targetDotGeometry =
      new THREE.SphereGeometry(
        0.012,
        10,
        10
      );

    const targetDotMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });

    const targetDot =
      new THREE.Mesh(
        targetDotGeometry,
        targetDotMaterial
      );

    targetGroup.add(
      targetDot
    );

    const targetPosition =
      new THREE.Vector3(
        0.35,
        0.62,
        0.72
      )
        .normalize()
        .multiplyScalar(
          0.905
        );

    targetGroup.position.copy(
      targetPosition
    );

    const targetNormal =
      targetPosition.clone().normalize();

    targetGroup.quaternion.setFromUnitVectors(
      new THREE.Vector3(
        0,
        0,
        1
      ),
      targetNormal
    );

    let targetTimer = 0;
    let targetVisible = false;

    // =========================================================
    // TINY SATELLITE
    // =========================================================

    const satelliteGroup =
      new THREE.Group();

    scene.add(
      satelliteGroup
    );

    const satelliteGeometry =
      new THREE.OctahedronGeometry(
        0.025,
        0
      );

    const satelliteMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x6ff5ff,
        transparent: true,
        opacity: 0.7,
        blending:
          THREE.AdditiveBlending,
      });

    const satellite =
      new THREE.Mesh(
        satelliteGeometry,
        satelliteMaterial
      );

    satelliteGroup.add(
      satellite
    );

    const satelliteLineGeometry =
      new THREE.BufferGeometry();

    const satelliteLineMaterial =
      new THREE.LineBasicMaterial({
        color: 0x40eaff,
        transparent: true,
        opacity: 0.16,
        blending:
          THREE.AdditiveBlending,
      });

    const satelliteLine =
      new THREE.Line(
        satelliteLineGeometry,
        satelliteLineMaterial
      );

    scene.add(
      satelliteLine
    );

    // =========================================================
    // ANIMATION
    // =========================================================

    let animationFrame;

    const start =
      performance.now();

    const animate = (
      timestamp
    ) => {
      animationFrame =
        requestAnimationFrame(
          animate
        );

      const elapsed =
        (timestamp - start) /
        1000;

      const {
        listening,
        speaking,
      } =
        voiceStateRef.current;

      let rotationSpeed =
        0.0017;

      let activity = 0;

      if (listening) {
        rotationSpeed =
          0.0028;

        activity = 0.65;
      }

      if (speaking) {
        rotationSpeed =
          0.0035;

        activity = 1;
      }

      // -------------------------------------------------------
      // EARTH ROTATION
      // -------------------------------------------------------

      globeGroup.rotation.y +=
        rotationSpeed;

      // -------------------------------------------------------
      // BREATHING
      // -------------------------------------------------------

      const breath =
        0.5 +
        Math.sin(
          elapsed * 1.7
        ) *
          0.5;

      atmosphereMaterial
        .uniforms
        .uPulse
        .value =
        breath * activity;

      auraMaterial
        .uniforms
        .uBreath
        .value =
        breath;

      auraMaterial
        .uniforms
        .uActivity
        .value =
        activity;

      const auraScale =
        1 +
        breath * 0.009 +
        activity * 0.006;

      aura.scale.setScalar(
        auraScale
      );

      // -------------------------------------------------------
      // NEURAL WAVE
      // -------------------------------------------------------

      waveMaterial
        .uniforms
        .uTime
        .value =
        elapsed;

      waveMaterial
        .uniforms
        .uActivity
        .value =
        activity;

      // -------------------------------------------------------
      // SURFACE NODES
      // -------------------------------------------------------

      nodes.forEach(
        (node, index) => {
          const pulse =
            0.5 +
            Math.sin(
              elapsed * 2.2 +
              index * 1.5
            ) *
              0.5;

          if (
            listening ||
            speaking
          ) {
            node.material.opacity =
              0.30 +
              pulse * 0.38;

            node.scale.setScalar(
              1 +
                pulse * 0.35
            );
          } else {
            node.material.opacity =
              0.13 +
              pulse * 0.06;

            node.scale.setScalar(
              1
            );
          }
        }
      );

      // -------------------------------------------------------
      // CONNECTIONS
      // -------------------------------------------------------

      connectionGroup.children.forEach(
        (line) => {
          line.material.opacity =
            listening ||
            speaking
              ? 0.16
              : 0.055;
        }
      );

      // -------------------------------------------------------
      // SCAN SWEEP
      // -------------------------------------------------------

      scanSweep.rotation.y =
        elapsed *
        (
          speaking
            ? 0.9
            : listening
            ? 0.55
            : 0.22
        );

      scanMaterial.opacity =
        speaking
          ? 0.85
          : listening
          ? 0.55
          : 0.22;

      // -------------------------------------------------------
      // TARGET LOCK
      // -------------------------------------------------------

      targetTimer +=
        0.016;

      // Activate every ~7 seconds.
      if (
        targetTimer > 7 &&
        !targetVisible
      ) {
        targetTimer = 0;
        targetVisible = true;
      }

      if (targetVisible) {
        const lockTime =
          targetTimer;

        const fadeIn =
          Math.min(
            lockTime / 0.5,
            1
          );

        const fadeOut =
          Math.max(
            0,
            1 -
              Math.max(
                lockTime - 2.2,
                0
              ) /
                0.8
          );

        const visibility =
          Math.min(
            fadeIn,
            fadeOut
          );

        targetRingMaterial.opacity =
          visibility * 0.8;

        targetDotMaterial.opacity =
          visibility;

        const targetPulse =
          1 +
          Math.sin(
            lockTime * 7
          ) *
            0.12;

        targetRing.scale.setScalar(
          targetPulse
        );

        if (
          lockTime > 3
        ) {
          targetVisible = false;
          targetTimer = 0;

          targetRingMaterial.opacity = 0;
          targetDotMaterial.opacity = 0;
        }
      }

      // -------------------------------------------------------
      // SATELLITE
      // -------------------------------------------------------

      const satelliteAngle =
        elapsed * 0.18;

      const satelliteRadius =
        1.12;

      const satellitePosition =
        new THREE.Vector3(
          Math.cos(
            satelliteAngle
          ) *
            satelliteRadius,

          Math.sin(
            satelliteAngle * 0.7
          ) *
            0.35,

          Math.sin(
            satelliteAngle
          ) *
            satelliteRadius
        );

      satellite.position.copy(
        satellitePosition
      );

      satellite.rotation.x =
        elapsed * 1.5;

      satellite.rotation.y =
        elapsed * 2;

      // Connection from satellite
      // toward the globe center.
      satelliteLineGeometry.setFromPoints(
        [
          satellitePosition,
          satellitePosition
            .clone()
            .normalize()
            .multiplyScalar(
              0.92
            ),
        ]
      );

      satellite.material.opacity =
        listening || speaking
          ? 1
          : 0.55;

      // -------------------------------------------------------
      // RENDER
      // -------------------------------------------------------

      renderer.render(
        scene,
        camera
      );
    };

    animationFrame =
      requestAnimationFrame(
        animate
      );

    // =========================================================
    // RESIZE
    // =========================================================

    const resize = () => {
      const newWidth =
        Math.max(
          container.clientWidth,
          1
        );

      const newHeight =
        Math.max(
          container.clientHeight,
          1
        );

      camera.aspect =
        newWidth /
        newHeight;

      camera.updateProjectionMatrix();

      renderer.setSize(
        newWidth,
        newHeight
      );

      renderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio ||
            1,
          2
        )
      );
    };

    window.addEventListener(
      "resize",
      resize
    );

    const resizeObserver =
      new ResizeObserver(
        resize
      );

    resizeObserver.observe(
      container
    );

    resize();

    // =========================================================
    // CLEANUP
    // =========================================================

    return () => {
      cancelAnimationFrame(
        animationFrame
      );

      window.removeEventListener(
        "resize",
        resize
      );

      resizeObserver.disconnect();

      scene.traverse(
        (object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }

          if (object.material) {
            const materials =
              Array.isArray(
                object.material
              )
                ? object.material
                : [object.material];

            materials.forEach(
              (material) => {
                if (!material) return;

                if (material.map) {
                  material.map.dispose();
                }

                if (
                  material.normalMap
                ) {
                  material.normalMap.dispose();
                }

                if (
                  material.roughnessMap
                ) {
                  material.roughnessMap.dispose();
                }

                if (
                  material.metalnessMap
                ) {
                  material.metalnessMap.dispose();
                }

                if (
                  material.emissiveMap
                ) {
                  material.emissiveMap.dispose();
                }

                material.dispose();
              }
            );
          }
        }
      );

      dracoLoader.dispose();
      renderer.dispose();

      if (
        renderer.domElement.parentNode ===
        container
      ) {
        container.removeChild(
          renderer.domElement
        );
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="atlas-globe"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "transparent",
        border: "none",
        boxShadow: "none",
      }}
    />
  );
}