import { clamp, lerp, smoothstep } from "../utils/math";
import { domRectToWorldRect } from "../utils/geometry";
import type { GraphConnectionGroup } from "../graphTypes";
import type { FlowEndpoint, Point, Rect } from "./types";
import { edgeEndpoint, endpointFromAngle } from "./endpoint";

const EDGE_INSET = 8;

export type SourceHighlightEndpointInput = {
  sourceId: string;
  targetId: string;
  sourceRect: Rect;
  target: Point;
  connections: readonly GraphConnectionGroup[];
  noteElement: HTMLElement;
  bodyElement: HTMLElement;
  bodyInner: HTMLElement;
  bodyProgress: number;
  summaryAngle: number;
};

export function sourceHighlightEndpoint({
  sourceId,
  targetId,
  sourceRect,
  target,
  connections,
  noteElement,
  bodyElement,
  bodyInner,
  bodyProgress,
  summaryAngle,
}: SourceHighlightEndpointInput): FlowEndpoint | null {
  if (bodyProgress <= 0 || noteElement.hidden || bodyElement.hidden)
    return null;

  const group = connections.find((item) =>
    item.connections.some((connection) => connection.target === targetId),
  );
  if (!group) return null;

  const mark = bodyInner.querySelector<HTMLElement>(
    `.graph-highlight[data-source-id="${CSS.escape(sourceId)}"][data-group-id="${CSS.escape(group.id)}"]`,
  );
  if (!mark) return null;

  const noteScreen = noteElement.getBoundingClientRect();
  const bodyScreen = bodyElement.getBoundingClientRect();
  const markScreen = mark.getBoundingClientRect();
  if (
    noteScreen.width <= 0 ||
    noteScreen.height <= 0 ||
    bodyScreen.width <= 0 ||
    bodyScreen.height <= 0 ||
    markScreen.width <= 0 ||
    markScreen.height <= 0
  ) {
    return null;
  }

  return highlightEndpoint(
    sourceId,
    sourceRect,
    domRectToWorldRect(sourceRect, noteScreen, bodyScreen),
    domRectToWorldRect(sourceRect, noteScreen, markScreen),
    target,
    bodyProgress,
    summaryAngle,
  );
}

function highlightEndpoint(
  id: string,
  note: Rect,
  body: Rect,
  mark: Rect,
  target: Point,
  progress: number,
  summaryAngle: number,
): FlowEndpoint {
  const summaryAnchor = endpointFromAngle(id, note, summaryAngle).anchor;
  const right = target.x >= note.x;
  const side = {
    x: note.x + (right ? note.w / 2 : -note.w / 2),
    y: mark.y,
  };
  const edgeX = clamp(
    mark.x,
    note.x - note.w / 2 + EDGE_INSET,
    note.x + note.w / 2 - EDGE_INSET,
  );

  let anchor = side;
  const markTop = mark.y - mark.h / 2;
  const markBottom = mark.y + mark.h / 2;
  const bodyTop = body.y - body.h / 2;
  const bodyBottom = body.y + body.h / 2;

  if (markTop < bodyTop) {
    const t = smoothstep(
      clamp((bodyTop - markTop) / Math.max(1, mark.h), 0, 1),
    );
    anchor = mix(side, { x: edgeX, y: note.y - note.h / 2 }, t);
  } else if (markBottom > bodyBottom) {
    const t = smoothstep(
      clamp((markBottom - bodyBottom) / Math.max(1, mark.h), 0, 1),
    );
    anchor = mix(side, { x: edgeX, y: note.y + note.h / 2 }, t);
  }

  return edgeEndpoint(id, note, mix(summaryAnchor, anchor, progress));
}

function mix(a: Point, b: Point, t: number): Point {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}
