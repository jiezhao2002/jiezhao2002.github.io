import { LocateFixed, Minus, Plus } from "lucide-react";
import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { BridgeModePanel } from "./components/BridgeModePanel";
import { KnowledgeCanvas } from "./components/KnowledgeCanvas";
import { NodeInspector } from "./components/NodeInspector";
import { SiteBack, TreeMark } from "./components/NodeLabel";
import { SeedInput } from "./components/SeedInput";
import { createBridgePathFromBackend, expandNodeFromBackend } from "./lib/apiClient";
import {
  addBridgePath,
  createInitialTree,
  currentLayoutVersion,
  integrateExpansion,
  markNodeSaved,
  materializeGhost,
  pruneSubtree,
  reflowTreeLayout,
  resolveLeaf,
} from "./lib/graphOps";
import { clearStoredTree, loadStoredTree, saveStoredTree } from "./lib/storage";
import { getLeafWorldOutline } from "./lib/leafGeometry";
import { getFittedView, projectPoint, ViewState } from "./lib/viewport";
import { KnowledgeTree, SelectedLeaf } from "./types/graph";

type DragState = {
  pointerId: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  moved: boolean;
} | null;

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [seed, setSeed] = useState("");
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  const [selectedLeaf, setSelectedLeaf] = useState<SelectedLeaf | null>(null);
  const [view, setView] = useState<ViewState>(() => getInitialView());
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [isBranching, setIsBranching] = useState(false);
  const [isBridging, setIsBridging] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [leafHovered, setLeafHovered] = useState(false);
  const [bridgeMode, setBridgeMode] = useState(false);
  const [bridgeSourceId, setBridgeSourceId] = useState<string | null>(null);
  const [bridgeTargetId, setBridgeTargetId] = useState<string | null>(null);
  const [latestBridgeId, setLatestBridgeId] = useState<string | null>(null);
  const dragRef = useRef<DragState>(null);
  const screenRef = useRef<HTMLElement>(null);
  const branchPendingRef = useRef(false);
  const bridgePendingRef = useRef(false);
  const suppressLeafClickRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      const params = new URLSearchParams(window.location.search);

      if (params.has("fresh")) {
        await clearStoredTree();
        window.history.replaceState(null, "", window.location.pathname);
      }

      const storedTree = await loadStoredTree();
      const displayTree = storedTree ? reflowTreeLayout(storedTree) : null;

      if (!isMounted) {
        return;
      }

      setTree(displayTree);
      if (displayTree) setView(getFittedView(displayTree, window.innerWidth, window.innerHeight));
      setSelectedLeaf(
        displayTree && Object.keys(displayTree.nodes).length === 1 ? { kind: "node", id: displayTree.rootNodeId } : null,
      );
      setHydrated(true);
    }

    hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (tree) {
      saveStoredTree(tree);
    }
  }, [tree]);

  useEffect(() => {
    function resize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedLeaf(null);
        setBridgeMode(false);
      }
    }
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  useEffect(() => {
    if (tree) setView(getFittedView(tree, viewport.width, viewport.height));
  }, [viewport]);

  useEffect(() => {
    const screen = screenRef.current;
    if (!screen || !tree) return;
    function wheel(event: WheelEvent) {
      if ((event.target as HTMLElement).closest(".leaf-card, .bridge-panel, .zoom-controls")) return;
      event.preventDefault();
      const rect = screen!.getBoundingClientRect();
      const px = event.clientX - rect.left - rect.width / 2;
      const py = rect.height / 2 - (event.clientY - rect.top);
      setView((current) => {
        const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.002), 0.12, 2.2);
        return { x: current.x + px / current.zoom - px / zoom, y: current.y + py / current.zoom - py / zoom, zoom };
      });
    }
    screen.addEventListener("wheel", wheel, { passive: false });
    return () => screen.removeEventListener("wheel", wheel);
  }, [Boolean(tree)]);

  useEffect(() => {
    if (tree && tree.layoutVersion !== currentLayoutVersion) {
      const nextTree = reflowTreeLayout(tree);
      setTree(nextTree);
      setView(getFittedView(nextTree, viewport.width, viewport.height));
    }
  }, [tree]);

  const selectedDetails = tree ? resolveLeaf(tree, selectedLeaf) : null;
  const modelBusy = isBranching || isBridging;
  const bridgeSource = tree && bridgeSourceId ? tree.nodes[bridgeSourceId] ?? null : null;
  const bridgeTarget = tree && bridgeTargetId ? tree.nodes[bridgeTargetId] ?? null : null;
  const latestBridge = tree && latestBridgeId ? tree.bridgePaths[latestBridgeId] ?? null : null;
  const canPrune =
    Boolean(tree && selectedLeaf?.kind === "node" && selectedLeaf.id !== tree.rootNodeId && tree.nodes[selectedLeaf.id]);
  const canUseBridge = Boolean(selectedLeaf?.kind === "node");
  const selectedNode = tree && selectedLeaf?.kind === "node" ? tree.nodes[selectedLeaf.id] : null;
  const canBranch = selectedLeaf?.kind === "ghost" || Boolean(selectedNode && !selectedNode.childNodeIds.length && !selectedNode.ghostLeafIds.length);
  const inspectorAnchor = useMemo(() => {
    if (!tree || !selectedLeaf) return null;
    const leaf = selectedLeaf.kind === "node" ? tree.nodes[selectedLeaf.id] : tree.ghostLeaves[selectedLeaf.id];
    if (!leaf) return null;
    const outline = getLeafWorldOutline(leaf, leaf.parentNodeId ? tree.nodes[leaf.parentNodeId] ?? null : null, selectedLeaf.kind);
    return projectPoint({
      x: (Math.min(...outline.map((p) => p.x)) + Math.max(...outline.map((p) => p.x))) / 2,
      y: (Math.min(...outline.map((p) => p.y)) + Math.max(...outline.map((p) => p.y))) / 2,
    }, view, viewport.width, viewport.height);
  }, [tree, selectedLeaf, view, viewport]);

  function startTree() {
    const nextTree = createInitialTree(seed);
    setTree(nextTree);
    setSelectedLeaf({ kind: "node", id: nextTree.rootNodeId });
    setView(getFittedView(nextTree, viewport.width, viewport.height));
    setBridgeMode(false);
    setBridgeSourceId(null);
    setBridgeTargetId(null);
    setLatestBridgeId(null);
  }

  async function branchSelectedLeaf() {
    if (!tree || !selectedLeaf || !canBranch || branchPendingRef.current || bridgePendingRef.current) {
      return;
    }

    branchPendingRef.current = true;
    setIsBranching(true);
    setModelError(null);
    const selection = selectedLeaf;
    try {
      const prepared = selection.kind === "ghost" ? materializeGhost(tree, selection.id) : { tree, nodeId: selection.id };
      const expansion = await expandNodeFromBackend(prepared.tree, prepared.nodeId);
      const expanded = integrateExpansion(prepared.tree, prepared.nodeId, expansion);
      setTree(expanded);
      setView(getFittedView(expanded, viewport.width, viewport.height));
      setSelectedLeaf((current) => current?.id === selection.id ? null : current);
      setLeafHovered(false);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "The model request failed. Please retry.");
    } finally {
      branchPendingRef.current = false;
      setIsBranching(false);
    }
  }

  function pruneSelectedLeaf() {
    if (!tree || selectedLeaf?.kind !== "node") {
      return;
    }

    const nextTree = pruneSubtree(tree, selectedLeaf.id);
    setTree(nextTree);
    setView(getFittedView(nextTree, viewport.width, viewport.height));
    setSelectedLeaf({ kind: "node", id: nextTree.rootNodeId });
    setBridgeSourceId(null);
    setBridgeTargetId(null);
    setLatestBridgeId(null);
    setBridgeMode(false);
  }

  async function saveSelectedLeaf() {
    if (!tree) {
      return;
    }

    const nextTree = selectedLeaf?.kind === "node" ? markNodeSaved(tree, selectedLeaf.id) : tree;
    setTree(nextTree);
    await saveStoredTree(nextTree);
  }

  function resetViewport() {
    if (tree) setView(getFittedView(tree, viewport.width, viewport.height));
  }

  function zoomBy(delta: number) {
    setView((current) => ({ ...current, zoom: clamp(current.zoom * (1 + delta), 0.12, 2.2) }));
  }

  async function selectLeaf(leaf: SelectedLeaf) {
    setSelectedLeaf(leaf);
    setModelError(null);

    if (!tree || !bridgeMode || leaf.kind !== "node" || branchPendingRef.current || bridgePendingRef.current) {
      return;
    }

    if (!bridgeSourceId) {
      setBridgeSourceId(leaf.id);
      return;
    }

    if (bridgeSourceId === leaf.id) {
      return;
    }

    const source = tree.nodes[bridgeSourceId];
    const target = tree.nodes[leaf.id];

    if (!source || !target) {
      return;
    }

    bridgePendingRef.current = true;
    setIsBridging(true);
    try {
      const response = await createBridgePathFromBackend(tree, source, target);
      const nextTree = addBridgePath(tree, source.nodeId, target.nodeId, response);
      const bridgeIds = Object.keys(nextTree.bridgePaths);
      setTree(nextTree);
      setBridgeTargetId(target.nodeId);
      setLatestBridgeId(bridgeIds[bridgeIds.length - 1] ?? null);
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "The model request failed. Please retry.");
    } finally {
      bridgePendingRef.current = false;
      setIsBridging(false);
      setBridgeMode(false);
    }
  }

  function pickCurrentLeafForBridge() {
    if (selectedLeaf?.kind !== "node") {
      return;
    }

    setBridgeMode(true);
    if (!bridgeSourceId) {
      setBridgeSourceId(selectedLeaf.id);
    }
  }

  function clearBridgeMode() {
    setBridgeMode(false);
    setBridgeSourceId(null);
    setBridgeTargetId(null);
    setLatestBridgeId(null);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!tree || event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    suppressLeafClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;

    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
      suppressLeafClickRef.current = true;
    }

    drag.lastX = event.clientX;
    drag.lastY = event.clientY;

    setView((current) => ({
      ...current,
      x: current.x - dx / current.zoom,
      y: current.y + dy / current.zoom,
    }));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag.moved && !bridgeMode) setSelectedLeaf(null);
      suppressLeafClickRef.current = false;
    }
  }

  if (!hydrated || !tree) {
    return <SeedInput seed={seed} onSeedChange={setSeed} onStart={startTree} />;
  }

  return (
    <main
      ref={screenRef}
      className={`app tree-screen${bridgeMode ? " bridge-picking" : ""}${leafHovered ? " leaf-hovered" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <TreeMark />
      <SiteBack />
      <KnowledgeCanvas
        tree={tree}
        selectedLeaf={selectedLeaf}
        view={view}
        onSelectLeaf={selectLeaf}
        onLeafHoverChange={setLeafHovered}
        shouldSuppressLeafClick={() => suppressLeafClickRef.current}
      />

      <div className="zoom-controls" onPointerDown={(event) => event.stopPropagation()}>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(-0.12)}>
          <Minus size={20} strokeWidth={1.7} />
        </button>
        <button type="button" aria-label="Reset view" title="Reset view" onClick={resetViewport}>
          <LocateFixed size={18} strokeWidth={1.7} />
        </button>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(0.12)}>
          <Plus size={20} strokeWidth={1.7} />
        </button>
      </div>

      <BridgeModePanel
        active={bridgeMode}
        source={bridgeSource}
        target={bridgeTarget}
        latestBridge={latestBridge}
        busy={modelBusy}
        onToggle={() => setBridgeMode((active) => !active)}
        onClear={clearBridgeMode}
      />
      <NodeInspector
        details={selectedDetails}
        canPrune={canPrune}
        canUseBridge={canUseBridge}
        bridgeMode={bridgeMode}
        anchor={inspectorAnchor}
        viewport={viewport}
        isBranching={isBranching}
        isBusy={modelBusy}
        error={modelError}
        canBranch={canBranch}
        saved={selectedNode?.status === "saved"}
        onClose={() => setSelectedLeaf(null)}
        onBranch={branchSelectedLeaf}
        onPrune={pruneSelectedLeaf}
        onSave={saveSelectedLeaf}
        onPickBridge={pickCurrentLeafForBridge}
      />
    </main>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getInitialView(): ViewState {
  if (typeof window === "undefined") {
    return { x: -40, y: -18, zoom: 0.78 };
  }

  if (window.innerWidth < 760) {
    return { x: -250, y: -36, zoom: 0.56 };
  }

  if (window.innerWidth < 980) {
    return { x: -225, y: -18, zoom: 0.72 };
  }

  return { x: -40, y: -18, zoom: 0.78 };
}
