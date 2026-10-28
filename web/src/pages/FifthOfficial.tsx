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

// ---- Stacked lockups: a large mark on the left, "Fifth" over "Official" beside it ----
// (the classic sports-brand arrangement; the marks and type are our own).
const ICONS: Record<string, (dark: boolean) => JSX.Element> = {
  card: (dark) => (
    <g>
      <rect x="20" y="10" width="52" height="78" rx="7" fill={L} />
      <path d="M31 50 l10 11 l21 -24" fill="none" stroke={P} strokeWidth="7" strokeLinecap="butt" strokeLinejoin="miter" strokeMiterlimit="10" />
      {dark ? null : <rect x="20" y="10" width="52" height="78" rx="7" fill="none" stroke={P} strokeWidth="2" opacity=".15" />}
    </g>
  ),
  asterisk: (dark) => (
    <g>
      <circle cx="46" cy="50" r="40" fill={dark ? L : V} />
      <g stroke={dark ? P : L} strokeWidth="10" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="46" y1="28" x2="46" y2="72" transform={`rotate(${a} 46 50)`} />)}</g>
    </g>
  ),
  whistle: (dark) => (
    <g>
      <path d="M4 44 h34 a25 25 0 1 1 -3 28 h-31 z" fill={dark ? L : V} />
      <circle cx="55" cy="58" r="7.5" fill={dark ? P : "#fff"} />
      <path d="M70 28 l8 -8 M75 37 l11 -4 M62 22 l2 -11" stroke={dark ? "#fff" : L} strokeWidth="5" strokeLinecap="round" />
    </g>
  ),
  badge: (dark) => (
    <g>
      <path d="M46 6 l40 13 v32 c0 24 -18 40 -40 48 c-22 -8 -40 -24 -40 -48 v-32 z" fill={dark ? L : V} />
      <text x="46" y="70" textAnchor="middle" className="fo-num huge" fill={dark ? P : L}>5</text>
    </g>
  ),
  card5: (dark) => (
    <g>
      <rect x="20" y="10" width="52" height="78" rx="7" fill={L} />
      <text x="46" y="68" textAnchor="middle" className="fo-num huge" fill={P}>5</text>
    </g>
  ),
  cards: (dark) => (
    <g>
      <rect x="10" y="16" width="48" height="72" rx="7" fill={dark ? "#fff" : V} transform="rotate(-12 34 52)" />
      <rect x="34" y="10" width="48" height="72" rx="7" fill={L} transform="rotate(8 58 46)" />
      <path d="M45 46 l9 10 l18 -21" fill="none" stroke={P} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" transform="rotate(8 58 46)" />
    </g>
  ),
  board: (dark) => (
    <g>
      <rect x="6" y="22" width="84" height="54" rx="8" fill={dark ? "#160f35" : P} stroke={dark ? L : "none"} strokeWidth="3" />
      <rect x="40" y="76" width="16" height="16" rx="3" fill={dark ? "#fff" : P} />
      <text x="48" y="64" textAnchor="middle" className="fo-board" fill={L}>+5</text>
    </g>
  ),
  screen: (dark) => (
    <g>
      <rect x="6" y="16" width="84" height="58" rx="8" fill={dark ? L : V} />
      <rect x="38" y="74" width="20" height="10" fill={dark ? L : V} />
      <rect x="26" y="84" width="44" height="6" rx="3" fill={dark ? L : V} />
      <path d="M30 45 l12 12 l24 -27" fill="none" stroke={dark ? P : L} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  bubble: (dark) => (
    <g>
      <path d="M10 14 h76 a6 6 0 0 1 6 6 v46 a6 6 0 0 1 -6 6 h-44 l-18 16 v-16 h-14 a6 6 0 0 1 -6 -6 v-46 a6 6 0 0 1 6 -6 z" fill={dark ? L : V} />
      <path d="M30 42 l11 11 l22 -24" fill="none" stroke={dark ? P : L} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  ballcheck: (dark) => (
    <g>
      <circle cx="46" cy="50" r="40" fill={dark ? "#fff" : V} />
      <circle cx="46" cy="50" r="40" fill="none" stroke={dark ? L : V} strokeWidth="4" />
      <path d="M26 50 l14 14 l27 -30" fill="none" stroke={dark ? P : L} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  shieldcheck: (dark) => (
    <g>
      <path d="M46 6 l40 13 v32 c0 24 -18 40 -40 48 c-22 -8 -40 -24 -40 -48 v-32 z" fill={dark ? L : V} />
      <path d="M28 52 l12 12 l24 -27" fill="none" stroke={dark ? P : L} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  flag: (dark) => (
    <g>
      <line x1="16" y1="8" x2="16" y2="94" stroke={dark ? "#fff" : P} strokeWidth="7" strokeLinecap="round" />
      <path d="M19 11 h64 l-14 22 l14 22 h-64 z" fill={dark ? L : V} />
      <path d="M19 11 h32 v44 h-32 z" fill={dark ? "#fff" : L} />
    </g>
  ),
};

// Each icon's drawn bounds, so every mark is scaled into the same box and centred on the text.
const BOUNDS: Record<string, string> = {
  card: "18 8 56 82", card5: "18 8 56 82", cards: "2 2 88 92", asterisk: "4 8 84 84", whistle: "2 0 92 82",
  badge: "4 4 84 97", shieldcheck: "4 4 84 97", flag: "10 4 78 94", board: "3 19 90 75", screen: "4 14 88 78",
  bubble: "2 12 92 78", ballcheck: "4 8 84 84",
};

/** The icon fitted into a fixed box: same height for every mark, centred. */
function Mark({ icon, dark, x, y, w, h }: { icon: string; dark: boolean; x: number; y: number; w: number; h: number }) {
  return (
    <svg x={x} y={y} width={w} height={h} viewBox={BOUNDS[icon] ?? "0 0 96 96"} preserveAspectRatio="xMidYMid meet" overflow="visible">
      {ICONS[icon](dark)}
    </svg>
  );
}

function Lockup({ dark, icon }: C & { icon: string }) {
  return (
    <svg viewBox="0 0 340 100" className="lg">
      <Mark icon={icon} dark={dark} x={6} y={10} w={86} h={84} />
      <text x="112" y="46" className="fo-stack" fill={ink(dark)}>Fifth</text>
      <text x="112" y="92" className="fo-stack" fill={ink(dark)}>Official</text>
    </svg>
  );
}

/** Three lines: a small "THE" over Fifth / Official, the mark scaled to the full height. */
function Lockup3({ dark, icon }: C & { icon: string }) {
  return (
    <svg viewBox="0 0 340 124" className="lg">
      <Mark icon={icon} dark={dark} x={6} y={12} w={90} h={100} />
      <text x="116" y="26" className="fo-the3" fill={dark ? L : V}>THE</text>
      <text x="114" y="68" className="fo-stack" fill={ink(dark)}>Fifth</text>
      <text x="114" y="114" className="fo-stack" fill={ink(dark)}>Official</text>
    </svg>
  );
}

/** One line: the mark, then "THE" small and "Fifth Official" in the heavy wordmark. */
function LockupLine({ dark, icon, the = true }: C & { icon: string; the?: boolean }) {
  return (
    <svg viewBox="0 0 400 80" className="lg">
      <Mark icon={icon} dark={dark} x={6} y={10} w={60} h={60} />
      <text x="78" y="53" className="fo-line" fill={ink(dark)}>
        {the && <tspan fill={dark ? L : V}>The </tspan>}
        <tspan>Fifth Official</tspan>
      </text>
    </svg>
  );
}

/** Stacked variants of the checked-card lockup. */
function StackVariant({ dark, v }: C & { v: number }) {
  const acc = dark ? L : V;
  if (v === 0) return (  // The / Fifth / Official, all the same size
    <svg viewBox="0 0 340 150" className="lg">
      <Mark icon="card" dark={dark} x={10} y={14} w={84} h={122} />
      <text x="112" y="46" className="fo-stack" fill={acc}>The</text>
      <text x="112" y="92" className="fo-stack" fill={ink(dark)}>Fifth</text>
      <text x="112" y="138" className="fo-stack" fill={ink(dark)}>Official</text>
    </svg>
  );
  if (v === 1) return (  // The Fifth / Official
    <svg viewBox="0 0 340 104" className="lg">
      <Mark icon="card" dark={dark} x={10} y={10} w={70} h={86} />
      <text x="100" y="48" className="fo-stack" fill={ink(dark)}><tspan fill={acc}>The </tspan>Fifth</text>
      <text x="100" y="94" className="fo-stack" fill={ink(dark)}>Official</text>
    </svg>
  );
  return <Lockup3 dark={dark} icon="card" />;  // small THE / Fifth / Official
}

export function FifthStackVariants() {
  const names = ["The / Fifth / Official, all the same size", "The Fifth / Official", "Small THE / Fifth / Official"];
  return (
    <div className="lg-grid">
      {names.map((n, i) => (
        <figure key={i}>
          <div className="lg-pair"><div className="lg-light"><StackVariant dark={false} v={i} /></div><div className="lg-dark"><StackVariant dark v={i} /></div></div>
          <figcaption><b>{String.fromCharCode(83 + i)} · {n}</b>Checked card.</figcaption>
        </figure>
      ))}
    </div>
  );
}

const LINE: [string, string, boolean][] = [
  ["card", "A · Checked card", true], ["card", "A · Checked card, no THE", false],
  ["card5", "F · Card with 5", true], ["board", "H · +5 board", true],
  ["shieldcheck", "K · Shield check", true], ["asterisk", "B · Asterisk", true],
];

export function FifthLineConcepts() {
  return (
    <div className="lg-grid">
      {LINE.map(([icon, title, the], i) => (
        <figure key={i}>
          <div className="lg-pair"><div className="lg-light"><LockupLine dark={false} icon={icon} the={the} /></div><div className="lg-dark"><LockupLine dark icon={icon} the={the} /></div></div>
          <figcaption><b>{title}</b>One line.</figcaption>
        </figure>
      ))}
    </div>
  );
}

const MORE: [string, string, string][] = [
  ["card5", "F · Card with 5", "The lime card carries the 5 instead of a tick."],
  ["cards", "G · Two cards", "A violet card and the lime checked card, fanned."],
  ["board", "H · Added-time board", "The fourth official's board, showing +5."],
  ["screen", "I · Review screen", "A monitor with a tick: reviewed and confirmed."],
  ["bubble", "J · Checked speech", "A speech bubble with a tick: explained and checked."],
  ["shieldcheck", "K · Shield check", "The badge shape with a tick instead of a 5."],
  ["ballcheck", "L · Ball check", "A round mark with a tick."],
];

export function FifthMoreConcepts() {
  return (
    <div className="lg-grid">
      {MORE.map(([icon, title, note]) => (
        <figure key={icon}>
          <div className="lg-pair"><div className="lg-light"><Lockup3 dark={false} icon={icon} /></div><div className="lg-dark"><Lockup3 dark icon={icon} /></div></div>
          <figcaption><b>{title}</b>{note}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function FifthThreeConcepts() {
  return (
    <div className="lg-grid">
      {STACKED.map(([icon, title]) => (
        <figure key={icon}>
          <div className="lg-pair"><div className="lg-light"><Lockup3 dark={false} icon={icon} /></div><div className="lg-dark"><Lockup3 dark icon={icon} /></div></div>
          <figcaption><b>{title} · three lines</b>The / Fifth / Official.</figcaption>
        </figure>
      ))}
    </div>
  );
}

const STACKED: [string, string][] = [
  ["card", "A · Checked card"], ["asterisk", "B · Asterisk"], ["whistle", "C · Whistle"],
  ["badge", "D · Badge with 5"], ["flag", "E · Flag"],
];

export function FifthStackedConcepts() {
  return (
    <div className="lg-grid">
      {STACKED.map(([icon, title]) => (
        <figure key={icon}>
          <div className="lg-pair"><div className="lg-light"><Lockup dark={false} icon={icon} /></div><div className="lg-dark"><Lockup dark icon={icon} /></div></div>
          <figcaption><b>{title}</b>Big mark left, Fifth over Official.</figcaption>
        </figure>
      ))}
    </div>
  );
}

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
