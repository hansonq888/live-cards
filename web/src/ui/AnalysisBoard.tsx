// The analysis board under the pitch, in tabs: Chances (xG race and the shot map), Flow
// (momentum and leaders), Box score, and the Live feed on its own.
import { useState, type ReactNode } from "react";
import { live, useLive } from "../live/store";
import { useSummary, type Summary } from "../pages/summary";
import { BoxScore } from "../pages/WatchHome";
import { XgRace } from "./XgRace";
import { Avatar } from "./Avatar";
import { Feed } from "./SidePanel";

function Block({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`bd-block ${className}`}><h3 className="bd-h">{title}</h3>{children}</section>;
}

type Tab = "chances" | "flow" | "box" | "feed";
const TABS: [Tab, string][] = [["chances", "Chances"], ["flow", "Flow & leaders"], ["box", "Box score"], ["feed", "Live feed"]];

export function AnalysisBoard() {
  const s = useSummary();
  const feed = useLive((x) => x.feed.length);
  const [tab, setTab] = useState<Tab>(() => {
    try { return (localStorage.getItem("fn.boardTab") as Tab) || "chances"; } catch { return "chances"; }
  });
  const go = (t: Tab) => { setTab(t); try { localStorage.setItem("fn.boardTab", t); } catch { /* storage may be blocked */ } };
  return (
    <div className="board all">
      <nav className="bd-tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => go(k)}>
            {label}{k === "feed" && feed > 0 && <i>{feed}</i>}
          </button>
        ))}
      </nav>
      {!s ? <div className="board-empty">Loading the match…</div>
        : tab === "chances" ? (
          <div className="bd-row xm">
            <Block title="xG race"><XgRace /></Block>
            <Block title="Shot map"><ShotMapAll s={s} /></Block>
          </div>
        ) : tab === "flow" ? (
          <div className="bd-row">
            <Block title="Momentum"><Momentum s={s} /></Block>
            <Block title="Leaders"><Leaders s={s} /></Block>
          </div>
        ) : tab === "box" ? <BoxScore s={s} />
        : (
          <Block title="Live feed" className="bd-feedblock">
            {feed > 0 ? <div className="bd-feed"><Feed /></div> : <p className="bd-empty">Lines appear here as moments happen. Press play, or jump to a moment on the timeline.</p>}
          </Block>
        )}
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
  const plays = useLive((st) => st.plays);  // live: only the shots taken so far
  const current = useLive((st) => st.buildup?.goal);
  const [hover, setHover] = useState<string | null>(null);
  const name = (id: string) => s.players.find((p) => p.id === id)?.short ?? "";
  // Both halves: home attacks right, away attacks left (pitch metres, x to the right).
  const X = (x: number) => 52.5 + x, Y = (y: number) => 34 - y;
  const shown = plays.find((p) => p.id === (hover ?? current));
  const tally = (code: string) => {
    const ps = plays.filter((p) => p.team === code);
    return { shots: ps.length, goals: ps.filter((p) => p.outcome === "goal").length, xg: ps.reduce((t, p) => t + p.xg, 0) };
  };
  return (
    <div className="bd sma">
      <div className="sma-teams">
        {[away, home].map((t) => {
          const k = tally(t.code);
          return (
            <span key={t.code} className="sma-team" style={{ ["--team" as string]: t.color }}>
              <b>{t.code}</b><span>{k.shots} shots · {k.goals} goal{k.goals === 1 ? "" : "s"} · {k.xg.toFixed(2)} xG</span>
            </span>
          );
        })}
      </div>
      <div className="sma-wrap">
        <svg viewBox="-2 -2 109 72" className="sm-all">
          <rect x="0" y="0" width="105" height="68" className="sma-pitch" />
          <line x1="52.5" y1="0" x2="52.5" y2="68" className="sma-line" />
          <circle cx="52.5" cy="34" r="9.15" className="sma-line" />
          <rect x="0" y="13.84" width="16.5" height="40.32" className="sma-line" /><rect x="88.5" y="13.84" width="16.5" height="40.32" className="sma-line" />
          <rect x="0" y="24.84" width="5.5" height="18.32" className="sma-line" /><rect x="99.5" y="24.84" width="5.5" height="18.32" className="sma-line" />
          {plays.map((p) => {
            const team = p.team === home.code ? home : away;
            const dir = p.team === home.code ? 1 : -1;
            const cx = X(p.ax * dir), cy = Y(p.ay * dir);
            const goal = p.outcome === "goal", on = p.id === hover || p.id === current;
            const r = 1.2 + p.xg * 7;
            return (
              <g key={p.id} data-id={p.id} data-who={name(p.player)} className={`sma-shot ${on ? "on" : ""}`} onClick={() => live.showMe(p.id)}
                onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                {on && <line x1={cx} y1={cy} x2={dir > 0 ? 105 : 0} y2={34} className="sma-path" stroke={team.color} />}
                <circle cx={cx} cy={cy} r={r} fill={goal ? team.color : "#fff"} fillOpacity={goal ? 1 : 0.9} stroke={team.color} strokeWidth={on ? 1 : 0.6} />
                {goal && <circle cx={cx} cy={cy} r={r + 1.1} fill="none" stroke="#fff" strokeWidth={0.45} />}
              </g>
            );
          })}
        </svg>
        {shown && (
          <div className="sma-tip">
            <b>{name(shown.player)} {shown.minute}′</b>
            <span>{shown.outcome === "goal" ? "Goal" : shown.outcome.replace("_", " ")} · xG {shown.xg.toFixed(2)}</span>
            <em>▶ Click to show me</em>
          </div>
        )}
      </div>
      <div className="sma-key"><span><i className="k-big" />bigger = better chance</span><span><i className="k-goal" />goal</span></div>
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
            <span className="ld-name"><span className="ld-bust"><Avatar player={p} color={colour(p.team)} size={40} bare /></span>{p.short}</span>
            <span className="ld-bar"><i style={{ width: `${(100 * val(p)) / top}%`, background: colour(p.team) }} /></span>
            <b>{def[2](val(p))}</b>
          </a>
        ))}
      </div>
    </div>
  );
}
