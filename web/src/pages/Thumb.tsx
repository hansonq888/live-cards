// ?page=thumb: share images and thumbnails at their real pixel sizes (video thumbnail, social
// preview), for screenshotting into files. The logo is W9; the background is the site's
// lightning shards, drawn with curved edges.
const P = "#2a0a4a", L = "#d4ff3a";

function Logo({ size, slash = false, dark = true }: { size: number; slash?: boolean; dark?: boolean }) {
  const ink = dark ? "#fff" : P, acc = dark ? L : "#4b2bd6";
  const w = slash ? 290 : 202;  // the drawn width of the type, so the logo centres properly
  return (
    <svg viewBox={`10 0 ${w} 124`} width={(w / 124) * size} height={size} overflow="visible">
      {slash && <rect x="28" y="4" width="16" height="118" fill={L} transform="skewX(-8)" />}
      <g transform={slash ? "translate(42 0)" : undefined}>
        <text x="16" y="26" className="fo-the3" fill={acc}>THE</text>
        <text x="14" y="68" className="fo-stack" fill={ink}>Fifth</text>
        <text x="14" y="114" className="fo-stack" fill={ink}>Official<tspan fill={dark ? L : "#4b2bd6"}>.</tspan></text>
      </g>
    </svg>
  );
}

/** Curved lightning shards: a dark plum bolt and a lime bolt sweeping across the right side. */
function Bolts({ w, h, light = false }: { w: number; h: number; light?: boolean }) {
  const X = (f: number) => f * w, Y = (f: number) => f * h;
  return (
    <svg className="th-bolts" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path fill={light ? "rgba(75,43,214,.12)" : "rgba(42,10,74,.7)"} d={`
        M ${X(.62)} 0 L ${w} 0 L ${w} ${h} L ${X(.52)} ${h}
        Q ${X(.58)} ${Y(.78)} ${X(.65)} ${Y(.66)} L ${X(.59)} ${Y(.64)}
        Q ${X(.66)} ${Y(.40)} ${X(.71)} ${Y(.30)} L ${X(.65)} ${Y(.28)}
        Q ${X(.64)} ${Y(.12)} ${X(.62)} 0 Z`} />
      <path fill={L} d={`
        M ${X(.86)} 0 L ${w} 0 L ${w} ${h} L ${X(.78)} ${h}
        Q ${X(.82)} ${Y(.80)} ${X(.87)} ${Y(.62)} L ${X(.82)} ${Y(.60)}
        Q ${X(.88)} ${Y(.38)} ${X(.92)} ${Y(.26)} L ${X(.87)} ${Y(.24)}
        Q ${X(.865)} ${Y(.10)} ${X(.86)} 0 Z`} />
      <path fill="none" stroke={light ? "rgba(75,43,214,.25)" : "rgba(255,255,255,.18)"} strokeWidth={Math.max(2, w / 400)} d={`
        M ${X(.76)} 0 Q ${X(.74)} ${Y(.2)} ${X(.79)} ${Y(.34)} L ${X(.73)} ${Y(.36)} Q ${X(.72)} ${Y(.6)} ${X(.69)} ${h}`} />
    </svg>
  );
}

function Frame({ w, h, children, light = false, label }: { w: number; h: number; children: React.ReactNode; light?: boolean; label: string }) {
  return (
    <figure className="th-fig">
      <div className={`th ${light ? "light" : ""}`} style={{ width: w, height: h }} data-thumb={label}>
        <Bolts w={w} h={h} light={light} />
        <div className="th-inner">{children}</div>
      </div>
      <figcaption>{label} · {w} × {h}</figcaption>
    </figure>
  );
}

/** One-line logo for centred layouts. */
function LogoLine({ height, ink, acc }: { height: number; ink: string; acc: string }) {
  return (
    <svg viewBox="0 0 520 70" width={(520 / 70) * height} height={height}>
      <text x="260" y="54" textAnchor="middle" className="th-line" fill={ink}>
        <tspan fill={acc}>The </tspan>Fifth Official<tspan fill={acc === "#fff" ? L : acc}>.</tspan>
      </text>
    </svg>
  );
}

/** Angular notched bands framing the top and bottom: our own shapes, not a copy of any
 *  league pattern. Each band is a slanted bar with one step cut into its edge. */
function Bands({ w, h, fill, layout = "tb" }: { w: number; h: number; fill: string; layout?: string }) {
  const band = (x: number, y: number, len: number, thick: number) => {
    const s = thick * 0.9;  // slant
    return `M ${x} ${y} L ${x + len} ${y} L ${x + len + s} ${y + thick} L ${x + len * 0.55 + s} ${y + thick}
      L ${x + len * 0.55 + s * 0.7} ${y + thick * 0.62} L ${x + len * 0.42 + s * 0.7} ${y + thick * 0.62}
      L ${x + len * 0.42 + s} ${y + thick} L ${x + s} ${y + thick} Z`;
  };
  const t = h * 0.24;
  const sets: Record<string, string[]> = {
    // top and bottom, the original
    tb: [band(-w * 0.05, -t * 0.2, w * 0.34, t), band(w * 0.36, -t * 0.2, w * 0.40, t * 1.25), band(w * 0.80, -t * 0.2, w * 0.30, t * 0.8),
      band(-w * 0.10, h - t * 1.1, w * 0.30, t * 1.3), band(w * 0.26, h - t * 0.9, w * 0.38, t), band(w * 0.70, h - t * 1.2, w * 0.40, t * 1.4)],
    // top and bottom, fewer bands with wide gaps between them
    spread: [band(-w * 0.08, -t * 0.25, w * 0.22, t * 0.9), band(w * 0.40, -t * 0.25, w * 0.24, t * 1.1), band(w * 0.86, -t * 0.25, w * 0.22, t * 0.8),
      band(w * 0.08, h - t * 0.95, w * 0.22, t * 1.1), band(w * 0.58, h - t * 0.85, w * 0.24, t)],
    // a diagonal sweep from the bottom-left to the top-right corner, leaving the middle clear
    corners: [band(-w * 0.14, h - Math.min(t, w * 0.14) * 1.25, w * 0.36, Math.min(t, w * 0.14) * 1.25),
      band(-w * 0.06, h - Math.min(t, w * 0.14) * 2.05, w * 0.18, Math.min(t, w * 0.14) * 0.6),
      band(w * 0.76, -Math.min(t, w * 0.14) * 0.2, w * 0.38, Math.min(t, w * 0.14) * 1.25),
      band(w * 0.88, Math.min(t, w * 0.14) * 1.2, w * 0.20, Math.min(t, w * 0.14) * 0.6)],
    // a stack of bands running down the right edge, logo on the left
    right: [band(w * 0.60, -t * 0.2, w * 0.50, t), band(w * 0.68, t * 1.05, w * 0.42, t * 0.8), band(w * 0.64, t * 2.05, w * 0.46, t * 1.1),
      band(w * 0.72, t * 3.35, w * 0.40, t * 0.7)],
  };
  return (
    <svg className="th-bolts" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <g fill={fill}>{(sets[layout] ?? sets.tb).map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
}

function BandFrame({ w, h, label, variant, stacked = false, layout = "tb" }: { w: number; h: number; label: string; variant: "lime" | "violet"; stacked?: boolean; layout?: string }) {
  const lime = variant === "lime";
  return (
    <figure className="th-fig">
      <div className={`th band-${variant}`} style={{ width: w, height: h }}>
        <Bands w={w} h={h} fill={lime ? P : L} layout={layout} />
        <div className={`th-center ${layout === "right" ? "left" : ""}`}>
          {stacked
            ? <Logo size={Math.round(h * 0.42)} dark={!lime} />
            : <LogoLine height={Math.round(Math.min(h * 0.2, w * 0.11))} ink={lime ? P : "#fff"} acc={lime ? "#4b2bd6" : L} />}
        </div>
      </div>
      <figcaption>{label} · {w} × {h}</figcaption>
    </figure>
  );
}

export function Thumb() {
  return (
    <div className="th-page">
      <BandFrame w={1280} h={720} variant="violet" stacked layout="spread" label="Spread bands, top and bottom" />
      <BandFrame w={1280} h={720} variant="violet" stacked layout="corners" label="Diagonal corners" />
      <BandFrame w={1280} h={720} variant="violet" stacked layout="right" label="Right edge, logo left" />
      <BandFrame w={1080} h={1080} variant="violet" stacked layout="corners" label="Square, diagonal corners" />
      <BandFrame w={1280} h={720} variant="violet" stacked label="Bands, violet, stacked logo" />
      <BandFrame w={1280} h={720} variant="lime" stacked label="Bands, lime, stacked logo" />
      <BandFrame w={1080} h={1080} variant="violet" stacked label="Bands, square, violet, stacked" />
      <BandFrame w={1280} h={720} variant="lime" label="Bands, lime gradient" />
      <BandFrame w={1280} h={720} variant="violet" label="Bands, violet" />
      <BandFrame w={1080} h={1080} variant="lime" label="Bands, square, lime" />
      <Frame w={1280} h={720} label="Video thumbnail">
        <Logo size={460} />
      </Frame>
      <Frame w={1280} h={720} label="Video thumbnail, with tagline">
        <Logo size={380} />
        <p className="th-tag">Every moment explained.<br />Every claim checked.</p>
      </Frame>
      <Frame w={1280} h={720} label="Video thumbnail, offside line">
        <Logo size={420} slash />
      </Frame>
      <Frame w={1200} h={630} label="Social preview">
        <Logo size={340} />
        <p className="th-tag small">Every moment explained. Every claim checked.</p>
      </Frame>
      <Frame w={1280} h={720} light label="Light thumbnail">
        <Logo size={460} dark={false} />
      </Frame>
    </div>
  );
}
