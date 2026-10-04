import {
  BridgePathResponse,
  ExpansionResponse,
  KnowledgeTree,
  TreeNode,
} from "../types/graph";
import { buildNodePacket } from "./graphOps";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:7860" : "")).replace(/\/$/, "");

async function requestBackend<T>(path: string, body: unknown): Promise<T> {
  if (!apiBaseUrl) throw new Error("The model service has not been configured for this site yet.");
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("The model request timed out. Please retry.");
    }
    throw new Error(import.meta.env.DEV
      ? "Cannot reach the backend. Check that the model service is running and retry."
      : "Cannot reach the model service. Please try again shortly.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(typeof data?.detail === "string" ? data.detail : `The backend returned HTTP ${response.status}. Please retry.`);
  }
  if (!data) throw new Error("The backend returned an invalid response. Please retry.");
  return data as T;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && Boolean(value.trim());
}

export async function expandNodeFromBackend(tree: KnowledgeTree, nodeId: string): Promise<ExpansionResponse> {
  const nodePacket = buildNodePacket(tree, nodeId);

  const data = await requestBackend<ExpansionResponse>("/expand-node", { contract: tree.contract, nodePacket });
  if (!Array.isArray(data.children) || data.children.length !== tree.contract.branchWidth
    || !Array.isArray(data.ghostLeaves) || data.ghostLeaves.length !== 0
    || !data.children.every((child) => child && hasText(child.title) && hasText(child.summaryShort) && hasText(child.relationType))) {
    throw new Error("The model did not return three valid candidates. Please retry.");
  }
  return data;
}

export async function createBridgePathFromBackend(
  tree: KnowledgeTree,
  source: TreeNode,
  target: TreeNode,
): Promise<BridgePathResponse> {
  const data = await requestBackend<BridgePathResponse>("/bridge-path", {
    contract: tree.contract,
    sourceTitle: source.title,
    targetTitle: target.title,
    sourceSummaryShort: source.summaryShort,
    targetSummaryShort: target.summaryShort,
    maxBricks: 4,
  });
  if (!Array.isArray(data.turningBricks) || data.turningBricks.length < 1 || data.turningBricks.length > 4
    || !data.turningBricks.every((brick) => brick && [brick.title, brick.fromTitle, brick.toTitle, brick.explanation, brick.relationType].every(hasText))) {
    throw new Error("The model did not return a valid bridge. Please retry.");
  }
  return data;
}
