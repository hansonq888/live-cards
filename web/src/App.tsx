import { useEffect } from "react";
import { live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { DirectorTicker, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./ui/Overlays";
import { Controls, ProfilePicker, SidePanel } from "./ui/SidePanel";
import { ScaledStage } from "./ui/ScaledStage";
import { Timeline } from "./ui/Timeline";
import { Console } from "./console/Console";

export default function App() {
  return new URLSearchParams(location.search).get("view") === "console" ? <Console /> : <Viewer2 />;
}

function Viewer2() {
  const meta = useLive((s) => s.meta);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    live.connect(Number(q.get("speed") ?? 1), Number(q.get("start") ?? 0));
  }, []);
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><span className="dot" />Live Cards</div>
        <div className="fixture">{meta ? `${meta.home.name} v ${meta.away.name} · ${meta.venue}` : "Connecting…"}</div>
        <ProfilePicker />
        <a className="switch-view" href="/?view=console" target="_blank" rel="noreferrer">Console ↗</a>
        <div className="synthetic">SYNTHETIC MATCH · FICTIONAL CLUBS AND PLAYERS</div>
      </header>
      <main className="main">
        <section className="broadcast">
          <ScaledStage>
            <Viewer />
            <ScoreBug />
            <PlayerCard />
            <DirectorTicker />
            <GoalBanner />
            <RedTeamPanel />
            <RevisitBadge />
          </ScaledStage>
          <Timeline />
          <Controls />
        </section>
        <SidePanel />
      </main>
    </div>
  );
}
