import type { OrthographicCamera } from "three";
import { screenToWorld } from "./coordinates";

export type WorldPoint = { x: number; y: number };

export function eventToWorld(
  event: MouseEvent | WheelEvent,
  element: HTMLElement,
  camera: OrthographicCamera,
): WorldPoint {
  const rect = element.getBoundingClientRect();
  return screenToWorld(
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    camera,
    rect.width,
    rect.height,
  );
}

export function zoomAt(
  camera: OrthographicCamera,
  event: WheelEvent,
  element: HTMLElement,
  targetZoom: number,
): void {
  const rect = element.getBoundingClientRect();
  zoomAtScreen(
    camera,
    { x: event.clientX - rect.left, y: event.clientY - rect.top },
    element,
    targetZoom,
  );
}

export function zoomAtScreen(
  camera: OrthographicCamera,
  screen: WorldPoint,
  element: HTMLElement,
  targetZoom: number,
): void {
  const before = screenToWorld(
    screen,
    camera,
    element.clientWidth,
    element.clientHeight,
  );
  camera.zoom = targetZoom;
  camera.updateProjectionMatrix();
  const after = screenToWorld(
    screen,
    camera,
    element.clientWidth,
    element.clientHeight,
  );
  camera.position.x += before.x - after.x;
  camera.position.y += before.y - after.y;
}
