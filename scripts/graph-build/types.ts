import type { GraphBodyPart, GraphNode } from "../../src/graph/graphTypes";

export type NoteDraft = Omit<
  GraphNode,
  "hasBody" | "hasCode" | "searchText"
> & {
  file: string;
  rawBody: string;
  body: GraphBodyPart[];
  bodyHtml: string;
  codeHtml: string;
  hasBody: boolean;
  hasCode: boolean;
  searchText: string;
};
