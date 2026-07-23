import type { OrthographicCamera } from "three";
import { worldToScreen } from "../graph/camera";
import type { FlowLayout, Point } from "../graph/flows";

export type FlowLabel = {
  id: string;
  sourceId: string;
  text: string;
  x: number;
  y: number;
  align: "left" | "right";
  opacity: number;
  colorIndex: number;
};

export type FlowLabelInput = {
  flows: readonly FlowLayout[];
  camera: OrthographicCamera;
  width: number;
  height: number;
  targetOpacity: (id: string) => number;
  sourceTitle: (id: string) => string;
};

export type FlowLabelActions = {
  focusById: (id: string) => void;
  setHoveredFlowId: (id: string | null) => void;
};

export type FlowLabelLayer = {
  element: HTMLElement;
  actions: FlowLabelActions;
};

const noopActions: FlowLabelActions = {
  focusById: () => {},
  setHoveredFlowId: () => {},
};
const PAD = 14;
const SIDE_PAD = 18;

export function createFlowLabelLayer(): FlowLabelLayer {
  const element = document.createElement("div");
  element.className = "graph-flow-labels";
  return { element, actions: noopActions };
}

export function bindFlowLabels(
  layer: FlowLabelLayer,
  actions: FlowLabelActions,
): void {
  layer.actions = actions;
}

export function drawFlowLabels(
  layer: FlowLabelLayer,
  labels: readonly FlowLabel[],
): void {
  const live = new Set(labels.map((label) => label.id));
  layer.element
    .querySelectorAll<HTMLElement>(".graph-flow-label")
    .forEach((element) => {
      if (!live.has(element.dataset.flowId ?? "")) element.remove();
    });

  for (const label of labels) {
    const element = buttonFor(layer, label);
    element.dataset.sourceId = label.sourceId;
    element.dataset.color = String(label.colorIndex);
    element.dataset.align = label.align;
    element.style.left = `${label.x}px`;
    element.style.top = `${label.y}px`;
    element.style.opacity = String(label.opacity);
    if (element.textContent !== label.text) element.textContent = label.text;
  }
}

function buttonFor(layer: FlowLabelLayer, label: FlowLabel): HTMLButtonElement {
  const existing = layer.element.querySelector<HTMLButtonElement>(
    `.graph-flow-label[data-flow-id="${CSS.escape(label.id)}"]`,
  );
  if (existing) return existing;

  const element = document.createElement("button");
  element.type = "button";
  element.className = "graph-flow-label";
  element.dataset.flowId = label.id;
  element.addEventListener("mouseenter", () =>
    layer.actions.setHoveredFlowId(label.id),
  );
  element.addEventListener("mouseleave", () =>
    layer.actions.setHoveredFlowId(null),
  );
  element.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    layer.actions.focusById(element.dataset.sourceId ?? "");
  });
  layer.element.append(element);
  return element;
}

export function flowLabelsFor(input: FlowLabelInput): FlowLabel[] {
  return input.flows
    .filter(
      (flow) =>
        input.targetOpacity(flow.target.id) > 0 &&
        flow.source.id !== flow.target.id,
    )
    .map((flow) => {
      const placement = labelPlacement(flow, input);
      return {
        id: flow.id,
        sourceId: flow.source.id,
        text: `${placement.arrow} back to ${input.sourceTitle(flow.source.id)}`,
        x: placement.point.x,
        y: placement.point.y,
        align: placement.align,
        opacity: input.targetOpacity(flow.target.id),
        colorIndex: flow.colorIndex,
      };
    });
}

function labelPlacement(
  flow: FlowLayout,
  input: FlowLabelInput,
): { point: Point; align: FlowLabel["align"]; arrow: string } {
  const route = [...flow.route]
    .reverse()
    .map((point) =>
      worldToScreen(point, input.camera, input.width, input.height),
    );
  const p0 = route[0] ?? { x: 0, y: 0 };
  const d0 = unit(delta(route[0], route[1]));
  const horizontal = Math.abs(d0.x) >= Math.abs(d0.y);
  const d1 = unit(delta(route[1], route[2]));
  const side = horizontal ? { x: -d1.x, y: -d1.y } : { x: 1, y: 0 };
  const point = {
    x: p0.x + d0.x * PAD + side.x * SIDE_PAD,
    y: p0.y + d0.y * PAD + side.y * SIDE_PAD,
  };
  const align = d0.x < 0 ? "right" : "left";
  return {
    align,
    arrow: arrowFor(d0),
    point,
  };
}

function delta(a?: Point, b?: Point): Point {
  return a && b ? { x: b.x - a.x, y: b.y - a.y } : { x: 1, y: 0 };
}

function unit(point: Point): Point {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

function arrowFor(direction: Point): string {
  if (Math.abs(direction.x) >= Math.abs(direction.y))
    return direction.x < 0 ? "←" : "→";
  return direction.y < 0 ? "↑" : "↓";
}
