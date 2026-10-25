import { useState } from "react";
// Players: everyone who played, their form in words, and (on a player's page) their numbers
// explained and the plays they were part of.
import { formLevel } from "../ui/Overlays";
import { Shell } from "./Shell";
import { PlayCard } from "./PlayCard";
import { Flame } from "../ui/Flame";
import { Avatar } from "../ui/Avatar";
import { Crest } from "../ui/Crest";
import { CLUBS } from "../clubs";
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
          {s && <Directory s={s} />}
        </>
      )}
    </Shell>
  );
}

// A squad page per club, the way a club site lists its players: by line, keeper first.
const LINES: [string, (role: string) => boolean][] = [
  ["Goalkeepers", (r) => r === "GK"], ["Defenders", (r) => r === "CB" || r === "FB"],
  ["Midfielders", (r) => r === "CM" || r === "AM" || r === "DM"], ["Forwards", (r) => r === "ST" || r === "W"],
];

function Directory({ s }: { s: Summary }) {
  const [club, setClub] = useState(s.meta.home.code);
  const [hover, setHover] = useState<string | null>(null);
  const team = club === s.meta.home.code ? s.meta.home : s.meta.away;
  const info = CLUBS[club];
  const squad = s.players.filter((p) => p.team === club);
  const best = [...squad].sort((a, b) => b.rating - a.rating)[0];
  return (
    <>
      <div className="sq-tabs">
        {[s.meta.home, s.meta.away].map((t) => (
          <button key={t.code} className={club === t.code ? "on" : ""} style={{ ["--club" as string]: t.color }} onClick={() => setClub(t.code)}>
            <Crest code={t.code} size={28} />{t.name}
          </button>
        ))}
      </div>
      <section className="sq-head" style={{ ["--club" as string]: team.color }}>
        <Crest code={club} size={96} />
        <div className="sq-id">
          <h2>{team.name}</h2>
          {info && <p>{info.nickname} · {info.stadium}, {info.city} · founded {info.founded}</p>}
        </div>
        {best && <a className="sq-best" href={`/?page=players&id=${best.id}`}><span>Best in this match</span><b>{best.short}</b><em>{best.rating.toFixed(1)}</em></a>}
      </section>
      <div className="sq-split">
        <Lineup s={s} club={club} hover={hover} setHover={setHover} />
        <div className="sq-list">
          {LINES.map(([line, is]) => {
            const rows = squad.filter((p) => is(p.role)).sort((a, b) => a.number - b.number);
            if (!rows.length) return null;
            return (
              <section key={line} className="sq-line">
                <h3>{line}<span>{rows.length}</span></h3>
                {rows.map((p) => {
                  const [first, last] = split(p.name);
                  return (
                    <a key={p.id} className={`sq-row ${hover === p.id ? "on" : ""}`} style={{ ["--club" as string]: team.color }} href={`/?page=players&id=${p.id}`}
                      onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
                      <span className="sq-bust"><Avatar player={p} color={team.color} size={56} bare /></span>
                      <span className="sq-name"><small>{first}</small><b>{last}</b><em>{p.position} · #{p.number}{p.starter ? "" : ` · came on, ${Math.round(p.stats.minutes ?? 0)} min`}</em></span>
                      <span className="sq-form"><Form rating={p.rating} /></span>
                      <span className={`sq-r f${formLevel(p.rating)}`}>{p.rating.toFixed(1)}</span>
                    </a>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

// The starting XI in their lines, attacking up the page, from each player's formation spot; the
// list beside it holds everyone, substitutes included. Hovering either highlights both.
function Lineup({ s, club, hover, setHover }: { s: Summary; club: string; hover: string | null; setHover: (id: string | null) => void }) {
  const team = club === s.meta.home.code ? s.meta.home : s.meta.away;
  const squad = s.players.filter((p) => p.team === club);
  const xi = squad.filter((p) => p.starter && p.spot);
  const top = (x: number) => 14 + ((14 - x) / 64) * 76;  // keeper (-48) near the bottom, forwards near the top
  const left = (y: number) => 8 + ((30 - y) / 60) * 84;  // facing up, the right flank is on the right
  return (
    <section className="lu" style={{ ["--club" as string]: team.color }}>
      <div className="lu-pitch">
        <svg className="lu-lines" viewBox="0 0 68 76" preserveAspectRatio="none" aria-hidden="true">
          <rect x=".4" y="-1" width="67.2" height="76.6" /><line x1="0" y1="20" x2="68" y2="20" />
          <circle cx="34" cy="20" r="9.15" /><rect x="13.85" y="58" width="40.3" height="16.6" /><rect x="24.85" y="69.1" width="18.3" height="5.5" />
        </svg>
        <span className="lu-form">{CLUBS[club]?.short ?? team.name} · {(team as { formation?: string }).formation ?? ""}</span>
        {xi.map((p) => (
          <a key={p.id} className={`lu-p ${hover === p.id ? "on" : ""}`} href={`/?page=players&id=${p.id}`} style={{ top: `${top(p.spot![0])}%`, left: `${left(p.spot![1])}%` }}
            onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
            <span className="lu-bust"><Avatar player={p} color={team.color} size={70} bare /></span>
            <span className="lu-name">{p.short}</span>
            <span className={`lu-r f${formLevel(p.rating)}`}>{p.rating.toFixed(1)}</span>
          </a>
        ))}
      </div>
    </section>
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
              <h1 style={{ fontSize: `${Math.min(46, 172 / (last.length * 0.58))}px` }}><small>{first}</small>{last}</h1>
              <p className="pp-club">{p.position} · #{p.number}</p>
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
