import { fitCamera, focusCamera } from "../camera";
import type { FocusOptions, GraphSceneApp, SceneState } from "./types";
import type { SimNode } from "../simulation";

export function createFocusController(
  getApp: () => GraphSceneApp,
  state: SceneState,
  redraw: () => void,
) {
  const focusStack: string[] = [];

  const focusOn = (node: SimNode, options: FocusOptions = {}) => {
    const app = getApp();
    const { pushHistory = true, updateHash = true } = options;

    if (pushHistory && state.focusedNode && state.focusedNode.id !== node.id) {
      focusStack.push(state.focusedNode.id);
    }

    state.focusedNode = node;
    if (updateHash)
      history.replaceState(null, "", `#${encodeURIComponent(node.id)}`);

    state.cancelFocusAnimation?.();
    redraw();
    state.cancelFocusAnimation = focusCamera(
      app.camera,
      node,
      app.renderer.domElement,
      redraw,
      () => {
        state.focusedNode = node;
        state.cancelFocusAnimation = null;
        redraw();
      },
    );
  };

  const focusById = (
    id: string | null = null,
    options: FocusOptions = {},
  ): boolean => {
    const app = getApp();
    const focusOptions =
      id === null
        ? {
            pushHistory: false,
            updateHash: false,
            ...options,
          }
        : options;
    const requestedId =
      id ?? decodeURIComponent(location.hash.slice(1) || "me");
    const node =
      app.nodeById.get(requestedId.replace(/^#/, "")) ??
      (id === null ? app.nodes[0] : null);
    if (!node) return false;
    focusOn(node, focusOptions);
    return true;
  };

  const defocus = () => {
    const app = getApp();
    state.focusedNode = null;
    focusStack.length = 0;
    state.cancelFocusAnimation?.();
    state.cancelFocusAnimation = null;
    fitCameraToRoot(app);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    redraw();
  };

  const goBack = (): boolean => {
    while (focusStack.length > 0) {
      const id = focusStack.pop();
      if (!id || id === state.focusedNode?.id) continue;
      return focusById(id, { pushHistory: false });
    }
    if (state.focusedNode && state.focusedNode.id !== "me") {
      return focusById("me", { pushHistory: false });
    }
    return false;
  };

  const clearHistory = () => {
    focusStack.length = 0;
  };

  const previousId = (): string | null => {
    for (let i = focusStack.length - 1; i >= 0; i--) {
      const id = focusStack[i];
      if (id && id !== state.focusedNode?.id) return id;
    }
    return state.focusedNode && state.focusedNode.id !== "me" ? "me" : null;
  };

  return {
    focusOn,
    focusById,
    defocus,
    goBack,
    clearHistory,
    previousId,
  };
}

export function fitCameraToRoot(app: GraphSceneApp): void {
  const { width, height } = app.root.getBoundingClientRect();
  fitCamera(app.camera, app.nodes, width, height);
}
