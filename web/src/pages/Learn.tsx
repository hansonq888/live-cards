// Learn as a short course: the stats as chapters on the left, one lesson at a time on the
// right (big title, the diagram, one sentence, a real play). Everything comes from the stat
// registry (backend/livecards/engine/registry.py), so a new stat becomes a new chapter.
import { useEffect, useState } from "react";
import { useRegistry } from "../live/stats";
import { Shell } from "./Shell";
import { Avatar } from "../ui/Avatar";
import { Formula } from "./Formula";
import { XgTry } from "./XgTry";
import { STAT_LOOK, StatVisual } from "./StatVisual";
import { playHref, useSummary, type Summary } from "./summary";

// Each lesson's leaderboard: the stat it maps to on the player summaries.
type Board = { label: string; get: (p: Summary["players"][number]) => number; show: (v: number) => string; min?: (p: Summary["players"][number]) => boolean };
const BOARDS: Record<string, Board> = {
  xg: { label: "xG", get: (p) => p.stats.xg, show: (v) => v.toFixed(2) },
  pass_difficulty: { label: "average pass difficulty", get: (p) => p.stats.avg_difficulty, show: (v) => `${v.toFixed(1)}/10`, min: (p) => p.stats.passes >= 15 },
  sprints: { label: "top speed", get: (p) => p.stats.top_speed_kmh, show: (v) => `${v.toFixed(1)} km/h` },
  rating: { label: "rating", get: (p) => p.rating, show: (v) => v.toFixed(1) },
};
const seen = (): string[] => { try { return JSON.parse(localStorage.getItem("learn-seen") ?? "[]"); } catch { return []; } };

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));
const label = (k: string) => k.replace(/_/g, " ");

export function Learn() {
  const s = useSummary();
  const reg = useRegistry();
  const [id, setId] = useState(location.hash.slice(1) || "xg");
  useEffect(() => { if (reg && !reg.stats.some((x) => x.id === id)) setId(reg.stats[0].id); }, [reg, id]);
  const go = (next: string) => { setId(next); history.replaceState(null, "", `?page=learn#${next}`); window.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => {
    const onHash = () => location.hash && setId(location.hash.slice(1));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [done, setDone] = useState<string[]>(seen);
  useEffect(() => {
    setDone((d) => {
      const next = d.includes(id) ? d : [...d, id];
      try { localStorage.setItem("learn-seen", JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, [id]);
  const stats = reg?.stats ?? [];
  const i = stats.findIndex((x) => x.id === id);
  const st = stats[i];
  const look = st ? STAT_LOOK[st.id] : undefined;
  const play = st ? s?.examples[st.id] : undefined;
  const exPlay = s?.plays.find((x) => x.id === play);
  const exPlayer = exPlay ? s?.players.find((x) => x.id === exPlay.player) : undefined;
  const exClub = exPlayer && s ? (exPlayer.team === s.meta.home.code ? s.meta.home.color : s.meta.away.color) : "#888";
  return (
    <Shell page="learn">
      <div className="lesson">
        <nav className="ls-chapters" aria-label="Stats">
          <span className="ls-kicker">Learn the numbers</span>
          <div className="ls-progress" aria-label={`${done.filter((d) => stats.some((x) => x.id === d)).length} of ${stats.length} lessons opened`}>
            {stats.map((x) => <i key={x.id} className={done.includes(x.id) ? "on" : ""} />)}
          </div>
          {stats.map((x, n) => (
            <button key={x.id} className={`ls-ch t-${STAT_LOOK[x.id]?.tint ?? "xg"} ${x.id === id ? "on" : ""}`} onClick={() => go(x.id)}>
              <span className="ls-n">{String(n + 1).padStart(2, "0")}</span>
              <span className="ls-t">{x.name}</span>
              {done.includes(x.id) && x.id !== id && <span className="ls-tick" aria-label="opened">✓</span>}
            </button>
          ))}
        </nav>
        {st && look && (
          <article key={st.id} className={`ls-lesson t-${look.tint}`}>
            <div className="ls-hero">
              <div className="ls-text">
                <span className="ls-step">Lesson {i + 1} of {stats.length}</span>
                <h1>{st.name}</h1>
                <p>{look.line}</p>
              </div>
              <div className="ls-visual"><StatVisual id={st.id} big /></div>
            </div>
            <div className="ls-body">
              {st.id === "xg" && <XgTry />}
              {exPlay && exPlayer && (
                <a className="ls-example" href={playHref(exPlay.id)} style={{ ["--club" as string]: exClub }}>
                  <span className="lse-bust"><Avatar player={exPlayer} color={exClub} size={110} bare /></span>
                  <span className="lse-text">
                    <em>See it in a real play</em>
                    <b>{exPlayer.short}'s {exPlay.outcome === "goal" ? "goal" : "chance"}, {exPlay.minute}′</b>
                    <span>xG {exPlay.xg.toFixed(2)} · walk through it touch by touch</span>
                  </span>
                  <span className="lse-show" role="link" tabIndex={0}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); location.href = `/?page=analyse&showme=${encodeURIComponent(exPlay.id)}`; }}>▶ Show me</span>
                  <span className="lse-go">Story →</span>
                </a>
              )}
              {s && BOARDS[st.id] && <Leaders s={s} board={BOARDS[st.id]} key={`l-${st.id}`} />}
              {s && BOARDS[st.id] && <Quiz s={s} board={BOARDS[st.id]} key={`q-${st.id}`} />}
              <details>
                <summary>How it's calculated</summary>
                <p>{st.how}</p>
                <Formula id={st.id} fallback={st.formula} />
                <p className="ls-settings">{Object.entries(st.settings).map(([k, v]) => <span key={k}>{label(k)} <b>{fmt(v)}</b></span>)}</p>
                {st.note && <p className="ls-note">{st.note}</p>}
              </details>
              <div className="ls-nav">
                {i > 0 ? <button onClick={() => go(stats[i - 1].id)}>← {stats[i - 1].name}</button> : <span />}
                {i < stats.length - 1 && <button className="next" onClick={() => go(stats[i + 1].id)}>Next: {stats[i + 1].name} →</button>}
              </div>
            </div>
          </article>
        )}
      </div>
    </Shell>
  );
}

function ranked(s: Summary, b: Board) {
  return s.players.filter((p) => p.stats.minutes >= 20 && (b.min?.(p) ?? true)).sort((x, y) => b.get(y) - b.get(x));
}

/** The top five on the lesson's stat: the number made concrete with real players. */
function Leaders({ s, board }: { s: Summary; board: Board }) {
  const top = ranked(s, board).slice(0, 5);
  const max = top.length ? board.get(top[0]) || 1 : 1;
  return (
    <section className="ls-leaders">
      <h3>Top five on {board.label}</h3>
      <ol>
        {top.map((p, n) => {
          const color = p.team === s.meta.home.code ? s.meta.home.color : s.meta.away.color;
          return (
            <li key={p.id} style={{ ["--club" as string]: color }}>
              <span className="lsl-n">{n + 1}</span>
              <span className="lsl-face"><Avatar player={p} color={color} size={36} bare /></span>
              <a href={`/?page=players&id=${p.id}`}>{p.short}</a>
              <span className="lsl-bar"><i style={{ width: `${(board.get(p) / max) * 100}%` }} /></span>
              <b>{board.show(board.get(p))}</b>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** One question to check it landed: pick the leader from three names. */
function Quiz({ s, board }: { s: Summary; board: Board }) {
  const all = ranked(s, board).filter((p) => board.get(p) > 0);  // no "0.00" give-aways
  const [pick, setPick] = useState<string | null>(null);
  if (all.length < 6) return null;
  // The leader, someone mid-table and someone near the bottom, in a fixed shuffled order.
  const base = [all[0], all[Math.floor(all.length / 2)], all[all.length - 2]];
  const turn = board.label.length % 3;  // so the answer isn't always in the same place
  const opts = [...base.slice(turn), ...base.slice(0, turn)];
  const right = all[0].id;
  return (
    <section className="ls-quiz">
      <span className="lsq-kicker">Quick check</span>
      <h3>Which of these players had the highest {board.label}?</h3>
      <div className="lsq-opts">
        {opts.map((p) => (
          <button key={p.id} disabled={pick !== null}
            className={pick === null ? "" : p.id === right ? "right" : p.id === pick ? "wrong" : "dim"}
            onClick={() => setPick(p.id)}>
            <b>{p.short}</b><span>{p.position}</span>
            {pick !== null && <em>{board.show(board.get(p))}</em>}
          </button>
        ))}
      </div>
      {pick !== null && (
        <p className="lsq-ans">{pick === right ? "Right. " : "Not quite. "}{all[0].short} had the highest, at {board.show(board.get(all[0]))}.
          <button onClick={() => setPick(null)}>Try again</button></p>
      )}
    </section>
  );
}
