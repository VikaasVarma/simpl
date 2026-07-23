export function hashString(value: string, seed = 17): number {
  let hash = seed;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}

export function fnvHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

export function lcg(seed: number): number {
  return (seed * 1664525 + 1013904223) >>> 0;
}

export function jitter(value: string, range: number): number {
  return Math.round((fnvHash(value) / 0xffffffff - 0.5) * range * 100) / 100;
}
