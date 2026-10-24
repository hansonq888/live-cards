// One play, news-card style: the visual on top (shot map on a gradient tile), then a bold
// headline and a quiet subline underneath, with no box around the text.
import type { Play } from "../live/protocol";
import { ShotMap } from "./ShotMap";
import { outcomeLabel, playHref } from "./summary";

export function PlayCard({ play, title, feature = false }: { play: Play; title: string; feature?: boolean }) {
  const goal = play.outcome === "goal";
  const n = Math.round(Number(play.xg.toFixed(2)) * 10);
  return (
    <a className={`l-play ${feature ? "feature" : ""}`} href={playHref(play.id)}>
      <div className={`lp-visual ${goal ? "goal" : ""}`}>
        <span className={`lp-tag ${goal ? "goal" : ""}`}>{outcomeLabel(play.outcome)}</span>
        <ShotMap ax={play.ax} ay={play.ay} xg={play.xg} goal={goal} />
      </div>
      {feature && <span className="lp-kicker">Featured play</span>}
      <h3 className="lp-title">{title}</h3>
      <p className="lp-meta">{play.minute}′ · xG {play.xg.toFixed(2)} · {n >= 1 ? `scores ${n} in 10` : "scores under 1 in 10"}</p>
      {feature && <span className="lp-cta">Break it down, touch by touch →</span>}
    </a>
  );
}
