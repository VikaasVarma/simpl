export type HierarchyRailItem = {
  id: string;
  title: string;
};

export type HierarchyRailComponent = {
  element: HTMLElement;
  key: string;
};

export function createHierarchyRailComponent(): HierarchyRailComponent {
  const element = document.createElement("div");
  element.className = "graph-hud__history";
  return { element, key: "" };
}

export function bindHierarchyRail(
  rail: HierarchyRailComponent,
  onFocus: (id: string) => boolean,
): void {
  rail.element.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.closest<HTMLElement>("[data-node-id]")?.dataset.nodeId;
    if (id) onFocus(id);
  });
}

export function renderHierarchyRail(
  rail: HierarchyRailComponent,
  items: readonly HierarchyRailItem[],
  focused: boolean,
): void {
  const key = `${focused ? "focused" : "unfocused"}\n${items
    .map(({ id }) => id)
    .join("\n")}`;
  if (key === rail.key) return;
  rail.key = key;
  rail.element.classList.toggle("is-focused", focused);
  rail.element.replaceChildren(
    ...items.map((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "graph-hud__history-item";
      button.dataset.nodeId = item.id;
      button.textContent = item.title;
      if (index === 0) button.ariaCurrent = "page";
      return button;
    }),
  );
}
