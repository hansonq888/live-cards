// A shirt with the player's number on it, so the number reads as a squad number, not a stat.
export function Shirt({ number, color, size = 46 }: { number: number; color: string; size?: number }) {
  return (
    <svg className="shirt" width={size} height={size} viewBox="0 0 48 48" aria-label={`Shirt number ${number}`}>
      <path d="M16 4l-11 6 4 10 5-2v26h20V18l5 2 4-10-11-6c-1.6 3-4.4 4.6-8 4.6S17.6 7 16 4z" fill={color} />
      <path d="M16 4c1.6 3 4.4 4.6 8 4.6s6.4-1.6 8-4.6" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5" />
      <text x="24" y="33" textAnchor="middle" className="shirt-num">{number}</text>
    </svg>
  );
}
