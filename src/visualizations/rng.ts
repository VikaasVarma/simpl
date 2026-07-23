export type Rng = () => number;

export function createRng(seed: number): Rng {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createGaussianSampler(rng: Rng): () => number {
  let cached: number | undefined;
  return () => {
    if (cached !== undefined) {
      const value = cached;
      cached = undefined;
      return value;
    }
    const u1 = 1 - rng();
    const u2 = rng();
    const magnitude = Math.sqrt(-2 * Math.log(u1));
    const angle = Math.PI * 2 * u2;
    cached = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  };
}
