// Home: the match at a glance, the plays worth studying, and the way in to each stat.
import { Bands } from "../ui/Bolts";
import { Shell } from "./Shell";
import { PlayCard } from "./PlayCard";
import { STAT_LOOK, StatVisual } from "./StatVisual";
import { stat, useRegistry } from "../live/stats";
import { useSummary } from "./summary";
import { Crest } from "../ui/Crest";
import { Doodle } from "../ui/Doodle";

const possessive = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);

// A white zigzag band behind the player, in the spirit of matchday posters.
function Bolt() {
  return (
    <svg className="vs2-bolt" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="58,0 82,0 66,34 84,34 60,74 78,74 44,160 20,160 40,92 22,92 46,52 28,52" />
      <polygon points="88,0 100,0 100,30 92,30" opacity=".5" />
    </svg>
  );
}

export function Home() {
  const s = useSummary();
  useRegistry();  // stat names and thresholds
  const meta = s?.meta;
  const name = (id: string) => s?.players.find((p) => p.id === id)?.short ?? id;
  const goals = s?.plays.filter((p) => p.outcome === "goal") ?? [];
  const chances = [...(s?.plays ?? [])].filter((p) => p.outcome !== "goal").sort((a, b) => b.xg - a.xg).slice(0, 3);
  // One featured play (the equaliser, the match's turning point) and four more around it.
  const lead = goals.find((g) => g.player === "RIV-09") ?? goals[0];
  const rest = [...goals.filter((g) => g !== lead), ...chances].slice(0, 4);
  return (
    <Shell page="home">
      <Doodle className="home-doodle" look="chalk" />
      <section className="hero-card">
        <Bands className="hero-bands" corners="right" />
        <div className="hc-text">
          <p className="hc-eyebrow">Match analysis, explained</p>
          <h1>Understand every <span>moment.</span></h1>
          <p className="hc-lede">Every attack replayed from tracking data. Every stat explained in plain words. Every claim checked by AI agents before you see it.</p>
          <div className="hc-cta">
            <a className="hc-btn" href="/?page=watch">Watch the match</a>
            <a className="hc-btn primary" href="/?page=analyse">Analyse the plays</a>
          </div>
        </div>
        {meta && s && (
          <div className="vs2">
            {[meta.home, meta.away].map((t, side) => {
              return (
                <a key={t.code} className={`vs2-team ${side ? "away" : "home"}`} href="/?page=watch" style={{ ["--club" as string]: t.color }}>
                  <Bolt />
                  <span className="vs2-crest"><Crest code={t.code} size={96} /></span>
                  <span className="vs2-name">{t.name}</span>
                  <ul className="vs2-goals">{goals.filter((g) => g.team === t.code).map((g) => <li key={g.id}>{name(g.player)} {g.minute}′</li>)}</ul>
                </a>
              );
            })}
            <div className="vs2-mid">
              <span className="vs2-tag">Latest result</span>
              <b>{s.score[meta.home.code]}<i>–</i>{s.score[meta.away.code]}</b>
              <span className="vs2-ft">Full time</span>
              <span className="vs2-when">Sat 24 Oct · {meta.venue}</span>
            </div>
          </div>
        )}
      </section>

      <section className="l-section">
        <div className="l-head"><h2>Plays to break down</h2><a href="/?page=analyse">All {s?.plays.length ?? ""} plays</a></div>
        <div className="plays-grid">
          {lead && <PlayCard play={lead} title={`${possessive(name(lead.player))} equaliser`} feature />}
          {rest.map((p) => <PlayCard key={p.id} play={p} title={`${possessive(name(p.player))} ${p.outcome === "goal" ? "goal" : "chance"}`} />)}
        </div>
      </section>

      <section className="l-section">
        <div className="l-head"><h2>Learn the numbers</h2><a href="/?page=learn">All stats</a></div>
        <div className="stat-grid">
          {Object.entries(STAT_LOOK).map(([id, look]) => (
            <a key={id} className="stat-card" href={`/?page=learn#${id}`}>
              <StatVisual id={id} />
              <span className={`sc-chip t-${look.tint}`}>{look.short}</span>
              <h3>{stat(id)?.name ?? look.short}</h3>
              <p>{look.line}</p>
            </a>
          ))}
        </div>
      </section>
    </Shell>
  );
}
