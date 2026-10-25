// Scroll story (?page=play&play=...): one play, told as you scroll. The pitch stays put on the
// left (coach's tablet by default, or the broadcast camera); each touch is a section on the
// right, and scrolling it into view replays the match to that touch and holds it there.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";
import { stepCaption, stepMeaning } from "../i18n";
import { ScaledStage } from "../ui/ScaledStage";
import { ScoreBug } from "../ui/Overlays";
import { Wordmark } from "../ui/Wordmark";
import { Viewer } from "../viewer/Viewer";
import { TacticalBoard } from "../viewer/TacticalBoard";
import { xgWords } from "./summary";
import { Avatar } from "../ui/Avatar";

// What kind of touch each step is, as a short heading, and which lesson explains it.
const KIND: Record<string, [string, string | null]> = {
  win: ["Winning the ball", null], pass: ["The pass", "pass_difficulty"], sprint: ["The run", "sprints"],
  shot: ["The shot", "xg"], goal: ["The finish", null], end: ["How it ended", null],
};
const GUESSES: [string, number][] = [["Unlikely", 0.05], ["Maybe", 0.15], ["Good chance", 0.35], ["Should score", 0.6]];

/** Before the shot's xG is revealed, the reader guesses how good the chance was. */
function GuessXg({ xg }: { xg: number }) {
  const [pick, setPick] = useState<number | null>(null);
  const closest = GUESSES.reduce((a, g) => (Math.abs(g[1] - xg) < Math.abs(a[1] - xg) ? g : a));
  return (
    <div className="sp-guess">
      <b>Your call: how good was this chance?</b>
      <div className="sp-guess-opts">
        {GUESSES.map(([label, v], i) => (
          <button key={label} className={pick === i ? (GUESSES[i] === closest ? "right" : "wrong") : pick !== null && GUESSES[i] === closest ? "right" : ""}
            onClick={() => setPick(i)} disabled={pick !== null}>{label}</button>
        ))}
      </div>
      {pick !== null && (
        <p className="sp-guess-ans">
          {GUESSES[pick] === closest ? "Spot on. " : "Not quite. "}The engine's xG is <strong>{xg.toFixed(2)}</strong>: a chance like this {xgWords(xg)}.{" "}
          <a href="/?page=learn#xg">How xG works →</a>
        </p>
      )}
    </div>
  );
}

export function PlayStory() {
  const playId = new URLSearchParams(location.search).get("play") ?? "";
  const meta = useLive((s) => s.meta);
  const b = useLive((s) => s.buildup);
  const plays = useLive((s) => s.plays);
  const [view, setView] = useState<"tactical" | "broadcast">("tactical");
  const [active, setActive] = useState(-1);
  const sections = useRef<(HTMLElement | null)[]>([]);
  const timer = useRef<number>();

  useEffect(() => { live.connect(1, 5395); }, []);
  useEffect(() => { if (meta && playId) setTimeout(() => live.breakdown(playId), 400); }, [meta, playId]);

  // The section nearest the middle of the screen drives the replay (debounced while scrolling).
  useEffect(() => {
    if (!b) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = Number((e.target as HTMLElement).dataset.step);
        setActive(i);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => { if (i >= 0) live.stepTo(i); }, 220);
      }
    }, { rootMargin: "-45% 0px -45% 0px" });
    sections.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [b?.goal]);

  const name = (id: string) => meta?.players.find((p) => p.id === id)?.short ?? "";
  const team = b && meta ? (meta.players.find((p) => p.id === b.scorer)?.team === meta.home.code ? meta.home : meta.away) : null;
  const idx = plays.findIndex((p) => p.id === playId);
  const next = idx >= 0 ? plays[idx + 1] : undefined;
  const story = b ? (b.storySource === "model" ? b.story : b.story) : "";
  const shot = b?.steps.find((s) => s.kind === "shot");
  const xg = shot ? Number(shot.args?.xg) : null;

  return (
    // The page wears the attacking team's colours.
    <div className={`story-page ${team ? "themed" : ""}`} style={team ? { ["--team" as string]: team.color } : undefined}>
      <header className="sp-top">
        <a className="brand" href="/"><Wordmark /></a>
        <a className="sp-link" href={`/?page=analyse&play=${encodeURIComponent(playId)}`}>Open this play in Analyse</a>
      </header>
      <div className="sp-body">
        <div className="sp-visual">
          <div className="sp-stage">
            {view === "tactical" ? <TacticalBoard /> : (
              <ScaledStage fit="contain"><Viewer /><ScoreBug /></ScaledStage>
            )}
            <div className="sp-switch" role="tablist">
              <button className={view === "tactical" ? "on" : ""} onClick={() => setView("tactical")}>Tactical</button>
              <button className={view === "broadcast" ? "on" : ""} onClick={() => setView("broadcast")}>Broadcast</button>
            </div>
          </div>
          {b && <div className="sp-progress">{b.steps.map((_, i) => <i key={i} className={i <= active ? "on" : ""} />)}</div>}
        </div>

        <article className="sp-story">
          {!b ? <div className="sp-loading">Loading the play…</div> : (
            <>
              <section className="sp-intro" data-step={-1} ref={(el) => { sections.current[0] = el; }}>
                <span className={`sp-badge ${b.kind}`}>{b.kind === "goal" ? "Goal" : "Chance"} · {Math.floor(b.goalT / 60)}′</span>
                <h1>How {name(b.scorer)}'s {b.kind === "goal" ? "goal" : "chance"} was built</h1>
                <p className="sp-lede">{story}{b.storySource === "model" && <span className="sp-check"> ✓ checked</span>}</p>
                <div className="sp-facts">
                  <div><b>{b.steps.filter((s) => s.kind === "pass").length}</b><span>passes</span></div>
                  <div><b>{Math.round(b.goalT - b.start)} s</b><span>start to shot</span></div>
                  {xg !== null && <div><b>{xg.toFixed(2)}</b><span>xG: a chance like this {xgWords(xg)}</span></div>}
                </div>
                <p className="sp-hint">Scroll to walk through it, touch by touch.</p>
              </section>
              {b.steps.map((s, i) => {
                const [heading, lesson] = KIND[s.kind] ?? ["", null];
                const who = meta?.players.find((p) => p.id === s.player);
                const shotXg = s.kind === "shot" ? Number(s.args?.xg) : NaN;
                const meanings = stepMeaning("en", s).filter((m) => !(s.kind === "shot" && m.label.startsWith("xG")));
                return (
                  <section key={i} className={`sp-step ${i === active ? "on" : ""}`} data-step={i} ref={(el) => { sections.current[i + 1] = el; }}>
                    <div className="sp-head">
                      <span className="sp-n">{String(i + 1).padStart(2, "0")}</span>
                      <span className="sp-kind">{heading}<em>{(b.goalT - s.t).toFixed(1)} s before the shot</em></span>
                      {who && team && <span className="sp-who"><Avatar player={who} color={team.color} size={64} bare /></span>}
                    </div>
                    {/* the shot's xG stays hidden until the reader has made their call */}
                    <h2>{s.kind === "shot" ? stepCaption("en", s).replace(/, xG [\d.]+/, "") : stepCaption("en", s)}</h2>
                    {meanings.length > 0 && (
                      <div className="sp-stats">
                        {meanings.map((m, j) => (
                          <div key={j}><b>{m.label}</b>{m.meaning && <span>{m.meaning}</span>}</div>
                        ))}
                      </div>
                    )}
                    {s.space && team && (
                      <div className="sp-spacebar">
                        <div className="spb-top"><b>{s.space.final_third_m2} m²</b><span>of the final third controlled by {team.name}</span>
                          {s.space.gain_m2 !== null && s.space.gain_m2 !== 0 && <em className={s.space.gain_m2 > 0 ? "up" : "down"}>{s.space.gain_m2 > 0 ? "+" : "−"}{Math.abs(s.space.gain_m2)} m²</em>}</div>
                        <div className="spb-track"><i style={{ width: `${Math.min(100, (s.space.final_third_m2 / 2380) * 100)}%`, background: team.color }} /></div>
                        <a href="/?page=learn#space_control">What's space control?</a>
                      </div>
                    )}
                    {!Number.isNaN(shotXg) && <GuessXg xg={shotXg} />}
                    {lesson && lesson !== "xg" && <a className="sp-learn" href={`/?page=learn#${lesson}`}>Learn: {lesson === "pass_difficulty" ? "pass difficulty" : "sprints"} →</a>}
                  </section>
                );
              })}
              <section className="sp-outro">
                <h2>{b.kind === "goal" ? "That's the goal." : "That's the chance."}</h2>
                <div className="sp-next">
                  {next && <a className="sp-btn primary" href={`/?page=play&play=${next.id}`}>Next play: {name(next.player)} {next.minute}′ →</a>}
                  <a className="sp-btn" href="/?page=learn">What do these numbers mean?</a>
                  <a className="sp-btn" href="/">All plays</a>
                </div>
              </section>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
