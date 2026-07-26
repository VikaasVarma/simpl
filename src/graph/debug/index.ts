import type { GraphSceneApp, SceneState } from "../scene/types";
import { graphMode } from "../data";

const STORAGE_KEY = "working-notes:graph-debug:v1";

export function mountDebug(app: GraphSceneApp, state: SceneState): void {
  const debug = createDebugPanel();
  app.root.append(debug.element);

  let enabled = localStorage.getItem(STORAGE_KEY) !== "0";
  let frames = 0;
  let fps = 0;
  let last = performance.now();
  let settling = false;

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
  debug.settle.addEventListener("click", () => {
    settling = !settling;
    app.simulation.settle(settling);
    render();
  });
  debug.saveSeed.addEventListener("click", () => {
    void saveSeed(app, debug.saveSeed);
  });

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
    debug.settle.textContent = settling ? "settle on" : "settle";
    debug.settle.classList.toggle("is-active", settling);
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
  settle: HTMLButtonElement;
  saveSeed: HTMLButtonElement;
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
  const controls = document.createElement("div");
  const settle = document.createElement("button");
  const saveSeed = document.createElement("button");

  element.className = "graph-debug-panel";
  toggle.type = "button";
  toggle.className = "graph-debug-panel__toggle";
  graphMode.type = "button";
  graphMode.className = "graph-debug-panel__mode";
  controls.className = "graph-debug-panel__controls";
  settle.type = "button";
  settle.className = "graph-debug-panel__button";
  settle.textContent = "settle";
  saveSeed.type = "button";
  saveSeed.className = "graph-debug-panel__button";
  saveSeed.textContent = "save seed";
  body.className = "graph-debug-panel__body";
  controls.append(settle, saveSeed);
  body.append(graphMode);
  body.append(controls);
  element.append(toggle, body);

  return {
    element,
    toggle,
    body,
    htmlNotes,
    notes,
    fps,
    regime,
    graphMode,
    settle,
    saveSeed,
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

async function saveSeed(
  app: GraphSceneApp,
  button: HTMLButtonElement,
): Promise<void> {
  const original = button.textContent || "save seed";
  button.disabled = true;
  button.textContent = "saving...";
  try {
    const response = await fetch("/__graph-debug/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodes: app.nodes.map((node) => ({
          id: node.id,
          x: round(node.x),
          y: round(node.y),
        })),
      }),
    });
    if (!response.ok) throw new Error(await response.text());
    button.textContent = "saved";
  } catch (error) {
    console.error(error);
    button.textContent = "failed";
  } finally {
    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, 1200);
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
