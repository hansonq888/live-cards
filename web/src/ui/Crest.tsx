import { useId } from "react";
import { club } from "../clubs";
// Original, flat SVG crests for the two fictional clubs. Below 36px the lettering is dropped and
// the emblem is enlarged, so a crest still reads as a lighthouse or a gate at 20px.

const FONT = "'Hanken Grotesk', 'Inter Tight', system-ui, sans-serif";

/** `size` is the crest's height in px. */
export function Crest({ code, size = 32, className }: { code: string; size?: number; className?: string }) {
  const c = club(code);
  const small = size < 36;
  const cls = `crest${className ? " " + className : ""}`;
  if (code === "RIV" && c) return <Lighthouse size={size} small={small} className={cls} founded={c.founded} color={c.color} ink={c.ink} />;
  if (code === "NGT" && c) return <Gate size={size} small={small} className={cls} founded={c.founded} color={c.color} ink={c.ink} />;
  return (
    <svg className={cls} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={code}>
      <circle cx="50" cy="50" r="46" fill="#6c668a" />
      <text x="50" y="62" textAnchor="middle" fontFamily={FONT} fontWeight="800" fontSize="32" fill="#fff">{code}</text>
    </svg>
  );
}

interface Look { size: number; small: boolean; className: string; founded: number; color: string; ink: string }

const SHIELD_OUT = "M50 3 L96 13 V58 C96 89 74 107 50 117 C26 107 4 89 4 58 V13 Z";
const SHIELD_IN = "M50 9 L90 17.5 V58 C90 85 70 101 50 110 C30 101 10 85 10 58 V17.5 Z";

/** Riverside FC: a red heater shield, a white lighthouse over two waves, "RIVERSIDE" and the year. */
function Lighthouse({ size, small, className, founded, color, ink }: Look) {
  const clip = `rv${useId().replace(/:/g, "")}`;
  const yr = String(founded);
  const wave = (y: number) => `M4 ${y} q6 -4.5 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0 t12 0`;
  return (
    <svg className={className} width={(size * 100) / 120} height={size} viewBox="0 0 100 120" role="img" aria-label="Riverside FC crest">
      <defs><clipPath id={clip}><path d={SHIELD_IN} /></clipPath></defs>
      <path d={SHIELD_OUT} fill={ink} />
      <path d={SHIELD_IN} fill={color} stroke="#fff" strokeWidth="3" />
      <g clipPath={`url(#${clip})`}>
        <g transform={small ? "translate(50 66) scale(1.3) translate(-50 -64)" : undefined}>
          <polygon points="46,40.5 22,33 22,48" fill="#fff" opacity=".45" />
          <polygon points="54,40.5 78,33 78,48" fill="#fff" opacity=".45" />
          <polygon points="43,88 57,88 54.5,48 45.5,48" fill="#fff" />
          <polygon points="44.6,62 55.4,62 55.75,68 44.25,68" fill={color} />
          <polygon points="43.75,76 56.25,76 56.6,82 43.4,82" fill={color} />
          <rect x="42.5" y="45" width="15" height="3.4" rx=".8" fill="#fff" />
          <rect x="46" y="37" width="8" height="8" fill="#ffd45a" stroke="#fff" strokeWidth="1.6" />
          <polygon points="44.5,37.5 55.5,37.5 50,30.5" fill="#fff" />
        </g>
        <path d={wave(small ? 96 : 93)} fill="none" stroke="#fff" strokeWidth={small ? 5 : 3.4} strokeLinecap="round" />
        {!small && <path d={wave(101)} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />}
      </g>
      {!small && (
        <g fontFamily={FONT} fontWeight="800" fill="#fff" textAnchor="middle">
          <text x="50" y="29" fontSize="10.5" letterSpacing="1.2">RIVERSIDE</text>
          <text x="25" y="76" fontSize="12">{yr.slice(0, 2)}</text>
          <text x="75" y="76" fontSize="12">{yr.slice(2)}</text>
        </g>
      )}
    </svg>
  );
}

/** Northgate Athletic: a blue roundel with a navy ring for the name and year, and the town's
 *  twin-towered north gate in white. */
function Gate({ size, small, className, founded, color, ink }: Look) {
  const uid = useId().replace(/:/g, "");
  const top = `ng-t${uid}`, bot = `ng-b${uid}`;
  const inner = small ? 44 : 33;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Northgate Athletic crest">
      <circle cx="50" cy="50" r="48" fill={ink} />
      <circle cx="50" cy="50" r={inner} fill={color} stroke="#fff" strokeWidth={small ? 3 : 2.2} />
      <g fill="#fff" transform={small ? "translate(50 52) scale(1.35) translate(-50 -54)" : undefined}>
        <rect x="30" y="38" width="10" height="32" />
        <rect x="60" y="38" width="10" height="32" />
        {[30, 33.7, 37.4, 60, 63.7, 67.4].map((x) => <rect key={x} x={x} y="34.5" width="2.6" height="4" />)}
        <rect x="40" y="46" width="20" height="24" />
        {[41, 45, 49, 53, 57].map((x) => <rect key={x} x={x} y="43" width="2.4" height="3.5" />)}
        <rect x="27" y="69" width="46" height="3" rx="1" />
        <path d="M44 70 V58 A6 6 0 0 1 56 58 V70 Z" fill={ink} />
        <rect x="33.8" y="46" width="2.4" height="5" rx="1.2" fill={ink} />
        <rect x="63.8" y="46" width="2.4" height="5" rx="1.2" fill={ink} />
      </g>
      {!small && (
        <>
          <defs>
            <path id={top} d="M14 50 A36 36 0 0 1 86 50" />
            <path id={bot} d="M12 50 A38 38 0 0 0 88 50" />
          </defs>
          <g fontFamily={FONT} fontWeight="800" fill="#fff" textAnchor="middle">
            <text fontSize="12.5" letterSpacing="2.4"><textPath href={`#${top}`} startOffset="50%">NORTHGATE</textPath></text>
            <text fontSize="11" letterSpacing="1.6"><textPath href={`#${bot}`} startOffset="50%" dominantBaseline="hanging">{founded}</textPath></text>
          </g>
          <circle cx="14.5" cy="57" r="2" fill="#fff" />
          <circle cx="85.5" cy="57" r="2" fill="#fff" />
        </>
      )}
    </svg>
  );
}
