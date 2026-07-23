export type Point = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FlowEndpoint = {
  id: string;
  rect: Rect;
  anchor: Point;
  normal: Point;
};

export type FlowInput = {
  id: string;
  source: FlowEndpoint;
  target: FlowEndpoint;
  colorIndex: number;
};

export type FlowLayout = FlowInput & {
  route: readonly Point[];
};
