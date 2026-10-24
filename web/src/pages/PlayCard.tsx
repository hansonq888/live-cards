// One play as a card: a clear header (who, with what happened as a small subline), one key
// number (xG), a small shot map, and a single quiet footer line.
import type { Play } from "../live/protocol";
import { ShotMap } from "./ShotMap";
import { outcomeLabel, playHref } from "./summary";

export function PlayCard({ play, title }: { play: Play; title: string }) {
  const goal = play.outcome === "goal";
  const n = Math.round(Number(play.xg.toFixed(2)) * 10);
  return (
    <a className="l-card l-play" href={playHref(play.id)}>
      <div className="lp-head">
        <div>
          <div className="lp-name">{title}</div>
          <div className="lp-sub"><i className={goal ? "goal" : ""} />{outcomeLabel(play.outcome)} · {play.minute}′</div>
        </div>
        <div className="lp-num"><b>{play.xg.toFixed(2)}</b><span>xG</span></div>
      </div>
      <div className={`lp-visual ${goal ? "goal" : ""}`}><ShotMap ax={play.ax} ay={play.ay} xg={play.xg} goal={goal} /></div>
      <div className="lp-foot">
        <span>{n >= 1 ? `Scores ${n} in 10` : "Scores under 1 in 10"}</span>
        <span className="lp-go">Break it down →</span>
      </div>
    </a>
  );
}
