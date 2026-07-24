import type { VisualizationFactory } from "./types";

type MaskSpec = {
  length: number;
  frameSinks?: number[];
  window: number;
  causal?: boolean;
  title: string;
};

const SPECS: Record<string, MaskSpec> = {
  "causal-attention-mask": {
    title: "causal",
    length: 16,
    window: 16,
    causal: true,
  },
  "windowed-attention-mask": {
    title: "windowed",
    length: 16,
    window: 4,
    causal: true,
  },
  "longlive-attention-mask": {
    title: "longlive",
    length: 16,
    frameSinks: [0],
    window: 3,
    causal: true,
  },
};

const GROUPS: Record<string, MaskSpec[]> = {
  "attention-mask-pair": [
    SPECS["causal-attention-mask"],
    SPECS["windowed-attention-mask"],
  ],
};

type Cell = "sink" | "window" | "blocked";

export const createAttentionMask: VisualizationFactory = (canvas, mount) => {
  const specs =
    GROUPS[mount.dataset.viz ?? ""] ??
    [SPECS[mount.dataset.viz ?? ""] ?? SPECS["longlive-attention-mask"]];
  const stopResize = watchResize(mount, () => draw(canvas, specs));
  draw(canvas, specs);
  return {
    resume: () => draw(canvas, specs),
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

function draw(canvas: HTMLCanvasElement, specs: readonly MaskSpec[]): void {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio * 2, 4);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);
  drawPanels(ctx, specs, rect.width, rect.height);
}

function drawPanels(
  ctx: CanvasRenderingContext2D,
  specs: readonly MaskSpec[],
  width: number,
  height: number,
): void {
  const gap = specs.length > 1 ? 24 : 0;
  const panelW = (width - gap * (specs.length - 1)) / specs.length;
  specs.forEach((spec, index) =>
    drawPanel(ctx, spec, index * (panelW + gap), 0, panelW, height),
  );
  legend(ctx, width / 2 - 76, height - 24);
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  spec: MaskSpec,
  panelX: number,
  panelY: number,
  panelW: number,
  panelH: number,
): void {
  const n = spec.length;
  const pad = 30;
  const label = 20;
  const top = 58;
  const bottom = 42;
  const size = Math.min(panelW - pad * 2 - label, panelH - top - bottom);
  const cell = size / n;
  const x0 = panelX + (panelW - size + label) / 2;
  const y0 = panelY + top;
  const mask = attentionMask(spec);

  ctx.fillStyle = "#3a3128";
  ctx.font = "600 12px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spec.title, x0 + size / 2, panelY + 14);

  ctx.font = "600 11px IBM Plex Mono, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6f665d";
  ctx.fillText("key", x0 + size / 2, y0 - 18);
  ctx.save();
  ctx.translate(x0 - 34, y0 + size / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("query", 0, 0);
  ctx.restore();

  for (let q = 0; q < n; q++) {
    for (let k = 0; k < n; k++) {
      const kind = mask[q][k];
      ctx.fillStyle = kind === "blocked" ? "#f3efe7" : "#d8c7a1";
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
}

function legend(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const items = [
    ["#d8c7a1", "visible"],
    ["#f3efe7", "masked"],
  ];
  items.forEach(([color, text], i) => {
    ctx.fillStyle = color;
    roundRect(ctx, x + i * 86, y, 12, 12, 3);
    ctx.fill();
    ctx.fillStyle = "#6f665d";
    ctx.font = "500 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(text, x + i * 86 + 18, y + 6);
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
