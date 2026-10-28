// "The Fifth Official" logo concepts, shown on ?page=mock. Our own marks only: a whistle, the
// VAR review rectangle referees draw in the air, an assistant's flag, a card, a "5" badge.
// No league or governing-body marks.
const P = "#2a0a4a", V = "#4b2bd6", L = "#d4ff3a";

type C = { dark: boolean };
const ink = (dark: boolean) => (dark ? "#fff" : P);

function Name({ dark, x = 92, y = 52, small = false }: C & { x?: number; y?: number; small?: boolean }) {
  return (
    <text x={x} y={y} className={small ? "fo-word sm" : "fo-word"} fill={ink(dark)}>
      <tspan className="fo-the" fill={dark ? L : V}>THE </tspan>Fifth Official
    </text>
  );
}

/** 1 · Asterisk: the current lime mark, renamed. Zero redesign. */
const Asterisk = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <circle cx="40" cy="45" r="30" fill={dark ? L : V} />
    <g stroke={dark ? P : L} strokeWidth="7.5" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="40" y1="29" x2="40" y2="61" transform={`rotate(${a} 40 45)`} />)}</g>
    <Name dark={dark} x={82} y={56} />
  </svg>
);

/** 2 · Review box: the rectangle a referee draws in the air for a VAR review. */
const ReviewBox = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <rect x="12" y="20" width="62" height="50" rx="6" fill="none" stroke={dark ? L : V} strokeWidth="6" strokeDasharray="44 10" />
    <text x="43" y="57" textAnchor="middle" className="fo-num" fill={ink(dark)}>5</text>
    <Name dark={dark} x={90} y={56} />
  </svg>
);

/** 3 · Whistle: a simple whistle silhouette, with a lime "sound" mark. */
const Whistle = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <path d="M16 40 h26 a20 20 0 1 1 -2 22 h-24 z" fill={dark ? L : V} />
    <circle cx="56" cy="51" r="6" fill={dark ? P : "#fff"} />
    <path d="M70 26 l8 -8 M74 34 l11 -4 M64 22 l2 -11" stroke={dark ? "#fff" : L} strokeWidth="4" strokeLinecap="round" />
    <Name dark={dark} x={96} y={56} />
  </svg>
);

/** 4 · Flag: the assistant's flag raised; halves in violet and lime. */
const Flag = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <line x1="22" y1="14" x2="22" y2="78" stroke={ink(dark)} strokeWidth="5" strokeLinecap="round" />
    <path d="M24 16 h46 l-10 16 l10 16 h-46 z" fill={dark ? L : V} />
    <path d="M24 16 h23 v32 h-23 z" fill={dark ? "#fff" : L} />
    <Name dark={dark} x={86} y={56} />
  </svg>
);

/** 5 · Badge: a referee's chest badge with a big 5. */
const Badge = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <path d="M42 10 l30 10 v24 c0 18 -14 30 -30 36 c-16 -6 -30 -18 -30 -36 v-24 z" fill={dark ? L : V} />
    <text x="42" y="60" textAnchor="middle" className="fo-num big" fill={dark ? P : L}>5</text>
    <Name dark={dark} x={88} y={56} />
  </svg>
);

/** 6 · Card: a raised card (lime, so it isn't a disciplinary yellow) with a check mark. */
const Card = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <rect x="20" y="12" width="44" height="64" rx="5" fill={L} transform="rotate(-10 42 44)" />
    <path d="M30 46 l9 9 l18 -20" fill="none" stroke={P} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" transform="rotate(-10 42 44)" />
    <Name dark={dark} x={86} y={56} />
  </svg>
);

/** 7 · Stacked poster: THE FIFTH / OFFICIAL in heavy italic, like a broadcast graphic. */
const Poster = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <text x="14" y="40" className="fo-poster" fill={dark ? L : V}>THE FIFTH</text>
    <text x="14" y="80" className="fo-poster" fill={ink(dark)}>OFFICIAL</text>
    <circle cx="196" cy="56" r="11" fill={dark ? L : V} />
    <g stroke={dark ? P : L} strokeWidth="3.4" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="196" y1="49" x2="196" y2="63" transform={`rotate(${a} 196 56)`} />)}</g>
  </svg>
);

/** 8 · 5th monogram: a compact icon for favicons and app tiles. */
const Monogram = ({ dark }: C) => (
  <svg viewBox="0 0 340 90" className="lg">
    <rect x="10" y="10" width="70" height="70" rx="18" fill={dark ? "#fff" : V} />
    <text x="38" y="62" textAnchor="middle" className="fo-num big" fill={dark ? V : "#fff"}>5</text>
    <text x="61" y="38" textAnchor="middle" className="fo-th" fill={L}>th</text>
    <Name dark={dark} x={94} y={56} />
  </svg>
);

const CONCEPTS: [string, string, (p: C) => JSX.Element][] = [
  ["1 · Asterisk", "Today's lime mark with the new name. No redesign needed.", Asterisk],
  ["2 · Review box", "The rectangle a referee draws in the air for a VAR review, with a 5.", ReviewBox],
  ["3 · Whistle", "A whistle with a lime sound mark: the official calling it.", Whistle],
  ["4 · Flag", "The assistant's raised flag in our colours.", Flag],
  ["5 · Badge", "A referee's chest badge with a big 5.", Badge],
  ["6 · Checked card", "A raised card, lime with a tick: every claim checked.", Card],
  ["7 · Poster", "Stacked heavy italic, like a broadcast graphic.", Poster],
  ["8 · 5th tile", "A compact app icon and favicon.", Monogram],
];

export function FifthOfficialConcepts() {
  return (
    <div className="lg-grid">
      {CONCEPTS.map(([title, note, Mark]) => (
        <figure key={title}>
          <div className="lg-pair"><div className="lg-light"><Mark dark={false} /></div><div className="lg-dark"><Mark dark /></div></div>
          <figcaption><b>{title}</b>{note}</figcaption>
        </figure>
      ))}
    </div>
  );
}
