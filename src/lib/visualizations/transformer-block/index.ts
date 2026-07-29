import * as THREE from "three";
import {
  createRenderer,
  fitComposition,
  onMountResize,
} from "../core/renderer";
import { PALETTE, OPACITY } from "../core/palette";
import {
  createLabelText,
  createStroke,
  createBlock,
  createPlusMarker,
  createPathFlow,
  createDisc,
  createSyncedBranchFlow,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import type { VisualizationFactory } from "../core/types";

const VIEW_HALF_H = 1.58;
const CYCLE_MS = 12000;

const STREAM_X = 0;
const STREAM_W = 0.05;

const Y_TOKEN_IN = -1.26;
const Y_INPROJ_BOTTOM = -1.02;
const Y_INPROJ_TOP = -0.88;

const Y_ATTN_SPLIT = -0.78;
const Y_ATTN_NORM = -0.57;
const Y_ATTN_BLOCK = -0.26;
const Y_ATTN_MERGE = +0.04;

const Y_MLP_SPLIT = +0.2;
const Y_MLP_NORM = +0.43;
const Y_MLP_BLOCK = +0.74;
const Y_MLP_MERGE = +1.04;

const Y_OUTPROJ_BOTTOM = +1.14;
const Y_OUTPROJ_TOP = +1.28;
const Y_TOKEN_OUT = +1.5;

const STREAM_Y_LOW = Y_TOKEN_IN + 0.04;
const STREAM_Y_HIGH = Y_TOKEN_OUT - 0.04;
const STREAM_LEN = STREAM_Y_HIGH - STREAM_Y_LOW;

const BLOCK_X = 0.68;
const BLOCK_W = 0.74;
const BLOCK_H = 0.24;
const HOOK_R = 0.08;

const SPLIT_R = 0.022;
const PLUS_R = 0.068;
const TOKEN_R = 0.032;
const PROJ_W = 0.64;
const NORM_W = PROJ_W;
const NORM_H = Y_INPROJ_TOP - Y_INPROJ_BOTTOM;

const BRACKET_X = BLOCK_X + BLOCK_W / 2 + 0.17;
const BRACKET_Y_BOTTOM = Y_ATTN_SPLIT - 0.04;
const BRACKET_Y_TOP = Y_MLP_MERGE + 0.04;
const BRACKET_TICK = 0.075;
const BRACKET_LABEL_X = BRACKET_X + 0.18;

const N_PARTICLES = 5;
const PARTICLE_SIZE = 6.2;

const DOT_BASE = PALETTE.INK;
const DOT_PROJ = PALETTE.SIGNAL.BLUE;
const DOT_ATTENTION = PALETTE.SIGNAL.CORAL;
const DOT_MLP = PALETTE.SIGNAL.VIOLET;
const DOT_OUT = PALETTE.SIGNAL.TEAL;

const SURFACE_PROJ = PALETTE.SURFACE.SKY;
const SURFACE_ATTENTION = PALETTE.SURFACE.CELADON;
const SURFACE_MLP = PALETTE.SURFACE.LILAC;
const SURFACE_NORM = PALETTE.SURFACE.STONE;
const BLOCK_FILL_OPACITY = 0.95;

const Z_LINE = 0;
const Z_PARTICLE = 1;
const Z_MARKER = 2;
const Z_BLOCK = 10;
const Z_TEXT = 20;

function buildHookPath(splitY: number, mergeY: number): Vec2[] {
  const points: Vec2[] = [];
  const samples = 14;
  const rightX = BLOCK_X - HOOK_R - 0.02;

  points.push([STREAM_X + STREAM_W * 0.5, splitY]);
  points.push([rightX, splitY]);
  for (let i = 1; i <= samples; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / samples);
    points.push([
      rightX + HOOK_R * Math.cos(a),
      splitY + HOOK_R + HOOK_R * Math.sin(a),
    ]);
  }
  points.push([rightX + HOOK_R, mergeY - HOOK_R]);
  for (let i = 1; i <= samples; i++) {
    const a = 0 + (Math.PI / 2) * (i / samples);
    points.push([
      rightX + HOOK_R * Math.cos(a),
      mergeY - HOOK_R + HOOK_R * Math.sin(a),
    ]);
  }
  points.push([STREAM_X + STREAM_W * 0.5, mergeY]);
  return points;
}

export const createTransformerBlock: VisualizationFactory = (canvas, mount) => {
  const renderer = createRenderer(canvas);
  renderer.setClearAlpha(0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    -VIEW_HALF_H,
    VIEW_HALF_H,
    VIEW_HALF_H,
    -VIEW_HALF_H,
    -1,
    1,
  );

  const prims: Primitive[] = [];
  const blockPrims: Primitive[] = [];
  const textPrims: Primitive[] = [];
  const addAt = (p: Primitive, z: number) => {
    p.mesh.renderOrder = z;
    p.mesh.traverse((obj) => {
      obj.renderOrder = z;
    });
    prims.push(p);
    scene.add(p.mesh);
  };
  const addBlock = (p: Primitive) => {
    p.mesh.renderOrder = Z_BLOCK;
    p.mesh.traverse((obj) => {
      obj.renderOrder = Z_BLOCK;
    });
    prims.push(p);
    blockPrims.push(p);
  };
  const addText = (p: Primitive) => {
    p.mesh.renderOrder = Z_TEXT;
    p.mesh.traverse((obj) => {
      obj.renderOrder = Z_TEXT;
    });
    prims.push(p);
    textPrims.push(p);
  };

  addAt(
    createStroke(
      [
        [STREAM_X, Y_TOKEN_IN + TOKEN_R],
        [STREAM_X, Y_TOKEN_OUT - TOKEN_R],
      ],
      { color: PALETTE.INK_MUTED, opacity: 0.62 },
    ),
    Z_LINE,
  );
  addAt(
    createStroke(
      [
        [STREAM_X, Y_OUTPROJ_TOP + 0.02],
        [STREAM_X, Y_TOKEN_OUT - TOKEN_R - 0.01],
      ],
      { color: PALETTE.INK_SOFT, opacity: 0.7, arrow: true, arrowSize: 0.055 },
    ),
    Z_LINE,
  );

  addBlock(
    createBlock(
      STREAM_X,
      (Y_INPROJ_BOTTOM + Y_INPROJ_TOP) / 2,
      PROJ_W,
      Y_INPROJ_TOP - Y_INPROJ_BOTTOM,
      {
        stroke: PALETTE.INK_SOFT,
        fill: SURFACE_PROJ,
        strokeOpacity: OPACITY.STROKE,
        fillOpacity: BLOCK_FILL_OPACITY,
        radius: 0.045,
      },
    ),
  );
  addText(
    createLabelText(
      "in proj",
      STREAM_X,
      (Y_INPROJ_BOTTOM + Y_INPROJ_TOP) / 2,
      0.09,
    ),
  );
  addBlock(
    createBlock(
      STREAM_X,
      (Y_OUTPROJ_BOTTOM + Y_OUTPROJ_TOP) / 2,
      PROJ_W,
      Y_OUTPROJ_TOP - Y_OUTPROJ_BOTTOM,
      {
        stroke: PALETTE.INK_SOFT,
        fill: SURFACE_PROJ,
        strokeOpacity: OPACITY.STROKE,
        fillOpacity: BLOCK_FILL_OPACITY,
        radius: 0.045,
      },
    ),
  );
  addText(
    createLabelText(
      "out proj",
      STREAM_X,
      (Y_OUTPROJ_BOTTOM + Y_OUTPROJ_TOP) / 2,
      0.09,
    ),
  );

  addAt(
    createDisc(STREAM_X, Y_TOKEN_IN, TOKEN_R, {
      color: PALETTE.INK_SOFT,
      opacity: 0.82,
    }),
    Z_MARKER,
  );
  addAt(
    createDisc(STREAM_X, Y_TOKEN_OUT, TOKEN_R, {
      color: PALETTE.INK_SOFT,
      opacity: 0.82,
    }),
    Z_MARKER,
  );

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
      inputColor: DOT_PROJ,
      outputColor: DOT_ATTENTION,
      surface: SURFACE_ATTENTION,
    },
    {
      splitY: Y_MLP_SPLIT,
      normY: Y_MLP_NORM,
      blockY: Y_MLP_BLOCK,
      mergeY: Y_MLP_MERGE,
      label: "MLP",
      inputColor: DOT_ATTENTION,
      outputColor: DOT_MLP,
      surface: SURFACE_MLP,
    },
  ];

  for (const b of branches) {
    const blockCy = b.blockY;
    const blockYBot = blockCy - BLOCK_H / 2;
    const blockYTop = blockCy + BLOCK_H / 2;
    const path = buildHookPath(b.splitY, b.mergeY);

    addAt(
      createStroke(path, {
        color: PALETTE.INK_MUTED,
        opacity: 0.62,
      }),
      Z_LINE,
    );

    addBlock(
      createBlock(BLOCK_X, b.normY, NORM_W, NORM_H, {
        stroke: PALETTE.INK_SOFT,
        fill: SURFACE_NORM,
        strokeOpacity: OPACITY.STROKE,
        fillOpacity: BLOCK_FILL_OPACITY,
        radius: 0.035,
      }),
    );
    addText(createLabelText("norm", BLOCK_X, b.normY, 0.065));

    addBlock(
      createBlock(BLOCK_X, blockCy, BLOCK_W, BLOCK_H, {
        stroke: PALETTE.INK_SOFT,
        fill: b.surface,
        strokeOpacity: OPACITY.STROKE,
        fillOpacity: BLOCK_FILL_OPACITY,
        radius: 0.06,
      }),
    );
    addText(createLabelText(b.label, BLOCK_X, blockCy, 0.105));

    addAt(
      createDisc(STREAM_X, b.splitY, SPLIT_R, {
        color: PALETTE.INK_MUTED,
        opacity: 0.82,
      }),
      Z_MARKER,
    );
    addAt(
      createPlusMarker(STREAM_X, b.mergeY, PLUS_R, {
        color: PALETTE.INK_SOFT,
        opacity: 0.95,
      }),
      Z_MARKER,
    );

    const splitPhase = (b.splitY - STREAM_Y_LOW) / STREAM_LEN;
    const mergePhase = (b.mergeY - STREAM_Y_LOW) / STREAM_LEN;
    addAt(
      createSyncedBranchFlow(path, {
        splitPhase,
        mergePhase,
        particleCount: N_PARTICLES,
        yEnter: blockYBot,
        yExit: blockYTop,
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
    );
  }

  addAt(
    createPathFlow(
      [
        [STREAM_X, STREAM_Y_LOW],
        [STREAM_X, STREAM_Y_HIGH],
      ],
      {
        color: DOT_BASE,
        colorStages: [
          {
            yMin: Y_INPROJ_BOTTOM,
            yMax: Y_INPROJ_TOP,
            color: DOT_PROJ,
          },
          {
            yMin: Y_ATTN_MERGE - PLUS_R,
            yMax: Y_ATTN_MERGE + PLUS_R,
            color: DOT_ATTENTION,
          },
          {
            yMin: Y_MLP_MERGE - PLUS_R,
            yMax: Y_MLP_MERGE + PLUS_R,
            color: DOT_MLP,
          },
          {
            yMin: Y_OUTPROJ_BOTTOM,
            yMax: Y_OUTPROJ_TOP,
            color: DOT_OUT,
          },
        ],
        opacity: 0.85,
        particleCount: N_PARTICLES,
        particleSize: PARTICLE_SIZE,
        loops: 1,
      },
    ),
    Z_PARTICLE,
  );

  addAt(
    createStroke(
      [
        [BRACKET_X - BRACKET_TICK, BRACKET_Y_BOTTOM],
        [BRACKET_X, BRACKET_Y_BOTTOM],
        [BRACKET_X, BRACKET_Y_TOP],
        [BRACKET_X - BRACKET_TICK, BRACKET_Y_TOP],
      ],
      { color: PALETTE.INK_MUTED, opacity: 0.55 },
    ),
    Z_LINE,
  );
  addText(
    createLabelText(
      "× N",
      BRACKET_LABEL_X,
      (BRACKET_Y_BOTTOM + BRACKET_Y_TOP) / 2,
      0.07,
      PALETTE.INK_MUTED,
    ),
  );

  addText(
    createLabelText(
      "tokens out",
      STREAM_X,
      Y_TOKEN_OUT + 0.2,
      0.075,
      PALETTE.INK_MUTED,
    ),
  );

  for (const p of blockPrims) scene.add(p.mesh);
  for (const p of textPrims) scene.add(p.mesh);

  const fitCamera = () => {
    const r = mount.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    fitComposition(renderer, canvas, camera, VIEW_HALF_H);
  };
  fitCamera();
  const stopResize = onMountResize(mount, fitCamera);

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
};
