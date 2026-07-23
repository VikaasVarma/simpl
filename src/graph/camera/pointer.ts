import type { OrthographicCamera } from "three";
import { screenToWorld } from "./coordinates";

export type WorldPoint = { x: number; y: number };

export function eventToWorld(
  event: PointerEvent | WheelEvent,
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
  const before = eventToWorld(event, element, camera);
  camera.zoom = targetZoom;
  camera.updateProjectionMatrix();
  const after = eventToWorld(event, element, camera);
  camera.position.x += before.x - after.x;
  camera.position.y += before.y - after.y;
}
