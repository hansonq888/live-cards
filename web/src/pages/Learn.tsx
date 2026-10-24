// Learn: one short page per stat — what it means, how we calculate it, and a real play to see it on.
// The formulas are the ones in backend/livecards/engine (metrics.py, space.py, rating.py).
import { Shell } from "./Shell";
import { playHref, useSummary } from "./summary";

const STATS: { id: string; example: string; title: string; plain: string; how: string; formula: string; note?: string }[] = [
  {
    id: "xg", example: "xg", title: "Expected goals (xG)",
    plain: "How likely a shot is to go in, judged only by where it was taken. An xG of 0.30 means shots like it are scored about 3 times in 10. Add up a player's or team's xG and you get how many goals their chances were worth.",
    how: "Closer and more central shots score more often. Our model uses the distance to goal and the angle the goal mouth makes from the shot.",
    formula: "xG = 1 / (1 + e^-(−1.1 + 1.6·angle − 0.075·distance))   ·   penalty spot ≈ 0.29",
    note: "A deliberately simple model. Professional xG models also use the type of pass before the shot, body part, defenders in the way and more.",
  },
  {
    id: "pass", example: "pass_difficulty", title: "Pass difficulty",
    plain: "How hard a pass was, from 1 to 10. Short sideways passes are easy; long passes forward, under pressure, into the final third are hard. Above 6.5 is a very hard pass.",
    how: "Points for distance and for ground gained toward goal, plus extra for pressure, for ending in the final third, and for crosses and through balls.",
    formula: "1 + min(4, distance/10) + min(2, gain/15) + 1.5 under pressure + 1.0 into the final third + 0.5 cross or through ball",
  },
  {
    id: "space", example: "space", title: "Space control",
    plain: "Which team would win a race to each part of the pitch, right now. Shaded areas are controlled; the boundary between colours is where the game is contested. When a run or pass grows a team's space in the final third, it has opened the defence up.",
    how: "For every 3 m square, each player's arrival time: 0.7 s to react while carrying on at their current speed, then a straight run at 7 m/s. The faster team wins the square, softly: a small head start is close to 50/50.",
    formula: "control = 1 / (1 + e^-(t_them − t_us) / 0.45 s)",
    note: "A simplified version of the pitch-control models used in professional analysis, built only from player positions and speeds.",
  },
  {
    id: "sprint", example: "sprint", title: "Sprints and high-intensity runs",
    plain: "A sprint is running at 25.2 km/h or faster for at least a second; a high-intensity run is 19.8 km/h or faster. They show who is doing the hard running, often off the ball where the camera isn't.",
    how: "Measured from tracking data: player speed, ten times a second.",
    formula: "sprint ≥ 25.2 km/h · high-intensity ≥ 19.8 km/h · both held for ≥ 1 s",
  },
  {
    id: "rating", example: "rating", title: "Live rating and form",
    plain: "Every player starts at 6.0 and moves with what they do: up for goals, assists, chances, tackles and passes under pressure; down for losing the ball in their own half, fouls and cards. Fans see it as form: Struggling, Quiet, Steady, Playing well or On fire.",
    how: "Each event adds a fixed weight, so every change can be traced to the events behind it. The weights are our own design; analysts can set their own in Analyse → Model.",
    formula: "goal +1.0 · assist +0.6 · chance created +0.15 · tackle or interception +0.1 · pass under pressure +0.03 · lost ball in own half −0.15 · foul −0.05 · yellow −0.3",
    note: "Form: On fire ≥ 8.0 · Playing well ≥ 7.0 · Steady ≥ 6.3 · Quiet ≥ 5.6 · otherwise Struggling.",
  },
];

export function Learn() {
  const s = useSummary();
  return (
    <Shell page="learn">
      <section className="l-hero small">
        <p className="l-eyebrow">Learn</p>
        <h1>The numbers, in plain words.</h1>
        <p className="l-lede">Each stat on this site, what it means, exactly how we calculate it, and a real play from the match to see it on.</p>
      </section>
      <div className="l-stack">
        {STATS.map((st) => {
          const play = s?.examples[st.example];
          return (
            <section key={st.id} id={st.id} className="l-card l-stat">
              <h2>{st.title}</h2>
              <p className="ls-plain">{st.plain}</p>
              <div className="ls-cols">
                <div><h4>How we calculate it</h4><p>{st.how}</p><code>{st.formula}</code></div>
                {st.note && <div><h4>Worth knowing</h4><p>{st.note}</p></div>}
              </div>
              {play && <a className="l-btn primary" href={playHref(play)}>See it in a real play</a>}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
