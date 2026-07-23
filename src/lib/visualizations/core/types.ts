/**
 * Shape every visualization conforms to.
 *
 *   create(canvas, opts) → { dispose(), pause?(), resume?() }
 *
 * - `canvas` is sized to its mount container. Resize is handled by
 *   core/renderer.ts's onMountResize; the visualization gets a
 *   callback if it needs to re-aim the camera or rebuild geometry.
 * - `pause` / `resume` should stop and restart animation work without
 *   releasing GPU resources. Canvas zoom uses these so LoD changes do
 *   not repeatedly tear down and recreate WebGL scenes.
 * - `dispose` must release all GPU resources (geometries, materials,
 *   textures, renderer) and unhook listeners. It is reserved for final
 *   page teardown, not routine canvas zoom changes.
 *
 * Visualizations should be deterministic (use a seeded RNG, not
 * Math.random) so the rendered frame is reproducible across runs.
 */

export type VisualizationHandle = {
  pause?: () => void;
  resume?: () => void;
  dispose: () => void;
};

export type VisualizationFactory = (
  canvas: HTMLCanvasElement,
  mount: HTMLElement,
) => VisualizationHandle;
