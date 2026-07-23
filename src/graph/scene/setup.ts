import { Scene } from "three";
import { graphData } from "../../../generated/graph/data";
import { createCamera } from "../camera";
import { createGraphView, createRenderer } from "../rendering";
import { createDomNotes } from "../rendering/dom/notes";
import { createGraph } from "../simulation";
import { createFlowLabelLayer } from "../../components/flowLabels";
import { createHudComponent } from "../../components/hud";
import { createPopupLayer } from "../../components/popups";
import type { GraphSceneBase } from "./types";

export function createSceneBase(): GraphSceneBase {
  const root = document.querySelector<HTMLDivElement>("#graph");
  if (!root) throw new Error("Missing #graph mount.");

  const renderer = createRenderer(root);
  const threeScene = new Scene();
  const camera = createCamera();
  const { nodes, links } = createGraph(graphData);
  const view = createGraphView(nodes);
  const domNotes = createDomNotes(root, view.notes.length);
  const flowLabels = createFlowLabelLayer();
  const hud = createHudComponent();
  const popups = createPopupLayer();

  root.appendChild(flowLabels.element);
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
    flowLabels,
  };
}
