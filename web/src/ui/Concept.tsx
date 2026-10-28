// One idea per lesson, drawn: a short looping SVG animation that shows the concept and nothing
// else (no match clutter). Numbers on screen come from the engine: the xG labels are what
// metrics.xg gives for those spots, the speeds are its thresholds, the rating steps its weights.
import type { ReactNode } from "react";

const RED = "#d3302a", BLUE = "#2a5cb8", LIME = "#d4ff3a", DUR = "6s";

function Pitch({ children, half = false }: { children: ReactNode; half?: boolean }) {
  return (
    <svg viewBox="0 0 320 180" className="concept" role="img">
      <rect width="320" height="180" rx="10" fill="#1f7a45" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 40} width="20" height="180" fill="#ffffff" opacity=".04" />)}
      <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2">
        <rect x="10" y="10" width="300" height="160" />
        {half ? (
          <>
            <rect x="250" y="45" width="60" height="90" />
            <rect x="290" y="70" width="20" height="40" />
            <path d="M 250 72 A 22 22 0 0 0 250 108" />
          </>
        ) : (
          <>
            <line x1="160" y1="10" x2="160" y2="170" />
            <circle cx="160" cy="90" r="22" />
          </>
        )}
      </g>
      {children}
    </svg>
  );
}

/** Show `children` only during [from, to] of the loop (fractions of DUR). */
function During({ from, to, children }: { from: number; to: number; children: ReactNode }) {
  const a = Math.max(0.001, from), b = Math.min(0.999, to);
  return (
    <g opacity="0">
      <animate attributeName="opacity" dur={DUR} repeatCount="indefinite" calcMode="discrete"
        values="0;1;0" keyTimes={`0;${a};${b}`} />
      {children}
    </g>
  );
}

/** A ball that travels along `path` between [from, to] of the loop and waits at either end. */
function Ball({ path, from, to }: { path: string; from: number; to: number }) {
  return (
    <circle r="4" fill="#fff" stroke="#0d0a24" strokeWidth="1">
      <animateMotion dur={DUR} repeatCount="indefinite" path={path} calcMode="linear"
        keyPoints="0;0;1;1" keyTimes={`0;${from};${to};1`} />
    </circle>
  );
}

function Label({ x, y, children, color = "#fff", size = 13 }: { x: number; y: number; children: ReactNode; color?: string; size?: number }) {
  return <text x={x} y={y} fill={color} fontSize={size} fontWeight="800" fontFamily="inherit" textAnchor="middle">{children}</text>;
}

function Xg() {
  return (
    <Pitch half>
      <rect x="306" y="80" width="6" height="20" fill="#fff" />
      <During from={0} to={0.5}>
        <circle cx="160" cy="90" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
        <Ball path="M 160 90 L 308 86" from={0.1} to={0.28} />
        <Label x={120} y={40}>From 30 m out</Label>
        <During from={0.3} to={0.5}><Label x={120} y={60} color={LIME} size={18}>xG 0.05</Label></During>
      </During>
      <During from={0.5} to={1}>
        <circle cx="282" cy="90" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
        <Ball path="M 282 90 L 308 94" from={0.6} to={0.68} />
        <Label x={120} y={40}>From 8 m, central</Label>
        <During from={0.72} to={1}><Label x={120} y={60} color={LIME} size={18}>xG 0.42</Label></During>
      </During>
    </Pitch>
  );
}

function PassDifficulty() {
  return (
    <Pitch>
      <line x1="160" y1="10" x2="160" y2="170" stroke="#0d0a24" strokeOpacity=".35" strokeWidth="3" />
      {/* left: an easy pass, nobody near */}
      <circle cx="50" cy="110" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
      <circle cx="100" cy="95" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
      <Ball path="M 50 110 L 100 95" from={0.15} to={0.35} />
      <Label x={80} y={38}>Short, free</Label>
      {/* right: a long ball threaded between two closing defenders */}
      <circle cx="180" cy="140" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
      <circle cx="295" cy="50" r="6" fill={RED} stroke="#fff" strokeWidth="1.5" />
      <circle cy="85" r="6" fill={BLUE} stroke="#fff" strokeWidth="1.5"><animate attributeName="cx" dur={DUR} repeatCount="indefinite" values="215;232;232" keyTimes="0;0.5;1" /></circle>
      <circle cy="110" r="6" fill={BLUE} stroke="#fff" strokeWidth="1.5"><animate attributeName="cx" dur={DUR} repeatCount="indefinite" values="275;256;256" keyTimes="0;0.5;1" /></circle>
      <circle cx="186" cy="132" r="6" fill={BLUE} stroke="#fff" strokeWidth="1.5" opacity=".9" />
      <Ball path="M 180 140 L 295 50" from={0.45} to={0.7} />
      <Label x={240} y={38}>Long, through a gap</Label>
      {/* meters */}
      {[[30, 0.2, 0.15, 0.35, "#3ddc97", "routine"], [190, 0.85, 0.45, 0.7, "#fb7185", "very hard"]].map(([x, f, a, b, c, word]) => (
        <g key={String(x)}>
          <rect x={Number(x)} y="152" width="100" height="7" rx="3.5" fill="#fff" opacity=".2" />
          <rect x={Number(x)} y="152" height="7" rx="3.5" fill={String(c)}>
            <animate attributeName="width" dur={DUR} repeatCount="indefinite" values={`0;0;${Number(f) * 100};${Number(f) * 100}`} keyTimes={`0;${a};${b};1`} />
          </rect>
          <During from={Number(b)} to={1}><Label x={Number(x) + 50} y={146} size={11} color={String(c)}>{String(word)}</Label></During>
        </g>
      ))}
    </Pitch>
  );
}

function SpaceControl() {
  const move = (from: number, to: number) => <animate attributeName="cx" dur={DUR} repeatCount="indefinite" values={`${from};${from};${to};${to}`} keyTimes="0;0.15;0.75;1" />;
  return (
    <Pitch>
      {/* each team's ground: red's edge pushes right as red pushes up */}
      <rect x="10" y="10" height="160" fill={RED} opacity=".32">
        <animate attributeName="width" dur={DUR} repeatCount="indefinite" values="120;120;215;215" keyTimes="0;0.15;0.75;1" />
      </rect>
      <rect y="10" height="160" width="300" fill={BLUE} opacity=".3">
        <animate attributeName="x" dur={DUR} repeatCount="indefinite" values="130;130;225;225" keyTimes="0;0.15;0.75;1" />
      </rect>
      <rect x="10" y="10" width="300" height="160" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
      <line x1="210" y1="10" x2="210" y2="170" stroke="#fff" strokeOpacity=".8" strokeDasharray="4 4" />
      <Label x={260} y={28} size={11}>final third</Label>
      {[[60, 50], [70, 130], [100, 90], [120, 60]].map(([x, y], i) => (
        <circle key={i} cy={y} r="6" fill={RED} stroke="#fff" strokeWidth="1.5" cx={x}>{move(x, x + 95)}</circle>
      ))}
      {[[200, 60], [210, 120], [250, 90], [280, 50]].map(([x, y], i) => (
        <circle key={i} cy={y} r="6" fill={BLUE} stroke="#fff" strokeWidth="1.5" cx={x}>{move(x, x + 25)}</circle>
      ))}
      <During from={0.75} to={1}><Label x={160} y={158} color={LIME}>Red now owns part of the final third</Label></During>
    </Pitch>
  );
}

function Sprints() {
  const speeds: [number, number, string, string][] = [[0, 0.25, "12 km/h", "#fff"], [0.25, 0.45, "19.8 km/h · high intensity", "#ffd23f"], [0.45, 1, "25.2 km/h+ · SPRINT", LIME]];
  return (
    <Pitch>
      <line x1="40" y1="110" x2="290" y2="110" stroke="#fff" strokeOpacity=".2" strokeWidth="6" strokeLinecap="round" />
      <line x1="40" y1="110" y2="110" stroke="#fff" strokeWidth="6" strokeLinecap="round">
        <animate attributeName="x2" dur={DUR} repeatCount="indefinite" values="40;40;290;290" keyTimes="0;0.05;0.85;1" calcMode="spline" keySplines="0 0 1 1;.6 0 .9 .6;0 0 1 1" />
        <animate attributeName="stroke" dur={DUR} repeatCount="indefinite" calcMode="discrete" values="#ffffff;#ffd23f;#d4ff3a" keyTimes="0;0.25;0.45" />
      </line>
      <circle cy="110" r="7" fill={RED} stroke="#fff" strokeWidth="1.5">
        <animate attributeName="cx" dur={DUR} repeatCount="indefinite" values="40;40;290;290" keyTimes="0;0.05;0.85;1" calcMode="spline" keySplines="0 0 1 1;.6 0 .9 .6;0 0 1 1" />
      </circle>
      {speeds.map(([a, b, text, color]) => <During key={text} from={a} to={b}><Label x={160} y={64} size={18} color={color}>{text}</Label></During>)}
      <Label x={160} y={150} size={11} color="rgba(255,255,255,.75)">held for at least a second counts as a sprint</Label>
    </Pitch>
  );
}

function Rating() {
  const steps: [number, number, string, string | null][] = [[0, 0.3, "6.0", null], [0.3, 0.6, "6.1", "Tackle won  +0.1"], [0.6, 1, "7.1", "Goal  +1.0"]];
  return (
    <svg viewBox="0 0 320 180" className="concept" role="img">
      <rect width="320" height="180" rx="10" fill="#160f35" />
      <rect x="40" y="30" width="110" height="120" rx="12" fill={RED} />
      <Label x={95} y={58} size={11}>RATING</Label>
      {steps.map(([a, b, value, event]) => (
        <During key={value} from={a} to={b}>
          <Label x={95} y={112} size={44}>{value}</Label>
          {event && <Label x={235} y={95} size={15} color={LIME}>{event}</Label>}
        </During>
      ))}
      <Label x={235} y={130} size={11} color="rgba(255,255,255,.7)">everyone starts at 6.0</Label>
    </svg>
  );
}

const CONCEPTS: Record<string, { draw: () => JSX.Element; caption: string }> = {
  xg: { draw: Xg, caption: "The same striker, two spots. From 30 m the model gives about a 1 in 20 chance; from 8 m in front of goal, about 4 in 10." },
  pass_difficulty: { draw: PassDifficulty, caption: "A short pass with nobody near is routine. A long ball threaded between two closing defenders is very hard, even before it's completed." },
  space_control: { draw: SpaceControl, caption: "Each team owns the ground its players would reach first. When red pushes up together, its ground moves into the final third." },
  sprints: { draw: Sprints, caption: "A run counts as high intensity from 19.8 km/h and as a sprint from 25.2 km/h, if it's held for at least a second." },
  rating: { draw: Rating, caption: "Every player starts at 6.0. Each action moves it by a fixed, published amount: a tackle won +0.1, a goal +1.0." },
};

export function Concept({ id }: { id: string }) {
  const c = CONCEPTS[id];
  if (!c) return null;
  const Draw = c.draw;
  return (
    <figure className="ls-clip">
      <Draw />
      <figcaption><em>The idea</em>{c.caption}</figcaption>
    </figure>
  );
}
