import { useEffect, useState } from "react";
import { BoardSwitch } from "./viewer/BoardSwitch";
import { Icon } from "./ui/Icon";
import { live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug } from "./ui/Overlays";
import { Wordmark } from "./ui/Wordmark";
import { Controls, SidePanel, ViewMenu } from "./ui/SidePanel";
import { Home } from "./pages/Home";
import { Learn } from "./pages/Learn";
import { Players } from "./pages/Players";
import { AnalysisBoard } from "./ui/AnalysisBoard";
import { PlayStory } from "./pages/PlayStory";
import { WatchHome } from "./pages/WatchHome";
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
  if (page === "play") return <PlayStory />;
  // Watch starts on a match page; the broadcast opens once you pick how to watch (?start=).
  if (page === "watch" && !q.has("start") && !q.has("play") && view !== "fan") return <WatchHome />;
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
    // Analyse studies the whole match, so it opens at full time with every play available;
    // Watch is the live experience from kick-off. ?start= overrides either.
    live.connect(Number(q.get("speed") ?? 1), Number(q.get("start") ?? (play || initial === "studio" ? 5395 : 0)));
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
    <div className="app al">
      <header className="top">
        <a className="brand" href="/"><Wordmark /></a>
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
          <div className="an-panel an-transport">
            <div className="studio-row"><Timeline /><ExplainGoalButton /></div>
            <Controls />
          </div>
          {breakdown && <div className="an-panel an-break"><BuildUpPanel docked /></div>}
          <AnalysisBoard />
        </section>
        <SidePanel />
      </main>
    </div>
  );
}
