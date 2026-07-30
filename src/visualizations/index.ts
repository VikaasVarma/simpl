import type { VisualizationFactory } from "./types";

export type VisualizationLoader = () => Promise<VisualizationFactory>;

export const visualizationLoaders: Record<string, VisualizationLoader> = {
  "attention-mask-pair": () =>
    import("./attentionMask").then((module) => module.createAttentionMask),
  "attention-operation": () =>
    import("./attentionOperation").then(
      (module) => module.createAttentionOperation,
    ),
  "kv-cache-operation": () =>
    import("./kvCacheOperation").then(
      (module) => module.createKvCacheOperation,
    ),
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
  "norm-order": () =>
    import("../lib/visualizations/norm-order").then(
      (module) => module.createNormOrder,
    ),
  "mha-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createMhaOperation,
    ),
  "mlp-operation": () =>
    import("../lib/visualizations/mlp-operation").then(
      (module) => module.createMlpOperation,
    ),
  "gated-mlp-operation": () =>
    import("../lib/visualizations/gated-mlp-operation").then(
      (module) => module.createGatedMlpOperation,
    ),
  "embedding-operation": () =>
    import("../lib/visualizations/embedding-operation").then(
      (module) => module.createEmbeddingOperation,
    ),
  "qk-norm-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createQkNormOperation,
    ),
  "mqa-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createMqaOperation,
    ),
  "gqa-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createGqaOperation,
    ),
  "mla-operation": () =>
    import("../lib/visualizations/mha-operation").then(
      (module) => module.createMlaOperation,
    ),
};
