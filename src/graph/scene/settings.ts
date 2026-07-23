import {
  LINE_WIDTHS,
  TEXT_SCALES,
  type HudSettings,
} from "../../components/hud/settings";

const SETTINGS_KEY = "working-notes:reader-settings:v1";
const DEFAULT_SETTINGS: HudSettings = {
  theme: "light",
  textScale: 1,
  lineWidth: 460,
};

export function loadSettings(): HudSettings {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    return {
      theme: value?.theme === "dark" ? "dark" : DEFAULT_SETTINGS.theme,
      textScale: valid(
        value?.textScale,
        TEXT_SCALES,
        DEFAULT_SETTINGS.textScale,
      ),
      lineWidth: valid(
        value?.lineWidth,
        LINE_WIDTHS,
        DEFAULT_SETTINGS.lineWidth,
      ),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: HudSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

function valid(
  value: unknown,
  options: readonly number[],
  fallback: number,
): number {
  return typeof value === "number" && options.includes(value)
    ? value
    : fallback;
}
