import { CAMERA, NOTE } from "../constants";
import { clamp, lerp, smoothstep } from "../utils/math";

const REFERENCE = {
  width: 1440,
  height: 900,
  focusZoom: CAMERA.focusZoom,
};

const SIDE_PADDING = 28;
const VERTICAL_PADDING = 76;

export type CameraRegimeName = keyof typeof CAMERA.regimes;
export type CameraRegimes = Record<CameraRegimeName, number>;

export type CameraProfile = {
  focusZoom: number;
  minZoom: number;
  maxZoom: number;
  regimes: CameraRegimes;
  uiScale: number;
  edgeInset: number;
};

export function cameraProfileForViewport(
  width: number,
  height: number,
): CameraProfile {
  const viewportWidth = Math.max(1, width);
  const viewportHeight = Math.max(1, height);
  const fitWidthZoom = (viewportWidth - SIDE_PADDING) / NOTE.w;
  const fitHeightZoom = (viewportHeight - VERTICAL_PADDING) / NOTE.readerH;
  const fitZoom = clamp(
    Math.min(fitWidthZoom, fitHeightZoom),
    0.42,
    REFERENCE.focusZoom,
  );
  const focusZoom = fitZoom;
  const regimes = scaleRegimes(focusZoom);
  const viewportScale = clamp(
    Math.min(viewportWidth / REFERENCE.width, viewportHeight / REFERENCE.height),
    0,
    1,
  );
  const compact = 1 - smoothstep(viewportScale);
  const uiScale = lerp(1, clamp(focusZoom / REFERENCE.focusZoom, 0.72, 1), compact);
  const edgeInset = Math.round(lerp(48, 12, compact));

  return {
    focusZoom,
    minZoom: CAMERA.minZoom,
    maxZoom: CAMERA.maxZoom,
    regimes,
    uiScale,
    edgeInset,
  };
}

function scaleRegimes(focusZoom: number): CameraRegimes {
  const scale = focusZoom / REFERENCE.focusZoom;
  return {
    landmark: CAMERA.regimes.landmark * scale,
    title: CAMERA.regimes.title * scale,
    summary: CAMERA.regimes.summary * scale,
    reader: CAMERA.regimes.reader * scale,
  };
}
