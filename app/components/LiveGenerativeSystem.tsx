"use client";

import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Point = {
  x: number;
  y: number;
};

type NodePoint = Point & {
  vx: number;
  vy: number;
  age: number;
};

type MetricState = {
  nodes: number;
  connections: number;
  motion: number;
  systemState: "Idle" | "Tracking" | "Active" | "Paused";
};

const GRID_COLUMNS = 18;
const GRID_ROWS = 11;
const MAX_NODES = 18;
const CONNECTION_RADIUS = 170;
const POINTER_RADIUS = 150;
const MAX_DPR = 2;
const FRAME_INTERVAL_REDUCED = 180;

const initialMetrics: MetricState = {
  nodes: 0,
  connections: 0,
  motion: 0,
  systemState: "Idle",
};

const styles = {
  shell: {
    background: "#111315",
    color: "#f2efe6",
    border: "1px solid rgba(242, 239, 230, 0.16)",
    borderRadius: 8,
    overflow: "hidden",
    fontFamily:
      "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 18px 12px",
    borderBottom: "1px solid rgba(242, 239, 230, 0.1)",
  },
  title: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.1,
    letterSpacing: 0,
    fontWeight: 700,
  },
  subtitle: {
    margin: "7px 0 0",
    maxWidth: 560,
    color: "rgba(242, 239, 230, 0.64)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  resetButton: {
    border: "1px solid rgba(79, 179, 255, 0.46)",
    background: "#151a1e",
    color: "#f2efe6",
    borderRadius: 6,
    minHeight: 36,
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 650,
    cursor: "pointer",
  },
  canvasWrap: {
    position: "relative",
    minHeight: 420,
    height: "min(62vw, 560px)",
    background: "#0d0f11",
  },
  canvas: {
    display: "block",
    width: "100%",
    height: "100%",
    outline: "none",
    touchAction: "none",
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(120px, 1fr))",
    borderTop: "1px solid rgba(242, 239, 230, 0.1)",
  },
  metric: {
    padding: "13px 16px",
    borderRight: "1px solid rgba(242, 239, 230, 0.09)",
  },
  metricLabel: {
    display: "block",
    color: "rgba(242, 239, 230, 0.54)",
    fontSize: 11,
    lineHeight: 1.2,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  metricValue: {
    display: "block",
    marginTop: 6,
    color: "#f2efe6",
    fontVariantNumeric: "tabular-nums",
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 700,
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  },
} satisfies Record<string, CSSProperties>;

function buildSeed(width: number, height: number): Point[] {
  const insetX = Math.max(28, width * 0.055);
  const insetY = Math.max(28, height * 0.075);
  const usableWidth = Math.max(1, width - insetX * 2);
  const usableHeight = Math.max(1, height - insetY * 2);
  const points: Point[] = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let col = 0; col < GRID_COLUMNS; col += 1) {
      points.push({
        x: insetX + (usableWidth * col) / (GRID_COLUMNS - 1),
        y: insetY + (usableHeight * row) / (GRID_ROWS - 1),
      });
    }
  }

  return points;
}

function drawNode(
  context: CanvasRenderingContext2D,
  node: NodePoint,
  index: number,
) {
  const pulse = 1 + Math.sin(node.age * 0.055 + index) * 0.14;

  context.beginPath();
  context.arc(node.x, node.y, 4.7 * pulse, 0, Math.PI * 2);
  context.fillStyle = "#4fb3ff";
  context.fill();

  context.beginPath();
  context.arc(node.x, node.y, 10.5 * pulse, 0, Math.PI * 2);
  context.strokeStyle = "rgba(79, 179, 255, 0.34)";
  context.lineWidth = 1;
  context.stroke();
}

export default function LiveGenerativeSystem() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const seedRef = useRef<Point[]>([]);
  const pointerRef = useRef<Point & { active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const nodesRef = useRef<NodePoint[]>([]);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const renderRef = useRef<(time: number) => void>(() => {});
  const lastFrameRef = useRef(0);
  const lastMetricsRef = useRef(initialMetrics);
  const [metrics, setMetrics] = useState<MetricState>(initialMetrics);

  const publishMetrics = useCallback((next: MetricState) => {
    const previous = lastMetricsRef.current;

    if (
      previous.nodes !== next.nodes ||
      previous.connections !== next.connections ||
      previous.motion !== next.motion ||
      previous.systemState !== next.systemState
    ) {
      lastMetricsRef.current = next;
      setMetrics(next);
    }
  }, []);

  const addNode = useCallback((point: Point) => {
    nodesRef.current = [
      ...nodesRef.current.slice(Math.max(0, nodesRef.current.length - MAX_NODES + 1)),
      {
        x: point.x,
        y: point.y,
        vx: 0,
        vy: 0,
        age: 0,
      },
    ];
  }, []);

  const reset = useCallback(() => {
    nodesRef.current = [];
    pointerRef.current.active = false;
    publishMetrics(initialMetrics);
  }, [publishMetrics]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(300, Math.round(rect.height));
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    sizeRef.current = { width, height, dpr };
    seedRef.current = buildSeed(width, height);
    pointerRef.current.x = width / 2;
    pointerRef.current.y = height / 2;
  }, []);

  const canvasPointFromEvent = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }, []);

  const queueFrame = useCallback(() => {
    frameRef.current = window.requestAnimationFrame((nextTime) => {
      renderRef.current(nextTime);
    });
  }, []);

  const render = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");

      if (!canvas || !context) {
        return;
      }

      const isPaused = pausedRef.current || !visibleRef.current;
      const reducedMotion = reducedMotionRef.current;

      if (
        reducedMotion &&
        lastFrameRef.current &&
        time - lastFrameRef.current < FRAME_INTERVAL_REDUCED
      ) {
        queueFrame();
        return;
      }

      lastFrameRef.current = time;

      const { width, height, dpr } = sizeRef.current;
      const seed = seedRef.current;
      const pointer = pointerRef.current;
      const nodePoints = nodesRef.current;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#0d0f11";
      context.fillRect(0, 0, width, height);

      const deformed = seed.map((point, index) => {
        const col = index % GRID_COLUMNS;
        const row = Math.floor(index / GRID_COLUMNS);
        const phase = reducedMotion ? 0 : time * 0.00035 + col * 0.36 + row * 0.27;
        const idleX = Math.sin(phase) * 2.2;
        const idleY = Math.cos(phase * 1.1) * 1.7;
        let x = point.x + idleX;
        let y = point.y + idleY;

        if (!isPaused && pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const force = Math.max(0, 1 - distance / POINTER_RADIUS);

          if (force > 0) {
            const angle = Math.atan2(dy, dx);
            const push = force * force * 34;
            x += Math.cos(angle) * push;
            y += Math.sin(angle) * push;
          }
        }

        for (const node of nodePoints) {
          const dx = x - node.x;
          const dy = y - node.y;
          const distance = Math.hypot(dx, dy);
          const force = Math.max(0, 1 - distance / 118);

          if (force > 0) {
            x += dx * force * 0.08;
            y += dy * force * 0.08;
          }
        }

        return { x, y };
      });

      context.lineCap = "round";
      context.lineJoin = "round";

      for (let row = 0; row < GRID_ROWS; row += 1) {
        context.beginPath();
        for (let col = 0; col < GRID_COLUMNS; col += 1) {
          const point = deformed[row * GRID_COLUMNS + col];
          if (col === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.strokeStyle = "rgba(242, 239, 230, 0.16)";
        context.lineWidth = 0.72;
        context.stroke();
      }

      for (let col = 0; col < GRID_COLUMNS; col += 1) {
        context.beginPath();
        for (let row = 0; row < GRID_ROWS; row += 1) {
          const point = deformed[row * GRID_COLUMNS + col];
          if (row === 0) {
            context.moveTo(point.x, point.y);
          } else {
            context.lineTo(point.x, point.y);
          }
        }
        context.strokeStyle = "rgba(242, 239, 230, 0.12)";
        context.lineWidth = 0.62;
        context.stroke();
      }

      for (let row = 0; row < GRID_ROWS - 1; row += 2) {
        for (let col = 0; col < GRID_COLUMNS - 1; col += 3) {
          const a = deformed[row * GRID_COLUMNS + col];
          const b = deformed[row * GRID_COLUMNS + col + 1];
          const c = deformed[(row + 1) * GRID_COLUMNS + col + 1];
          const d = deformed[(row + 1) * GRID_COLUMNS + col];
          context.beginPath();
          context.moveTo(a.x, a.y);
          context.lineTo(b.x, b.y);
          context.lineTo(c.x, c.y);
          context.lineTo(d.x, d.y);
          context.closePath();
          context.fillStyle = "rgba(242, 239, 230, 0.035)";
          context.fill();
        }
      }

      let connectionCount = 0;
      let motion = 0;

      for (let i = 0; i < nodePoints.length; i += 1) {
        const node = nodePoints[i];

        if (!isPaused && !reducedMotion) {
          const home = seed[(i * 23 + 19) % seed.length] ?? {
            x: width / 2,
            y: height / 2,
          };
          node.vx += (home.x - node.x) * 0.0009;
          node.vy += (home.y - node.y) * 0.0009;
          node.vx *= 0.965;
          node.vy *= 0.965;
          node.x += node.vx;
          node.y += node.vy;
          node.age += 1;
        }

        node.x = Math.min(width - 18, Math.max(18, node.x));
        node.y = Math.min(height - 18, Math.max(18, node.y));
        motion += Math.hypot(node.vx, node.vy);
      }

      for (let i = 0; i < nodePoints.length; i += 1) {
        for (let j = i + 1; j < nodePoints.length; j += 1) {
          const a = nodePoints[i];
          const b = nodePoints[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance < CONNECTION_RADIUS) {
            const alpha = 0.5 * (1 - distance / CONNECTION_RADIUS);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.strokeStyle = `rgba(79, 179, 255, ${alpha.toFixed(3)})`;
            context.lineWidth = 1;
            context.stroke();
            connectionCount += 1;
          }
        }
      }

      nodePoints.forEach((node, index) => drawNode(context, node, index));

      if (!isPaused && pointer.active) {
        context.beginPath();
        context.arc(pointer.x, pointer.y, 22, 0, Math.PI * 2);
        context.strokeStyle = "rgba(79, 179, 255, 0.22)";
        context.lineWidth = 1;
        context.stroke();
      }

      const normalizedMotion = Math.min(99, Math.round(motion * 9));
      const systemState: MetricState["systemState"] = isPaused
        ? "Paused"
        : nodePoints.length > 0
          ? "Active"
          : pointer.active
            ? "Tracking"
            : "Idle";

      publishMetrics({
        nodes: nodePoints.length,
        connections: connectionCount,
        motion: normalizedMotion,
        systemState,
      });

      queueFrame();
    },
    [publishMetrics, queueFrame],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => {
      reducedMotionRef.current = motionQuery.matches;
    };
    const updateVisibility = () => {
      pausedRef.current = document.hidden;
    };
    const handlePointerMove = (event: PointerEvent) => {
      const point = canvasPointFromEvent(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      pointerRef.current = { ...point, active: true };
    };
    const handlePointerLeave = () => {
      pointerRef.current.active = false;
    };
    const handlePointerDown = (event: PointerEvent) => {
      const point = canvasPointFromEvent(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      pointerRef.current = { ...point, active: true };
      addNode(point);
      canvas.setPointerCapture?.(event.pointerId);
    };
    const resizeObserver = new ResizeObserver(resizeCanvas);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting ?? true;
    });

    updateMotionPreference();
    updateVisibility();
    resizeCanvas();
    renderRef.current = render;
    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("visibilitychange", updateVisibility);
    motionQuery.addEventListener("change", updateMotionPreference);
    queueFrame();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("visibilitychange", updateVisibility);
      motionQuery.removeEventListener("change", updateMotionPreference);
    };
  }, [addNode, canvasPointFromEvent, queueFrame, render, resizeCanvas]);

  const handleCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    const { width, height } = sizeRef.current;
    const pointer = pointerRef.current;
    addNode(pointer.active ? pointer : { x: width / 2, y: height / 2 });
  };

  return (
    <section
      aria-labelledby="live-generative-system-title"
      style={styles.shell}
    >
      <div style={styles.header}>
        <div>
          <h2 id="live-generative-system-title" style={styles.title}>
            LIVE GENERATIVE SYSTEM
          </h2>
          <p style={styles.subtitle}>
            A bounded vector field that responds to pointer input and settles
            back into its seeded geometry.
          </p>
        </div>
        <button type="button" onClick={reset} style={styles.resetButton}>
          Reset
        </button>
      </div>

      <div style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          aria-describedby="live-generative-system-alt"
          aria-label="Interactive precision vector grid. Move the pointer to deform the grid. Click, tap, or press Enter to add a node."
          onKeyDown={handleCanvasKeyDown}
          role="img"
          style={styles.canvas}
          tabIndex={0}
        />
        <p id="live-generative-system-alt" style={styles.srOnly}>
          The module draws a graphite canvas with a thin off-white vector grid,
          electric blue nodes, nearby node connections, and restrained
          translucent grid faces. Motion slows when reduced motion is requested.
        </p>
      </div>

      <dl style={styles.metrics} aria-live="polite">
        <div style={styles.metric}>
          <dt style={styles.metricLabel}>Nodes</dt>
          <dd style={styles.metricValue}>{metrics.nodes}</dd>
        </div>
        <div style={styles.metric}>
          <dt style={styles.metricLabel}>Connections</dt>
          <dd style={styles.metricValue}>{metrics.connections}</dd>
        </div>
        <div style={styles.metric}>
          <dt style={styles.metricLabel}>Motion</dt>
          <dd style={styles.metricValue}>{metrics.motion}%</dd>
        </div>
        <div style={{ ...styles.metric, borderRight: 0 }}>
          <dt style={styles.metricLabel}>System State</dt>
          <dd style={styles.metricValue}>{metrics.systemState}</dd>
        </div>
      </dl>
    </section>
  );
}
