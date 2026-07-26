import type { OrthographicCamera } from "three";
import type { CameraProfile } from "../../camera";
import {
  NOTE,
  NOTE_CARD,
  paletteForTheme,
  type ThemeName,
} from "../../constants";
import { worldToScreen } from "../../camera";
import { type NoteRegime, sampleLod } from "../graph/layout";
import { lerp } from "../../utils/math";
import {
  createNoteComponent,
  setNoteBody,
  setNoteContent,
  setNoteStyle,
  type NoteComponent,
} from "../../../components/note";
import type { NoteView } from "../graph/types";
import { isRectInViewport, type Rect } from "../../flows";

export type NoteLayout = {
  id: string;
  rect: Rect;
  regime: NoteRegime;
  bodyProgress: number;
};

export type DomNoteLayer = {
  element: HTMLElement;
  measure: HTMLElement;
  notes: NoteComponent[];
  heights: Map<string, { title: number; summary: number }>;
  debug: string;
  drawn: number;
};

export function createDomNotes(root: HTMLElement, count: number): DomNoteLayer {
  const element = document.createElement("div");
  const measure = document.createElement("div");

  element.className = "graph-dom-notes";
  measure.className = "graph-dom-measure";
  measure.style.width = `${NOTE.w}px`;

  const notes = Array.from({ length: count }, () => {
    const note = createNoteComponent();
    element.appendChild(note.element);
    return note;
  });

  root.append(element, measure);

  return {
    element,
    measure,
    notes,
    heights: new Map(),
    debug: "",
    drawn: 0,
  };
}

export function bindDomNoteScroll(
  layer: DomNoteLayer,
  redraw: () => void,
): void {
  let queued = false;
  const queueRedraw = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      redraw();
    });
  };
  layer.notes.forEach((note) => {
    note.body.element.addEventListener("scroll", queueRedraw, {
      passive: true,
    });
    note.body.element.addEventListener("graph-body-load", queueRedraw);
  });
}

export function drawDomNotes(
  layer: DomNoteLayer,
  notes: readonly NoteView[],
  camera: OrthographicCamera,
  width: number,
  height: number,
  profile: CameraProfile,
  theme: ThemeName,
  measureKey = "",
): NoteLayout[] {
  const palette = paletteForTheme(theme);
  layer.element.style.setProperty(
    "--note-background",
    palette[NOTE_CARD.background],
  );

  const layouts: NoteLayout[] = [];
  layer.debug = "";
  layer.drawn = 0;

  for (let i = 0; i < layer.notes.length; i++) {
    const note = layer.notes[i];
    const data = notes[i];
    note.element.hidden = !data;
    if (!data) continue;

    const title = data.node.title;
    const summary = data.node.summary;
    note.element.dataset.noteId = data.node.id;
    const endpoint = endpointHeights(layer, title, summary, measureKey);
    const lod = sampleLod(camera.zoom, profile, {
      title: endpoint.title,
      summary: endpoint.summary,
      reader: NOTE.readerH,
    });
    const worldH = lod.height;

    const rect = { x: data.node.x, y: data.node.y, w: NOTE.w, h: worldH };
    layouts[i] = {
      id: data.node.id,
      rect,
      regime: lod.regime,
      bodyProgress: lod.bodyProgress,
    };

    if (!isRectInViewport(rect, camera, width, height, NOTE.w)) {
      note.element.hidden = true;
      continue;
    }
    layer.drawn++;

    const p = worldToScreen(data.node, camera, width, height);

    note.element.style.transform = `translate3d(${
      p.x - (NOTE.w * camera.zoom) / 2
    }px, ${p.y - (worldH * camera.zoom) / 2}px, 0) scale(${camera.zoom})`;
    note.element.style.width = `${NOTE.w}px`;
    note.element.style.height = `${worldH}px`;

    setNoteContent(note, title, summary, data.node.link);
    if (lod.bodyProgress > 0) setNoteBody(note, data.node);

    setNoteStyle(
      note,
      1,
      lerp(NOTE.dom.titleSize, NOTE.dom.summaryTitleSize, lod.summaryProgress),
      lod.summaryProgress,
      lod.bodyProgress,
      lod.regime,
    );

    if (!layer.debug) layer.debug = debugLabel(lod);
  }
  return layouts;
}

function endpointHeights(
  layer: DomNoteLayer,
  title: string,
  summary: string,
  measureKey: string,
): { title: number; summary: number } {
  const key = `${measureKey}\n${title}\n${summary}`;
  const cached = layer.heights.get(key);
  if (cached) return cached;

  layer.measure.innerHTML = "";
  const titleCard = measuringNote(title, "", NOTE.dom.titleSize);
  const summaryCard = measuringNote(title, summary, NOTE.dom.summaryTitleSize);
  layer.measure.append(titleCard.element, summaryCard.element);
  const heights = {
    title: titleCard.element.offsetHeight,
    summary: summaryCard.element.offsetHeight,
  };
  layer.heights.set(key, heights);
  return heights;
}

function measuringNote(
  titleText: string,
  summaryText: string,
  titleSize: number,
): NoteComponent {
  const note = createNoteComponent(true);
  setNoteContent(note, titleText, summaryText);
  setNoteStyle(note, 1, titleSize);
  return note;
}

function debugLabel(lod: ReturnType<typeof sampleLod>): string {
  if (lod.bodyProgress > 0 && lod.bodyProgress < 1)
    return `summary -> reader ${percent(lod.bodyProgress)}`;
  if (lod.summaryProgress > 0 && lod.summaryProgress < 1)
    return `title -> summary ${percent(lod.summaryProgress)}`;
  if (lod.compactProgress > 0 && lod.compactProgress < 1)
    return `landmark -> title ${percent(lod.compactProgress)}`;
  return lod.regime;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
