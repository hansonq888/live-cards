// Follow mode: everything about the player you picked, live. The numbers are the engine's
// (sent with their card twice a second); speed comes from the newest tracking frame, and the
// heatmap is where they have been so far.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";
import { formLevel } from "./Overlays";
import { Avatar } from "./Avatar";
import { teamOf } from "../live/teams";

const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];
// Each tile is tinted by what it measures: running, passing, attacking, defending.
const TILES: [string, string, (s: Record<string, number>) => string, string][] = [
  ["distance", "Distance", (s) => `${(s.distance_km ?? 0).toFixed(2)} km`, "run"],
  ["top", "Top speed", (s) => `${(s.top_speed_kmh ?? 0).toFixed(1)} km/h`, "run"],
  ["sprints", "Sprints", (s) => String(s.sprints ?? 0), "run"],
  ["passes", "Passes", (s) => `${s.passes_completed ?? 0}/${s.passes ?? 0}`, "pass"],
  ["shots", "Shots", (s) => String(s.shots ?? 0), "att"],
  ["xg", "xG", (s) => (s.xg ?? 0).toFixed(2), "att"],
  ["tackles", "Tackles won", (s) => String(s.tackles_won ?? 0), "def"],
  ["int", "Interceptions", (s) => String(s.interceptions ?? 0), "def"],
];

/** Low to high: yellow, orange, red. */
function heatColour(v: number) {
  const k = v / 100, h = 52 - k * 48;
  return `hsl(${h}, 100%, ${58 - k * 8}%)`;
}

export function useSpeed(pid: string) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      const f = live.frames[live.frames.length - 1]?.frame;
      const row = f?.players.find((p) => p[0] === pid);
      if (row) setV(row[3] * 3.6);
    }, 200);
    return () => clearInterval(id);
  }, [pid]);
  return v;
}

type HeatMap = { cols: number; rows: number; grid: number[] };

function Heat({ heat }: { heat?: HeatMap }) {
  return heat ? (
    <svg viewBox={`0 0 ${heat.cols} ${heat.rows}`} preserveAspectRatio="none">
      <defs><filter id="fp-blur"><feGaussianBlur stdDeviation=".45" /></filter></defs>
      <rect width={heat.cols} height={heat.rows} fill="#1f6b33" />
      <g filter="url(#fp-blur)">{heat.grid.map((v, i) => v > 4 && <rect key={i} x={i % heat.cols} y={Math.floor(i / heat.cols)} width="1" height="1" fill={heatColour(v)} opacity={0.35 + (v / 100) * 0.6} />)}</g>
      <line x1={heat.cols / 2} y1="0" x2={heat.cols / 2} y2={heat.rows} stroke="rgba(255,255,255,.6)" strokeWidth=".06" />
      <rect x=".03" y=".03" width={heat.cols - .06} height={heat.rows - .06} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth=".06" />
    </svg>
  ) : <div className="fp-wait">Building…</div>;
}

// The four numbers that matter most for the role; the rest are one tap away.
const KEY: Record<string, string[]> = {
  attack: ["distance", "top", "shots", "xg"],
  other: ["distance", "passes", "tackles", "int"],
};

/** Following, in one card: sits directly under the live player card (which already shows the
 *  name, speed and form) with the heatmap, the key numbers for the role, and a way out. */
export function FollowCard() {
  const director = useLive((s) => s.director);
  const meta = useLive((s) => s.meta);
  const pid = director?.mode === "manual" ? director.target : null;
  const stats = useLive((s) => (pid ? s.stats[pid] : undefined));
  const heat = useLive((s) => (pid ? s.heat[pid] : undefined));
  const [all, setAll] = useState(false);
  if (!pid || !meta) return null;
  const p = meta.players.find((x) => x.id === pid);
  if (!p) return null;
  const team = teamOf(meta, p.team);
  const keys = ["ST", "W", "AM"].includes(p.role) ? KEY.attack : KEY.other;
  const tiles = all ? TILES : TILES.filter(([k]) => keys.includes(k));
  return (
    <section className="follow-card" style={{ ["--team" as string]: team.color }}>
      <div className="flc-row">
        <div className="flc-heat"><span>Where they've played</span><Heat heat={heat} /><em>{team.code === meta.home.code ? "Attacking →" : "← Attacking"}</em></div>
        <div className={`flc-tiles ${all ? "all" : ""}`}>{stats && tiles.map(([k, label, f, kind]) => <Tile key={k} label={label} value={f(stats)} kind={kind} />)}</div>
      </div>
      <PlayerXg pid={pid} color={team.color} />
      <div className="flc-foot">
        <button className="flc-more" onClick={() => setAll((a) => !a)}>{all ? "Key stats" : "All stats"}</button>
        <button className="flc-stop" onClick={() => live.stopFollowing()} title="Let the auto-director choose who to follow again">Stop following</button>
      </div>
    </section>
  );
}

/** This player's xG over the match: a step line that climbs with each shot (goals filled),
 *  the "now" line moving with the clock. Click a shot to replay it on the tactics board. */
function PlayerXg({ pid, color }: { pid: string; color: string }) {
  const plays = useLive((s) => s.plays);
  const t = useLive((s) => s.t);
  const shots = plays.filter((x) => x.player === pid && x.t <= t + 1).sort((a, b) => a.t - b.t);
  const W = 260, H = 84, P = 6, END = 5400;
  let run = 0;
  const pts = shots.map((x) => ({ ...x, before: run, after: (run += x.xg) }));
  const top = Math.max(0.5, run * 1.15);
  const X = (sec: number) => P + (Math.min(sec, END) / END) * (W - 2 * P);
  const Y = (v: number) => H - P - (v / top) * (H - 2 * P);
  let d = `M ${X(0)} ${Y(0)}`;
  for (const q of pts) d += ` H ${X(q.t)} V ${Y(q.after)}`;
  d += ` H ${X(t)}`;
  return (
    <div className="pxg">
      <div className="pxg-head"><span>xG over the match</span><b>{run.toFixed(2)}</b><em>{shots.length} shot{shots.length === 1 ? "" : "s"}</em></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="pxg-chart" role="img" aria-label={`xG over time: ${run.toFixed(2)} from ${shots.length} shots`}>
        {[15, 30, 45, 60, 75].map((m) => <line key={m} x1={X(m * 60)} x2={X(m * 60)} y1={P} y2={H - P} className="pxg-grid" />)}
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" />
        <line x1={X(t)} x2={X(t)} y1={P} y2={H - P} className="pxg-now" />
        {pts.map((q) => (
          <circle key={q.id} cx={X(q.t)} cy={Y(q.after)} r={3 + q.xg * 10} className="pxg-shot"
            fill={q.outcome === "goal" ? color : "#fff"} stroke={color} strokeWidth="1.6" onClick={() => live.showMe(q.id)}>
            <title>{`${q.minute}′ · xG ${q.xg.toFixed(2)} · ${q.outcome.replace("_", " ")}. Click to replay`}</title>
          </circle>
        ))}
      </svg>
      {shots.length === 0 && <p className="pxg-empty">No shots yet.</p>}
    </div>
  );
}

function Tile({ label, value, kind }: { label: string; value: string; kind: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setFlash(true); const t = setTimeout(() => setFlash(false), 900); return () => clearTimeout(t); }
  }, [value]);
  return <div className={`fp-tile k-${kind} ${flash ? "flash" : ""}`}><span>{label}</span><b>{value}</b></div>;
}
