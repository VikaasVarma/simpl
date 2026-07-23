import { OrthographicCamera } from "three";
import { CAMERA, NOTE } from "../constants";
import type { SimNode } from "../simulation/types";

export function createCamera(): OrthographicCamera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
  camera.position.z = 100;
  return camera;
}

export function resizeCamera(
  camera: OrthographicCamera,
  width: number,
  height: number,
): void {
  camera.left = -width / 2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = -height / 2;
  camera.updateProjectionMatrix();
}

export function fitCamera(
  camera: OrthographicCamera,
  nodes: SimNode[],
  width: number,
  height: number,
): void {
  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));

  camera.position.set((minX + maxX) / 2, (minY + maxY) / 2, 100);
  camera.zoom = Math.max(
    CAMERA.minZoom,
    Math.min(
      width / (maxX - minX + NOTE.w * 3),
      height / (maxY - minY + NOTE.w * 3),
    ),
  );
  camera.updateProjectionMatrix();
}

export function followNode(camera: OrthographicCamera, node: SimNode): void {
  camera.position.x = node.x;
  camera.position.y = node.y;
  camera.updateMatrixWorld();
}
