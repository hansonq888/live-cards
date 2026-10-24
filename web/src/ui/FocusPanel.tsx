// Follow mode: everything about the player you picked, live. The numbers are the engine's
// (sent with their card twice a second); speed comes from the newest tracking frame, and the
// heatmap is where they have been so far.
import { useEffect, useRef, useState } from "react";
import { live, useLive } from "../live/store";
import { formLevel } from "./Overlays";
import { Shirt } from "./Shirt";

const FORM = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];
const TILES: [string, string, (s: Record<string, number>) => string][] = [
  ["distance", "Distance", (s) => `${(s.distance_km ?? 0).toFixed(2)} km`],
  ["top", "Top speed", (s) => `${(s.top_speed_kmh ?? 0).toFixed(1)} km/h`],
  ["sprints", "Sprints", (s) => String(s.sprints ?? 0)],
  ["passes", "Passes", (s) => `${s.passes_completed ?? 0}/${s.passes ?? 0}`],
  ["shots", "Shots", (s) => String(s.shots ?? 0)],
  ["xg", "xG", (s) => (s.xg ?? 0).toFixed(2)],
  ["tackles", "Tackles won", (s) => String(s.tackles_won ?? 0)],
  ["int", "Interceptions", (s) => String(s.interceptions ?? 0)],
];

/** Low to high: yellow, orange, red. */
function heatColour(v: number) {
  const k = v / 100, h = 52 - k * 48;
  return `hsl(${h}, 100%, ${58 - k * 8}%)`;
}

function useSpeed(pid: string) {
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

function Tile({ label, value }: { label: string; value: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) { prev.current = value; setFlash(true); const t = setTimeout(() => setFlash(false), 900); return () => clearTimeout(t); }
  }, [value]);
  return <div className={`fp-tile ${flash ? "flash" : ""}`}><span>{label}</span><b>{value}</b></div>;
}

export function FocusPanel() {
  const director = useLive((s) => s.director);
  const meta = useLive((s) => s.meta);
  const pid = director?.mode === "manual" ? director.target : null;
  const stats = useLive((s) => (pid ? s.stats[pid] : undefined));
  const card = useLive((s) => (pid ? s.cards[pid] : undefined));
  const heat = useLive((s) => (pid ? s.heat[pid] : undefined));
  const feed = useLive((s) => s.feed);
  const speed = useSpeed(pid ?? "");
  if (!pid || !meta) return null;
  const p = meta.players.find((x) => x.id === pid);
  if (!p) return null;
  const team = p.team === meta.home.code ? meta.home : meta.away;
  const level = formLevel(card?.rating ?? 6);
  const sprinting = speed >= 25.2, fast = speed >= 19.8;
  const recent = feed.filter((f) => f.player === pid).slice(0, 4);
  return (
    <section className="an-panel fp">
      <header className="fp-head">
        <Shirt number={p.number} color={team.color} size={40} />
        <div className="fp-id"><b>{p.name}</b><span>{p.position} · {team.name}</span></div>
        <span className={`fp-form f${level}`}>{FORM[level]}{card ? ` · ${card.rating.toFixed(1)}` : ""}</span>
        <button className="fp-close" onClick={() => live.send({ type: "auto" })}>Back to auto</button>
      </header>
      <div className="fp-grid">
        <div className="fp-speed">
          <span>Speed now</span>
          <b>{speed.toFixed(1)}<small> km/h</small></b>
          <div className="fp-gauge"><i style={{ width: `${Math.min(100, (speed / 36) * 100)}%` }} className={sprinting ? "sprint" : fast ? "fast" : ""} /></div>
          <em>{sprinting ? "Sprinting" : fast ? "High intensity" : speed > 7 ? "Jogging" : "Walking"}</em>
        </div>
        <div className="fp-tiles">{stats && TILES.map(([k, label, f]) => <Tile key={k} label={label} value={f(stats)} />)}</div>
        <div className="fp-heat">
          <span>Where they've played</span>
          {heat ? (
            <svg viewBox={`0 0 ${heat.cols} ${heat.rows}`} preserveAspectRatio="none">
              <defs><filter id="fp-blur"><feGaussianBlur stdDeviation=".45" /></filter></defs>
              <rect width={heat.cols} height={heat.rows} fill="#1f6b33" />
              <g filter="url(#fp-blur)">{heat.grid.map((v, i) => v > 4 && <rect key={i} x={i % heat.cols} y={Math.floor(i / heat.cols)} width="1" height="1" fill={heatColour(v)} opacity={0.35 + (v / 100) * 0.6} />)}</g>
              <line x1={heat.cols / 2} y1="0" x2={heat.cols / 2} y2={heat.rows} stroke="rgba(255,255,255,.6)" strokeWidth=".06" />
              <rect x=".03" y=".03" width={heat.cols - .06} height={heat.rows - .06} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth=".06" />
            </svg>
          ) : <div className="fp-wait">Building…</div>}
          <em>{team.code === meta.home.code ? "Attacking →" : "← Attacking"}</em>
        </div>
      </div>
      {recent.length > 0 && (
        <ul className="fp-recent">{recent.map((f) => <li key={f.id}><b>{Math.floor(f.t / 60)}′</b>{f.text}</li>)}</ul>
      )}
    </section>
  );
}
