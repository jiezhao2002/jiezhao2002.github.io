export type ExplorationContract = {
  id: string;
  seedTopic: string;
  domain?: string;
  style: string;
  branchWidth: number;
  ghostLeafLimit: number;
  abstractionLevel: "concrete" | "balanced" | "abstract";
  createdAt: string;
};

export type Concept = {
  conceptId: string;
  canonicalTitle: string;
  aliases: string[];
  summaryShort: string;
  domain?: string;
  embeddingText?: string;
  createdAt: string;
  updatedAt: string;
};

export type LeafAppearance = {
  leafSeed?: string;
  leafAngle?: number;
  branchSlot?: number;
};

export type TreeNode = LeafAppearance & {
  nodeId: string;
  graphId: string;
  conceptId: string;
  title: string;
  summaryShort: string;
  summaryLong?: string;
  parentNodeId: string | null;
  childNodeIds: string[];
  ghostLeafIds: string[];
  depth: number;
  pathKey: string;
  x: number;
  y: number;
  z: number;
  status: "explored" | "ghost" | "pruned" | "saved";
  createdAt: string;
};

export type GhostLeaf = LeafAppearance & {
  ghostLeafId: string;
  parentNodeId: string;
  title: string;
  rationale: string;
  summaryShort?: string;
  expansionSeed: string;
  x: number;
  y: number;
  z: number;
  breathingPhase: number;
};

export type TreeEdge = {
  edgeId: string;
  graphId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: "child";
  curveSeed: string;
  status: "active" | "ghost" | "pruned";
};

export type ReferenceEdge = {
  edgeId: string;
  graphId: string;
  fromNodeId: string;
  toNodeId: string;
  relationType: "same_concept" | "returns_to" | "related_branch" | "bridge";
  status: "visible" | "hidden" | "pruned";
};

export type TurningBrick = {
  id: string;
  fromTitle: string;
  toTitle: string;
  title: string;
  explanation: string;
  relationType: string;
};

export type BridgePath = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  turningBricks: TurningBrick[];
  score?: number;
};

export type ExpansionChild = {
  title: string;
  summaryShort: string;
  relationType: string;
};

export type ExpansionGhostLeaf = {
  title: string;
  rationale: string;
};

export type ExpansionResponse = {
  children: ExpansionChild[];
  ghostLeaves: ExpansionGhostLeaf[];
};

export type NodePacket = {
  title: string;
  summaryShort: string;
  parentTitle: string | null;
  siblingTitles: string[];
  existingChildTitles: string[];
  domain: string | null;
  disambiguation: string | null;
};

export type ExpandNodeRequest = {
  contract: ExplorationContract;
  nodePacket: NodePacket;
};

export type BridgePathRequest = {
  contract: ExplorationContract;
  sourceTitle: string;
  targetTitle: string;
  sourceSummaryShort: string;
  targetSummaryShort: string;
  maxBricks: number;
};

export type BridgePathResponse = {
  turningBricks: Omit<TurningBrick, "id">[];
};

export type KnowledgeTree = {
  graphId: string;
  rootNodeId: string;
  layoutVersion?: number;
  contract: ExplorationContract;
  concepts: Record<string, Concept>;
  nodes: Record<string, TreeNode>;
  ghostLeaves: Record<string, GhostLeaf>;
  edges: Record<string, TreeEdge>;
  referenceEdges: Record<string, ReferenceEdge>;
  bridgePaths: Record<string, BridgePath>;
};

export type SelectedLeaf =
  | { kind: "node"; id: string }
  | { kind: "ghost"; id: string };

export type LeafDetails = {
  id: string;
  kind: "node" | "ghost";
  title: string;
  summary: string;
  isGhost: boolean;
};
