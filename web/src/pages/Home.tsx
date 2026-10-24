// Home: the match at a glance, the plays worth studying, and the way in to each stat.
import { Shell } from "./Shell";
import { ShotMap } from "./ShotMap";
import { outcomeLabel, playHref, useSummary, xgWords } from "./summary";

export function Home() {
  const s = useSummary();
  const meta = s?.meta;
  const name = (id: string) => s?.players.find((p) => p.id === id)?.short ?? id;
  const goals = s?.plays.filter((p) => p.outcome === "goal") ?? [];
  const chances = [...(s?.plays ?? [])].filter((p) => p.outcome !== "goal").sort((a, b) => b.xg - a.xg).slice(0, 3);
  const featured = [...goals, ...chances];
  return (
    <Shell page="home">
      <section className="l-hero">
        <p className="l-eyebrow">Match analysis, explained</p>
        <h1>Understand every moment.</h1>
        <p className="l-lede">Every attack replayed from tracking data. Every stat explained in plain words. Every claim checked by AI agents before you see it.</p>
        <div className="l-cta">
          <a className="l-btn primary" href="/?page=analyse">Analyse the plays</a>
          <a className="l-btn" href="/?page=watch">Watch the match</a>
        </div>
      </section>

      {meta && s && (
        <section className="l-card l-result">
          <div className="lr-team"><i style={{ background: meta.home.color }} />{meta.home.name}</div>
          <div className="lr-score">{s.score[meta.home.code]} – {s.score[meta.away.code]}</div>
          <div className="lr-team right">{meta.away.name}<i style={{ background: meta.away.color }} /></div>
          <div className="lr-meta">Full time · {meta.venue}</div>
          <div className="lr-goals">
            {goals.map((g) => <span key={g.id}>{name(g.player)} {g.minute}′</span>)}
          </div>
        </section>
      )}

      <section className="l-section">
        <div className="l-head"><h2>Plays to break down</h2><a href="/?page=analyse">All {s?.plays.length ?? ""} plays</a></div>
        <div className="l-grid">
          {featured.map((p) => (
            <a key={p.id} className="l-card l-play" href={playHref(p.id)}>
              <div className="lp-top">
                <span className={`l-badge ${p.outcome === "goal" ? "goal" : ""}`}>{outcomeLabel(p.outcome)}</span>
                <span className="lp-min">{p.minute}′</span>
              </div>
              <ShotMap ax={p.ax} ay={p.ay} xg={p.xg} goal={p.outcome === "goal"} />
              <div className="lp-name">{name(p.player)}</div>
              <div className="lp-xg"><b>xG {p.xg.toFixed(2)}</b> · a chance like this {xgWords(p.xg)}</div>
              <span className="lp-go">Break it down →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="l-section">
        <div className="l-head"><h2>Learn the numbers</h2><a href="/?page=learn">All stats</a></div>
        <div className="l-grid">
          {[
            ["xg", "Expected goals (xG)", "How likely a shot is to go in, from where it was taken."],
            ["space_control", "Space control", "Which team would win the race to each part of the pitch."],
            ["pass_difficulty", "Pass difficulty", "How hard a pass was: distance, pressure, where it went."],
          ].map(([id, title, text]) => (
            <a key={id} className="l-card l-learn" href={`/?page=learn#${id}`}>
              <h3>{title}</h3><p>{text}</p><span className="lp-go">Learn with a real play →</span>
            </a>
          ))}
        </div>
      </section>
    </Shell>
  );
}
