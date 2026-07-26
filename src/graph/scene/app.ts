import { followNode } from "../camera";
import { applyGraphTheme } from "../rendering";
import { createSimulation } from "../simulation";
import {
  applyHudSettings,
  bindHud,
  renderHierarchyRail,
} from "../../components/hud";
import { createSceneBase } from "./setup";
import { redrawScene } from "./draw";
import { createFocusController } from "./focus";
import { bindSceneInput, resize } from "./input";
import { bindDomNoteScroll } from "../rendering/dom/notes";
import { focusParent, hierarchyPath } from "./hierarchy";
import { loadSettings, saveSettings } from "./settings";
import type { GraphSceneApp, SceneState } from "./types";

export async function mountGraphScene(): Promise<{
  redraw: () => void;
}> {
  const state: SceneState = {
    dirty: true,
    focusedNode: null,
    cancelFocusAnimation: null,
    cachedFlowLayouts: [],
    currentNoteLayouts: [],
    hoveredFlowIds: new Set(),
    activeFlowIds: new Set(),
    pointerScreen: null,
    settings: loadSettings(),
    drawnHtmlNotes: 0,
  };

  const base = await createSceneBase();
  let app: GraphSceneApp;
  let focus: ReturnType<typeof createFocusController>;
  let hierarchyIds: string[] = [];

  const redraw = () => {
    updateHudHistory();
    redrawScene(app, state);
  };
  focus = createFocusController(() => app, state, redraw);

  app = {
    ...base,
    simulation: createSimulation({
      nodes: base.nodes,
      links: base.links,
      onTick: () => {
        if (state.focusedNode && !state.cancelFocusAnimation)
          followNode(app.camera, state.focusedNode);
        redraw();
      },
    }),
  };
  bindDomNoteScroll(app.domNotes, redraw);

  bindSceneInput(app, state, {
    redraw,
    focusOn: focus.focusOn,
    focusById: focus.focusById,
    focusParent: () => focusParent(app, state, focus.focusById),
  });
  bindHud(
    app.hud,
    app.nodes,
    state.settings,
    (id) => focus.focusById(id),
    () => {
      saveSettings(state.settings);
      applyHudSettings(state.settings);
      applyGraphTheme(app.renderer, app.view, state.settings.theme);
      state.currentNoteLayouts = [];
      app.domNotes.heights.clear();
      redraw();
    },
    (id) => focus.focusById(id),
  );

  applyHudSettings(state.settings);
  applyGraphTheme(app.renderer, app.view, state.settings.theme);
  resize(app, state, redraw);
  focus.focusById();
  app.simulation.start("initial");
  if (import.meta.env.DEV && import.meta.env.VITE_DEBUG === "1") {
    import("../debug").then(({ mountDebug }) => mountDebug(app, state));
  }
  requestAnimationFrame(render);

  return { redraw };

  function render(): void {
    if (state.dirty) {
      app.renderer.render(app.threeScene, app.camera);
      state.dirty = false;
    }
    requestAnimationFrame(render);
  }

  function updateHudHistory(): void {
    if (state.focusedNode) hierarchyIds = hierarchyPath(app, state.focusedNode);
    renderHierarchyRail(
      app.hud.hierarchy,
      [...hierarchyIds].reverse().map((id) => ({
        id,
        title: app.nodeById.get(id)?.title ?? id,
      })),
      Boolean(state.focusedNode),
    );
  }
}
