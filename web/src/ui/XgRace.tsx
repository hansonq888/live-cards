// xG race: each team's expected goals adding up over the match, shot by shot, with goals marked,
// beside every shot ranked by chance quality. Hovering a shot in either highlights it in both;
// click any shot to break the play down. The verdict line compares goals with xG, in code.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";

const H = 340, PAD = { l: 34, r: 14, t: 30, b: 24 };

export function XgRace() {
  const plays = useLive((s) => s.plays);
  const meta = useLive((s) => s.meta);
  const t = useLive((s) => s.t);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1000);
  const [hover, setHover] = useState<string | null>(null);  // draw at the real width: text and dots keep their shape
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
  const goals = (code: string) => plays.filter((p) => p.team === code && p.outcome === "goal").length;
  const [a, b] = lines;
  const lead = a.total >= b.total ? a : b, other = lead === a ? b : a;
  const verdict = Math.abs(a.total - b.total) < 0.15
    ? "Even on chances so far."
    : `${lead.team.name} have made the better chances (${lead.total.toFixed(2)} xG to ${other.total.toFixed(2)})`
      + (goals(other.team.code) > goals(lead.team.code) ? `, but ${other.team.name} have taken theirs.` : ".");
  const ranked = [...plays].sort((x, y) => y.xg - x.xg);
  return (
    <div className="xg-race v2" ref={box}>
      <div className="xr-top">
        {lines.map((l) => (
          <div key={l.team.code} className="xr-total" style={{ ["--team" as string]: l.team.color }}>
            <span>{l.team.name}</span><b>{l.total.toFixed(2)}<small> xG</small></b><em>{goals(l.team.code)} goal{goals(l.team.code) === 1 ? "" : "s"} · {plays.filter((p) => p.team === l.team.code).length} shots</em>
          </div>
        ))}
        <p className="xr-verdict">{verdict}</p>
      </div>
      <div className="xr-body">
      <svg viewBox={`0 0 ${W} ${H}`} className="xr-svg" role="img" aria-label="Cumulative expected goals for each team over the match">
        <defs>{lines.map((l) => (
          <linearGradient key={l.team.code} id={`xr-fill-${l.team.code}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={l.team.color} stopOpacity=".28" /><stop offset="1" stopColor={l.team.color} stopOpacity="0" />
          </linearGradient>
        ))}</defs>
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
          const end = X(Math.min(Math.max(t, l.pts[l.pts.length - 1].t), 5400));
          d += ` H ${end}`;
          return (
            <g key={l.team.code}>
              <path d={`${d} V ${Y(0)} H ${X(0)} Z`} fill={`url(#xr-fill-${l.team.code})`} />
              <path d={d} fill="none" stroke={l.team.color} strokeWidth={3.5} strokeLinejoin="round" />
            </g>
          );
        })}
        {lines.flatMap((l) => l.pts.filter((p) => p.play).map((p) => {
          const goal = p.play!.outcome === "goal", on = hover === p.play!.id;
          return (
            <g key={p.play!.id} className={`xr-shot ${on ? "on" : ""}`} onClick={() => live.breakdown(p.play!.id)}
              onMouseEnter={() => setHover(p.play!.id)} onMouseLeave={() => setHover(null)}>
              <circle cx={X(p.t)} cy={Y(p.xg)} r={(goal ? 8 : 5) + (on ? 3 : 0)} fill={goal ? "#fff" : l.team.color} stroke={l.team.color} strokeWidth={goal ? 3 : 2} />
              {goal && <text x={X(p.t)} y={Y(p.xg) - 14} textAnchor="middle" className="xr-goal" fill={l.team.color}>⚽ {name(p.play!.player)} {p.play!.minute}′</text>}
              <title>{`${p.play!.minute}′ ${name(p.play!.player)} · ${p.play!.outcome.replace("_", " ")} · xG ${p.play!.xg.toFixed(2)}`}</title>
            </g>
          );
        }))}
      </svg>
      <div className="xr-list">
        <span className="xr-list-h">Every shot, best chance first · click to show me</span>
        {ranked.map((p) => {
          const tm = p.team === meta.home.code ? meta.home : meta.away;
          return (
            <button key={p.id} className={`xr-row ${hover === p.id ? "on" : ""} ${p.outcome === "goal" ? "goal" : ""}`} style={{ ["--team" as string]: tm.color }}
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => live.showMe(p.id)} title="Show me this play">
              <span className="xr-min">{p.minute}′</span>
              <span className="xr-who"><b>{name(p.player)}</b><em>{p.outcome === "goal" ? "Goal" : p.outcome.replace("_", " ")}</em></span>
              <span className="xr-bar"><i style={{ width: `${Math.min(100, p.xg * 160)}%` }} /></span>
              <span className="xr-val">{p.xg.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
      </div>
    </div>
  );
}
