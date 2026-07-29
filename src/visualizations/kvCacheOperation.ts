import type { VisualizationFactory } from "./types";
import { PALETTE } from "../lib/visualizations/core/palette";

const N = 8;
const INK = "#3a3128";
const MUTED = "#6f665d";
const EDGE = "#cfc6b9";
const Q = cssHex(PALETTE.SIGNAL.VIOLET);
const K = cssHex(PALETTE.SIGNAL.AMBER);
const V = cssHex(PALETTE.SIGNAL.BLUE);
const VALUE_W = 22;
const OP_GAP = 68;
const OUT_GAP = 68;
const SCALE = 0.7;
const PANEL_GAP = 76;
const CHUNK_GAP = 28;
const CHUNK_DOWN = 14;
const OUTPUT_PULL = 18;

export const createKvCacheOperation: VisualizationFactory = (canvas, mount) => {
  const stopResize = watchResize(mount, () => draw(canvas));
  draw(canvas);
  return {
    resume: () => draw(canvas),
    dispose: stopResize,
  };
};

function draw(canvas: HTMLCanvasElement): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio * 2, 4);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.translate(rect.width / 2, rect.height / 2);
  ctx.scale(SCALE, SCALE);
  ctx.translate(-rect.width / 2, -rect.height / 2);

  const width = (size: number) => size + OP_GAP + VALUE_W + OUT_GAP + VALUE_W;
  const size = Math.max(
    34,
    Math.min(
      rect.width * 0.24,
      rect.width * 0.62 - OP_GAP - VALUE_W,
      (rect.height - PANEL_GAP - CHUNK_GAP - 56) / 3,
    ),
  );
  const x = (rect.width - width(size)) / 2;
  let y = (rect.height - size * 3 - PANEL_GAP - CHUNK_GAP) / 2 + 20;
  drawPanel(ctx, x, y, size, range(0, N));
  drawOperator(ctx, rect.width / 2, y + size + PANEL_GAP / 2, "=");
  y += size + PANEL_GAP + CHUNK_DOWN;
  drawPanel(ctx, x, y, size, range(0, N - 4), true, OUTPUT_PULL);
  y += size + CHUNK_GAP;
  drawPanel(ctx, x, y, size, range(4, N), false, -OUTPUT_PULL);
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rows: number[],
  labels = true,
  outputOffset = 0,
): void {
  const valuesX = x + size + OP_GAP;
  const outputX = valuesX + VALUE_W + OUT_GAP;
  const outputY = y + outputOffset;
  drawQk(ctx, x, y, size, rows, labels);
  if (labels) drawValueLabel(ctx, valuesX, y - 26);
  drawValues(ctx, valuesX, y, size, range(0, N), V);
  drawArrowOperator(
    ctx,
    valuesX + VALUE_W,
    y + size / 2,
    outputX,
    outputY + size / 2,
  );
  if (labels) drawValueLabel(ctx, outputX, y - 26, "output");
  drawValues(ctx, outputX, outputY, size, rows, null);
}

function drawQk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rows: number[],
  labels: boolean,
): void {
  const cell = size / N;
  const h = rows.length * cell;
  const yy = y + (size - h) / 2;
  if (labels) {
    ctx.fillStyle = MUTED;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("key", x + size / 2, yy - 26);
    ctx.save();
    ctx.translate(x - 38, yy + h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("query", 0, 0);
    ctx.restore();
  }
  drawTokenLine(ctx, x, yy - 10, size, true, range(0, N), K);
  drawTokenLine(ctx, x - 14, yy, h, false, rows, Q);

  rows.forEach((q, row) => {
    for (let k = 0; k < N; k++) {
      ctx.fillStyle = cellColor(q, k);
      roundRect(
        ctx,
        x + k * cell + 1,
        yy + row * cell + 1,
        cell - 2,
        cell - 2,
        4,
      );
      ctx.fill();
    }
  });

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, yy, size, h);
}

function drawValues(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  rows: number[],
  color: string | null,
): void {
  const cell = height / N;
  const h = rows.length * cell;
  const yy = y + (height - h) / 2;
  rows.forEach((i, row) => {
    ctx.fillStyle = color ?? outputColor(i);
    ctx.beginPath();
    ctx.arc(x + VALUE_W / 2, yy + (row + 0.5) * cell, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawOperator(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
): void {
  ctx.fillStyle = INK;
  ctx.font = "600 16px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawArrowOperator(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.save();
  ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
  ctx.rotate(Math.atan2(y2 - y1, x2 - x1));
  drawOperator(ctx, 0, 0, "⇒");
  ctx.restore();
}

function drawValueLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text = "value",
): void {
  ctx.fillStyle = MUTED;
  ctx.font = "600 11px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + VALUE_W / 2, y);
}

function drawTokenLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  horizontal: boolean,
  rows: number[],
  color: string,
): void {
  const step = size / rows.length;
  ctx.fillStyle = color;
  rows.forEach((_, i) => {
    ctx.beginPath();
    ctx.arc(
      x + (horizontal ? (i + 0.5) * step : 0),
      y + (horizontal ? 0 : (i + 0.5) * step),
      4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  });
}

function cellColor(q: number, k: number): string {
  const t = Math.pow(hash01(q, k), 0.75);
  return cssHex(
    mixHex(
      mixHex(PALETTE.SIGNAL.VIOLET, PALETTE.SIGNAL.AMBER, t),
      PALETTE.PAPER,
      0.18,
    ),
  );
}

function outputColor(i: number): string {
  const t = 0.14 + 0.72 * hash01(i, 19);
  return cssHex(
    mixHex(
      mixHex(PALETTE.SIGNAL.GREEN, PALETTE.SURFACE.SAGE, t),
      PALETTE.INK,
      0.08,
    ),
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start }, (_, i) => start + i);
}

function hash01(a: number, b: number): number {
  const x = Math.sin((a + 1) * 127.1 + (b + 1) * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

function cssHex(value: number): string {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function watchResize(mount: HTMLElement, draw: () => void): () => void {
  const observer = new ResizeObserver(draw);
  observer.observe(mount);
  return () => observer.disconnect();
}
