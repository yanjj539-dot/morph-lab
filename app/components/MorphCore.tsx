"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Euler,
  Line,
  Material,
  Mesh,
  Vector3,
  WebGLRenderer,
} from "three";

type TrackedMaterial = Material | Material[];
type DisposableGeometry = { dispose: () => void; };
type DisposableSceneObject = {
  geometry?: DisposableGeometry;
  material?: TrackedMaterial;
};

const BOOST_EVENTS = [
  "morph-core:signal-boost",
  "morph-core:cta-hover",
  "vectrfl:cta-hover",
];

function canUseWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

export default function MorphCore() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    let fallbackTimer = 0;
    let cancelled = false;
    let cleanupScene: (() => void) | undefined;
    const showFallback = () => {
      if (cancelled) {
        return;
      }

      fallbackTimer = window.setTimeout(() => setWebglFailed(true), 0);
    };

    async function initialize() {
      if (!mount || !canUseWebGL()) {
        showFallback();
        return;
      }

      let THREE: typeof import("three");

      try {
        THREE = await import("three");
      } catch {
        showFallback();
        return;
      }

      if (cancelled) {
        return;
      }

      let renderer: WebGLRenderer;

      try {
        renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch {
        showFallback();
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      const root = new THREE.Group();
      const plateGroup = new THREE.Group();
      const layerGroup = new THREE.Group();
      const signalGroup = new THREE.Group();
      const plateMeshes: Mesh[] = [];
      const layerMeshes: Mesh[] = [];
      const signalLines: Line[] = [];
      const nodeMeshes: Mesh[] = [];
      const mouse = new THREE.Vector2();
      const targetMouse = new THREE.Vector2();
      const targetRotation = new THREE.Vector2();
      const scroll = { current: 0, target: 0 };
      const boost = { current: 0, target: 0 };
      let lastFrameTime = performance.now();
      let elapsedTime = 0;
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      let reducedMotion = mediaQuery.matches;
      let frameId = 0;
      let hidden = document.hidden;
      let inView = true;
      let disposed = false;

      const isCompact = window.innerWidth < 720;
      const plateCount = isCompact ? 10 : 18;
      const layerCount = isCompact ? 3 : 5;
      const signalCount = isCompact ? 8 : 14;
      const nodeCount = isCompact ? 12 : 24;

      renderer.setClearColor(0x02050a, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCompact ? 1.25 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      mount.appendChild(renderer.domElement);

      camera.position.set(0, 0.45, 7.2);
      scene.add(root);
      root.add(plateGroup, layerGroup, signalGroup);

      const ambientLight = new THREE.AmbientLight(0x8ba6c8, 0.48);
      const keyLight = new THREE.DirectionalLight(0xc7e8ff, 2.2);
      const rimLight = new THREE.PointLight(0x26b7ff, 22, 10, 1.8);

      keyLight.position.set(2.8, 4.2, 5.2);
      rimLight.position.set(-3.2, 1.1, 2.4);
      scene.add(ambientLight, keyLight, rimLight);

      const plateMaterial = new THREE.MeshStandardMaterial({
        color: 0x111823,
        metalness: 0.82,
        roughness: 0.28,
        emissive: 0x03101b,
        emissiveIntensity: 0.16,
      });
      const edgeMaterial = new THREE.MeshBasicMaterial({
        color: 0x2bbdff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
      });
      const layerMaterial = new THREE.MeshPhysicalMaterial({
        color: 0x7ed8ff,
        transparent: true,
        opacity: 0.12,
        roughness: 0.14,
        metalness: 0.08,
        transmission: 0.42,
        thickness: 0.08,
        depthWrite: false,
      });
      const signalMaterial = new THREE.LineBasicMaterial({
        color: 0x28bfff,
        transparent: true,
        opacity: 0.52,
        blending: THREE.AdditiveBlending,
      });
      const nodeMaterial = new THREE.MeshBasicMaterial({
        color: 0x75dfff,
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
      });

      for (let index = 0; index < plateCount; index += 1) {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const width = 1.08 + ((index * 13) % 7) * 0.08;
        const height = 0.48 + ((index * 7) % 5) * 0.07;
        const depth = 0.08 + ((index * 5) % 4) * 0.02;
        const geometry = new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
        const mesh = new THREE.Mesh(geometry, plateMaterial);
        const x = (col - 1) * 1.32 + (row % 2) * 0.32;
        const y = 1.58 - row * 0.58;
        const z = -0.15 + Math.sin(index * 1.7) * 0.24;

        mesh.position.set(x, y, z);
        mesh.rotation.set(
          THREE.MathUtils.degToRad(-7 + ((index * 11) % 15)),
          THREE.MathUtils.degToRad(-14 + ((index * 17) % 28)),
          THREE.MathUtils.degToRad(-4 + ((index * 5) % 10)),
        );
        mesh.userData.origin = mesh.position.clone();
        mesh.userData.originRotation = mesh.rotation.clone();
        mesh.userData.breakVector = new THREE.Vector3(
          x * 0.55 + Math.sin(index) * 0.42,
          y * 0.34 + Math.cos(index * 0.7) * 0.28,
          0.65 + (index % 4) * 0.16,
        );

        plateMeshes.push(mesh);
        plateGroup.add(mesh);

        if (!isCompact && index % 2 === 0) {
          const edgeGeometry = new THREE.EdgesGeometry(geometry);
          const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
          edge.position.copy(mesh.position);
          edge.rotation.copy(mesh.rotation);
          edge.scale.copy(mesh.scale);
          edge.userData.source = mesh;
          signalGroup.add(edge);
        }
      }

      for (let index = 0; index < layerCount; index += 1) {
        const geometry = new THREE.PlaneGeometry(4.2 - index * 0.22, 2.2 - index * 0.12, 1, 1);
        const layer = new THREE.Mesh(geometry, layerMaterial);

        layer.position.set(0, 0.08 - index * 0.04, -0.34 - index * 0.16);
        layer.rotation.set(
          THREE.MathUtils.degToRad(68 + index * 3),
          THREE.MathUtils.degToRad(-5 + index * 3),
          THREE.MathUtils.degToRad(index * 8),
        );
        layer.userData.origin = layer.position.clone();
        layer.userData.originRotation = layer.rotation.clone();
        layer.userData.breakVector = new THREE.Vector3(0, -0.15 * index, -0.42 - index * 0.14);

        layerMeshes.push(layer);
        layerGroup.add(layer);
      }

      for (let index = 0; index < signalCount; index += 1) {
        const lane = index / Math.max(signalCount - 1, 1);
        const y = -1.18 + lane * 2.58;
        const start = new THREE.Vector3(-2.28 + Math.sin(index) * 0.22, y, 0.32);
        const mid = new THREE.Vector3(Math.sin(index * 1.9) * 0.52, y + Math.cos(index) * 0.08, 0.54);
        const end = new THREE.Vector3(2.28 + Math.cos(index) * 0.22, y + Math.sin(index * 0.7) * 0.12, 0.32);
        const geometry = new THREE.BufferGeometry().setFromPoints([start, mid, end]);
        const line = new THREE.Line(geometry, signalMaterial);

        line.userData.origin = line.position.clone();
        line.userData.breakVector = new THREE.Vector3(
          Math.sin(index * 1.4) * 0.32,
          Math.cos(index * 0.9) * 0.24,
          0.38,
        );

        signalLines.push(line);
        signalGroup.add(line);
      }

      const nodeGeometry = new THREE.SphereGeometry(isCompact ? 0.026 : 0.034, isCompact ? 8 : 12, 6);

      for (let index = 0; index < nodeCount; index += 1) {
        const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial);
        const angle = index * 1.618;
        const radius = 0.9 + (index % 5) * 0.38;

        mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.55, 0.58 + (index % 3) * 0.12);
        mesh.userData.origin = mesh.position.clone();
        mesh.userData.breakVector = new THREE.Vector3(
          Math.cos(angle) * 0.48,
          Math.sin(angle) * 0.32,
          0.52,
        );

        nodeMeshes.push(mesh);
        signalGroup.add(mesh);
      }

      function render() {
        renderer.render(scene, camera);
      }

      function resize() {
        if (!mount || disposed) {
          return;
        }

        const width = Math.max(mount.clientWidth, 1);
        const height = Math.max(mount.clientHeight, 1);

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 720 ? 1.25 : 1.75));
        renderer.setSize(width, height, false);
        render();
      }

      function updateScrollProgress() {
        const maxScroll = Math.max(
          document.documentElement.scrollHeight - window.innerHeight,
          1,
        );
        scroll.target = THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1);

        if (reducedMotion) {
          scroll.current = scroll.target;
          applyFrame(0, 0);
          render();
        }
      }

      function setSignalBoost(event: Event) {
        const custom = event as CustomEvent<{ active?: boolean; intensity?: number; }>;
        const intensity =
          typeof custom.detail?.intensity === "number"
            ? THREE.MathUtils.clamp(custom.detail.intensity, 0, 1)
            : custom.detail?.active === false
              ? 0
              : 1;

        boost.target = intensity;

        if (reducedMotion) {
          boost.current = intensity;
          applyFrame(0, 0);
          render();
        }
      }

      function clearSignalBoost() {
        boost.target = 0;
      }

      function handlePointerMove(event: PointerEvent) {
        if (!mount) {
          return;
        }

        const rect = mount.getBoundingClientRect();

        targetMouse.x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
        targetMouse.y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      }

      function handleVisibility() {
        hidden = document.hidden;

        if (!hidden && inView && !reducedMotion) {
          lastFrameTime = performance.now();
          startLoop();
        }
      }

      function handleReducedMotion(event: MediaQueryListEvent) {
        reducedMotion = event.matches;

        if (reducedMotion) {
          stopLoop();
          applyFrame(0, 0);
          render();
        } else if (!hidden && inView) {
          startLoop();
        }
      }

      function applyFrame(delta: number, elapsed: number) {
        const scrollEase = reducedMotion ? 1 : 1 - Math.pow(0.0001, delta);
        const pointerEase = reducedMotion ? 1 : 1 - Math.pow(0.00008, delta);

        mouse.lerp(targetMouse, pointerEase);
        scroll.current = THREE.MathUtils.lerp(scroll.current, scroll.target, scrollEase);
        boost.current = THREE.MathUtils.lerp(boost.current, boost.target, pointerEase);

        targetRotation.x = -mouse.y * 0.13;
        targetRotation.y = mouse.x * 0.18;
        root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, targetRotation.x, pointerEase);
        root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, targetRotation.y, pointerEase);
        root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, mouse.x * 0.025, pointerEase);

        plateMeshes.forEach((mesh, index) => {
          const origin = mesh.userData.origin as Vector3;
          const originRotation = mesh.userData.originRotation as Euler;
          const breakVector = mesh.userData.breakVector as Vector3;
          const pulse = Math.sin(elapsed * 0.8 + index * 0.6) * 0.018;
          const deconstruct = scroll.current;

          mesh.position.set(
            origin.x + breakVector.x * deconstruct,
            origin.y + breakVector.y * deconstruct + pulse,
            origin.z + breakVector.z * deconstruct,
          );
          mesh.rotation.set(
            originRotation.x + deconstruct * (0.28 + (index % 3) * 0.04),
            originRotation.y + deconstruct * (0.34 + (index % 4) * 0.05),
            originRotation.z + deconstruct * (index % 2 === 0 ? 0.16 : -0.16),
          );
        });

        layerMeshes.forEach((layer, index) => {
          const origin = layer.userData.origin as Vector3;
          const originRotation = layer.userData.originRotation as Euler;
          const breakVector = layer.userData.breakVector as Vector3;

          layer.position.set(
            origin.x,
            origin.y + breakVector.y * scroll.current,
            origin.z + breakVector.z * scroll.current,
          );
          layer.rotation.set(
            originRotation.x,
            originRotation.y + Math.sin(elapsed * 0.3 + index) * 0.02,
            originRotation.z + scroll.current * (0.12 + index * 0.03),
          );
        });

        signalLines.forEach((line, index) => {
          const breakVector = line.userData.breakVector as Vector3;

          line.position.set(
            breakVector.x * scroll.current,
            breakVector.y * scroll.current,
            breakVector.z * scroll.current,
          );
          line.scale.x = 1 + boost.current * 0.08 + Math.sin(elapsed * 1.8 + index) * 0.012;
        });

        nodeMeshes.forEach((node, index) => {
          const origin = node.userData.origin as Vector3;
          const breakVector = node.userData.breakVector as Vector3;
          const pulse = 1 + Math.sin(elapsed * 2.2 + index) * 0.16 + boost.current * 0.9;

          node.position.set(
            origin.x + breakVector.x * scroll.current,
            origin.y + breakVector.y * scroll.current,
            origin.z + breakVector.z * scroll.current,
          );
          node.scale.setScalar(pulse);
        });

        signalMaterial.opacity = 0.42 + boost.current * 0.44;
        nodeMaterial.opacity = 0.66 + boost.current * 0.28;
        rimLight.intensity = 20 + boost.current * 22;
      }

      function tick() {
        if (disposed || hidden || !inView || reducedMotion) {
          frameId = 0;
          return;
        }

        const now = performance.now();
        const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
        lastFrameTime = now;
        elapsedTime += delta;
        applyFrame(delta, elapsedTime);
        render();
        frameId = window.requestAnimationFrame(tick);
      }

      function startLoop() {
        if (!frameId && !disposed && !hidden && inView && !reducedMotion) {
          lastFrameTime = performance.now();
          frameId = window.requestAnimationFrame(tick);
        }
      }

      function stopLoop() {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }
      }

      const observer = new IntersectionObserver(
        ([entry]) => {
          inView = entry.isIntersecting;

          if (inView) {
            resize();
            startLoop();
          } else {
            stopLoop();
          }
        },
        { threshold: 0.01 },
      );

      observer.observe(mount);
      resize();
      updateScrollProgress();

      window.addEventListener("resize", resize);
      window.addEventListener("scroll", updateScrollProgress, { passive: true });
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("morph-core:signal-clear", clearSignalBoost);
      document.addEventListener("visibilitychange", handleVisibility);
      mediaQuery.addEventListener("change", handleReducedMotion);

      for (const eventName of BOOST_EVENTS) {
        window.addEventListener(eventName, setSignalBoost);
      }

      if (reducedMotion) {
        applyFrame(0, 0);
        render();
      } else {
        startLoop();
      }

      cleanupScene = () => {
        disposed = true;
        window.clearTimeout(fallbackTimer);
        stopLoop();
        observer.disconnect();
        window.removeEventListener("resize", resize);
        window.removeEventListener("scroll", updateScrollProgress);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("morph-core:signal-clear", clearSignalBoost);
        document.removeEventListener("visibilitychange", handleVisibility);
        mediaQuery.removeEventListener("change", handleReducedMotion);

        for (const eventName of BOOST_EVENTS) {
          window.removeEventListener(eventName, setSignalBoost);
        }

        const disposedGeometries = new Set<DisposableGeometry>();
        const disposedMaterials = new Set<Material>();

        scene.traverse((object) => {
          const mesh = object as typeof object & DisposableSceneObject;

          if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
            mesh.geometry.dispose();
            disposedGeometries.add(mesh.geometry);
          }

          if (mesh.material) {
            const materialList = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

            for (const material of materialList) {
              if (!disposedMaterials.has(material)) {
                material.dispose();
                disposedMaterials.add(material);
              }
            }
          }
        });

        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    }

    void initialize();

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      cleanupScene?.();
      cleanupScene = undefined;
    };
  }, []);

  return (
    <figure
      aria-label="形态生成核心"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: "inherit",
        margin: 0,
        overflow: "hidden",
        isolation: "isolate",
        background: "transparent",
      }}
    >
      <div
        ref={mountRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
      />

      {webglFailed ? (
        <div
          role="img"
          aria-label="形态生成核心的静态结构预览"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            display: "grid",
            placeItems: "center",
            background: "transparent",
          }}
        >
          <div
            style={{
              width: "min(74vw, 520px)",
              aspectRatio: "1.8",
              border: "1px solid rgba(71, 203, 255, 0.34)",
              background:
                "linear-gradient(120deg, rgba(13, 22, 31, 0.95), rgba(23, 38, 50, 0.78)), repeating-linear-gradient(90deg, transparent 0 34px, rgba(45, 190, 255, 0.18) 35px 36px)",
              boxShadow: "0 0 72px rgba(25, 178, 255, 0.2)",
            }}
          />
        </div>
      ) : null}
    </figure>
  );
}
