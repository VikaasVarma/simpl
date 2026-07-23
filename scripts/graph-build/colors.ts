import { hashString, lcg } from "../../src/graph/utils/random";

export const PALETTE_SIZE = 6;

export function shuffledColors(seedText: string): number[] {
  const colors = Array.from({ length: PALETTE_SIZE }, (_, i) => i);
  let seed = hashString(seedText, 0);

  for (let i = colors.length - 1; i > 0; i--) {
    seed = lcg(seed);
    const j = seed % (i + 1);
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  return colors;
}
