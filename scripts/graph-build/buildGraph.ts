import {
  GraphTag,
  type GraphLink,
  type GraphNode,
} from "../../src/graph/graphTypes";
import type { NoteDraft } from "./types";

type BuildGraphOptions = {
  publishedOnly?: boolean;
};

export function buildGraph(
  notes: readonly NoteDraft[],
  options: BuildGraphOptions = {},
): {
  nodes: GraphNode[];
  graphLinks: GraphLink[];
} {
  const noteIds = new Set(notes.map((note) => note.id));
  const visibleNotes = notes.filter(
    (note) =>
      !hasTag(note, GraphTag.Hidden) &&
      (!options.publishedOnly || hasTag(note, GraphTag.Published)),
  );
  const byId = new Map(visibleNotes.map((note, index) => [note.id, index]));
  const nodes: GraphNode[] = visibleNotes.map(
    ({
      file: _file,
      rawBody: _rawBody,
      body: _body,
      bodyHtml: _bodyHtml,
      ...note
    }) => ({
      ...note,
      connections: note.connections
        .map((group) => ({
          ...group,
          connections: group.connections.filter((connection) =>
            byId.has(connection.target),
          ),
        }))
        .filter((group) => group.connections.length > 0),
    }),
  );

  const seen = new Set<string>();
  const graphLinks: GraphLink[] = [];

  for (const note of visibleNotes) {
    for (const group of note.connections) {
      for (const connection of group.connections) {
        if (connection.suppressLine) continue;
        if (!byId.has(connection.target)) {
          if (noteIds.has(connection.target)) continue;
          throw new Error(
            `Missing node for link ${note.id} -> ${connection.target}`,
          );
        }

        const key = `${note.id}->${connection.target}`;
        if (seen.has(key)) continue;

        seen.add(key);
        graphLinks.push({
          id: key,
          source: byId.get(note.id)!,
          target: byId.get(connection.target)!,
          colorIndex: connection.colorIndex,
        });
      }
    }
  }

  return { nodes, graphLinks };
}

function hasTag(note: NoteDraft, tag: GraphTag): boolean {
  return note.tags.some((item) => item.tag === tag);
}
