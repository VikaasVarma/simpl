import type { VisualizationFactory } from "./types";

export type VisualizationLoader = () => Promise<VisualizationFactory>;

export const visualizationLoaders: Record<string, VisualizationLoader> = {
  "attention-mask-pair": () =>
    import("./attentionMask").then((module) => module.createAttentionMask),
  "causal-attention-mask": () =>
    import("./attentionMask").then((module) => module.createAttentionMask),
  "windowed-attention-mask": () =>
    import("./attentionMask").then((module) => module.createAttentionMask),
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
  "mha-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createMhaOperation,
    ),
  "mqa-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createMqaOperation,
    ),
  "gqa-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createGqaOperation,
    ),
};
