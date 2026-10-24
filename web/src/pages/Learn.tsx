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
      </section>
      <div className="learn-grid">
        {reg?.stats.map((st) => {
          const play = s?.examples[st.id];
          const look = STAT_LOOK[st.id];
          return (
            <section key={st.id} id={st.id} className={`learn-card t-${look?.tint ?? "xg"}`}>
              <div className="lc-band">
                <h2>{st.name}</h2>
                <StatVisual id={st.id} />
              </div>
              <div className="lc-foot">
                {play && <a className="lc-play" href={playHref(play)}>See it in a real play →</a>}
                <details>
                  <summary>How it's calculated</summary>
                  <p>{st.how}</p>
                  <code>{st.formula}</code>
                  <p className="ls-settings">{Object.entries(st.settings).map(([k, v]) => <span key={k}>{label(k)} <b>{fmt(v)}</b></span>)}</p>
                  {st.note && <p className="lc-note">{st.note}</p>}
                </details>
              </div>
            </section>
          );
        })}
      </div>
      {reg && <p className="l-muted ls-version">Stat definitions v{reg.version}. Every setting is the value the engine uses; a league can calibrate them, and each change is versioned.</p>}
    </Shell>
  );
}
