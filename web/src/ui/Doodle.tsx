// Faint tactics-board sketches (pitch lines, Xs and Os, run and pass arrows) drawn in code, for
// page backgrounds. Purely decorative, so hidden from screen readers.
const X = ({ x, y }: { x: number; y: number }) => <path d={`M${x - 9} ${y - 9} L${x + 9} ${y + 9} M${x + 9} ${y - 9} L${x - 9} ${y + 9}`} />;
const O = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="10" />;

function Arrow({ d, dashed = false, head }: { d: string; dashed?: boolean; head: [number, number, number] }) {
  const [x, y, a] = head;  // tip and direction in degrees
  return (
    <g>
      <path d={d} strokeDasharray={dashed ? "10 9" : undefined} />
      <path d="M-12 -7 L0 0 L-12 7" transform={`translate(${x} ${y}) rotate(${a})`} />
    </g>
  );
}

export function Doodle({ className = "" }: { className?: string }) {
  return (
    <svg className={`doodle ${className}`} viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="40" y="40" width="1120" height="680" rx="6" />
        <line x1="600" y1="40" x2="600" y2="720" />
        <circle cx="600" cy="380" r="92" /><circle cx="600" cy="380" r="4" fill="currentColor" />
        <rect x="40" y="200" width="170" height="360" /><rect x="40" y="295" width="62" height="170" />
        <path d="M210 318 A 90 90 0 0 1 210 442" />
        <rect x="990" y="200" width="170" height="360" /><rect x="1098" y="295" width="62" height="170" />
        <path d="M990 318 A 90 90 0 0 0 990 442" />
        <X x={150} y={380} /><X x={330} y={190} /><X x={420} y={250} /><X x={430} y={530} /><X x={700} y={160} />
        <X x={820} y={250} /><X x={760} y={420} /><X x={700} y={560} />
        <O x={480} y={120} /><O x={380} y={350} /><O x={660} y={380} /><O x={770} y={300} /><O x={890} y={110} />
        <O x={1050} y={380} /><O x={380} y={640} /><O x={880} y={640} />
        <Arrow d="M165 385 C 260 400 330 450 410 515" head={[410, 515, 40]} />
        <Arrow d="M440 545 C 520 575 600 585 680 565" head={[680, 565, -10]} />
        <Arrow d="M430 520 C 455 440 450 330 425 270" dashed head={[425, 270, -100]} />
        <Arrow d="M435 240 C 500 170 590 150 680 160" dashed head={[680, 160, 5]} />
        <Arrow d="M700 545 C 720 500 735 470 755 440" head={[755, 440, -55]} />
        <Arrow d="M715 555 C 800 520 860 420 860 270" dashed head={[860, 270, -90]} />
        <Arrow d="M720 565 C 820 590 920 560 1000 470" head={[1000, 470, -48]} />
      </g>
    </svg>
  );
}
