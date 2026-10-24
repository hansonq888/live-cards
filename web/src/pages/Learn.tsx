// Learn: every stat in the registry (backend/livecards/engine/registry.py), what it means, how
// it's calculated with the settings the engine actually uses, and a real play to see it on.
// A stat added to the registry appears here with no frontend change.
import { useEffect } from "react";
import { useRegistry } from "../live/stats";
import { Shell } from "./Shell";
import { STAT_LOOK, StatVisual } from "./StatVisual";
import { playHref, useSummary } from "./summary";

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))));
const label = (k: string) => k.replace(/_/g, " ");

export function Learn() {
  const s = useSummary();
  const reg = useRegistry();
  // Links like ?page=learn#xg: the sections render after the registry loads, so scroll then.
  useEffect(() => {
    if (reg && location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [reg]);
  return (
    <Shell page="learn">
      <section className="l-hero small">
        <p className="l-eyebrow">Learn</p>
        <h1>The numbers, in plain words.</h1>
        <p className="l-lede">Each stat on this site, what it means, exactly how we calculate it, and a real play from the match to see it on.</p>
      </section>
      <div className="l-stack">
        {reg?.stats.map((st) => {
          const play = s?.examples[st.id];
          return (
            <section key={st.id} id={st.id} className={`l-card l-stat t-${STAT_LOOK[st.id]?.tint ?? "xg"}`}>
              <div className="ls-top">
                <div>
                  <span className={`sc-chip t-${STAT_LOOK[st.id]?.tint ?? "xg"}`}>{STAT_LOOK[st.id]?.short ?? st.id}</span>
                  <h2>{st.name}</h2>
                  <p className="ls-plain">{st.plain}</p>
                </div>
                <StatVisual id={st.id} big />
              </div>
              <div className="ls-cols">
                <div><h4>How we calculate it</h4><p>{st.how}</p><code>{st.formula}</code></div>
                <div>
                  <h4>Settings</h4>
                  <p className="ls-settings">{Object.entries(st.settings).map(([k, v]) => <span key={k}>{label(k)} <b>{fmt(v)}</b></span>)}</p>
                  {st.note && <><h4>Worth knowing</h4><p>{st.note}</p></>}
                </div>
              </div>
              {play && <a className="l-btn primary" href={playHref(play)}>See it in a real play</a>}
            </section>
          );
        })}
      </div>
      {reg && <p className="l-muted ls-version">Stat definitions v{reg.version}. Every setting is the value the engine uses; a league can calibrate them, and each change is versioned.</p>}
    </Shell>
  );
}
