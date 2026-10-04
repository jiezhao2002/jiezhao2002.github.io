import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { KnowledgeTree, ReferenceEdge, TreeEdge, TreeNode } from "../types/graph";
import { getBranchPoints } from "../lib/branchGeometry";
import { inkRadius } from "../lib/leafGeometry";

export function MainStem({ root }: { root: TreeNode }) {
  const points = useMemo(() => new THREE.CubicBezierCurve3(
    new THREE.Vector3(root.x - 760, root.y - 10, 0),
    new THREE.Vector3(root.x - 600, root.y + 72, 0),
    new THREE.Vector3(root.x - 260, root.y - 28, 0),
    new THREE.Vector3(root.x, root.y, 0),
  ).getPoints(64), [root.x, root.y]);
  return <StrokeLine points={points} color="#191919" opacity={1} />;
}

export function BranchCurve({ edge, tree }: { edge: TreeEdge; tree: KnowledgeTree }) {
  const from = tree.nodes[edge.fromNodeId];
  const to = tree.nodes[edge.toNodeId] ?? tree.ghostLeaves[edge.toNodeId];
  const parent = from?.parentNodeId ? tree.nodes[from.parentNodeId] ?? null : null;
  const points = useMemo(() => from && to ? getBranchPoints(from, parent, to, edge.curveSeed) : [], [from, parent, to, edge.curveSeed]);
  if (!from || !to || edge.status === "pruned" || from.status === "pruned") return null;
  const shadow = edge.status === "ghost";
  return <StrokeLine points={points} color={shadow ? "#8a8a8a" : "#191919"} opacity={shadow ? 0.28 : 1} radius={shadow ? 0.8 : inkRadius} />;
}

export function ReferenceCurve({ edge, tree }: { edge: ReferenceEdge; tree: KnowledgeTree }) {
  const from = tree.nodes[edge.fromNodeId];
  const to = tree.nodes[edge.toNodeId];
  const parent = from?.parentNodeId ? tree.nodes[from.parentNodeId] ?? null : null;
  const points = useMemo(() => from && to ? getBranchPoints(from, parent, to, edge.edgeId) : [], [from, parent, to, edge.edgeId]);
  if (!from || !to || edge.status !== "visible") return null;
  return <StrokeLine points={points} color="#8c8c8c" opacity={0.23} radius={0.65} />;
}

export function StrokeLine({ points, color, opacity, radius = inkRadius }: {
  points: THREE.Vector3[];
  color: string;
  opacity: number;
  radius?: number;
}) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }), [color, opacity]);
  useEffect(() => () => material.dispose(), [material]);
  return <TubeStroke points={points} material={material} radius={radius} />;
}

export function TubeStroke({ points, material, radius, closed = false }: {
  points: THREE.Vector3[];
  material: THREE.MeshBasicMaterial;
  radius: number;
  closed?: boolean;
}) {
  const geometry = useMemo(() => {
    if (points.length < 2) return new THREE.BufferGeometry();
    return new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, closed, "centripetal"),
      Math.max(24, points.length * 2), radius, 6, closed,
    );
  }, [closed, points, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (points.length < 2) return null;
  return <mesh geometry={geometry} material={material} />;
}
