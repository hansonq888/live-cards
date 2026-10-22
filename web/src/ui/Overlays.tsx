import { useEffect, useRef, useState } from "react";
import { clock, useLive } from "../live/store";

const ATTRS: [string, string][] = [
  ["pace", "Pace"], ["passing", "Passing"], ["threat", "Threat"], ["defending", "Defending"], ["engine", "Engine"],
];

function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return performance.now();
}

/** Animate a number toward its target (count-up on upgrades). */
function useAnimated(value: number, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    if (a === b) return;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return shown;
}

export function ScoreBug() {
  const meta = useLive((s) => s.meta);
  const team = useLive((s) => s.team);
  const t = useLive((s) => s.t);
  if (!meta) return null;
  const sc = team?.score ?? { [meta.home.code]: 0, [meta.away.code]: 0 };
  return (
    <div className="bug">
      <div className="team" style={{ background: meta.home.color }}>{meta.home.code}</div>
      <div className="score">{sc[meta.home.code]} – {sc[meta.away.code]}</div>
      <div className="team" style={{ background: meta.away.color }}>{meta.away.code}</div>
      <div className="clock">{clock(t)}</div>
    </div>
  );
}

export function PlayerCard() {
  const meta = useLive((s) => s.meta);
  const director = useLive((s) => s.director);
  const cards = useLive((s) => s.cards);
  const stats = useLive((s) => s.stats);
  const lines = useLive((s) => s.lines);
  const pending = useLive((s) => s.pending);
  const upgrades = useLive((s) => s.upgrades);
  const now = useTicker();
  const pid = director?.target;
  const card = pid ? cards[pid] : undefined;
  const rating = useAnimated(card?.rating ?? 6.0);
  if (!meta || !pid || !card) return null;
  const p = meta.players.find((x) => x.id === pid)!;
  const team = p.team === meta.home.code ? meta.home : meta.away;
  const st = stats[pid] ?? {};
  const up = upgrades[pid];
  const fresh = up && now - up.at < 5000;
  const isUp = fresh && up.to >= up.from;
  const line = lines[pid];
  const waiting = pending[pid] && now - pending[pid].at < 6000;
  return (
    <div className={`card ${fresh ? (isUp ? "card-up" : "card-down") : ""}`} style={{ ["--team" as string]: team.color }}>
      <div className="card-stripe" />
      <div className="card-top">
        <div className="card-rating">{rating.toFixed(1)}</div>
        <div className="card-id">
          <div className="card-name">
            {p.name}
            {fresh && <span className={`delta ${isUp ? "up" : "down"}`}>{isUp ? "▲" : "▼"} {up.label === "Rating" ? Math.abs(up.to - up.from).toFixed(1) : `${up.label} ${Math.abs(up.to - up.from)}`}</span>}
          </div>
          <div className="card-meta">#{p.number} · {p.position} · {team.name}</div>
        </div>
      </div>
      <div className="attrs">
        {ATTRS.map(([k, label]) => {
          const v = card.attrs[k] ?? 0;
          const hot = fresh && up.label === k;
          return (
            <div key={k} className={`attr ${hot ? (isUp ? "attr-hot" : "attr-cold") : ""}`}>
              <span className="attr-label">{label}</span>
              <span className="attr-bar"><i style={{ width: `${v}%` }} /></span>
              <b>{v}</b>
            </div>
          );
        })}
      </div>
      <div className="stats">
        <div><b>{(st.distance_km ?? 0).toFixed(2)}</b><span>km</span></div>
        <div><b>{(st.top_speed_kmh ?? 0).toFixed(1)}</b><span>top km/h</span></div>
        <div><b>{st.passes_completed ?? 0}/{st.passes ?? 0}</b><span>passes</span></div>
        <div><b>{st.shots ?? 0}</b><span>shots</span></div>
      </div>
      <div className="reason">
        {waiting ? (
          <span className="explaining"><i />Explaining and verifying…</span>
        ) : line ? (
          <>
            <span className="reason-text">{line.text}</span>
            <span className="reason-meta">
              <span className="verified">✓ verified</span>
              <span className={`src src-${line.source}`}>{line.source === "model" ? "AI" : "template"}</span>
              <span className="evidence" title={line.evidence.join(", ")}>{line.evidence.length} evidence</span>
            </span>
          </>
        ) : (
          <span className="reason-text dim">{card.reason || "Card starts at 6.0. Every change explains itself."}</span>
        )}
      </div>
    </div>
  );
}

export function DirectorTicker() {
  const director = useLive((s) => s.director);
  const now = useTicker();
  if (!director) return null;
  const fresh = now - director.at < 1500;
  return (
    <div className={`director ${fresh ? "director-fresh" : ""} ${director.predicted ? "director-predict" : ""}`}>
      <span className="director-label">{director.mode === "manual" ? "YOUR PICK" : director.predicted ? "AUTO-DIRECTOR · PREDICTED" : "AUTO-DIRECTOR"}</span>
      <span className="director-reason">{director.reason}</span>
    </div>
  );
}

export function GoalBanner() {
  const banner = useLive((s) => s.banner);
  const now = useTicker(200);
  if (!banner || now - banner.at > 4500) return null;
  return (
    <div className="goal-banner">
      <div className="goal-word">GOAL</div>
      <div className="goal-sub">{banner.sub}</div>
    </div>
  );
}
