import { Link2, X } from "lucide-react";
import { BridgePath, TreeNode } from "../types/graph";

export function BridgeModePanel({ active, source, target, latestBridge, busy, onToggle, onClear }: {
  active: boolean;
  source: TreeNode | null;
  target: TreeNode | null;
  latestBridge: BridgePath | null;
  busy: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  return (
    <section className="bridge-panel" aria-label="Bridge" onPointerDown={(event) => event.stopPropagation()}>
      <button className="icon-button" type="button" aria-label="Bridge mode" data-tooltip="Bridge" aria-pressed={active} disabled={busy} onClick={onToggle}>
        <Link2 size={17} strokeWidth={1.5} />
      </button>
      {(active || source || latestBridge) && (
        <>
          <span title={source?.title}>{source?.title ?? "Source"}</span>
          <span aria-hidden="true">&rarr;</span>
          <span title={target?.title}>{target?.title ?? "Target"}</span>
          <button className="icon-button" type="button" aria-label="Clear bridge" data-tooltip="Clear" disabled={busy} onClick={onClear}><X size={15} strokeWidth={1.5} /></button>
        </>
      )}
      {latestBridge && <div className="bridge-bricks">{latestBridge.turningBricks.map((brick) => <span key={brick.id} title={brick.explanation}>{brick.title}</span>)}</div>}
    </section>
  );
}
