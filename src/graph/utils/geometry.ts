import type { PointLike } from "./vector";

export type RectLike = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function rectLeft(rect: RectLike): number {
  return rect.x - rect.w / 2;
}

export function rectRight(rect: RectLike): number {
  return rect.x + rect.w / 2;
}

export function rectBottom(rect: RectLike): number {
  return rect.y - rect.h / 2;
}

export function rectTop(rect: RectLike): number {
  return rect.y + rect.h / 2;
}

export function expandRect<T extends RectLike>(rect: T, padding: number): T {
  return { ...rect, w: rect.w + padding * 2, h: rect.h + padding * 2 };
}

export function rectFromEdges(
  left: number,
  right: number,
  bottom: number,
  top: number,
): RectLike {
  return {
    x: (left + right) / 2,
    y: (bottom + top) / 2,
    w: right - left,
    h: top - bottom,
  };
}

export function rectAroundSegment(a: PointLike, b: PointLike): RectLike {
  return rectFromEdges(
    Math.min(a.x, b.x),
    Math.max(a.x, b.x),
    Math.min(a.y, b.y),
    Math.max(a.y, b.y),
  );
}

export function domRectToWorldRect(
  parentWorld: RectLike,
  parentScreen: DOMRect,
  childScreen: DOMRect,
): RectLike {
  const scale = parentScreen.width / parentWorld.w;
  const w = childScreen.width / scale;
  const h = childScreen.height / scale;
  return {
    x:
      rectLeft(parentWorld) +
      (childScreen.left - parentScreen.left) / scale +
      w / 2,
    y:
      rectTop(parentWorld) -
      (childScreen.top - parentScreen.top) / scale -
      h / 2,
    w,
    h,
  };
}

export function rectsIntersect(a: RectLike, b: RectLike): boolean {
  return (
    Math.abs(a.x - b.x) * 2 <= a.w + b.w && Math.abs(a.y - b.y) * 2 <= a.h + b.h
  );
}

export function orthogonalSegmentIntersectsRect(
  a: PointLike,
  b: PointLike,
  rect: RectLike,
  eps = 1e-6,
): boolean {
  if (Math.abs(a.x - b.x) < eps) {
    return (
      a.x > rectLeft(rect) + eps &&
      a.x < rectRight(rect) - eps &&
      Math.max(a.y, b.y) > rectBottom(rect) + eps &&
      Math.min(a.y, b.y) < rectTop(rect) - eps
    );
  }

  if (Math.abs(a.y - b.y) < eps) {
    return (
      a.y > rectBottom(rect) + eps &&
      a.y < rectTop(rect) - eps &&
      Math.max(a.x, b.x) > rectLeft(rect) + eps &&
      Math.min(a.x, b.x) < rectRight(rect) - eps
    );
  }

  return true;
}
