// "Try it": click anywhere in the attacking half and the engine's own xG model (/api/xg) scores
// a shot from there. If that endpoint isn't available (an older server), the same formula runs
// here with the weights the engine publishes in the stat registry, so the number still matches.
import { useState } from "react";
import { stat } from "../live/stats";

const GOAL_HALF = 3.66;

function localXg(x: number, y: number): Shot {
  const st = stat("xg")?.settings ?? {};
  const b0 = st.intercept ?? -1.1, ba = st.angle_weight ?? 1.6, bd = st.distance_weight ?? -0.075;
  const dx = 52.5 - x, dy = y, dist = Math.hypot(dx, dy);
  let angle = Math.atan2(2 * GOAL_HALF * dx, dx * dx + dy * dy - GOAL_HALF ** 2);
  if (angle < 0) angle += Math.PI;
  const xg = Math.round(1000 / (1 + Math.exp(-(b0 + ba * angle + bd * dist)))) / 1000;
  return { x, y, xg, distance_m: Math.round(dist * 10) / 10 };
}

type Shot = { x: number; y: number; xg: number; distance_m: number };
const W = 68, H = 52.5;  // the attacking half, goal at the top; metres

export function XgTry() {
  const [shots, setShots] = useState<Shot[]>([]);
  const last = shots[shots.length - 1];
  const place = async (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W, sy = ((e.clientY - r.top) / r.height) * H;
    // screen: goal line at the top, left touchline at the left; pitch: x toward the goal, y left
    const x = Math.round((52.5 - sy) * 100) / 100, y = Math.round((34 - sx) * 100) / 100;
    let shot: Shot;
    try {
      const res = await fetch(`/api/xg?x=${x}&y=${y}`);
      shot = res.ok ? await res.json() : localXg(x, y);
    } catch {
      shot = localXg(x, y);
    }
    setShots((s) => [...s.slice(-5), shot]);
  };
  const n = last ? Math.round(last.xg * 10) : 0;
  return (
    <div className="xt">
      <svg viewBox={`0 0 ${W} ${H}`} className="xt-pitch" onClick={place} role="img" aria-label="Click to take a shot and see its xG">
        <rect x="0" y="0" width={W} height={H} className="xt-grass" />
        <g className="xt-lines">
          <rect x="0.2" y="0.2" width={W - 0.4} height={H - 0.4} /><rect x={W / 2 - 20.16} y="0.2" width="40.32" height="16.5" />
          <rect x={W / 2 - 9.16} y="0.2" width="18.32" height="5.5" /><circle cx={W / 2} cy="11" r=".4" />
          <path d={`M${W / 2 - 7.3} 16.5 A 9.15 9.15 0 0 0 ${W / 2 + 7.3} 16.5`} /><path d={`M${W / 2 - 9.15} ${H} A 9.15 9.15 0 0 1 ${W / 2 + 9.15} ${H}`} />
        </g>
        <rect x={W / 2 - 3.66} y="-1.2" width="7.32" height="1.4" className="xt-goal" />
        {shots.map((s, i) => {
          const cx = 34 - s.y, cy = 52.5 - s.x, on = i === shots.length - 1;
          return (
            <g key={i} opacity={on ? 1 : 0.35}>
              {on && <line x1={cx} y1={cy} x2={W / 2} y2="0" className="xt-path" />}
              <circle cx={cx} cy={cy} r={0.8 + s.xg * 3} className="xt-shot" />
            </g>
          );
        })}
      </svg>
      <div className="xt-read">
        {last ? (
          <>
            <span>xG from here</span>
            <b key={shots.length}>{last.xg.toFixed(2)}</b>
            <div className="xt-ten">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}</div>
            <em>{n >= 1 ? `About ${n} in 10 shots like this go in` : "Fewer than 1 in 10 go in"} · {last.distance_m} m out</em>
          </>
        ) : (
          <><span>Try it</span><b className="xt-hint">Click the pitch</b><em>to take a shot and see how likely it is to go in.</em></>
        )}
      </div>
    </div>
  );
}
