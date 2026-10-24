// Our own flame mark for top form ("On fire"): two layered tongues in a warm gradient.
export function Flame({ size = 18 }: { size?: number }) {
  return (
    <svg className="flame" width={size * 0.8} height={size} viewBox="0 0 24 30" aria-hidden="true">
      <defs>
        <linearGradient id="flame-g" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ff4d1a" />
          <stop offset=".55" stopColor="#ff8a1a" />
          <stop offset="1" stopColor="#ffd23f" />
        </linearGradient>
      </defs>
      <path fill="url(#flame-g)" d="M12 1c1.6 4.4-1.2 6.6.6 9.4C14 12.6 16 9.6 15.4 7 19.6 10 22 14.4 22 18.6 22 24.9 17.5 29 12 29S2 24.9 2 18.6c0-3.6 1.8-6.4 4-8.2-.2 2.6.9 4.4 2.4 4.9C7.6 10.4 9.6 5.2 12 1z" />
      <path fill="#fff3c4" opacity=".85" d="M12 14.5c1 2.4-.6 3.6.5 5.2.8 1.1 2-.4 1.8-1.8 1.7 1.4 2.7 3.4 2.7 5.1 0 2.9-2.2 4.9-5 4.9s-5-2-5-4.9c0-2.2 1.3-4 3-5.1-.1 1.4.6 2.3 1.4 2.4-.4-2.3.6-4.6.6-5.8z" />
    </svg>
  );
}
