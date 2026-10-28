// The analysis board under the pitch, in tabs: Chances (xG race and the shot map), Flow
// (momentum and leaders), Box score, the Live feed, and Agents (each moment through the
// agent pipeline, with what it cost).
import { useState, type ReactNode } from "react";
import { live, useLive } from "../live/store";
import { useSummary, type Summary } from "../pages/summary";
import { BoxScore } from "../pages/WatchHome";
import { XgRace } from "./XgRace";
import { Avatar } from "./Avatar";
import { Feed } from "./SidePanel";
import { AgentTrace } from "./AgentTrace";

function Block({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`bd-block ${className}`}><h3 className="bd-h">{title}</h3>{children}</section>;
}

type Tab = "overview" | "box" | "feed" | "agents";
const TABS: [Tab, string][] = [["overview", "Overview"], ["box", "Box score"], ["feed", "Live feed"], ["agents", "Agents"]];

export function AnalysisBoard() {
  const s = useSummary();
  const feed = useLive((x) => x.feed.length);
  const [tab, setTab] = useState<Tab>(() => {
    try { const v = localStorage.getItem("fn.boardTab") as Tab; return TABS.some(([k]) => k === v) ? v : "overview"; } catch { return "overview"; }
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
        : tab === "overview" ? (
          <>
            <Block title="xG race"><XgRace /></Block>
            <div className="bd-row two">
              <Block title="Shot map"><ShotMapAll s={s} /></Block>
              <Block title="Momentum"><Momentum s={s} /></Block>
            </div>
          </>
        ) : tab === "box" ? <BoxScore s={s} />
        : tab === "agents" ? <Block title="Agents, live"><AgentTrace /></Block>
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
  const t = useLive((st) => st.t);
  const [hover, setHover] = useState<number | null>(null);
  const get = (b: Summary["flow"][number], c: string) => b[c] as { passes: number; shots: number };
  const goals = s.events.filter((e) => e.type === "goal");
  const rows = s.flow.map((b) => {
    const m = b.minute as number, h = get(b, home.code), a = get(b, away.code), tot = h.passes + a.passes || 1;
    return { m, h, a, share: h.passes / tot, g: goals.filter((e) => e.minute >= m && e.minute < m + 5) };
  });
  const won = { h: rows.filter((r) => r.share > 0.55).length, a: rows.filter((r) => r.share < 0.45).length };
  const name = (id: string) => s.players.find((p) => p.id === id)?.short ?? "";
  const cur = hover === null ? null : rows[hover];
  return (
    <div className="bd mo2">
      <div className="mo2-sum">
        <span style={{ color: home.color }}><b>{won.h}</b> windows on top</span>
        <span className="mo2-mid">Who had the ball, every 5 minutes · click to jump there</span>
        <span style={{ color: away.color }}><b>{won.a}</b> windows on top</span>
      </div>
      <div className="mo2-chart" onMouseLeave={() => setHover(null)}>
        <span className="mo2-team home" style={{ color: home.color }}>{home.code}</span>
        <span className="mo2-team away" style={{ color: away.color }}>{away.code}</span>
        {/* No "now" line after the final whistle: the whole match is in */}
        {t < 5400 - 1 && <div className="mo2-now" style={{ ["--f" as string]: Math.min(1, t / 5400) }} />}
        {rows.map((r, i) => {
          // Possession rarely strays far from 50%, so scale the lead: a 70/30 window fills the half.
          const d = Math.max(-1, Math.min(1, (r.share - 0.5) * 5));
          return (
            <button key={r.m} className={`mo2-col ${hover === i ? "on" : ""}`} onMouseEnter={() => setHover(i)}
              onClick={() => live.seekTo(r.m * 60)} aria-label={`${r.m}–${r.m + 5} minutes`}>
              <span className="mo2-up">{d > 0 && <i style={{ height: `${d * 100}%`, background: home.color }} />}</span>
              <span className="mo2-down">{d < 0 && <i style={{ height: `${-d * 100}%`, background: away.color }} />}</span>
              {r.h.shots > 0 && <em className="mo2-shots up">{r.h.shots}</em>}
              {r.a.shots > 0 && <em className="mo2-shots down">{r.a.shots}</em>}
              {r.g.map((g, k) => <b key={k} className={`mo2-goal ${g.team === home.code ? "up" : "down"}`}>⚽</b>)}
              <small>{r.m % 15 === 0 ? `${r.m}′` : ""}</small>
            </button>
          );
        })}
      </div>
      <div className="mo2-detail">
        {cur ? (
          <>
            <b>{cur.m}–{cur.m + 5}′</b>
            <span style={{ color: home.color }}>{home.code} {Math.round(cur.share * 100)}% · {cur.h.passes} passes · {cur.h.shots} shots</span>
            <span style={{ color: away.color }}>{away.code} {100 - Math.round(cur.share * 100)}% · {cur.a.passes} passes · {cur.a.shots} shots</span>
            {cur.g.map((g, k) => <span key={k} className="mo2-gl">⚽ {name(g.player)} {g.minute}′</span>)}
          </>
        ) : <span className="mo2-hint">Hover a bar for the detail. Taller means one team had more of the ball.</span>}
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
  const shown = plays.find((p) => p.id === (hover ?? current));
  const tally = (code: string) => {
    const ps = plays.filter((p) => p.team === code);
    return { shots: ps.length, goals: ps.filter((p) => p.outcome === "goal").length, xg: ps.reduce((t, p) => t + p.xg, 0) };
  };
  return (
    <div className="bd sma">
      <div className="sma-teams">
        {[home, away].map((t) => {
          const k = tally(t.code);
          return (
            <span key={t.code} className="sma-team" style={{ ["--team" as string]: t.color }}>
              <b>{t.code}</b><span>{k.shots} shots · {k.goals} goal{k.goals === 1 ? "" : "s"} · {k.xg.toFixed(2)} xG</span>
            </span>
          );
        })}
      </div>
      <div className="sma-wrap halves">
        {[home, away].map((team) => {
          const mine = plays.filter((p) => p.team === team.code);
          // Half-pitch, attacking up: goal line at the top. Pitch x (toward goal) -> up, y -> left/right.
          const PX = (y: number) => 34 - y, PY = (x: number) => 52.5 - x;
          return (
            <div key={team.code} className="sma-half" style={{ ["--team" as string]: team.color }}>
              <svg viewBox="-2 -4 72 40" className="sm-half">
                <defs>
                  <linearGradient id={`smg-${team.code}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={team.color} stopOpacity=".35" /><stop offset="1" stopColor={team.color} stopOpacity=".06" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="68" height="36" className="smh-grass" />
                <rect x="0" y="0" width="68" height="36" fill={`url(#smg-${team.code})`} />
                <rect x="13.84" y="0" width="40.32" height="16.5" className="sma-line" />
                <rect x="24.84" y="0" width="18.32" height="5.5" className="sma-line" />
                <path d="M 26.7 16.5 A 9.15 9.15 0 0 0 41.3 16.5" className="sma-line" />
                <rect x="30.34" y="-1.6" width="7.32" height="1.6" className="smh-goal" />
                {mine.map((p) => {
                  const cx = PX(p.ay), cy = PY(p.ax);  // ax/ay are already in the attacker's frame
                  const goal = p.outcome === "goal", on = p.id === hover || p.id === current;
                  const r = 0.9 + p.xg * 5;
                  return (
                    <g key={p.id} className={`sma-shot ${on ? "on" : ""}`} onClick={() => live.showMe(p.id)}
                      onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                      {on && <line x1={cx} y1={cy} x2="34" y2="0" className="sma-path" stroke="#fff" />}
                      {goal && <circle cx={cx} cy={cy} r={r + 1.6} className="smh-glow" />}
                      <circle cx={cx} cy={cy} r={r} fill={goal ? team.color : "#fff"} stroke={goal ? "#fff" : team.color} strokeWidth={on ? 0.7 : 0.45} />
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>
      <div className="sma-key"><span><i className="k-big" />bigger = better chance</span><span><i className="k-goal" />goal</span></div>
      {/* The hovered (or open) shot, in the space under the pitches */}
      <div className="mo2-detail sma-detail">
        {shown ? (
          <>
            <b style={{ color: shown.team === home.code ? home.color : away.color }}>{name(shown.player)} {shown.minute}′</b>
            <span>{shown.outcome === "goal" ? "Goal" : shown.outcome[0].toUpperCase() + shown.outcome.slice(1).replace("_", " ")}</span>
            <span>xG {shown.xg.toFixed(2)}</span>
            <span>{Math.round(Math.hypot(52.5 - shown.ax, shown.ay))} m out</span>
            <button className="sma-show" onClick={() => live.showMe(shown.id)}>▶ Show me</button>
          </>
        ) : <span className="mo2-hint">Hover a shot for the detail. Click one to replay it.</span>}
      </div>
    </div>
  );
}

const STATS: [string, string, (v: number) => string][] = [
  ["rating", "Rating", (v) => v.toFixed(1)], ["distance_km", "Distance", (v) => `${v.toFixed(1)} km`],
  ["top_speed_kmh", "Top speed", (v) => `${v.toFixed(1)} km/h`], ["passes_completed", "Passes completed", String],
  ["xg", "xG", (v) => v.toFixed(2)], ["shots", "Shots", String], ["tackles_won", "Tackles won", String],
  ["interceptions", "Interceptions", String], ["hi_runs", "High-intensity runs", String],
];

/** Leaders for the right-hand column of Analyse. */
export function LeadersPanel() {
  const s = useSummary();
  if (!s) return null;
  return <section className="lp-side"><h3 className="bd-h">Leaders</h3><Leaders s={s} /></section>;
}

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
