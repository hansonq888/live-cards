// The product name, in one place: change BRAND to rename the whole interface.
export const BRAND = "Footnote";

/** The logo (concept 22): a round mark with the footnote asterisk drawn like football seams,
 *  then the name in one colour on one line. */
export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <span className="wordmark" aria-label={BRAND}>
      <svg className="wm-mark" viewBox="-30 -30 60 60" aria-hidden="true">
        <circle r="30" />
        <g>{[0, 60, 120].map((a) => <line key={a} x1="0" y1="-16" x2="0" y2="16" transform={`rotate(${a})`} />)}</g>
      </svg>
      <span aria-hidden="true">{BRAND}</span>
      {suffix && <em>{suffix}</em>}
    </span>
  );
}
