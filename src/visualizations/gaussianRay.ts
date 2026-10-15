import type { VisualizationFactory } from "./types";
import { PALETTE } from "../lib/visualizations/core/palette";

const COLORS = [
  PALETTE.SIGNAL.BLUE,
  PALETTE.SIGNAL.AMBER,
  PALETTE.SIGNAL.CORAL,
];
const BRIGHTNESS_MAX = 0.22;
const CURVE_SCALE = 1.5;
const CURVE_WIDTH_MAX = 5;
const CURVE_WIDTH_MIN = 1.2;
const BLOBS = [
  { x: 0.27, y: -5, sigma: 0.052, opacity: 0.8 },
  { x: 0.5, y: 4, sigma: 0.061, opacity: 0.68 },
  { x: 0.73, y: -3, sigma: 0.055, opacity: 0.74 },
];

// exp(-4.5 r^2) over r in [-1, 1]; matches the falloff the old gradient
// stops sampled, but evaluated per-pixel instead of interpolated linearly
// between four points, so the curve itself is an actual Gaussian.
const BLOB_K = 4.5;
const BLOB_TEXTURE_SIZE = 128;
const blobTextures = new Map<number, HTMLCanvasElement>();

function getBlobTexture(color: number): HTMLCanvasElement {
  const cached = blobTextures.get(color);
  if (cached) return cached;
  const size = BLOB_TEXTURE_SIZE;
  const tex = document.createElement("canvas");
  tex.width = size;
  tex.height = size;
  const tctx = tex.getContext("2d")!;
  const image = tctx.createImageData(size, size);
  const center = (size - 1) / 2;
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (px - center) / center;
      const dy = (py - center) / center;
      const alpha = 0.8 * Math.exp(-BLOB_K * (dx * dx + dy * dy));
      const i = (py * size + px) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = Math.round(255 * Math.min(1, alpha));
    }
  }
  tctx.putImageData(image, 0, 0);
  blobTextures.set(color, tex);
  return tex;
}

export const createGaussianRay: VisualizationFactory = (canvas, mount) => {
  const draw = () => render(canvas);
  const resize = new ResizeObserver(draw);
  resize.observe(mount);
  draw();
  return { resume: draw, dispose: () => resize.disconnect() };
};

function render(canvas: HTMLCanvasElement): void {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio * 2, 4);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);

  const centerY = height * 0.18;
  const ray = {
    left: width * 0.1,
    right: width * 0.9,
    top: centerY - height * 0.025,
    bottom: centerY + height * 0.015,
  };
  const rayY = (t: number) => ray.bottom + (ray.top - ray.bottom) * t;
  const radiusX = width * 0.105;
  const radiusY = height * 0.155;
  const samples = compositeRay(
    ray.left,
    ray.right,
    BLOBS.map((blob) => (rayY(blob.x) - centerY - blob.y) / radiusY),
  );

  BLOBS.forEach((blob, i) => {
    const x = ray.left + (ray.right - ray.left) * blob.x;
    const y = centerY + blob.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radiusX, radiusY);
    ctx.drawImage(getBlobTexture(COLORS[i]), -1, -1, 2, 2);
    ctx.restore();
  });

  const plot = {
    left: ray.left,
    right: ray.right,
    top: height * 0.53,
    bottom: height * 0.92,
  };
  ctx.save();
  ctx.setLineDash([2, 5]);
  BLOBS.forEach((blob, i) => {
    const x = ray.left + (ray.right - ray.left) * blob.x;
    ctx.strokeStyle = rgba(COLORS[i], 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, rayY(blob.x) + 4);
    ctx.lineTo(x, plot.bottom);
    ctx.stroke();
  });
  ctx.restore();
  for (let i = 0; i < samples.length - 1; i++) {
    ctx.strokeStyle = rgb(samples[i].color);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    const t0 = i / (samples.length - 1);
    const t1 = (i + 1) / (samples.length - 1);
    ctx.moveTo(samples[i].x, rayY(t0));
    ctx.lineTo(samples[i + 1].x, rayY(t1));
    ctx.stroke();
  }
  arrow(
    ctx,
    ray.right - 7,
    rayY(0.94),
    ray.right + 5,
    rayY(1.08),
    rgb(samples.at(-1)!.color),
  );

  drawAxes(ctx, plot);

  // Curve thickness ~ light remaining (1 - accrued brightness), normalized
  // against the brightness actually reached so the taper is visible even
  // though raw brightness never gets close to 1.
  const finalBrightness = Math.max(samples.at(-1)!.brightness, 1e-6);
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    const x0 =
      plot.left +
      ((a.x - ray.left) / (ray.right - ray.left)) * (plot.right - plot.left);
    const x1 =
      plot.left +
      ((b.x - ray.left) / (ray.right - ray.left)) * (plot.right - plot.left);
    const y0 =
      plot.bottom -
      (a.brightness / BRIGHTNESS_MAX) * (plot.bottom - plot.top) * CURVE_SCALE;
    const y1 =
      plot.bottom -
      (b.brightness / BRIGHTNESS_MAX) * (plot.bottom - plot.top) * CURVE_SCALE;
    const remaining = 1 - a.brightness / finalBrightness;
    ctx.strokeStyle = vividRgb(a.color);
    ctx.lineWidth = CURVE_WIDTH_MIN + remaining * (CURVE_WIDTH_MAX - CURVE_WIDTH_MIN);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

type Sample = {
  x: number;
  brightness: number;
  color: [number, number, number];
};

function compositeRay(
  left: number,
  right: number,
  rayOffsets: number[],
): Sample[] {
  const result: Sample[] = [];
  const count = 240;
  const ds = 0.8 / count;
  const colors = COLORS.map(
    (color) =>
      [
        toLinear(((color >> 16) & 255) / 255),
        toLinear(((color >> 8) & 255) / 255),
        toLinear((color & 255) / 255),
      ] as [number, number, number],
  );
  let transmittance = 1;
  const accumulated: [number, number, number] = [0, 0, 0];

  for (let n = 0; n <= count; n++) {
    const t = n / count;
    for (let i = 0; i < BLOBS.length; i++) {
      const blob = BLOBS[i];
      const dx = (t - blob.x) / blob.sigma;
      const dy = rayOffsets[i];
      const density = blob.opacity * Math.exp(-0.5 * (dx * dx + dy * dy));
      const alpha = 1 - Math.exp(-density * ds * 10);
      for (let channel = 0; channel < 3; channel++)
        accumulated[channel] += transmittance * alpha * colors[i][channel];
      transmittance *= 1 - alpha;
    }
    const [r, g, b] = accumulated;
    result.push({
      x: left + t * (right - left),
      brightness: Math.min(1, 0.2126 * r + 0.7152 * g + 0.0722 * b),
      color: accumulated.map((value) => Math.min(1, value)) as [
        number,
        number,
        number,
      ],
    });
  }
  return result;
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  plot: { left: number; right: number; top: number; bottom: number },
): void {
  const axisTop = plot.bottom - (plot.bottom - plot.top) * 1.35;
  ctx.strokeStyle = "#9d9488";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(plot.left, axisTop);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - 6, y1 - 4);
  ctx.lineTo(x1 - 6, y1 + 4);
  ctx.closePath();
  ctx.fill();
}

function rgba(color: number, alpha: number): string {
  return `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;
}

function rgb(color: [number, number, number]): string {
  return `rgb(${color.map((value) => Math.round(toSrgb(value) * 255)).join(",")})`;
}

function vividRgb(color: [number, number, number]): string {
  const channels = color.map(toSrgb);
  const gray =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return `rgb(${channels.map((value) => Math.round(Math.max(0, Math.min(1, gray + (value - gray) * 2.8)) * 255)).join(",")})`;
}

function toLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function toSrgb(value: number): number {
  return value <= 0.0031308
    ? value * 12.92
    : 1.055 * value ** (1 / 2.4) - 0.055;
}
