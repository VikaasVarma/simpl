import {
  bindHierarchyRail,
  createHierarchyRailComponent,
  type HierarchyRailComponent,
  renderHierarchyRail,
} from "./hierarchy";
import {
  bindSearch,
  createSearchComponent,
  type SearchComponent,
} from "./search";
import {
  applyHudSettings,
  bindSettings,
  createSettingsComponent,
  type HudSettings,
  type SettingsComponent,
} from "./settings";

export { applyHudSettings, renderHierarchyRail };
export type { HudSettings };

export type HudComponent = {
  element: HTMLElement;
  hierarchy: HierarchyRailComponent;
  search: SearchComponent;
  settings: SettingsComponent;
};

export function createHudComponent(): HudComponent {
  const element = document.createElement("div");
  const topbar = document.createElement("div");
  const actions = document.createElement("div");
  const hierarchy = createHierarchyRailComponent();
  const search = createSearchComponent();
  const settings = createSettingsComponent();

  element.className = "graph-hud";
  topbar.className = "graph-hud__topbar";
  actions.className = "graph-hud__actions";
  actions.append(search.button, settings.button);
  topbar.append(hierarchy.element, actions);
  element.append(topbar, search.overlay, settings.panel);

  return { element, hierarchy, search, settings };
}

export function bindHud(
  hud: HudComponent,
  nodes: Parameters<typeof bindSearch>[1],
  settings: HudSettings,
  onSearchFocus: (id: string) => boolean,
  onSettings: (settings: HudSettings) => void,
  onHistoryFocus: (id: string) => boolean,
): void {
  bindHierarchyRail(hud.hierarchy, onHistoryFocus);
  bindSearch(hud.search, nodes, onSearchFocus);
  bindSettings(hud.settings, settings, onSettings);
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (hud.settings.panel.hidden || hud.element.contains(target)) return;
    hud.settings.panel.hidden = true;
  });
}
