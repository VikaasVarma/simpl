export const SIMULATION = {
  linkCardWidths: 2,
  linkK: 0.08,
  charge: -650,
  chargeDistanceMaxCardWidths: 10,
  centerK: 0.004,
  noteSpacingK: 0.16,
  noteSpacingWidthCardWidths: 4,
  noteSpacingHeightCardWidths: 3,
  simSpeed: 48,
  viscosity: 0.62,
  runs: {
    initial: { alpha: 0.02, durationMs: 12000, taperMs: 3500 },
    normal: { alpha: 0.02, durationMs: 7000, taperMs: 2500 },
    drag: { alpha: 0.025, durationMs: 3500, taperMs: 1200 },
  },
} as const;
