import { clamp } from "./math";

export type PointLike = { x: number; y: number };

function dot(a: PointLike, b: PointLike): number {
  return a.x * b.x + a.y * b.y;
}

export function distance(a: PointLike, b: PointLike): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pointSegmentDistance(
  point: PointLike,
  a: PointLike,
  b: PointLike,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return distance(point, a);
  const t = clamp(
    dot({ x: point.x - a.x, y: point.y - a.y }, { x: dx, y: dy }) / len2,
    0,
    1,
  );
  return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}
