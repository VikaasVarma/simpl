import type { VisualizationFactory } from "./types";

type MaskSpec = {
  length: number;
  frameSinks?: number[];
  window: number;
  causal?: boolean;
};

const SPECS: Record<string, MaskSpec> = {
  "longlive-attention-mask": {
    length: 16,
    frameSinks: [0],
    window: 3,
    causal: true,
  },
};

type Cell = "sink" | "window" | "blocked";

export const createAttentionMask: VisualizationFactory = (canvas, mount) => {
  const spec = SPECS[mount.dataset.viz ?? ""] ?? SPECS["longlive-attention-mask"];
  const stopResize = watchResize(mount, () => draw(canvas, spec));
  draw(canvas, spec);
  return {
    resume: () => draw(canvas, spec),
    dispose: stopResize,
  };
};

export function attentionMask(spec: MaskSpec): Cell[][] {
  const sinks = new Set(spec.frameSinks ?? []);
  return Array.from({ length: spec.length }, (_, q) =>
    Array.from({ length: spec.length }, (_, k) => {
      if (sinks.has(k) && (spec.causal === false || k <= q)) return "sink";
      if (spec.causal !== false && k > q) return "blocked";
      return q - k < spec.window && q >= k ? "window" : "blocked";
    }),
  );
}

function draw(canvas: HTMLCanvasElement, spec: MaskSpec): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio * 2, 4);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const n = spec.length;
  const pad = 34;
  const label = 22;
  const top = 50;
  const bottom = 10;
  const size = Math.min(rect.width - pad * 2 - label, rect.height - top - bottom);
  const cell = size / n;
  const x0 = (rect.width - size + label) / 2;
  const y0 = top;
  const mask = attentionMask(spec);

  ctx.font = "600 11px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6f665d";
  ctx.fillText("key", x0 + size / 2, y0 - 30);
  ctx.save();
  ctx.translate(x0 - 34, y0 + size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("query", 0, 0);
  ctx.restore();

  for (let q = 0; q < n; q++) {
    for (let k = 0; k < n; k++) {
      const kind = mask[q][k];
      ctx.fillStyle =
        kind === "sink" ? "#769f8f" : kind === "window" ? "#d8c7a1" : "#f3efe7";
      roundRect(ctx, x0 + k * cell + 1, y0 + q * cell + 1, cell - 2, cell - 2, 4);
      ctx.fill();
    }
  }

  ctx.strokeStyle = "#cfc6b9";
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);

  ctx.fillStyle = "#3a3128";
  ctx.font = "600 10px IBM Plex Mono, monospace";
  for (let i = 0; i < n; i++) {
    if (i % 3 && i !== 0 && i !== n - 1) continue;
    ctx.fillText(String(i), x0 + (i + 0.5) * cell, y0 - 6);
    ctx.fillText(String(i), x0 - 12, y0 + (i + 0.5) * cell);
  }

  legend(ctx, x0 + size + 18, y0 + 8);
}

function legend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  [
    ["#769f8f", "frame sink"],
    ["#d8c7a1", "window"],
    ["#f3efe7", "masked"],
  ].forEach(([color, text], i) => {
    ctx.fillStyle = color;
    roundRect(ctx, x, y + i * 22, 12, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#6f665d";
    ctx.font = "500 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(text, x + 18, y + i * 22 + 6);
  });
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
