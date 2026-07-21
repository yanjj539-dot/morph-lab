import { Camera, Vector3 } from "three";

import { JOURNEY_STAGES, type JourneyStageId } from "../../data/journey";
import { ROUND2_STAGE_ASSETS } from "../assets/assetManifest";
import { rangeProgress } from "../animation/progressMath";

type LabelRecord = {
  id: JourneyStageId;
  element: HTMLDivElement;
  anchor: Vector3;
};

export type ProjectedLabels = {
  update: (progress: number, camera: Camera) => void;
  resize: () => void;
  dispose: () => void;
};

export type ProjectedLabelsOptions = {
  className?: string;
};

const ACTIVE_WINDOWS: Record<JourneyStageId, readonly [number, number, number, number]> = {
  observe: [0, 0.03, 0.2, 0.3],
  structure: [0.2, 0.3, 0.45, 0.55],
  prototype: [0.45, 0.55, 0.7, 0.8],
  release: [0.7, 0.8, 1.01, 1.01],
};

function activeOpacity(stage: JourneyStageId, progress: number): number {
  const [inStart, inEnd, outStart, outEnd] = ACTIVE_WINDOWS[stage];
  return rangeProgress(inStart, inEnd, progress) * (1 - rangeProgress(outStart, outEnd, progress));
}

export function createProjectedLabels(
  container: HTMLElement,
  options: ProjectedLabelsOptions = {},
): ProjectedLabels {
  const labels: LabelRecord[] = JOURNEY_STAGES.map((stage) => {
    const element = document.createElement("div");
    element.className = options.className ?? "round2-projected-label";
    element.dataset.stage = stage.id;
    element.textContent = stage.labelText;
    element.setAttribute("aria-hidden", "true");
    container.appendChild(element);

    const root = ROUND2_STAGE_ASSETS[stage.id].rootPosition;
    return {
      id: stage.id,
      element,
      anchor: new Vector3(root[0], root[1] + 1.85, root[2] + 0.2),
    };
  });

  const projected = new Vector3();
  let width = container.clientWidth;
  let height = container.clientHeight;

  function resize(): void {
    width = container.clientWidth;
    height = container.clientHeight;
  }

  return {
    update(progress, camera) {
      for (const label of labels) {
        projected.copy(label.anchor).project(camera);

        const x = (projected.x * 0.5 + 0.5) * width;
        const y = (-projected.y * 0.5 + 0.5) * height;
        const visible = projected.z > -1 && projected.z < 1;
        const opacity = visible ? activeOpacity(label.id, progress) : 0;

        label.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        label.element.style.opacity = opacity.toFixed(3);
      }
    },
    resize,
    dispose() {
      for (const label of labels) {
        label.element.remove();
      }
    },
  };
}
