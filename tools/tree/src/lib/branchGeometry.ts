import * as THREE from "three";
import { GhostLeaf, TreeNode } from "../types/graph";
import { getLeafMetrics, getLeafPose, getLeafSeed, getLeafWorldOutline, Point2 } from "./leafGeometry";
import { seededRange } from "./seededRandom";

export function getBranchPoints(from: TreeNode, fromParent: TreeNode | null, to: TreeNode | GhostLeaf, seed: string) {
  const tip = getLeafPose(from, fromParent, "node", true);
  const base = getLeafPose(to, from, "nodeId" in to ? "node" : "ghost", false);
  const start = new THREE.Vector3(tip.x, tip.y, 0);
  const end = new THREE.Vector3(base.x, base.y, 0);
  const distance = start.distanceTo(end);
  const departure = Math.min(46, distance * 0.24);
  const arrival = Math.min(68, distance * 0.32);
  const controlA = start.clone().add(new THREE.Vector3(tip.dx, tip.dy, 0).multiplyScalar(departure));
  const controlB = end.clone().sub(new THREE.Vector3(base.dx, base.dy, 0).multiplyScalar(arrival));
  const normal = new THREE.Vector3(-(end.y - start.y), end.x - start.x, 0).normalize();
  const bend = seededRange(`${seed}:bend`, -16, 16);
  controlB.addScaledVector(normal, bend);

  const outline = getLeafWorldOutline(from, fromParent, "node");
  let points = new THREE.CubicBezierCurve3(start, controlA, controlB, end).getPoints(64);
  const side = new THREE.Vector3(-tip.dy, tip.dx, 0);
  if (side.dot(end.clone().sub(start)) < 0) side.negate();
  const width = getLeafMetrics(getLeafSeed(from)).width;

  // Backward-facing candidates need room around the tip, not through the blade.
  for (let attempt = 1; attempt <= 6 && points.slice(1).some((point) => insideLeaf(point, outline)); attempt += 1) {
    const clearA = start.clone().addScaledVector(new THREE.Vector3(tip.dx, tip.dy, 0), departure + attempt * 28);
    const clearB = controlB.clone().addScaledVector(side, width * attempt * 1.5);
    points = new THREE.CubicBezierCurve3(start, clearA, clearB, end).getPoints(64);
  }
  return points;
}

function insideLeaf(point: Point2, outline: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
