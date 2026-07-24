import { OrthographicCamera } from "three";
import { CAMERA } from "../constants";
import { cameraProfileForViewport } from "./profile";
import type { SimNode } from "../simulation/types";
import { easeOutCubic, lerp, smoothstep } from "../utils/math";

type ZoomView = {
  x: number;
  y: number;
  worldWidth: number;
};

export function focusCamera(
  camera: OrthographicCamera,
  node: SimNode,
  element: HTMLElement,
  onFrame: () => void,
  onDone?: () => void,
): () => void {
  const { width, height } = element.getBoundingClientRect();
  const screenWidth = Math.max(1, width);
  const profile = cameraProfileForViewport(width, height);

  const path = vanWijkPath(
    camera.position.x,
    camera.position.y,
    screenWidth / camera.zoom,
    node.x,
    node.y,
    screenWidth / profile.focusZoom,
  );

  const start = performance.now();
  let frame = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / CAMERA.focusMs);
    const view = path(easeOutCubic(t));

    const follow = smoothstep(t);
    camera.position.x = t >= 1 ? node.x : lerp(view.x, node.x, follow);
    camera.position.y = t >= 1 ? node.y : lerp(view.y, node.y, follow);

    camera.zoom = t >= 1 ? profile.focusZoom : screenWidth / view.worldWidth;

    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    onFrame();
    if (t < 1) frame = requestAnimationFrame(tick);
    else onDone?.();
  };

  frame = requestAnimationFrame(tick);
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
  };
}

// Van Wijk zoom paths model the camera as center (x, y) plus visible world width.
// The Three.js orthographic zoom is recovered as screenWidth / worldWidth.
function vanWijkPath(
  x0: number,
  y0: number,
  worldWidth0: number,
  x1: number,
  y1: number,
  worldWidth1: number,
): (t: number) => ZoomView {
  const rho = Math.SQRT2;
  const rho2 = 2;
  const rho4 = 4;
  const epsilon = 1e-6;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d2 = dx * dx + dy * dy;

  if (d2 < epsilon * epsilon) {
    return (t) => ({
      x: lerp(x0, x1, t),
      y: lerp(y0, y1, t),
      worldWidth:
        worldWidth0 * Math.exp(Math.log(worldWidth1 / worldWidth0) * t),
    });
  }

  const d = Math.sqrt(d2);
  const b0 =
    (worldWidth1 * worldWidth1 - worldWidth0 * worldWidth0 + rho4 * d2) /
    (2 * worldWidth0 * rho2 * d);
  const b1 =
    (worldWidth1 * worldWidth1 - worldWidth0 * worldWidth0 - rho4 * d2) /
    (2 * worldWidth1 * rho2 * d);
  const r0 = -Math.asinh(b0);
  const r1 = -Math.asinh(b1);
  const sTotal = (r1 - r0) / rho;
  const coshr0 = Math.cosh(r0);
  const sinhr0 = Math.sinh(r0);

  return (t) => {
    const s = t * sTotal;
    const r = rho * s + r0;
    const u = (worldWidth0 / (rho2 * d)) * (coshr0 * Math.tanh(r) - sinhr0);
    return {
      x: x0 + u * dx,
      y: y0 + u * dy,
      worldWidth: (worldWidth0 * coshr0) / Math.cosh(r),
    };
  };
}
