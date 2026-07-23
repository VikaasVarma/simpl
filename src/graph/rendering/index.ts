import { Color, WebGLRenderer } from "three";
import { PALETTE, paletteForTheme } from "../constants";
import type { ThemeName } from "../constants";
import type { SimNode } from "../simulation/types";
import type { GraphView } from "./graph/types";
import { createFlowLayer, createNoteView, updateNoteTheme } from "./graph";

export { drawFlows, drawHalos, drawNotes, pickNote } from "./graph";

export function createRenderer(root: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(new Color(PALETTE.bg));
  root.appendChild(renderer.domElement);
  return renderer;
}

export function applyGraphTheme(
  renderer: WebGLRenderer,
  view: GraphView,
  theme: ThemeName,
): void {
  const palette = paletteForTheme(theme);
  renderer.setClearColor(new Color(palette.bg));
  view.notes.forEach((note) => updateNoteTheme(note, palette));
}

export function createGraphView(nodes: SimNode[]): GraphView {
  return {
    flows: createFlowLayer(),
    notes: nodes.map(createNoteView),
  };
}
