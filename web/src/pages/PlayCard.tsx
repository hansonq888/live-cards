// One play, news-card style: a club-colour media tile on top (the player's cut-out, the minute,
// the shot map as an inset), then a bold headline and a quiet subline underneath.
import type { Play } from "../live/protocol";
import { ShotMap } from "./ShotMap";
import { outcomeLabel, playHref, useSummary } from "./summary";
import { Avatar } from "../ui/Avatar";

export function PlayCard({ play, title, feature = false }: { play: Play; title: string; feature?: boolean }) {
  const goal = play.outcome === "goal";
  const n = Math.round(Number(play.xg.toFixed(2)) * 10);
  const s = useSummary();
  const p = s?.players.find((x) => x.id === play.player);
  const club = p && s ? (p.team === s.meta.home.code ? s.meta.home.color : s.meta.away.color) : "#4b2bd6";
  return (
    <a className={`l-play ${feature ? "feature" : ""}`} href={playHref(play.id)}>
      <div className={`lp-visual media ${goal ? "goal" : ""}`} style={{ ["--club" as string]: club }}>
        <span className="lp-min" aria-hidden="true">{play.minute}′</span>
        <span className={`lp-tag ${goal ? "goal" : ""}`}>{outcomeLabel(play.outcome)}</span>
        <div className="lp-map"><ShotMap ax={play.ax} ay={play.ay} xg={play.xg} goal={goal} /></div>
        {p && <span className="lp-bust"><Avatar player={p} color={club} size={feature ? 300 : 170} bare /></span>}
      </div>
      {feature && <span className="lp-kicker">Featured play</span>}
      <h3 className="lp-title">{title}</h3>
      <p className="lp-meta">{play.minute}′ · xG {play.xg.toFixed(2)} · {n >= 1 ? `scores ${n} in 10` : "scores under 1 in 10"}</p>
      {feature && <span className="lp-cta">Break it down, touch by touch →</span>}
    </a>
  );
}
