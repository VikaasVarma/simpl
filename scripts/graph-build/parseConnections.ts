import type {
  GraphBodyPart,
  GraphConnectionGroup,
} from "../../src/graph/graphTypes";
import { PALETTE_SIZE, shuffledColors } from "./colors";
import type { NoteDraft } from "./types";

// One captured alternation for split(), matching:
// 1. fenced code/viz blocks: ```info\n...```
// 2. display math blocks: $$...$$
// 3. display math blocks: \[...\]
// 4. inline math spans: \(...\)
// 5. inline math spans: $...$
// 6. wikilinks: [[target]], optional |display text, optional %%directives%%
const TOKEN_RE =
  /(```[^\n]*\n?[\s\S]*?```|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([^\n]+?\\\)|\$[^$\n]+\$|\[\[[^\]|]+(?:\|[^\]]*)?\]\](?:%%[^%]*%%)*)/g;

// Whole-token wikilink grammar: [[target]], optional |display text, optional
// trailing %%directive%%.
const WIKILINK_RE = /^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]((?:%%[^%]*%%)*)$/;

type WikilinkPart = {
  type: "wikilink";
  target: string;
  title: string;
  label: string;
  labelHtml: string;
  href: string;
  icon?: string;
  suppressLine: boolean;
};
type ParsedPart = GraphBodyPart | WikilinkPart;
type CollapsedPart = GraphBodyPart | WikilinkPart[];

export function parseNoteBody(
  note: NoteDraft,
  nameIndex: Map<string, NoteDraft>,
): { connections: GraphConnectionGroup[]; body: GraphBodyPart[] } {
  try {
    const colors = shuffledColors(note.id);
    let connectionsUsed = 0;
    const nextColor = () => colors[connectionsUsed++ % PALETTE_SIZE];
    let groupIndex = 0;

    const sections = note.rawBody
      .split(TOKEN_RE)
      .map((token) => parseToken(token, note, nameIndex))
      .filter((part) => part.type !== "text" || part.text !== "");

    const connections: GraphConnectionGroup[] = [];

    const body = sections
      .reduce<CollapsedPart[]>(collapsePart, [])
      .map((part) =>
        bodyPart(
          part,
          note,
          connections,
          () => `${note.id}:${groupIndex++}`,
          nextColor,
        ),
      );

    return { connections, body };
  } catch (error) {
    if (!(error instanceof Error) || error.message.includes(note.file)) {
      throw error;
    }
    throw new Error(`${error.message} in ${note.file}`);
  }
}

function collapsePart(acc: CollapsedPart[], part: ParsedPart): CollapsedPart[] {
  const last = acc.at(-1);
  if (part.type === "wikilink" && Array.isArray(last)) last.push(part);
  else if (part.type === "wikilink") acc.push([part]);
  else acc.push(part);
  return acc;
}

function bodyPart(
  part: CollapsedPart,
  note: NoteDraft,
  connections: GraphConnectionGroup[],
  nextGroupId: () => string,
  nextColor: () => number,
): GraphBodyPart {
  if (Array.isArray(part)) {
    return wikilinkGroupPart(part, note, connections, nextGroupId, nextColor);
  }
  return part;
}

function parseToken(
  token: string,
  note: NoteDraft,
  nameIndex: Map<string, NoteDraft>,
): ParsedPart {
  switch (true) {
    case token.startsWith("```"):
      return parseCodeOrViz(token);
    case token.startsWith("[["):
      return parseConnection(token, note, nameIndex);
    case token.startsWith("$$"):
      return { type: "math", tex: token.slice(2, -2).trim(), display: true };
    case token.startsWith("\\["):
      return { type: "math", tex: token.slice(2, -2).trim(), display: true };
    case token.startsWith("\\("):
      return { type: "math", tex: token.slice(2, -2).trim(), display: false };
    case token.startsWith("$"):
      return { type: "math", tex: token.slice(1, -1).trim(), display: false };
    default:
      return { type: "text", text: token.replace(/%%[^%]*%%/g, "") };
  }
}

function parseCodeOrViz(token: string): GraphBodyPart {
  const [, info = "", text = ""] = /^```([^\n]*)\n?([\s\S]*?)```$/.exec(token)!;
  const [kind, ...rest] = info.trim().split(/\s+/);
  return kind === "viz"
    ? { type: "viz", name: rest.join(" "), text: text.trim() }
    : {
        type: "code",
        language: kind,
        inline: rest.includes("--inline"),
        text: text.trim(),
      };
}

function wikilinkGroupPart(
  group: WikilinkPart[],
  note: NoteDraft,
  groups: GraphConnectionGroup[],
  nextGroupId: () => string,
  nextColor: () => number,
): GraphBodyPart {
  const text = group[0].title;
  const selfLink = group.find((connection) => connection.target === note.id);
  if (selfLink)
    throw new Error(`Self-link [[${selfLink.title}]] in ${note.file}`);

  const connections = group.map(({ type: _type, ...connection }) => ({
    ...connection,
    colorIndex: nextColor(),
  }));

  const groupId = nextGroupId();
  groups.push({ id: groupId, text, connections });
  return { type: "connection", groupId, text };
}

function parseConnection(
  token: string,
  note: NoteDraft,
  nameIndex: Map<string, NoteDraft>,
): WikilinkPart {
  const match = WIKILINK_RE.exec(token);
  if (!match) throw new Error(`Invalid wikilink token ${token}`);
  const name = match[1].trim();
  const alias = match[2]?.trim();
  const target = nameIndex.get(name);
  if (!target) throw new Error(`Unresolved wikilink [[${name}]]`);
  const directives = parseDirectives(match[3] ?? "", note);
  return {
    type: "wikilink",
    target: target.id,
    title: alias || target.title,
    label: directives.label,
    labelHtml: "",
    href: target.link,
    icon: directives.icon,
    suppressLine: directives.ref,
  };
}

function parseDirectives(
  raw: string,
  note: NoteDraft,
): {
  label: string;
  icon?: string;
  ref: boolean;
} {
  let label = "";
  let icon: string | undefined;
  let ref = false;

  for (const match of raw.matchAll(/%%([^%]*)%%/g)) {
    const value = match[1].trim();
    if (!value) continue;
    if (value === "ref") ref = true;
    else if (value.startsWith("icon:"))
      icon = value.slice("icon:".length).trim();
    else if (!label) label = value;
    else throw new Error(`Multiple popup labels on wikilink in ${note.file}`);
  }

  return { label, icon, ref };
}
