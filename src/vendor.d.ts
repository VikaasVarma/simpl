declare module "d3-force-3d" {
  export type ForceNodeDatum = {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  };

  type Force<TNode> = {
    (alpha: number): void;
    initialize?: (
      nodes: TNode[],
      random?: () => number,
      dimensions?: number,
    ) => void;
  };

  type ForceSimulation<TNode> = {
    alpha(value: number): ForceSimulation<TNode>;
    alphaTarget(value: number): ForceSimulation<TNode>;
    force(name: string, force: Force<TNode>): ForceSimulation<TNode>;
    on(
      type: "tick" | "end",
      callback: (() => void) | null,
    ): ForceSimulation<TNode>;
    restart(): ForceSimulation<TNode>;
    stop(): ForceSimulation<TNode>;
    tick(iterations?: number): ForceSimulation<TNode>;
    velocityDecay(value: number): ForceSimulation<TNode>;
  };

  type LinkForce<TNode, TLink> = Force<TNode> & {
    id(value: (node: TNode) => string): LinkForce<TNode, TLink>;
    distance(
      value: number | ((link: TLink) => number),
    ): LinkForce<TNode, TLink>;
    strength(
      value: number | ((link: TLink) => number),
    ): LinkForce<TNode, TLink>;
  };

  type ManyBodyForce<TNode> = Force<TNode> & {
    strength(value: number | ((node: TNode) => number)): ManyBodyForce<TNode>;
    distanceMax(value: number): ManyBodyForce<TNode>;
  };

  export function forceSimulation<TNode extends ForceNodeDatum>(
    nodes: TNode[],
    dimensions?: number,
  ): ForceSimulation<TNode>;
  export function forceLink<TNode, TLink>(
    links: TLink[],
  ): LinkForce<TNode, TLink>;
  export function forceManyBody<TNode>(): ManyBodyForce<TNode>;
}
