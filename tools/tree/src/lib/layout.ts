import { TreeNode } from "../types/graph";
import { getLeafTipPosition } from "./leafGeometry";
import { seeded01, seededRange } from "./seededRandom";

export const rootPosition = { x: -560, y: -130, z: 0 };

export function assignExpansionTargets(parent: TreeNode, parentParent: TreeNode | null = null) {
  const origin = getLeafTipPosition(parent, parentParent, "node");
  const seed = `${parent.graphId}:${parent.pathKey}`;
  const incoming = parentParent ? Math.atan2(parent.y - parentParent.y, parent.x - parentParent.x) : 0.15;
  const heading = Math.max(-0.7, Math.min(0.7, incoming * 0.46 + seededRange(`${seed}:heading`, -0.35, 0.35)));
  const side = seeded01(`${seed}:side`) > 0.5 ? 1 : -1;
  const angles = [heading, heading + side * seededRange(`${seed}:fan-a`, 0.65, 1.02), heading - side * seededRange(`${seed}:fan-b`, 0.7, 1.12)];

  return angles.map((angle, slot) => {
    const length = slot === 0
      ? seededRange(`${seed}:length:${slot}`, 168, 238)
      : seededRange(`${seed}:length:${slot}`, 112, 188);
    const lean = seededRange(`${seed}:leaf-lean:${slot}`, 0.22, 0.65) * (slot === 2 ? -side : side);
    return {
      x: origin.x + Math.cos(angle) * length,
      y: origin.y + Math.sin(angle) * length,
      z: 0,
      leafAngle: angle + lean,
      branchSlot: slot,
    };
  });
}
