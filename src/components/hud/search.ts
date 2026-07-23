import type { GraphNode } from "../../graph/graphTypes";

type SearchResult = {
  node: GraphNode;
  score: number;
};

export type SearchComponent = {
  button: HTMLButtonElement;
  overlay: HTMLElement;
  input: HTMLInputElement;
  results: HTMLElement;
};

const MAX_RESULTS = 12;
const POINTER_MOVE_PX = 5;

export function createSearchComponent(): SearchComponent {
  const button = document.createElement("button");
  const overlay = document.createElement("div");

  button.className = "graph-hud__search-button";
  button.type = "button";
  button.innerHTML = `<span>search</span><kbd>⌘K</kbd>`;

  overlay.className = "graph-search";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="graph-search__panel" role="dialog" aria-modal="true" aria-label="Search notes">
      <div class="graph-search__input-row">
        <span class="graph-search__icon" aria-hidden="true">⌕</span>
        <input class="graph-search__input" type="search" placeholder="search notes..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Search notes" />
        <kbd class="graph-search__key">esc</kbd>
      </div>
      <ul class="graph-search__results" role="listbox"></ul>
      <p class="graph-search__hint">
        <span><kbd>↑↓</kbd> navigate</span>
        <span><kbd>↵</kbd> focus</span>
      </p>
    </div>
  `;

  return {
    button,
    overlay,
    input: overlay.querySelector(".graph-search__input") as HTMLInputElement,
    results: overlay.querySelector(".graph-search__results") as HTMLElement,
  };
}

export function bindSearch(
  search: SearchComponent,
  nodes: readonly GraphNode[],
  focusById: (id: string) => boolean,
): void {
  let currentResults: SearchResult[] = [];
  let activeIndex = 0;
  let openedAt: { x: number; y: number } | null = null;
  let pointerMoved = false;

  const open = (event?: MouseEvent | PointerEvent) => {
    openedAt =
      event && "clientX" in event
        ? { x: event.clientX, y: event.clientY }
        : null;
    pointerMoved = false;
    activeIndex = 0;
    search.overlay.hidden = false;
    search.input.focus();
    search.input.select();
    render();
  };

  const close = () => {
    search.overlay.hidden = true;
  };

  search.button.addEventListener("click", (event) => open(event));
  search.overlay.addEventListener("pointerdown", (event) => {
    if (event.target === search.overlay) close();
  });
  search.overlay.addEventListener("pointermove", (event) => {
    if (pointerMoved) return;
    if (
      !(event.target instanceof Element) ||
      !event.target.closest(".graph-search__panel")
    )
      return;
    if (!openedAt) {
      pointerMoved = true;
      return;
    }
    pointerMoved =
      Math.hypot(event.clientX - openedAt.x, event.clientY - openedAt.y) >
      POINTER_MOVE_PX;
  });
  search.input.addEventListener("input", () => {
    activeIndex = 0;
    render();
  });
  search.input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = currentResults[activeIndex];
      if (result && focusById(result.node.id)) close();
    }
  });
  document.addEventListener("keydown", (event) => {
    const typing = isTyping(event.target);
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k" &&
      !typing
    ) {
      event.preventDefault();
      open();
    } else if (event.key === "/" && !typing) {
      event.preventDefault();
      open();
    } else if (event.key === "Escape" && !search.overlay.hidden) {
      event.preventDefault();
      close();
    }
  });

  function render(): void {
    const query = search.input.value.trim();
    currentResults = query ? searchNodes(nodes, query) : [];
    if (!query) {
      search.results.innerHTML = "";
      return;
    }
    if (currentResults.length === 0) {
      search.results.innerHTML = `<li class="graph-search__empty">No matches for "${escapeHtml(query)}".</li>`;
      return;
    }
    if (activeIndex >= currentResults.length) activeIndex = 0;
    search.results.innerHTML = currentResults
      .map(
        ({ node }, index) => `
          <li class="graph-search__result${index === activeIndex ? " is-active" : ""}" role="option" aria-selected="${index === activeIndex}" data-index="${index}">
            <div class="graph-search__result-title">${highlight(node.title, query)}</div>
            ${node.summary ? `<p class="graph-search__result-summary">${escapeHtml(node.summary)}</p>` : ""}
          </li>
        `,
      )
      .join("");
    search.results
      .querySelectorAll<HTMLElement>(".graph-search__result")
      .forEach((item) => {
        const activate = () => {
          if (!pointerMoved) return;
          activeIndex = Number(item.dataset.index);
          updateActive();
        };
        item.addEventListener("pointerenter", activate);
        item.addEventListener("pointermove", activate);
        item.addEventListener("click", () => {
          const result = currentResults[Number(item.dataset.index)];
          if (result && focusById(result.node.id)) close();
        });
      });
  }

  function move(delta: number): void {
    if (!currentResults.length) return;
    activeIndex =
      (activeIndex + delta + currentResults.length) % currentResults.length;
    updateActive();
  }

  function updateActive(): void {
    search.results
      .querySelectorAll<HTMLElement>(".graph-search__result")
      .forEach((item, index) => {
        const active = index === activeIndex;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
        if (active) item.scrollIntoView({ block: "nearest" });
      });
  }
}

function searchNodes(
  nodes: readonly GraphNode[],
  query: string,
): SearchResult[] {
  const q = query.toLowerCase();
  return nodes
    .map((node) => ({ node, score: scoreNode(node, q) }))
    .filter((result) => result.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title),
    )
    .slice(0, MAX_RESULTS);
}

function scoreNode(node: GraphNode, query: string): number {
  const title = node.title.toLowerCase();
  if (title.startsWith(query)) return 100;
  if (title.includes(query)) return 80;
  if (node.summary.toLowerCase().includes(query)) return 40;
  if (node.searchText.toLowerCase().includes(query)) return 20;
  return 0;
}

function highlight(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const tokens = query
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!tokens.length) return escaped;
  return escaped.replace(
    new RegExp(`(${tokens.join("|")})`, "gi"),
    "<mark>$1</mark>",
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
