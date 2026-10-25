// The product name, in one place: change BRAND to rename the whole interface.
export const BRAND = "Footnote";

export function Wordmark({ suffix }: { suffix?: string }) {
  return <span className="wordmark">{BRAND}{suffix && <em>{suffix}</em>}</span>;
}
