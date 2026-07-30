import { CAMERA } from "../constants";
import {
  cameraProfileForViewport,
  eventToWorld,
  followNode,
  resizeCamera,
  zoomAt,
  zoomAtScreen,
} from "../camera";
import { isFixedNode } from "../simulation";
import {
  hasPopups,
  hidePopups,
  showConnectionPopups,
} from "../../components/popups";
import { clamp, smoothstep } from "../utils/math";
import { fitCameraToRoot } from "./focus";
import {
  flowIdsForHit,
  hitTestScene,
  localPoint,
  type SceneHit,
} from "./hitTest";
import type { FocusOptions, GraphSceneApp, SceneState } from "./types";
import type { CameraProfile } from "../camera";
import type { SimNode } from "../simulation";
import type { WorldPoint } from "../camera";
import type { Point } from "../flows";

const DRAG_PX = 4;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type DragState = { node: SimNode; offset: Point } | null;
type PinchState = { center: Point; distance: number } | null;
type SafariGestureEvent = Event & {
  clientX: number;
  clientY: number;
  scale: number;
};
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
  focusParent: () => boolean;
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
  let pinch: PinchState = null;
  let safariGestureScale = 1;
  const activePointers = new Map<number, Point>();

  app.root.addEventListener("pointerdown", onPointerDown);
  app.root.addEventListener("pointermove", onPointerMove);
  app.root.addEventListener("pointerleave", onPointerLeave);
  app.root.addEventListener("mouseover", onMouseHover);
  app.root.addEventListener("mouseout", onMouseLeave);
  app.root.addEventListener("pointerup", onPointerRelease);
  app.root.addEventListener("pointercancel", onPointerRelease);
  app.root.addEventListener("lostpointercapture", onPointerRelease);
  window.addEventListener("pointerup", onPointerRelease, true);
  window.addEventListener("pointercancel", onPointerRelease, true);
  window.addEventListener("wheel", onBrowserZoomWheel, {
    passive: false,
    capture: true,
  });
  window.addEventListener("gesturestart", onSafariGestureStart, {
    passive: false,
    capture: true,
  });
  window.addEventListener("gesturechange", onSafariGestureChange, {
    passive: false,
    capture: true,
  });
  window.addEventListener("gestureend", onSafariGestureEnd, {
    passive: false,
    capture: true,
  });
  app.root.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("resize", () => resize(app, state, actions.redraw));
  bindHistory(state, actions, app);

  function onPointerDown(event: PointerEvent): void {
    const screen = localPoint(app.root, event.clientX, event.clientY);
    state.pointerScreen = screen;
    activePointers.set(event.pointerId, screen);
    if (activePointers.size >= 2) {
      app.root.setPointerCapture(event.pointerId);
      beginPinch(event);
      return;
    }

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
    state.pointerScreen = localPoint(app.root, event.clientX, event.clientY);
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, state.pointerScreen);
    }
    if (pinch) {
      updatePinch(event);
      return;
    }

    if (!pointer) {
      updateHover(app, state, actions.redraw, event);
      return;
    }
    if (pointer.id !== event.pointerId) return;

    const p = eventToWorld(event, app.renderer.domElement, app.camera);
    if (pointer.mode === "pending" && moved(app.root, event, pointer)) {
      state.focusedNode = null;
      if (pointer.hit.kind === "dom-note") {
        pointer.mode = "pan";
        pan = pointer.startWorld;
      } else if (pointer.hit.kind === "note") {
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
    activePointers.delete(event.pointerId);
    if (pinch && activePointers.size < 2) pinch = null;
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
      else if (pointer.hit.kind === "dom-note")
        actions.focusById(pointer.hit.id);
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

  function beginPinch(event: PointerEvent): void {
    event.preventDefault();
    state.cancelFocusAnimation?.();
    state.cancelFocusAnimation = null;
    releaseDrag();
    pointer = null;
    pan = null;
    pinch = samplePinch();
  }

  function updatePinch(event: PointerEvent): void {
    event.preventDefault();
    const next = samplePinch();
    if (!next || !pinch) return;
    const { width, height } = app.root.getBoundingClientRect();
    const profile = cameraProfileForViewport(width, height);
    const targetZoom = clamp(
      app.camera.zoom * (next.distance / pinch.distance),
      profile.minZoom,
      profile.maxZoom,
    );
    zoomAtScreen(app.camera, next.center, app.renderer.domElement, targetZoom);
    app.camera.position.x += (pinch.center.x - next.center.x) / app.camera.zoom;
    app.camera.position.y -= (pinch.center.y - next.center.y) / app.camera.zoom;
    app.camera.updateMatrixWorld();
    pinch = next;
    if (state.focusedNode && app.camera.zoom <= profile.regimes.summary) {
      state.focusedNode = null;
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
    actions.redraw();
  }

  function samplePinch(): PinchState {
    const points = [...activePointers.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1),
    };
  }

  function releaseDrag(): void {
    if (!drag) return;
    app.simulation.release(drag.node);
    drag = null;
  }

  function onWheel(event: WheelEvent): void {
    zoomFromWheel(app, state, actions, event);
  }

  function onBrowserZoomWheel(event: WheelEvent): void {
    if (!event.ctrlKey || !eventInGraph(app.root, event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    zoomFromWheel(app, state, actions, event);
  }

  function onSafariGestureStart(event: Event): void {
    if (!eventInGraph(app.root, event)) return;
    event.preventDefault();
    safariGestureScale = 1;
    state.cancelFocusAnimation?.();
    state.cancelFocusAnimation = null;
  }

  function onSafariGestureChange(event: Event): void {
    if (!eventInGraph(app.root, event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const gesture = event as SafariGestureEvent;
    const { width, height } = app.root.getBoundingClientRect();
    const profile = cameraProfileForViewport(width, height);
    const targetZoom = clamp(
      app.camera.zoom * (gesture.scale / safariGestureScale),
      profile.minZoom,
      profile.maxZoom,
    );
    safariGestureScale = gesture.scale;
    zoomAtScreen(
      app.camera,
      localPoint(app.root, gesture.clientX, gesture.clientY),
      app.renderer.domElement,
      targetZoom,
    );
    if (state.focusedNode && app.camera.zoom <= profile.regimes.summary) {
      state.focusedNode = null;
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
    actions.redraw();
  }

  function onSafariGestureEnd(event: Event): void {
    if (!eventInGraph(app.root, event)) return;
    event.preventDefault();
    safariGestureScale = 1;
  }

  function onPointerLeave(): void {
    state.pointerScreen = null;
    if (state.hoveredFlowIds.size) {
      state.hoveredFlowIds = new Set();
      actions.redraw();
    }
  }

  function onMouseHover(event: MouseEvent): void {
    if (pointer || pinch) return;
    state.pointerScreen = localPoint(app.root, event.clientX, event.clientY);
    updateHover(app, state, actions.redraw, event);
  }

  function onMouseLeave(event: MouseEvent): void {
    if (
      event.relatedTarget instanceof Node &&
      app.root.contains(event.relatedTarget)
    )
      return;
    onPointerLeave();
  }
}

// -----------------------------------------------------------------------------
// Wheel Zoom
// -----------------------------------------------------------------------------

function zoomFromWheel(
  app: GraphSceneApp,
  state: SceneState,
  actions: Pick<SceneInputActions, "redraw">,
  event: WheelEvent,
): void {
  event.preventDefault();
  const { width, height } = app.root.getBoundingClientRect();
  const profile = cameraProfileForViewport(width, height);
  state.cancelFocusAnimation?.();
  state.cancelFocusAnimation = null;
  zoomAt(
    app.camera,
    event,
    app.renderer.domElement,
    wheelTargetZoom(app, event, profile),
  );
  if (state.focusedNode && app.camera.zoom <= profile.regimes.summary) {
    state.focusedNode = null;
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }
  actions.redraw();
}

function eventInGraph(root: HTMLElement, event: Event): boolean {
  if (event.target instanceof Node && root.contains(event.target)) return true;
  if (!("clientX" in event) || !("clientY" in event)) return false;
  const { left, right, top, bottom } = root.getBoundingClientRect();
  const { clientX, clientY } = event as MouseEvent;
  return (
    clientX >= left && clientX <= right && clientY >= top && clientY <= bottom
  );
}

function wheelTargetZoom(
  app: GraphSceneApp,
  event: WheelEvent,
  profile: CameraProfile,
): number {
  const scale = focusZoomScale(app.camera.zoom, profile.focusZoom);
  return clamp(
    app.camera.zoom * Math.exp(-event.deltaY * CAMERA.wheel.speed * scale),
    profile.minZoom,
    profile.maxZoom,
  );
}

function focusZoomScale(zoom: number, focusZoom: number): number {
  const distance = Math.abs(Math.log(zoom / focusZoom));
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
  if (state.focusedNode && !state.cancelFocusAnimation) {
    const profile = cameraProfileForViewport(width, height);
    app.camera.zoom = profile.focusZoom;
    app.camera.updateProjectionMatrix();
    followNode(app.camera, state.focusedNode);
  } else fitCameraToRoot(app);
  redraw();
}

// -----------------------------------------------------------------------------
// Pointer Gestures
// -----------------------------------------------------------------------------

function moved(
  root: HTMLElement,
  event: PointerEvent,
  pointer: NonNullable<PointerState>,
): boolean {
  const screen = localPoint(root, event.clientX, event.clientY);
  return (
    Math.hypot(
      screen.x - pointer.startScreen.x,
      screen.y - pointer.startScreen.y,
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
  event: PointerEvent | MouseEvent,
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
  return ["hud", "link", "popup"].includes(hit.kind);
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
  if (group.connections.length === 1 && target && !target.labelHtml) {
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
      actions.focusById(decodeURIComponent(location.hash.slice(1)), {
        updateHash: false,
      });
    } else actions.focusById(null, { updateHash: false });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || isTyping(event.target)) return;
    if (hasPopups(app.popups)) {
      closePopups(app, state, actions.redraw);
      event.preventDefault();
      return;
    }
    if (actions.focusParent()) {
      event.preventDefault();
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
