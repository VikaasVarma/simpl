export enum GraphTag {
  Hidden = "hidden",
  Me = "me",
  Published = "published",
  Region = "region",
  RegionHeader = "region-header",
}

export type GraphNodeTag = {
  tag: `${GraphTag}`;
  body: string;
};

export type GraphBodyPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "connection";
      groupId: string;
      text: string;
    }
  | {
      type: "code";
      language: string;
      text: string;
    }
  | {
      type: "math";
      tex: string;
      display: boolean;
    }
  | {
      type: "viz";
      name: string;
      text: string;
    };

export type GraphNode = {
  id: string;
  title: string;
  summary: string;
  date: string;
  link: string;
  hasBody: boolean;
  searchText: string;
  tags: readonly GraphNodeTag[];
  connections: readonly GraphConnectionGroup[];
};

export type GraphLink = {
  id: string;
  source: number;
  target: number;
  colorIndex: number;
};

export type GraphData = {
  nodes: readonly GraphNode[];
  links: readonly GraphLink[];
};

export type GraphConnectionGroup = {
  id: string;
  text: string;
  connections: readonly GraphConnection[];
};

export type GraphConnection = {
  target: string;
  title: string;
  label: string;
  labelHtml: string;
  href: string;
  icon?: string;
  suppressLine: boolean;
  colorIndex: number;
};
