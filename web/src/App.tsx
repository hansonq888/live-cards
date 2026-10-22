import { useEffect } from "react";
import { live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { DirectorTicker, GoalBanner, PlayerCard, ScoreBug } from "./ui/Overlays";
import { Controls, SidePanel } from "./ui/SidePanel";
import { ScaledStage } from "./ui/ScaledStage";

export default function App() {
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
          </ScaledStage>
          <Controls />
        </section>
        <SidePanel />
      </main>
    </div>
  );
}
