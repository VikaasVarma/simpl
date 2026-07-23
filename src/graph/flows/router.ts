import type { FlowEndpoint, Point, Rect } from "./types";
import {
  expandRect,
  orthogonalSegmentIntersectsRect,
  rectBottom,
  rectLeft,
  rectRight,
  rectTop,
} from "../utils/geometry";

const STUB = 48;
const EPS = 1e-6;

export function routeFlow(source: FlowEndpoint, target: FlowEndpoint): Point[] {
  const start = source.anchor;
  const end = target.anchor;

  const startStub = step(source);
  const endStub = step(target);

  const obstacles = [
    expandRect(source.rect, STUB),
    expandRect(target.rect, STUB),
  ];

  let path: Point[] = [startStub, endStub];

  for (const route of candidates(startStub, endStub, obstacles)) {
    path = simplify(route);
    if (!intersects(path, obstacles)) break;
  }

  return [start, ...path, end];
}

function* candidates(
  from: Point,
  to: Point,
  obstacles: Rect[],
): Generator<Point[]> {
  // One-bend routes.
  yield [from, { x: to.x, y: from.y }, to];
  yield [from, { x: from.x, y: to.y }, to];

  // Two-bend routes through vertical or horizontal lanes.
  const xs = [
    to.x,
    (from.x + to.x) / 2,
    ...obstacles.flatMap((rect) => [rectLeft(rect), rectRight(rect)]),
  ];
  const ys = [
    to.y,
    (from.y + to.y) / 2,
    ...obstacles.flatMap((rect) => [rectBottom(rect), rectTop(rect)]),
  ];

  for (const x of xs) yield [from, { x, y: from.y }, { x, y: to.y }, to];
  for (const y of ys) yield [from, { x: from.x, y }, { x: to.x, y }, to];

  // Three-bend routes through one vertical lane and one horizontal lane.
  for (const x of xs) {
    for (const y of ys) {
      yield [from, { x, y: from.y }, { x, y }, { x: to.x, y }, to];
      yield [from, { x: from.x, y }, { x, y }, { x, y: to.y }, to];
    }
  }
}

function step(point: FlowEndpoint): Point {
  return {
    x: point.anchor.x + point.normal.x * STUB,
    y: point.anchor.y + point.normal.y * STUB,
  };
}

function intersects(path: Point[], obstacles: Rect[]): boolean {
  return path.some(
    (point, i) =>
      i > 0 &&
      obstacles.some((rect) =>
        orthogonalSegmentIntersectsRect(path[i - 1], point, rect),
      ),
  );
}

function simplify(points: Point[]): Point[] {
  const path: Point[] = [];
  for (const point of points) {
    const last = path[path.length - 1];

    // Skip duplicate points.
    if (last && almostEqual(last.x, point.x) && almostEqual(last.y, point.y))
      continue;

    // Skip collinear points.
    const previous = path[path.length - 2];
    if (
      previous &&
      last &&
      ((almostEqual(previous.x, last.x) && almostEqual(last.x, point.x)) ||
        (almostEqual(previous.y, last.y) && almostEqual(last.y, point.y)))
    ) {
      path.pop();
    }

    path.push(point);
  }
  return path;
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}
