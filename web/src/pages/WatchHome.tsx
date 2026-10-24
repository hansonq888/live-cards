// Watch: a match page before the match. Pick how to watch (from kick-off, or straight to a
// goal) instead of being dropped into the broadcast.
import { Shell } from "./Shell";
import { formLevel } from "../ui/Overlays";
import { PlayCard } from "./PlayCard";
import { useSummary, type Summary } from "./summary";

const STATS: [string, string, (v: number) => string][] = [
  ["possession", "Possession", (v) => `${v.toFixed(0)}%`], ["xg", "Expected goals (xG)", (v) => v.toFixed(2)],
  ["shots", "Shots", String], ["shots_on_target", "Shots on target", String], ["passes", "Passes", String],
  ["pass_pct", "Pass accuracy", (v) => `${v.toFixed(0)}%`], ["tackles_won", "Tackles won", String],
  ["interceptions", "Interceptions", String], ["distance_km", "Distance covered", (v) => `${v.toFixed(1)} km`],
];
const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];
const ICON: Record<string, string> = { goal: "⚽", yellow: "▮", red: "▮", sub: "⇄" };

const at = (t: number) => `/?page=watch&start=${Math.max(0, Math.round(t))}`;

export function WatchHome() {
  const s = useSummary();
  const meta = s?.meta;
  const name = (id: string) => s?.players.find((p) => p.id === id)?.short ?? "";
  const goals = s?.plays.filter((p) => p.outcome === "goal") ?? [];
  return (
    <Shell page="watch">
      {meta && s && (
        <section className="hero-card w-match">
          <div className="wm-board">
            <span className="wm-status">Full time · {meta.venue}</span>
            <div className="wm-score">
              <span className="wm-team" style={{ background: meta.home.color }}><b>{meta.home.code}</b><em>{meta.home.name}</em></span>
              <span className="wm-num">{s.score[meta.home.code]}<i>–</i>{s.score[meta.away.code]}</span>
              <span className="wm-team" style={{ background: meta.away.color }}><b>{meta.away.code}</b><em>{meta.away.name}</em></span>
            </div>
          </div>
          <div className="wm-side">
            <div className="wm-cta">
              <a className="hc-btn primary wm-kick" href={at(0)}>▶ Watch from kick-off</a>
              <a className="hc-btn wm-kick" href="/?page=analyse">Analyse</a>
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
        <h2 className="mc-h">Top performers</h2>
        {[home, away].map((t) => (
          <div key={t.code} className="mc-col">
            <span className="mc-club"><i style={{ background: t.color }} />{t.name}</span>
            {top(t.code).map((p) => (
              <a key={p.id} className="mc-player" href={`/?page=players&id=${p.id}`}>
                <span className="mc-num" style={{ background: t.color }}>{p.number}</span>
                <span className="mc-pname"><b>{p.short}</b><em>{p.position}</em></span>
                <span className={`mc-form f${formLevel(p.rating)}`}>{FORM[formLevel(p.rating)]}</span>
              </a>
            ))}
          </div>
        ))}
      </section>
      <section className="mc-plays">
        <div className="l-head"><h2>Key plays</h2><a href="/?page=analyse">All {s.plays.length} plays</a></div>
        <div className="plays-grid four">
          {keyPlays.map((p) => <PlayCard key={p.id} play={p} title={`${name(p.player)} · ${p.outcome === "goal" ? "goal" : "chance"}`} />)}
        </div>
      </section>
    </div>
  );
}
