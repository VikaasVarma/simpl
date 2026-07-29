import * as THREE from "three";
import { Text } from "troika-three-text";
import monoFont from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff?url";
import { PALETTE, OPACITY } from "./palette";

const LINE_WIDTH = 0.014;

export type Vec2 = [number, number];

export type Primitive = {
  mesh: THREE.Object3D;
  tick?: (t: number) => void;
  dispose?: () => void;
};

export function createLabelText(
  text: string,
  cx: number,
  cy: number,
  size: number,
  color: number = PALETTE.INK,
): Primitive {
  const mesh = new Text();
  mesh.text = text;
  mesh.fontSize = size;
  mesh.font = monoFont;
  (mesh as Text & { sdfGlyphSize: number }).sdfGlyphSize = 128;
  mesh.color = color;
  mesh.anchorX = "center";
  mesh.anchorY = "middle";
  mesh.depthOffset = -1;
  mesh.position.set(cx, cy, 0);
  mesh.sync();
  return {
    mesh,
    dispose: () => mesh.dispose(),
  };
}

function geometry(verts: number[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  return geo;
}

function pushSegment(
  out: number[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = LINE_WIDTH,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const px = (-dy / len) * width * 0.5;
  const py = (dx / len) * width * 0.5;
  out.push(
    x1 - px,
    y1 - py,
    0,
    x2 - px,
    y2 - py,
    0,
    x2 + px,
    y2 + py,
    0,
    x1 - px,
    y1 - py,
    0,
    x2 + px,
    y2 + py,
    0,
    x1 + px,
    y1 + py,
    0,
  );
}

function createParticleMeshes(
  count: number,
  pixelSize: number,
  color: number,
  opacity: number,
) {
  const group = new THREE.Group();
  const radius = pixelSize * 0.0032;
  const geo = new THREE.CircleGeometry(radius, 24);
  const mats: THREE.MeshBasicMaterial[] = [];
  const meshes: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(9999, 9999, 0);
    mats.push(mat);
    meshes.push(mesh);
    group.add(mesh);
  }
  return {
    group,
    meshes,
    mats,
    dispose: () => {
      geo.dispose();
      for (const mat of mats) mat.dispose();
    },
  };
}

export type StrokeOptions = {
  color?: number;
  opacity?: number;
  arrow?: boolean;
  arrowSize?: number;
};

export function createStroke(
  points: Vec2[],
  opts: StrokeOptions = {},
): Primitive {
  const color = opts.color ?? PALETTE.INK_MUTED;
  const opacity = opts.opacity ?? OPACITY.STROKE;
  const verts: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    pushSegment(verts, x1, y1, x2, y2);
  }
  if (opts.arrow && points.length >= 2) {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    const dx = last[0] - prev[0];
    const dy = last[1] - prev[1];
    const len = Math.max(Math.hypot(dx, dy), 1e-4);
    const ux = dx / len,
      uy = dy / len;
    const size = opts.arrowSize ?? 0.07;
    const wingAngle = Math.PI / 7;
    const back = -size;
    const cosW = Math.cos(wingAngle),
      sinW = Math.sin(wingAngle);
    const w1x = ux * cosW + uy * sinW;
    const w1y = -ux * sinW + uy * cosW;
    const w2x = ux * cosW - uy * sinW;
    const w2y = ux * sinW + uy * cosW;
    verts.push(
      last[0],
      last[1],
      0,
      last[0] + w1x * back,
      last[1] + w1y * back,
      0,
      last[0] + w2x * back,
      last[1] + w2y * back,
      0,
    );
  }
  const geo = geometry(verts);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export type BlockOptions = {
  stroke?: number;
  fill?: number | null;
  strokeOpacity?: number;
  fillOpacity?: number;
  radius?: number;
};

export function createBlock(
  cx: number,
  cy: number,
  width: number,
  height: number,
  opts: BlockOptions = {},
): Primitive {
  const stroke = opts.stroke ?? PALETTE.INK_SOFT;
  const fill = opts.fill ?? PALETTE.ACCENT;
  const strokeOpacity = opts.strokeOpacity ?? OPACITY.STROKE;
  const fillOpacity = opts.fillOpacity ?? OPACITY.FILL;
  const r = opts.radius ?? Math.min(width, height) * 0.15;

  const w = width / 2;
  const h = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(cx - w + r, cy - h);
  shape.lineTo(cx + w - r, cy - h);
  shape.quadraticCurveTo(cx + w, cy - h, cx + w, cy - h + r);
  shape.lineTo(cx + w, cy + h - r);
  shape.quadraticCurveTo(cx + w, cy + h, cx + w - r, cy + h);
  shape.lineTo(cx - w + r, cy + h);
  shape.quadraticCurveTo(cx - w, cy + h, cx - w, cy + h - r);
  shape.lineTo(cx - w, cy - h + r);
  shape.quadraticCurveTo(cx - w, cy - h, cx - w + r, cy - h);

  const group = new THREE.Group();
  const owned: { dispose: () => void }[] = [];

  if (fill !== null) {
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: fill,
      transparent: true,
      opacity: fillOpacity,
      depthTest: false,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(geo, mat));
    owned.push(geo, mat);
  }

  const pts = shape.getPoints(64);
  const verts: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    pushSegment(verts, a.x, a.y, b.x, b.y);
  }
  const lineGeo = geometry(verts);
  const lineMat = new THREE.MeshBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: strokeOpacity,
    depthTest: false,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(lineGeo, lineMat));
  owned.push(lineGeo, lineMat);

  return {
    mesh: group,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

export function createTrapezoidBlock(
  cx: number,
  cy: number,
  width: number,
  height: number,
  point: "up" | "down",
  opts: BlockOptions = {},
): Primitive {
  const stroke = opts.stroke ?? PALETTE.INK_SOFT;
  const fill = opts.fill ?? PALETTE.ACCENT;
  const strokeOpacity = opts.strokeOpacity ?? OPACITY.STROKE;
  const fillOpacity = opts.fillOpacity ?? OPACITY.FILL;
  const r = opts.radius ?? Math.min(width, height) * 0.12;
  const w = width / 2;
  const h = height / 2;
  const narrow = w * 0.48;
  const top = point === "up" ? narrow : w;
  const bottom = point === "up" ? w : narrow;
  const shape = roundedPolygon(
    [
      [cx - top, cy + h],
      [cx + top, cy + h],
      [cx + bottom, cy - h],
      [cx - bottom, cy - h],
    ],
    r,
  );

  const group = new THREE.Group();
  const owned: { dispose: () => void }[] = [];
  if (fill !== null) {
    const geo = new THREE.ShapeGeometry(shape);
    const mat = new THREE.MeshBasicMaterial({
      color: fill,
      transparent: true,
      opacity: fillOpacity,
      depthTest: false,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(geo, mat));
    owned.push(geo, mat);
  }

  const pts = shape.getPoints(64);
  const verts: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    pushSegment(verts, a.x, a.y, b.x, b.y);
  }
  const lineGeo = geometry(verts);
  const lineMat = new THREE.MeshBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: strokeOpacity,
    depthTest: false,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(lineGeo, lineMat));
  owned.push(lineGeo, lineMat);

  return {
    mesh: group,
    dispose: () => {
      for (const o of owned) o.dispose();
    },
  };
}

function roundedPolygon(points: Vec2[], radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const rounded = points.map((point, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const a = offsetToward(point, prev, radius);
    const b = offsetToward(point, next, radius);
    return { point, a, b };
  });

  shape.moveTo(rounded[0].b[0], rounded[0].b[1]);
  for (let i = 1; i <= rounded.length; i++) {
    const corner = rounded[i % rounded.length];
    shape.lineTo(corner.a[0], corner.a[1]);
    shape.quadraticCurveTo(
      corner.point[0],
      corner.point[1],
      corner.b[0],
      corner.b[1],
    );
  }
  return shape;
}

function offsetToward(from: Vec2, to: Vec2, distance: number): Vec2 {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const scale = Math.min(distance / Math.max(Math.hypot(dx, dy), 1e-6), 0.45);
  return [from[0] + dx * scale, from[1] + dy * scale];
}

// ---- Color helpers ----------------------------------------------

/** Linear interpolation between two 0xRRGGBB colors. Returns
 *  components in [0, 1] (the range three.js's vertex colors use). */
export function lerpColorHex(
  c1: number,
  c2: number,
  t: number,
): [number, number, number] {
  const r1 = ((c1 >> 16) & 0xff) / 255;
  const g1 = ((c1 >> 8) & 0xff) / 255;
  const b1 = (c1 & 0xff) / 255;
  const r2 = ((c2 >> 16) & 0xff) / 255;
  const g2 = ((c2 >> 8) & 0xff) / 255;
  const b2 = (c2 & 0xff) / 255;
  return [r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t];
}

export type SyncedBranchOptions = {
  splitPhase: number;
  mergePhase: number;
  particleCount: number;
  yEnter: number;
  yExit: number;
  colorFrom: number;
  colorTo: number;
  colorAfterBlock?: number;
  recombineY?: number;
  recombineColor?: number;
  recombineRadius?: number;
  particleSize?: number;
  opacity?: number;
};

export function createSyncedBranchFlow(
  path: Vec2[],
  opts: SyncedBranchOptions,
): Primitive {
  const {
    splitPhase,
    mergePhase,
    particleCount,
    yEnter,
    yExit,
    colorFrom,
    colorTo,
    colorAfterBlock = colorTo,
    recombineY,
    recombineColor = colorAfterBlock,
    recombineRadius = 0.045,
    particleSize = 3.0,
    opacity = 0.75,
  } = opts;

  const segs = path.length - 1;
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < segs; i++) {
    const dx = path[i + 1][0] - path[i][0];
    const dy = path[i + 1][1] - path[i][1];
    const l = Math.hypot(dx, dy);
    segLens.push(l);
    total += l;
  }
  const sampleAt = (u: number): Vec2 => {
    const target = (((u % 1) + 1) % 1) * total;
    let acc = 0;
    for (let i = 0; i < segs; i++) {
      if (acc + segLens[i] >= target) {
        const f = (target - acc) / Math.max(segLens[i], 1e-4);
        return [
          path[i][0] + (path[i + 1][0] - path[i][0]) * f,
          path[i][1] + (path[i + 1][1] - path[i][1]) * f,
        ];
      }
      acc += segLens[i];
    }
    return path[path.length - 1];
  };

  const particles = createParticleMeshes(
    particleCount,
    particleSize,
    colorFrom,
    opacity,
  );

  const win = mergePhase - splitPhase;
  const yDir = yExit > yEnter ? 1 : -1;
  const yLo = Math.min(yEnter, yExit);
  const yHi = Math.max(yEnter, yExit);

  function tick(t: number) {
    for (let i = 0; i < particleCount; i++) {
      const streamPhase = (t + i / particleCount) % 1;
      if (streamPhase >= splitPhase && streamPhase < mergePhase) {
        const u = (streamPhase - splitPhase) / win;
        const [x, y] = sampleAt(u);
        particles.meshes[i].position.set(x, y, 0);

        // State model: the branch duplicates the stream color at the
        // split, changes while passing through its block, keeps that
        // block output while traveling back, then changes again at ⊕.
        let from = colorFrom;
        let to = colorFrom;
        let tint = 1;
        if (y > yLo && y < yHi) {
          from = colorFrom;
          to = colorTo;
          tint = yDir > 0 ? (y - yLo) / (yHi - yLo) : (yHi - y) / (yHi - yLo);
        } else if (recombineY !== undefined) {
          const d = Math.abs(y - recombineY);
          if (d < recombineRadius) {
            from = colorAfterBlock;
            to = recombineColor;
            tint = 1 - d / recombineRadius;
          } else if (y >= yHi) {
            from = colorAfterBlock;
            to = colorAfterBlock;
          }
        } else if (y >= yHi) {
          from = colorAfterBlock;
          to = colorAfterBlock;
        }
        const [r, g, b] = lerpColorHex(from, to, tint);
        particles.mats[i].color.setRGB(r, g, b);
      } else {
        particles.meshes[i].position.set(9999, 9999, 0);
      }
    }
  }

  return { mesh: particles.group, tick, dispose: particles.dispose };
}

// ---- Disc: small filled circle, for token glyphs etc. -----------

export function createDisc(
  cx: number,
  cy: number,
  radius: number,
  opts: { color?: number; opacity?: number; segments?: number } = {},
): Primitive {
  const color = opts.color ?? PALETTE.INK;
  const opacity = opts.opacity ?? OPACITY.LABEL;
  const geo = new THREE.CircleGeometry(radius, opts.segments ?? 24);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, cy, 0);
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ---- Junction: ⊕ marker for "add residual back to stream" --------

/** Small circle with a plus inside — the canonical "add" junction.
 *  Use at every point where a branch rejoins the residual stream. */
export function createPlusMarker(
  cx: number,
  cy: number,
  radius: number,
  opts: { color?: number; opacity?: number } = {},
): Primitive {
  const color = opts.color ?? PALETTE.INK_SOFT;
  const opacity = opts.opacity ?? OPACITY.STROKE;
  const verts: number[] = [];
  const segments = 28;
  for (let i = 0; i < segments; i++) {
    const a1 = (i / segments) * Math.PI * 2;
    const a2 = ((i + 1) / segments) * Math.PI * 2;
    pushSegment(
      verts,
      cx + Math.cos(a1) * radius,
      cy + Math.sin(a1) * radius,
      cx + Math.cos(a2) * radius,
      cy + Math.sin(a2) * radius,
    );
  }
  const bar = radius * 0.55;
  pushSegment(verts, cx - bar, cy, cx + bar, cy);
  pushSegment(verts, cx, cy - bar, cx, cy + bar);
  const geo = geometry(verts);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export type FlowOptions = {
  color?: number;
  colorStages?: Array<{
    yMin: number;
    yMax: number;
    color: number;
  }>;
  colorZones?: Array<{
    yMin: number;
    yMax: number;
    color: number;
    fade?: number;
  }>;
  opacity?: number;
  particleCount?: number;
  particleSize?: number;
  loops?: number;
  phase?: number;
};

export function createPathFlow(
  waypoints: Vec2[],
  opts: FlowOptions = {},
): Primitive {
  const color = opts.color ?? PALETTE.INK;
  const colorStages = opts.colorStages ?? [];
  const colorZones = opts.colorZones ?? [];
  const opacity = opts.opacity ?? OPACITY.PARTICLE;
  const particleCount = opts.particleCount ?? 10;
  const particleSize = opts.particleSize ?? 3;
  const loops = opts.loops ?? 1;
  const phase = opts.phase ?? 0;

  const segs = waypoints.length - 1;
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < segs; i++) {
    const dx = waypoints[i + 1][0] - waypoints[i][0];
    const dy = waypoints[i + 1][1] - waypoints[i][1];
    const len = Math.hypot(dx, dy);
    segLens.push(len);
    total += len;
  }

  const sampleAt = (u: number): Vec2 => {
    const target = (((u % 1) + 1) % 1) * total;
    let acc = 0;
    for (let i = 0; i < segs; i++) {
      if (acc + segLens[i] >= target) {
        const f = (target - acc) / Math.max(segLens[i], 1e-4);
        const [x0, y0] = waypoints[i];
        const [x1, y1] = waypoints[i + 1];
        return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
      }
      acc += segLens[i];
    }
    return waypoints[waypoints.length - 1];
  };

  const particles = createParticleMeshes(
    particleCount,
    particleSize,
    color,
    opacity,
  );

  function tick(t: number) {
    const base = (t * loops + phase) % 1;
    for (let i = 0; i < particleCount; i++) {
      const u = (base + i / particleCount) % 1;
      const [x, y] = sampleAt(u);
      particles.meshes[i].position.set(x, y, 0);
      if (colorStages.length > 0 || colorZones.length > 0) {
        const [r, g, b] =
          colorStages.length > 0
            ? colorAtStages(color, colorStages, y)
            : colorAtY(color, colorZones, y);
        particles.mats[i].color.setRGB(r, g, b);
      }
    }
  }

  return { mesh: particles.group, tick, dispose: particles.dispose };
}

function colorAtStages(
  baseColor: number,
  stages: NonNullable<FlowOptions["colorStages"]>,
  y: number,
): [number, number, number] {
  let current = baseColor;
  for (const stage of [...stages].sort(
    (a, b) => Math.min(a.yMin, a.yMax) - Math.min(b.yMin, b.yMax),
  )) {
    const lo = Math.min(stage.yMin, stage.yMax);
    const hi = Math.max(stage.yMin, stage.yMax);
    if (y < lo) return lerpColorHex(current, current, 0);
    if (y <= hi)
      return lerpColorHex(
        current,
        stage.color,
        (y - lo) / Math.max(hi - lo, 1e-4),
      );
    current = stage.color;
  }
  return lerpColorHex(current, current, 0);
}

function colorAtY(
  baseColor: number,
  zones: NonNullable<FlowOptions["colorZones"]>,
  y: number,
): [number, number, number] {
  for (const zone of zones) {
    const lo = Math.min(zone.yMin, zone.yMax);
    const hi = Math.max(zone.yMin, zone.yMax);
    const fade = zone.fade ?? 0.02;
    if (y < lo - fade || y > hi + fade) continue;
    const enter =
      fade <= 0 ? 1 : Math.min(1, Math.max(0, (y - (lo - fade)) / fade));
    const exit =
      fade <= 0 ? 1 : Math.min(1, Math.max(0, (hi + fade - y) / fade));
    return lerpColorHex(baseColor, zone.color, Math.min(enter, exit));
  }
  return lerpColorHex(baseColor, baseColor, 0);
}
