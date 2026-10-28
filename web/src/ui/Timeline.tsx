import { useState } from "react";
import { clock, live, useLive } from "../live/store";

const LABELS = [0, 15, 30, 45, 60, 75, 90];
// One icon per kind of moment, so the bar reads at a glance.
const ICON: Record<string, string> = {
  goal: "⚽", big_chance: "◎", card: "", substitution: "⇄", fastest_sprint: "⚡",
  rating_upgrade: "▲", rating_downgrade: "▼", momentum_swing: "↗",
};
const MINOR = Array.from({ length: 19 }, (_, i) => i * 5);

/** The match as a track: minute ticks, half-time, how far you've watched, and every key
 *  moment so far as a dot. Click anywhere to jump there (up to what you've watched, so the
 *  live view never spoils what's coming), or click a dot to replay that moment. */
export function Timeline() {
  const keys = useLive((s) => s.keyMoments);
  const t = useLive((s) => s.t);
  const edge = useLive((s) => s.liveEdge);
  const revisit = useLive((s) => s.revisit);
  const meta = useLive((s) => s.meta);
  const dur = meta?.duration ?? 5400;
  const pct = (x: number) => `${Math.min(100, Math.max(0, (x / dur) * 100))}%`;
  const [hover, setHover] = useState<number | null>(null);
  const reach = Math.max(edge, t);
  const timeAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(reach, Math.max(0, ((e.clientX - r.left) / r.width) * dur));
  };
  return (
    <div className="timeline">
      <div className="tl-track" onMouseMove={(e) => setHover(timeAt(e))} onMouseLeave={() => setHover(null)}
        onClick={(e) => { if ((e.target as Element).closest(".tl-mark")) return; live.closeRevisit(); live.seekTo(timeAt(e)); }}>
        {hover !== null && <span className="tl-hover" style={{ left: pct(hover) }}>{clock(hover)}</span>}
        <div className="tl-half"><span>1st half</span><span>2nd half</span></div>
        {MINOR.map((m) => <i key={m} className={`tl-tick ${m % 15 === 0 ? "major" : ""}`} style={{ left: pct(m * 60) }} />)}
        <div className="tl-watched" style={{ width: pct(Math.max(edge, t)) }} />
        {keys.map((k) => (
          <button key={k.id} className={`tl-mark tl-${k.type} ${revisit?.id === k.id ? "on" : ""}`}
            style={{ left: pct(k.t) }} data-label={`${clock(k.t)} · ${k.label}`} aria-label={`${clock(k.t)} ${k.label}`}
            onClick={(e) => { live.revisitMoment(k); e.currentTarget.blur(); }}>
            <span className="tl-ico" aria-hidden="true">{ICON[k.type] ?? "•"}</span>
          </button>
        ))}
        <div className="tl-head" style={{ left: pct(t) }}><span>{Math.floor(t / 60)}′</span></div>
      </div>
      <div className="tl-ticks">
        {LABELS.map((m) => <span key={m} style={{ left: pct(m * 60) }}>{m === 45 ? "HT" : m === 90 ? "FT" : `${m}′`}</span>)}
      </div>
    </div>
  );
}
