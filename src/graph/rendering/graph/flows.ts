import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";
import { FLOW } from "../../constants";
import type { Point } from "../../flows";

const Z = -30;
const BEND_STEPS = 5;
const EPS = 1e-6;

export type FlowLine = {
  path: readonly Point[];
  color: string;
  active: boolean;
  hovered: boolean;
};

export type FlowLayer = {
  group: Group;
  mesh: Mesh;
};

export function createFlowLayer(): FlowLayer {
  const group = new Group();
  const mesh = new Mesh(
    new BufferGeometry(),
    new MeshBasicMaterial({
      depthTest: false,
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
      vertexColors: true,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -119;
  group.frustumCulled = false;
  group.add(mesh);
  return { group, mesh };
}

export function drawFlows(layer: FlowLayer, lines: readonly FlowLine[]): void {
  layer.group.visible = true;
  const positions: number[] = [];
  const colors: number[] = [];
  for (const line of lines) emitFlowLine(positions, colors, line);
  setGeometry(layer.mesh, positions, colors);
}

function emitFlowLine(
  positions: number[],
  colors: number[],
  line: FlowLine,
): void {
  const highlighted = line.hovered || line.active;
  const color = flowColor(line.color, highlighted);
  const width = highlighted ? FLOW.width : FLOW.width * 0.52;
  const path = roundedPath(line.path);
  for (let i = 0; i < path.length - 1; i++) {
    emitSegment(positions, colors, path[i], path[i + 1], width, color);
  }
  emitArrow(positions, colors, path, color);
}

function roundedPath(path: readonly Point[]): Point[] {
  if (path.length < 3) return [...path];
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    const incoming = Math.hypot(b.x - a.x, b.y - a.y);
    const outgoing = Math.hypot(c.x - b.x, c.y - b.y);
    if (incoming < EPS || outgoing < EPS) continue;
    const r = Math.min(FLOW.bendRadius, incoming / 2, outgoing / 2);
    const p = {
      x: b.x - ((b.x - a.x) / incoming) * r,
      y: b.y - ((b.y - a.y) / incoming) * r,
    };
    const q = {
      x: b.x + ((c.x - b.x) / outgoing) * r,
      y: b.y + ((c.y - b.y) / outgoing) * r,
    };
    out.push(p);
    for (let j = 1; j < BEND_STEPS; j++) {
      const t = j / BEND_STEPS;
      out.push(quad(p, b, q, t));
    }
    out.push(q);
  }
  out.push(path[path.length - 1]);
  return out;
}

function quad(a: Point, b: Point, c: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    y: u * u * a.y + 2 * u * t * b.y + t * t * c.y,
  };
}

function setGeometry(mesh: Mesh, positions: number[], colors: number[]): void {
  mesh.geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  mesh.geometry.setAttribute(
    "color",
    new BufferAttribute(new Float32Array(colors), 3),
  );
  mesh.geometry.computeBoundingSphere();
}

function emitSegment(
  positions: number[],
  colors: number[],
  a: Point,
  b: Point,
  width: number,
  color: Color,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const px = (-dy / len) * width * 0.5;
  const py = (dx / len) * width * 0.5;
  emitTriangle(
    positions,
    colors,
    color,
    a.x - px,
    a.y - py,
    b.x - px,
    b.y - py,
    b.x + px,
    b.y + py,
  );
  emitTriangle(
    positions,
    colors,
    color,
    a.x - px,
    a.y - py,
    b.x + px,
    b.y + py,
    a.x + px,
    a.y + py,
  );
}

function emitArrow(
  positions: number[],
  colors: number[],
  path: readonly Point[],
  color: Color,
): void {
  const tip = path[path.length - 1];
  const prev = [...path]
    .reverse()
    .find((point) => Math.hypot(tip.x - point.x, tip.y - point.y) > EPS);
  if (!prev) return;
  const dx = tip.x - prev.x;
  const dy = tip.y - prev.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy * FLOW.arrowWidth * 0.5;
  const py = ux * FLOW.arrowWidth * 0.5;
  const bx = tip.x - ux * FLOW.arrowLength;
  const by = tip.y - uy * FLOW.arrowLength;
  emitTriangle(
    positions,
    colors,
    color,
    tip.x,
    tip.y,
    bx + px,
    by + py,
    bx - px,
    by - py,
  );
}

function emitTriangle(
  positions: number[],
  colors: number[],
  color: Color,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): void {
  positions.push(ax, ay, Z, bx, by, Z, cx, cy, Z);
  colors.push(
    color.r,
    color.g,
    color.b,
    color.r,
    color.g,
    color.b,
    color.r,
    color.g,
    color.b,
  );
}

function flowColor(color: string, highlighted: boolean): Color {
  const base = new Color(color);
  return highlighted ? base : base.lerp(new Color("#B4AEA6"), 0.76);
}
