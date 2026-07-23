import { FLOW } from "../../constants";
import type { FlowLayout } from "../../flows";
import type { NoteView } from "./types";
import { updateNoteCardHalos } from "./card";

export function drawHalos(
  notes: NoteView[],
  layouts: readonly FlowLayout[],
): void {
  clearHalos(notes);
  const notesById = new Map(notes.map((note) => [note.node.id, note]));
  for (const layout of layouts) {
    addHalo(notesById.get(layout.source.id)!, layout.route[0]);
    addHalo(
      notesById.get(layout.target.id)!,
      layout.route[layout.route.length - 1],
    );
  }
  notes.forEach(updateNoteCardHalos);
}

function clearHalos(notes: NoteView[]): void {
  for (const note of notes) note.haloCount = 0;
}

function addHalo(note: NoteView, point: { x: number; y: number }): void {
  if (note.haloCount >= FLOW.haloSlots) return;
  note.haloPoints[note.haloCount++].set(
    point.x - note.node.x,
    point.y - note.node.y,
  );
}
