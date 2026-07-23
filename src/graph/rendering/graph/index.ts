import { Vector2 } from "three";
import { FLOW, NOTE, NOTE_LAYER } from "../../constants";
import type { GraphPalette } from "../../constants";
import type { SimNode } from "../../simulation/types";
import type { NoteView } from "./types";
import type { Rect } from "../../flows";
import { createNoteCard, renderNoteCard, updateNoteCardTheme } from "./card";

export { sampleLod } from "./layout";
export type { NoteRegime } from "./layout";
export { createFlowLayer, drawFlows } from "./flows";
export type { FlowLayer, FlowLine } from "./flows";
export type { GraphView, NoteView } from "./types";
export { drawHalos } from "./halos";

export function createNoteView(node: SimNode): NoteView {
  const panel = createNoteCard({
    w: NOTE.w,
    h: NOTE.readerH,
  });
  panel.userData.nodeIndex = node.index;
  panel.renderOrder = NOTE_LAYER.cardOrder;

  return {
    node,
    panel,
    haloPoints: Array.from({ length: FLOW.haloSlots }, () => new Vector2()),
    haloCount: 0,
  };
}

export function updateNoteTheme(note: NoteView, palette: GraphPalette): void {
  updateNoteCardTheme(note, palette);
}

export function drawNotes(
  notes: NoteView[],
  rects: readonly { rect: Rect }[],
  focusedNodeId: string | null = null,
): void {
  notes.forEach((note, index) => {
    const rect = rects[index]?.rect;
    if (!rect) {
      note.panel.visible = false;
      return;
    }
    const opacity = focusedNodeId && focusedNodeId !== note.node.id ? 0.16 : 1;
    const order =
      focusedNodeId === note.node.id ? NOTE_LAYER.focusedOrderOffset : 0;
    renderNoteCard(
      note,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      opacity,
      NOTE.radius,
      NOTE_LAYER.cardZ,
      order + NOTE_LAYER.cardOrder,
    );
    note.panel.visible = true;
  });
}

export function pickNote(
  point: { x: number; y: number },
  notes: NoteView[],
  rects: readonly { rect: Rect }[],
): NoteView | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const note = notes[i];
    const rect = rects[i]?.rect;
    if (!rect) continue;
    if (
      Math.abs(point.x - rect.x) <= rect.w / 2 &&
      Math.abs(point.y - rect.y) <= rect.h / 2
    ) {
      return note;
    }
  }
  return null;
}
