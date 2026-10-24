// Learn as a short course: the stats as chapters on the left, one lesson at a time on the
// right (big title, the diagram, one sentence, a real play). Everything comes from the stat
// registry (backend/livecards/engine/registry.py), so a new stat becomes a new chapter.
import { useEffect, useState } from "react";
import { useRegistry } from "../live/stats";
import { Shell } from "./Shell";
import { Avatar } from "../ui/Avatar";
import { Formula } from "./Formula";
import { STAT_LOOK, StatVisual } from "./StatVisual";
import { playHref, useSummary } from "./summary";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));
const label = (k: string) => k.replace(/_/g, " ");

export function Learn() {
  const s = useSummary();
  const reg = useRegistry();
  const [id, setId] = useState(location.hash.slice(1) || "xg");
  useEffect(() => { if (reg && !reg.stats.some((x) => x.id === id)) setId(reg.stats[0].id); }, [reg, id]);
  const go = (next: string) => { setId(next); history.replaceState(null, "", `?page=learn#${next}`); };
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
          {stats.map((x, n) => (
            <button key={x.id} className={`ls-ch t-${STAT_LOOK[x.id]?.tint ?? "xg"} ${x.id === id ? "on" : ""}`} onClick={() => go(x.id)}>
              <span className="ls-n">{String(n + 1).padStart(2, "0")}</span>
              <span className="ls-t">{x.name}</span>
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
