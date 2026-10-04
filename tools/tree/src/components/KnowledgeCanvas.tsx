import { Canvas, useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { KnowledgeTree, SelectedLeaf } from "../types/graph";
import { BranchCurve, MainStem, ReferenceCurve } from "./BranchCurve";
import { LeafView } from "./GhostLeafView";
import { ViewState } from "../lib/viewport";
export type { ViewState } from "../lib/viewport";

export function KnowledgeCanvas({
  tree,
  selectedLeaf,
  view,
  onSelectLeaf,
  onLeafHoverChange,
  shouldSuppressLeafClick,
}: {
  tree: KnowledgeTree;
  selectedLeaf: SelectedLeaf | null;
  view: ViewState;
  onSelectLeaf: (leaf: SelectedLeaf) => void;
  onLeafHoverChange: (isHovering: boolean) => void;
  shouldSuppressLeafClick: () => boolean;
}) {
  return (
    <Canvas
      className="tree-canvas"
      orthographic
      camera={{ position: [0, 0, 100], zoom: view.zoom, near: 0.1, far: 1000 }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      <CameraRig view={view} />
      <color attach="background" args={["#ffffff"]} />
      <TreeScene
        tree={tree}
        selectedLeaf={selectedLeaf}
        onSelectLeaf={onSelectLeaf}
        onLeafHoverChange={onLeafHoverChange}
        shouldSuppressLeafClick={shouldSuppressLeafClick}
      />
    </Canvas>
  );
}

function CameraRig({ view }: { view: ViewState }) {
  const { camera } = useThree();

  useLayoutEffect(() => {
    camera.position.set(view.x, view.y, 100);
    if ("zoom" in camera) {
      camera.zoom = view.zoom;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }, [camera, view]);

  return null;
}

function TreeScene({
  tree,
  selectedLeaf,
  onSelectLeaf,
  onLeafHoverChange,
  shouldSuppressLeafClick,
}: {
  tree: KnowledgeTree;
  selectedLeaf: SelectedLeaf | null;
  onSelectLeaf: (leaf: SelectedLeaf) => void;
  onLeafHoverChange: (isHovering: boolean) => void;
  shouldSuppressLeafClick: () => boolean;
}) {
  const edges = Object.values(tree.edges);
  const referenceEdges = Object.values(tree.referenceEdges);
  const nodes = Object.values(tree.nodes).filter((node) => node.status !== "pruned");
  const ghosts = Object.values(tree.ghostLeaves);
  const ghostEdges = edges.filter((edge) => edge.status === "ghost");
  const activeEdges = edges.filter((edge) => edge.status !== "ghost");
  const root = tree.nodes[tree.rootNodeId];

  return (
    <group>
      <MainStem root={root} />
      {ghostEdges.map((edge) => (
        <BranchCurve key={edge.edgeId} edge={edge} tree={tree} />
      ))}
      {activeEdges.map((edge) => (
        <BranchCurve key={edge.edgeId} edge={edge} tree={tree} />
      ))}
      {referenceEdges.map((edge) => (
        <ReferenceCurve key={edge.edgeId} edge={edge} tree={tree} />
      ))}
      {ghosts.map((ghost) => (
        <LeafView
          key={ghost.ghostLeafId}
          leaf={ghost}
          kind="ghost"
          selected={selectedLeaf?.kind === "ghost" && selectedLeaf.id === ghost.ghostLeafId}
          tree={tree}
          onSelect={() => onSelectLeaf({ kind: "ghost", id: ghost.ghostLeafId })}
          onHoverChange={onLeafHoverChange}
          shouldSuppressClick={shouldSuppressLeafClick}
        />
      ))}
      {nodes.map((node) => (
        <LeafView
          key={node.nodeId}
          leaf={node}
          kind="node"
          selected={selectedLeaf?.kind === "node" && selectedLeaf.id === node.nodeId}
          tree={tree}
          onSelect={() => onSelectLeaf({ kind: "node", id: node.nodeId })}
          onHoverChange={onLeafHoverChange}
          shouldSuppressClick={shouldSuppressLeafClick}
        />
      ))}
    </group>
  );
}
