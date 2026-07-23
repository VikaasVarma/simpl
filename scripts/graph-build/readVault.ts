import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { NoteDraft } from "./types";
import { GraphTag, type GraphNodeTag } from "../../src/graph/graphTypes";

export function readVault(vaultDir: string): NoteDraft[] {
  if (!fs.existsSync(vaultDir)) {
    throw new Error(`Vault directory does not exist: ${vaultDir}`);
  }
  return walk(vaultDir)
    .filter((file) => file.endsWith(".md"))
    .map(readNote);
}

export function indexNames(
  notes: readonly NoteDraft[],
): Map<string, NoteDraft> {
  const index = new Map<string, NoteDraft>();
  for (const note of notes) {
    addName(index, note.id, note);
    addName(index, note.title, note);
  }
  return index;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function readNote(file: string): NoteDraft {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  const basename = path.basename(file, ".md");
  const properties = parsed.data as Record<string, unknown>;

  if (typeof properties.id !== "string") {
    throw new Error(`Missing frontmatter id in ${file}`);
  }

  return {
    id: properties.id,
    file,
    title: basename,
    summary: typeof properties.summary === "string" ? properties.summary : "",
    date: readDate(properties.date, file),
    link: typeof properties.link === "string" ? properties.link : "",
    tags: readTags(properties.tags, file),
    rawBody: stripMarkdownComments(parsed.content),
    connections: [],
    body: [],
    bodyHtml: "",
    hasBody: false,
    searchText: "",
  };
}

function addName(
  index: Map<string, NoteDraft>,
  name: string,
  note: NoteDraft,
): void {
  const existing = index.get(name);
  if (existing && existing.id !== note.id) {
    throw new Error(
      `Duplicate note name ${JSON.stringify(name)} in ${existing.file} and ${note.file}`,
    );
  }
  index.set(name, note);
}

function stripMarkdownComments(value: string): string {
  return value.replace(/<!--[\s\S]*?-->/g, "");
}

function readDate(value: unknown, file: string): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }
  throw new Error(`Invalid date in ${file}`);
}

function readTags(value: unknown, file: string): GraphNodeTag[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid tags in ${file}`);

  return value.map((tag) => readTag(tag, file));
}

function readTag(value: unknown, file: string): GraphNodeTag {
  if (typeof value !== "string") throw new Error(`Invalid tag in ${file}`);

  if (value === GraphTag.Hidden) return { tag: GraphTag.Hidden, body: "" };
  if (value === GraphTag.Me) return { tag: GraphTag.Me, body: "" };
  if (value === GraphTag.Published)
    return { tag: GraphTag.Published, body: "" };

  const [tag, body, extra] = value.split("/");
  if (
    extra !== undefined ||
    (tag !== GraphTag.Region && tag !== GraphTag.RegionHeader) ||
    !body
  ) {
    throw new Error(`Unknown graph tag ${JSON.stringify(value)} in ${file}`);
  }

  return { tag, body };
}
