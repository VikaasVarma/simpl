import fs from "node:fs";
import path from "node:path";
import { buildGraph } from "./graph-build/buildGraph";
import { emitGraphData } from "./graph-build/emitData";
import { parseNoteBody } from "./graph-build/parseConnections";
import { indexNames, readVault } from "./graph-build/readVault";
import {
  bodySearchText,
  renderMarkdownBody,
  renderNoteBody,
} from "./graph-build/renderHtml";
import type { NoteDraft } from "./graph-build/types";

const ROOT = process.cwd();
const VAULT = path.resolve(ROOT, vaultPath());
const OUT = path.join(ROOT, "generated/graph/data.ts");
const SEEDS = path.join(ROOT, "generated/graph/seedPositions.json");
const SEEDS_OUT = path.join(ROOT, "generated/graph/seedPositions.ts");
const PUBLISHED_ONLY = process.argv.includes("--published");
const EMIT_ALL = process.argv.includes("--all");

const notes = readVault(VAULT);
const nameIndex = indexNames(notes);

for (const note of notes) {
  const parsed = parseNoteBody(note, nameIndex);
  note.connections = parsed.connections;
  note.body = parsed.body;
  note.bodyHtml = renderNoteBody(note);
  note.hasBody = note.bodyHtml.length > 0;
  note.searchText = bodySearchText(note.body);
  note.connections = note.connections.map((group) => ({
    ...group,
    connections: group.connections.map((connection) => ({
      ...connection,
      labelHtml: connection.label ? renderMarkdownBody(connection.label) : "",
    })),
  }));
}

if (EMIT_ALL) {
  emitGraph("unofficial", false);
  emitGraph("published", true);
}
emitGraph("", PUBLISHED_ONLY);
emitSeedPositions(SEEDS_OUT);

function vaultPath(): string {
  const arg = process.argv.find((item) => item.startsWith("--vault="));
  if (arg) return arg.slice("--vault=".length);

  const index = process.argv.indexOf("--vault");
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error("Missing value after --vault.");
    }
    return value;
  }

  return process.env.NOTES_VAULT || "fixtures/vault";
}

function emitGraph(name: string, publishedOnly: boolean): void {
  const { nodes, graphLinks } = buildGraph(notes, { publishedOnly });
  const emittedIds = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const dir = name
    ? path.join(ROOT, "generated/graph", name)
    : path.dirname(OUT);
  emitGraphData({
    root: ROOT,
    outPath: path.join(dir, "data.ts"),
    bodiesPath: path.join(dir, "bodies.ts"),
    bodies: Object.fromEntries(
      notes
        .filter((note) => emittedIds.has(note.id) && note.bodyHtml)
        .map((note) => [
          note.id,
          renderNoteBody({
            ...note,
            connections: bodyConnections(
              note,
              nodeById.get(note.id)?.connections ?? [],
            ),
          }),
        ]),
    ),
    nodes,
    graphLinks,
  });
  if (name) emitSeedPositions(path.join(dir, "seedPositions.ts"));
}

function bodyConnections(
  note: NoteDraft,
  visible: NoteDraft["connections"],
): NoteDraft["connections"] {
  const visibleIds = new Set(visible.map((group) => group.id));
  return [
    ...visible,
    ...note.connections.filter(
      (group) =>
        !visibleIds.has(group.id) &&
        group.connections.some(
          (connection) => connection.icon && connection.href,
        ),
    ),
  ];
}

function emitSeedPositions(outPath: string): void {
  const seeds = fs.existsSync(SEEDS)
    ? JSON.parse(fs.readFileSync(SEEDS, "utf8"))
    : {};
  fs.writeFileSync(
    outPath,
    `export const seedPositions = ${JSON.stringify(seeds, null, 2)} as const;\n`,
  );
}
