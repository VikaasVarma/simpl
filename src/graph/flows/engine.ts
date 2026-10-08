import type { OrthographicCamera } from "three";
import { worldToScreen } from "../camera";
import { FLOW } from "../constants";
import { pointSegmentDistance } from "../utils/vector";
import { clamp } from "../utils/math";
import { cullFlowsByEndpoint, cullFlowsByPath } from "./cull";
import { routeFlow } from "./router";
import type { FlowEndpoint, FlowInput, FlowLayout } from "./types";

const ENDPOINT_GAP_PX = FLOW.anchorGap;
const SPREAD_PASSES = 4;
const SORT_EPS = 1e-6;
type EndpointSlot = {
  flowId: string;
  endpoint: FlowEndpoint;
};

export function buildFlows(
  flows: FlowInput[],
  camera: OrthographicCamera,
  width: number,
  height: number,
): FlowLayout[] {
  const culled = cullFlowsByEndpoint(flows, camera, width, height);
  const spread = spreadEndpoints(culled, camera.zoom);
  const routed = spread.map((flow) => ({
    id: flow.id,
    source: flow.source,
    target: flow.target,
    colorIndex: flow.colorIndex,
    route: routeFlow(flow.source, flow.target),
  }));
  return cullFlowsByPath(routed, camera, width, height);
}

export function pickFlows(
  flows: readonly FlowLayout[],
  x: number,
  y: number,
  radius: number,
  camera: OrthographicCamera,
  width: number,
  height: number,
): FlowLayout[] {
  return flows.filter((flow) => {
    const route = flow.route.map((point) =>
      worldToScreen(point, camera, width, height),
    );
    return route.some(
      (point, index) =>
        index > 0 &&
        pointSegmentDistance({ x, y }, route[index - 1], point) <= radius,
    );
  });
}

function spreadEndpoints(
  flows: FlowInput[],
  zoom: number,
  passes = SPREAD_PASSES,
): FlowInput[] {
  const minimumGap = ENDPOINT_GAP_PX / zoom;

  for (let pass = 0; pass < passes; pass++) {
    const endpointGroups = new Map<string, EndpointSlot[]>();
    flows.forEach((flow) => {
      addEndpoint(endpointGroups, flow.id, flow.source);
      addEndpoint(endpointGroups, flow.id, flow.target);
    });

    let moved = false;
    for (const endpoints of endpointGroups.values()) {
      if (endpoints.length <= 1) continue;

      const sorted = [...endpoints].sort(compareEndpointSlots);

      const N = sorted.length;
      for (let i = 1; i < N; i++) {
        const current = sorted[i].endpoint;
        const gap = edgeValue(sorted[i]) - edgeValue(sorted[i - 1]);
        if (gap < minimumGap) {
          setEdgeValue(current, edgeValue(sorted[i - 1]) + minimumGap);
          moved = true;
        }
      }

      const first = sorted[0];
      const last = sorted[N - 1];
      const overflow =
        edgeValue(last) -
        edgeMax(last.endpoint) +
        Math.max(0, edgeMin(first.endpoint) - edgeValue(first));
      if (overflow > 0) {
        const shift = overflow / 2;
        sorted.forEach((slot) =>
          setEdgeValue(slot.endpoint, edgeValue(slot) - shift),
        );
      }
    }
    if (!moved) break;
  }

  return flows;
}

function addEndpoint(
  endpointGroups: Map<string, EndpointSlot[]>,
  flowId: string,
  endpoint: FlowEndpoint,
): void {
  const groupKey = `${endpoint.id}:${endpoint.normal.x}:${endpoint.normal.y}`;
  const group = endpointGroups.get(groupKey);
  if (group) group.push({ flowId, endpoint });
  else endpointGroups.set(groupKey, [{ flowId, endpoint }]);
}

function compareEndpointSlots(a: EndpointSlot, b: EndpointSlot): number {
  const d = edgeValue(a) - edgeValue(b);
  return Math.abs(d) > SORT_EPS ? d : a.flowId.localeCompare(b.flowId);
}

function edgeValue(slot: EndpointSlot): number {
  const endpoint = slot.endpoint;
  return endpoint.normal.x ? endpoint.anchor.y : endpoint.anchor.x;
}

function setEdgeValue(endpoint: FlowEndpoint, value: number): void {
  const clamped = clamp(value, edgeMin(endpoint), edgeMax(endpoint));
  if (endpoint.normal.x) endpoint.anchor.y = clamped;
  else endpoint.anchor.x = clamped;
}

function edgeMin(endpoint: FlowEndpoint): number {
  return endpoint.normal.x
    ? endpoint.rect.y - endpoint.rect.h / 2
    : endpoint.rect.x - endpoint.rect.w / 2;
}

function edgeMax(endpoint: FlowEndpoint): number {
  return endpoint.normal.x
    ? endpoint.rect.y + endpoint.rect.h / 2
    : endpoint.rect.x + endpoint.rect.w / 2;
}
