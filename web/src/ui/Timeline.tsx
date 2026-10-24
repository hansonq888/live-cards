import { clock, live, useLive } from "../live/store";

const ICON: Record<string, string> = { goal: "⚽" };
const TICKS = [0, 15, 30, 45, 60, 75, 90];

/** Revisit: every key moment so far; click to replay it with the ring and card as they were. */
export function Timeline() {
  const keys = useLive((s) => s.keyMoments);
  const t = useLive((s) => s.t);
  const edge = useLive((s) => s.liveEdge);
  const revisit = useLive((s) => s.revisit);
  const meta = useLive((s) => s.meta);
  const dur = meta?.duration ?? 5400;
  const pct = (x: number) => `${Math.min(100, (x / dur) * 100)}%`;
  return (
    <div className="timeline">
      <div className="tl-track">
        <div className="tl-watched" style={{ width: pct(edge) }} />
        {keys.map((k) => (
          <button key={k.id} className={`tl-mark tl-${k.type} ${revisit?.id === k.id ? "on" : ""}`}
            style={{ left: pct(k.t) }} data-label={`${clock(k.t)} · ${k.label}`} aria-label={`${clock(k.t)} ${k.label}`}
            onClick={() => live.revisitMoment(k)}>
            {ICON[k.type] ?? ""}
          </button>
        ))}
        <div className="tl-head" style={{ left: pct(t) }} />
      </div>
      <div className="tl-ticks">
        {TICKS.map((m) => <span key={m} style={{ left: pct(m * 60) }}>{m}′</span>)}
      </div>
    </div>
  );
}
