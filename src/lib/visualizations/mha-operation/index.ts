import * as THREE from "three";
import { createRenderer, fit, onMountResize } from "../core/renderer";
import { OPACITY, PALETTE } from "../core/palette";
import {
  createBlock,
  createDisc,
  createLabelText,
  createStroke,
  type Primitive,
  type Vec2,
} from "../core/primitives";
import type { VisualizationFactory } from "../core/types";

const VIEW_HALF_H = 1.38;
const CYCLE_MS = 9000;
const HEAD_X = [-0.9, -0.3, 0.3, 0.9] as const;
const GROUP_X = [-0.88, 0, 0.88] as const;
const GROUP_DX = [-0.3, -0.1, 0.1, 0.3] as const;
const QKV = ["Q", "K", "V"] as const;
const Y_INPUT = -1.06;
const Y_SPLIT = -0.84;
const Y_QKV = -0.48;
const Y_ATTN = 0.12;
const Y_MERGE = 0.5;
const Y_CONCAT = 0.74;
const Y_O = 1.08;
const Y_OUTPUT = 1.28;
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
const COLORS = {
  input: PALETTE.INK_MUTED,
  q: PALETTE.SIGNAL.BLUE,
  k: PALETTE.SIGNAL.TEAL,
  v: PALETTE.SIGNAL.VIOLET,
  head: PALETTE.SIGNAL.AMBER,
  out: PALETTE.SIGNAL.GREEN,
};

type Projection = {
  input: Vec2[];
  attention: Vec2[];
  color: number;
};

type SignalPath = {
  path: Vec2[];
  color: number;
};

type SignalRoute = [SignalPath, SignalPath, SignalPath, SignalPath];

type AttentionVariant = {
  kvGroups: 1 | 2 | 4;
};

export const createMhaOperation = createAttentionOperation({ kvGroups: 4 });
export const createMqaOperation = createAttentionOperation({ kvGroups: 1 });
export const createGqaOperation = createAttentionOperation({ kvGroups: 2 });

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

    const sources = HEAD_X.flatMap((headX, head) =>
      QKV.map((label, lane) => ({
        label,
        lane,
        head,
        x: sourceX(lane, head, variant.kvGroups),
        color: qkvColor(lane),
        surface: qkvSurface(lane),
        blockKey: `${label}-${sourceGroup(lane, head, variant.kvGroups)}`,
        targetX: attentionEntryX(headX, lane),
      })),
    );
    const projections = sources.map(({ x, head, color, targetX }) =>
      projection(x, targetX, head, color),
    );
    const heads = HEAD_X.map((x) => ({
      path: roundPath(headPath(x)),
      color: COLORS.head,
    }));
    const output = roundPath([
      [0, blockTopExit(Y_CONCAT, WIDE.h)],
      ...passUpThroughBlock(0, Y_O, BLOCK.h),
      [0, Y_OUTPUT - TOKEN_R],
    ] satisfies Vec2[]);

    for (const { input, attention } of projections) {
      line(input);
      line(attention);
    }
    for (const { path } of heads) line(path);
    line(output);

    const drawnBlocks = new Set<string>();
    sources.forEach(({ label, x, surface, blockKey }) => {
      if (drawnBlocks.has(blockKey)) return;
      drawnBlocks.add(blockKey);
      block(label, x, Y_QKV, surface, BLOCK.w, BLOCK.h);
    });
    HEAD_X.forEach((headX) => {
      block("attention", headX, Y_ATTN, PALETTE.SURFACE.PEACH, ATTN.w, ATTN.h);
    });
    block("||", 0, Y_CONCAT, PALETTE.SURFACE.STONE, WIDE.w, WIDE.h);
    block("O", 0, Y_O, PALETTE.SURFACE.SAGE, BLOCK.w, BLOCK.h);
    add(
      createDisc(0, Y_INPUT, TOKEN_R, {
        color: PALETTE.INK_SOFT,
        opacity: 0.82,
      }),
      Z_BLOCK,
      true,
    );
    add(
      createDisc(0, Y_OUTPUT, TOKEN_R, {
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
      const aspect = width / height;
      camera.left = -VIEW_HALF_H * aspect;
      camera.right = VIEW_HALF_H * aspect;
      camera.top = VIEW_HALF_H;
      camera.bottom = -VIEW_HALF_H;
      camera.updateProjectionMatrix();
      fit(renderer, canvas);
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
  color: number,
): Projection {
  const branchY = lerp(
    Y_QKV + BLOCK.h / 2 + 0.09,
    Y_ATTN - ATTN.h / 2 - 0.07,
    head / (HEAD_X.length - 1),
  );
  return {
    color,
    input: roundPath([
      [0, Y_INPUT + TOKEN_R],
      [0, Y_SPLIT],
      [x, Y_SPLIT],
      ...passUpThroughBlock(x, Y_QKV, BLOCK.h),
    ]),
    attention: roundPath([
      [x, blockTopExit(Y_QKV, BLOCK.h)],
      [x, branchY],
      [attnX, branchY],
      [attnX, blockBottomEntry(Y_ATTN, ATTN.h)],
    ]),
  };
}

function sourceX(
  lane: number,
  head: number,
  kvGroups: AttentionVariant["kvGroups"],
): number {
  const groups = lane === 0 ? HEAD_X.length : kvGroups;
  return GROUP_X[lane] + groupCenter(sourceGroup(lane, head, kvGroups), groups);
}

function sourceGroup(
  lane: number,
  head: number,
  kvGroups: AttentionVariant["kvGroups"],
): number {
  return Math.floor((head * (lane === 0 ? HEAD_X.length : kvGroups)) / HEAD_X.length);
}

function groupCenter(group: number, groups: number): number {
  const start = Math.floor((group * GROUP_DX.length) / groups);
  const end = Math.floor(((group + 1) * GROUP_DX.length) / groups) - 1;
  return (GROUP_DX[start] + GROUP_DX[end]) / 2;
}

function attentionEntryX(headX: number, lane: number): number {
  return headX - ATTN.w / 2 + ((lane + 1) * ATTN.w) / (QKV.length + 1);
}

function headPath(x: number): Vec2[] {
  return [
    [x, blockTopExit(Y_ATTN, ATTN.h)],
    [x, Y_MERGE],
    [0, Y_MERGE],
    [0, blockBottomEntry(Y_CONCAT, WIDE.h)],
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
    { path: p.input, color: COLORS.input },
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
  place(dot, path, sectionProgress(t), color);
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
