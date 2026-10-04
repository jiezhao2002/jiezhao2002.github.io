import {
  BridgePath,
  ExplorationContract,
  GhostLeaf,
  KnowledgeTree,
  ReferenceEdge,
  TreeEdge,
  TreeNode,
  BridgePathResponse,
  ExpansionResponse,
} from "../types/graph";
import { createConcept } from "./conceptIdentity";
import { assignExpansionTargets, rootPosition } from "./layout";
import { getLeafAngle, getLeafSeed } from "./leafGeometry";
import { nowIso, pickStable, seededRange, stableId } from "./seededRandom";

const childFrames = [
  "Origins",
  "Mechanism",
  "Implications",
  "Counterpoint",
  "Practical use",
  "Hidden assumption",
  "Boundary",
  "Analogy",
  "Evidence",
];

const relationWords = [
  "begins with",
  "branches toward",
  "leans on",
  "tests",
  "reframes",
  "complicates",
  "grounds",
];

export const currentLayoutVersion = 4;

export function createContract(seedTopic: string): ExplorationContract {
  return {
    id: stableId("contract", seedTopic),
    seedTopic,
    style: "minimal-hand-drawn",
    branchWidth: 3,
    ghostLeafLimit: 2,
    abstractionLevel: "balanced",
    createdAt: nowIso(),
  };
}

export function createInitialTree(seedTopic: string): KnowledgeTree {
  const cleanSeed = seedTopic.trim() || "Tree";
  const contract = createContract(cleanSeed);
  const graphId = stableId("graph", cleanSeed);
  const createdAt = nowIso();
  const concept = createConcept(cleanSeed, `The root idea for this tree: ${cleanSeed}.`, createdAt);
  const rootNode: TreeNode = {
    nodeId: stableId("node", `${graphId}:root`),
    graphId,
    conceptId: concept.conceptId,
    title: cleanSeed,
    summaryShort: `The root idea for this tree: ${cleanSeed}.`,
    summaryLong: `This is the starting leaf. Branching on it opens a small set of concrete routes and quieter shadow directions.`,
    parentNodeId: null,
    childNodeIds: [],
    ghostLeafIds: [],
    depth: 0,
    pathKey: "0",
    leafSeed: `${graphId}:0`,
    leafAngle: Math.PI * 0.42,
    x: rootPosition.x,
    y: rootPosition.y,
    z: rootPosition.z,
    status: "explored",
    createdAt,
  };

  const tree: KnowledgeTree = {
    graphId,
    rootNodeId: rootNode.nodeId,
    layoutVersion: currentLayoutVersion,
    contract,
    concepts: { [concept.conceptId]: concept },
    nodes: { [rootNode.nodeId]: rootNode },
    ghostLeaves: {},
    edges: {},
    referenceEdges: {},
    bridgePaths: {},
  };

  return tree;
}

export function reflowTreeLayout(tree: KnowledgeTree): KnowledgeTree {
  if (tree.layoutVersion === currentLayoutVersion) return tree;
  const nextTree = cloneTree(tree);
  const root = nextTree.nodes[nextTree.rootNodeId];

  if (!root) {
    return nextTree;
  }

  nextTree.layoutVersion = currentLayoutVersion;
  nextTree.nodes[root.nodeId] = {
    ...root,
    leafSeed: root.leafSeed ?? `${tree.graphId}:0`,
    leafAngle: Math.PI * 0.42,
    x: rootPosition.x,
    y: rootPosition.y,
    z: rootPosition.z,
  };

  const queue = [root.nodeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const parentId = queue.shift()!;

    if (visited.has(parentId)) {
      continue;
    }

    visited.add(parentId);
    const parent = nextTree.nodes[parentId];

    if (!parent || parent.status === "pruned") {
      continue;
    }

    const parentParent = parent.parentNodeId ? nextTree.nodes[parent.parentNodeId] ?? null : null;
    const targets = assignExpansionTargets(parent, parentParent);
    const usedSlots = new Set<number>();

    parent.childNodeIds.forEach((childId) => {
      const child = nextTree.nodes[childId];

      if (!child || child.status === "pruned") {
        return;
      }

      const incoming = Object.values(nextTree.edges).find((edge) => edge.toNodeId === childId);
      const pathSlot = child.pathKey.split(".").pop() ?? "0";
      const promoted = pathSlot.startsWith("m");
      const inferredSlot = promoted ? Number(incoming?.curveSeed.split(":").pop()) + 1 : Number(pathSlot);
      const slot = availableBranchSlot(child.branchSlot ?? inferredSlot, usedSlots);
      const target = targets[slot];
      nextTree.nodes[childId] = {
        ...child, ...target,
        leafSeed: child.leafSeed ?? (promoted ? incoming?.curveSeed : undefined) ?? `${tree.graphId}:${child.pathKey}`,
      };
      usedSlots.add(slot);
      queue.push(childId);
    });

    parent.ghostLeafIds.forEach((ghostId) => {
      const ghost = nextTree.ghostLeaves[ghostId];

      if (!ghost) {
        return;
      }

      const inferredSlot = Number(ghost.expansionSeed.split(":").pop()) + 1;
      const slot = availableBranchSlot(ghost.branchSlot ?? inferredSlot, usedSlots);
      const target = targets[slot];
      nextTree.ghostLeaves[ghostId] = { ...ghost, ...target, leafSeed: getLeafSeed(ghost) };
      usedSlots.add(slot);
    });
  }

  return nextTree;
}

function availableBranchSlot(preferred: number, used: Set<number>): number {
  if (Number.isInteger(preferred) && preferred >= 0 && preferred <= 2 && !used.has(preferred)) return preferred;
  return [0, 1, 2].find((slot) => !used.has(slot)) ?? 2;
}

export function createLocalExpansion(tree: KnowledgeTree, nodeId: string): ExpansionResponse {
  const parent = tree.nodes[nodeId];

  if (!parent) {
    return { children: [], ghostLeaves: [] };
  }

  return {
    children: Array.from({ length: tree.contract.branchWidth }, (_, index) => {
      const title = makeChildTitle(parent, index);
      return {
        title,
        summaryShort: makeSummary(parent.title, title, index),
        relationType: pickStable(relationWords, `${parent.pathKey}:relation:${index}`),
      };
    }),
    ghostLeaves: [],
  };
}

export function integrateExpansion(tree: KnowledgeTree, nodeId: string, expansion: ExpansionResponse): KnowledgeTree {
  const parent = tree.nodes[nodeId];

  if (!parent || parent.status === "pruned") {
    return tree;
  }

  if (parent.childNodeIds.length > 0 || parent.ghostLeafIds.length > 0) {
    return tree;
  }

  const createdAt = nowIso();
  const parentParent = parent.parentNodeId ? tree.nodes[parent.parentNodeId] ?? null : null;
  const targets = assignExpansionTargets(parent, parentParent);
  const nextTree = cloneTree(tree);
  nextTree.layoutVersion = currentLayoutVersion;
  const nextParent = { ...parent, childNodeIds: [...parent.childNodeIds], ghostLeafIds: [...parent.ghostLeafIds] };
  const candidates = expansion.children.slice(0, tree.contract.branchWidth);
  const chosenChildren = candidates.slice(0, 1);
  const shadowChildren = candidates.slice(1, tree.contract.branchWidth);

  for (let index = 0; index < chosenChildren.length; index += 1) {
    const target = targets[index];
    const childPacket = chosenChildren[index];
    const title = childPacket.title;
    const summary = childPacket.summaryShort;
    const concept = createConcept(title, summary, createdAt);
    const child: TreeNode = {
      nodeId: stableId("node", `${parent.pathKey}:${index}:${title}`),
      graphId: tree.graphId,
      conceptId: concept.conceptId,
      title,
      summaryShort: summary,
      summaryLong: `${title} ${pickStable(relationWords, title)} ${parent.title}. It gives this branch a specific reason to keep growing instead of becoming a general map.`,
      parentNodeId: parent.nodeId,
      childNodeIds: [],
      ghostLeafIds: [],
      depth: parent.depth + 1,
      pathKey: `${parent.pathKey}.${index}`,
      leafSeed: `${tree.graphId}:${parent.pathKey}.${index}`,
      leafAngle: target.leafAngle,
      branchSlot: index,
      x: target.x,
      y: target.y,
      z: target.z,
      status: "explored",
      createdAt,
    };
    const edge = makeEdge(tree.graphId, parent.nodeId, child.nodeId, child.pathKey, "active");

    nextTree.concepts[concept.conceptId] = concept;
    nextTree.nodes[child.nodeId] = child;
    nextTree.edges[edge.edgeId] = edge;
    nextParent.childNodeIds.push(child.nodeId);
  }

  for (let index = 0; index < shadowChildren.length; index += 1) {
    const target = targets[index + 1];
    const childPacket = shadowChildren[index];
    const title = childPacket.title;
    const ghost: GhostLeaf = {
      ghostLeafId: stableId("ghost", `${parent.pathKey}:ghost:${index}:${title}`),
      parentNodeId: parent.nodeId,
      title,
      summaryShort: childPacket.summaryShort,
      rationale: `${childPacket.summaryShort} This was one of the three leaves behind ${parent.title}, but it was not the chosen branch.`,
      expansionSeed: `${parent.title}:${title}:${index}`,
      leafSeed: `${tree.graphId}:${parent.pathKey}.${index + 1}`,
      leafAngle: target.leafAngle,
      branchSlot: index + 1,
      x: target.x,
      y: target.y,
      z: target.z,
      breathingPhase: seededRange(`${parent.pathKey}:phase:${index}`, 0, Math.PI * 2),
    };
    const edge = makeEdge(tree.graphId, parent.nodeId, ghost.ghostLeafId, ghost.expansionSeed, "ghost");

    nextTree.ghostLeaves[ghost.ghostLeafId] = ghost;
    nextTree.edges[edge.edgeId] = edge;
    nextParent.ghostLeafIds.push(ghost.ghostLeafId);
  }

  nextTree.nodes[parent.nodeId] = nextParent;
  return nextTree;
}

export function expandNodeLocally(tree: KnowledgeTree, nodeId: string): KnowledgeTree {
  return integrateExpansion(tree, nodeId, createLocalExpansion(tree, nodeId));
}

export function materializeGhost(tree: KnowledgeTree, ghostLeafId: string): { tree: KnowledgeTree; nodeId: string } {
  const ghost = tree.ghostLeaves[ghostLeafId];

  if (!ghost) {
    return { tree, nodeId: "" };
  }

  const parent = tree.nodes[ghost.parentNodeId];

  if (!parent) {
    return { tree, nodeId: "" };
  }

  const createdAt = nowIso();
  const summary = ghost.summaryShort ?? ghost.rationale;
  const concept = createConcept(ghost.title, summary, createdAt);
  const nodeId = stableId("node", `${parent.pathKey}:materialized:${ghostLeafId}`);
  const node: TreeNode = {
    nodeId,
    graphId: tree.graphId,
    conceptId: concept.conceptId,
    title: ghost.title,
    summaryShort: summary,
    summaryLong: ghost.rationale,
    parentNodeId: parent.nodeId,
    childNodeIds: [],
    ghostLeafIds: [],
    depth: parent.depth + 1,
    pathKey: `${parent.pathKey}.m${parent.childNodeIds.length}`,
    leafSeed: getLeafSeed(ghost),
    leafAngle: getLeafAngle(ghost, parent, "ghost"),
    branchSlot: ghost.branchSlot ?? Number(ghost.expansionSeed.split(":").pop()) + 1,
    x: ghost.x,
    y: ghost.y,
    z: ghost.z,
    status: "explored",
    createdAt,
  };

  const nextTree = cloneTree(tree);
  const nextParent = {
    ...parent,
    childNodeIds: [...parent.childNodeIds, nodeId],
    ghostLeafIds: parent.ghostLeafIds.filter((id) => id !== ghostLeafId),
  };

  delete nextTree.ghostLeaves[ghostLeafId];
  Object.values(nextTree.edges).forEach((edge) => {
    if (edge.toNodeId === ghostLeafId) {
      edge.toNodeId = nodeId;
      edge.status = "active";
    }
  });
  nextTree.concepts[concept.conceptId] = concept;
  nextTree.nodes[parent.nodeId] = nextParent;
  nextTree.nodes[nodeId] = node;

  return { tree: nextTree, nodeId };
}

export function resolveLeaf(
  tree: KnowledgeTree,
  selected: { kind: "node"; id: string } | { kind: "ghost"; id: string } | null,
) {
  if (!selected) {
    return null;
  }

  if (selected.kind === "node") {
    const node = tree.nodes[selected.id];

    if (!node) {
      return null;
    }

    return {
      id: node.nodeId,
      kind: "node" as const,
      title: node.title,
      summary: node.summaryShort,
      isGhost: false,
    };
  }

  const ghost = tree.ghostLeaves[selected.id];

  if (!ghost) {
    return null;
  }

  return {
    id: ghost.ghostLeafId,
    kind: "ghost" as const,
    title: ghost.title,
    summary: ghost.summaryShort ?? ghost.rationale,
    isGhost: true,
  };
}

export function buildNodePacket(tree: KnowledgeTree, nodeId: string) {
  const node = tree.nodes[nodeId];
  const parent = node?.parentNodeId ? tree.nodes[node.parentNodeId] : null;
  const siblingTitles = parent
    ? parent.childNodeIds
        .filter((siblingId) => siblingId !== nodeId)
        .map((siblingId) => tree.nodes[siblingId]?.title)
        .filter(Boolean)
    : [];

  return {
    title: node.title,
    summaryShort: node.summaryShort,
    parentTitle: parent?.title ?? null,
    siblingTitles,
    existingChildTitles: node.childNodeIds.map((childId) => tree.nodes[childId]?.title).filter(Boolean),
    domain: tree.contract.domain ?? null,
    disambiguation: null,
  };
}

export function pruneSubtree(tree: KnowledgeTree, nodeId: string): KnowledgeTree {
  const node = tree.nodes[nodeId];

  if (!node || node.nodeId === tree.rootNodeId) {
    return tree;
  }

  const nextTree = cloneTree(tree);
  const stack = [nodeId];

  while (stack.length > 0) {
    const currentId = stack.pop()!;
    const current = nextTree.nodes[currentId];

    if (!current) {
      continue;
    }

    current.status = "pruned";
    stack.push(...current.childNodeIds);
    current.ghostLeafIds.forEach((ghostId) => {
      delete nextTree.ghostLeaves[ghostId];
    });
    current.ghostLeafIds = [];
  }

  Object.values(nextTree.edges).forEach((edge) => {
    if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId || nextTree.nodes[edge.fromNodeId]?.status === "pruned") {
      edge.status = "pruned";
    }
  });
  Object.values(nextTree.referenceEdges).forEach((edge) => {
    if (nextTree.nodes[edge.fromNodeId]?.status === "pruned" || nextTree.nodes[edge.toNodeId]?.status === "pruned") {
      edge.status = "pruned";
    }
  });

  return nextTree;
}

export function markNodeSaved(tree: KnowledgeTree, nodeId: string): KnowledgeTree {
  const node = tree.nodes[nodeId];

  if (!node) {
    return tree;
  }

  return {
    ...tree,
    nodes: {
      ...tree.nodes,
      [nodeId]: {
        ...node,
        status: "saved",
      },
    },
  };
}

export function addBridgePath(
  tree: KnowledgeTree,
  sourceNodeId: string,
  targetNodeId: string,
  response: BridgePathResponse,
): KnowledgeTree {
  const source = tree.nodes[sourceNodeId];
  const target = tree.nodes[targetNodeId];

  if (!source || !target || sourceNodeId === targetNodeId) {
    return tree;
  }

  const bridgeId = stableId("bridge", `${sourceNodeId}:${targetNodeId}:${response.turningBricks.length}`);
  const edgeId = stableId("ref", `${sourceNodeId}:${targetNodeId}:bridge`);
  const bridgePath: BridgePath = {
    id: bridgeId,
    sourceNodeId,
    targetNodeId,
    turningBricks: response.turningBricks.map((brick, index) => ({
      ...brick,
      id: stableId("brick", `${bridgeId}:${index}:${brick.title}`),
    })),
  };
  const referenceEdge: ReferenceEdge = {
    edgeId,
    graphId: tree.graphId,
    fromNodeId: sourceNodeId,
    toNodeId: targetNodeId,
    relationType: "bridge",
    status: "visible",
  };

  return {
    ...tree,
    referenceEdges: {
      ...tree.referenceEdges,
      [referenceEdge.edgeId]: referenceEdge,
    },
    bridgePaths: {
      ...tree.bridgePaths,
      [bridgePath.id]: bridgePath,
    },
  };
}

function makeChildTitle(parent: TreeNode, index: number): string {
  const frame = childFrames[(parent.depth * 3 + index) % childFrames.length];

  if (parent.depth === 0) {
    return `${frame} of ${parent.title}`;
  }

  const relation = pickStable(childFrames, `${parent.pathKey}:${index}`, index + 2).toLowerCase();
  return `${frame}: ${relation}`;
}

function makeSummary(parentTitle: string, title: string, index: number): string {
  const verb = relationWords[index % relationWords.length];
  return `${title} ${verb} ${parentTitle}, giving this path a focused next step.`;
}

function makeEdge(
  graphId: string,
  fromNodeId: string,
  toNodeId: string,
  curveSeed: string,
  status: "active" | "ghost" | "pruned",
): TreeEdge {
  return {
    edgeId: stableId("edge", `${fromNodeId}:${toNodeId}`),
    graphId,
    fromNodeId,
    toNodeId,
    relationType: "child",
    curveSeed,
    status,
  };
}

function cloneTree(tree: KnowledgeTree): KnowledgeTree {
  return {
    ...tree,
    concepts: { ...tree.concepts },
    nodes: Object.fromEntries(Object.entries(tree.nodes).map(([key, node]) => [key, { ...node }])),
    ghostLeaves: Object.fromEntries(Object.entries(tree.ghostLeaves).map(([key, ghost]) => [key, { ...ghost }])),
    edges: Object.fromEntries(Object.entries(tree.edges).map(([key, edge]) => [key, { ...edge }])),
    referenceEdges: { ...tree.referenceEdges },
    bridgePaths: { ...tree.bridgePaths },
  };
}
