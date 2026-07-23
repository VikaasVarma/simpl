export const THEMES = {
  light: {
    bg: "#FAF7F2",
    text: "#2C2825",
    textMuted: "#5C5852",
    accent: "#5B7B5A",
    edge: "#C4BCB0",
    flow: ["#5B7B5A", "#B07849", "#B79545", "#5F9B95", "#9B7396", "#B17361"],
    shadow: "#2C2825",
  },
  dark: {
    bg: "#1B1815",
    text: "#ECE5D5",
    textMuted: "#A09A8C",
    accent: "#8FAC8C",
    edge: "#4A4540",
    flow: ["#8FAC8C", "#C8956E", "#D4B576", "#85BFB7", "#BC9CB7", "#CC9382"],
    shadow: "#FFF0D2",
  },
} as const;

export type ThemeName = keyof typeof THEMES;
export type GraphPalette = {
  readonly bg: string;
  readonly text: string;
  readonly textMuted: string;
  readonly accent: string;
  readonly edge: string;
  readonly flow: readonly string[];
  readonly shadow: string;
};

export const PALETTE: GraphPalette = THEMES.light;

export function paletteForTheme(theme: ThemeName): GraphPalette {
  return THEMES[theme];
}

