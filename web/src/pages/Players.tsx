import { useState } from "react";
// Players: everyone who played, their form in words, and (on a player's page) their numbers
// explained and the plays they were part of.
import { formLevel } from "../ui/Overlays";
import { Shell } from "./Shell";
import { PlayCard } from "./PlayCard";
import { Flame } from "../ui/Flame";
import { Avatar } from "../ui/Avatar";
import { Crest } from "../ui/Crest";
import { outcomeLabel, useSummary, type PlayerSummary, type Summary } from "./summary";

const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];

function Form({ rating }: { rating: number }) {
  const level = formLevel(rating);
  return (
    <span className="l-form">
      <span className={`l-meter f${level}`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}</span>
      <span className="l-form-word">{level === 4 && <Flame />}{FORM[level]}</span>
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
          </section>
          {s && <Directory s={s} />}
        </>
      )}
    </Shell>
  );
}

const GROUPS: [string, (role: string) => boolean][] = [
  ["All", () => true], ["Forwards", (r) => r === "ST" || r === "W"], ["Midfielders", (r) => r === "CM" || r === "AM" || r === "DM"],
  ["Defenders", (r) => r === "CB" || r === "FB"], ["Goalkeepers", (r) => r === "GK"],
];
const SORTS: [string, (p: PlayerSummary) => number][] = [
  ["Form", (p) => p.rating], ["Distance", (p) => p.stats.distance_km ?? 0], ["Top speed", (p) => p.stats.top_speed_kmh ?? 0], ["Passes", (p) => p.stats.passes_completed ?? 0],
];

function Directory({ s }: { s: Summary }) {
  const [club, setClub] = useState("all");
  const [group, setGroup] = useState("All");
  const [sort, setSort] = useState("Form");
  const g = GROUPS.find((x) => x[0] === group)![1];
  const key = SORTS.find((x) => x[0] === sort)![1];
  const rows = s.players.filter((p) => (club === "all" || p.team === club) && g(p.role)).sort((a, b) => key(b) - key(a));
  const teamOf = (code: string) => (code === s.meta.home.code ? s.meta.home : s.meta.away);
  return (
    <>
      <div className="pd-bar">
        <div className="bx-tabs">
          <button className={club === "all" ? "on" : ""} onClick={() => setClub("all")}>Both clubs</button>
          {[s.meta.home, s.meta.away].map((t) => <button key={t.code} className={club === t.code ? "on" : ""} onClick={() => setClub(t.code)}><Crest code={t.code} size={20} />{t.name}</button>)}
        </div>
        <div className="pd-chips">{GROUPS.map(([k]) => <button key={k} className={group === k ? "on" : ""} onClick={() => setGroup(k)}>{k}</button>)}</div>
        <label className="pd-sort">Sort by <select value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([k]) => <option key={k}>{k}</option>)}</select></label>
      </div>
      <p className="pd-count">{rows.length} players from this match</p>
      <div className="l-grid players">
        {rows.map((p) => {
          const [first, last] = split(p.name);
          const team = teamOf(p.team);
          return (
            <a key={p.id} className="l-card l-player" style={{ ["--club" as string]: team.color }} href={`/?page=players&id=${p.id}`}>
              <span className="lpl-num"><Avatar player={p} color={team.color} size={128} bare /></span>
              <span className="lpl-pos">{p.position}</span>
              <span className="lpl-name"><small>{first}</small>{last}</span>
              <span className="lpl-club"><Crest code={team.code} size={20} />{team.name}</span>
              <span className="lpl-form"><Form rating={p.rating} /></span>
            </a>
          );
        })}
      </div>
    </>
  );
}

type Tab = "overview" | "stats" | "plays";

function PlayerPage({ p, s }: { p: PlayerSummary; s: Summary }) {
  const [tab, setTab] = useState<Tab>("overview");
  const team = p.team === s.meta.home.code ? s.meta.home : s.meta.away;
  const [first, last] = split(p.name);
  const st = p.stats;
  const plays = s.plays.filter((x) => p.plays.includes(x.id));
  const goal = plays.find((x) => x.outcome === "goal");
  const n = (v: number | undefined, d = 0) => (v ?? 0).toFixed(d);
  const explained: [string, string, string][] = [
    ["Distance", `${n(st.distance_km, 1)} km`, `in ${Math.round(st.minutes)} minutes`],
    ["Top speed", `${n(st.top_speed_kmh, 1)} km/h`, st.sprints ? `${st.sprints} sprint${st.sprints === 1 ? "" : "s"} (25.2 km/h or faster, held for a second)` : (st.top_speed_kmh ?? 0) >= 25.2 ? "touched sprint pace but never held it for a second" : "never reached sprint pace (25.2 km/h)"],
    ["Passing", `${st.passes_completed}/${st.passes}`, `${n(st.pass_pct)}% completed · average difficulty ${n(st.avg_difficulty, 1)} of 10`],
    ["Shots", `${st.shots}`, st.shots ? `${st.goals} goal${st.goals === 1 ? "" : "s"} · chances worth ${n(st.xg, 2)} xG` : "no shots"],
  ];
  const groups: [string, [string, string][]][] = [
    ["Attack", [["Goals", `${st.goals}`], ["Shots", `${st.shots}`], ["Shots on target", `${st.shots_on_target}`], ["xG", n(st.xg, 2)], ["Chances created", `${st.chances_created}`]]],
    ["Possession", [["Passes completed", `${st.passes_completed} (${n(st.pass_pct)}%)`], ["Forward passes", `${st.forward_passes}`], ["Average pass difficulty", `${n(st.avg_difficulty, 1)} / 10`]]],
    ["Physical", [["Minutes played", `${Math.round(st.minutes)}`], ["Distance", `${n(st.distance_km, 1)} km`], ["Top speed", `${n(st.top_speed_kmh, 1)} km/h`], ["Sprints", `${st.sprints}`], ["High-intensity runs", `${st.hi_runs}`]]],
    ["Defence", [["Tackles won", `${st.tackles_won}`], ["Interceptions", `${st.interceptions}`], ["Pressures that won the ball", `${st.pressures_won}`]]],
  ];
  return (
    <div className="pp-grid">
      <aside className="pp-side">
        <section className="l-phead pp-hero" style={{ ["--team" as string]: team.color }}>
          <div className="pp-id">
            <span className="pp-bust"><Avatar player={p} color={team.color} size={200} bare /></span>
            <div>
              <Crest code={team.code} size={44} className="pp-crest" />
              <h1><small>{first}</small>{last}</h1>
              <p className="pp-club">{team.name} · {p.number} {p.position}</p>
            </div>
          </div>
        </section>
        <section className="l-card pp-facts">
          <div><span>Club</span><b className="pp-clubfact"><Crest code={team.code} size={20} />{team.name}</b></div>
          <div><span>Position</span><b>{p.position}</b></div>
          <div><span>Number</span><b>{p.number}</b></div>
          <div><span>Minutes</span><b>{Math.round(st.minutes)}</b></div>
          <div><span>Rating</span><b>{p.rating.toFixed(1)}</b></div>
          <div><span>Form</span><b><Form rating={p.rating} /></b></div>
          <div className="pp-actions">
            {goal ? <a className="l-btn primary" href={`/?page=play&play=${goal.id}`}>Break down goal</a>
              : plays[0] && <a className="l-btn primary" href={`/?page=play&play=${plays[0].id}`}>Break down chance</a>}
            <a className="l-btn" href="/?page=players">All players</a>
          </div>
        </section>
      </aside>
      <div className="pp-main">
        <nav className="pp-tabs">
          {(["overview", "stats", "plays"] as const).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ overview: "Overview", stats: "Stats", plays: `Plays (${plays.length})` }[t]}</button>
          ))}
        </nav>
        {tab === "overview" && (
          <>
            <div className="pp-tiles">
              <div className="l-card"><span>Rating</span><b>{p.rating.toFixed(1)}</b></div>
              <div className="l-card"><span>Goals</span><b>{st.goals}</b></div>
              <div className="l-card"><span>Distance</span><b>{n(st.distance_km, 1)}<small> km</small></b></div>
              <div className="l-card"><span>Top speed</span><b>{n(st.top_speed_kmh, 1)}<small> km/h</small></b></div>
            </div>
            <section className="l-card pp-explained">
              <h3>The numbers, explained</h3>
              {explained.map(([label, value, meaning]) => (
                <div key={label} className="pp-row"><span>{label}</span><div><b>{value}</b><p>{meaning}</p></div></div>
              ))}
              <a className="pp-link" href="/?page=learn">How these are calculated →</a>
            </section>
          </>
        )}
        {tab === "stats" && (
          <div className="pp-groups">
            {groups.map(([title, rows]) => (
              <section key={title} className="l-card pp-group">
                <h3>{title}</h3>
                {rows.map(([label, value]) => <div key={label} className="pp-stat"><span>{label}</span><b>{value}</b></div>)}
              </section>
            ))}
          </div>
        )}
        {tab === "plays" && (plays.length ? (
          <div className="l-grid">{plays.map((x) => <PlayCard key={x.id} play={x} title={`${outcomeLabel(x.outcome)} · ${x.minute}′`} />)}</div>
        ) : <p className="l-muted">No shots this match. Their work shows in the stats.</p>)}
      </div>
    </div>
  );
}
