import { GraphTag } from "../graphTypes";
import type { SimNode } from "../simulation";
import type { GraphSceneApp, SceneState } from "./types";

export function hierarchyPath(
  app: GraphSceneApp,
  node: SimNode | null,
): string[] {
  const root =
    app.nodes.find((item) =>
      item.tags.some(({ tag }) => tag === GraphTag.Root),
    ) ?? app.nodes[0];
  const target = node ?? root;
  if (!root || !target) return [];
  if (root.id === target.id) return [root.id];

  const children = new Map<string, string[]>();
  for (const link of app.links) {
    const list = children.get(link.source.id) ?? [];
    list.push(link.target.id);
    children.set(link.source.id, list);
  }

  const queue = [root.id];
  const parent = new Map<string, string | null>([[root.id, null]]);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    if (id === target.id) break;
    for (const child of children.get(id) ?? []) {
      if (parent.has(child)) continue;
      parent.set(child, id);
      queue.push(child);
    }
  }

  if (!parent.has(target.id)) return [root.id, target.id];
  const path: string[] = [];
  for (let id: string | null = target.id; id; id = parent.get(id) ?? null) {
    path.push(id);
  }
  return path.reverse();
}

export function focusParent(
  app: GraphSceneApp,
  state: SceneState,
  focusById: (id?: string | null) => boolean,
): boolean {
  if (!state.focusedNode) return false;
  const path = hierarchyPath(app, state.focusedNode);
  if (path.length < 2) return false;
  return focusById(path[path.length - 2]);
}
