import { followNode } from "../camera";
import { applyGraphTheme } from "../rendering";
import { createSimulation } from "../simulation";
import { bindFlowLabels } from "../../components/flowLabels";
import { applyHudSettings, bindHud } from "../../components/hud";
import { createSceneBase } from "./setup";
import { redrawScene } from "./draw";
import { createFocusController } from "./focus";
import { bindSceneInput, resize } from "./input";
import { bindDomNoteScroll } from "../rendering/dom/notes";
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
    settings: loadSettings(),
    drawnHtmlNotes: 0,
  };

  const base = await createSceneBase();
  let app: GraphSceneApp;
  let focus: ReturnType<typeof createFocusController>;

  const redraw = () => {
    updateBackButton();
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
  bindFlowLabels(app.flowLabels, {
    focusById: (id) => focus.focusById(id),
    setHoveredFlowId: (id) => setHoveredFlow(state, id, redraw),
  });

  bindSceneInput(app, state, {
    redraw,
    focusOn: focus.focusOn,
    focusById: focus.focusById,
    defocus: focus.defocus,
    goBack: focus.goBack,
    clearHistory: focus.clearHistory,
  });
  bindHud(
    app.hud,
    app.nodes,
    state.settings,
    () => focus.goBack(),
    (id) => focus.focusById(id),
    () => {
      saveSettings(state.settings);
      applyHudSettings(state.settings);
      applyGraphTheme(app.renderer, app.view, state.settings.theme);
      state.currentNoteLayouts = [];
      app.domNotes.heights.clear();
      redraw();
    },
  );

  resize(app, state, redraw);
  applyHudSettings(state.settings);
  applyGraphTheme(app.renderer, app.view, state.settings.theme);
  focus.focusById();
  app.simulation.start("initial");
  if (import.meta.env.VITE_DEBUG === "1") {
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

  function updateBackButton(): void {
    const id = focus.previousId();
    const title = id ? (app.nodeById.get(id)?.title ?? "") : "";
    app.hud.home.textContent = title ? `← ${title}` : "home";
    app.hud.home.hidden = !title;
  }
}

function setHoveredFlow(
  state: SceneState,
  id: string | null,
  redraw: () => void,
): void {
  if (id ? state.hoveredFlowIds.has(id) : state.hoveredFlowIds.size === 0)
    return;
  state.hoveredFlowIds = id ? new Set([id]) : new Set();
  redraw();
}
