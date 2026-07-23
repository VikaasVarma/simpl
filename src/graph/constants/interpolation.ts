import { smoothstep } from "../utils/math";

export const INTERPOLATION = {
  repeatedSmoothstep: (n: number) => (t: number) => {
    for (let i = 0; i < n; i++) t = smoothstep(t);
    return t;
  },
} as const;
