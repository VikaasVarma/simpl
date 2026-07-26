import { cameraProfileForViewport, screenToWorld } from "../camera";
import { paletteForTheme } from "../constants";
import { drawDomNotes } from "../rendering/dom/notes";
import { drawFlows, drawHalos, drawNotes } from "../rendering";
import {
  buildFlows,
  endpointFromAngle,
  sourceHighlightEndpoint,
} from "../flows";
import type { FlowEndpoint, Rect } from "../flows";
import type { FlowLine } from "../rendering/graph/flows";
import type { GraphSceneApp, SceneState } from "./types";
import { flowIdsForHit, hitTestScene } from "./hitTest";

export function redrawScene(app: GraphSceneApp, state: SceneState): void {
  const { width, height } = app.root.getBoundingClientRect();
  const profile = cameraProfileForViewport(width, height);
  applyViewportProfile(app, profile);
  state.currentNoteLayouts = drawDomNotes(
    app.domNotes,
    app.view.notes,
    app.camera,
    width,
    height,
    profile,
    state.settings.theme,
    `${state.settings.textScale}:${state.settings.lineWidth}`,
  );
  state.drawnHtmlNotes = app.domNotes.drawn;
  drawNotes(
    app.view.notes,
    state.currentNoteLayouts,
    state.focusedNode && app.camera.zoom >= profile.focusZoom
      ? state.focusedNode.id
      : null,
  );

  redrawFlows(app, state);
  state.dirty = true;
}

function applyViewportProfile(
  app: GraphSceneApp,
  profile: ReturnType<typeof cameraProfileForViewport>,
): void {
  app.root.style.setProperty("--graph-ui-scale", profile.uiScale.toFixed(3));
  app.root.style.setProperty("--graph-edge-inset", `${profile.edgeInset}px`);
}

function redrawFlows(app: GraphSceneApp, state: SceneState): void {
  const { width, height } = app.root.getBoundingClientRect();
  const flowPalette = paletteForTheme(state.settings.theme).flow;
  state.cachedFlowLayouts = buildFlows(
    app.links.map((link) => {
      const sourceRect = noteRect(state, link.source.index);
      const sourceAngle = Math.atan2(
        link.target.y - link.source.y,
        link.target.x - link.source.x,
      );
      const sourceEndpoint = sourceEndpointForLink(
        app,
        state,
        link,
        sourceRect,
        sourceAngle,
      );
      return {
        id: link.id,
        source:
          sourceEndpoint ??
          endpointFromAngle(link.source.id, sourceRect, sourceAngle),
        target: endpointFromAngle(
          link.target.id,
          noteRect(state, link.target.index),
          sourceAngle + Math.PI,
        ),
        colorIndex: link.colorIndex,
      };
    }),
    app.camera,
    width,
    height,
  );
  updateHoverFromPointer(app, state, width, height);
  drawHalos(app.view.notes, state.cachedFlowLayouts);
  drawFlows(
    app.view.flows,
    state.cachedFlowLayouts.map(
      (layout): FlowLine => ({
        path: layout.route,
        color: flowPalette[layout.colorIndex],
        active: state.activeFlowIds.has(layout.id),
        hovered: state.hoveredFlowIds.has(layout.id),
      }),
    ),
  );
}

function updateHoverFromPointer(
  app: GraphSceneApp,
  state: SceneState,
  width: number,
  height: number,
): void {
  const screen = state.pointerScreen;
  if (!screen) {
    state.hoveredFlowIds = new Set();
    return;
  }
  const hit = hitTestScene(
    app,
    state,
    screen,
    screenToWorld(screen, app.camera, width, height),
  );
  state.hoveredFlowIds = flowIdsForHit(app, hit);
}

function noteRect(state: SceneState, index: number): Rect {
  const rect = state.currentNoteLayouts[index]?.rect;
  if (!rect) throw new Error(`Missing note layout for index ${index}`);
  return rect;
}

function sourceEndpointForLink(
  app: GraphSceneApp,
  state: SceneState,
  link: GraphSceneApp["links"][number],
  sourceRect: Rect,
  sourceAngle: number,
): FlowEndpoint | null {
  const layout = state.currentNoteLayouts[link.source.index];
  const note = app.domNotes.notes[link.source.index];

  return sourceHighlightEndpoint({
    sourceId: link.source.id,
    targetId: link.target.id,
    sourceRect,
    target: link.target,
    connections: link.source.connections,
    noteElement: note.element,
    bodyElement: note.body.element,
    bodyInner: note.body.inner,
    bodyProgress: layout.bodyProgress,
    summaryAngle: sourceAngle,
  });
}
