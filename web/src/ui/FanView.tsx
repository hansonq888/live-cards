// Fan view: the broadcast, full screen, nothing else. Controls appear when you move the mouse.
import { useEffect, useRef, useState } from "react";
import { live, useLang, useLive } from "../live/store";
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
  const timer = useRef<number>();
  const wake = () => {
    setActive(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), 2800);
  };
  useEffect(() => { wake(); return () => window.clearTimeout(timer.current); }, []);
  return (
    <div className={`fan-view ${active || askOpen ? "awake" : ""}`} onMouseMove={wake}>
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
        <button className="round" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}>{paused ? "▶" : "❚❚"}</button>
        <Timeline />
        <ExplainGoalButton />
        <ProfilePicker />
        <StatRingPicker />
        <button className="ghost" onClick={onStudio}>{tr(lang, "studio")}</button>
        <button className={`ask-btn ${askOpen ? "open" : ""}`} onClick={() => setAskOpen((o) => !o)} aria-expanded={askOpen}>{askOpen ? "✕" : tr(lang, "ask")}</button>
      </div>
      {askOpen && <div className="ask-drawer"><Ask /></div>}
    </div>
  );
}
