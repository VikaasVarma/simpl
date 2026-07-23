import { clamp } from "../utils/math";
import type { FlowEndpoint, Point, Rect } from "./types";

const EPS = 1e-6;

export function endpointFromAngle(
  id: string,
  rect: Rect,
  angle: number,
): FlowEndpoint {
  const vector = { x: Math.cos(angle), y: Math.sin(angle) };
  const hw = rect.w / 2;
  const hh = rect.h / 2;
  const tx = Math.abs(vector.x) < EPS ? Infinity : hw / Math.abs(vector.x);
  const ty = Math.abs(vector.y) < EPS ? Infinity : hh / Math.abs(vector.y);

  if (tx < ty) {
    const normal = { x: Math.sign(vector.x || 1), y: 0 };
    return {
      id,
      rect,
      anchor: {
        x: rect.x + normal.x * hw,
        y: clamp(rect.y + vector.y * tx, rect.y - hh, rect.y + hh),
      },
      normal,
    };
  }

  const normal = { x: 0, y: Math.sign(vector.y || 1) };
  return {
    id,
    rect,
    anchor: {
      x: clamp(rect.x + vector.x * ty, rect.x - hw, rect.x + hw),
      y: rect.y + normal.y * hh,
    },
    normal,
  };
}

export function edgeEndpoint(
  id: string,
  rect: Rect,
  point: Point,
): FlowEndpoint {
  const normal = nearestRectNormal(rect, point);
  const horizontal = normal.y !== 0;
  return {
    id,
    rect,
    anchor: {
      x: horizontal
        ? clamp(point.x, rect.x - rect.w / 2, rect.x + rect.w / 2)
        : rect.x + (normal.x * rect.w) / 2,
      y: horizontal
        ? rect.y + (normal.y * rect.h) / 2
        : clamp(point.y, rect.y - rect.h / 2, rect.y + rect.h / 2),
    },
    normal,
  };
}

function nearestRectNormal(rect: Rect, point: Point): Point {
  const dx = point.x - rect.x;
  const dy = point.y - rect.y;
  const toVertical = rect.w / 2 - Math.abs(dx);
  const toHorizontal = rect.h / 2 - Math.abs(dy);
  return toVertical < toHorizontal
    ? { x: Math.sign(dx || 1), y: 0 }
    : { x: 0, y: Math.sign(dy || 1) };
}
