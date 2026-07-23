import type { GraphBodyPart, GraphNode } from "../../src/graph/graphTypes";

export type NoteDraft = Omit<GraphNode, "hasBody" | "searchText"> & {
  file: string;
  rawBody: string;
  body: GraphBodyPart[];
  bodyHtml: string;
  hasBody: boolean;
  searchText: string;
};
