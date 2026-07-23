import fs from "node:fs";
import { graphData } from "../generated/graph/data";
import { SIMULATION } from "../src/graph/constants";
import {
  createForceSimulation,
  createGraph,
  settleSimulation,
} from "../src/graph/simulation";

const OUT = "generated/graph/seedPositions.json";
const seconds = Number(
  process.argv[2] ?? SIMULATION.runs.initial.durationMs / 1000,
);
const { nodes, links } = createGraph(graphData);

settleSimulation(
  createForceSimulation(nodes, links).simulation,
  seconds,
);

const seeds = Object.fromEntries(
  nodes
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => [node.id, [round(node.x), round(node.y)]]),
);

fs.mkdirSync("generated/graph", { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(seeds, null, 2)}\n`);
console.log(`Wrote ${OUT}: ${nodes.length} settled positions`);

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
