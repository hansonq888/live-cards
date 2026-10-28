// Plays (?page=plays): the curated, teach-me layer. Every attack that ended in a shot, as a
// card that opens its scroll story; the best of them featured on top. Analyse has the raw
// breakdown tool; this is where a fan goes to understand one move properly.
import { useState } from "react";
import { Shell } from "./Shell";
import { PlayCard } from "./PlayCard";
import { Crest } from "../ui/Crest";
import { matchId, playHref, useSummary, xgWords } from "./summary";

const FILTERS = [["all", "All"], ["goal", "Goals"], ["big", "Big chances"], ["saved", "Saved"]] as const;
type Filter = typeof FILTERS[number][0];
const possessive = (n: string) => (n.endsWith("s") ? `${n}'` : `${n}'s`);

export function Plays() {
  const s = useSummary();
  const [filter, setFilter] = useState<Filter>("all");
  const [team, setTeam] = useState<string | null>(null);
  if (!s) return <Shell page="plays"><p className="mh-wait">Loading plays…</p></Shell>;
  const { home, away } = s.meta;
  const name = (id: string) => s.players.find((p) => p.id === id)?.short ?? "";
  // Featured: the latest goal, the moment the match turned on.
  const goals = s.plays.filter((p) => p.outcome === "goal");
  const lead = goals[goals.length - 1] ?? [...s.plays].sort((a, b) => b.xg - a.xg)[0];
  const shown = s.plays
    .filter((p) => p.id !== lead?.id)
    .filter((p) => !team || p.team === team)
    .filter((p) => filter === "all" || (filter === "goal" ? p.outcome === "goal" : filter === "big" ? p.xg >= 0.15 : p.outcome === "saved"));
  const title = (p: typeof s.plays[number]) => `${possessive(name(p.player))} ${p.outcome === "goal" ? "goal" : "chance"}`;
  return (
    <Shell page="plays">
      <section className="pl-feature">
        {lead && (
          <>
            <div className="pl-card"><PlayCard play={lead} title={title(lead)} feature /></div>
            <div className="pl-copy">
              <span className="pl-kicker">Play of the match</span>
              <h1>{title(lead)}, {lead.minute}′</h1>
              <p>A chance like this {xgWords(lead.xg)}. Walk through every touch that built it, guess how good the chance was, and see where the space opened up.</p>
              <div className="pl-ctas">
                <a className="pl-btn primary" href={playHref(lead.id)}>Start the play-by-play →</a>
                <a className="pl-btn" href={`/?page=analyse&showme=${encodeURIComponent(lead.id)}`}>▶ Watch it on the board</a>
              </div>
              <a className="pl-match" href={`/?page=watch&match=${matchId()}`}>
                <Crest code={home.code} size={22} />{home.name} {s.score[home.code]}–{s.score[away.code]} {away.name}<Crest code={away.code} size={22} />
              </a>
            </div>
          </>
        )}
      </section>
      <div className="mh-filters pl-filters">
        <div className="mh-chips" role="group" aria-label="Kind of play">
          {FILTERS.map(([k, label]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}</button>)}
        </div>
        <div className="mh-chips" role="group" aria-label="Team">
          <button className={!team ? "on" : ""} onClick={() => setTeam(null)}>Both</button>
          {[home, away].map((t) => <button key={t.code} className={team === t.code ? "on" : ""} onClick={() => setTeam(t.code)}>{t.code}</button>)}
        </div>
        <span className="mh-count">{shown.length} play{shown.length === 1 ? "" : "s"}</span>
      </div>
      {shown.length === 0 ? <p className="mh-wait">No plays for those filters.</p> : (
        <div className="plays-grid pl-grid">{shown.map((p) => <PlayCard key={p.id} play={p} title={title(p)} />)}</div>
      )}
    </Shell>
  );
}
