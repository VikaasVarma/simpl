import type { VisualizationFactory } from "./types";

export type VisualizationLoader = () => Promise<VisualizationFactory>;

export const visualizationLoaders: Record<string, VisualizationLoader> = {
  "longlive-attention-mask": () =>
    import("./attentionMask").then((module) => module.createAttentionMask),
  "flow-matching": () =>
    import("./flowMatching").then((module) => module.createFlowMatching),
  "spinning-cube": () =>
    import("./spinningCube").then((module) => module.createSpinningCube),
  "transformer-block": () =>
    import("../lib/visualizations/transformer-block").then(
      (module) => module.createTransformerBlock,
    ),
};
