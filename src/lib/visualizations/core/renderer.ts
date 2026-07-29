import * as THREE from "three";

const PIXEL_RATIO = Math.min(window.devicePixelRatio * 5, 12);
const COMPOSITION_ASPECT = 16 / 9;

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.sortObjects = false;
  renderer.setPixelRatio(PIXEL_RATIO);
  fit(renderer, canvas);
  return renderer;
}

export function fit(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(w, h, /* updateStyle */ false);
}

export function fitComposition(
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  camera: THREE.OrthographicCamera,
  halfH: number,
  halfW = halfH * COMPOSITION_ASPECT,
): void {
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  fit(renderer, canvas);
}

export function onMountResize(
  mount: HTMLElement,
  onResize: (w: number, h: number) => void,
): () => void {
  const ro = new ResizeObserver(() => {
    const { width, height } = mount.getBoundingClientRect();
    if (width > 0 && height > 0) onResize(width, height);
  });
  ro.observe(mount);
  return () => ro.disconnect();
}
