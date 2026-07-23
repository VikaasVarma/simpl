import { INTERPOLATION } from "./interpolation";

const FOCUS_ZOOM = 1.1;

export const CAMERA = {
  minZoom: 0.035,
  maxZoom: 8,
  regimes: {
    landmark: 0.05,
    title: 0.4,
    summary: 0.6,
    reader: 1.0,
  },
  transitions: {
    landmarkToTitle: {
      from: "landmark",
      to: "title",
      interpolate: INTERPOLATION.repeatedSmoothstep(3),
    },
    titleToSummary: {
      from: "title",
      to: "summary",
      interpolate: INTERPOLATION.repeatedSmoothstep(3),
    },
    summaryToReader: {
      from: "summary",
      to: "reader",
      interpolate: INTERPOLATION.repeatedSmoothstep(3),
    },
  },
  wheel: {
    speed: 0.0018,
    minScale: 0.14,
    focusStickyRadius: 0.24,
    focusStickyStrength: 0.95,
  },
  focusZoom: FOCUS_ZOOM,
  focusMs: 780,
} as const;
