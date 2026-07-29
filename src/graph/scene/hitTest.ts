import { pickFlows, type Point } from "../flows";
import { pickNote } from "../rendering";
import type { SimNode } from "../simulation";
import type { GraphSceneApp, SceneState } from "./types";

export type SceneHit =
  | { kind: "note"; id: string; node: SimNode }
  | { kind: "dom-note"; id: string }
  | { kind: "flow"; id: string }
  | { kind: "highlight"; sourceId: string; groupId: string }
  | { kind: "popup"; id: string }
  | { kind: "link"; href: string }
  | { kind: "hud" }
  | { kind: "empty" };

export function localPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
): Point {
  const rect = root.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function hitTestScene(
  app: GraphSceneApp,
  state: SceneState,
  screen: Point,
  world: Point,
): SceneHit {
  // Hit priority follows visual stacking: DOM controls, note bodies, note cards,
  // flow lines, then empty canvas.
  const domHit = hitTestDom(app.root, screen);
  if (domHit) return domHit;

  const note = pickNote(world, app.view.notes, state.currentNoteLayouts);
  if (note) return { kind: "note", id: note.node.id, node: note.node };

  const flow = pickFlows(
    state.cachedFlowLayouts,
    screen.x,
    screen.y,
    12,
    app.camera,
    app.root.clientWidth,
    app.root.clientHeight,
  )[0];
  return flow ? { kind: "flow", id: flow.id } : { kind: "empty" };
}

export function flowIdsForHit(
  app: GraphSceneApp,
  hit: SceneHit,
): ReadonlySet<string> {
  if (hit.kind === "flow") return new Set([hit.id]);
  if (hit.kind !== "highlight") return new Set();

  const source = app.nodeById.get(hit.sourceId);
  const group = source?.connections.find((item) => item.id === hit.groupId);
  if (!source || !group) return new Set();
  return new Set(
    group.connections.map((connection) =>
      `${source.id}->${connection.target}`,
    ),
  );
}

function hitTestDom(root: HTMLElement, screen: Point): SceneHit | null {
  const rect = root.getBoundingClientRect();
  const element = document.elementFromPoint(
    rect.left + screen.x,
    rect.top + screen.y,
  );
  if (!element) return null;

  const popup = element.closest<HTMLElement>(".graph-popup");
  if (popup) return { kind: "popup", id: popup.dataset.targetId ?? "" };

  const link = element.closest("a[href]");
  if (link instanceof HTMLAnchorElement)
    return { kind: "link", href: link.href };
  if (element.closest(".graph-search"))
    return { kind: "hud" };
  if (element.closest("button, input, textarea, select"))
    return { kind: "hud" };

  const highlight = element.closest<HTMLElement>(".graph-highlight");
  if (highlight)
    return {
      kind: "highlight",
      sourceId: highlight.dataset.sourceId ?? "",
      groupId: highlight.dataset.groupId ?? "",
    };

  const note = element.closest<HTMLElement>(".graph-dom-note");
  if (note?.dataset.noteId) return { kind: "dom-note", id: note.dataset.noteId };
  return null;
}
