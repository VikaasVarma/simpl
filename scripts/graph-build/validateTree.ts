import {
  GraphTag,
  type GraphLink,
  type GraphNode,
} from "../../src/graph/graphTypes";

export function validateTree(
  nodes: readonly GraphNode[],
  links: readonly GraphLink[],
  name: string,
): void {
  if (!nodes.length) return;

  const label = `Graph tree check failed for ${name}`;
  const roots = nodes.filter((node) =>
    node.tags.some((item) => item.tag === GraphTag.Root),
  );
  if (roots.length !== 1) {
    throw new Error(
      `${label}: expected exactly one root note, found ${roots.length}.\n${roots.map(title).join("\n")}`,
    );
  }

  const children = new Map<number, number[]>();
  for (const link of links) {
    children.set(link.source, [
      ...(children.get(link.source) ?? []),
      link.target,
    ]);
  }

  const seen = new Map<number, string>();
  visit(nodes.indexOf(roots[0]), title(roots[0]));

  if (seen.size !== nodes.length) {
    const missing = nodes
      .filter((_, index) => !seen.has(index))
      .map((node) => `  - ${title(node)}`)
      .join("\n");
    throw new Error(`${label}: graph is disconnected.\n${missing}`);
  }

  function visit(index: number, path: string): void {
    const firstPath = seen.get(index);
    if (firstPath) {
      throw new Error(
        `${label}: ${title(nodes[index])} is reachable through multiple non-ref paths.\n\n${firstPath}\n${path}`,
      );
    }

    seen.set(index, path);
    for (const child of children.get(index) ?? []) {
      visit(child, `${path} -> ${title(nodes[child])}`);
    }
  }
}

function title(node: GraphNode): string {
  return `${node.title} (${node.id})`;
}
