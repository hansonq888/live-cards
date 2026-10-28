// ?page=mock: design experiments to pick from (live card layouts, headshot looks). Not linked.
import { useSummary, type PlayerSummary } from "./summary";
import { Avatar, type AvatarLook } from "../ui/Avatar";
import { Doodle, type DoodleLook } from "../ui/Doodle";
import { LogoConcepts } from "./LogoConcepts";
import { FifthAssets, FifthLineConcepts, FifthNewIcons, FifthStackVariants, FifthWordmarks, FifthMoreConcepts, FifthOfficialConcepts, FifthStackedConcepts, FifthThreeConcepts } from "./FifthOfficial";

const WORDS = ["Struggling", "Quiet", "Steady", "Playing well", "On fire"];

function Meter({ level }: { level: number }) {
  return <span className={`form-meter f${level}`}>{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}</span>;
}

type CardProps = { p: PlayerSummary; color: string; level: number; line: string };

function Card({ variant, p, color, level, line }: CardProps & { variant: string }) {
  const first = p.name.split(" ").slice(0, -1).join(" "), last = p.name.split(" ").slice(-1)[0];
  const bust = (size: number) => <Avatar player={p} color={color} size={size} bare />;
  return (
    <div className={`mk-card mk-${variant}`} style={{ ["--team" as string]: color }}>
      <span className="mk-bust">{bust(variant === "strip" ? 64 : variant === "banner" ? 104 : 96)}</span>
      <div className="mk-id">
        <span className="mk-first">{first}</span>
        <span className="mk-last">{last}</span>
        <span className="mk-meta"><i />{p.position}<b>#{p.number}</b></span>
      </div>
      <div className="mk-form"><Meter level={level} /><span>{WORDS[level]}</span></div>
      <p className="mk-line">{line}</p>
      <span className="mk-foot"><em>✓ checked</em><span>Numbers</span></span>
    </div>
  );
}

const LAYOUTS: [string, string, string][] = [
  ["fixed", "A · Current, fixed", "Same layout, with room kept for the bust so nothing runs under it."],
  ["left", "B · Portrait left", "The bust stands in a club-colour column on the left; text never meets it."],
  ["banner", "C · Club banner", "A club-colour header with the bust breaking out of it; story below."],
  ["strip", "D · Lower third", "A wide broadcast strip: small bust, name and form on one line."],
];

const LOOKS: [AvatarLook, string, string][] = [
  ["flat", "1 · Flat", "Clean illustration, flat colour."],
  ["lit", "2 · Studio lit (current)", "Soft light from the top left, shadow on the kit: more depth."],
  ["duo", "3 · Club duotone", "Whole portrait in the club colour, like a matchday poster."],
  ["sticker", "4 · Sticker cut-out", "White outline and drop shadow, like a sticker album."],
];

const DOODLES: [DoodleLook, string, string][] = [
  ["clean", "1 · Clean", "Straight vector lines."],
  ["pencil", "2 · Pencil", "Wobbly lines drawn twice, slightly off, like a quick sketch."],
  ["chalk", "3 · Chalk (current)", "Rough, broken strokes, like a tactics board."],
  ["marker", "4 · Marker", "Thick wobbly strokes; only the play, no pitch lines."],
];

export function Mock() {
  const s = useSummary();
  if (!s) return null;
  const colour = (c: string) => (c === s.meta.home.code ? s.meta.home.color : s.meta.away.color);
  const hearne = s.players.find((x) => x.short === "Hearne") ?? s.players[6];
  const picks = [hearne, ...s.players.filter((x) => x.id !== hearne.id).filter((_, i) => i % 5 === 0).slice(0, 4)];
  return (
    <div className="mk">
      <h1 id="assets">The Fifth Official · design assets (U)</h1>
      <FifthAssets />
      <h1 id="words">The Fifth Official · wordmarks, no icon</h1>
      <FifthWordmarks />
      <h1 id="newicons">The Fifth Official · new icons</h1>
      <FifthNewIcons />
      <h1 id="stackv">The Fifth Official · stacked, checked card</h1>
      <FifthStackVariants />
      <h1 id="line">The Fifth Official · one line</h1>
      <FifthLineConcepts />
      <h1 id="more">The Fifth Official · more icons</h1>
      <FifthMoreConcepts />
      <h1 id="three">The Fifth Official · three lines</h1>
      <FifthThreeConcepts />
      <h1 id="stacked">The Fifth Official · stacked</h1>
      <FifthStackedConcepts />
      <h1 id="fifth">The Fifth Official · logo concepts</h1>
      <FifthOfficialConcepts />
      <h1>Footnote logo concepts</h1>
      <LogoConcepts />
      <h1>Sketch backgrounds</h1>
      <div className="mk-doodles">
        {DOODLES.map(([look, title, note]) => (
          <figure key={look}><div className="mk-dd"><Doodle look={look} /></div><figcaption><b>{title}</b>{note}</figcaption></figure>
        ))}
      </div>
      <h1>Live card layouts</h1>
      <div className="mk-grid cards">
        {LAYOUTS.map(([v, title, note]) => (
          <figure key={v}>
            <div className="mk-pitch"><Card variant={v} p={hearne} color={colour(hearne.team)} level={0} line="Yellow card: Declan Hearne" /></div>
            <figcaption><b>{title}</b>{note}</figcaption>
          </figure>
        ))}
      </div>
      <h1>Headshot looks</h1>
      <div className="mk-looks">
        {LOOKS.map(([look, title, note]) => (
          <figure key={look}>
            <div className="mk-row">
              {picks.map((p) => <span key={p.id} className={`mk-tile ${look}`} style={{ ["--team" as string]: colour(p.team) }}><Avatar player={p} color={colour(p.team)} size={112} bare look={look} /></span>)}
            </div>
            <figcaption><b>{title}</b>{note}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
