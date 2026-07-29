import type { VisualizationFactory } from "./types";
import { PALETTE } from "../lib/visualizations/core/palette";

const N = 8;
const INK = "#3a3128";
const MUTED = "#6f665d";
const EDGE = "#cfc6b9";
const BRACKET = "#9d8a6e";
const Q = `#${PALETTE.SIGNAL.VIOLET.toString(16).padStart(6, "0")}`;
const K = `#${PALETTE.SIGNAL.AMBER.toString(16).padStart(6, "0")}`;
const V = `#${PALETTE.SIGNAL.BLUE.toString(16).padStart(6, "0")}`;
const VALUE_W = 22;
const BLOCK_GAP = 68;
const BRACKET_PAD = 10;
const LABEL_W = 118;
const LABEL_GAP = 34;
const OUTPUT_GAP = BLOCK_GAP;
const OUT = `#${PALETTE.SIGNAL.GREEN.toString(16).padStart(6, "0")}`;

export const createAttentionOperation: VisualizationFactory = (
  canvas,
  mount,
) => {
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

  const equationW = (size: number) =>
    LABEL_W + LABEL_GAP + size + BLOCK_GAP + VALUE_W + OUTPUT_GAP + VALUE_W;
  const blockSize = Math.max(
    34,
    Math.min(
      rect.width * 0.34,
      rect.width * 0.74 - BLOCK_GAP - VALUE_W,
      rect.width - equationW(0) - 20,
      (rect.height - 42 - 92) / 2,
    ),
  );
  const topY = 42;
  const matrixY = topY + blockSize + 72;
  const gridX = (rect.width - equationW(blockSize)) / 2 + LABEL_W + LABEL_GAP;
  const valuesX = gridX + blockSize + BLOCK_GAP;
  const outputX = valuesX + VALUE_W + OUTPUT_GAP;
  const outputOperatorX = (valuesX + VALUE_W + 11 + outputX + VALUE_W / 2) / 2;
  drawGrid(ctx, gridX, topY, blockSize, true, true);
  drawValueLabel(ctx, valuesX, topY - 26);
  drawValues(ctx, valuesX, topY, blockSize, false, V);
  drawTimes(ctx, outputOperatorX, topY + blockSize / 2, "⇒");
  drawValueLabel(ctx, outputX, topY - 26, "output");
  drawValues(ctx, outputX, topY, blockSize, false, OUT, true);
  drawArrow(
    ctx,
    gridX + blockSize / 2,
    topY + blockSize + 16,
    gridX + blockSize / 2,
    matrixY - 18,
  );
  drawArrow(
    ctx,
    valuesX + VALUE_W / 2,
    topY + blockSize + 16,
    valuesX + 11,
    matrixY - 18,
  );
  drawArrow(
    ctx,
    outputX + VALUE_W / 2,
    topY + blockSize + 16,
    outputX + VALUE_W / 2,
    matrixY - 18,
  );

  drawEquationLabel(ctx, gridX - LABEL_GAP, matrixY + blockSize / 2);
  drawBracketedMatrix(ctx, gridX, matrixY, blockSize);
  drawTimes(ctx, gridX + blockSize + BLOCK_GAP / 2, matrixY + blockSize / 2);
  drawValues(ctx, valuesX, matrixY, blockSize, true, V);
  drawTimes(ctx, outputOperatorX, matrixY + blockSize / 2, "=");
  drawValues(ctx, outputX, matrixY, blockSize, false, OUT, true);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  labels: boolean,
  border: boolean,
): void {
  const cell = size / N;
  if (labels) {
    ctx.fillStyle = MUTED;
    ctx.font = "600 11px IBM Plex Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("key", x + size / 2, y - 26);
    ctx.save();
    ctx.translate(x - 38, y + size / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("query", 0, 0);
    ctx.restore();
    drawKeyTokens(ctx, x, y, size);
    drawQueryTokens(ctx, x, y, size);
  }

  for (let q = 0; q < N; q++) {
    for (let k = 0; k < N; k++) {
      ctx.fillStyle = cellColor(q, k);
      roundRect(ctx, x + k * cell + 1, y + q * cell + 1, cell - 2, cell - 2, 4);
      ctx.fill();
    }
  }

  if (border) {
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
  }
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

function drawTimes(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text = "×",
): void {
  ctx.fillStyle = INK;
  ctx.font = "600 16px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawBracketedMatrix(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  drawLeftBracket(ctx, x - 14, y - BRACKET_PAD, size + BRACKET_PAD * 2);
  drawRightBracket(ctx, x + size + 14, y - BRACKET_PAD, size + BRACKET_PAD * 2);
  drawGrid(ctx, x, y, size, false, false);
}

function drawValues(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  bracketed: boolean,
  color: string,
  gradient = false,
): void {
  if (bracketed) {
    drawLeftBracket(ctx, x - 11, y - BRACKET_PAD, height + BRACKET_PAD * 2);
    drawRightBracket(
      ctx,
      x + VALUE_W + 11,
      y - BRACKET_PAD,
      height + BRACKET_PAD * 2,
    );
  }
  for (let i = 0; i < N; i++) {
    ctx.fillStyle = gradient ? outputColor(i) : color;
    ctx.beginPath();
    ctx.arc(x + VALUE_W / 2, y + ((i + 0.5) / N) * height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
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

function drawEquationLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = INK;
  ctx.font = "600 12px IBM Plex Mono, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Attention(Q, K, V) =", x, y);
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

function drawKeyTokens(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  drawTokenLine(ctx, x, y - 10, size, true, K);
}

function drawQueryTokens(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  drawTokenLine(ctx, x - 14, y, size, false, Q);
}

function drawTokenLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  horizontal: boolean,
  color: string,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.arc(
      x + (horizontal ? (i + 0.5) * (size / N) : 0),
      y + (horizontal ? 0 : (i + 0.5) * (size / N)),
      4,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}

function drawLeftBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
): void {
  drawBracketPath(ctx, x, y, h, 9);
}

function drawRightBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
): void {
  drawBracketPath(ctx, x, y, h, -9);
}

function drawBracketPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  arm: number,
): void {
  ctx.strokeStyle = BRACKET;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + arm, y);
  ctx.lineTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + arm, y + h);
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  ctx.strokeStyle = MUTED;
  ctx.fillStyle = MUTED;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 6, y2 - 8);
  ctx.lineTo(x2 + 6, y2 - 8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
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

function watchResize(mount: HTMLElement, draw: () => void): () => void {
  const observer = new ResizeObserver(draw);
  observer.observe(mount);
  return () => observer.disconnect();
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
