import * as THREE from "three";
import {
  createRenderer,
  fit,
  onMountResize,
} from "../lib/visualizations/core/renderer";
import type { VisualizationFactory } from "./types";

export const createSpinningCube: VisualizationFactory = (canvas, mount) => {
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(2.6, 1.8, 3.4);
  camera.lookAt(0, 0, 0);

  const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const material = new THREE.MeshStandardMaterial({
    color: 0xc1b496,
    roughness: 0.65,
    metalness: 0.08,
  });
  const cube = new THREE.Mesh(geometry, material);
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x3a3128 });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  scene.add(cube, edges);

  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(4, 6, 3);
  scene.add(key, new THREE.AmbientLight(0xfff4d8, 0.35));

  const stopResize = onMountResize(mount, (width, height) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    fit(renderer, canvas);
  });

  let raf = 0;
  let last = performance.now();
  let running = true;
  const tick = (time: number) => {
    if (!running) return;
    const dt = (time - last) / 1000;
    last = time;
    cube.rotation.x += dt * 0.4;
    cube.rotation.y += dt * 0.55;
    edges.rotation.copy(cube.rotation);
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
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      stopResize();
      geometry.dispose();
      material.dispose();
      edgesGeometry.dispose();
      edgesMaterial.dispose();
      renderer.dispose();
    },
  };
};
