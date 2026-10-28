// Fan view: the broadcast, full screen, nothing else. Controls appear, YouTube-style, when the
// mouse is near the bottom of the screen (or the match is paused) and fade soon after it leaves.
import { matchId } from "../pages/summary";
import { BoardSwitch } from "../viewer/BoardSwitch";
import { Icon } from "./Icon";
import { useEffect, useRef, useState } from "react";
import { clock, live, useLang, useLive } from "../live/store";
import { t as tr } from "../i18n";
import { Viewer } from "../viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./Overlays";
import { ScaledStage } from "./ScaledStage";
import { Ask, ViewerSettings } from "./SidePanel";
import { Timeline } from "./Timeline";

export function FanView({ onStudio }: { onStudio: () => void }) {
  const paused = useLive((s) => s.paused);
  const lang = useLang();
  const [active, setActive] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const t = useLive((s) => s.t);
  const timer = useRef<number>();
  const sleepSoon = (ms = 1200) => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setActive(false), ms); };
  // Only the bottom of the screen wakes the controls, so watching (or pointing at a player) doesn't.
  const onMove = (e: React.MouseEvent) => {
    if (window.innerHeight - e.clientY < 160) { setActive(true); sleepSoon(); }
  };
  useEffect(() => { sleepSoon(2500); return () => window.clearTimeout(timer.current); }, []);
  return (
    <div className={`fan-view ${active || askOpen || paused ? "awake" : ""}`} onMouseMove={onMove}>
      <ScaledStage fit="contain">
        <Viewer />
        <BoardSwitch />
        <ScoreBug />
        <PlayerCard />
        <DirectorTicker />
        <GoalBanner />
        <RedTeamPanel />
        <RevisitBadge />
        <BuildUpPanel />
      </ScaledStage>
      <div className="fan-bar" onMouseMove={(e) => e.stopPropagation()}
        onMouseEnter={() => { window.clearTimeout(timer.current); setActive(true); }} onMouseLeave={() => sleepSoon()}>
        <Timeline />
        <div className="fb-row">
          <button className="fb-play" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={20} /></button>
          <span className="fb-clock">{clock(t)} <em>/ 90:00</em></span>
          <ExplainGoalButton />
          <span className="fb-spacer" />
          <a className="fb-link" href={`/?page=watch&match=${matchId()}`}><Icon name="back" size={14} /> Match centre</a>
          <button className="fb-link" onClick={onStudio}>{tr(lang, "analyse")}</button>
          <button className={`ask-btn ${askOpen ? "open" : ""}`} onClick={() => setAskOpen((o) => !o)} aria-expanded={askOpen}>{askOpen ? <Icon name="close" /> : <><Icon name="chat" /> {tr(lang, "ask")}</>}</button>
          <ViewerSettings />
        </div>
      </div>
      {askOpen && <div className="ask-drawer"><Ask /></div>}
    </div>
  );
}
