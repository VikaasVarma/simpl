import katex from "katex";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import {
  transformerNotationDiff,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import python from "@shikijs/langs/python";
import diff from "@shikijs/langs/diff";
import githubLight from "@shikijs/themes/github-light";
import { createHighlighterCoreSync } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { GraphBodyPart } from "../../src/graph/graphTypes";
import type { NoteDraft } from "./types";

type ConnectionPart = Extract<GraphBodyPart, { type: "connection" }>;
type MathPart = Extract<GraphBodyPart, { type: "math" }>;
type VizPart = Extract<GraphBodyPart, { type: "viz" }>;
type RenderToken =
  | { type: "connection"; part: ConnectionPart; note: NoteDraft }
  | { type: "math"; part: MathPart }
  | { type: "code"; text: string; language?: string }
  | { type: "viz"; part: VizPart };

const TOKEN_RE = /\uE000(\d+)\uE001/g;
const CODE_DIRECTIVE_RE = /\s*#\s*\[!code [^\]]+\]\s*$/g;
const REMOVED_CODE_RE = /\[!code --(?::\d+)?\]/;
const markdown = new MarkdownIt({ html: true, linkify: false }).use(footnote);
const shiki = createHighlighterCoreSync({
  themes: [githubLight],
  langs: [python, diff],
  engine: createJavaScriptRegexEngine(),
});
const defaultLinkOpen =
  markdown.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const href = token.attrGet("href") ?? "";
  if (/^([a-z]+:)?\/\//i.test(href)) {
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, index, options, env, self);
};
markdown.renderer.rules.table_open = () =>
  '<div class="table-wrap" data-wheel-x><table>';
markdown.renderer.rules.table_close = () => "</table></div>";

export function renderNoteBody(note: NoteDraft): string {
  const tokens: RenderToken[] = [];
  const source = note.body
    .map((part) => {
      if (part.type === "text") return part.text;
      if (part.type === "connection")
        return token(tokens, { type: "connection", part, note });
      if (part.type === "math")
        return part.display
          ? blockToken(tokens, { type: "math", part })
          : token(tokens, { type: "math", part });
      if (part.type === "code")
        return blockToken(tokens, {
          type: "code",
          text: part.text,
          language: part.language,
        });
      return blockToken(tokens, { type: "viz", part });
    })
    .join("");
  return renderMarkdown(source, tokens);
}

export function renderMarkdownBody(value: string): string {
  const tokens: RenderToken[] = [];
  return renderMarkdown(tokenizeMath(value, tokens), tokens);
}

export function bodySearchText(parts: readonly GraphBodyPart[]): string {
  return parts
    .map((part) => {
      if (part.type === "text" || part.type === "code") return part.text;
      if (part.type === "connection") return part.text;
      if (part.type === "math") return part.tex;
      return `${part.name} ${part.text}`;
    })
    .join(" ");
}

function renderMarkdown(value: string, tokens: readonly RenderToken[]): string {
  const text = value.trim();
  if (!text) return "";
  return restoreTokens(markdown.render(text), tokens);
}

function renderMarkdownInline(value: string): string {
  const tokens: RenderToken[] = [];
  return restoreTokens(
    markdown.renderInline(tokenizeMath(value, tokens)),
    tokens,
  );
}

function tokenizeMath(value: string, tokens: RenderToken[]): string {
  return value
    .replace(/\$\$([\s\S]+?)\$\$/g, (_match, tex: string) =>
      token(tokens, {
        type: "math",
        part: { type: "math", tex, display: true },
      }),
    )
    .replace(
      /(^|[^\\])\$([^$\n]+?)\$/g,
      (_match, before: string, tex: string) =>
        `${before}${token(tokens, { type: "math", part: { type: "math", tex, display: false } })}`,
    );
}

function restoreTokens(value: string, tokens: readonly RenderToken[]): string {
  return value
    .replace(/<p>(\uE000(\d+)\uE001)<\/p>/g, (match, _token, index) => {
      const item = tokens[Number(index)];
      return item?.type !== "connection" ? renderToken(item) : match;
    })
    .replace(TOKEN_RE, (_match, index) => renderToken(tokens[Number(index)]));
}

function renderToken(item: RenderToken | undefined): string {
  if (!item) throw new Error("Missing body render token.");
  if (item.type === "math") return renderMath(item.part.tex, item.part.display);
  if (item.type === "code") return codeBlock(item.text, item.language);
  if (item.type === "viz") return vizBlock(item.part);
  return connection(item.part, item.note);
}

function connection(part: ConnectionPart, note: NoteDraft): string {
  const group = note.connections.find((item) => item.id === part.groupId);
  if (!group) return renderMarkdownInline(part.text);
  const primary = group.connections[0]!;
  const icon = primary.icon;
  const colorIndex = primary.colorIndex;
  const count = group.connections.length;
  const colors = group.connections
    .map(
      (connection, index) =>
        `--c${index}: var(--connection-${connection.colorIndex})`,
    )
    .join("; ");
  if (icon && primary.href)
    return `<a href="${escapeAttr(primary.href)}" class="social-link" aria-label="${escapeAttr(part.text)}" title="${escapeAttr(part.text)}"${externalAttrs(primary.href)}>${iconImage(icon)}</a>`;
  const content = icon
    ? iconImage(icon, part.text)
    : renderMarkdownInline(part.text);
  return `<mark class="graph-highlight${count > 1 ? " graph-highlight--multi" : ""}" data-source-id="${escapeAttr(note.id)}" data-group-id="${escapeAttr(group.id)}" data-color="${colorIndex}"${count > 1 ? ` data-conn-count="${count}" style="${escapeAttr(colors)}"` : ""}>${content}</mark>`;
}

function iconImage(src: string, label = ""): string {
  const attrs = label
    ? ` aria-label="${escapeAttr(label)}" title="${escapeAttr(label)}"`
    : "";
  return `<span class="social-link__icon"${attrs} style="--social-icon: url('${escapeAttr(src)}')"></span>`;
}

function externalAttrs(href: string): string {
  return /^([a-z]+:)?\/\//i.test(href)
    ? ' target="_blank" rel="noopener noreferrer"'
    : "";
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return escapeHtml(displayMode ? `$$${tex}$$` : `$${tex}$`);
  }
}

function token(tokens: RenderToken[], item: RenderToken): string {
  return `\uE000${tokens.push(item) - 1}\uE001`;
}

function blockToken(tokens: RenderToken[], item: RenderToken): string {
  return `\n\n${token(tokens, item)}\n\n`;
}

function codeBlock(value: string, language = ""): string {
  const clean = cleanCode(value);
  const hasDiff = clean !== value.trimEnd();
  const views = [
    codeView("code", shikiCode(clean, language, false)),
    hasDiff ? codeView("diff", shikiCode(value, language, true)) : "",
  ].join("");
  return `<div class="code-block-wrap" data-code-mode="code">${codeToolbar(hasDiff)}<div class="code-block-surface">${views}</div><textarea hidden data-code-copy-text>${escapeHtml(clean)}</textarea></div>`;
}

function codeToolbar(hasDiff: boolean): string {
  const toggle = hasDiff
    ? '<button class="code-mode-btn" type="button" data-code-mode-toggle>code</button>'
    : "";
  return `<div class="code-block-toolbar">${toggle}<button class="code-copy-btn" type="button">copy</button></div>`;
}

function codeView(mode: "code" | "diff", html: string): string {
  return `<div class="code-block-view" data-code-view="${mode}">${html}</div>`;
}

function shikiCode(value: string, language: string, diff: boolean): string {
  const lang = language === "py" ? "python" : language || "python";
  if (lang !== "python" && lang !== "diff") return escapedCode(value, language);
  return shiki
    .codeToHtml(value, {
      lang,
      theme: "github-light",
      transformers: diff
        ? [
            transformerNotationDiff({ matchAlgorithm: "v3" }),
            transformerNotationWordHighlight({
              classActiveWord: "diff-add",
              matchAlgorithm: "v3",
            }),
          ]
        : [],
    })
    .replace("<pre", "<pre data-wheel-x");
}

function cleanCode(value: string): string {
  return value
    .split("\n")
    .filter((line) => !REMOVED_CODE_RE.test(line))
    .map((line) => line.replace(CODE_DIRECTIVE_RE, ""))
    .join("\n")
    .trimEnd();
}

function escapedCode(value: string, language = ""): string {
  return `<pre data-wheel-x><code data-language="${escapeAttr(language)}">${escapeHtml(value)}</code></pre>`;
}

function vizBlock(part: VizPart): string {
  const caption = part.text
    ? `<figcaption class="viz-caption">${renderMarkdownInline(part.text)}</figcaption>`
    : "";
  return `<figure class="viz-figure"><div class="viz-mount" data-viz="${escapeAttr(part.name)}">${escapeHtml(part.name)}</div>${caption}</figure>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
