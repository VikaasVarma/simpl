import { Scene } from "three";
import { createCamera } from "../camera";
import { currentGraphData } from "../data";
import { createGraphView, createRenderer } from "../rendering";
import { createDomNotes } from "../rendering/dom/notes";
import { createGraph } from "../simulation";
import { createHudComponent } from "../../components/hud";
import { createPopupLayer } from "../../components/popups";
import type { GraphSceneBase } from "./types";

export async function createSceneBase(): Promise<GraphSceneBase> {
  const root = document.querySelector<HTMLDivElement>("#graph");
  if (!root) throw new Error("Missing #graph mount.");

  const renderer = createRenderer(root);
  const threeScene = new Scene();
  const camera = createCamera();
  const { nodes, links } = createGraph(await currentGraphData());
  const view = createGraphView(nodes);
  const domNotes = createDomNotes(root, view.notes.length);
  const hud = createHudComponent();
  const popups = createPopupLayer();

  root.appendChild(hud.element);
  root.appendChild(popups.element);
  threeScene.add(view.flows.group, ...view.notes.map((note) => note.panel));

  return {
    root,
    renderer,
    threeScene,
    camera,
    nodes,
    links,
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    view,
    domNotes,
    hud,
    popups,
  };
}
