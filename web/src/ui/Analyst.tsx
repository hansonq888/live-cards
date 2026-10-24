// Analyst mode: the same moment, shown with its working. Every number here comes from the engine.
import { useState } from "react";
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

type Tab = "rating" | "attrs" | "stats";

export function AnalystCard({ pid }: { pid: string }) {
  const meta = useLive((s) => s.meta);
  const a = useLive((s) => s.analyst[pid]);
  const mine = useLive((s) => s.custom[pid]);
  const line = useLive((s) => s.lines[pid]);
  const profile = useLive((s) => s.profile);
  const [tab, setTab] = useState<Tab>("rating");
  const [open, setOpen] = useState<string | null>(null);
  if (!meta || !a) return null;
  const p = meta.players.find((x) => x.id === pid)!;
  const team = p.team === meta.home.code ? meta.home : meta.away;
  const variant = line?.variants[profile];
  const sign = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`;
  return (
    <div className="acard" style={{ ["--team" as string]: team.color }}>
      <div className="ac-head">
        <div>
          <div className="card-name"><span className="first">{p.name.split(" ").slice(0, -1).join(" ")}</span><span className="last">{p.name.split(" ").slice(-1)[0]}</span></div>
          <div className="card-meta"><i className="team-dot" />{p.position} · {a.minutes.toFixed(0)}′ played</div>
        </div>
        <div className="ac-rating">{a.rating.toFixed(2)}</div>
      </div>
      {mine && (
        <div className="ac-compare">
          <div><span>Live Cards</span><b>{a.rating.toFixed(2)}</b></div>
          <div className="yours"><span>{mine.name}</span><b>{mine.rating.toFixed(2)}</b></div>
          <div className={mine.rating >= a.rating ? "up" : "down"}><span>difference</span><b>{sign(mine.rating - a.rating)}</b></div>
        </div>
      )}
      {line && (
        <div className="ac-line">{variant?.source === "model" ? variant.text : line.text}<span className="verified"> ✓</span></div>
      )}
      <nav className="ac-tabs">
        {(["rating", "attrs", "stats"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{{ rating: "Rating", attrs: "Attributes", stats: "Stats" }[t]}</button>
        ))}
      </nav>
      <div className="ac-body">
        {tab === "rating" && (
          <>
            <div className="ac-row ac-start"><span>Start</span><b>6.00</b></div>
            {a.breakdown.map((b) => (
              <div key={b.kind} className={`ac-row ${b.total >= 0 ? "pos" : "neg"}`}>
                <span>{b.label}{b.count > 1 && <em> ×{b.count}</em>}</span>
                <b>{sign(b.total)}{mine && <em className="yours"> / {sign(mine.breakdown.find((x) => x.kind === b.kind)?.total ?? 0)}</em>}</b>
              </div>
            ))}
            <div className="ac-row ac-total"><span>Rating now</span><b>{a.rating.toFixed(2)}</b></div>
            <p className="ac-note">Starts at 6.00; every event adds or subtracts a fixed weight.{mine ? " Yours shown after the slash." : ""}</p>
          </>
        )}
        {tab === "attrs" && (
          <>
            {Object.entries(a.attrs).map(([k, v]) => (
              <div key={k} className={`ac-attr ${open === k ? "open" : ""}`}>
                <button className="ac-attr-head" onClick={() => setOpen(open === k ? null : k)}>
                  <span>{ATTR_LABEL[k]}</span>
                  <span className="ac-bar"><i style={{ width: `${v.value}%` }} /></span>
                  <b>{v.value}</b>
                  <em className={v.value > v.base ? "up" : v.value < v.base ? "down" : ""}>{v.value === v.base ? "±0" : `${v.value > v.base ? "+" : ""}${v.value - v.base}`}</em>
                </button>
                {open === k && (
                  <div className="ac-metrics">
                    {v.metrics.map((m) => (
                      <div key={m.key} className="ac-metric">
                        <span>{m.label.replace(/ \(.*\)/, "")}</span>
                        <b>{m.per90 ? `${m.value}/90` : m.value}</b>
                        <span className="dim">avg {m.role_mean}</span>
                        <em className={m.z > 0.25 ? "hi" : m.z < -0.25 ? "lo" : ""}>{fmtZ(m.z)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p className="ac-note">Compared with the average {a.role}. Tap an attribute for its working. attribute = base + 8·Σ wᵢ·zᵢ (±20).</p>
          </>
        )}
        {tab === "stats" && (
          <div className="ac-adv">
            {ADV.map(([k, label, f]) => <div key={k}><b>{f(a.advanced[k] ?? 0)}</b><span>{label}</span></div>)}
          </div>
        )}
      </div>
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
