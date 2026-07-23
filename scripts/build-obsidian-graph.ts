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

const ROOT = process.cwd();
const VAULT = path.resolve(ROOT, vaultPath());
const OUT = path.join(ROOT, "generated/graph/data.ts");
const BODIES_OUT = path.join(ROOT, "generated/graph/bodies.ts");
const SEEDS = path.join(ROOT, "generated/graph/seedPositions.json");
const SEEDS_OUT = path.join(ROOT, "generated/graph/seedPositions.ts");
const PUBLISHED_ONLY = process.argv.includes("--published");

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

const { nodes, graphLinks } = buildGraph(notes, {
  publishedOnly: PUBLISHED_ONLY,
});
const emittedIds = new Set(nodes.map((node) => node.id));
emitGraphData({
  root: ROOT,
  outPath: OUT,
  bodiesPath: BODIES_OUT,
  bodies: Object.fromEntries(
    notes
      .filter((note) => emittedIds.has(note.id) && note.bodyHtml)
      .map((note) => [note.id, note.bodyHtml]),
  ),
  nodes,
  graphLinks,
});
emitSeedPositions();

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

function emitSeedPositions(): void {
  const seeds = fs.existsSync(SEEDS) ? JSON.parse(fs.readFileSync(SEEDS, "utf8")) : {};
  fs.writeFileSync(
    SEEDS_OUT,
    `export const seedPositions = ${JSON.stringify(seeds, null, 2)} as const;\n`,
  );
}
