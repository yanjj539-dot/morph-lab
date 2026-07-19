"use client";

import { useEffect, useRef, useState } from "react";

type JourneyStage = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  details: string[];
};

const STAGES: JourneyStage[] = [
  {
    id: "observe",
    label: "01",
    eyebrow: "OBSERVE",
    title: "把材料看清楚",
    body: "先拆解真实内容、语气、视觉资产和使用场景，不急着套模板。",
    details: ["content audit", "reference map", "interaction notes"],
  },
  {
    id: "structure",
    label: "02",
    eyebrow: "STRUCTURE",
    title: "建立可以生长的系统",
    body: "把模型输出、界面层级、组件节奏和品牌语言整理成可执行结构。",
    details: ["information architecture", "design tokens", "component rhythm"],
  },
  {
    id: "prototype",
    label: "03",
    eyebrow: "PROTOTYPE",
    title: "做出可运行的试验品",
    body: "用前端、WebGL、传感器或自动化流程快速验证交互是否成立。",
    details: ["live interface", "motion test", "device loop"],
  },
  {
    id: "release",
    label: "04",
    eyebrow: "RELEASE",
    title: "收束成正式作品",
    body: "删除装饰性噪音，保留叙事、性能、可访问性和可部署结果。",
    details: ["production build", "browser QA", "deployment notes"],
  },
];

type ThreeModule = typeof import("three");

function canUseWebGL() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

function disposeMaterial(material: import("three").Material | import("three").Material[]) {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

function setBox(
  THREE: ThreeModule,
  scene: import("three").Scene,
  meshes: import("three").Mesh[],
  position: [number, number, number],
  scale: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
) {
  const geometry = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  meshes.push(mesh);
  return mesh;
}

export default function ScrollJourney() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const pinRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [isFallback, setIsFallback] = useState(true);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const canvasHost = canvasHostRef.current;

    if (!section || !pin || !canvasHost) {
      return;
    }

    let cleanup = () => {};
    let cancelled = false;
    let initializationVersion = 0;

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const updateMode = () => {
      const version = ++initializationVersion;
      cleanup();
      cleanup = () => {};

      const shouldUseScene =
        desktopQuery.matches && !reducedMotionQuery.matches && canUseWebGL();

      setIsFallback(!shouldUseScene);
      setActiveStage(0);

      if (!shouldUseScene) {
        canvasHost.replaceChildren();
        return;
      }

      let rafId = 0;
      let resizeObserver: ResizeObserver | null = null;
      let localScrollTrigger: { kill: () => void } | null = null;
      const meshes: import("three").Mesh[] = [];
      const removableObjects: import("three").Object3D[] = [];

      Promise.all([import("three"), import("gsap"), import("gsap/ScrollTrigger")])
        .then(([THREE, gsapModule, scrollModule]) => {
          if (cancelled || version !== initializationVersion) {
            return;
          }

          const gsap = gsapModule.gsap ?? gsapModule.default;
          const ScrollTrigger =
            scrollModule.ScrollTrigger ?? scrollModule.default ?? scrollModule;
          gsap.registerPlugin(ScrollTrigger);

          canvasHost.replaceChildren();

          const scene = new THREE.Scene();
          scene.background = new THREE.Color("#bfd4f5");
          scene.fog = new THREE.Fog("#bfd4f5", 9, 22);

          const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
          camera.position.set(-5.5, 4.1, 8.4);
          camera.lookAt(-1.9, 0.25, 0);

          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: "high-performance",
          });
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
          canvasHost.appendChild(renderer.domElement);

          const ambient = new THREE.HemisphereLight("#ffffff", "#d8e5f7", 2.4);
          scene.add(ambient);

          const sun = new THREE.DirectionalLight("#ffffff", 3.2);
          sun.position.set(-3.5, 7.5, 4.5);
          sun.castShadow = true;
          sun.shadow.mapSize.set(1024, 1024);
          scene.add(sun);

          const base = setBox(
            THREE,
            scene,
            meshes,
            [0, -0.08, 0],
            [17.2, 0.16, 5.2],
            "#f6f5ef",
          );
          base.receiveShadow = true;

          const stageX = [-5.8, -1.9, 2.1, 5.9];
          const stageColors = ["#ffffff", "#f2f6ff", "#f7f4ec", "#ffffff"];

          stageX.forEach((x, index) => {
            setBox(
              THREE,
              scene,
              meshes,
              [x, 0.03, -1.82],
              [2.65, 0.08, 1.45],
              stageColors[index],
              [0, 0.02 * (index - 1.5), 0],
            );
          });

          // OBSERVE: documents, scanner, notes.
          setBox(THREE, scene, meshes, [-6.28, 0.2, -1.72], [0.74, 0.12, 1], "#eef2f7");
          setBox(THREE, scene, meshes, [-5.73, 0.23, -1.54], [0.9, 0.04, 0.62], "#ffffff", [
            0,
            0,
            -0.08,
          ]);
          setBox(THREE, scene, meshes, [-5.28, 0.25, -1.94], [0.58, 0.035, 0.78], "#ffffff", [
            0,
            0,
            0.1,
          ]);
          setBox(THREE, scene, meshes, [-6.48, 0.32, -1.1], [0.42, 0.42, 0.08], "#2456ff");

          // STRUCTURE: board, wireframes, token blocks.
          setBox(THREE, scene, meshes, [-2.3, 0.58, -2.15], [1.7, 0.95, 0.1], "#ffffff");
          setBox(THREE, scene, meshes, [-2.75, 1.08, -2.08], [0.58, 0.06, 0.08], "#2456ff");
          setBox(THREE, scene, meshes, [-2.1, 0.89, -2.08], [0.75, 0.05, 0.08], "#d8e5f7");
          setBox(THREE, scene, meshes, [-1.68, 0.49, -1.42], [0.38, 0.38, 0.38], "#bfd4f5");
          setBox(THREE, scene, meshes, [-2.1, 0.42, -1.36], [0.32, 0.32, 0.32], "#ff7157");
          setBox(THREE, scene, meshes, [-1.64, 0.2, -2.35], [0.92, 0.08, 0.28], "#111318");

          // PROTOTYPE: screen, phone, pad.
          setBox(THREE, scene, meshes, [1.62, 0.63, -2.07], [1.25, 0.78, 0.1], "#111318");
          setBox(THREE, scene, meshes, [1.62, 0.64, -2], [1.02, 0.52, 0.04], "#d8e5f7");
          setBox(THREE, scene, meshes, [2.55, 0.37, -1.65], [0.38, 0.78, 0.08], "#ffffff", [
            0,
            -0.08,
            0,
          ]);
          setBox(THREE, scene, meshes, [2.55, 0.38, -1.59], [0.26, 0.58, 0.035], "#2456ff", [
            0,
            -0.08,
            0,
          ]);
          setBox(THREE, scene, meshes, [2.05, 0.18, -1.12], [0.86, 0.09, 0.5], "#f6f5ef");
          setBox(THREE, scene, meshes, [1.3, 0.22, -1.16], [0.5, 0.05, 0.5], "#ff7157");

          // RELEASE: output plinth, package, device light ring.
          setBox(THREE, scene, meshes, [5.5, 0.26, -1.8], [1.22, 0.42, 0.88], "#ffffff");
          setBox(THREE, scene, meshes, [6.25, 0.47, -2.02], [0.72, 0.78, 0.16], "#f6f5ef");
          setBox(THREE, scene, meshes, [5.45, 0.6, -1.1], [0.42, 0.42, 0.42], "#d8e5f7");
          setBox(THREE, scene, meshes, [5.92, 0.88, -1.28], [0.22, 0.22, 0.22], "#ff7157");
          setBox(THREE, scene, meshes, [6.32, 0.14, -1.25], [0.92, 0.06, 0.12], "#2456ff");

          const pathPoints = [
            new THREE.Vector3(-6.55, 0.18, 0.85),
            new THREE.Vector3(-5.4, 0.22, 0.46),
            new THREE.Vector3(-3.2, 0.2, 0.78),
            new THREE.Vector3(-1.72, 0.28, 0.34),
            new THREE.Vector3(0.1, 0.24, 0.78),
            new THREE.Vector3(2.18, 0.32, 0.38),
            new THREE.Vector3(3.82, 0.24, 0.72),
            new THREE.Vector3(5.98, 0.3, 0.35),
            new THREE.Vector3(6.72, 0.22, 0.72),
          ];
          const curve = new THREE.CatmullRomCurve3(pathPoints, false, "catmullrom", 0.34);
          const curvePoints = curve.getPoints(160);
          const pathGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
          pathGeometry.setDrawRange(0, 2);
          const pathMaterial = new THREE.LineBasicMaterial({
            color: "#ff7157",
            linewidth: 2,
          });
          const routeLine = new THREE.Line(pathGeometry, pathMaterial);
          scene.add(routeLine);
          removableObjects.push(routeLine);

          const markers = stageX.map((x, index) => {
            const geometry = new THREE.CylinderGeometry(0.11, 0.11, 0.045, 28);
            const material = new THREE.MeshStandardMaterial({
              color: index === 0 ? "#ff7157" : "#ffffff",
              roughness: 0.68,
            });
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(x, 0.18, 0.72);
            marker.castShadow = true;
            marker.receiveShadow = true;
            scene.add(marker);
            meshes.push(marker);
            return marker;
          });

          const sizeRenderer = () => {
            const rect = canvasHost.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          };

          resizeObserver = new ResizeObserver(sizeRenderer);
          resizeObserver.observe(canvasHost);
          window.addEventListener("orientationchange", sizeRenderer);
          sizeRenderer();

          const state = { progress: 0 };

          localScrollTrigger = ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "+=420%",
            pin,
            scrub: 0.45,
            invalidateOnRefresh: true,
            onUpdate: (self: { progress: number }) => {
              state.progress = self.progress;
              const nextStage = Math.min(3, Math.floor(self.progress * STAGES.length));
              setActiveStage(nextStage);
            },
          });

          const render = () => {
            const travel = state.progress;
            const cameraX = -5.2 + travel * 10.4;
            const targetX = -4.3 + travel * 9.5;

            camera.position.set(cameraX, 4.0 - Math.sin(travel * Math.PI) * 0.55, 8.2);
            camera.lookAt(targetX, 0.22, -0.65);
            pathGeometry.setDrawRange(0, Math.max(2, Math.floor(curvePoints.length * travel)));

            markers.forEach((marker, index) => {
              const stageProgress = Math.max(
                0,
                Math.min(1, travel * (STAGES.length - 1) - index + 1),
              );
              marker.scale.setScalar(1 + stageProgress * 0.35);
              const material = marker.material as import("three").MeshStandardMaterial;
              material.color.set(stageProgress > 0.52 ? "#ff7157" : "#ffffff");
            });

            scene.rotation.y = (travel - 0.5) * 0.08;
            renderer.render(scene, camera);
            rafId = window.requestAnimationFrame(render);
          };

          render();

          cleanup = () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener("orientationchange", sizeRenderer);
            resizeObserver?.disconnect();
            localScrollTrigger?.kill();

            removableObjects.forEach((object) => {
              scene.remove(object);
            });

            meshes.forEach((mesh) => {
              scene.remove(mesh);
              mesh.geometry.dispose();
              disposeMaterial(mesh.material);
            });

            pathGeometry.dispose();
            pathMaterial.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
          };
        })
        .catch(() => {
          setIsFallback(true);
          canvasHost.replaceChildren();
        });
    };

    updateMode();
    desktopQuery.addEventListener("change", updateMode);
    reducedMotionQuery.addEventListener("change", updateMode);

    return () => {
      cancelled = true;
      initializationVersion += 1;
      cleanup();
      desktopQuery.removeEventListener("change", updateMode);
      reducedMotionQuery.removeEventListener("change", updateMode);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="process"
      className={`scroll-journey${isFallback ? " scroll-journey--fallback" : ""}`}
      aria-labelledby="journey-title"
    >
      <div ref={pinRef} className="scroll-journey__pin">
        <div className="scroll-journey__intro">
          <p className="section-kicker">FOUR-STAGE JOURNEY</p>
          <h2 id="journey-title">From raw material to a working release.</h2>
          <p>
            The process stays quiet on purpose: observe the real inputs, structure the
            system, prototype the interaction, then ship the result.
          </p>
        </div>

        <div className="scroll-journey__scene" aria-hidden="true">
          <div ref={canvasHostRef} className="scroll-journey__canvas" />
          <div className="scroll-journey__fallback-scene">
            <span className="fallback-object fallback-object--paper" />
            <span className="fallback-object fallback-object--board" />
            <span className="fallback-object fallback-object--screen" />
            <span className="fallback-object fallback-object--device" />
            <span className="fallback-object fallback-object--route" />
          </div>
        </div>

        <ol className="scroll-journey__stages" aria-label="Design process stages">
          {STAGES.map((stage, index) => (
            <li
              key={stage.id}
              className={`scroll-journey__stage${
                activeStage === index ? " is-active" : ""
              }`}
              aria-current={activeStage === index ? "step" : undefined}
            >
              <span className="scroll-journey__stage-label">{stage.label}</span>
              <span className="scroll-journey__stage-name">{stage.eyebrow}</span>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
              <ul>
                {stage.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
