import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let graph;
let geometry;
let branches;
let viewport;

before(async () => {
  server = await createServer({
    root: fileURLToPath(new URL("../", import.meta.url)),
    configFile: false,
    logLevel: "silent",
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  graph = await server.ssrLoadModule("/src/lib/graphOps.ts");
  geometry = await server.ssrLoadModule("/src/lib/leafGeometry.ts");
  branches = await server.ssrLoadModule("/src/lib/branchGeometry.ts");
  viewport = await server.ssrLoadModule("/src/lib/viewport.ts");
});

after(async () => { await server?.close(); });

function grow(seed, depth = 4) {
  let tree = graph.createInitialTree(seed);
  let id = tree.rootNodeId;
  for (let i = 0; i < depth; i += 1) {
    tree = graph.expandNodeLocally(tree, id);
    id = tree.nodes[id].childNodeIds[0];
  }
  return tree;
}

function inside(point, outline) {
  let contained = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i], b = outline[j];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) contained = !contained;
  }
  return contained;
}

test("leaf variation is deterministic, with long, short, curved and veinless profiles", () => {
  const metrics = Array.from({ length: 100 }, (_, i) => geometry.getLeafMetrics(`leaf-${i}`));
  assert.deepEqual(geometry.getLeafMetrics("stable"), geometry.getLeafMetrics("stable"));
  assert(metrics.some((m) => m.length < 75));
  assert(metrics.some((m) => m.length > 125));
  assert(metrics.some((m) => Math.abs(m.bend) > 20));
  assert(metrics.some((m) => Math.abs(m.bend) < 2));
  assert(metrics.some((m) => m.showVein) && metrics.some((m) => !m.showVein));
  for (const m of metrics) {
    const outline = geometry.getLeafOutline(m);
    assert.deepEqual(outline[0], { x: 0, y: 0 });
    assert.deepEqual(outline[32], { x: m.length, y: m.tipLift });
    assert(outline.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
});

test("each expansion adds one real leaf and exactly two shadows, only once", () => {
  const initial = graph.createInitialTree("Three candidates");
  const tree = graph.expandNodeLocally(initial, initial.rootNodeId);
  assert.equal(tree.nodes[tree.rootNodeId].childNodeIds.length, 1);
  assert.equal(tree.nodes[tree.rootNodeId].ghostLeafIds.length, 2);
  assert.equal(Object.keys(initial.nodes).length, 1);
  assert.equal(Object.keys(initial.ghostLeaves).length, 0);
  assert.equal(graph.expandNodeLocally(tree, tree.rootNodeId), tree);
});

test("branches meet the actual leaf endpoints without crossing their parent's blade", () => {
  for (let index = 0; index < 160; index += 1) {
    const tree = grow(`Geometry-${index}`);
    for (const edge of Object.values(tree.edges)) {
      const from = tree.nodes[edge.fromNodeId];
      const parent = tree.nodes[from.parentNodeId] ?? null;
      const to = tree.nodes[edge.toNodeId] ?? tree.ghostLeaves[edge.toNodeId];
      const points = branches.getBranchPoints(from, parent, to, edge.curveSeed);
      const tip = geometry.getLeafTipPosition(from, parent, "node");
      assert(Math.hypot(points[0].x - tip.x, points[0].y - tip.y) < 1e-6);
      assert(Math.hypot(points.at(-1).x - to.x, points.at(-1).y - to.y) < 1e-6);
      const outline = geometry.getLeafWorldOutline(from, parent, "node");
      assert(!points.slice(1).some((p) => inside(p, outline)), `${from.pathKey}: ${index}`);
    }
  }
});

test("choosing a shadow preserves its shape, angle, position and candidate slot", () => {
  let tree = grow("Stable shadow", 1);
  for (const id of [...tree.nodes[tree.rootNodeId].ghostLeafIds]) {
    const ghost = tree.ghostLeaves[id];
    const parent = tree.nodes[ghost.parentNodeId];
    const tip = geometry.getLeafTipPosition(ghost, parent, "ghost");
    const promoted = graph.materializeGhost(tree, id);
    tree = promoted.tree;
    const node = tree.nodes[promoted.nodeId];
    for (const key of ["leafSeed", "leafAngle", "branchSlot", "x", "y", "z", "summaryShort"]) {
      assert.equal(node[key], ghost[key]);
    }
    assert.deepEqual(geometry.getLeafTipPosition(node, parent, "node"), tip);
    assert(!tree.ghostLeaves[id]);
  }
  assert.equal(tree.nodes[tree.rootNodeId].childNodeIds.length, 3);
  assert.equal(tree.nodes[tree.rootNodeId].ghostLeafIds.length, 0);
});

test("legacy layout migration keeps promoted candidates in distinct stable slots", () => {
  let tree = grow("Migrated shadow");
  const root = tree.nodes[tree.rootNodeId];
  const promoted = graph.materializeGhost(tree, root.ghostLeafIds[1]);
  tree = graph.expandNodeLocally(promoted.tree, promoted.nodeId);
  const legacy = structuredClone(tree);
  legacy.layoutVersion = 3;
  for (const leaf of [...Object.values(legacy.nodes), ...Object.values(legacy.ghostLeaves)]) delete leaf.branchSlot;
  const migrated = graph.reflowTreeLayout(legacy);
  for (const parent of Object.values(migrated.nodes)) {
    const leaves = [...parent.childNodeIds.map((id) => migrated.nodes[id]), ...parent.ghostLeafIds.map((id) => migrated.ghostLeaves[id])];
    assert.equal(new Set(leaves.map((leaf) => leaf.branchSlot)).size, leaves.length);
    for (const leaf of leaves) {
      const original = tree.nodes[leaf.nodeId] ?? tree.ghostLeaves[leaf.ghostLeafId];
      assert.equal(leaf.x, original.x);
      assert.equal(leaf.y, original.y);
    }
  }
  assert.equal(graph.reflowTreeLayout(migrated), migrated);
});

test("fitted desktop and mobile views contain every visible leaf", () => {
  const tree = grow("Responsive tree", 5);
  for (const [width, height] of [[1440, 900], [820, 900], [390, 844]]) {
    const view = viewport.getFittedView(tree, width, height);
    for (const leaf of [...Object.values(tree.nodes), ...Object.values(tree.ghostLeaves)]) {
      const parent = tree.nodes[leaf.parentNodeId] ?? null;
      const outline = geometry.getLeafWorldOutline(leaf, parent, "nodeId" in leaf ? "node" : "ghost");
      for (const point of outline) {
        const projected = viewport.projectPoint(point, view, width, height);
        assert(projected.x > 0 && projected.x < width);
        assert(projected.y > 140 && projected.y < height - 60);
      }
    }
  }
});

test("older three-real-leaf layouts retain all three candidate positions", () => {
  let tree = grow("Legacy real leaves", 1);
  for (const id of [...tree.nodes[tree.rootNodeId].ghostLeafIds]) tree = graph.materializeGhost(tree, id).tree;
  const legacy = structuredClone(tree);
  legacy.layoutVersion = 1;
  legacy.nodes[legacy.rootNodeId].childNodeIds.forEach((id) => {
    legacy.nodes[id].pathKey = `0.${legacy.nodes[id].branchSlot}`;
    delete legacy.nodes[id].branchSlot;
  });
  const migrated = graph.reflowTreeLayout(legacy);
  const children = migrated.nodes[migrated.rootNodeId].childNodeIds.map((id) => migrated.nodes[id]);
  assert.deepEqual(children.map((node) => node.branchSlot).sort(), [0, 1, 2]);
  for (const child of children) {
    assert.equal(child.x, tree.nodes[child.nodeId].x);
    assert.equal(child.y, tree.nodes[child.nodeId].y);
  }
});

test("pruning removes descendant shadows and leaves the source graph unchanged", () => {
  const tree = grow("Pruned branch", 3);
  const id = tree.nodes[tree.rootNodeId].childNodeIds[0];
  const pruned = graph.pruneSubtree(tree, id);
  assert.equal(pruned.nodes[id].status, "pruned");
  assert.notEqual(tree.nodes[id].status, "pruned");
  assert(Object.values(pruned.ghostLeaves).every((leaf) => pruned.nodes[leaf.parentNodeId].status !== "pruned"));
});
