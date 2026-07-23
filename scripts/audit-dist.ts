import fs from "node:fs";
import path from "node:path";
import { graphBodies } from "../generated/graph/bodies";
import { graphData } from "../generated/graph/data";
import { GraphTag, type GraphData } from "../src/graph/graphTypes";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".xml",
]);

const failures: string[] = [];
const data = graphData as GraphData;
const nodeIds = new Set<string>(data.nodes.map((node) => node.id));
const bodyIds = Object.keys(graphBodies);

if (!fs.existsSync(DIST)) fail("dist/ does not exist.");
if (!fs.existsSync(path.join(DIST, "_headers")))
  fail("dist/_headers is missing.");
if (!data.nodes.length) fail("published graph has no notes.");

for (const node of data.nodes) {
  if (node.tags.some(({ tag }) => String(tag) === GraphTag.Hidden))
    fail(`hidden note emitted: ${node.id}`);
  if (node.hasBody && !bodyIds.includes(node.id))
    fail(`note is marked hasBody but body is missing: ${node.id}`);
  for (const group of node.connections) {
    for (const connection of group.connections) {
      if (!nodeIds.has(connection.target) && !connection.href)
        fail(
          `connection points outside published graph: ${node.id} -> ${connection.target}`,
        );
    }
  }
}

for (const id of bodyIds) {
  if (!nodeIds.has(id)) fail(`body emitted for unpublished note: ${id}`);
}

for (const link of data.links) {
  if (!data.nodes[link.source] || !data.nodes[link.target])
    fail(`invalid graph link indexes: ${link.id}`);
}

for (const file of fs.existsSync(DIST) ? walk(DIST) : []) {
  const rel = path.relative(DIST, file).replaceAll(path.sep, "/");
  if (/(^|\/)(vault|backups|node_modules|scripts|src)(\/|$)/.test(rel))
    fail(`forbidden directory emitted: ${rel}`);
  if (rel.endsWith(".md") || rel.endsWith(".map"))
    fail(`forbidden file emitted: ${rel}`);
  if (!TEXT_EXTENSIONS.has(path.extname(file))) continue;

  const text = fs.readFileSync(file, "utf8");
  if (
    /\/Users\/[^/]+\/|working-notes\/vault|vault\/papers|backups\//.test(text)
  )
    fail(`private local path leaked in ${rel}`);
  if (/sourceMappingURL=/.test(text)) fail(`source map reference in ${rel}`);
}

if (failures.length) {
  console.error("dist audit failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `dist audit passed: ${data.nodes.length} notes, ${bodyIds.length} bodies`,
);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function fail(message: string): void {
  failures.push(message);
}
