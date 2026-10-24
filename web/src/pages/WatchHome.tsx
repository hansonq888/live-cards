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
        <section className="l-card w-match">
          <div className="wm-top"><span className="wm-status">Full time</span><span className="l-muted">{meta.venue}</span></div>
          <div className="wm-score">
            <span className="wm-team"><i style={{ background: meta.home.color }} />{meta.home.name}</span>
            <b>{s.score[meta.home.code]} – {s.score[meta.away.code]}</b>
            <span className="wm-team right">{meta.away.name}<i style={{ background: meta.away.color }} /></span>
          </div>
          <div className="wm-actions">
            <a className="l-btn primary" href={at(0)}>Watch from kick-off</a>
            {goals.map((g) => (
              <a key={g.id} className="l-btn" href={at(g.t - 25)}>⚽ {name(g.player)} {g.minute}′</a>
            ))}
          </div>
          <p className="wm-hint">Jumping to a goal starts the broadcast 25 seconds before it, so you see the move.</p>
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
