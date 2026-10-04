import { GhostLeaf, TreeNode } from "../types/graph";
import { seeded01, seededRange } from "./seededRandom";

export type LeafKind = "node" | "ghost";
export type Point2 = { x: number; y: number };
export type LeafMetrics = {
  length: number;
  width: number;
  bend: number;
  tipLift: number;
  shoulder: number;
  asymmetry: number;
  showVein: boolean;
  veinLength: number;
};

export const inkRadius = 0.95;

export function getLeafSeed(leaf: TreeNode | GhostLeaf): string {
  return leaf.leafSeed ?? ("nodeId" in leaf ? leaf.pathKey : leaf.expansionSeed);
}

export function getLeafMetrics(seed: string): LeafMetrics {
  const family = seeded01(`${seed}:profile`);
  const length = seededRange(`${seed}:length`, family < 0.3 ? 58 : 84, family < 0.3 ? 82 : 136);
  const curved = family > 0.62;

  return {
    length,
    width: length * seededRange(`${seed}:width`, family < 0.3 ? 0.26 : 0.18, family < 0.3 ? 0.38 : 0.3),
    bend: seededRange(`${seed}:bend`, curved ? -0.26 : -0.045, curved ? 0.26 : 0.045) * length,
    tipLift: seededRange(`${seed}:tip`, curved ? -0.28 : -0.06, curved ? 0.28 : 0.06) * length,
    shoulder: seededRange(`${seed}:shoulder`, 0.48, 0.76),
    asymmetry: seededRange(`${seed}:asymmetry`, 0.66, 1.04),
    showVein: seeded01(`${seed}:vein`) > 0.43,
    veinLength: seededRange(`${seed}:vein-length`, 0.55, 0.87),
  };
}

function cubic(t: number, a: Point2, b: Point2, c: Point2, d: Point2): Point2 {
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  };
}

function leafSide(t: number, m: LeafMetrics, upper: boolean): Point2 {
  const sign = upper ? 1 : -m.asymmetry;
  return cubic(
    t,
    { x: 0, y: 0 },
    { x: m.length * (upper ? 0.16 : 0.28), y: m.bend + m.width * sign * 1.25 },
    { x: m.length * m.shoulder, y: m.bend + m.tipLift * 0.65 + m.width * sign * 1.48 },
    { x: m.length, y: m.tipLift },
  );
}

export function getLeafOutline(metrics: LeafMetrics): Point2[] {
  const points: Point2[] = [];
  const segments = 32;
  for (let i = 0; i <= segments; i += 1) points.push(leafSide(i / segments, metrics, true));
  for (let i = segments - 1; i > 0; i -= 1) points.push(leafSide(i / segments, metrics, false));
  return points;
}

function midrib(t: number, metrics: LeafMetrics): Point2 {
  const upper = leafSide(t, metrics, true);
  const lower = leafSide(t, metrics, false);
  return { x: (upper.x + lower.x) / 2, y: (upper.y + lower.y) / 2 };
}

export function getLeafVein(metrics: LeafMetrics): Point2[] {
  return Array.from({ length: 25 }, (_, index) => midrib(0.07 + (index / 24) * (metrics.veinLength - 0.07), metrics));
}

export function getLeafAngle(leaf: TreeNode | GhostLeaf, parent: TreeNode | null, _kind: LeafKind): number {
  if (leaf.leafAngle !== undefined) return leaf.leafAngle;
  if (!parent) return Math.PI * 0.42;

  const seed = getLeafSeed(leaf);
  const side = seeded01(`${seed}:side`) > 0.5 ? 1 : -1;
  return Math.atan2(leaf.y - parent.y, leaf.x - parent.x) + side * seededRange(`${seed}:lean`, 0.2, 0.7);
}

export function getLeafPose(leaf: TreeNode | GhostLeaf, parent: TreeNode | null, kind: LeafKind, tip: boolean) {
  const metrics = getLeafMetrics(getLeafSeed(leaf));
  const angle = getLeafAngle(leaf, parent, kind);
  const point = midrib(tip ? 1 : 0, metrics);
  const near = midrib(tip ? 0.98 : 0.02, metrics);
  const direction = tip ? { x: point.x - near.x, y: point.y - near.y } : { x: near.x - point.x, y: near.y - point.y };
  const length = Math.hypot(direction.x, direction.y);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: leaf.x + point.x * cos - point.y * sin,
    y: leaf.y + point.x * sin + point.y * cos,
    z: leaf.z,
    dx: (direction.x * cos - direction.y * sin) / length,
    dy: (direction.x * sin + direction.y * cos) / length,
  };
}

export function getLeafTipPosition(leaf: TreeNode | GhostLeaf, parent: TreeNode | null, kind: LeafKind) {
  return getLeafPose(leaf, parent, kind, true);
}

export function getLeafWorldOutline(leaf: TreeNode | GhostLeaf, parent: TreeNode | null, kind: LeafKind): Point2[] {
  const angle = getLeafAngle(leaf, parent, kind);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return getLeafOutline(getLeafMetrics(getLeafSeed(leaf))).map((point) => ({
    x: leaf.x + point.x * cos - point.y * sin,
    y: leaf.y + point.x * sin + point.y * cos,
  }));
}
