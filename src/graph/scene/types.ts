import type { Scene, WebGLRenderer } from "three";
import type { OrthographicCamera } from "three";
import type { DomNoteLayer, NoteLayout } from "../rendering/dom/notes";
import type { GraphView } from "../rendering/graph";
import type { SimLink, SimNode } from "../simulation";
import type { FlowLayout } from "../flows";
import type { createSimulation } from "../simulation";
import type { HudComponent, HudSettings } from "../../components/hud";
import type { PopupLayer } from "../../components/popups";
import type { Point } from "../flows";

export type GraphSceneBase = {
  root: HTMLDivElement;
  renderer: WebGLRenderer;
  threeScene: Scene;
  camera: OrthographicCamera;
  nodes: SimNode[];
  links: SimLink[];
  nodeById: Map<string, SimNode>;
  view: GraphView;
  domNotes: DomNoteLayer;
  hud: HudComponent;
  popups: PopupLayer;
};

export type GraphSceneApp = GraphSceneBase & {
  simulation: ReturnType<typeof createSimulation>;
};

export type SceneState = {
  dirty: boolean;
  focusedNode: SimNode | null;
  cancelFocusAnimation: (() => void) | null;
  cachedFlowLayouts: readonly FlowLayout[];
  currentNoteLayouts: readonly NoteLayout[];
  hoveredFlowIds: ReadonlySet<string>;
  activeFlowIds: ReadonlySet<string>;
  pointerScreen: Point | null;
  settings: HudSettings;
  drawnHtmlNotes: number;
};

export type FocusOptions = {
  updateHash?: boolean;
};
