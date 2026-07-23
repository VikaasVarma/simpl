---
id: the-notes
summary: How to write notes for the graph.
tags: [published]
---

Each note needs frontmatter with an `id`. A `summary` is recommended.

The parser understands normal markdown, math like $x_0$, code blocks, and
Obsidian wikilinks. These live examples cover the important paths:

- [[Flow Matching]] creates a graph connection.
- [[Flow Matching|custom label]] uses custom highlight text.
- [[Flow Matching|reference link]]%%ref%% stays clickable without drawing a flow line.
- [[GitHub|github]]%%icon:/assets/icons/social/github.svg%% renders an icon.

This note references [[Flow Matching|flow matching]]%%ref%% without drawing a
separate visible line.

```python
def hello_graph(name: str) -> str:
    return f"hello, {name}"
```
