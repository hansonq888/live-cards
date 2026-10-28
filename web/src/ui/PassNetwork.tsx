// Pass network: each player at their average position (both teams shown attacking right),
// sized by how many completed passes they were part of, with a line for every pair that
// connected three or more times, thicker for more. Hover a player to see their links.
import { useEffect, useState } from "react";
import { matchId, type Summary } from "../pages/summary";

interface Net { nodes: { id: string; x: number; y: number; passes: number }[]; edges: { a: string; b: string; n: number }[] }

export function PassNetwork({ s }: { s: Summary }) {
  const [nets, setNets] = useState<Record<string, Net> | null>(null);
  const [team, setTeam] = useState(s.meta.home.code);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/passnet?match=${matchId()}`).then((r) => r.json()).then(setNets).catch(() => setNets(null)); }, []);
  const t = team === s.meta.home.code ? s.meta.home : s.meta.away;
  const net = nets?.[team];
  const who = (id: string) => s.players.find((p) => p.id === id);
  // Pitch 105 x 68 m, centre origin, attacking right.
  const X = (x: number) => x + 52.5, Y = (y: number) => 34 - y;
  const maxN = Math.max(1, ...(net?.edges.map((e) => e.n) ?? [1]));
  const maxP = Math.max(1, ...(net?.nodes.map((n) => n.passes) ?? [1]));
  const pos = new Map(net?.nodes.map((n) => [n.id, n]) ?? []);
  const focus = hover ? net?.edges.filter((e) => e.a === hover || e.b === hover).sort((a, b) => b.n - a.n) : null;
  const hp = hover ? who(hover) : undefined;
  const top = net?.edges[0];
  return (
    <div className="pn" style={{ ["--team" as string]: t.color }}>
      <div className="pn-bar">
        <div className="pn-tabs">
          {[s.meta.home, s.meta.away].map((x) => <button key={x.code} className={team === x.code ? "on" : ""} onClick={() => { setTeam(x.code); setHover(null); }}>{x.name}</button>)}
        </div>
        <span className="pn-note">Average positions · lines = completed passes between two players (3+) · attacking →</span>
      </div>
      {!net ? <p className="bd-empty">Loading the pass network…</p> : (
        <svg viewBox="-2 -2 109 72" className="pn-pitch" onMouseLeave={() => setHover(null)}>
          <rect x="-2" y="-2" width="109" height="72" className="pn-grass" />
          <g className="pn-lines">
            <rect x="0" y="0" width="105" height="68" /><line x1="52.5" y1="0" x2="52.5" y2="68" /><circle cx="52.5" cy="34" r="9.15" />
            <rect x="0" y="13.84" width="16.5" height="40.32" /><rect x="88.5" y="13.84" width="16.5" height="40.32" />
          </g>
          {net.edges.map((e) => {
            const a = pos.get(e.a)!, b = pos.get(e.b)!;
            const on = !hover || e.a === hover || e.b === hover;
            return <line key={e.a + e.b} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} className="pn-edge"
              strokeWidth={0.35 + (e.n / maxN) * 1.9} opacity={on ? 0.25 + (e.n / maxN) * 0.7 : 0.06} />;
          })}
          {net.nodes.map((n) => {
            const p = who(n.id);
            const r = 1.6 + (n.passes / maxP) * 2.4;
            return (
              <g key={n.id} className={`pn-node ${hover === n.id ? "on" : ""}`} onMouseEnter={() => setHover(n.id)} opacity={!hover || hover === n.id || focus?.some((e) => e.a === n.id || e.b === n.id) ? 1 : 0.35}>
                <circle cx={X(n.x)} cy={Y(n.y)} r={r} />
                <text x={X(n.x)} y={Y(n.y) + 0.9}>{p?.number ?? ""}</text>
                <text x={X(n.x)} y={Y(n.y) + r + 2.6} className="pn-name">{p?.short ?? ""}</text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="mo2-detail">
        {hover && hp && focus ? (
          <><b>{hp.short}</b><span>{pos.get(hover)?.passes ?? 0} completed passes involved</span>
            {focus.slice(0, 3).map((e) => <span key={e.a + e.b}>{who(e.a === hover ? e.b : e.a)?.short} · {e.n}</span>)}</>
        ) : top ? (
          <span className="mo2-hint">Strongest link: {who(top.a)?.short} ↔ {who(top.b)?.short}, {top.n} passes. Hover a player to see who they connect with.</span>
        ) : null}
      </div>
    </div>
  );
}
