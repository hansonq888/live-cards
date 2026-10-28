// Watch: a match page before the match. Pick how to watch (from kick-off, or straight to a
// goal) instead of being dropped into the broadcast.
import { CurvedBolts } from "../ui/Bolts";
import { Shell } from "./Shell";
import { formLevel } from "../ui/Overlays";
import { PlayCard } from "./PlayCard";
import { Avatar } from "../ui/Avatar";
import { useState } from "react";
import { matchId, useSummary, type Summary } from "./summary";
import { Crest } from "../ui/Crest";
import { club } from "../clubs";

const STATS: [string, string, (v: number) => string][] = [
  ["possession", "Possession", (v) => `${v.toFixed(0)}%`], ["xg", "Expected goals (xG)", (v) => v.toFixed(2)],
  ["shots", "Shots", String], ["shots_on_target", "Shots on target", String], ["passes", "Passes", String],
  ["pass_pct", "Pass accuracy", (v) => `${v.toFixed(0)}%`], ["tackles_won", "Tackles won", String],
  ["interceptions", "Interceptions", String], ["distance_km", "Distance covered", (v) => `${v.toFixed(1)} km`],
];
const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];
const ICON: Record<string, string> = { goal: "⚽", yellow: "▮", red: "▮", sub: "⇄" };

const at = (t: number) => `/?page=watch&start=${Math.max(0, Math.round(t))}`;

// The few numbers that most explain a rating, in words.
function why(st: Record<string, number>) {
  const n = (v: number | undefined, one: string, many = `${one}s`) => (v ? `${v} ${v === 1 ? one : many}` : "");
  return [n(st.goals, "goal"), n(st.chances_created, "chance created", "chances created"), n(st.shots_on_target, "shot on target", "shots on target"),
    n((st.tackles_won ?? 0) + (st.interceptions ?? 0), "ball won", "balls won")].filter(Boolean).slice(0, 3).join(" · ");
}

export function WatchHome() {
  const s = useSummary();
  const meta = s?.meta;
  const name = (id: string) => s?.players.find((p) => p.id === id)?.short ?? "";
  const goals = s?.plays.filter((p) => p.outcome === "goal") ?? [];
  return (
    <Shell page="watch">
      {meta && s && (
        <section className="hero-card w-match">
          <CurvedBolts className="hero-bolts" />
          <div className="wm-board">
            <span className="wm-status">Full time · {meta.venue}</span>
            <div className="wm-score">
              <span className="wm-team" style={{ background: meta.home.color }}><Crest code={meta.home.code} size={56} /><b>{meta.home.code}</b><em>{meta.home.name}</em></span>
              <span className="wm-num">{s.score[meta.home.code]}<i>–</i>{s.score[meta.away.code]}</span>
              <span className="wm-team" style={{ background: meta.away.color }}><Crest code={meta.away.code} size={56} /><b>{meta.away.code}</b><em>{meta.away.name}</em></span>
            </div>
          </div>
          <div className="wm-side">
            <div className="wm-cta">
              <a className="hc-btn primary wm-kick" href={at(0)}>▶ Watch from kick-off</a>
              <a className="hc-btn wm-kick" href={`/?page=analyse&match=${matchId()}`}>Analyse</a>
            </div>
            <span className="wm-label">Or jump to a goal</span>
            <div className="wm-goals">
              {goals.map((g) => (
                <a key={g.id} className="wm-goal" href={at(g.t - 25)}>
                  <b>{g.minute}′</b><span>{name(g.player)}</span><i style={{ background: meta.players.find((x) => x.id === g.player)?.team === meta.home.code ? meta.home.color : meta.away.color }} />
                </a>
              ))}
            </div>
            <p className="wm-hint">Starts 25 seconds before the goal, so you see the move.</p>
          </div>
        </section>
      )}
      {meta && s && <MatchCentre s={s} />}
    </Shell>
  );
}

function MatchCentre({ s }: { s: Summary }) {
  const { home, away } = s.meta;
  const name = (id: string) => s.players.find((p) => p.id === id)?.short ?? "";
  const top = (code: string) => s.players.filter((p) => p.team === code).sort((a, b) => b.rating - a.rating).slice(0, 3);
  const keyPlays = [...s.plays].sort((a, b) => (b.outcome === "goal" ? 1 : 0) - (a.outcome === "goal" ? 1 : 0) || b.xg - a.xg).slice(0, 4);
  return (
    <div className="mc">
      <section className="mc-plays">
        <div className="l-head"><h2>Key plays</h2><a href={`/?page=analyse&match=${matchId()}`}>All {s.plays.length} plays</a></div>
        <div className="plays-grid four">
          {keyPlays.map((p) => <PlayCard key={p.id} play={p} title={`${name(p.player)} · ${p.outcome === "goal" ? "goal" : "chance"}`} />)}
        </div>
      </section>
      <section className="l-card mc-timeline">
        <h2 className="mc-h">Match timeline</h2>
        <div className="mc-teams"><span><i style={{ background: home.color }} />{home.name}</span><span>{away.name}<i style={{ background: away.color }} /></span></div>
        <ol>
          <li className="mc-mark">Kick-off</li>
          {s.events.map((e, i) => (
            <li key={i} className={`mc-ev ${e.team === home.code ? "home" : "away"} ev-${e.type}`}>
              <span className="mc-min">{e.minute}′</span>
              <span className="mc-what"><b className="mc-icon">{ICON[e.type] ?? "•"}</b>{name(e.player)}{e.type === "sub" && e.off ? <em> on for {name(e.off)}</em> : null}</span>
            </li>
          ))}
          <li className="mc-mark">Full time · {s.score[home.code]}–{s.score[away.code]}</li>
        </ol>
      </section>
      <section className="l-card mc-stats">
        <h2 className="mc-h">Team stats</h2>
        <div className="mc-teams"><span><i style={{ background: home.color }} />{home.code}</span><span>{away.code}<i style={{ background: away.color }} /></span></div>
        {STATS.map(([k, label, f]) => {
          const a = s.team[home.code][k], b = s.team[away.code][k], share = a + b ? (100 * a) / (a + b) : 50;
          return (
            <div key={k} className="mc-row">
              <div className="mc-vals"><b className={a > b ? "lead" : ""}>{f(a)}</b><span>{label}</span><b className={b > a ? "lead" : ""}>{f(b)}</b></div>
              <div className="mc-bar"><i style={{ width: `${share}%`, background: home.color }} /><i style={{ width: `${100 - share}%`, background: away.color }} /></div>
            </div>
          );
        })}
        <a className="mc-link" href="/?page=learn">What do these mean? →</a>
      </section>
      <section className="l-card mc-top">
        <div className="mc-h-row">
          <h2 className="mc-h">Top performers</h2>
          <span className="mc-h-note">Ranked by match rating: everyone starts at 6.0, and goals, chances and tackles move it up to 10. <a href="/?page=learn#rating">How it works →</a></span>
        </div>
        {[home, away].map((t) => (
          <div key={t.code} className="mc-col">
            <span className="mc-club"><Crest code={t.code} size={22} />{t.name}</span>
            {top(t.code).map((p, i) => (
              <a key={p.id} className="mc-player" style={{ ["--club" as string]: t.color }} href={`/?page=players&id=${p.id}`}>
                <span className="mc-rank">{i + 1}</span>
                <span className="mc-bust"><Avatar player={p} color={t.color} size={84} bare /></span>
                <span className="mc-pname"><b>{p.short}</b><em>{p.position}</em><small>{why(p.stats)}</small></span>
                <span className="mc-score"><span className="mc-rl">Rating</span><b>{p.rating.toFixed(1)}</b><span className={`mc-form f${formLevel(p.rating)}`}>{FORM[formLevel(p.rating)]}</span></span>
              </a>
            ))}
          </div>
        ))}
      </section>
      <BoxScore s={s} />
      <Clubs s={s} />
    </div>
  );
}

const COLS: [string, string, (p: Summary["players"][number]) => number, (v: number) => string][] = [
  ["min", "Min", (p) => p.stats.minutes ?? 0, (v) => String(Math.round(v))],
  ["rating", "Rating", (p) => p.rating, (v) => v.toFixed(1)],
  ["goals", "G", (p) => p.stats.goals ?? 0, String],
  ["shots", "Sh", (p) => p.stats.shots ?? 0, String],
  ["sot", "SoT", (p) => p.stats.shots_on_target ?? 0, String],
  ["xg", "xG", (p) => p.stats.xg ?? 0, (v) => v.toFixed(2)],
  ["cc", "Key passes", (p) => p.stats.chances_created ?? 0, String],
  ["passes", "Passes", (p) => p.stats.passes_completed ?? 0, String],
  ["pct", "Pass %", (p) => p.stats.pass_pct ?? 0, (v) => `${Math.round(v)}`],
  ["tkl", "Tkl", (p) => p.stats.tackles_won ?? 0, String],
  ["int", "Int", (p) => p.stats.interceptions ?? 0, String],
  ["dist", "Dist (km)", (p) => p.stats.distance_km ?? 0, (v) => v.toFixed(1)],
  ["top", "Top km/h", (p) => p.stats.top_speed_kmh ?? 0, (v) => v.toFixed(1)],
];

export function BoxScore({ s }: { s: Summary }) {
  const [team, setTeam] = useState(s.meta.home.code);
  const [sort, setSort] = useState("rating");
  const t = team === s.meta.home.code ? s.meta.home : s.meta.away;
  const col = COLS.find((c) => c[0] === sort)!;
  const rows = s.players.filter((p) => p.team === team).sort((a, b) => col[2](b) - col[2](a));
  const best: Record<string, number> = Object.fromEntries(COLS.map((c) => [c[0], Math.max(...rows.map(c[2]))]));
  return (
    <section className="l-card bx">
      <div className="bx-head">
        <h2 className="mc-h">Player stats</h2>
        <div className="bx-tabs">
          {[s.meta.home, s.meta.away].map((x) => (
            <button key={x.code} className={team === x.code ? "on" : ""} onClick={() => setTeam(x.code)}><Crest code={x.code} size={20} />{x.name}</button>
          ))}
        </div>
      </div>
      <div className="bx-wrap">
        <table className="bx-table">
          <thead>
            <tr>
              <th className="bx-name">Player</th>
              {COLS.map(([k, label]) => <th key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{label}{sort === k ? " ↓" : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="bx-name"><a href={`/?page=players&id=${p.id}`}><span className="bx-num" style={{ background: t.color }}>{p.number}</span><b>{p.short}</b><em>{p.position}</em></a></td>
                {COLS.map(([k, , get, fmt]) => { const v = get(p); return <td key={k} className={v > 0 && v === best[k] ? "best" : ""}>{fmt(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="bx-note">Click a column to sort. Bold marks the team's best. G goals, Sh shots, SoT shots on target, Tkl tackles won, Int interceptions.</p>
    </section>
  );
}

/** Who's playing: each club's crest, nickname, ground and a line of history. */
function Clubs({ s }: { s: Summary }) {
  return (
    <section className="l-card mc-clubs">
      <h2 className="mc-h">The clubs</h2>
      <div className="cl-grid">
        {[s.meta.home, s.meta.away].map((t, i) => {
          const c = club(t.code);
          return (
            <div key={t.code} className="cl-club" style={{ ["--club" as string]: t.color }}>
              <Crest code={t.code} size={88} />
              <div className="cl-text">
                <span className="cl-side">{i === 0 ? "Home" : "Away"}</span>
                <h3>{t.name}</h3>
                {c && <>
                  <p className="cl-nick">“{c.nickname}” · {c.city}, {c.region}</p>
                  <dl>
                    <div><dt>Founded</dt><dd>{c.founded}</dd></div>
                    <div><dt>Ground</dt><dd>{c.stadium}</dd></div>
                    <div><dt>Capacity</dt><dd>{c.capacity.toLocaleString("en-GB")}</dd></div>
                  </dl>
                  <p className="cl-hist">{c.history}</p>
                </>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
