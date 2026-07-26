import { fitCamera, focusCamera } from "../camera";
import { GraphTag } from "../graphTypes";
import type { FocusOptions, GraphSceneApp, SceneState } from "./types";
import type { SimNode } from "../simulation";

export function createFocusController(
  getApp: () => GraphSceneApp,
  state: SceneState,
  redraw: () => void,
) {
  const focusOn = (node: SimNode, options: FocusOptions = {}) => {
    const app = getApp();
    const { updateHash = true } = options;

    state.focusedNode = node;
    if (updateHash) {
      const url = `#${encodeURIComponent(node.id)}`;
      if (location.hash === url) history.replaceState(null, "", url);
      else history.pushState(null, "", url);
    }

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
            updateHash: false,
            ...options,
          }
        : options;
    const hashId = decodeURIComponent(location.hash.slice(1));
    const requestedId = (id ?? hashId) || defaultFocusId() || "";
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
    state.cancelFocusAnimation?.();
    state.cancelFocusAnimation = null;
    fitCameraToRoot(app);
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    redraw();
  };

  const defaultFocusId = (): string | null => {
    const app = getApp();
    return (
      app.nodes.find((node) =>
        node.tags.some(({ tag }) => tag === GraphTag.Root),
      )?.id ??
      app.nodes[0]?.id ??
      null
    );
  };

  return {
    focusOn,
    focusById,
    defocus,
  };
}

export function fitCameraToRoot(app: GraphSceneApp): void {
  const { width, height } = app.root.getBoundingClientRect();
  fitCamera(app.camera, app.nodes, width, height);
}
