import { pickFlows, type Point } from "../flows";
import { pickNote } from "../rendering";
import type { SimNode } from "../simulation";
import type { GraphSceneApp, SceneState } from "./types";

export type SceneHit =
  | { kind: "note"; id: string; node: SimNode }
  | { kind: "flow"; id: string }
  | { kind: "highlight"; sourceId: string; groupId: string }
  | { kind: "popup"; id: string }
  | { kind: "link"; href: string }
  | { kind: "body"; noteId?: string }
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

function hitTestDom(root: HTMLElement, screen: Point): SceneHit | null {
  const rect = root.getBoundingClientRect();
  const element = document.elementFromPoint(
    rect.left + screen.x,
    rect.top + screen.y,
  );
  if (!element) return null;

  const popup = element.closest<HTMLElement>(".graph-popup");
  if (popup) return { kind: "popup", id: popup.dataset.targetId ?? "" };

  const flowLabel = element.closest<HTMLElement>(".graph-flow-label");
  if (flowLabel) return { kind: "flow", id: flowLabel.dataset.flowId ?? "" };

  const link = element.closest("a[href]");
  if (link instanceof HTMLAnchorElement)
    return { kind: "link", href: link.href };
  if (element.closest("button, input, textarea, select"))
    return { kind: "hud" };

  const highlight = element.closest<HTMLElement>(".graph-highlight");
  if (highlight)
    return {
      kind: "highlight",
      sourceId: highlight.dataset.sourceId ?? "",
      groupId: highlight.dataset.groupId ?? "",
    };

  const body = element.closest(".graph-dom-note__body");
  if (body)
    return {
      kind: "body",
      noteId:
        body.closest<HTMLElement>(".graph-dom-note")?.dataset.noteId ??
        undefined,
    };
  return null;
}
