import type { GraphLink, GraphNode } from "../graphTypes";

export type SimNode = GraphNode & {
  index: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

export type SimLink = Omit<GraphLink, "source" | "target"> & {
  source: SimNode;
  target: SimNode;
};
