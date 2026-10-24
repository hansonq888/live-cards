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
      <section className="l-hero small">
        <p className="l-eyebrow">Watch</p>
        <h1>Watch the match.</h1>
        <p className="l-lede">The ring follows the play, every player's card explains itself, and you can switch to the tactical view at any moment.</p>
      </section>
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
      <section className="l-section">
        <div className="l-head"><h2>While you watch</h2></div>
        <div className="l-grid">
          {[
            ["The ring", "It follows the player who matters, and moves before a cross lands."],
            ["Cards that explain", "Each player's form in words, with one checked sentence on why it changed."],
            ["Tactical view", "Tap the corner map to see the whole pitch from above."],
            ["Ask", "Ask anything about the match; answers come only from the data."],
          ].map(([t, d]) => <div key={t} className="l-card l-learn"><h3>{t}</h3><p>{d}</p></div>)}
        </div>
      </section>
    </Shell>
  );
}
