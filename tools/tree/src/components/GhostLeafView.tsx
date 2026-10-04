import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GhostLeaf, KnowledgeTree, TreeNode } from "../types/graph";
import { getLeafAngle, getLeafMetrics, getLeafOutline, getLeafSeed, getLeafVein, inkRadius } from "../lib/leafGeometry";
import { TubeStroke } from "./BranchCurve";

export function LeafView({ leaf, kind, selected, tree, onSelect, onHoverChange, shouldSuppressClick }: {
  leaf: TreeNode | GhostLeaf;
  kind: "node" | "ghost";
  selected: boolean;
  tree: KnowledgeTree;
  onSelect: () => void;
  onHoverChange: (isHovering: boolean) => void;
  shouldSuppressClick: () => boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const parent = leaf.parentNodeId ? tree.nodes[leaf.parentNodeId] ?? null : null;
  const angle = getLeafAngle(leaf, parent, kind);
  const seed = getLeafSeed(leaf);
  const shape = useMemo(() => {
    const metrics = getLeafMetrics(seed);
    const outline = getLeafOutline(metrics);
    const minY = Math.min(...outline.map((point) => point.y));
    const maxY = Math.max(...outline.map((point) => point.y));
    return {
      metrics, minY, maxY,
      outline: outline.map((point) => new THREE.Vector3(point.x, point.y, 0)),
      vein: getLeafVein(metrics).map((point) => new THREE.Vector3(point.x, point.y, 0.1)),
    };
  }, [seed]);
  const materials = useMemo(() => ({
    outline: new THREE.MeshBasicMaterial({ color: kind === "ghost" ? "#8a8a8a" : "#191919", transparent: true, depthWrite: false }),
    vein: new THREE.MeshBasicMaterial({ color: kind === "ghost" ? "#8a8a8a" : "#191919", transparent: true, depthWrite: false }),
  }), [kind]);
  const phase = "breathingPhase" in leaf ? leaf.breathingPhase : 0;
  const motionAllowed = useRef(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => () => {
    materials.outline.dispose();
    materials.vein.dispose();
  }, [materials]);
  useEffect(() => () => onHoverChange(false), [onHoverChange]);

  useFrame(({ clock }) => {
    const pulse = motionAllowed.current ? Math.sin(clock.elapsedTime * 0.9 + phase) * 0.025 : 0;
    const opacity = kind === "node" ? 1 : selected || hovered ? 0.74 : 0.34 + pulse;
    materials.outline.opacity = opacity;
    materials.vein.opacity = opacity * 0.72;
  });

  return (
    <group position={[leaf.x, leaf.y, 3]} rotation={[0, 0, angle]}>
      <mesh
        position={[shape.metrics.length / 2, (shape.minY + shape.maxY) / 2, 0.5]}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); onHoverChange(true); }}
        onPointerOut={() => { setHovered(false); onHoverChange(false); }}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.nativeEvent.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (!shouldSuppressClick()) onSelect();
        }}
      >
        <planeGeometry args={[shape.metrics.length + 12, Math.max(44, shape.maxY - shape.minY + 14)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <TubeStroke points={shape.outline} material={materials.outline} radius={inkRadius} closed />
      {shape.metrics.showVein && <TubeStroke points={shape.vein} material={materials.vein} radius={0.5} />}
    </group>
  );
}
