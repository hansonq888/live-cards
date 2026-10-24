// Fan view: the broadcast, full screen, nothing else. Controls appear when you move the mouse.
import { Icon } from "./Icon";
import { useEffect, useRef, useState } from "react";
import { clock, live, useLang, useLive } from "../live/store";
import { t as tr } from "../i18n";
import { Viewer } from "../viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./Overlays";
import { ScaledStage } from "./ScaledStage";
import { Ask, ProfilePicker, StatRingPicker } from "./SidePanel";
import { Timeline } from "./Timeline";

export function FanView({ onStudio }: { onStudio: () => void }) {
  const paused = useLive((s) => s.paused);
  const lang = useLang();
  const [active, setActive] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const t = useLive((s) => s.t);
  const timer = useRef<number>();
  const wake = () => {
    setActive(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), 2800);
  };
  useEffect(() => { wake(); return () => window.clearTimeout(timer.current); }, []);
  return (
    <div className={`fan-view ${active || askOpen || viewOpen ? "awake" : ""}`} onMouseMove={wake}>
      <ScaledStage fit="contain">
        <Viewer />
        <ScoreBug />
        <PlayerCard />
        <DirectorTicker />
        <GoalBanner />
        <RedTeamPanel />
        <RevisitBadge />
        <BuildUpPanel />
      </ScaledStage>
      <div className="fan-bar" onMouseMove={(e) => e.stopPropagation()} onMouseEnter={() => { window.clearTimeout(timer.current); setActive(true); }}>
        <Timeline />
        <div className="fb-row">
          <button className="round" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={18} /></button>
          <span className="fb-clock">{clock(t)}</span>
          <ExplainGoalButton />
          <span className="fb-spacer" />
          <div className="fb-menu">
            <button className={`ghost ${viewOpen ? "on" : ""}`} onClick={() => setViewOpen((o) => !o)} aria-expanded={viewOpen}>{tr(lang, "view")} <Icon name="chevron" size={14} /></button>
            {viewOpen && <div className="fb-pop"><ProfilePicker /><StatRingPicker /></div>}
          </div>
          <button className="ghost" onClick={onStudio}>{tr(lang, "analyse")}</button>
          <button className={`ask-btn ${askOpen ? "open" : ""}`} onClick={() => setAskOpen((o) => !o)} aria-expanded={askOpen}>{askOpen ? <Icon name="close" /> : <><Icon name="chat" /> {tr(lang, "ask")}</>}</button>
        </div>
      </div>
      {askOpen && <div className="ask-drawer"><Ask /></div>}
    </div>
  );
}
