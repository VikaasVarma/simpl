import { SIMULATION } from "../constants";
import type { SimLink, SimNode } from "./types";
import { createForceSimulation } from "./physics";
import { runSimulation } from "./run";
import type { SimulationRun } from "./run";

export { createForceSimulation } from "./physics";
export { createGraph, isFixedNode } from "./graph";
export { runSimulation, settleSimulation } from "./run";
export type { SimLink, SimNode } from "./types";

export function createSimulation({
  nodes,
  links,
  onTick,
}: {
  nodes: SimNode[];
  links: SimLink[];
  onTick: () => void;
}) {
  const graph = createForceSimulation(nodes, links);
  const simulation = graph.simulation.alphaTarget(0);

  simulation.on("tick", () => {
    const extraTicks = Math.max(0, SIMULATION.simSpeed - 1);
    if (extraTicks) simulation.tick(extraTicks);
    onTick();
  });
  let cancelRun: (() => void) | null = null;

  const start = (
    name: keyof typeof SIMULATION.runs | SimulationRun = "normal",
  ): void => {
    const run = typeof name === "string" ? SIMULATION.runs[name] : name;
    cancelRun?.();
    cancelRun = runSimulation(simulation, run);
  };

  const release = (node: SimNode): void => {
    node.fx = null;
    node.fy = null;
    start("normal");
  };

  return { start, release };
}
