// A small diagram per stat that teaches it at a glance, drawn on the stat's own colour tile.
// The thresholds come from the stat registry (the values the engine uses), with the same
// defaults as a fallback until it loads.
import { stat } from "../live/stats";

export const STAT_LOOK: Record<string, { tint: string; short: string; line: string }> = {
  xg: { tint: "xg", short: "xG", line: "How likely a shot is to go in, from where it was taken." },
  space_control: { tint: "space", short: "Space", line: "Which team would win the race to each part of the pitch." },
  pass_difficulty: { tint: "pass", short: "Passing", line: "How hard a pass was: distance, pressure, where it went." },
  sprints: { tint: "sprint", short: "Running", line: "Who does the hard running, often away from the ball." },
  rating: { tint: "rating", short: "Form", line: "How a player's match is going, in words and numbers." },
};

const W = 200, H = 120;

function Xg() {
  const shots = [[100, 30, 0.55], [70, 52, 0.2], [140, 60, 0.12], [100, 86, 0.06], [48, 40, 0.09]] as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sv">
      <rect x="20" y="8" width="160" height="104" rx="3" className="sv-pitch" />
      <rect x="62" y="8" width="76" height="30" className="sv-line" />
      <rect x="88" y="3" width="24" height="5" className="sv-goal" />
      {shots.map(([x, y, q], i) => <circle key={i} cx={x} cy={y} r={3 + q * 14} className="sv-dot" opacity={0.55 + q} />)}
      <text x="100" y="104" textAnchor="middle" className="sv-cap">bigger dot = better chance</text>
    </svg>
  );
}

function XgTen() {
  return (
    <div className="sv-ten" aria-label="xG 0.30 means about 3 goals in 10 shots">
      <b>0.30</b><span>=</span>
      <div>{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < 3 ? "on" : ""} />)}</div>
      <em>3 in 10 go in</em>
    </div>
  );
}

function Space() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sv">
      <defs>
        <linearGradient id="svsp" x1="0" x2="1">
          <stop offset="0" stopColor="#ff6b6b" stopOpacity=".85" />
          <stop offset=".46" stopColor="#ff6b6b" stopOpacity=".55" />
          <stop offset=".54" stopColor="#5b8cff" stopOpacity=".55" />
          <stop offset="1" stopColor="#5b8cff" stopOpacity=".85" />
        </linearGradient>
      </defs>
      <rect x="20" y="8" width="160" height="104" rx="3" fill="url(#svsp)" />
      <path d="M 104 8 C 90 40, 124 70, 98 112" className="sv-edge" />
      <rect x="20" y="8" width="160" height="104" rx="3" className="sv-line" />
      <line x1="100" y1="8" x2="100" y2="112" className="sv-line" />
      {[[50, 30], [60, 80], [82, 55], [40, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" className="sv-red" />)}
      {[[150, 35], [130, 70], [118, 46], [160, 90]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" className="sv-blue" />)}
      <text x="100" y="104" textAnchor="middle" className="sv-cap">who gets there first</text>
    </svg>
  );
}

function Pass() {
  const marks = [[2.6, "routine"], [5.2, "hard"], [7.4, "very hard"]] as const;
  const bands = stat("pass_difficulty")?.bands ?? [4.5, 6.5];
  const X = (v: number) => 20 + ((v - 1) / 9) * 160;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sv">
      <rect x="20" y="52" width={X(bands[0]) - 20} height="14" rx="3" className="sv-band0" />
      <rect x={X(bands[0])} y="52" width={X(bands[1]) - X(bands[0])} height="14" className="sv-band1" />
      <rect x={X(bands[1])} y="52" width={180 - X(bands[1])} height="14" rx="3" className="sv-band2" />
      {marks.map(([v, l]) => (
        <g key={l}>
          <line x1={X(v)} y1="40" x2={X(v)} y2="72" className="sv-tick" />
          <text x={X(v)} y="34" textAnchor="middle" className="sv-lab">{l}</text>
        </g>
      ))}
      <text x="20" y="88" className="sv-cap">1</text>
      <text x="180" y="88" textAnchor="end" className="sv-cap">10</text>
      <text x="100" y="104" textAnchor="middle" className="sv-cap">distance + pressure + where it went</text>
    </svg>
  );
}

function Sprint() {
  const st = stat("sprints")?.settings;
  const hi = st?.high_intensity_kmh ?? 19.8, sp = st?.sprint_kmh ?? 25.2;
  const X = (v: number) => 20 + (v / 36) * 160;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sv">
      <rect x="20" y="52" width={X(hi) - 20} height="14" rx="3" className="sv-band0" />
      <rect x={X(hi)} y="52" width={X(sp) - X(hi)} height="14" className="sv-band1" />
      <rect x={X(sp)} y="52" width={180 - X(sp)} height="14" rx="3" className="sv-band2" />
      <text x={X(hi)} y="40" textAnchor="middle" className="sv-lab">{hi} km/h</text>
      <text x={X(sp)} y="40" textAnchor="middle" className="sv-lab">{sp} km/h</text>
      <text x={(20 + X(hi)) / 2} y="86" textAnchor="middle" className="sv-cap">jog</text>
      <text x={(X(hi) + X(sp)) / 2} y="86" textAnchor="middle" className="sv-cap">high intensity</text>
      <text x={(X(sp) + 180) / 2} y="86" textAnchor="middle" className="sv-cap">sprint</text>
    </svg>
  );
}

function Rating() {
  const words = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];
  return (
    <div className="sv-form">
      {words.map((w, i) => (
        <div key={w} className={`svf svf${i}`}><i style={{ height: 14 + i * 12 }} /><span>{w}</span></div>
      ))}
    </div>
  );
}

export function StatVisual({ id, big = false }: { id: string; big?: boolean }) {
  const look = STAT_LOOK[id];
  return (
    <div className={`stat-tile t-${look?.tint ?? "xg"} ${big ? "big" : ""}`}>
      {id === "xg" ? (big ? <div className="sv-pair"><Xg /><XgTen /></div> : <Xg />)
        : id === "space_control" ? <Space />
        : id === "pass_difficulty" ? <Pass />
        : id === "sprints" ? <Sprint />
        : <Rating />}
    </div>
  );
}
