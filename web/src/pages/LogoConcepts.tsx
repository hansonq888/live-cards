// Footnote logo concepts, shown on ?page=mock. Bold, geometric and angular (in the spirit of
// big-league sports branding) but built only from our own ideas: footnote marks (¹ and *),
// a football and the lightning shard we use across the site. No league marks, and no dagger (†),
// which reads as a cross.
const P = "#2a0a4a", V = "#4b2bd6", L = "#d4ff3a";

/** 1 · Superscript: the wordmark with a footnote reference, ¹ in a lime disc. */
function Superscript({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Footnote<tspan className="lg-sup" dx="4" dy="-30" fill={dark ? L : V}>1</tspan></text>
    </svg>
  );
}

/** 2 · Asterisk ball: the footnote asterisk drawn as a football's panel seams. */
function AsteriskBall({ dark }: { dark: boolean }) {
  const arms = [0, 60, 120];
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <circle cx="45" cy="45" r="34" fill={V} />
      <g stroke={L} strokeWidth="9" strokeLinecap="round">{arms.map((a) => <line key={a} x1="45" y1="22" x2="45" y2="68" transform={`rotate(${a} 45 45)`} />)}</g>
      <text x="92" y="60" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 3 · Shard F: a heavy F monogram with a lightning cut through it. */
function ShardF({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="8" width="74" height="74" rx="16" fill={V} />
      <path d="M28 22 H66 V36 H44 V42 H60 V55 H44 V70 H28 Z" fill="#fff" />
      <path d="M58 8 L82 8 L82 30 L66 46 L76 46 L50 82 L56 56 L46 56 Z" fill={L} />
      <text x="96" y="60" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 4 · Roundel: a badge (ball outline + asterisk mark), for app icons and the favicon. */
function Roundel({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <circle cx="45" cy="45" r="38" fill={P} />
      <circle cx="45" cy="45" r="30" fill="none" stroke={L} strokeWidth="4" />
      <g stroke="#fff" strokeWidth="7" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="45" y1="29" x2="45" y2="61" transform={`rotate(${a} 45 45)`} />)}</g>
      <text x="96" y="60" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 5 · Stacked: FOOT / NOTE in heavy italic caps, with a [1] bracket like a citation. */
function Stacked({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="12" y="42" className="lg-stack" fill={dark ? "#fff" : P}>FOOT</text>
      <text x="12" y="80" className="lg-stack" fill={dark ? L : V}>NOTE<tspan className="lg-cite" dx="8" fill={dark ? "#fff" : P}>[1]</tspan></text>
    </svg>
  );
}

/** 6 · Pitch note: the wordmark's second "o" is the centre circle of a pitch. */
function PitchNote({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Fo</text>
      <g transform="translate(90 46)">
        <circle r="17" fill="none" stroke={L} strokeWidth="6" />
        <line x1="0" y1="-26" x2="0" y2="26" stroke={L} strokeWidth="5" strokeLinecap="round" />
        <circle r="3.5" fill={L} />
      </g>
      <text x="112" y="64" className="lg-word" fill={dark ? "#fff" : P}>tnote</text>
    </svg>
  );
}

/** 7 · Shard F¹: the lightning F tile beside the wordmark, with the footnote ¹. */
function ShardSup({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="12" width="66" height="66" rx="14" fill={V} />
      <path d="M26 25 H60 V37 H40 V43 H54 V54 H40 V66 H26 Z" fill="#fff" />
      <path d="M52 12 L74 12 L74 32 L60 46 L69 46 L46 78 L51 55 L42 55 Z" fill={L} />
      <text x="86" y="62" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote<tspan className="lg-sup" dx="3" dy="-24" fill={dark ? L : V}>1</tspan></text>
    </svg>
  );
}

/** 8 · Asterisk shard: the asterisk on the lightning tile; one mark that is both ideas. */
function AsteriskShard({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="12" width="66" height="66" rx="14" fill={V} />
      <path d="M50 12 L74 12 L74 40 L58 52 L66 52 L40 78 L8 78 L8 60 Z" fill={P} opacity=".55" />
      <g stroke={L} strokeWidth="8" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="41" y1="27" x2="41" y2="63" transform={`rotate(${a} 41 45)`} />)}</g>
      <text x="86" y="62" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 9 · Ball o: the first o is a ball with asterisk seams, inside the wordmark itself. */
function BallO({ dark }: { dark: boolean }) {
  const ink = dark ? "#fff" : P;
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={ink}>F</text>
      <g transform="translate(62 46)">
        <circle r="19" fill={L} />
        <g stroke={P} strokeWidth="5" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="0" y1="-11" x2="0" y2="11" transform={`rotate(${a})`} />)}</g>
      </g>
      <text x="84" y="64" className="lg-word" fill={ink}>otnote</text>
    </svg>
  );
}

/** 10 · Italic star: heavy italic wordmark (movement, like a sports title) ending in a lime asterisk. */
function ItalicStar({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="66" className="lg-italic" fill={dark ? "#fff" : P}>FOOTNOTE</text>
      <g transform="translate(268 26)" stroke={L} strokeWidth="6" strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1="0" y1="-12" x2="0" y2="12" transform={`rotate(${a})`} />)}</g>
    </svg>
  );
}

/** 11 · F¹ monogram: a compact app-icon mark: F with the superscript in the corner. */
function Monogram({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="8" width="74" height="74" rx="18" fill={dark ? "#fff" : V} />
      <path d="M26 24 H58 V36 H40 V44 H54 V55 H40 V68 H26 Z" fill={dark ? V : "#fff"} />
      <circle cx="66" cy="26" r="11" fill={L} />
      <text x="66" y="31" textAnchor="middle" className="lg-mini" fill={P}>1</text>
      <text x="96" y="60" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 12 · Split shard: the wordmark cut by a lime lightning slash between "Foot" and "note". */
function SplitShard({ dark }: { dark: boolean }) {
  const ink = dark ? "#fff" : P;
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="8" y="64" className="lg-word" fill={ink}>Foot</text>
      <path d="M140 10 L156 10 L146 40 L156 40 L136 82 L141 52 L131 52 Z" fill={L} />
      <text x="158" y="64" className="lg-word" fill={dark ? L : V}>note</text>
    </svg>
  );
}

// ---- Round 3: mixes of 1, 2, 11 and 12, all in 1's heavy wordmark ----
const ast = (cx: number, cy: number, r: number, color: string, w: number) => (
  <g stroke={color} strokeWidth={w} strokeLinecap="round">{[0, 60, 120].map((a) => <line key={a} x1={cx} y1={cy - r} x2={cx} y2={cy + r} transform={`rotate(${a} ${cx} ${cy})`} />)}</g>
);

/** 13 · Footnote*: 1's wordmark, with 2's asterisk as the footnote mark instead of a 1. */
function WordAsterisk({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Footnote</text>
      {ast(252, 24, 10, dark ? L : V, 6)}
    </svg>
  );
}

/** 14 · Shard ¹: 12's lightning slash, with 1's superscript as the footnote mark. */
function SplitSup({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="8" y="64" className="lg-word" fill={dark ? "#fff" : P}>Foot</text>
      <path d="M140 10 L156 10 L146 40 L156 40 L136 82 L141 52 L131 52 Z" fill={L} />
      <text x="158" y="64" className="lg-word" fill={dark ? L : V}>note<tspan className="lg-sup" dx="3" dy="-30" fill={dark ? "#fff" : P}>1</tspan></text>
    </svg>
  );
}

/** 15 · Asterisk tile + wordmark: 11's rounded tile carrying 2's asterisk, 1's wordmark beside it. */
function TileAsterisk({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="10" width="70" height="70" rx="18" fill={dark ? "#fff" : V} />
      {ast(43, 45, 18, dark ? V : L, 8)}
      <text x="92" y="62" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 16 · F tile with asterisk: 11's F monogram, with 2's asterisk in the corner instead of a 1. */
function MonoAsterisk({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <rect x="8" y="8" width="74" height="74" rx="18" fill={dark ? "#fff" : V} />
      <path d="M24 24 H56 V36 H38 V44 H52 V55 H38 V68 H24 Z" fill={dark ? V : "#fff"} />
      <circle cx="64" cy="27" r="12" fill={L} />
      {ast(64, 27, 6.5, P, 3.2)}
      <text x="96" y="60" className="lg-word sm" fill={dark ? "#fff" : P}>Footnote</text>
    </svg>
  );
}

/** 17 · Two-tone ¹: 1's wordmark split by colour like 12 (Foot / note), no slash. */
function TwoTone({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Foot<tspan fill={dark ? L : V}>note</tspan><tspan className="lg-sup" dx="3" dy="-30" fill={dark ? "#fff" : P}>1</tspan></text>
    </svg>
  );
}

/** 18 · Ball superscript: 1's wordmark whose footnote mark is a tiny football with asterisk seams. */
function BallSup({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Footnote</text>
      <circle cx="254" cy="25" r="13" fill={L} />
      {ast(254, 25, 7, P, 3.4)}
    </svg>
  );
}

/** 19 · Two-tone ball: 17's Foot / note colours with 18's football as the footnote mark. */
function TwoToneBall({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <text x="10" y="64" className="lg-word" fill={dark ? "#fff" : P}>Foot<tspan fill={dark ? L : V}>note</tspan></text>
      <circle cx="254" cy="25" r="13" fill={dark ? "#fff" : L} />
      {ast(254, 25, 7, P, 3.4)}
    </svg>
  );
}

/** Lockup: a large mark on the left, the name stacked in two lines beside it (a classic
 *  sports-brand arrangement). The mark is our own football with footnote-asterisk seams. */
function Lockup({ dark, twoTone }: { dark: boolean; twoTone: boolean }) {
  const ink = dark ? "#fff" : P;
  return (
    <svg viewBox="0 0 300 90" className="lg">
      <circle cx="46" cy="45" r="36" fill={dark ? L : V} />
      {ast(46, 45, 20, dark ? P : L, 9)}
      <text x="96" y="42" className="lg-stack2" fill={ink}>Foot</text>
      <text x="96" y="82" className="lg-stack2" fill={twoTone ? (dark ? L : V) : ink}>note</text>
    </svg>
  );
}
const StackedMono = ({ dark }: { dark: boolean }) => <Lockup dark={dark} twoTone={false} />;
const StackedTwo = ({ dark }: { dark: boolean }) => <Lockup dark={dark} twoTone />;

const CONCEPTS: [string, string, (p: { dark: boolean }) => JSX.Element][] = [
  ["1 · Superscript", "The name as a footnote reference: Footnote¹. Simple, clever, works at any size.", Superscript],
  ["2 · Asterisk ball", "The footnote asterisk drawn as football seams.", AsteriskBall],
  ["3 · Shard F", "A heavy F with our lightning cut, sporty and angular.", ShardF],
  ["4 · Roundel", "A badge with the footnote asterisk, good for app icons and favicons.", Roundel],
  ["5 · Stacked", "FOOT / NOTE in heavy caps with a [1] citation, poster style.", Stacked],
  ["6 · Pitch note", "The second o becomes the centre circle of a pitch.", PitchNote],
  ["7 · Shard F + ¹", "3's lightning F with 1's footnote mark on the name.", ShardSup],
  ["8 · Asterisk shard", "2's asterisk on 3's lightning tile: one mark, both ideas.", AsteriskShard],
  ["9 · Ball o", "The asterisk ball becomes the first o of the name.", BallO],
  ["10 · Italic star", "Heavy italic caps for movement, ending in a lime asterisk.", ItalicStar],
  ["11 · F¹ monogram", "A compact icon: F with the footnote 1 in its corner.", Monogram],
  ["12 · Split shard", "A lightning slash between Foot and note.", SplitShard],
  ["13 · Footnote*", "1's wordmark with 2's asterisk as the footnote mark.", WordAsterisk],
  ["14 · Split shard ¹", "12's lightning slash plus 1's superscript.", SplitSup],
  ["15 · Asterisk tile", "11's rounded tile carrying 2's asterisk, with the wordmark.", TileAsterisk],
  ["16 · F + asterisk", "11's F monogram with 2's asterisk in the corner.", MonoAsterisk],
  ["17 · Two-tone ¹", "1's wordmark, coloured Foot / note like 12, no slash.", TwoTone],
  ["18 · Ball superscript", "1's wordmark whose footnote mark is a tiny football.", BallSup],
  ["19 · Two-tone ball", "17's Foot / note colours with 18's football as the footnote mark.", TwoToneBall],
  ["20 · Lockup, one colour", "A big football mark on the left, Foot / note stacked beside it.", StackedMono],
  ["21 · Lockup, two-tone", "The same lockup with note in the accent colour.", StackedTwo],
];

export function LogoConcepts() {
  return (
    <div className="lg-grid">
      {CONCEPTS.map(([title, note, C]) => (
        <figure key={title}>
          <div className="lg-pair"><div className="lg-light"><C dark={false} /></div><div className="lg-dark"><C dark /></div></div>
          <figcaption><b>{title}</b>{note}</figcaption>
        </figure>
      ))}
    </div>
  );
}
