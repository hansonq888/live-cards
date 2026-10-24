// The analysis board under the pitch: four views of the whole match, one at a time.
// xG race (live), momentum by 5-minute window, a shot map, and stat leaders.
import { useState } from "react";
import { live } from "../live/store";
import { useSummary, type Summary } from "../pages/summary";
import { XgRace } from "./XgRace";

type View = "xg" | "momentum" | "shots" | "leaders";
const VIEWS: [View, string][] = [["xg", "xG race"], ["momentum", "Momentum"], ["shots", "Shot map"], ["leaders", "Leaders"]];

export function AnalysisBoard() {
  const [view, setView] = useState<View>("xg");
  const s = useSummary();
  return (
    <div className="board">
      <nav className="board-tabs">
        {VIEWS.map(([k, label]) => <button key={k} className={view === k ? "on" : ""} onClick={() => setView(k)}>{label}</button>)}
      </nav>
      {view === "xg" ? <XgRace /> : !s ? <div className="board-empty">Loading the match…</div>
        : view === "momentum" ? <Momentum s={s} /> : view === "shots" ? <ShotMapAll s={s} /> : <Leaders s={s} />}
    </div>
  );
}

function Momentum({ s }: { s: Summary }) {
  const { home, away } = s.meta;
  const get = (b: Summary["flow"][number], c: string) => b[c] as { passes: number; shots: number };
  return (
    <div className="bd">
      <p className="bd-note">Share of passes in each 5-minute window. A bar above the line means {home.name} had more of the ball; below, {away.name}. Dots are shots.</p>
      <div className="mo">
        {s.flow.map((b) => {
          const h = get(b, home.code), a = get(b, away.code), tot = h.passes + a.passes || 1;
          const hs = (h.passes / tot - 0.5) * 2;
          return (
            <div key={b.minute as number} className="mo-col" title={`${b.minute}–${(b.minute as number) + 5}′: ${home.code} ${h.passes} passes, ${away.code} ${a.passes}`}>
              <div className="mo-top">{hs > 0 && <i style={{ height: `${hs * 100}%`, background: home.color }} />}{Array.from({ length: h.shots }, (_, k) => <em key={k} style={{ background: home.color }} />)}</div>
              <div className="mo-bot">{hs < 0 && <i style={{ height: `${-hs * 100}%`, background: away.color }} />}{Array.from({ length: a.shots }, (_, k) => <em key={k} style={{ background: away.color }} />)}</div>
              <span>{(b.minute as number) % 15 === 0 ? `${b.minute}′` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShotMapAll({ s }: { s: Summary }) {
  const { home, away } = s.meta;
  const name = (id: string) => s.players.find((p) => p.id === id)?.short ?? "";
  // Both halves: home attacks right, away attacks left (pitch metres, x to the right).
  const X = (x: number) => 52.5 + x, Y = (y: number) => 34 - y;
  return (
    <div className="bd">
      <p className="bd-note">Every shot. {home.name} attack right, {away.name} attack left. Bigger means a better chance; filled means a goal. Click a shot to break it down.</p>
      <svg viewBox="-2 -2 109 72" className="sm-all">
        <rect x="0" y="0" width="105" height="68" className="sma-pitch" />
        <line x1="52.5" y1="0" x2="52.5" y2="68" className="sma-line" />
        <circle cx="52.5" cy="34" r="9.15" className="sma-line" />
        <rect x="0" y="13.84" width="16.5" height="40.32" className="sma-line" /><rect x="88.5" y="13.84" width="16.5" height="40.32" className="sma-line" />
        <rect x="0" y="24.84" width="5.5" height="18.32" className="sma-line" /><rect x="99.5" y="24.84" width="5.5" height="18.32" className="sma-line" />
        {s.plays.map((p) => {
          const team = p.team === home.code ? home : away;
          const dir = p.team === home.code ? 1 : -1;
          const x = p.ax * dir, y = p.ay * dir;
          const goal = p.outcome === "goal";
          return (
            <g key={p.id} className="sma-shot" onClick={() => live.breakdown(p.id)}>
              <circle cx={X(x)} cy={Y(y)} r={1.2 + p.xg * 7} fill={goal ? team.color : "rgba(255,255,255,.85)"} stroke={team.color} strokeWidth={0.6} />
              <title>{`${p.minute}′ ${name(p.player)} · ${p.outcome.replace("_", " ")} · xG ${p.xg.toFixed(2)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const STATS: [string, string, (v: number) => string][] = [
  ["rating", "Rating", (v) => v.toFixed(1)], ["distance_km", "Distance", (v) => `${v.toFixed(1)} km`],
  ["top_speed_kmh", "Top speed", (v) => `${v.toFixed(1)} km/h`], ["passes_completed", "Passes completed", String],
  ["xg", "xG", (v) => v.toFixed(2)], ["shots", "Shots", String], ["tackles_won", "Tackles won", String],
  ["interceptions", "Interceptions", String], ["hi_runs", "High-intensity runs", String],
];

function Leaders({ s }: { s: Summary }) {
  const [stat, setStat] = useState("distance_km");
  const def = STATS.find((x) => x[0] === stat)!;
  const val = (p: Summary["players"][number]) => (stat === "rating" ? p.rating : p.stats[stat] ?? 0);
  const rows = [...s.players].sort((a, b) => val(b) - val(a)).slice(0, 8);
  const top = val(rows[0]) || 1;
  const colour = (code: string) => (code === s.meta.home.code ? s.meta.home.color : s.meta.away.color);
  return (
    <div className="bd">
      <div className="ld-picks">{STATS.map(([k, label]) => <button key={k} className={stat === k ? "on" : ""} onClick={() => setStat(k)}>{label}</button>)}</div>
      <div className="ld">
        {rows.map((p, i) => (
          <a key={p.id} className="ld-row" href={`/?page=players&id=${p.id}`}>
            <span className="ld-rank">{i + 1}</span>
            <span className="ld-name"><i style={{ background: colour(p.team) }} />{p.short}</span>
            <span className="ld-bar"><i style={{ width: `${(100 * val(p)) / top}%`, background: colour(p.team) }} /></span>
            <b>{def[2](val(p))}</b>
          </a>
        ))}
      </div>
    </div>
  );
}
