import * as THREE from "three";
import {
  createRenderer,
  fitComposition,
  onMountResize,
} from "../core/renderer";
import { OPACITY, PALETTE } from "../core/palette";
import {
  createBlock,
  createDisc,
  createLabelText,
  createStroke,
  createTrapezoidBlock,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import type { VisualizationFactory } from "../core/types";

const VIEW_HALF_H = 1.72;
const CYCLE_MS = 9000;
const HEAD_X = [-0.9, -0.3, 0.3, 0.9] as const;
const GROUP_X = [-0.88, 0, 0.88] as const;
const GROUP_DX = [-0.3, -0.1, 0.1, 0.3] as const;
const QKV = ["Q", "K", "V"] as const;
const Y_INPUT = -1.06;
const Y_SPLIT = -0.84;
const Y_MLA_INPUT = -1.52;
const Y_MLA_SPLIT = -1.26;
const Y_MLA_KV = -1.02;
const Y_QKV = -0.48;
const Y_QK_NORM = -0.2;
const Y_ATTN = 0.12;
const Y_MERGE = 0.5;
const Y_CONCAT = 0.74;
const Y_O = 1.08;
const Y_OUTPUT = 1.28;
const QK_NORM_SHIFT = 0.34;
const TOKEN_R = 0.03;
const DOT_R = 0.02;
const HIDE_DOT = DOT_R * 1.2;
const DOTS_PER_PATH = 3;
const BEND_R = 0.055;
const BEND_STEPS = 6;
const SECTION_T = [0.28, 0.62, 0.82, 1] as const;

const Z_LINE = 0;
const Z_DOT = 1;
const Z_BLOCK = 10;
const Z_TEXT = 20;

const BLOCK = {
  w: 0.15,
  h: 0.18,
  radius: 0.04,
  opacity: 0.95,
};
const ATTN = { w: 0.52, h: 0.2 };
const WIDE = { w: 0.54, h: 0.18 };
const NORM = { w: 0.13, h: 0.12 };
const COLORS = {
  input: PALETTE.INK_MUTED,
  q: PALETTE.SIGNAL.BLUE,
  k: PALETTE.SIGNAL.TEAL,
  v: PALETTE.SIGNAL.VIOLET,
  head: PALETTE.SIGNAL.AMBER,
  out: PALETTE.SIGNAL.GREEN,
  norm: PALETTE.ACCENT,
  kv: 0xb6d8d3,
};

type Projection = {
  input: Vec2[];
  attention: Vec2[];
  color: number;
  inputColorAt?: (t: number) => number;
};

type SignalPath = {
  path: Vec2[];
  color: number;
  colorAt?: (t: number) => number;
};

type SignalRoute = [SignalPath, SignalPath, SignalPath, SignalPath];

type AttentionVariant = {
  kvGroups: 1 | 2 | 4;
  qkNorm?: boolean;
  mla?: boolean;
};

type YPositions = {
  attention: number;
  merge: number;
  concat: number;
  o: number;
  output: number;
};

export const createMhaOperation = createAttentionOperation({ kvGroups: 4 });
export const createQkNormOperation = createAttentionOperation({
  kvGroups: 4,
  qkNorm: true,
});
export const createMqaOperation = createAttentionOperation({ kvGroups: 1 });
export const createGqaOperation = createAttentionOperation({ kvGroups: 2 });
export const createMlaOperation = createAttentionOperation({
  kvGroups: 4,
  mla: true,
});

function createAttentionOperation(
  variant: AttentionVariant,
): VisualizationFactory {
  return (canvas, mount) => {
    const renderer = createRenderer(canvas);
    renderer.setClearAlpha(0);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const prims: Primitive[] = [];
    const overlays: Primitive[] = [];
    const drawnLines = new Set<string>();

    const add = (p: Primitive, z: number, overlay = false) => {
      p.mesh.renderOrder = z;
      p.mesh.traverse((obj) => (obj.renderOrder = z));
      prims.push(p);
      if (overlay) overlays.push(p);
      else scene.add(p.mesh);
    };
    const block = (
      label: string,
      x: number,
      y: number,
      fill: number,
      w = BLOCK.w,
      h = BLOCK.h,
    ) => {
      add(
        createBlock(x, y, w, h, {
          stroke: PALETTE.INK_SOFT,
          fill,
          strokeOpacity: OPACITY.STROKE,
          fillOpacity: BLOCK.opacity,
          radius: BLOCK.radius,
        }),
        Z_BLOCK,
        true,
      );
      add(
        createLabelText(label, x, y, label.length > 3 ? 0.055 : 0.078),
        Z_TEXT,
        true,
      );
    };
    const trapezoid = (
      label: string,
      x: number,
      y: number,
      point: "up" | "down",
      fill: number,
      w = BLOCK.w,
      h = BLOCK.h,
    ) => {
      add(
        createTrapezoidBlock(x, y, w, h, point, {
          stroke: PALETTE.INK_SOFT,
          fill,
          strokeOpacity: OPACITY.STROKE,
          fillOpacity: BLOCK.opacity,
          radius: BLOCK.radius * 0.8,
        }),
        Z_BLOCK,
        true,
      );
      add(createLabelText(label, x, y, 0.062), Z_TEXT, true);
    };

    const sources = HEAD_X.flatMap((headX, head) =>
      QKV.map((label, lane) => ({
        label,
        lane,
        head,
        x: sourceX(lane, head, variant),
        color: qkvColor(lane),
        surface: qkvSurface(lane),
        blockKey: blockKey(label, lane, head, variant),
        targetX: attentionEntryX(headX, lane),
      })),
    );
    const y = yPositions(variant);
    const projections = sources.map(({ x, head, lane, color, targetX }) =>
      projection(x, targetX, head, lane, color, variant, y),
    );
    const heads = HEAD_X.map((x) => ({
      path: roundPath(headPath(x, y)),
      color: COLORS.head,
    }));
    const output = roundPath([
      [0, blockTopExit(y.concat, WIDE.h)],
      ...passUpThroughBlock(0, y.o, BLOCK.h),
      [0, y.output - TOKEN_R],
    ] satisfies Vec2[]);

    for (const { input, attention } of projections) {
      line(input);
      line(attention);
    }
    for (const { path } of heads) line(path);
    line(output);

    const drawnBlocks = new Set<string>();
    sources.forEach(({ label, lane, head, x, surface, blockKey }) => {
      if (drawnBlocks.has(blockKey)) return;
      drawnBlocks.add(blockKey);
      if (variant.mla && lane > 0) {
        if (lane === 1) {
          trapezoid("KV↓", mlaKvX(head), Y_MLA_KV, "up", COLORS.kv);
        }
        trapezoid(`${label}↑`, x, Y_QKV, "down", qkvSurface(lane));
        return;
      }
      block(label, x, Y_QKV, surface, BLOCK.w, BLOCK.h);
    });
    if (variant.qkNorm) {
      sources.forEach(({ lane, x, blockKey }) => {
        if (lane > 1 || drawnBlocks.has(`norm-${blockKey}`)) return;
        drawnBlocks.add(`norm-${blockKey}`);
        block("^", x, Y_QK_NORM, COLORS.norm, NORM.w, NORM.h);
      });
    }
    HEAD_X.forEach((headX) => {
      block(
        "attention",
        headX,
        y.attention,
        PALETTE.SURFACE.PEACH,
        ATTN.w,
        ATTN.h,
      );
    });
    block("||", 0, y.concat, PALETTE.SURFACE.STONE, WIDE.w, WIDE.h);
    block("O", 0, y.o, PALETTE.SURFACE.SAGE, BLOCK.w, BLOCK.h);
    add(
      createDisc(0, inputY(variant), TOKEN_R, {
        color: PALETTE.INK_SOFT,
        opacity: 0.82,
      }),
      Z_BLOCK,
      true,
    );
    add(
      createDisc(0, y.output, TOKEN_R, {
        color: PALETTE.INK_SOFT,
        opacity: 0.82,
      }),
      Z_BLOCK,
      true,
    );
    add(
      createSignals(projections, heads, { path: output, color: COLORS.out }),
      Z_DOT,
    );
    for (const p of overlays) scene.add(p.mesh);

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      fitComposition(renderer, canvas, camera, variant.mla ? 1.9 : VIEW_HALF_H);
    };
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

    function line(path: Vec2[]) {
      const key = path.map(([x, y]) => `${x},${y}`).join("|");
      if (drawnLines.has(key)) return;
      drawnLines.add(key);
      add(
        createStroke(path, {
          color: PALETTE.INK_MUTED,
          opacity: 0.58,
          arrow: true,
          arrowSize: 0.036,
        }),
        Z_LINE,
      );
    }
  };
}

function projection(
  x: number,
  attnX: number,
  head: number,
  lane: number,
  color: number,
  variant: AttentionVariant,
  y: YPositions,
): Projection {
  const branchY = lerp(
    Y_QKV + BLOCK.h / 2 + 0.09 + (variant.qkNorm ? QK_NORM_SHIFT : 0),
    y.attention - ATTN.h / 2 - 0.07,
    head / (HEAD_X.length - 1),
  );
  const qkNormPath =
    variant.qkNorm && lane < 2 ? passUpThroughBlock(x, Y_QK_NORM, NORM.h) : [];
  const sourceX = variant.mla && lane > 0 ? mlaKvX(head) : x;
  const sourceY = variant.mla && lane > 0 ? Y_MLA_KV : Y_QKV;
  const mlaInputPath = variant.mla && lane > 0 ? mlaUpPath(x, head) : [];
  const input = roundPath([
    [0, inputY(variant) + TOKEN_R],
    [0, splitY(variant)],
    [sourceX, splitY(variant)],
    ...passUpThroughBlock(sourceX, sourceY, BLOCK.h),
    ...mlaInputPath,
  ]);
  return {
    color,
    input,
    inputColorAt:
      variant.mla && lane > 0
        ? (t) => mlaInputColorAt(input, t, lane)
        : undefined,
    attention: roundPath([
      [x, blockTopExit(Y_QKV, BLOCK.h)],
      ...qkNormPath,
      [x, branchY],
      [attnX, branchY],
      [attnX, blockBottomEntry(y.attention, ATTN.h)],
    ]),
  };
}

function yPositions(variant: AttentionVariant): YPositions {
  const shift = variant.qkNorm ? QK_NORM_SHIFT : 0;
  return {
    attention: Y_ATTN + shift,
    merge: Y_MERGE + shift,
    concat: Y_CONCAT + shift,
    o: Y_O + shift,
    output: Y_OUTPUT + shift,
  };
}

function inputY(variant: AttentionVariant): number {
  return variant.mla ? Y_MLA_INPUT : Y_INPUT;
}

function splitY(variant: AttentionVariant): number {
  return variant.mla ? Y_MLA_SPLIT : Y_SPLIT;
}

function sourceX(
  lane: number,
  head: number,
  variant: AttentionVariant,
): number {
  const kvGroups = variant.kvGroups;
  const groups = lane === 0 ? HEAD_X.length : kvGroups;
  return GROUP_X[lane] + groupCenter(sourceGroup(lane, head, kvGroups), groups);
}

function mlaKvX(head: number): number {
  const left = GROUP_X[1] + GROUP_DX[0];
  const right = GROUP_X[2] + GROUP_DX[GROUP_DX.length - 1];
  return lerp(left, right, head / (HEAD_X.length - 1));
}

function mlaUpPath(x: number, head: number): Vec2[] {
  const kvX = mlaKvX(head);
  const branchY = lerp(
    blockTopExit(Y_MLA_KV, BLOCK.h) + 0.06,
    blockBottomEntry(Y_QKV, BLOCK.h) - 0.06,
    head / (HEAD_X.length - 1),
  );
  return [
    [kvX, blockTopExit(Y_MLA_KV, BLOCK.h)],
    [kvX, branchY],
    [x, branchY],
    ...passUpThroughBlock(x, Y_QKV, BLOCK.h),
  ];
}

function mlaInputColorAt(
  path: readonly Vec2[],
  t: number,
  lane: number,
): number {
  const y = samplePath(path, t)[1];
  const target = lane === 1 ? COLORS.k : COLORS.v;
  const u =
    (y - blockBottomEntry(Y_MLA_KV, BLOCK.h)) /
    (blockTopExit(Y_MLA_KV, BLOCK.h) - blockBottomEntry(Y_MLA_KV, BLOCK.h));
  return blendHex(COLORS.input, target, Math.max(0, Math.min(1, u)));
}

function blendHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(lerp(ar, br, t)) << 16) |
    (Math.round(lerp(ag, bg, t)) << 8) |
    Math.round(lerp(ab, bb, t))
  );
}

function blockKey(
  label: string,
  lane: number,
  head: number,
  variant: AttentionVariant,
): string {
  return `${label}-${sourceGroup(lane, head, variant.kvGroups)}`;
}

function sourceGroup(
  lane: number,
  head: number,
  kvGroups: AttentionVariant["kvGroups"],
): number {
  return Math.floor(
    (head * (lane === 0 ? HEAD_X.length : kvGroups)) / HEAD_X.length,
  );
}

function groupCenter(group: number, groups: number): number {
  const start = Math.floor((group * GROUP_DX.length) / groups);
  const end = Math.floor(((group + 1) * GROUP_DX.length) / groups) - 1;
  return (GROUP_DX[start] + GROUP_DX[end]) / 2;
}

function attentionEntryX(headX: number, lane: number): number {
  return headX - ATTN.w / 2 + ((lane + 1) * ATTN.w) / (QKV.length + 1);
}

function headPath(x: number, y: YPositions): Vec2[] {
  return [
    [x, blockTopExit(y.attention, ATTN.h)],
    [x, y.merge],
    [0, y.merge],
    [0, blockBottomEntry(y.concat, WIDE.h)],
  ];
}

function roundPath(path: readonly Vec2[]): Vec2[] {
  if (path.length < 3) return [...path];
  const rounded: Vec2[] = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    if (ab < 1e-6 || bc < 1e-6) continue;

    const r = Math.min(BEND_R, ab / 2, bc / 2);
    const p: Vec2 = [
      b[0] - ((b[0] - a[0]) / ab) * r,
      b[1] - ((b[1] - a[1]) / ab) * r,
    ];
    const q: Vec2 = [
      b[0] + ((c[0] - b[0]) / bc) * r,
      b[1] + ((c[1] - b[1]) / bc) * r,
    ];
    rounded.push(p);
    for (let j = 1; j < BEND_STEPS; j++) {
      const t = j / BEND_STEPS;
      rounded.push([
        (1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * b[0] + t * t * q[0],
        (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * b[1] + t * t * q[1],
      ]);
    }
    rounded.push(q);
  }
  rounded.push(path[path.length - 1]);
  return rounded;
}

function createSignals(
  projections: readonly Projection[],
  heads: readonly SignalPath[],
  output: SignalPath,
): Primitive {
  const group = new THREE.Group();
  const geo = new THREE.CircleGeometry(DOT_R, 24);
  const routes = projections.map((p, i) => [
    { path: p.input, color: COLORS.input, colorAt: p.inputColorAt },
    { path: p.attention, color: p.color },
    heads[Math.floor(i / QKV.length)],
    output,
  ]) satisfies SignalRoute[];
  const dots = Array.from({ length: routes.length * DOTS_PER_PATH }, () => {
    const mat = new THREE.MeshBasicMaterial({
      color: COLORS.input,
      transparent: true,
      opacity: 0.78,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    return { mesh, mat };
  });

  return {
    mesh: group,
    tick(t) {
      hide(dots);
      let cursor = 0;
      routes.forEach((route) => {
        for (let i = 0; i < DOTS_PER_PATH; i++) {
          placeOnRoute(dots[cursor++], route, (t + i / DOTS_PER_PATH) % 1);
        }
      });
    },
    dispose() {
      geo.dispose();
      for (const { mat } of dots) mat.dispose();
    },
  };
}

function placeOnRoute(
  dot: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial },
  route: SignalRoute,
  t: number,
): void {
  const section = sectionIndex(t);
  const { path, color } = route[section];
  const u = sectionProgress(t);
  place(dot, path, u, route[section].colorAt?.(u) ?? color);
}

function place(
  dot: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial },
  path: readonly Vec2[],
  t: number,
  color: number,
): void {
  const [x, y] = samplePath(path, t);
  dot.mesh.position.set(x, y, 0);
  dot.mat.color.setHex(color);
}

function sectionIndex(t: number): number {
  return SECTION_T.findIndex((end) => t < end);
}

function sectionProgress(t: number): number {
  const section = sectionIndex(t);
  const start = section === 0 ? 0 : SECTION_T[section - 1];
  return (t - start) / (SECTION_T[section] - start);
}

function hide(dots: readonly { mesh: THREE.Mesh }[]): void {
  dots.forEach(({ mesh }) => mesh.position.set(9999, 9999, 0));
}

function samplePath(path: readonly Vec2[], t: number): Vec2 {
  const lengths = path.slice(0, -1).map((point, i) => {
    const next = path[i + 1];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
  const target = lengths.reduce((a, b) => a + b, 0) * t;
  let acc = 0;
  for (let i = 0; i < lengths.length; i++) {
    if (acc + lengths[i] >= target) {
      const u = (target - acc) / Math.max(lengths[i], 1e-6);
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * u,
        path[i][1] + (path[i + 1][1] - path[i][1]) * u,
      ];
    }
    acc += lengths[i];
  }
  return path[path.length - 1];
}

function qkvColor(i: number): number {
  return [COLORS.q, COLORS.k, COLORS.v][i];
}

function qkvSurface(i: number): number {
  return [PALETTE.SURFACE.SKY, PALETTE.SURFACE.CELADON, PALETTE.SURFACE.LILAC][
    i
  ];
}

function passUpThroughBlock(x: number, cy: number, h: number): Vec2[] {
  return [
    [x, blockBottomEntry(cy, h)],
    [x, blockTopExit(cy, h)],
  ];
}

function blockBottomEntry(cy: number, h: number): number {
  return cy - h / 2 + HIDE_DOT;
}

function blockTopExit(cy: number, h: number): number {
  return cy + h / 2 - HIDE_DOT;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
