import type { GraphSceneApp, SceneState } from "../scene/types";
import { graphMode } from "../data";

const STORAGE_KEY = "working-notes:graph-debug:v1";

export function mountDebug(app: GraphSceneApp, state: SceneState): void {
  const debug = createDebugPanel();
  app.root.append(debug.element);
  document.head.append(debug.style);

  let enabled = localStorage.getItem(STORAGE_KEY) !== "0";
  let frames = 0;
  let fps = 0;
  let last = performance.now();

  if (!enabled && graphMode() === "unofficial") {
    setGraphMode("official");
    return;
  }
  apply();
  debug.toggle.addEventListener("click", () => {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    if (!enabled && graphMode() === "unofficial") {
      setGraphMode("official");
      return;
    }
    apply();
  });
  debug.graphMode.addEventListener("click", switchGraphMode);

  requestAnimationFrame(tick);

  function tick(now: number): void {
    frames++;
    if (now - last >= 500) {
      fps = Math.round((frames * 1000) / (now - last));
      frames = 0;
      last = now;
      render();
    }
    requestAnimationFrame(tick);
  }

  function apply(): void {
    app.root.classList.toggle("graph-debug", enabled);
    debug.body.hidden = !enabled;
    debug.toggle.textContent = enabled ? "debug on" : "debug off";
    render();
  }

  function render(): void {
    if (!enabled) return;
    set(debug.htmlNotes, state.drawnHtmlNotes);
    set(debug.notes, app.nodes.length);
    set(debug.fps, fps);
    set(debug.regime, app.domNotes.debug || "unknown");
    debug.graphMode.textContent = `graph: ${graphMode()}`;
  }
}

type DebugPanel = {
  element: HTMLElement;
  toggle: HTMLButtonElement;
  body: HTMLElement;
  htmlNotes: HTMLElement;
  notes: HTMLElement;
  fps: HTMLElement;
  regime: HTMLElement;
  graphMode: HTMLButtonElement;
  style: HTMLStyleElement;
};

function createDebugPanel(): DebugPanel {
  const element = document.createElement("div");
  const toggle = document.createElement("button");
  const body = document.createElement("div");
  const htmlNotes = row(body, "HTML notes");
  const notes = row(body, "Notes");
  const fps = row(body, "FPS");
  const regime = row(body, "Regime");
  const graphMode = document.createElement("button");
  const style = document.createElement("style");

  element.className = "graph-debug-panel";
  toggle.type = "button";
  toggle.className = "graph-debug-panel__toggle";
  graphMode.type = "button";
  graphMode.className = "graph-debug-panel__mode";
  body.className = "graph-debug-panel__body";
  body.append(graphMode);
  element.append(toggle, body);
  style.textContent = `
    .graph-debug .graph-dom-note:not([hidden]) {
      outline: 1px solid color-mix(in srgb, var(--accent) 58%, transparent);
      outline-offset: -1px;
    }

    .graph-debug-panel {
      position: absolute;
      left: 14px;
      bottom: 12px;
      z-index: 7;
      color: var(--text-muted);
      font: 500 12px / 1.35 var(--font-mono);
      pointer-events: auto;
    }

    .graph-debug-panel__toggle {
      padding: 4px 6px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 6px;
      background: color-mix(in srgb, var(--bg) 82%, transparent);
      color: var(--text-muted);
      cursor: pointer;
      font: inherit;
    }

    .graph-debug-panel__body {
      min-width: 152px;
      margin-top: 6px;
      padding: 7px 8px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(8px);
    }

    .graph-debug-panel__row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
    }

    .graph-debug-panel__mode {
      width: 100%;
      margin-top: 6px;
      padding: 3px 5px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
  `;

  return {
    element,
    toggle,
    body,
    htmlNotes,
    notes,
    fps,
    regime,
    graphMode,
    style,
  };
}

function row(parent: HTMLElement, label: string): HTMLElement {
  const element = document.createElement("div");
  const value = document.createElement("span");
  element.className = "graph-debug-panel__row";
  element.innerHTML = `<span>${label}</span>`;
  element.append(value);
  parent.append(element);
  return value;
}

function set(element: HTMLElement, value: string | number): void {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function switchGraphMode(): void {
  setGraphMode(graphMode() === "official" ? "unofficial" : "official");
}

function setGraphMode(mode: ReturnType<typeof graphMode>): void {
  const url = new URL(location.href);
  if (mode === "official") url.searchParams.delete("graph");
  else url.searchParams.set("graph", mode);
  location.href = url.toString();
}
