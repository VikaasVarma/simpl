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
const CYCLE_MS = 2600;
const POINTS = [-1.05, -0.48, 0, 0.48, 1.05] as const;
const PATH: Vec2[] = POINTS.map((x) => [x, 0]);

export const createMlpOperation: VisualizationFactory = (canvas, mount) => {
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

  add(createStroke(PATH, { arrow: true, opacity: 0.58 }), Z_LINE);
  add(
    createPathFlow(PATH, {
      color: PALETTE.INK_SOFT,
      colorStops: [
        { at: 0.34, color: PALETTE.SIGNAL.GREEN },
        { at: 0.52, color: PALETTE.SIGNAL.AMBER },
        { at: 0.72, color: PALETTE.SIGNAL.VIOLET },
      ],
      particleCount: 7,
      particleSize: 4,
      opacity: 0.82,
    }),
    Z_FLOW,
  );
  add(token(POINTS[0]), Z_BLOCK);
  add(token(POINTS[4]), Z_BLOCK);
  trapezoid("W_in", POINTS[1], "left", PALETTE.SURFACE.SAGE);
  block("σ", POINTS[2], PALETTE.SURFACE.PEACH);
  trapezoid("W_out", POINTS[3], "right", PALETTE.SURFACE.LILAC);

  const resize = () => fitComposition(renderer, canvas, camera, 0.26, 1.32);
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
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
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

  function block(label: string, x: number, fill: number): void {
    add(
      createBlock(x, 0, 0.26, 0.2, {
        stroke: PALETTE.INK_SOFT,
        fill,
        fillOpacity: 0.95,
        radius: 0.04,
      }),
      Z_BLOCK,
    );
    add(createLabelText(label, x, 0, label.length > 2 ? 0.062 : 0.09), Z_TEXT);
  }

  function trapezoid(
    label: string,
    x: number,
    point: "left" | "right",
    fill: number,
  ): void {
    add(
      createTrapezoidBlock(x, 0, 0.3, 0.22, point, {
        stroke: PALETTE.INK_SOFT,
        fill,
        fillOpacity: 0.95,
        radius: 0.035,
      }),
      Z_BLOCK,
    );
    add(createLabelText(label, x, 0, 0.058), Z_TEXT);
  }
};

function token(x: number): Primitive {
  return createDisc(x, 0, 0.045, { color: PALETTE.INK_SOFT, opacity: 0.82 });
}
