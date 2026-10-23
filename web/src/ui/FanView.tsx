// Fan view: the broadcast, full screen, nothing else. Controls appear when you move the mouse.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";
import { Viewer } from "../viewer/Viewer";
import { DirectorTicker, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./Overlays";
import { ScaledStage } from "./ScaledStage";
import { Ask, ProfilePicker } from "./SidePanel";
import { Timeline } from "./Timeline";

export function FanView({ onStudio }: { onStudio: () => void }) {
  const paused = useLive((s) => s.paused);
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
      </ScaledStage>
      <div className="fan-bar" onMouseMove={(e) => e.stopPropagation()} onMouseEnter={() => { window.clearTimeout(timer.current); setActive(true); }}>
        <button className="round" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}>{paused ? "▶" : "❚❚"}</button>
        <Timeline />
        <ProfilePicker />
        <button className="ghost" onClick={onStudio}>Studio view</button>
        <span className="fan-note">Synthetic match · fictional clubs</span>
      </div>
      <button className={`ask-fab ${askOpen ? "open" : ""}`} onClick={() => setAskOpen((o) => !o)}>{askOpen ? "✕" : "Ask"}</button>
      {askOpen && <div className="ask-drawer"><Ask /></div>}
    </div>
  );
}
