import { useEffect, useState } from "react";
import { BoardSwitch } from "./viewer/BoardSwitch";
import { Icon } from "./ui/Icon";
import { live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./ui/Overlays";
import { Bolt } from "./ui/Bolt";
import { Controls, Plays, SidePanel, ViewMenu } from "./ui/SidePanel";
import { Home } from "./pages/Home";
import { Learn } from "./pages/Learn";
import { Players } from "./pages/Players";
import { ScaledStage } from "./ui/ScaledStage";
import { Timeline } from "./ui/Timeline";
import { Console } from "./console/Console";
import { FanView } from "./ui/FanView";
import { VisionView } from "./vision/VisionView";

type View = "fan" | "studio";

/** The platform: light pages (Home, Learn, Players) over the finished match, and two live
 *  views over the stream: Watch (for fans) and Analyse (the toolbox). Console and Vision are
 *  the broadcaster's and the camera-only views. Old links (?view=studio, ?start=...) still work. */
export default function App() {
  const q = new URLSearchParams(location.search);
  const view = q.get("view");
  if (view === "console") return <Console />;
  if (view === "vision") return <VisionView />;
  const page = q.get("page") ?? (view === "studio" ? "analyse" : view === "fan" || q.has("start") || q.has("play") ? "watch" : "home");
  if (page === "learn") return <Learn />;
  if (page === "players") return <Players />;
  if (page === "watch" || page === "analyse") return <Live initial={page === "analyse" ? "studio" : "fan"} />;
  return <Home />;
}

function Live({ initial }: { initial: View }) {
  const [view, setView] = useState<View>(initial);
  const meta = useLive((s) => s.meta);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const play = q.get("play");
    // Opening a play from another page: start just after it so its breakdown has the data.
    live.connect(Number(q.get("speed") ?? 1), Number(q.get("start") ?? (play ? 5395 : 0)));
  }, []);
  useEffect(() => {
    const play = new URLSearchParams(location.search).get("play");
    if (meta && play) setTimeout(() => live.breakdown(play), 400);
  }, [meta]);
  const go = (v: View) => {
    setView(v);
    const q = new URLSearchParams(location.search);
    q.delete("view");
    q.set("page", v === "studio" ? "analyse" : "watch");
    history.replaceState(null, "", `${location.pathname}?${q}`);
  };
  return view === "fan" ? <FanView onStudio={() => go("studio")} /> : <Analyse onFan={() => go("fan")} />;
}

function Analyse({ onFan }: { onFan: () => void }) {
  const meta = useLive((s) => s.meta);
  const breakdown = useLive((s) => s.buildup);
  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="/"><Bolt size={22} />Live Cards</a>
        <div className="fixture">{meta ? `${meta.home.name} v ${meta.away.name} · ${meta.venue}` : "Connecting…"}</div>
        <span className="top-spacer" />
        <ViewMenu />
        <nav className="views">
          <a href="/">Home</a>
          <button onClick={onFan}>Watch</button>
          <button className="on">Analyse</button>
          <a href="/?page=learn">Learn</a>
          <a href="/?page=players">Players</a>
        </nav>
      </header>
      <main className="main analyse">
        <aside className="plays-col">
          {breakdown ? <BuildUpPanel docked /> : (
            <>
              <div className="col-title">Plays <span>every attack that ended in a shot</span></div>
              <Plays />
            </>
          )}
        </aside>
        <section className="broadcast">
          <ScaledStage>
            <Viewer />
            <BoardSwitch />
            <ScoreBug />
            <PlayerCard />
            <DirectorTicker />
            <GoalBanner />
            <RedTeamPanel />
            <RevisitBadge />
          </ScaledStage>
          <div className="studio-row"><Timeline /><ExplainGoalButton /></div>
          <Controls />
        </section>
        <SidePanel />
      </main>
    </div>
  );
}
