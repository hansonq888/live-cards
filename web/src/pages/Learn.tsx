// Learn as a short course: the stats as chapters on the left, the lessons stacked on the
// right (big title, the diagram, one sentence, a real play), each snapping to the centre as
// you scroll. Everything comes from the stat registry (backend/livecards/engine/registry.py), so a new stat becomes a new chapter.
import { useEffect, useRef, useState } from "react";
import { useRegistry } from "../live/stats";
import { Shell } from "./Shell";
import { Avatar } from "../ui/Avatar";
import { Formula } from "./Formula";
import { STAT_LOOK, StatVisual } from "./StatVisual";
import { playHref, useSummary } from "./summary";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));
const label = (k: string) => k.replace(/_/g, " ");

type Stat = NonNullable<ReturnType<typeof useRegistry>>["stats"][number];

export function Learn() {
  const reg = useRegistry();
  const [id, setId] = useState(location.hash.slice(1) || "xg");
  const stats = reg?.stats ?? [];
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const center = (next: string, smooth = true) =>
    refs.current[next]?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  // Open on the lesson in the URL, then let the scroll position pick the chapter.
  useEffect(() => { if (stats.length) center(id, false); }, [stats.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!stats.length) return;
    const io = new IntersectionObserver((es) => {
      const hit = es.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const next = hit?.target.getAttribute("data-id");
      if (next) { setId(next); history.replaceState(null, "", `?page=learn#${next}`); }
    }, { rootMargin: "-45% 0px -45% 0px" });
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [stats.length]);
  return (
    <Shell page="learn">
      <div className="lesson snap">
        <nav className="ls-chapters" aria-label="Stats">
          <span className="ls-kicker">Learn the numbers</span>
          {stats.map((x, n) => (
            <button key={x.id} className={`ls-ch t-${STAT_LOOK[x.id]?.tint ?? "xg"} ${x.id === id ? "on" : ""}`} onClick={() => center(x.id)}>
              <span className="ls-n">{String(n + 1).padStart(2, "0")}</span>
              <span className="ls-t">{x.name}</span>
            </button>
          ))}
        </nav>
        <div className="ls-stack">
          {stats.map((st, i) => (
            <Lesson key={st.id} st={st} i={i} stats={stats} active={st.id === id} go={center}
              setRef={(el) => { refs.current[st.id] = el; }} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

type LessonProps = { st: Stat; i: number; stats: Stat[]; active: boolean; go: (id: string) => void; setRef: (el: HTMLElement | null) => void };

function Lesson({ st, i, stats, active, go, setRef }: LessonProps) {
  const s = useSummary();
  const look = STAT_LOOK[st.id] ?? STAT_LOOK.xg;
  const play = s?.examples[st.id];
  const exPlay = s?.plays.find((x) => x.id === play);
  const exPlayer = exPlay ? s?.players.find((x) => x.id === exPlay.player) : undefined;
  const exClub = exPlayer && s ? (exPlayer.team === s.meta.home.code ? s.meta.home.color : s.meta.away.color) : "#888";
  return (
    <article ref={setRef} data-id={st.id} id={st.id} className={`ls-lesson t-${look.tint} ${active ? "on" : ""}`}>
      <div className="ls-hero">
        <div className="ls-text">
          <span className="ls-step">Lesson {i + 1} of {stats.length}</span>
          <h1>{st.name}</h1>
          <p>{look.line}</p>
        </div>
        <div className="ls-visual"><StatVisual id={st.id} big /></div>
      </div>
      <div className="ls-body">
        {exPlay && exPlayer && (
          <a className="ls-example" href={playHref(exPlay.id)} style={{ ["--club" as string]: exClub }}>
            <span className="lse-bust"><Avatar player={exPlayer} color={exClub} size={110} bare /></span>
            <span className="lse-text">
              <em>Seen in this match</em>
              <b>{exPlayer.short}'s {exPlay.outcome === "goal" ? "goal" : "chance"}, {exPlay.minute}′</b>
              <span>xG {exPlay.xg.toFixed(2)} · walk through it touch by touch</span>
            </span>
            <span className="lse-go">See it →</span>
          </a>
        )}
        <details>
          <summary>How it's calculated</summary>
          <p>{st.how}</p>
          <Formula id={st.id} fallback={st.formula} />
          <p className="ls-settings">{Object.entries(st.settings).map(([k, v]) => <span key={k}>{label(k)} <b>{fmt(v)}</b></span>)}</p>
          {st.note && <p className="ls-note">{st.note}</p>}
        </details>
        {i < stats.length - 1 && (
          <div className="ls-nav"><span /><button className="next" onClick={() => go(stats[i + 1].id)}>Next: {stats[i + 1].name} →</button></div>
        )}
      </div>
    </article>
  );
}
