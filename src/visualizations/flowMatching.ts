import * as THREE from "three";
import { createGaussianSampler, createRng } from "./rng";
import {
  createRenderer,
  fit,
  onMountResize,
} from "../lib/visualizations/core/renderer";
import type { VisualizationFactory } from "./types";

const COUNT = 700;
const STEPS = 80;
const CYCLE_MS = 5200;
const VIEW_HALF_H = 1.35;

type Moon = 0 | 1;

function assignMoon(x: number, y: number): Moon {
  const left = (x + 0.5) ** 2 + (y + 0.25) ** 2;
  const right = (x - 0.5) ** 2 + (y - 0.25) ** 2;
  return left < right ? 0 : 1;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export const createFlowMatching: VisualizationFactory = (canvas, mount) => {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -VIEW_HALF_H,
    VIEW_HALF_H,
    VIEW_HALF_H,
    -VIEW_HALF_H,
    -1,
    1,
  );
  const rng = createRng(0xc0ffee);
  const gaussian = createGaussianSampler(rng);
  const length = STEPS + 1;
  const trajX = new Float32Array(COUNT * length);
  const trajY = new Float32Array(COUNT * length);

  for (let i = 0; i < COUNT; i++) {
    let x = gaussian() * 0.55;
    let y = gaussian() * 0.55;
    const moon = assignMoon(x, y);
    const theta = moon === 0 ? rng() * Math.PI : Math.PI + rng() * Math.PI;
    const targetX = (moon === 0 ? -0.5 : 0.5) + Math.cos(theta);
    const targetY = (moon === 0 ? -0.25 : 0.25) + Math.sin(theta);
    trajX[i * length] = x;
    trajY[i * length] = y;

    for (let step = 1; step <= STEPS; step++) {
      const t = step / STEPS;
      const centerX = moon === 0 ? -0.5 : 0.5;
      const centerY = moon === 0 ? -0.25 : 0.25;
      const blend = 0.65 + 0.35 * smoothstep(t);
      const tx = centerX * (1 - blend) + targetX * blend;
      const ty = centerY * (1 - blend) + targetY * blend;
      x += (tx - x) * 3.6 / STEPS;
      y += (ty - y) * 3.6 / STEPS;
      trajX[i * length + step] = x;
      trajY[i * length + step] = y;
    }
  }

  const positions = new Float32Array(COUNT * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x2c2825,
    size: 3.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.68,
  });
  scene.add(new THREE.Points(geometry, material));

  const stopResize = onMountResize(mount, (width, height) => {
    const halfW = VIEW_HALF_H * (width / height);
    camera.left = -halfW;
    camera.right = halfW;
    camera.updateProjectionMatrix();
    fit(renderer, canvas);
  });

  let raf = 0;
  let running = true;
  const started = performance.now();
  const tick = () => {
    if (!running) return;
    const phase = ((performance.now() - started) % CYCLE_MS) / CYCLE_MS;
    const push = smoothstep(Math.min(phase / 0.72, 1)) * 0.94;
    const step = push * STEPS;
    const a = Math.min(STEPS - 1, Math.floor(step));
    const b = a + 1;
    const mix = step - a;

    for (let i = 0; i < COUNT; i++) {
      const base = i * length;
      const x0 = trajX[base + a];
      const y0 = trajY[base + a];
      positions[i * 3] = x0 + (trajX[base + b] - x0) * mix;
      positions[i * 3 + 1] = y0 + (trajY[base + b] - y0) * mix;
    }
    material.opacity = phase > 0.84 ? 0.68 * (1 - smoothstep((phase - 0.84) / 0.16)) : 0.68;
    geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pause() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
    },
    resume() {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      stopResize();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
};
