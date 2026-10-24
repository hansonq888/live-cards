// Where a shot came from, on the attacking half of the pitch (goal at the top).
// ax/ay are pitch metres in the attacking team's frame: ax toward the goal, 52.5 at the line.
export function ShotMap({ ax, ay, xg, goal }: { ax: number; ay: number; xg: number; goal: boolean }) {
  const W = 68, H = 52.5;  // half pitch: width across, depth to halfway
  const sx = W / 2 - ay, sy = 52.5 - ax;  // svg: goal line at y=0, halfway at y=52.5
  const r = 1.4 + xg * 6;
  return (
    <svg className="shot-map" viewBox={`-2 -4 ${W + 4} ${H + 6}`} aria-label={`Shot from ${Math.round(Math.hypot(52.5 - ax, ay))} m`}>
      <rect x="0" y="0" width={W} height={H} rx="1.5" className="sm-pitch" />
      <rect x={W / 2 - 20.16} y="0" width="40.32" height="16.5" className="sm-line" />
      <rect x={W / 2 - 9.16} y="0" width="18.32" height="5.5" className="sm-line" />
      <path d={`M ${W / 2 - 9.15} ${H} A 9.15 9.15 0 0 1 ${W / 2 + 9.15} ${H}`} className="sm-line" />
      <rect x={W / 2 - 3.66} y="-2.2" width="7.32" height="2.2" className="sm-goal" />
      <line x1={sx} y1={sy} x2={W / 2} y2="0" className={`sm-path ${goal ? "goal" : ""}`} />
      <circle cx={sx} cy={sy} r={r} className={`sm-shot ${goal ? "goal" : ""}`} />
    </svg>
  );
}
