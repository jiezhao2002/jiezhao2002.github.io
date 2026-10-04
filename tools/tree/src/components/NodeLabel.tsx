import { ArrowLeft } from "lucide-react";

export function SiteBack() {
  return (
    <a className="site-back icon-button" aria-label="Back to Experiments" data-tooltip="Experiments"
      href={window.location.pathname.startsWith("/tree/") ? "../#experiments" : "https://jiezhao2002.github.io/#experiments"}
      onPointerDown={(event) => event.stopPropagation()}>
      <ArrowLeft size={18} strokeWidth={1.5} />
    </a>
  );
}

export function TreeMark() {
  return (
    <div className="tree-mark" aria-hidden="true">
      <svg viewBox="0 0 190 205">
        <path
          className="drawn-stroke"
          d="M 81 80 C 52 89, 30 83, 26 64 C 18 45, 43 37, 49 38 C 47 24, 67 19, 75 22 C 79 6, 98 11, 104 14 C 116 6, 122 14, 119 22 C 137 14, 151 20, 147 34 C 164 31, 169 47, 157 58 C 171 62, 160 81, 146 76 C 152 93, 133 99, 122 89 C 114 101, 95 94, 96 79"
        />
        <path className="drawn-stroke" d="M 88 84 C 88 120, 87 151, 75 165 C 68 173, 61 179, 55 180" />
        <path className="drawn-stroke" d="M 101 80 C 100 121, 102 151, 115 164 C 123 172, 133 177, 143 178" />
      </svg>
      <span>Tree (树)</span>
    </div>
  );
}
