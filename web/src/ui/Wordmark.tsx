// The product name, in one place: change BRAND to rename the whole interface.
export const BRAND = "The Fifth Official";

/** The logo (W9): THE over Fifth / Official, with a lime full stop. The big words take the
 *  current text colour, so it works on any header. */
export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <span className="wordmark" aria-label={BRAND}>
      <svg className="wm-stack" viewBox="10 0 204 124" aria-hidden="true">
        <text x="16" y="26" className="fo-the3" fill="#d4ff3a">THE</text>
        <text x="14" y="68" className="fo-stack" fill="currentColor">Fifth</text>
        <text x="14" y="114" className="fo-stack" fill="currentColor">Official<tspan fill="#d4ff3a">.</tspan></text>
      </svg>
      {suffix && <em>{suffix}</em>}
    </span>
  );
}

/** The mini logo: "5." on a violet tile. */
export function MiniMark({ size = 40 }: { size?: number }) {
  return (
    <svg className="mini-mark" width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect width="120" height="120" rx="26" fill="#4b2bd6" />
      <text x="54" y="92" textAnchor="middle" className="mini-5" fill="#fff">5</text>
      <rect x="82" y="76" width="16" height="16" fill="#d4ff3a" />
    </svg>
  );
}

/** For bars: the 5. tile, then the name on one line. */
export function BrandBar() {
  return (
    <span className="brand-bar" aria-label={BRAND}>
      <MiniMark />
      <span aria-hidden="true"><b className="bb-the">The</b> Fifth Official<i>.</i></span>
    </span>
  );
}
