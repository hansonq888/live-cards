// Beside the pitch in Analyse: the match as it stands, refreshed every second by the engine.
import { clock, live, useLive } from "../live/store";
import { formLevel } from "./Overlays";

const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];

export function LiveStats() {
  const team = useLive((s) => s.team);
  const meta = useLive((s) => s.meta);
  const t = useLive((s) => s.t);
  const board = useLive((s) => s.board);
  if (!meta || !team) return <aside className="ls-live"><div className="lsl-wait">Waiting for the match…</div></aside>;
  const { home, away } = meta;
  const rows: [string, number, number, (v: number) => string][] = [
    ["Possession", team.possession[home.code] ?? 50, team.possession[away.code] ?? 50, (v) => `${Math.round(v)}%`],
    ["Last 5 min", team.possession_5m[home.code] ?? 50, team.possession_5m[away.code] ?? 50, (v) => `${Math.round(v)}%`],
    ["xG", team.xg[home.code] ?? 0, team.xg[away.code] ?? 0, (v) => v.toFixed(2)],
    ["Shots", team.shots[home.code] ?? 0, team.shots[away.code] ?? 0, String],
    ["On target", team.shots_on_target[home.code] ?? 0, team.shots_on_target[away.code] ?? 0, String],
  ];
  const players = new Map(meta.players.map((p) => [p.id, p]));
  const best = Object.entries(board).filter(([id]) => players.get(id)).sort((a, b) => b[1].rating - a[1].rating).slice(0, 3);
  const m = team.momentum;
  return (
    <aside className="ls-live">
      <div className="lsl-score">
        <span style={{ background: home.color }}>{home.code}</span>
        <b>{team.score[home.code] ?? 0}–{team.score[away.code] ?? 0}</b>
        <span style={{ background: away.color }}>{away.code}</span>
        <em>{clock(t)}</em>
      </div>
      <div className="lsl-rows">
        {rows.map(([label, a, b, f]) => {
          const share = a + b ? (100 * a) / (a + b) : 50;
          return (
            <div key={label} className="lsl-row">
              <div className="lsl-vals"><b>{f(a)}</b><span>{label}</span><b>{f(b)}</b></div>
              <div className="lsl-bar"><i style={{ width: `${share}%`, background: home.color }} /><i style={{ width: `${100 - share}%`, background: away.color }} /></div>
            </div>
          );
        })}
      </div>
      <div className="lsl-mom">
        <span>Momentum · {Math.abs(m) < 0.1 ? "even" : m > 0 ? home.code : away.code}</span>
        <div className="lsl-track"><i style={{ left: `${50 + m * 50}%` }} /></div>
        <span>Control ↔ chaos · {team.chaos}/100</span>
        <div className="lsl-chaos"><i style={{ width: `${team.chaos}%` }} /></div>
      </div>
      <div className="lsl-best">
        <span className="lsl-h">Best right now</span>
        {best.map(([id, r]) => {
          const p = players.get(id)!;
          const tm = p.team === home.code ? home : away;
          return (
            <button key={id} onClick={() => live.send({ type: "select", player: id })}>
              <i style={{ background: tm.color }} /><b>{p.short}</b><em>{FORM[formLevel(r.rating)]}</em><span>{r.rating.toFixed(1)}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
