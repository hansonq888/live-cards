// The brand's background shapes, shared by headers, hero panels and share images:
// CurvedBolts (a plum and a lime lightning bolt with curved edges) and Bands (slanted bars
// with a notch cut into one edge). Purely decorative, so hidden from screen readers.

export function CurvedBolts({ className = "", plum = "rgba(42,10,74,.7)", lime = "#d4ff3a", line = "rgba(255,255,255,.18)" }:
  { className?: string; plum?: string; lime?: string; line?: string }) {
  const w = 1000, h = 400, X = (f: number) => f * w, Y = (f: number) => f * h;
  return (
    <svg className={`bolts ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path fill={plum} d={`M ${X(.62)} 0 L ${w} 0 L ${w} ${h} L ${X(.52)} ${h}
        Q ${X(.58)} ${Y(.78)} ${X(.65)} ${Y(.66)} L ${X(.59)} ${Y(.64)}
        Q ${X(.66)} ${Y(.40)} ${X(.71)} ${Y(.30)} L ${X(.65)} ${Y(.28)} Q ${X(.64)} ${Y(.12)} ${X(.62)} 0 Z`} />
      <path fill={lime} d={`M ${X(.86)} 0 L ${w} 0 L ${w} ${h} L ${X(.78)} ${h}
        Q ${X(.82)} ${Y(.80)} ${X(.87)} ${Y(.62)} L ${X(.82)} ${Y(.60)}
        Q ${X(.88)} ${Y(.38)} ${X(.92)} ${Y(.26)} L ${X(.87)} ${Y(.24)} Q ${X(.865)} ${Y(.10)} ${X(.86)} 0 Z`} />
      <path fill="none" stroke={line} strokeWidth="2" vectorEffect="non-scaling-stroke"
        d={`M ${X(.76)} 0 Q ${X(.74)} ${Y(.2)} ${X(.79)} ${Y(.34)} L ${X(.73)} ${Y(.36)} Q ${X(.72)} ${Y(.6)} ${X(.69)} ${h}`} />
    </svg>
  );
}

function band(x: number, y: number, len: number, thick: number) {
  const s = thick * 0.9;
  return `M ${x} ${y} L ${x + len} ${y} L ${x + len + s} ${y + thick} L ${x + len * 0.55 + s} ${y + thick}
    L ${x + len * 0.55 + s * 0.7} ${y + thick * 0.62} L ${x + len * 0.42 + s * 0.7} ${y + thick * 0.62}
    L ${x + len * 0.42 + s} ${y + thick} L ${x + s} ${y + thick} Z`;
}

/** Notched bands in two corners (bottom-left, top-right), leaving the middle clear. */
export function Bands({ className = "", fill = "#d4ff3a", w = 1200, h = 500, corners = "both" }:
  { className?: string; fill?: string; w?: number; h?: number; corners?: "both" | "right" }) {
  const t = Math.min(h * 0.24, w * 0.12);
  const right = [band(w * 0.78, -t * 0.2, w * 0.36, t * 1.25), band(w * 0.89, t * 1.2, w * 0.19, t * 0.6)];
  const paths = corners === "right"  // top-right and bottom-right only, clear of left-aligned text
    ? [...right, band(w * 0.80, h - t * 0.9, w * 0.34, t)]
    : [band(-w * 0.14, h - t * 1.25, w * 0.34, t * 1.25), band(-w * 0.06, h - t * 2.05, w * 0.17, t * 0.6), ...right];
  return (
    <svg className={`bands ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill={fill}>{paths.map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
}

/** Curved lightning stripes for the right end of the nav bar: each a swept band with one step
 *  notch, of uneven widths, getting thinner toward the left so they taper in instead of
 *  stopping at an edge. */
export function Stripes({ className = "", fill = "#d4ff3a", w = 600, h = 200 }: { className?: string; fill?: string; w?: number; h?: number }) {
  // x of each stripe's top edge, and its thickness (left ones thin, right ones thick)
  // Fewer, thinner bolts with more room between them
  const bands: [number, number][] = [[300, 7], [395, 14], [505, 24], [630, 34], [760, 26]];
  const stripe = (x: number, t: number) => {
    // A swept band: both edges are the same smooth S-curve, offset by the thickness, with a
    // single clean step at mid-height (the "kink" of the bolt).
    // More lean and a stronger bend so the bolts read as moving up and to the right.
    const lean = h * 1.05, ny = h * 0.5, step = t * 0.55;
    const top = (dx: number) => `${x + dx} 0`;
    const midL = x - lean * 0.38, bot = x - lean;  // bowed: steeper at the top, flatter below
    return `M ${top(0)} L ${top(t)}
      C ${x + t - 6} ${ny * 0.5}, ${midL + t + 8} ${ny * 0.8}, ${midL + t} ${ny}
      L ${midL + t + step} ${ny}
      C ${midL + t + step - 8} ${ny + (h - ny) * 0.4}, ${bot + t + step + 6} ${h * 0.86}, ${bot + t + step} ${h}
      L ${bot + step} ${h}
      C ${bot + step + 6} ${h * 0.86}, ${midL + step - 8} ${ny + (h - ny) * 0.4}, ${midL + step} ${ny}
      L ${midL} ${ny}
      C ${midL + 8} ${ny * 0.8}, ${x - 6} ${ny * 0.5}, ${x} 0 Z`;
  };
  return (
    <svg className={`stripes ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
      <g fill={fill}>{bands.map(([x, t], i) => <path key={i} d={stripe(x, t)} />)}</g>
    </svg>
  );
}
