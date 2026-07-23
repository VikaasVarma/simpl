import { createHomeButton } from "./home";
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

export { applyHudSettings };
export type { HudSettings };

export type HudComponent = {
  element: HTMLElement;
  home: HTMLButtonElement;
  search: SearchComponent;
  settings: SettingsComponent;
};

export function createHudComponent(): HudComponent {
  const element = document.createElement("div");
  const topbar = document.createElement("div");
  const actions = document.createElement("div");
  const home = createHomeButton();
  const search = createSearchComponent();
  const settings = createSettingsComponent();

  element.className = "graph-hud";
  topbar.className = "graph-hud__topbar";
  actions.className = "graph-hud__actions";
  actions.append(search.button, settings.button);
  topbar.append(home, actions);
  element.append(topbar, search.overlay, settings.panel);

  return { element, home, search, settings };
}

export function bindHud(
  hud: HudComponent,
  nodes: Parameters<typeof bindSearch>[1],
  settings: HudSettings,
  onHome: () => void,
  onSearchFocus: (id: string) => boolean,
  onSettings: (settings: HudSettings) => void,
): void {
  hud.home.addEventListener("click", onHome);
  bindSearch(hud.search, nodes, onSearchFocus);
  bindSettings(hud.settings, settings, onSettings);
  document.addEventListener("pointerdown", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (hud.settings.panel.hidden || hud.element.contains(target)) return;
    hud.settings.panel.hidden = true;
  });
}
