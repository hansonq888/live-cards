// Analyst mode: the same moment, shown with its working. Every number here comes from the engine.
import { useLive } from "../live/store";

const ATTR_LABEL: Record<string, string> = { pace: "Pace", passing: "Passing", threat: "Threat", defending: "Defending", engine: "Engine" };
const ADV: [string, string, (v: number) => string][] = [
  ["pass_pct", "pass %", (v) => `${v}%`], ["avg_difficulty", "pass difficulty", (v) => v.toFixed(1)],
  ["forward_passes", "forward passes", String], ["xg", "xG", (v) => v.toFixed(2)],
  ["shots", "shots", String], ["chances_created", "chances created", String],
  ["tackles_won", "tackles won", String], ["interceptions", "interceptions", String],
  ["pressures_won", "pressures won", String], ["hi_runs", "high-intensity runs", String],
];

const fmtZ = (z: number) => `${z >= 0 ? "+" : ""}${z.toFixed(1)}σ`;

export function AnalystCard({ pid }: { pid: string }) {
  const meta = useLive((s) => s.meta);
  const a = useLive((s) => s.analyst[pid]);
  const mine = useLive((s) => s.custom[pid]);
  const line = useLive((s) => s.lines[pid]);
  const profile = useLive((s) => s.profile);
  if (!meta || !a) return null;
  const p = meta.players.find((x) => x.id === pid)!;
  const team = p.team === meta.home.code ? meta.home : meta.away;
  const variant = line?.variants[profile];
  return (
    <div className="acard" style={{ ["--team" as string]: team.color }}>
      <div className="ac-head">
        <div className="ac-rating">{a.rating.toFixed(2)}</div>
        <div>
          <div className="card-name"><span className="first">{p.name.split(" ").slice(0, -1).join(" ")}</span><span className="last">{p.name.split(" ").slice(-1)[0]}</span></div>
          <div className="card-meta"><i className="team-dot" />{p.position} · {a.minutes.toFixed(0)}′ played · baseline: {a.role}</div>
        </div>
      </div>
      {mine && (
        <div className="ac-compare">
          <div><span>Live Cards</span><b>{a.rating.toFixed(2)}</b></div>
          <div className="yours"><span>{mine.name}</span><b>{mine.rating.toFixed(2)}</b></div>
          <div className={mine.rating >= a.rating ? "up" : "down"}><span>difference</span><b>{mine.rating >= a.rating ? "+" : ""}{(mine.rating - a.rating).toFixed(2)}</b></div>
        </div>
      )}
      <div className="ac-section">Rating = 6.00 start {a.breakdown.length ? "+" : ""}{mine ? " · ours / yours" : ""}</div>
      <div className="ac-ledger">
        {a.breakdown.slice(0, 6).map((b) => (
          <div key={b.kind} className={b.total >= 0 ? "pos" : "neg"}>
            <span>{b.label}{b.count > 1 ? ` ×${b.count}` : ""}</span>
            <b>{b.total >= 0 ? "+" : ""}{b.total.toFixed(2)}{mine && (() => {
              const y = mine.breakdown.find((x) => x.kind === b.kind)?.total ?? 0;
              return <em className="yours"> / {y >= 0 ? "+" : ""}{y.toFixed(2)}</em>;
            })()}</b>
          </div>
        ))}
        {a.breakdown.length > 6 && <div className="dim"><span>{a.breakdown.length - 6} more</span><b /></div>}
      </div>
      <div className="ac-section">Attributes vs role baseline (base → live)</div>
      <div className="ac-attrs">
        {Object.entries(a.attrs).map(([k, v]) => (
          <div key={k} className="ac-attr">
            <div className="ac-attr-head">
              <span>{ATTR_LABEL[k]}</span>
              <b>{v.base} → {v.value}{v.value !== v.base && <em className={v.value > v.base ? "up" : "down"}> {v.value > v.base ? "+" : ""}{v.value - v.base}</em>}</b>
            </div>
            <div className="ac-metrics">
              {v.metrics.map((m) => (
                <span key={m.key} className={m.z > 0.25 ? "hi" : m.z < -0.25 ? "lo" : ""} title={`weight ${m.weight}; role average ${m.role_mean}`}>
                  {m.label.replace(/ \(.*\)/, "")}: {m.per90 ? `${m.count} (${m.value}/90)` : m.value} vs {m.role_mean} · {fmtZ(m.z)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ac-adv">
        {ADV.map(([k, label, f]) => <div key={k}><b>{f(a.advanced[k] ?? 0)}</b><span>{label}</span></div>)}
      </div>
      {line && (
        <div className="ac-line">
          {variant?.source === "model" ? variant.text : line.text}
          <span className="verified"> ✓ verified</span>
        </div>
      )}
      <div className="ac-formula">attribute = base + 8·Σ wᵢ·zᵢ (±20) · z vs role baseline, shrunk to a 30′ prior</div>
    </div>
  );
}

export function TeamStrip() {
  const team = useLive((s) => s.team);
  const meta = useLive((s) => s.meta);
  if (!team || !meta || !team.xg) return null;
  const h = meta.home.code, a = meta.away.code;
  const mom = team.momentum;
  return (
    <div className="team-strip">
      <div className="ts-cell"><span>xG</span><b>{(team.xg[h] ?? 0).toFixed(2)} – {(team.xg[a] ?? 0).toFixed(2)}</b></div>
      <div className="ts-cell"><span>shots (on target)</span><b>{team.shots[h] ?? 0} ({team.shots_on_target[h] ?? 0}) – {team.shots[a] ?? 0} ({team.shots_on_target[a] ?? 0})</b></div>
      <div className="ts-cell"><span>possession, last 5′</span><b>{(team.possession_5m[h] ?? 50).toFixed(0)}% – {(team.possession_5m[a] ?? 50).toFixed(0)}%</b></div>
      <div className="ts-cell wide"><span>momentum {mom >= 0 ? h : a} {Math.abs(mom).toFixed(2)}</span>
        <div className="ts-mom"><i style={{ left: `${50 + mom * 50}%` }} /></div>
      </div>
      <div className="ts-cell"><span>control ↔ chaos</span><b>{team.chaos}/100</b></div>
    </div>
  );
}
