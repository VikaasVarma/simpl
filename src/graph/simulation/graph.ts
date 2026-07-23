import { GraphTag, type GraphData } from "../graphTypes";
import { seedPositions } from "../../../generated/graph/seedPositions";
import type { SimLink, SimNode } from "./types";
import { jitter } from "../utils/random";

const FIXED_NODE_TAGS = new Set<`${GraphTag}`>([GraphTag.Me]);

export function createGraph(data: GraphData): {
  nodes: SimNode[];
  links: SimLink[];
} {
  const nodes = data.nodes.map((note, index) => {
    const saved = (seedPositions as Record<string, readonly number[]>)[note.id];
    const [x, y] =
      saved?.length === 2
        ? [saved[0], saved[1]]
        : [jitter(note.id, 28), jitter(`${note.id}:y`, 36)];
    return { ...note, index, x, y };
  });
  const links = data.links.map((link) => ({
    ...link,
    source: nodes[link.source],
    target: nodes[link.target],
  }));
  pinFixedNodes(nodes);
  return { nodes, links };
}

export function isFixedNode(node: Pick<SimNode, "tags">): boolean {
  return node.tags.some(({ tag }) => FIXED_NODE_TAGS.has(tag));
}

function pinFixedNodes(nodes: SimNode[]): void {
  nodes.filter(isFixedNode).forEach((node) => {
    node.fx = node.x;
    node.fy = node.y;
  });
}
