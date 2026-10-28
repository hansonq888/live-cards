import { useEffect, useRef, useState } from "react";
import { BoardSwitch } from "./viewer/BoardSwitch";
import { Icon } from "./ui/Icon";
import { clock, live, useLive } from "./live/store";
import { Viewer } from "./viewer/Viewer";
import { BuildUpPanel, DirectorTicker, ExplainGoalButton, GoalBanner, PlayerCard, RedTeamPanel, RevisitBadge, ScoreBug, ShowMeHUD } from "./ui/Overlays";
import { Wordmark } from "./ui/Wordmark";
import { AskFloat, Controls, StatChips, UnderTheHood } from "./ui/SidePanel";
import { Home } from "./pages/Home";
import { Learn } from "./pages/Learn";
import { Players } from "./pages/Players";
import { AnalysisBoard } from "./ui/AnalysisBoard";
import { FollowCard } from "./ui/FocusPanel";
import { LiveStats } from "./ui/LiveStats";
import { PlayStory } from "./pages/PlayStory";
import { AvatarSheet } from "./pages/AvatarSheet";
import { Mock } from "./pages/Mock";
import { Thumb } from "./pages/Thumb";
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
  if (page === "avatars") return <AvatarSheet />;
  if (page === "mock") return <Mock />;
  if (page === "thumb") return <Thumb />;
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
    // ?play= opens a breakdown; ?showme= replays it on the tactical board with callouts.
    const q = new URLSearchParams(location.search), play = q.get("play"), show = q.get("showme");
    if (meta && show) setTimeout(() => live.showMe(show), 400);
    else if (meta && play) setTimeout(() => live.breakdown(play), 400);
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

/** "28:24 / 90:00", like a video player; its own component so only it re-renders each tick. */
function TimeReadout() {
  const t = useLive((s) => s.t);
  return <span className="an-time">{clock(t)} / 90:00</span>;
}

function Analyse({ onFan }: { onFan: () => void }) {
  const meta = useLive((s) => s.meta);
  const [hood, setHood] = useState(false);
  // Full screen: the viewer alone, with the player card back on the picture.
  const stageRef = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  // Scroll past the video and it keeps playing in a corner. ✕ closes the corner player; it
  // comes back the next time you scroll past after returning to the video.
  const slotRef = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!slotRef.current) return;
    const io = new IntersectionObserver(([e]) => {
      const gone = !e.isIntersecting && e.boundingClientRect.top < 0;
      setAway(gone);
      if (!gone) setClosed(false);
    }, { threshold: 0.25 });
    io.observe(slotRef.current);
    return () => io.disconnect();
  }, []);
  const pip = away && !closed;
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : stageRef.current?.requestFullscreen());
  const breakdown = useLive((s) => s.buildup);
  const following = useLive((s) => s.director?.mode === "manual" && !s.buildup);
  const paused = useLive((s) => s.paused);
  return (
    <div className="app al">
      <header className="top">
        <a className="brand" href="/"><Wordmark /></a>
        <div className="fixture">{meta ? `${meta.home.name} v ${meta.away.name} · ${meta.venue}` : "Connecting…"}</div>
        <span className="top-spacer" />
        <button className="hood-btn" onClick={() => setHood(true)}>⚙ Settings</button>
        <a className="an-exit" href="/?page=watch">← Back to the match</a>
      </header>
      <main className="main analyse">
        <section className="broadcast">
          <div className="an-top">
            <div className="an-left">
            <div className="an-slot" ref={slotRef}>
            <div className={`an-stage ${pip ? "pip" : ""}`} ref={stageRef}>
              <ScaledStage fit={full ? "contain" : "width"}>
                <Viewer />
                <BoardSwitch />
                <ScoreBug />
                {full && <PlayerCard />}
                <DirectorTicker />
                <GoalBanner />
                <RedTeamPanel />
                <RevisitBadge />
                <ShowMeHUD />
                {/* inside the scaled frame so it sits under the score bug at any size, full screen included */}
                <StatChips />
              </ScaledStage>
              {/* YouTube-style controls over the bottom of the video: shown on hover and while paused. */}
              <div className={`an-overlay ${paused ? "paused" : ""}`}>
                <Timeline />
                <div className="an-controls"><ExplainGoalButton /><Controls /></div>
                <TimeReadout />
                <button className="an-full" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"} title={full ? "Exit full screen" : "Full screen"}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {full
                      ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                      : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
                  </svg>
                </button>
              </div>
              {pip && <button className="an-pip-close" onClick={() => setClosed(true)} aria-label="Close the corner player">✕</button>}
            </div>
            {/* Where the video was, while it plays in the corner */}
            {away && (
              <button className="an-placeholder" onClick={() => { setClosed(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <span>{pip ? "Playing in the corner" : "Video paused here"}</span><em>Back to the video ↑</em>
              </button>
            )}
            </div>
            <AnalysisBoard />
            </div>
            <div className={`an-right ${following ? "following" : ""}`}>
              {/* Following someone turns the live card into one taller card with their numbers. */}
              <div className="card-dock"><PlayerCard />{following && <FollowCard />}</div>
              {!following && <LiveStats />}
            </div>
          </div>
          {breakdown && <div className="an-panel an-break"><BuildUpPanel docked /></div>}
        </section>
      </main>
      <AskFloat />
      {hood && <UnderTheHood onClose={() => setHood(false)} />}
    </div>
  );
}
