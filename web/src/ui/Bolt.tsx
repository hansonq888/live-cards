// The Live Cards mark: a lightning bolt (live, electric). Our own shape, no third-party marks.
export function Bolt({ size = 18, className = "bolt" }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size * 0.62} height={size} viewBox="0 0 31 50" aria-hidden="true">
      <path d="M19 0 2 28h11L8 50 29 18H17.5L24 0z" fill="currentColor" />
    </svg>
  );
}
