import type { OrthographicCamera } from "three";

export type Point = { x: number; y: number };

export function worldToScreen(
  point: Point,
  camera: OrthographicCamera,
  width: number,
  height: number,
): Point {
  return {
    x: width / 2 + (point.x - camera.position.x) * camera.zoom,
    y: height / 2 - (point.y - camera.position.y) * camera.zoom,
  };
}

export function screenToWorld(
  point: Point,
  camera: OrthographicCamera,
  width: number,
  height: number,
): Point {
  return {
    x: (point.x - width / 2) / camera.zoom + camera.position.x,
    y: camera.position.y - (point.y - height / 2) / camera.zoom,
  };
}
