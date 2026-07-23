import type { Mesh, Vector2 } from "three";
import type { SimNode } from "../../simulation/types";
import type { FlowLayer } from "./flows";

export type NoteView = {
  node: SimNode;
  panel: Mesh;
  haloPoints: Vector2[];
  haloCount: number;
};

export type GraphView = {
  flows: FlowLayer;
  notes: NoteView[];
};
