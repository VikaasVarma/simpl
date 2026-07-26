import type { GraphNode } from "../../graph/graphTypes";
import { graphMode } from "../../graph/data";
import {
  disposeVisualizations,
  mountVisualizations,
  setVisualizationsActive,
} from "../../visualizations/mount";

const COPIED_RESET_MS = 1400;
const bodies = new Map<string, string>();

export type BodyComponent = {
  element: HTMLElement;
  inner: HTMLElement;
  sourceId: string;
  hasContent: boolean;
};

export function createBodyComponent(): BodyComponent {
  const element = document.createElement("div");
  const inner = document.createElement("div");
  element.className = "graph-dom-note__body";
  inner.className = "graph-dom-note__body-inner";
  element.append(inner);
  element.addEventListener("scroll", () => updateBodyScrollFlags(element), {
    passive: true,
  });
  element.addEventListener("click", handleCodeBlockClick);
  element.addEventListener(
    "wheel",
    (event) => {
      if (horizontalScrollerOwns(event)) {
        event.stopPropagation();
        return;
      }
      if (isReader(element) && canScroll(element, event.deltaY))
        event.stopPropagation();
    },
    { passive: true },
  );
  return { element, inner, sourceId: "", hasContent: false };
}

export function setBodyContent(body: BodyComponent, node: GraphNode): void {
  if (body.sourceId === node.id) return;
  disposeVisualizations(body.inner);
  body.sourceId = node.id;
  body.hasContent = node.hasBody;
  body.inner.innerHTML = "";
  if (!node.hasBody) return;

  void loadBody(node.id).then((html) => {
    if (body.sourceId !== node.id) return;
    body.inner.innerHTML = html;
    mountVisualizations(body.inner, isReader(body.element));
    requestAnimationFrame(() => {
      updateBodyScrollFlags(body.element);
      body.element.dispatchEvent(new CustomEvent("graph-body-load"));
    });
  });
}

export function setBodyProgress(
  body: BodyComponent,
  progress: number,
  reader = false,
): void {
  body.element.hidden = !body.hasContent || progress <= 0;
  body.element.dataset.reader = reader ? "true" : "false";
  body.element.style.opacity = String(progress);
  setVisualizationsActive(body.inner, reader && !body.element.hidden);
}

async function handleCodeBlockClick(event: MouseEvent): Promise<void> {
  const modeButton = (
    event.target as Element | null
  )?.closest<HTMLButtonElement>("[data-code-mode-toggle]");
  if (modeButton) {
    event.stopPropagation();
    setCodeMode(modeButton);
    return;
  }

  const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
    ".code-copy-btn",
  );
  if (!button) return;
  event.stopPropagation();
  const text =
    button
      .closest(".code-block-wrap")
      ?.querySelector<HTMLTextAreaElement>("[data-code-copy-text]")?.value ??
    "";
  try {
    await navigator.clipboard.writeText(text);
    copied(button, "copied");
  } catch {
    copied(button, "error");
  }
}

function setCodeMode(button: HTMLButtonElement): void {
  const wrap = button.closest<HTMLElement>(".code-block-wrap");
  if (!wrap) return;
  const mode = wrap.dataset.codeMode === "diff" ? "code" : "diff";
  wrap.dataset.codeMode = mode;
  button.textContent = mode;
}

function copied(button: HTMLButtonElement, label: string): void {
  button.textContent = label;
  button.classList.add("is-copied");
  window.setTimeout(() => {
    button.textContent = "copy";
    button.classList.remove("is-copied");
  }, COPIED_RESET_MS);
}

function updateBodyScrollFlags(body: HTMLElement): void {
  if (!isReader(body)) return;
  const max = body.scrollHeight - body.clientHeight;
  const hasScroll = max > 2;
  body
    .closest(".graph-dom-note")
    ?.classList.toggle("is-body-scrolled", hasScroll && body.scrollTop > 2);
  body
    .closest(".graph-dom-note")
    ?.classList.toggle(
      "is-body-at-bottom",
      hasScroll && body.scrollTop >= max - 2,
    );
}

function canScroll(element: HTMLElement, deltaY: number): boolean {
  const max = element.scrollHeight - element.clientHeight;
  if (max <= 0) return false;
  return deltaY < 0 ? element.scrollTop > 0 : element.scrollTop < max - 1;
}

function horizontalScrollerOwns(event: WheelEvent): boolean {
  if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return false;
  const scroller = (event.target as Element | null)?.closest<HTMLElement>(
    "[data-wheel-x]",
  );
  if (!scroller) return false;
  const max = scroller.scrollWidth - scroller.clientWidth;
  if (max <= 0) return false;
  return event.deltaX < 0
    ? scroller.scrollLeft > 0
    : scroller.scrollLeft < max - 1;
}

function isReader(body: HTMLElement): boolean {
  return body.dataset.reader === "true";
}

async function loadBody(id: string): Promise<string> {
  const mode = graphMode();
  const key = `${mode}:${id}`;
  const cached = bodies.get(key);
  if (cached !== undefined) return cached;
  const { graphBodies } = !import.meta.env.DEV
    ? await import("../../../generated/graph/bodies")
    : mode === "official"
      ? await import("../../../generated/graph/published/bodies")
      : await import("../../../generated/graph/unofficial/bodies");
  const html = (graphBodies as Record<string, string>)[id];
  if (html === undefined) throw new Error(`Missing generated body for ${id}.`);
  bodies.set(key, html);
  return html;
}
