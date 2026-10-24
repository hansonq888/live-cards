// Watch: a match page before the match. Pick how to watch (from kick-off, or straight to a
// goal) instead of being dropped into the broadcast.
import { Shell } from "./Shell";
import { useSummary } from "./summary";

const at = (t: number) => `/?page=watch&start=${Math.max(0, Math.round(t))}`;

export function WatchHome() {
  const s = useSummary();
  const meta = s?.meta;
  const name = (id: string) => s?.players.find((p) => p.id === id)?.short ?? "";
  const goals = s?.plays.filter((p) => p.outcome === "goal") ?? [];
  return (
    <Shell page="watch">
      {meta && s && (
        <section className="hero-card w-match">
          <div className="wm-board">
            <span className="wm-status">Full time · {meta.venue}</span>
            <div className="wm-score">
              <span className="wm-team" style={{ background: meta.home.color }}><b>{meta.home.code}</b><em>{meta.home.name}</em></span>
              <span className="wm-num">{s.score[meta.home.code]}<i>–</i>{s.score[meta.away.code]}</span>
              <span className="wm-team" style={{ background: meta.away.color }}><b>{meta.away.code}</b><em>{meta.away.name}</em></span>
            </div>
          </div>
          <div className="wm-side">
            <a className="hc-btn primary wm-kick" href={at(0)}>▶ Watch from kick-off</a>
            <span className="wm-label">Or jump to a goal</span>
            <div className="wm-goals">
              {goals.map((g) => (
                <a key={g.id} className="wm-goal" href={at(g.t - 25)}>
                  <b>{g.minute}′</b><span>{name(g.player)}</span><i style={{ background: meta.players.find((x) => x.id === g.player)?.team === meta.home.code ? meta.home.color : meta.away.color }} />
                </a>
              ))}
            </div>
            <p className="wm-hint">Starts 25 seconds before the goal, so you see the move.</p>
          </div>
        </section>
      )}
    </Shell>
  );
}
