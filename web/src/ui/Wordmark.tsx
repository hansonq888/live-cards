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
