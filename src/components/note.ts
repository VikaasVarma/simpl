import { NOTE } from "../graph/constants";
import type { GraphNode } from "../graph/graphTypes";
import {
  createBodyComponent,
  setBodyContent,
  setBodyProgress,
  type BodyComponent,
} from "./body/index";
import {
  createLinkComponent,
  setLinkContent,
  setLinkVisible,
  type LinkComponent,
} from "./link";

export type NoteComponent = {
  element: HTMLElement;
  title: HTMLElement;
  link: LinkComponent;
  summary: HTMLElement;
  body: BodyComponent;
};

export function createNoteComponent(measure = false): NoteComponent {
  const element = document.createElement("div");
  const content = document.createElement("div");
  const title = document.createElement("h2");
  const summary = document.createElement("p");
  const link = createLinkComponent();
  const body = createBodyComponent();
  element.className = measure
    ? "graph-dom-note graph-dom-note--measure"
    : "graph-dom-note";
  content.className = "graph-dom-note__content";
  title.className = "graph-dom-note__title";
  summary.className = "graph-dom-note__summary";
  content.append(title, summary, link.element, body.element);
  element.append(content);
  return { element, title, link, summary, body };
}

export function setNoteContent(
  note: NoteComponent,
  title: string,
  summary = "",
  link = "",
): void {
  if (note.title.textContent !== title) note.title.textContent = title;
  if (note.summary.textContent !== summary) note.summary.textContent = summary;
  setLinkContent(note.link, link);
}

export function setNoteBody(note: NoteComponent, node: GraphNode): void {
  setBodyContent(note.body, node);
}

export function setNoteStyle(
  note: NoteComponent,
  zoom: number,
  titleSize: number,
  summaryProgress = 1,
  bodyProgress = 1,
  regime?: string,
): void {
  note.element.style.setProperty("--note-pad-x", px(NOTE.dom.padX, zoom));
  note.element.style.setProperty("--note-pad-top", px(NOTE.dom.padTop, zoom));
  note.element.style.setProperty(
    "--note-pad-bottom",
    px(NOTE.dom.padBottom, zoom),
  );
  note.element.style.setProperty("--note-gap", px(NOTE.dom.gap, zoom));
  note.element.style.setProperty("--note-body-gap", px(NOTE.dom.bodyGap, zoom));
  note.element.style.setProperty(
    "--note-body-top-fade",
    px(NOTE.dom.bodyGap + NOTE.dom.fadeH, zoom),
  );
  note.element.style.setProperty(
    "--note-fade-height",
    px(NOTE.dom.fadeH, zoom),
  );
  note.element.style.setProperty("--note-title-size", textPx(titleSize, zoom));
  note.element.style.setProperty(
    "--note-summary-size",
    textPx(NOTE.dom.textSize, zoom),
  );
  note.element.style.setProperty(
    "--note-body-size",
    textPx(NOTE.dom.textSize, zoom),
  );
  note.element.style.setProperty("--note-reading-col", readingCol(zoom));
  note.element.style.borderRadius = `${NOTE.radius * zoom}px`;
  if (regime) note.element.dataset.regime = regime;

  note.summary.hidden = !note.summary.textContent || summaryProgress <= 0;
  note.summary.style.opacity = String(summaryProgress);
  setLinkVisible(note.link, regime === "reader");
  setBodyProgress(note.body, bodyProgress, regime === "reader");
  note.element.style.setProperty("--note-body-progress", String(bodyProgress));
}

function px(value: number, scale: number): string {
  return `${value * scale}px`;
}

function textPx(value: number, scale: number): string {
  return `calc(${px(value, scale)} * var(--reader-text-scale, 1))`;
}

function readingCol(scale: number): string {
  return `calc(var(--reader-line-width, ${NOTE.dom.readingCol}px) * ${scale})`;
}
