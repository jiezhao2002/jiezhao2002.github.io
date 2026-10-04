import { FormEvent } from "react";
import { SiteBack, TreeMark } from "./NodeLabel";
import { getLeafMetrics, getLeafOutline, getLeafVein } from "../lib/leafGeometry";
import { stableId } from "../lib/seededRandom";

export function SeedInput({
  seed,
  onSeedChange,
  onStart,
}: {
  seed: string;
  onSeedChange: (seed: string) => void;
  onStart: () => void;
}) {
  function submitSeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (seed.trim()) onStart();
  }
  const metrics = getLeafMetrics(`${stableId("graph", seed.trim() || "Tree")}:0`);
  const outline = getLeafOutline(metrics);
  const vein = getLeafVein(metrics);
  const path = (points: { x: number; y: number }[]) => points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

  return (
    <main className="app seed-screen">
      <SiteBack />
      <TreeMark />
      <svg className="seed-vine" viewBox="0 0 500 240" aria-hidden="true">
        <path className="drawn-stroke" d="M -20 180 C 44 115, 96 170, 176 162 C 215 158, 242 167, 260 160" />
        <g transform="translate(260 160) rotate(-75.6)">
          <path className="drawn-stroke" d={`${path(outline)} Z`} />
          {metrics.showVein && <path className="drawn-stroke thin" d={path(vein)} />}
        </g>
      </svg>
      <form className="seed-form" onSubmit={submitSeed}>
        <input
          aria-label="Root idea"
          autoFocus
          maxLength={180}
          value={seed}
          onChange={(event) => onSeedChange(event.target.value)}
          placeholder="What's the root? ..."
        />
      </form>
    </main>
  );
}
