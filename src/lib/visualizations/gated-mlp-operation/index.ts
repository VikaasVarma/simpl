import * as THREE from "three";
import {
  createRenderer,
  fitComposition,
  onMountResize,
} from "../core/renderer";
import { PALETTE } from "../core/palette";
import {
  createBlock,
  createDisc,
  createLabelText,
  createPathFlow,
  createStroke,
  createTrapezoidBlock,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import type { VisualizationFactory } from "../core/types";

const Z_LINE = 0;
const Z_FLOW = 5;
const Z_BLOCK = 10;
const Z_TEXT = 20;
const CYCLE_MS = 3000;
const GATE: Vec2[] = [
  [-1.45, 0],
  [-1.18, 0],
  [-1.18, 0.28],
  [0.18, 0.28],
  [0.18, 0],
];
const UP: Vec2[] = [
  [-1.45, 0],
  [-1.18, 0],
  [-1.18, -0.28],
  [0.18, -0.28],
  [0.18, 0],
];
const OUT: Vec2[] = [
  [0.18, 0],
  [1.35, 0],
];

export const createGatedMlpOperation: VisualizationFactory = (
  canvas,
  mount,
) => {
  const renderer = createRenderer(canvas);
  renderer.setClearAlpha(0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const prims: Primitive[] = [];
  const add = (p: Primitive, z: number) => {
    p.mesh.renderOrder = z;
    p.mesh.traverse((obj) => (obj.renderOrder = z));
    prims.push(p);
    scene.add(p.mesh);
  };

  for (const path of [GATE, UP]) {
    add(createStroke(path, { opacity: 0.58 }), Z_LINE);
  }
  add(createStroke(OUT, { arrow: true, opacity: 0.58 }), Z_LINE);
  flow(GATE, PALETTE.SIGNAL.GREEN, PALETTE.SIGNAL.AMBER);
  flow(UP, PALETTE.SIGNAL.BLUE, PALETTE.SIGNAL.BLUE);
  flow(OUT, PALETTE.SIGNAL.VIOLET, PALETTE.SIGNAL.VIOLET);

  add(token(-1.45, PALETTE.INK_SOFT), Z_BLOCK);
  add(token(1.35, PALETTE.SIGNAL.VIOLET), Z_BLOCK);
  trapezoid("W_gate", -0.72, 0.28, "left", PALETTE.SURFACE.SAGE);
  block("σ", -0.25, 0.28, PALETTE.SURFACE.PEACH);
  trapezoid("W_in", -0.72, -0.28, "left", PALETTE.SURFACE.SKY);
  block("⊙", 0.18, 0, PALETTE.SURFACE.STONE);
  trapezoid("W_out", 0.78, 0, "right", PALETTE.SURFACE.LILAC);

  const resize = () => fitComposition(renderer, canvas, camera, 0.48, 1.62);
  resize();
  const stopResize = onMountResize(mount, resize);
  let raf = 0;
  const start = performance.now();
  let running = true;
  const tick = () => {
    if (!running) return;
    const t = ((performance.now() - start) % CYCLE_MS) / CYCLE_MS;
    for (const p of prims) p.tick?.(t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pause() {
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
      for (const p of prims) p.dispose?.();
      renderer.dispose();
    },
  };

  function flow(path: Vec2[], mid: number, end: number): void {
    add(
      createPathFlow(path, {
        color: PALETTE.INK_SOFT,
        colorStops: [
          { at: 0.45, color: mid },
          { at: 0.82, color: end },
        ],
        particleCount: 6,
        particleSize: 3.8,
        opacity: 0.82,
      }),
      Z_FLOW,
    );
  }

  function block(label: string, x: number, y: number, fill: number): void {
    add(
      createBlock(x, y, 0.26, 0.2, {
        stroke: PALETTE.INK_SOFT,
        fill,
        fillOpacity: 0.95,
        radius: 0.04,
      }),
      Z_BLOCK,
    );
    add(createLabelText(label, x, y, 0.09), Z_TEXT);
  }

  function trapezoid(
    label: string,
    x: number,
    y: number,
    point: "left" | "right",
    fill: number,
  ): void {
    add(
      createTrapezoidBlock(x, y, 0.34, 0.22, point, {
        stroke: PALETTE.INK_SOFT,
        fill,
        fillOpacity: 0.95,
        radius: 0.035,
      }),
      Z_BLOCK,
    );
    add(createLabelText(label, x, y, 0.052), Z_TEXT);
  }
};

function token(x: number, color: number): Primitive {
  return createDisc(x, 0, 0.045, { color, opacity: 0.82 });
}
