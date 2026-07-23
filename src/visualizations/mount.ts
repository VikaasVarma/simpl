import { visualizationLoaders, type VisualizationLoader } from "./index";
import type { VisualizationFactory, VisualizationHandle } from "./types";

type MountState = {
  active: boolean;
  intersecting: boolean;
  loader: VisualizationLoader;
  canvas: HTMLCanvasElement;
  factory?: VisualizationFactory;
  handle?: VisualizationHandle;
  loading?: Promise<void>;
  running: boolean;
  observer?: IntersectionObserver;
};

const states = new WeakMap<HTMLElement, MountState>();

export function mountVisualizations(root: ParentNode, active: boolean): void {
  root
    .querySelectorAll<HTMLElement>(".viz-mount")
    .forEach((mount) => setupMount(mount, active));
}

export function setVisualizationsActive(
  root: ParentNode,
  active: boolean,
): void {
  root.querySelectorAll<HTMLElement>(".viz-mount").forEach((mount) => {
    const state = states.get(mount);
    if (!state) return;
    state.active = active;
    updatePlayback(mount, state);
  });
}

export function disposeVisualizations(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>(".viz-mount").forEach((mount) => {
    const state = states.get(mount);
    if (!state) return;
    state.observer?.disconnect();
    state.handle?.dispose();
    states.delete(mount);
  });
}

function setupMount(mount: HTMLElement, active: boolean): void {
  const existing = states.get(mount);
  if (existing) {
    existing.active = active;
    updatePlayback(mount, existing);
    return;
  }

  const slug = mount.dataset.viz;
  const loader = slug ? visualizationLoaders[slug] : undefined;
  if (!loader) {
    mount.classList.add("viz-mount--missing");
    mount.textContent = slug ? `(unknown viz: ${slug})` : "(missing viz)";
    return;
  }

  mount.textContent = "";
  const canvas = document.createElement("canvas");
  mount.append(canvas);
  const state: MountState = {
    active,
    intersecting: typeof IntersectionObserver === "undefined",
    loader,
    canvas,
    running: false,
  };
  states.set(mount, state);

  if (typeof IntersectionObserver !== "undefined") {
    state.observer = new IntersectionObserver(
      ([entry]) => {
        state.intersecting = entry?.isIntersecting === true;
        updatePlayback(mount, state);
      },
      { rootMargin: "120px", threshold: 0 },
    );
    state.observer.observe(mount);
  }

  updatePlayback(mount, state);
}

function updatePlayback(mount: HTMLElement, state: MountState): void {
  const shouldRun = state.active && state.intersecting;
  if (!shouldRun) {
    if (state.running) {
      state.running = false;
      state.handle?.pause?.();
    }
    return;
  }

  if (!state.factory) {
    state.loading ??= state.loader().then(
      (factory) => {
        state.factory = factory;
        updatePlayback(mount, state);
      },
      (error) => {
        console.warn("viz: loader threw", error);
        mount.classList.add("viz-mount--errored");
      },
    );
    return;
  }

  if (!state.handle) {
    state.handle = state.factory(state.canvas, mount);
  }
  if (!state.running) {
    state.running = true;
    state.handle.resume?.();
  }
}
