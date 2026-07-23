import { graphData as productionGraphData } from "../../generated/graph/data";
import type { GraphData } from "./graphTypes";

export type GraphMode = "official" | "unofficial";

export function graphMode(): GraphMode {
  if (!import.meta.env.DEV || import.meta.env.VITE_DEBUG !== "1")
    return "official";
  return new URLSearchParams(location.search).get("graph") === "unofficial"
    ? "unofficial"
    : "official";
}

export async function currentGraphData(): Promise<GraphData> {
  if (!import.meta.env.DEV) return productionGraphData;
  return graphMode() === "official"
    ? (await import("../../generated/graph/published/data")).graphData
    : (await import("../../generated/graph/unofficial/data")).graphData;
}
