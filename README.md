# Working Notes Canvas

A static, local-vault-powered graph site. The public repository contains the app,
parser, renderer, fixture notes, and deployment checks. Your real notes stay
outside git.

## Model

The production boundary is:

```txt
private vault or fixtures/vault
  -> scripts/build-obsidian-graph.ts --published
  -> generated/graph/data.ts + generated/graph/bodies.ts
  -> vite build
  -> dist/
```

Only `dist/` is deployable. `vault/`, `generated/`, `dist/`, and `backups/` are
ignored because they can contain private note content.

## Quick Start

The repo works immediately with the fixture vault:

```sh
npm install
npm run dev
```

This reads:

```txt
fixtures/vault
```

and starts Vite locally.

## Use Your Own Vault

Point the builder at your own Obsidian-style notes with either `NOTES_VAULT` or
`--vault`.

```sh
NOTES_VAULT=/absolute/path/to/your/vault/papers npm run dev
```

You can also pass `--vault` to one-off graph generation:

```sh
npm run generate:graph -- --vault /absolute/path/to/your/vault/papers
```

Input priority is:

```txt
--vault <path> or --vault=<path>
NOTES_VAULT
fixtures/vault
```

## Note Format

Every note is a markdown file with frontmatter:

```md
---
id: flow-matching
summary: A short summary for title/summary regimes.
tags: [region/distribution-mapping, published]
link: https://example.com
---

Body markdown goes here.
```

Required:

- `id`: stable graph id.

Optional:

- `summary`: shown on note cards and search results.
- `tags`: graph and publish behavior.
- `link`: external URL used by paper/source pills and icon links.

Useful tags:

- `hidden`: never emit this note in a published graph.
- `published`: if any note uses this tag, published builds emit only notes with
  `published` and without `hidden`.
- `me`: marks a home/person note.
- `region/<name>`: groups a note semantically.
- `region-header/<name>`: marks the main note for a region.

Current publish behavior:

- If no notes use `published`, `--published` emits every non-hidden note.
- If any notes use `published`, `--published` emits only published, non-hidden
  notes.

## Link Syntax

Graph links use Obsidian wikilinks:

```md
[[Target Note]]
[[Target Note|visible text]]
```

Directives can follow a wikilink:

```md
[[Target|text]]%%Popup message%%
[[Target|text]]%%ref%%
[[Target|github]]%%icon:/assets/icons/social/github.svg%%
```

Directive behavior:

- ordinary text directive: popup label/message.
- `ref`: suppresses the visual flow line while keeping the reference.
- `icon:<path>`: renders the highlight as an icon. The path should point to a
  public asset, such as `/assets/icons/social/github.svg`.

Adjacent wikilinks collapse into one multi-target highlight.

## Supported Body Blocks

The build step precomputes note body HTML. Supported content includes:

- normal markdown
- lists
- tables
- footnotes
- inline and display math
- fenced code blocks
- visualization blocks
- graph highlights

Visualization blocks use:

````md
```viz spinning-cube
Optional caption.
```
````

Known fixture visualizations include `spinning-cube` and `flow-matching`.

## Development Workflows

There are two workflows.

### Note Updates

Use this when only note content changed:

```sh
NOTES_VAULT=/absolute/path/to/private/vault npm run publish:notes
```

This:

1. Builds the published graph.
2. Typechecks the app.
3. Typechecks build scripts.
4. Builds the static Vite artifact.
5. Audits `dist/`.

If it passes, deploy `dist/`.

### Site Updates

Use this for app code, rendering, parser, styling, security headers, or
visualization changes:

```sh
npm run build:site
```

By default this uses fixture notes. For a private preproduction build, provide
`NOTES_VAULT`.

### Fast Checks

```sh
npm run check
```

This generates the fixture graph and runs TypeScript checks.

## Cloudflare / Static Deployment

For a private local deploy agent:

```sh
NOTES_VAULT=/absolute/path/to/private/vault npm run build:published
```

Deploy only:

```txt
dist
```

Cloudflare Pages should use `dist` as the output directory. If Cloudflare builds
directly from this public repo without a private vault, it will deploy the
fixture content.

`public/_headers` is copied to `dist/_headers` and configures security headers
and cache policy.

## Security Boundary

This is a static site. There is no production server, database, auth layer, or
runtime secret.

The public repo should contain:

- app source
- parser/build scripts
- fixture notes
- public assets
- docs

The public repo should not contain:

- private `vault/`
- `generated/`
- `dist/`
- `backups/`
- `.env*`
- Cloudflare tokens
- private keys/certs

The `.gitignore` enforces this for normal local development.

Important caveat: generated output and `dist/` contain note content. They are
safe to deploy publicly only if the emitted notes are meant to be public, but
they should not be committed to the public code repo.

## Trusted Markdown Caveat

Markdown HTML is intentionally trusted.

The build-time markdown renderer allows raw HTML because this app assumes the
vault is controlled by the site owner. Do not build from untrusted markdown
unless you first disable or sanitize raw HTML.

Runtime note bodies are inserted from generated build output with `innerHTML`.
That is acceptable only under the trusted-vault model above.

## Artifact Audit

`npm run audit:dist` validates:

- `dist/` exists.
- `dist/_headers` exists.
- the published graph has notes.
- no hidden note is emitted.
- every emitted `hasBody` note has a body.
- no body exists for a note outside the public graph.
- graph link indexes are valid.
- emitted graph connections do not point to private graph-only notes.
- forbidden directories are absent from `dist/`.
- raw markdown files and source maps are absent.
- obvious local/private paths are absent.

The full production gate is:

```sh
npm run build:published
```

Do not deploy if it fails.

## Parser Errors

Parser errors are intended to point to the file that needs attention. Common
failures:

- missing frontmatter `id`
- duplicate note id/title
- unresolved wikilink
- invalid tag
- self-link
- multiple popup labels on one wikilink

Fix the markdown source and rerun the build.

## Branching

Recommended branch roles:

- `dev`: normal development and preview deploys.
- `prod`: stable source used by the production deploy agent.

For private note-only publishing, the public repo usually does not need a code
change. Run the local deploy command with `NOTES_VAULT` and deploy `dist/`.

For site changes:

```txt
dev -> preview -> review -> prod -> production deploy
```

## Fresh Public Repo Checklist

Before making a repo public, verify:

```sh
git ls-files | rg '(^vault/|^generated/|^dist/|^backups/|wrangler\.toml|^\.env$|^\.env\.)' | rg -v '^\.env\.example$' || true
```

The command should print nothing relevant. Fixture notes under `fixtures/vault`
are intentionally public.
