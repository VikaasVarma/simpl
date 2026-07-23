import { CAMERA, NOTE } from "../../constants";
import { clamp, lerp } from "../../utils/math";

export type NoteRegime = keyof typeof CAMERA.regimes;
type NoteTransition = keyof typeof CAMERA.transitions;

export function sampleLod(
  zoom: number,
  heights: Partial<Record<"title" | "summary" | "reader", number>> = {},
) {
  const titleHeight = Math.max(NOTE.minH, heights.title ?? NOTE.minH);
  const summaryHeight = Math.max(
    titleHeight,
    Math.min(
      heights.reader ?? NOTE.readerH,
      heights.summary ?? titleHeight,
    ),
  );
  const readerHeight = Math.max(
    summaryHeight,
    heights.reader ?? NOTE.readerH,
  );
  const title = progress(zoom, "landmarkToTitle");
  const summary = progress(zoom, "titleToSummary");
  const reader = progress(zoom, "summaryToReader");
  const interval = activeTransition(zoom);
  const regime = interval?.from ?? regimeAtZoom(zoom);
  const height =
    interval === CAMERA.transitions.landmarkToTitle
      ? lerp(NOTE.landmarkH, titleHeight, title)
      : interval === CAMERA.transitions.titleToSummary
        ? lerp(titleHeight, summaryHeight, summary)
        : interval === CAMERA.transitions.summaryToReader
          ? lerp(summaryHeight, readerHeight, reader)
          : regimeHeight(regime, titleHeight, summaryHeight, readerHeight);

  return {
    height,
    bodyProgress: reader,
    summaryProgress: summary,
    compactProgress: title,
    regime,
  };
}

function progress(value: number, name: NoteTransition): number {
  const transition = CAMERA.transitions[name];
  const t = transitionProgress(value, transition);
  return transition.interpolate(t);
}

function activeTransition(
  zoom: number,
): (typeof CAMERA.transitions)[NoteTransition] | null {
  return (
    Object.values(CAMERA.transitions).find(
      (transition) => {
        const from = CAMERA.regimes[transition.from];
        const to = CAMERA.regimes[transition.to];
        return zoom >= Math.min(from, to) && zoom < Math.max(from, to);
      },
    ) ?? null
  );
}

function transitionProgress(
  zoom: number,
  transition: (typeof CAMERA.transitions)[NoteTransition],
): number {
  const from = CAMERA.regimes[transition.from];
  const to = CAMERA.regimes[transition.to];
  return clamp((zoom - from) / (to - from), 0, 1);
}

function regimeAtZoom(zoom: number): NoteRegime {
  if (zoom >= CAMERA.regimes.reader) return "reader";
  if (zoom >= CAMERA.regimes.summary) return "summary";
  if (zoom >= CAMERA.regimes.title) return "title";
  return "landmark";
}

function regimeHeight(
  regime: NoteRegime,
  titleHeight: number,
  summaryHeight: number,
  readerHeight: number,
): number {
  if (regime === "title") return titleHeight;
  if (regime === "summary") return summaryHeight;
  if (regime === "reader") return readerHeight;
  return NOTE.landmarkH;
}
