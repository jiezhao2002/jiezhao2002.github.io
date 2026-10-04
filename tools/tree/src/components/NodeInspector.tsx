import { Bookmark, Link2, Loader2, Scissors, X } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { LeafDetails } from "../types/graph";

export function NodeInspector({ details, canPrune, canUseBridge, bridgeMode, anchor, viewport, isBranching, isBusy, error, canBranch, saved, onClose, onBranch, onPrune, onSave, onPickBridge }: {
  details: LeafDetails | null;
  canPrune: boolean;
  canUseBridge: boolean;
  bridgeMode: boolean;
  anchor: { x: number; y: number } | null;
  viewport: { width: number; height: number };
  isBranching: boolean;
  isBusy: boolean;
  error: string | null;
  canBranch: boolean;
  saved: boolean;
  onClose: () => void;
  onBranch: () => void;
  onPrune: () => void;
  onSave: () => void;
  onPickBridge: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);
  const [height, setHeight] = useState(180);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => setHeight(card.offsetHeight));
    observer.observe(card);
    return () => observer.disconnect();
  }, [details?.id]);
  if (!details) return null;
  const width = Math.min(278, viewport.width - 32);
  const left = anchor && anchor.x + 48 + width < viewport.width - 16
    ? anchor.x + 48 : (anchor?.x ?? viewport.width) - width - 48;
  const position = viewport.width < 660 ? undefined : {
    left: Math.max(16, Math.min(viewport.width - width - 16, left)),
    top: Math.max(18, Math.min(viewport.height - height - 80, (anchor?.y ?? viewport.height * 0.5) - 26)),
  };

  return (
    <aside ref={cardRef} className="leaf-card" style={position} aria-label="Leaf details"
      onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <header className="leaf-card-header">
        <h2>{details.title}</h2>
        <button className="icon-button" type="button" aria-label="Close details" data-tooltip="Close" onClick={onClose}>
          <X size={15} strokeWidth={1.5} />
        </button>
      </header>
      <p className="leaf-summary">{details.summary}</p>
      {error && <p className="leaf-error" role="alert">{error}</p>}
      <footer className="leaf-card-actions">
        <div className="leaf-tools">
          {canUseBridge && (
            <button className="icon-button" type="button" aria-label="Bridge from this leaf" data-tooltip={bridgeMode ? "Pick a leaf" : "Bridge"}
              disabled={isBusy} aria-pressed={bridgeMode} onClick={onPickBridge}>
              <Link2 size={16} strokeWidth={1.5} />
            </button>
          )}
          {canPrune && (
            <button className="icon-button" type="button" aria-label="Prune this branch" data-tooltip="Prune" disabled={isBusy} onClick={onPrune}>
              <Scissors size={16} strokeWidth={1.5} />
            </button>
          )}
          {canUseBridge && (
            <button className="icon-button" type="button" aria-label={saved ? "Leaf saved" : "Save leaf"} data-tooltip={saved ? "Saved" : "Save"}
              disabled={isBusy} aria-pressed={saved} onClick={onSave}>
              <Bookmark size={15} strokeWidth={1.5} fill={saved ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        <button className="branch-button" type="button" onClick={onBranch} disabled={isBusy || !canBranch}
          aria-busy={isBranching} title={!canBranch ? "This leaf has already branched" : undefined}>
          {isBranching && <Loader2 size={14} className="loading-icon" />}
          {isBranching ? "Growing..." : "Branch on"}
        </button>
      </footer>
    </aside>
  );
}
