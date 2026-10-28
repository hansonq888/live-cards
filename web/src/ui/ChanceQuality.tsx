// Chance quality: every player who shot, by how many shots (across) and how good they were on
// average (up, mean xG per shot). Top left: few but good chances; bottom right: lots of
// low-quality shots. Hover a dot for the numbers, click to replay their best chance.
import { useState } from "react";
import { live, useLive } from "../live/store";
import type { Summary } from "../pages/summary";

export function ChanceQuality({ s }: { s: Summary }) {
  const plays = useLive((st) => st.plays);
  const [hover, setHover] = useState<string | null>(null);
  const by = new Map<string, typeof plays>();
  for (const p of plays) by.set(p.player, [...(by.get(p.player) ?? []), p]);
  const rows = [...by.entries()].map(([id, ps]) => {
    const xg = ps.reduce((t, p) => t + p.xg, 0);
    return { id, shots: ps.length, avg: xg / ps.length, xg, goals: ps.filter((p) => p.outcome === "goal").length,
      best: ps.reduce((a, b) => (b.xg > a.xg ? b : a)), team: ps[0].team };
  });
  const W = 100, H = 70, L = 9, B = 9;
  const maxS = Math.max(4, ...rows.map((r) => r.shots)), maxA = Math.max(0.3, ...rows.map((r) => r.avg)) * 1.1;
  const X = (n: number) => L + (n / maxS) * (W - L - 20), Y = (a: number) => H - B - (a / maxA) * (H - B - 4);
  const who = (id: string) => s.players.find((p) => p.id === id);
  const colour = (code: string) => (code === s.meta.home.code ? s.meta.home.color : s.meta.away.color);
  const cur = rows.find((r) => r.id === hover);
  return (
    <div className="cq">
      <svg viewBox={`0 0 ${W} ${H}`} className="cq-chart" onMouseLeave={() => setHover(null)}>
        <line x1={L} y1={H - B} x2={W - 2} y2={H - B} className="cq-axis" />
        <line x1={L} y1={4} x2={L} y2={H - B} className="cq-axis" />
        <text x={L + 1.5} y={7.5} className="cq-q">few, good chances</text>
        <text x={W - 3} y={H - B - 2} className="cq-q end">many, poor chances</text>
        <text x={(L + W) / 2} y={H - 2} className="cq-lab">shots →</text>
        <text x={3} y={(H - B) / 2} className="cq-lab" transform={`rotate(-90 3 ${(H - B) / 2})`}>xG per shot →</text>
        {rows.map((r) => (
          <g key={r.id} className={`cq-dot ${hover === r.id ? "on" : ""}`} onMouseEnter={() => setHover(r.id)} onClick={() => live.showMe(r.best.id)}>
            <circle cx={X(r.shots)} cy={Y(r.avg)} r={1.6 + r.goals * 0.9} fill={colour(r.team)} />
            <text x={X(r.shots) + 2.6} y={Y(r.avg) + 1}>{who(r.id)?.short ?? ""}</text>
          </g>
        ))}
      </svg>
      <div className="mo2-detail">
        {cur ? (
          <><b style={{ color: colour(cur.team) }}>{who(cur.id)?.short}</b><span>{cur.shots} shot{cur.shots === 1 ? "" : "s"}</span>
            <span>{cur.avg.toFixed(2)} xG per shot</span><span>{cur.goals} goal{cur.goals === 1 ? "" : "s"}</span><span className="mo2-hint">click to replay their best chance</span></>
        ) : <span className="mo2-hint">Who took good chances and who forced it. Bigger dots scored. Hover a player; click to replay their best chance.</span>}
      </div>
    </div>
  );
}
