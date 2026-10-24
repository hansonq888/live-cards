// xG race: each team's expected goals adding up over the match, shot by shot, with goals marked.
// The story of the match at a glance; click any shot to break the play down.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";

const H = 260, PAD = { l: 34, r: 14, t: 14, b: 22 };

export function XgRace() {
  const plays = useLive((s) => s.plays);
  const meta = useLive((s) => s.meta);
  const t = useLive((s) => s.t);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);  // draw at the real width: text and dots keep their shape
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  if (!meta) return null;
  const teams = [meta.home, meta.away];
  const lines = teams.map((tm) => {
    let sum = 0;
    const pts = [{ t: 0, xg: 0, play: null as null | (typeof plays)[number] }];
    for (const p of plays.filter((p) => p.team === tm.code)) { sum += p.xg; pts.push({ t: p.t, xg: sum, play: p }); }
    return { team: tm, pts, total: sum };
  });
  const top = Math.max(0.5, ...lines.map((l) => l.total)) * 1.15;
  const X = (sec: number) => PAD.l + (sec / 5400) * (W - PAD.l - PAD.r);
  const Y = (xg: number) => H - PAD.b - (xg / top) * (H - PAD.t - PAD.b);
  const name = (id: string) => meta.players.find((p) => p.id === id)?.short ?? "";
  return (
    <div className="xg-race" ref={box}>
      <div className="xr-head">
        <b>xG race</b><span>Expected goals adding up shot by shot. Steeper means better chances. Click a shot to break it down.</span>
        <span className="xr-legend">{lines.map((l) => <i key={l.team.code}><em style={{ background: l.team.color }} />{l.team.code} {l.total.toFixed(2)}</i>)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="xr-svg" role="img" aria-label="Cumulative expected goals for each team over the match">
        {[0, 15, 30, 45, 60, 75, 90].map((m) => (
          <g key={m}>
            <line x1={X(m * 60)} x2={X(m * 60)} y1={PAD.t} y2={H - PAD.b} className="xr-grid" />
            <text x={X(m * 60)} y={H - 6} className="xr-axis" textAnchor="middle">{m}′</text>
          </g>
        ))}
        {[0, top / 2].map((v) => <text key={v} x={PAD.l - 6} y={Y(v) + 4} className="xr-axis" textAnchor="end">{v.toFixed(1)}</text>)}
        <line x1={X(Math.min(t, 5400))} x2={X(Math.min(t, 5400))} y1={PAD.t} y2={H - PAD.b} className="xr-now" />
        {lines.map((l) => {
          let d = `M ${X(0)} ${Y(0)}`;
          for (const p of l.pts.slice(1)) d += ` H ${X(p.t)} V ${Y(p.xg)}`;
          d += ` H ${X(Math.min(Math.max(t, l.pts[l.pts.length - 1].t), 5400))}`;
          return <path key={l.team.code} d={d} fill="none" stroke={l.team.color} strokeWidth={2.5} />;
        })}
        {lines.flatMap((l) => l.pts.filter((p) => p.play).map((p) => (
          <g key={p.play!.id} className="xr-shot" onClick={() => live.breakdown(p.play!.id)}>
            <circle cx={X(p.t)} cy={Y(p.xg)} r={p.play!.outcome === "goal" ? 7 : 4.5} fill={p.play!.outcome === "goal" ? "#fff" : l.team.color} stroke={l.team.color} strokeWidth={2} />
            <title>{`${p.play!.minute}′ ${name(p.play!.player)} · ${p.play!.outcome.replace("_", " ")} · xG ${p.play!.xg.toFixed(2)}`}</title>
          </g>
        )))}
      </svg>
    </div>
  );
}
