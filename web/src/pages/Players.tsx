// Players: everyone who played, their form in words, and (on a player's page) their numbers
// explained and the plays they were part of.
import { formLevel } from "../ui/Overlays";
import { Shell } from "./Shell";
import { PlayCard } from "./PlayCard";
import { outcomeLabel, useSummary, type PlayerSummary, type Summary } from "./summary";

const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];

function Form({ rating }: { rating: number }) {
  const level = formLevel(rating);
  return (
    <span className="l-form">
      <span className={`l-meter f${level}`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}</span>
      {FORM[level]}
    </span>
  );
}

const split = (name: string) => [name.split(" ").slice(0, -1).join(" "), name.split(" ").slice(-1)[0]];

export function Players() {
  const s = useSummary();
  const id = new URLSearchParams(location.search).get("id");
  const player = s?.players.find((p) => p.id === id);
  return (
    <Shell page="players">
      {player && s ? <PlayerPage p={player} s={s} /> : (
        <>
          <section className="l-hero small">
            <p className="l-eyebrow">Players</p>
            <h1>Who played, and how.</h1>
            <p className="l-lede">Form in words, numbers explained. Pick a player to see their match.</p>
          </section>
          {s && [s.meta.home, s.meta.away].map((team) => (
            <section key={team.code} className="l-section">
              <div className="l-head"><h2><i className="l-dot" style={{ background: team.color }} />{team.name}</h2></div>
              <div className="l-grid players">
                {s.players.filter((p) => p.team === team.code).sort((a, b) => b.rating - a.rating).map((p) => {
                  const [first, last] = split(p.name);
                  return (
                    <a key={p.id} className="l-card l-player" href={`/?page=players&id=${p.id}`}>
                      <span className="lpl-num" style={{ color: team.color }}>{p.number}</span>
                      <span className="lpl-name"><small>{first}</small>{last}</span>
                      <span className="lpl-pos">{p.position}</span>
                      <Form rating={p.rating} />
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </Shell>
  );
}

function PlayerPage({ p, s }: { p: PlayerSummary; s: Summary }) {
  const team = p.team === s.meta.home.code ? s.meta.home : s.meta.away;
  const [first, last] = split(p.name);
  const st = p.stats;
  const plays = s.plays.filter((x) => p.plays.includes(x.id));
  const explained: [string, string, string][] = [
    ["Distance", `${st.distance_km?.toFixed(1)} km`, `in ${Math.round(st.minutes)} minutes`],
    ["Top speed", `${st.top_speed_kmh?.toFixed(1)} km/h`, st.sprints ? `${st.sprints} sprint${st.sprints === 1 ? "" : "s"} (25.2 km/h or faster, held for a second)` : (st.top_speed_kmh ?? 0) >= 25.2 ? "touched sprint pace but never held it for a second, which is what counts as a sprint" : "never reached sprint pace (25.2 km/h)"],
    ["Passing", `${st.passes_completed}/${st.passes}`, `${st.pass_pct?.toFixed(0)}% completed · average difficulty ${st.avg_difficulty?.toFixed(1)} of 10`],
    ["Shots", `${st.shots}`, st.shots ? `${st.goals} goal${st.goals === 1 ? "" : "s"} · chances worth ${st.xg?.toFixed(2)} xG` : "no shots"],
    ["Defending", `${(st.tackles_won ?? 0) + (st.interceptions ?? 0)}`, `${st.tackles_won} tackles won · ${st.interceptions} interceptions`],
  ];
  return (
    <>
      <section className="l-phead" style={{ ["--team" as string]: team.color }}>
        <div>
          <p className="l-eyebrow on-dark">{team.name} · #{p.number} · {p.position}</p>
          <h1><small>{first}</small>{last}</h1>
        </div>
        <a className="l-btn" href="/?page=players">All players</a>
      </section>
      <section className="l-card l-facts">
        <div><span>Form</span><b><Form rating={p.rating} /></b></div>
        <div><span>Rating</span><b>{p.rating.toFixed(1)}</b></div>
        <div><span>Minutes</span><b>{Math.round(st.minutes)}</b></div>
        <div><span>Goals</span><b>{st.goals}</b></div>
      </section>
      <section className="l-section">
        <div className="l-head"><h2>The numbers, explained</h2><a href="/?page=learn">How they're calculated</a></div>
        <div className="l-card l-explained">
          {explained.map(([label, value, meaning]) => (
            <div key={label}><span>{label}</span><b>{value}</b><p>{meaning}</p></div>
          ))}
        </div>
      </section>
      <section className="l-section">
        <div className="l-head"><h2>Plays</h2></div>
        {plays.length ? (
          <div className="l-grid">
            {plays.map((x) => (
              <PlayCard key={x.id} play={x} title={outcomeLabel(x.outcome)} />
            ))}
          </div>
        ) : <p className="l-muted">No shots this match. Their work shows in the numbers above.</p>}
      </section>
    </>
  );
}
