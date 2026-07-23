import type { ThemeName } from "../../graph/constants";

export type HudSettings = {
  theme: ThemeName;
  textScale: number;
  lineWidth: number;
};

export const TEXT_SCALES = [0.75, 0.88, 1, 1.14, 1.3] as const;
export const LINE_WIDTHS = [400, 460, 540] as const;
const TEXT_SCALE_STYLES = [
  "font-size:0.7em",
  "font-size:0.82em",
  "",
  "font-size:1.16em",
  "font-size:1.34em",
];
const LINE_WIDTH_LABELS = ["Narrow", "Medium", "Wide"];

export type SettingsComponent = {
  button: HTMLButtonElement;
  panel: HTMLElement;
  themeButtons: HTMLButtonElement[];
  textButtons: HTMLButtonElement[];
  lineButtons: HTMLButtonElement[];
};

export function createSettingsComponent(): SettingsComponent {
  const button = document.createElement("button");
  const panel = document.createElement("aside");

  button.className = "graph-hud__settings";
  button.type = "button";
  button.ariaLabel = "settings";
  button.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.4 3.5c0 .6-.05 1.18-.14 1.74l1.92 1.5-2 3.46-2.3-.9a8.4 8.4 0 0 1-2.96 1.72l-.35 2.48h-4l-.35-2.48a8.4 8.4 0 0 1-2.96-1.72l-2.3.9-2-3.46 1.92-1.5A8.6 8.6 0 0 1 3.6 12c0-.6.05-1.18.14-1.74L1.82 8.76l2-3.46 2.3.9A8.4 8.4 0 0 1 9.08 4.5l.35-2.48h4l.35 2.48a8.4 8.4 0 0 1 2.96 1.72l2.3-.9 2 3.46-1.92 1.5c.09.56.14 1.14.14 1.74z"/></svg>`;

  panel.className = "graph-hud__panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="graph-hud__panel-header">
      <h2>Reading</h2>
      <button class="graph-hud__close" type="button" aria-label="close">×</button>
    </div>
    ${setting("Theme", [
      option("light", "Light", "theme"),
      option("dark", "Dark", "theme"),
    ])}
    ${setting(
      "Text size",
      TEXT_SCALES.map((value, index) =>
        option(String(value), "A", "text", TEXT_SCALE_STYLES[index]),
      ),
    )}
    ${setting(
      "Line width",
      LINE_WIDTHS.map((value, index) =>
        option(String(value), LINE_WIDTH_LABELS[index], "line"),
      ),
    )}
  `;

  return {
    button,
    panel,
    themeButtons: buttons(panel, "theme"),
    textButtons: buttons(panel, "text"),
    lineButtons: buttons(panel, "line"),
  };
}

export function bindSettings(
  settings: SettingsComponent,
  values: HudSettings,
  onChange: (settings: HudSettings) => void,
): void {
  settings.button.addEventListener("click", () => {
    settings.panel.hidden = !settings.panel.hidden;
  });
  settings.panel
    .querySelector(".graph-hud__close")
    ?.addEventListener("click", () => {
      settings.panel.hidden = true;
    });
  settings.themeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      values.theme = button.dataset.value as ThemeName;
      updateSettings(settings, values);
      onChange(values);
    }),
  );
  settings.textButtons.forEach((button) =>
    button.addEventListener("click", () => {
      values.textScale = Number(button.dataset.value);
      updateSettings(settings, values);
      onChange(values);
    }),
  );
  settings.lineButtons.forEach((button) =>
    button.addEventListener("click", () => {
      values.lineWidth = Number(button.dataset.value);
      updateSettings(settings, values);
      onChange(values);
    }),
  );
  updateSettings(settings, values);
}

export function applyHudSettings(settings: HudSettings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty(
    "--reader-text-scale",
    String(settings.textScale),
  );
  document.documentElement.style.setProperty(
    "--reader-line-width",
    `${settings.lineWidth}px`,
  );
}

function updateSettings(
  component: SettingsComponent,
  settings: HudSettings,
): void {
  component.themeButtons.forEach((button) =>
    button.classList.toggle(
      "is-active",
      button.dataset.value === settings.theme,
    ),
  );
  component.textButtons.forEach((button) =>
    button.classList.toggle(
      "is-active",
      Number(button.dataset.value) === settings.textScale,
    ),
  );
  component.lineButtons.forEach((button) =>
    button.classList.toggle(
      "is-active",
      Number(button.dataset.value) === settings.lineWidth,
    ),
  );
}

function setting(label: string, controls: string[]): string {
  return `<section class="graph-hud__setting"><label>${label}</label><div>${controls.join("")}</div></section>`;
}

function option(
  value: string,
  label: string,
  group: string,
  style = "",
): string {
  return `<button type="button" data-group="${group}" data-value="${value}"${style ? ` style="${style}"` : ""}>${label}</button>`;
}

function buttons(panel: HTMLElement, group: string): HTMLButtonElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLButtonElement>(`button[data-group="${group}"]`),
  );
}
