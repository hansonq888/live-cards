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

const CONCEPTS: [string, string, (p: { dark: boolean }) => JSX.Element][] = [
  ["1 · Superscript", "The name as a footnote reference: Footnote¹. Simple, clever, works at any size.", Superscript],
  ["2 · Asterisk ball", "The footnote asterisk drawn as football seams.", AsteriskBall],
  ["3 · Shard F", "A heavy F with our lightning cut, sporty and angular.", ShardF],
  ["4 · Roundel", "A badge with the footnote asterisk, good for app icons and favicons.", Roundel],
  ["5 · Stacked", "FOOT / NOTE in heavy caps with a [1] citation, poster style.", Stacked],
  ["6 · Pitch note", "The second o becomes the centre circle of a pitch.", PitchNote],
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
