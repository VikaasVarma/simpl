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
  createStroke,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import type { VisualizationFactory } from "../core/types";

const Z_LINE = 0;
const Z_BLOCK = 10;
const Z_TEXT = 20;
const PATH: Vec2[] = [
  [-0.95, 0],
  [-0.32, 0],
  [0.32, 0],
  [0.95, 0],
];

export const createEmbeddingOperation: VisualizationFactory = (
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

  add(createStroke(PATH, { arrow: true, opacity: 0.58 }), Z_LINE);
  add(createDisc(-0.95, 0, 0.045, { color: PALETTE.INK_SOFT, opacity: 0.82 }), Z_BLOCK);
  add(createDisc(0.95, 0, 0.045, { color: PALETTE.SIGNAL.BLUE, opacity: 0.82 }), Z_BLOCK);
  add(
    createBlock(0, 0, 0.42, 0.22, {
      stroke: PALETTE.INK_SOFT,
      fill: PALETTE.SURFACE.SKY,
      fillOpacity: 0.95,
      radius: 0.04,
    }),
    Z_BLOCK,
  );
  add(createLabelText("W_E", 0, 0, 0.075), Z_TEXT);

  const resize = () => fitComposition(renderer, canvas, camera, 0.62, 1.2);
  resize();
  const stopResize = onMountResize(mount, resize);
  renderer.render(scene, camera);

  return {
    resume() {
      renderer.render(scene, camera);
    },
    dispose() {
      stopResize();
      for (const p of prims) p.dispose?.();
      renderer.dispose();
    },
  };
};
