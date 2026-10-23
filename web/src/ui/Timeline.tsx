import { clock, live, useLive } from "../live/store";

const ICON: Record<string, string> = {
  goal: "⚽", big_chance: "◎", fastest_sprint: "⚡", rating_upgrade: "▲", rating_downgrade: "▼",
  momentum_swing: "⇄", card: "■", substitution: "⇅",
};

/** Revisit: every key moment so far; click to replay it with the ring and card as they were. */
export function Timeline() {
  const keys = useLive((s) => s.keyMoments);
  const t = useLive((s) => s.t);
  const edge = useLive((s) => s.liveEdge);
  const revisit = useLive((s) => s.revisit);
  const meta = useLive((s) => s.meta);
  const dur = meta?.duration ?? 5400;
  return (
    <div className="timeline">
      <div className="tl-track">
        <div className="tl-watched" style={{ width: `${(edge / dur) * 100}%` }} />
        <div className="tl-half" style={{ left: "50%" }} />
        {keys.map((k) => (
          <button key={k.id} className={`tl-mark tl-${k.type} ${revisit?.id === k.id ? "on" : ""}`}
            style={{ left: `${(k.t / dur) * 100}%` }} title={`${clock(k.t)} ${k.label}`}
            onClick={() => live.revisitMoment(k)}>
            {ICON[k.type] ?? "•"}
          </button>
        ))}
        <div className="tl-head" style={{ left: `${(t / dur) * 100}%` }} />
      </div>
      <div className="tl-side">
        {revisit ? (
          <>
            <span className="tl-revisit">REVISIT · {clock(revisit.t)} · {revisit.label}</span>
            <button onClick={() => live.backToLive()}>Back to live ▸</button>
          </>
        ) : (
          <span className="tl-hint">Key moments: click one to replay it as it happened</span>
        )}
      </div>
    </div>
  );
}
