import { forceLink, forceManyBody, forceSimulation } from "d3-force-3d";
import { NOTE, SIMULATION } from "../constants";
import type { SimLink, SimNode } from "./types";

export const LINK_DISTANCE = NOTE.w * SIMULATION.linkCardWidths;
const CHARGE_DISTANCE_MAX = NOTE.w * SIMULATION.chargeDistanceMaxCardWidths;
const FALLBACK_X_SEED = 16807;
const FALLBACK_Y_SEED = 48271;

export function createForceSimulation(nodes: SimNode[], links: SimLink[]) {
  const link = forceLink<SimNode, SimLink>(links)
    .distance(LINK_DISTANCE)
    .strength(SIMULATION.linkK);

  const charge = forceManyBody<SimNode>()
    .strength(SIMULATION.charge)
    .distanceMax(CHARGE_DISTANCE_MAX);

  const simulation = forceSimulation(nodes, 2)
    .force("link", link)
    .force("charge", charge)
    .force("note-spacing", noteSpacingForce(nodes))
    .force("center", centerPullForce(nodes))
    .velocityDecay(SIMULATION.viscosity);

  return {
    simulation,
  };
}

function noteSpacingForce(nodes: SimNode[]): (alpha: number) => void {
  return (alpha: number) => {
    const width = NOTE.w * SIMULATION.noteSpacingWidthCardWidths;
    const height = NOTE.w * SIMULATION.noteSpacingHeightCardWidths;
    const k = SIMULATION.noteSpacingK * alpha;
    if (k <= 0) return;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const nx = dx / width;
        const ny = dy / height;
        const distance = Math.hypot(nx, ny);
        if (distance >= 1) continue;

        // Linear repulsion inside an ellipse
        const fallback = i * FALLBACK_X_SEED + j * FALLBACK_Y_SEED;
        const ux = distance > 1e-6 ? nx / distance : Math.cos(fallback);
        const uy = distance > 1e-6 ? ny / distance : Math.sin(fallback);
        const push = (1 - distance) * k;
        const px = ux * width * push;
        const py = uy * height * push;
        a.vx = (a.vx ?? 0) - px;
        a.vy = (a.vy ?? 0) - py;
        b.vx = (b.vx ?? 0) + px;
        b.vy = (b.vy ?? 0) + py;
      }
    }
  };
}

function centerPullForce(nodes: SimNode[]): (alpha: number) => void {
  return (alpha: number) => {
    let cx = 0;
    let cy = 0;
    for (const node of nodes) {
      cx += node.x;
      cy += node.y;
    }

    cx /= nodes.length || 1;
    cy /= nodes.length || 1;
    const k = SIMULATION.centerK * alpha;
    for (const node of nodes) {
      node.vx = (node.vx ?? 0) - cx * k;
      node.vy = (node.vy ?? 0) - cy * k;
    }
  };
}
