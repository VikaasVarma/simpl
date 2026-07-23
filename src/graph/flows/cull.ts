import type { OrthographicCamera } from "three";
import type { Point, Rect } from "./types";
import {
  rectAroundSegment,
  rectBottom,
  rectFromEdges,
  rectLeft,
  rectRight,
  rectTop,
  rectsIntersect,
} from "../utils/geometry";

const ROUTE_PADDING = 18;

type CullableFlow = {
  source: { rect: Rect };
  target: { rect: Rect };
};

type RoutableFlow = {
  route: readonly Point[];
};

export function cullFlowsByEndpoint<T extends CullableFlow>(
  flows: readonly T[],
  camera: OrthographicCamera,
  width: number,
  height: number,
  padding = ROUTE_PADDING,
): T[] {
  const viewport = viewportRect(camera, width, height);
  return flows.filter((flow) => {
    const a = flow.source.rect;
    const b = flow.target.rect;
    return rectsIntersect(
      rectFromEdges(
        Math.min(rectLeft(a), rectLeft(b)) - padding,
        Math.max(rectRight(a), rectRight(b)) + padding,
        Math.min(rectBottom(a), rectBottom(b)) - padding,
        Math.max(rectTop(a), rectTop(b)) + padding,
      ),
      viewport,
    );
  });
}

export function cullFlowsByPath<T extends RoutableFlow>(
  flows: readonly T[],
  camera: OrthographicCamera,
  width: number,
  height: number,
  padding = ROUTE_PADDING,
): T[] {
  const viewport = viewportRect(camera, width, height, padding);
  return flows.filter((flow) => {
    for (let i = 1; i < flow.route.length; i++) {
      if (
        rectsIntersect(rectAroundSegment(flow.route[i - 1], flow.route[i]), viewport)
      ) {
        return true;
      }
    }
    return false;
  });
}

export function isRectInViewport(
  rect: Rect,
  camera: OrthographicCamera,
  width: number,
  height: number,
  padding = 0,
): boolean {
  return rectsIntersect(rect, viewportRect(camera, width, height, padding));
}

function viewportRect(
  camera: OrthographicCamera,
  width: number,
  height: number,
  padding = 0,
): Rect {
  return {
    x: camera.position.x,
    y: camera.position.y,
    w: width / camera.zoom + padding * 2,
    h: height / camera.zoom + padding * 2,
  };
}
