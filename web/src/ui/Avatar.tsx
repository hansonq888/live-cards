import { useId } from "react";
// An illustrated head-and-shoulders portrait for a fictional player, drawn in code. Everything
// (face shape, skin tone, hair, facial hair) comes from a seeded hash of the player id, so the
// same player always looks the same everywhere, and no portrait is based on a real person.

export interface AvatarPlayer { id: string; number: number; name?: string; role?: string }

const SKIN = ["#f7dcc8", "#efc6a6", "#e3ad87", "#cf9567", "#b57a4c", "#96613a", "#77492a", "#5a341d", "#43261a"];
const HAIR_LIGHT = ["#1f1915", "#3b2719", "#5e3d25", "#8a4b26", "#b98a4e", "#d2b27a"];
const HAIR_DARK = ["#141110", "#1f1915", "#2c1f17", "#3b2719"];
const HAIRS = ["bald", "buzz", "short", "short", "curly", "afro", "long", "swept"] as const;
const FACIAL = ["none", "none", "none", "stubble", "stubble", "beard", "moustache"] as const;
const GK_KIT = "#f2c230";

// FNV-1a, then mulberry32: a small, stable generator seeded by the id.
function seeded(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export function face(id: string) {
  const r = seeded(id);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const skinIdx = Math.floor(r() * SKIN.length);
  const hairStyle = pick(HAIRS);
  return {
    skin: SKIN[skinIdx],
    hair: pick(skinIdx >= 5 ? HAIR_DARK : HAIR_LIGHT),
    hairStyle: skinIdx < 4 && hairStyle === "afro" ? "curly" : hairStyle,
    facial: pick(FACIAL),
    shape: pick(["oval", "round", "square"] as const),
    rx: 10.6 + r() * 1.4,
    ry: 12.8 + r() * 1.4,
    hairline: 5 + r() * 3,
  };
}

/** `bare`: no background circle, just the head and shoulders on transparency (for cut-outs). */
export function Avatar({ player, color, size = 40, number = true, bare = false }: { player: AvatarPlayer; color: string; size?: number; number?: boolean; bare?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const f = face(player.id);
  const kit = player.role === "GK" ? GK_KIT : color;
  const ink = player.role === "GK" ? "#1b1630" : "#fff";
  const cx = 32, cy = 29, { rx, ry } = f;
  const top = cy - ry, hy = cy - f.hairline;
  const skinShade = shade(f.skin, 0.82);
  const brow = f.hairStyle === "bald" && f.facial === "none" ? shade(f.skin, 0.45) : f.hair;
  const curls = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI * (1.05 + (0.9 * i) / 8);
    return [cx + Math.cos(a) * (rx + 0.6), cy - 3 + Math.sin(a) * (ry - 1.5)];
  });
  return (
    <svg className={`avatar ${bare ? "bare" : ""}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={player.name ? `Illustration of ${player.name}` : undefined}>
      <defs>
        <clipPath id={`${uid}c`}>{bare ? <rect x="0" y="0" width="64" height="64" /> : <circle cx="32" cy="32" r="32" />}</clipPath>
        <clipPath id={`${uid}h`}><ellipse cx={cx} cy={cy} rx={rx + 0.7} ry={ry + 0.7} /></clipPath>
      </defs>
      <g clipPath={`url(#${uid}c)`}>
        {!bare && <circle cx="32" cy="32" r="32" fill={color} fillOpacity=".14" />}
        {f.hairStyle === "long" && <rect x={cx - rx - 3} y={top - 2} width={2 * rx + 6} height={2 * ry + 8} rx="10" fill={f.hair} />}
        {f.hairStyle === "afro" && <ellipse cx={cx} cy={cy - 5} rx={rx + 6.5} ry={ry + 3} fill={f.hair} />}
        <rect x={cx - 5} y={cy + ry - 6} width="10" height="14" fill={skinShade} />
        {/* Bare: square shoulders cut straight across the bottom, so the bust sits on any edge. */}
        <path d={bare ? "M4 64 V57 C6 52 14 49.5 25 48.5 Q32 53 39 48.5 C50 49.5 58 52 60 57 V64 Z" : "M2 66 C4 54 14 49.5 25 48.5 Q32 53 39 48.5 C50 49.5 60 54 62 66 Z"} fill={kit} />
        <path d="M25 48.5 Q32 54.5 39 48.5" fill="none" stroke={ink} strokeOpacity=".55" strokeWidth="1.6" />
        {number && <text x="32" y="62.5" textAnchor="middle" className="avatar-num" fill={ink}>{player.number}</text>}
        <circle cx={cx - rx + 0.3} cy={cy + 1.5} r="2.6" fill={skinShade} />
        <circle cx={cx + rx - 0.3} cy={cy + 1.5} r="2.6" fill={skinShade} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f.skin} />
        {f.shape === "square" && <rect x={cx - rx + 1.2} y={cy} width={2 * rx - 2.4} height={ry - 0.6} rx="5.5" fill={f.skin} />}
        {f.shape === "round" && <ellipse cx={cx} cy={cy + 3} rx={rx + 0.4} ry={ry - 3} fill={f.skin} />}
        <g clipPath={`url(#${uid}h)`}>
          {f.hairStyle !== "bald" && (
            <path d={`M0 0 H64 V${hy} Q${cx} ${hy - 4} 0 ${hy} Z`} fill={f.hair} fillOpacity={f.hairStyle === "buzz" ? 0.8 : 1} />
          )}
          {f.facial === "stubble" && <path d={`M0 ${cy + 2} Q${cx} ${cy + 6} 64 ${cy + 2} V64 H0 Z`} fill={f.hair} fillOpacity=".2" />}
          {f.facial === "beard" && <path d={`M0 ${cy + 1} Q${cx} ${cy + 5} 64 ${cy + 1} V64 H0 Z`} fill={f.hair} />}
        </g>
        {(f.hairStyle === "short" || f.hairStyle === "long") && <ellipse cx={cx} cy={top + 2.5} rx={rx - 0.5} ry="4.5" fill={f.hair} />}
        {f.hairStyle === "swept" && <path d={`M${cx - rx} ${hy + 1} Q${cx - rx + 1} ${top - 4} ${cx + 3} ${top - 2} Q${cx + rx + 2} ${top} ${cx + rx} ${hy + 3} Q${cx + 2} ${hy - 6} ${cx - rx} ${hy + 1} Z`} fill={f.hair} />}
        {f.hairStyle === "curly" && curls.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill={f.hair} />)}
        <path d={`M${cx - 6} ${cy - 2.6} h3.4 M${cx + 2.6} ${cy - 2.6} h3.4`} stroke={brow} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx={cx - 4.3} cy={cy + 0.8} r="1.25" fill="#231a15" />
        <circle cx={cx + 4.3} cy={cy + 0.8} r="1.25" fill="#231a15" />
        <path d={`M${cx} ${cy + 2} q-1.3 3.3 0.8 3.8`} fill="none" stroke={shade(f.skin, 0.7)} strokeWidth="1" strokeLinecap="round" />
        {f.facial === "moustache" && <path d={`M${cx - 4} ${cy + 7.6} Q${cx} ${cy + 5.2} ${cx + 4} ${cy + 7.6} Q${cx} ${cy + 6.8} ${cx - 4} ${cy + 7.6} Z`} fill={f.hair} stroke={f.hair} strokeWidth="1" strokeLinejoin="round" />}
        <path d={`M${cx - 2.6} ${cy + 8.6} q2.6 1.6 5.2 0`} fill="none" stroke={f.facial === "beard" ? shade(f.skin, 1.05) : shade(f.skin, 0.55)} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </svg>
  );
}
