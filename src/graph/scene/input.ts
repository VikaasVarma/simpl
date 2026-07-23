import { CAMERA } from "../constants";
import { eventToWorld, followNode, resizeCamera, zoomAt } from "../camera";
import { isFixedNode } from "../simulation";
import {
  hasPopups,
  hidePopups,
  showConnectionPopups,
} from "../../components/popups";
import { clamp, smoothstep } from "../utils/math";
import { fitCameraToRoot } from "./focus";
import { hitTestScene, localPoint, type SceneHit } from "./hitTest";
import type { FocusOptions, GraphSceneApp, SceneState } from "./types";
import type { SimNode } from "../simulation";
import type { WorldPoint } from "../camera";
import type { Point } from "../flows";

const DRAG_PX = 4;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type DragState = { node: SimNode; offset: Point } | null;
type PointerState = {
  id: number;
  startScreen: Point;
  startWorld: Point;
  hit: SceneHit;
  mode: "pending" | "drag" | "pan";
} | null;

export type SceneInputActions = {
  redraw: () => void;
  focusOn: (node: SimNode, options?: FocusOptions) => void;
  focusById: (id?: string | null, options?: FocusOptions) => boolean;
  defocus: () => void;
  goBack: () => boolean;
  clearHistory: () => void;
};

// -----------------------------------------------------------------------------
// Binding
// -----------------------------------------------------------------------------

export function bindSceneInput(
  app: GraphSceneApp,
  state: SceneState,
  actions: SceneInputActions,
): void {
  let pointer: PointerState = null;
  let drag: DragState = null;
  let pan: WorldPoint | null = null;

  app.root.addEventListener("pointerdown", onPointerDown);
  app.root.addEventListener("pointermove", onPointerMove);
  app.root.addEventListener("pointerup", onPointerRelease);
  app.root.addEventListener("pointercancel", onPointerRelease);
  app.root.addEventListener("lostpointercapture", onPointerRelease);
  window.addEventListener("pointerup", onPointerRelease, true);
  window.addEventListener("pointercancel", onPointerRelease, true);
  app.root.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", () => resize(app, state, actions.redraw));
  bindHistory(state, actions, app);

  function onPointerDown(event: PointerEvent): void {
    const screen = localPoint(app.root, event.clientX, event.clientY);
    const world = eventToWorld(event, app.renderer.domElement, app.camera);
    const hit = hitTestScene(app, state, screen, world);
    if (domOwnsPointer(hit)) return;
    if (hit.kind !== "highlight") closePopups(app, state, actions.redraw);

    app.root.setPointerCapture(event.pointerId);
    state.cancelFocusAnimation?.();
    state.cancelFocusAnimation = null;
    pointer = {
      id: event.pointerId,
      startScreen: screen,
      startWorld: { x: world.x, y: world.y },
      hit,
      mode: "pending",
    };
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pointer) {
      updateHover(app, state, actions.redraw, event);
      return;
    }
    if (pointer.id !== event.pointerId) return;

    const p = eventToWorld(event, app.renderer.domElement, app.camera);
    if (pointer.mode === "pending" && moved(event, pointer)) {
      state.focusedNode = null;
      if (pointer.hit.kind === "note") {
        const node = pointer.hit.node;
        if (isFixedNode(node)) {
          pointer.mode = "pan";
          pan = pointer.startWorld;
        } else {
          pointer.mode = "drag";
          drag = { node, offset: { x: node.x - p.x, y: node.y - p.y } };
          drag.node.fx = drag.node.x;
          drag.node.fy = drag.node.y;
          app.simulation.start("drag");
        }
      } else {
        pointer.mode = "pan";
        pan = pointer.startWorld;
      }
    }
    if (drag) {
      drag.node.fx = p.x + drag.offset.x;
      drag.node.fy = p.y + drag.offset.y;
      app.simulation.start("drag");
    } else if (pan) {
      app.camera.position.x += pan.x - p.x;
      app.camera.position.y += pan.y - p.y;
      app.camera.updateMatrixWorld();
    }
    actions.redraw();
  }

  function onPointerRelease(event: PointerEvent): void {
    if (app.root.hasPointerCapture(event.pointerId)) {
      app.root.releasePointerCapture(event.pointerId);
    }
    if (drag) {
      app.simulation.release(drag.node);
      drag = null;
    } else if (
      pointer?.id === event.pointerId &&
      pointer.mode === "pending" &&
      pointer.hit.kind !== "empty"
    ) {
      if (pointer.hit.kind === "note") actions.focusOn(pointer.hit.node);
      else if (pointer.hit.kind === "flow")
        focusFlow(state, actions.focusById, pointer.hit.id);
      else if (pointer.hit.kind === "highlight")
        activateHighlight(
          app,
          state,
          actions.focusById,
          actions.redraw,
          pointer.hit,
        );
    }
    pointer = null;
    pan = null;
  }

  function onWheel(event: WheelEvent): void {
    zoomFromWheel(app, state, actions, event);
  }
}

// -----------------------------------------------------------------------------
// Wheel Zoom
// -----------------------------------------------------------------------------

function zoomFromWheel(
  app: GraphSceneApp,
  state: SceneState,
  actions: Pick<SceneInputActions, "redraw" | "clearHistory">,
  event: WheelEvent,
): void {
  event.preventDefault();
  state.cancelFocusAnimation?.();
  state.cancelFocusAnimation = null;
  zoomAt(
    app.camera,
    event,
    app.renderer.domElement,
    wheelTargetZoom(app, event),
  );
  if (state.focusedNode && app.camera.zoom <= CAMERA.regimes.summary) {
    state.focusedNode = null;
    actions.clearHistory();
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  actions.redraw();
}

function wheelTargetZoom(app: GraphSceneApp, event: WheelEvent): number {
  const scale = focusZoomScale(app.camera.zoom);
  return clamp(
    app.camera.zoom * Math.exp(-event.deltaY * CAMERA.wheel.speed * scale),
    CAMERA.minZoom,
    CAMERA.maxZoom,
  );
}

function focusZoomScale(zoom: number): number {
  const distance = Math.abs(Math.log(zoom / CAMERA.focusZoom));
  const t = smoothstep(
    clamp(1 - distance / CAMERA.wheel.focusStickyRadius, 0, 1),
  );
  return Math.max(
    CAMERA.wheel.minScale,
    1 - CAMERA.wheel.focusStickyStrength * t,
  );
}

// -----------------------------------------------------------------------------
// Resize
// -----------------------------------------------------------------------------

export function resize(
  app: GraphSceneApp,
  state: SceneState,
  redraw: () => void,
): void {
  const { width, height } = app.root.getBoundingClientRect();
  app.renderer.setSize(width, height);
  resizeCamera(app.camera, width, height);
  if (state.focusedNode && !state.cancelFocusAnimation)
    followNode(app.camera, state.focusedNode);
  else fitCameraToRoot(app);
  redraw();
}

// -----------------------------------------------------------------------------
// Pointer Gestures
// -----------------------------------------------------------------------------

function moved(
  event: PointerEvent,
  pointer: NonNullable<PointerState>,
): boolean {
  return (
    Math.hypot(
      event.clientX - pointer.startScreen.x,
      event.clientY - pointer.startScreen.y,
    ) > DRAG_PX
  );
}

// -----------------------------------------------------------------------------
// Hover
// -----------------------------------------------------------------------------

function updateHover(
  app: GraphSceneApp,
  state: SceneState,
  redraw: () => void,
  event: PointerEvent,
): void {
  const screen = localPoint(app.root, event.clientX, event.clientY);
  const hit = hitTestScene(
    app,
    state,
    screen,
    eventToWorld(event, app.renderer.domElement, app.camera),
  );
  const hoveredFlowIds = flowIdsForHit(app, hit);

  if (!sameIds(state.hoveredFlowIds, hoveredFlowIds)) {
    state.hoveredFlowIds = hoveredFlowIds;
    redraw();
  }
}

// -----------------------------------------------------------------------------
// Click Actions
// -----------------------------------------------------------------------------

function domOwnsPointer(hit: SceneHit): boolean {
  return ["body", "hud", "link", "popup"].includes(hit.kind);
}

function flowIdsForHit(app: GraphSceneApp, hit: SceneHit): ReadonlySet<string> {
  if (hit.kind === "flow") return new Set([hit.id]);
  if (hit.kind !== "highlight") return new Set();

  const source = app.nodeById.get(hit.sourceId);
  const group = source?.connections.find((item) => item.id === hit.groupId);
  if (!source || !group) return new Set();
  return new Set(
    group.connections.map((connection) => flowId(source.id, connection.target)),
  );
}

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function activateHighlight(
  app: GraphSceneApp,
  state: SceneState,
  focusById: (id?: string | null) => boolean,
  redraw: () => void,
  hit: Extract<SceneHit, { kind: "highlight" }>,
): void {
  const source = app.nodeById.get(hit.sourceId);
  const group = source?.connections.find((item) => item.id === hit.groupId);
  if (!source || !group) return;

  const target = group.connections[0];
  if (group.connections.length === 1 && target && !target.label) {
    closePopups(app, state);
    focusById(target.target);
    return;
  }

  state.activeFlowIds = new Set(
    group.connections.map((connection) => flowId(source.id, connection.target)),
  );
  showConnectionPopups(
    app.popups,
    group,
    app.nodeById,
    (targetId) => targetSide(app, source, targetId),
    focusById,
    () => closePopups(app, state, redraw),
  );
  document
    .querySelectorAll(".graph-highlight.is-open")
    .forEach((item) => item.classList.remove("is-open"));
  document
    .querySelector(
      `.graph-highlight[data-source-id="${cssEscape(hit.sourceId)}"][data-group-id="${cssEscape(hit.groupId)}"]`,
    )
    ?.classList.add("is-open");
  redraw();
}

function focusFlow(
  state: SceneState,
  focusById: (id?: string | null) => boolean,
  id: string,
): void {
  const flow = state.cachedFlowLayouts.find((layout) => layout.id === id);
  if (!flow) return;
  focusById(
    state.focusedNode?.id === flow.target.id ? flow.source.id : flow.target.id,
  );
}

function targetSide(
  app: GraphSceneApp,
  source: SimNode,
  targetId: string,
): "left" | "right" {
  const target = app.nodeById.get(targetId);
  return target && target.x < source.x ? "left" : "right";
}

function flowId(sourceId: string, targetId: string): string {
  return `${sourceId}->${targetId}`;
}

function cssEscape(value: string): string {
  return CSS.escape(value);
}

function closePopups(
  app: GraphSceneApp,
  state: SceneState,
  redraw?: () => void,
): void {
  hidePopups(app.popups);
  if (!state.activeFlowIds.size) return;
  state.activeFlowIds = new Set();
  if (redraw) redraw();
  else state.dirty = true;
}

// -----------------------------------------------------------------------------
// History / Keyboard
// -----------------------------------------------------------------------------

function bindHistory(
  state: SceneState,
  actions: SceneInputActions,
  app: GraphSceneApp,
): void {
  window.addEventListener("hashchange", () => {
    if (location.hash) {
      actions.clearHistory();
      actions.focusById(decodeURIComponent(location.hash.slice(1)), {
        pushHistory: false,
        updateHash: false,
      });
    } else {
      actions.defocus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isTyping(event.target)) return;
    if (hasPopups(app.popups)) {
      closePopups(app, state, actions.redraw);
      event.preventDefault();
      return;
    }
    if (actions.goBack()) {
      event.preventDefault();
      return;
    }
    if (state.focusedNode) {
      event.preventDefault();
      actions.defocus();
    }
  });
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
