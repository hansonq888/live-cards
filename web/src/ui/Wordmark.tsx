// The product name, in one place: change BRAND to rename the whole interface.
export const BRAND = "Footnote";

/** Foot / note in two tones, with a little football (asterisk seams) as the footnote mark. */
export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <span className="wordmark" aria-label={BRAND}>
      <span aria-hidden="true">Foot<span className="wm-note">note</span></span>
      <svg className="wm-ball" viewBox="-14 -14 28 28" aria-hidden="true">
        <circle r="13" />
        <g>{[0, 60, 120].map((a) => <line key={a} x1="0" y1="-7" x2="0" y2="7" transform={`rotate(${a})`} />)}</g>
      </svg>
      {suffix && <em>{suffix}</em>}
    </span>
  );
}
