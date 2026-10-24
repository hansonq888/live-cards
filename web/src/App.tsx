import { useEffect, useState } from "react";
import { live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./ui/Overlays";
import { Bolt } from "./ui/Bolt";
import { Controls, ProfilePicker, SidePanel, StatRingPicker } from "./ui/SidePanel";
import { ScaledStage } from "./ui/ScaledStage";
import { Timeline } from "./ui/Timeline";
import { Console } from "./console/Console";
import { FanView } from "./ui/FanView";

type View = "fan" | "studio";

/** Three views over one engine: Fan (default), Studio (?view=studio), Console (?view=console). */
export default function App() {
  const q = new URLSearchParams(location.search);
  if (q.get("view") === "console") return <Console />;
  return <Live initial={q.get("view") === "studio" ? "studio" : "fan"} />;
}

function Live({ initial }: { initial: View }) {
  const [view, setView] = useState<View>(initial);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    live.connect(Number(q.get("speed") ?? 1), Number(q.get("start") ?? 0));
  }, []);
  const go = (v: View) => {
    setView(v);
    const q = new URLSearchParams(location.search);
    if (v === "studio") q.set("view", "studio"); else q.delete("view");
    history.replaceState(null, "", `${location.pathname}${q.toString() ? "?" + q : ""}`);
  };
  return view === "fan" ? <FanView onStudio={() => go("studio")} /> : <Studio onFan={() => go("fan")} />;
}

function Studio({ onFan }: { onFan: () => void }) {
  const meta = useLive((s) => s.meta);
  return (
    <div className="app">
      <header className="top">
        <div className="brand"><Bolt size={22} />Live Cards <em className="studio-tag">Studio</em></div>
        <div className="fixture">{meta ? `${meta.home.name} v ${meta.away.name} · ${meta.venue}` : "Connecting…"}</div>
        <ProfilePicker />
        <StatRingPicker />
        <button className="switch-view" onClick={onFan}>Fan view</button>
        <a className="switch-view" href="/?view=console" target="_blank" rel="noreferrer">Console ↗</a>
        <div className="synthetic">Synthetic match</div>
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
            <BuildUpPanel />
          </ScaledStage>
          <div className="studio-row"><Timeline /><ExplainGoalButton /></div>
          <Controls />
        </section>
        <SidePanel />
      </main>
    </div>
  );
}
