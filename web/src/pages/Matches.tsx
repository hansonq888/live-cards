// Matches (?page=watch with no game picked): every game, filterable by competition and result.
// Picking one opens its match centre; the choice is remembered, so Analyse, Players and the
// story pages follow it.
import { useEffect, useMemo, useState } from "react";
import { Shell } from "./Shell";
import { Crest } from "../ui/Crest";
import { CLUBS } from "../clubs";
import type { MatchListing } from "./summary";

const COMPS = ["All", "League", "Cup"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Sat 24 Oct" -> a number that sorts by date (one season, so month and day are enough). */
const day = (d: string) => { const m = d.match(/(\d+)\s+(\w{3})/); return m ? MONTHS.indexOf(m[2]) * 40 + Number(m[1]) : 0; };
const RESULTS = [["any", "Any result"], ["RIV", "Riverside win"], ["NGT", "Northgate win"], ["draw", "Draw"]] as const;

export function Matches() {
  const [ms, setMs] = useState<MatchListing[] | null>(null);
  const [comp, setComp] = useState<string>("All");
  const [result, setResult] = useState<string>("any");
  const [sort, setSort] = useState<"new" | "old">("new");
  useEffect(() => {
    fetch("/api/matches").then((r) => r.json()).then(setMs).catch(() => setMs([]));
  }, []);
  const winner = (m: MatchListing) => (m.score[m.home] > m.score[m.away] ? m.home : m.score[m.away] > m.score[m.home] ? m.away : "draw");
  const shown = useMemo(() => (ms ?? [])
    .filter((m) => comp === "All" || m.comp === comp)
    .filter((m) => result === "any" || winner(m) === result)
    .sort((a, b) => (sort === "new" ? 1 : -1) * (day(b.date) - day(a.date) || b.match - a.match)), [ms, comp, result, sort]);
  const go = (id: number, page: string) => `/?page=${page}&match=${id}`;
  return (
    <Shell page="watch">
      <div className="mh-filters">
        <div className="mh-chips" role="group" aria-label="Competition">
          {COMPS.map((c) => <button key={c} className={comp === c ? "on" : ""} onClick={() => setComp(c)}>{c}</button>)}
        </div>
        <select className="mh-select" value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result">
          {RESULTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select className="mh-select" value={sort} onChange={(e) => setSort(e.target.value as "new" | "old")} aria-label="Sort">
          <option value="new">Newest</option><option value="old">Oldest</option>
        </select>
        <span className="mh-count">{shown.length} match{shown.length === 1 ? "" : "es"}</span>
      </div>
      {!ms ? <p className="mh-wait">Loading matches…</p> : shown.length === 0 ? <p className="mh-wait">No matches for those filters.</p> : (
        <div className="mh-grid">
          {shown.map((m) => {
            const home = CLUBS[m.home], away = CLUBS[m.away], w = winner(m);
            return (
              <article key={m.match} className="mh-card" style={{ ["--home" as string]: home?.color, ["--away" as string]: away?.color }}>
                <div className="mh-strip">
                  <span className={`mh-comp ${m.comp.toLowerCase()}`}>{m.comp}</span>
                  <span className="mh-meta">{m.title} · {m.date} · {m.venue}</span>
                  <span className="mh-ft">FT</span>
                </div>
                <div className="mh-body">
                  <span className="mh-ghost h" aria-hidden="true"><Crest code={m.home} size={220} /></span>
                  <span className="mh-ghost a" aria-hidden="true"><Crest code={m.away} size={220} /></span>
                  <div className={`mh-side h ${w === m.home ? "won" : ""}`}>
                    <Crest code={m.home} size={42} />
                    <b>{home?.short ?? m.home}</b>
                    <ul>{m.goals.filter((g) => g.team === m.home).map((g, i) => <li key={i}>{g.name} {g.minute}′</li>)}</ul>
                  </div>
                  <div className="mh-big">{m.score[m.home]}<i>–</i>{m.score[m.away]}</div>
                  <div className={`mh-side a ${w === m.away ? "won" : ""}`}>
                    <Crest code={m.away} size={42} />
                    <b>{away?.short ?? m.away}</b>
                    <ul>{m.goals.filter((g) => g.team === m.away).map((g, i) => <li key={i}>{g.name} {g.minute}′</li>)}</ul>
                  </div>
                </div>
                <div className="mh-actions">
                  <a className="mh-btn primary" href={go(m.match, "watch")}>Match centre →</a>
                  <a className="mh-btn" href={go(m.match, "analyse")}>Analyse</a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
