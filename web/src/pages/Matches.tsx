// The Analyse hub (?page=analyse with no match picked): every match the app can break down,
// with its result and scorers. Picking one opens Analyse on it; the choice is remembered, so
// the Match, Players and story pages follow it.
import { useEffect, useState } from "react";
import { Shell } from "./Shell";
import { Crest } from "../ui/Crest";
import { CLUBS } from "../clubs";
import type { MatchListing } from "./summary";

export function Matches() {
  const [ms, setMs] = useState<MatchListing[] | null>(null);
  useEffect(() => {
    fetch("/api/matches").then((r) => r.json()).then(setMs).catch(() => setMs([]));
  }, []);
  const go = (id: number, page: string) => `/?page=${page}&match=${id}`;
  return (
    <Shell page="analyse">
      <section className="mh-head">
        <h1>Analyse a match</h1>
        <p>Pick a match to replay any play, follow any player and see every stat explained.</p>
      </section>
      {!ms ? <p className="mh-wait">Loading matches…</p> : (
        <div className="mh-grid">
          {ms.map((m) => {
            const home = CLUBS[m.home], away = CLUBS[m.away];
            const winner = m.score[m.home] > m.score[m.away] ? m.home : m.score[m.away] > m.score[m.home] ? m.away : null;
            return (
              <article key={m.match} className="mh-card" style={{ ["--home" as string]: home?.color, ["--away" as string]: away?.color }}>
                <div className="mh-top"><span className="mh-tag">Full time</span><span>{m.title} · {m.date} · {m.venue}</span><span className="mh-plays">{m.plays} plays</span></div>
                <div className="mh-score">
                  <div className={`mh-team ${winner === m.home ? "won" : ""}`}><Crest code={m.home} size={64} /><b>{home?.short ?? m.home}</b></div>
                  <div className="mh-num">{m.score[m.home]}<i>–</i>{m.score[m.away]}</div>
                  <div className={`mh-team ${winner === m.away ? "won" : ""}`}><Crest code={m.away} size={64} /><b>{away?.short ?? m.away}</b></div>
                </div>
                <ul className="mh-goals">
                  {m.goals.map((g, i) => (
                    <li key={i} className={g.team === m.home ? "h" : "a"}>⚽ {g.name} {g.minute}′</li>
                  ))}
                </ul>
                <div className="mh-actions">
                  <a className="mh-btn primary" href={go(m.match, "analyse")}>Analyse →</a>
                  <a className="mh-btn" href={go(m.match, "watch")}>Match centre</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
