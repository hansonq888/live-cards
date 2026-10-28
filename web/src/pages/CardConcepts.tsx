// ?page=mock: match card concepts, all from the same data (score, crests, scorers, competition).
import { Crest } from "../ui/Crest";

type M = { comp: string; title: string; date: string; home: string; away: string; hs: number; as: number;
  hg: string[]; ag: string[]; hc: string; ac: string; hn: string; an: string; xg: [number, number] };
const DEMO: M = { comp: "League", title: "Matchweek 9", date: "Sat 24 Oct", home: "RIV", away: "NGT", hs: 2, as: 1,
  hg: ["Varenne 65′", "Marchbanks 87′"], ag: ["Halden 30′"], hc: "#d3302a", ac: "#2158a8", hn: "Riverside", an: "Northgate", xg: [0.8, 1.01] };

/** A · Scoreline row: one compact horizontal strip, like a results list. */
function RowCard({ m }: { m: M }) {
  return (
    <div className="cc cc-row">
      <span className="ccr-date"><b>{m.date.split(" ")[1]}</b>{m.date.split(" ")[2]}</span>
      <span className="ccr-team r">{m.hn}<Crest code={m.home} size={30} /></span>
      <span className="ccr-score">{m.hs}<i>–</i>{m.as}</span>
      <span className="ccr-team"><Crest code={m.away} size={30} />{m.an}</span>
      <span className="ccr-tag">{m.comp} · FT</span>
      <span className="ccr-go">→</span>
    </div>
  );
}

/** B · Ticket: a matchday-ticket shape with a perforated stub holding the score. */
function TicketCard({ m }: { m: M }) {
  return (
    <div className="cc cc-ticket" style={{ ["--h" as string]: m.hc, ["--a" as string]: m.ac }}>
      <div className="cct-main">
        <span className="cct-comp">{m.comp} · {m.title}</span>
        <div className="cct-teams"><span><Crest code={m.home} size={34} />{m.hn}</span><span><Crest code={m.away} size={34} />{m.an}</span></div>
        <span className="cct-date">{m.date} · Harbour Lane</span>
      </div>
      <div className="cct-stub"><b>{m.hs}</b><b>{m.as}</b><em>FT</em></div>
    </div>
  );
}

/** C · Split poster: each half in its club colour, big italic score straddling the split. */
function SplitCard({ m }: { m: M }) {
  return (
    <div className="cc cc-split" style={{ ["--h" as string]: m.hc, ["--a" as string]: m.ac }}>
      <div className="ccs-half h"><Crest code={m.home} size={52} /><b>{m.hn}</b><small>{m.hg.join(" · ")}</small></div>
      <div className="ccs-half a"><Crest code={m.away} size={52} /><b>{m.an}</b><small>{m.ag.join(" · ")}</small></div>
      <div className="ccs-score">{m.hs}<i>–</i>{m.as}</div>
      <span className="ccs-tag">{m.comp} · {m.date}</span>
    </div>
  );
}

/** D · Scoreboard: a stadium-scoreboard look, dark with lit digits. */
function BoardCard({ m }: { m: M }) {
  return (
    <div className="cc cc-board">
      <div className="ccb-top"><span>{m.comp.toUpperCase()}</span><span>FULL TIME</span></div>
      <div className="ccb-row"><Crest code={m.home} size={28} /><b>{m.hn.toUpperCase()}</b><span className="ccb-dig">{m.hs}</span></div>
      <div className="ccb-row"><Crest code={m.away} size={28} /><b>{m.an.toUpperCase()}</b><span className="ccb-dig">{m.as}</span></div>
      <div className="ccb-foot">{m.date} · {m.title}</div>
    </div>
  );
}

/** E · Stacked results: two rows like a league app, winner bold, with an xG bar. */
function StackCard({ m }: { m: M }) {
  const total = m.xg[0] + m.xg[1];
  return (
    <div className="cc cc-stack">
      <div className="ccst-head"><span>{m.title}</span><span>{m.date}</span><em>FT</em></div>
      <div className={`ccst-row ${m.hs > m.as ? "won" : ""}`}><Crest code={m.home} size={26} /><b>{m.hn}</b><span>{m.hs}</span></div>
      <div className={`ccst-row ${m.as > m.hs ? "won" : ""}`}><Crest code={m.away} size={26} /><b>{m.an}</b><span>{m.as}</span></div>
      <div className="ccst-xg"><span>xG {m.xg[0].toFixed(2)}</span><i><em style={{ width: `${(100 * m.xg[0]) / total}%`, background: m.hc }} /></i><span>{m.xg[1].toFixed(2)}</span></div>
    </div>
  );
}

/** F · Big crests: the two crests large, the score small between them, minimal text. */
function CrestCard({ m }: { m: M }) {
  return (
    <div className="cc cc-crest">
      <Crest code={m.home} size={72} />
      <div className="ccc-mid"><span>{m.comp}</span><b>{m.hs} – {m.as}</b><span>{m.date}</span></div>
      <Crest code={m.away} size={72} />
    </div>
  );
}

const CARDS: [string, string, (p: { m: M }) => JSX.Element][] = [
  ["A · Results row", "One compact line per match, like a results list. Many fit on screen.", RowCard],
  ["B · Matchday ticket", "A ticket with a perforated stub holding the score.", TicketCard],
  ["C · Split poster", "Each half in its club colour, a big italic score across the split.", SplitCard],
  ["D · Stadium scoreboard", "Dark, with lit scoreboard digits.", BoardCard],
  ["E · Stacked results", "Two rows like a league app, winner in bold, with an xG bar.", StackCard],
  ["F · Big crests", "The crests do the talking; score and date small in the middle.", CrestCard],
];

export function CardConcepts() {
  return (
    <div className="cc-grid">
      {CARDS.map(([title, note, C]) => (
        <figure key={title}><div className="cc-stage"><C m={DEMO} /></div><figcaption><b>{title}</b>{note}</figcaption></figure>
      ))}
    </div>
  );
}
