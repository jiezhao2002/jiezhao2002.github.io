import { KnowledgeTree } from "../types/graph";
import { getLeafWorldOutline } from "./leafGeometry";

export type ViewState = { x: number; y: number; zoom: number };

export function getFittedView(tree: KnowledgeTree, width: number, height: number): ViewState {
  const mobile = width < 760;
  const root = tree.nodes[tree.rootNodeId];
  const leaves = [
    ...Object.values(tree.nodes).filter((node) => node.status !== "pruned"),
    ...Object.values(tree.ghostLeaves),
  ];
  if (leaves.length === 1) {
    const zoom = mobile ? 0.75 : 0.88;
    return {
      x: root.x + (width * 0.3) / zoom,
      y: root.y + (height * (mobile ? 0.03 : 0.1)) / zoom,
      zoom,
    };
  }
  const points = leaves.flatMap((leaf) => getLeafWorldOutline(
    leaf, leaf.parentNodeId ? tree.nodes[leaf.parentNodeId] ?? null : null, "nodeId" in leaf ? "node" : "ghost",
  ));
  const minX = Math.min(...points.map((p) => p.x)) - 32;
  const maxX = Math.max(...points.map((p) => p.x)) + 32;
  const minY = Math.min(...points.map((p) => p.y)) - 44;
  const maxY = Math.max(...points.map((p) => p.y)) + 44;
  const side = mobile ? 24 : 76;
  const top = mobile ? 156 : 202;
  const bottom = mobile ? 90 : 100;
  const zoom = Math.max(0.12, Math.min(0.98, (width - side * 2) / (maxX - minX), Math.max(120, height - top - bottom) / (maxY - minY)));
  return {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2 + (top - bottom) / (2 * zoom),
    zoom,
  };
}

export function projectPoint(point: { x: number; y: number }, view: ViewState, width: number, height: number) {
  return { x: width / 2 + (point.x - view.x) * view.zoom, y: height / 2 - (point.y - view.y) * view.zoom };
}
