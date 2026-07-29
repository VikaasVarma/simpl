import * as THREE from "three";
import { PALETTE, OPACITY } from "../core/palette";
import {
  createBlock,
  createDisc,
  createLabelText,
  createPathFlow,
  createPlusMarker,
  createStroke,
  createSyncedBranchFlow,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import {
  createRenderer,
  fitComposition,
  onMountResize,
} from "../core/renderer";
import type { VisualizationFactory } from "../core/types";

const VIEW_HALF_H = 1.72;
const CYCLE_MS = 12000;
const PANEL_CENTER_X = 0.525;
const PANEL_X = 1.08 + PANEL_CENTER_X;
const CAPTION_SIZE = 0.115;

const STREAM_X = 0;
const STREAM_W = 0.05;
const Y_TOKEN_IN = -1.26;
const Y_INPROJ_BOTTOM = -1.02;
const Y_INPROJ_TOP = -0.88;
const Y_ATTN_SPLIT = -0.78;
const Y_ATTN_NORM = -0.57;
const Y_ATTN_BLOCK = -0.26;
const Y_ATTN_MERGE = 0.04;
const Y_MLP_SPLIT = 0.2;
const Y_MLP_NORM = 0.43;
const Y_MLP_BLOCK = 0.74;
const Y_MLP_MERGE = 1.04;
const Y_OUTPROJ_BOTTOM = 1.14;
const Y_OUTPROJ_TOP = 1.28;
const Y_TOKEN_OUT = 1.5;
const STREAM_Y_LOW = Y_TOKEN_IN + 0.04;
const STREAM_Y_HIGH = Y_TOKEN_OUT - 0.04;
const STREAM_LEN = STREAM_Y_HIGH - STREAM_Y_LOW;

const BLOCK_X = 0.68;
const BLOCK_W = 0.74;
const BLOCK_H = 0.24;
const HOOK_R = 0.08;
const PROJ_W = 0.64;
const NORM_H = Y_INPROJ_TOP - Y_INPROJ_BOTTOM;
const SPLIT_R = 0.022;
const PLUS_R = 0.068;
const TOKEN_R = 0.032;
const PARTICLES = 5;
const PARTICLE_SIZE = 6.2;

const Z_LINE = 0;
const Z_PARTICLE = 1;
const Z_MARKER = 2;
const Z_BLOCK = 10;
const Z_TEXT = 20;

type Variant = { x: number; title: string; postNorm: boolean };
type Branch = {
  splitY: number;
  normY: number;
  blockY: number;
  mergeY: number;
  label: string;
  inputColor: number;
  outputColor: number;
  surface: number;
};

const branches: Branch[] = [
  {
    splitY: Y_ATTN_SPLIT,
    normY: Y_ATTN_NORM,
    blockY: Y_ATTN_BLOCK,
    mergeY: Y_ATTN_MERGE,
    label: "MHA",
    inputColor: PALETTE.SIGNAL.BLUE,
    outputColor: PALETTE.SIGNAL.CORAL,
    surface: PALETTE.SURFACE.CELADON,
  },
  {
    splitY: Y_MLP_SPLIT,
    normY: Y_MLP_NORM,
    blockY: Y_MLP_BLOCK,
    mergeY: Y_MLP_MERGE,
    label: "MLP",
    inputColor: PALETTE.SIGNAL.CORAL,
    outputColor: PALETTE.SIGNAL.VIOLET,
    surface: PALETTE.SURFACE.LILAC,
  },
];

export const createNormOrder: VisualizationFactory = (canvas, mount) => {
  const renderer = createRenderer(canvas);
  renderer.setClearAlpha(0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const prims: Primitive[] = [];
  const topPrims: Primitive[] = [];

  const add = (p: Primitive, z: number, x = 0) => {
    p.mesh.position.x += x;
    p.mesh.renderOrder = z;
    p.mesh.traverse((obj) => {
      obj.renderOrder = z;
    });
    prims.push(p);
    if (z >= Z_BLOCK) topPrims.push(p);
    else scene.add(p.mesh);
  };

  drawVariant(add, { x: -PANEL_X, title: "pre-norm", postNorm: false });
  drawVariant(add, { x: PANEL_X, title: "post-norm", postNorm: true });
  for (const p of topPrims) scene.add(p.mesh);

  const fitCamera = () => {
    const r = mount.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    fitComposition(renderer, canvas, camera, VIEW_HALF_H, 2.35);
  };
  fitCamera();
  const stopResize = onMountResize(mount, fitCamera);

  let raf = 0;
  let running = true;
  const start = performance.now();
  const tick = () => {
    if (!running) return;
    const t = ((performance.now() - start) % CYCLE_MS) / CYCLE_MS;
    for (const p of prims) p.tick?.(t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    pause: () => {
      running = false;
      cancelAnimationFrame(raf);
    },
    resume: () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    },
    dispose: () => {
      running = false;
      cancelAnimationFrame(raf);
      stopResize();
      for (const p of prims) p.dispose?.();
      renderer.dispose();
    },
  };
};

function drawVariant(
  add: (p: Primitive, z: number, x?: number) => void,
  variant: Variant,
): void {
  const x = variant.x - PANEL_CENTER_X;
  add(
    createLabelText(
      variant.title,
      PANEL_CENTER_X,
      -1.52,
      CAPTION_SIZE,
      PALETTE.INK_MUTED,
    ),
    Z_TEXT,
    x,
  );
  add(
    createStroke(
      [
        [STREAM_X, Y_TOKEN_IN + TOKEN_R],
        [STREAM_X, Y_TOKEN_OUT - TOKEN_R],
      ],
      {
        color: PALETTE.INK_MUTED,
        opacity: 0.62,
      },
    ),
    Z_LINE,
    x,
  );
  add(
    createStroke(
      [
        [STREAM_X, Y_OUTPROJ_TOP + 0.02],
        [STREAM_X, Y_TOKEN_OUT - TOKEN_R - 0.01],
      ],
      {
        color: PALETTE.INK_SOFT,
        opacity: 0.7,
        arrow: true,
        arrowSize: 0.055,
      },
    ),
    Z_LINE,
    x,
  );

  project(add, x, "in proj", (Y_INPROJ_BOTTOM + Y_INPROJ_TOP) / 2);
  project(add, x, "out proj", (Y_OUTPROJ_BOTTOM + Y_OUTPROJ_TOP) / 2);
  add(
    createDisc(STREAM_X, Y_TOKEN_IN, TOKEN_R, {
      color: PALETTE.INK_SOFT,
      opacity: 0.82,
    }),
    Z_MARKER,
    x,
  );
  add(
    createDisc(STREAM_X, Y_TOKEN_OUT, TOKEN_R, {
      color: PALETTE.INK_SOFT,
      opacity: 0.82,
    }),
    Z_MARKER,
    x,
  );

  for (const b of branches) {
    const opY = variant.postNorm ? b.normY : b.blockY;
    const normY = variant.postNorm ? b.blockY : b.normY;
    const blockBottom = opY - BLOCK_H / 2;
    const blockTop = opY + BLOCK_H / 2;
    const path = hookPath(b.splitY, b.mergeY);

    add(
      createStroke(path, { color: PALETTE.INK_MUTED, opacity: 0.62 }),
      Z_LINE,
      x,
    );
    block(
      add,
      x,
      BLOCK_X,
      "norm",
      normY,
      PROJ_W,
      NORM_H,
      PALETTE.SURFACE.STONE,
      0.065,
    );
    block(add, x, BLOCK_X, b.label, opY, BLOCK_W, BLOCK_H, b.surface, 0.105);
    add(
      createDisc(STREAM_X, b.splitY, SPLIT_R, {
        color: PALETTE.INK_MUTED,
        opacity: 0.82,
      }),
      Z_MARKER,
      x,
    );
    add(
      createPlusMarker(STREAM_X, b.mergeY, PLUS_R, {
        color: PALETTE.INK_SOFT,
        opacity: 0.95,
      }),
      Z_MARKER,
      x,
    );
    add(
      createSyncedBranchFlow(path, {
        splitPhase: (b.splitY - STREAM_Y_LOW) / STREAM_LEN,
        mergePhase: (b.mergeY - STREAM_Y_LOW) / STREAM_LEN,
        particleCount: PARTICLES,
        yEnter: blockBottom,
        yExit: blockTop,
        colorFrom: b.inputColor,
        colorTo: b.outputColor,
        colorAfterBlock: b.outputColor,
        recombineY: b.mergeY,
        recombineColor: b.outputColor,
        recombineRadius: PLUS_R * 1.15,
        particleSize: PARTICLE_SIZE,
        opacity: 0.85,
      }),
      Z_PARTICLE,
      x,
    );
  }

  add(
    createPathFlow(
      [
        [STREAM_X, STREAM_Y_LOW],
        [STREAM_X, STREAM_Y_HIGH],
      ],
      {
        color: PALETTE.INK,
        colorStages: [
          {
            yMin: Y_INPROJ_BOTTOM,
            yMax: Y_INPROJ_TOP,
            color: PALETTE.SIGNAL.BLUE,
          },
          {
            yMin: Y_ATTN_MERGE - PLUS_R,
            yMax: Y_ATTN_MERGE + PLUS_R,
            color: PALETTE.SIGNAL.CORAL,
          },
          {
            yMin: Y_MLP_MERGE - PLUS_R,
            yMax: Y_MLP_MERGE + PLUS_R,
            color: PALETTE.SIGNAL.VIOLET,
          },
          {
            yMin: Y_OUTPROJ_BOTTOM,
            yMax: Y_OUTPROJ_TOP,
            color: PALETTE.SIGNAL.TEAL,
          },
        ],
        opacity: 0.85,
        particleCount: PARTICLES,
        particleSize: PARTICLE_SIZE,
        loops: 1,
      },
    ),
    Z_PARTICLE,
    x,
  );
}

function project(
  add: (p: Primitive, z: number, x?: number) => void,
  x: number,
  label: string,
  y: number,
): void {
  block(add, x, STREAM_X, label, y, PROJ_W, NORM_H, PALETTE.SURFACE.SKY, 0.09);
}

function block(
  add: (p: Primitive, z: number, x?: number) => void,
  x: number,
  cx: number,
  label: string,
  y: number,
  w: number,
  h: number,
  fill: number,
  fontSize: number,
): void {
  add(
    createBlock(cx, y, w, h, {
      stroke: PALETTE.INK_SOFT,
      fill,
      strokeOpacity: OPACITY.STROKE,
      fillOpacity: 0.95,
      radius: 0.045,
    }),
    Z_BLOCK,
    x,
  );
  add(createLabelText(label, cx, y, fontSize), Z_TEXT, x);
}

function hookPath(splitY: number, mergeY: number): Vec2[] {
  const points: Vec2[] = [];
  const rightX = BLOCK_X - HOOK_R - 0.02;
  points.push([STREAM_X + STREAM_W * 0.5, splitY], [rightX, splitY]);
  for (let i = 1; i <= 14; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / 14);
    points.push([
      rightX + HOOK_R * Math.cos(a),
      splitY + HOOK_R + HOOK_R * Math.sin(a),
    ]);
  }
  points.push([rightX + HOOK_R, mergeY - HOOK_R]);
  for (let i = 1; i <= 14; i++) {
    const a = (Math.PI / 2) * (i / 14);
    points.push([
      rightX + HOOK_R * Math.cos(a),
      mergeY - HOOK_R + HOOK_R * Math.sin(a),
    ]);
  }
  points.push([STREAM_X + STREAM_W * 0.5, mergeY]);
  return points;
}
