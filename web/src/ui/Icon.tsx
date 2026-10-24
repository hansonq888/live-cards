// One small, consistent icon set (thin strokes, 24-unit grid). Replaces emoji and text arrows.
const PATHS: Record<string, string> = {
  play: "M8 5.5v13l10.5-6.5z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.6 1.2-1.8 3.1-1.9-.7a7.6 7.6 0 0 1-2 1.2l-.3 2h-3.6l-.3-2a7.6 7.6 0 0 1-2-1.2l-1.9.7-1.8-3.1 1.6-1.2a7.7 7.7 0 0 1 0-2.4L3.4 9.7l1.8-3.1 1.9.7a7.6 7.6 0 0 1 2-1.2l.3-2h3.6l.3 2a7.6 7.6 0 0 1 2 1.2l1.9-.7 1.8 3.1-1.6 1.2a7.7 7.7 0 0 1 0 2.4z",
  chevron: "M7 10l5 5 5-5",
  external: "M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4",
  check: "M5 12.5l4.5 4.5L19 7.5",
  replay: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  back: "M15 6l-6 6 6 6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z",
  chat: "M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0a2.5 2.5 0 0 1-2-2.5z",
  close: "M6 6l12 12M18 6L6 18",
};
const FILLED = new Set(["play", "pause"]);

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  const fill = FILLED.has(name);
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={fill ? "currentColor" : "none"} stroke={fill ? "none" : "currentColor"}
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
