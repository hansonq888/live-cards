// Light pages share this frame: a gradient brand band with tabs, then generous space.
import type { ReactNode } from "react";
import { Wordmark } from "../ui/Wordmark";
import { Crest } from "../ui/Crest";
import { useSummary } from "./summary";
import { Bands } from "../ui/Bolts";

const LINKS = [["home", "Home"], ["watch", "Match"], ["analyse", "Analyse"], ["learn", "Learn"], ["players", "Players"]] as const;

export function Shell({ page, children }: { page: string; children: ReactNode }) {
  const s = useSummary();
  const m = s?.meta;
  return (
    <div className="light">
      <header className="l-band">
        <Bands className="band-bands" corners="right" w={1400} h={200} />
        <div className="lb-row">
          <a className="lb-brand" href="/"><Wordmark /></a>
          <div className="lb-right">
            {m && s && (
              <a className="lb-result" href="/?page=watch" title="Latest result">
                <span className="lbr-tag">FT</span>
                <Crest code={m.home.code} size={20} /><b>{m.home.code}</b>
                <b className="lbr-score">{s.score[m.home.code]}–{s.score[m.away.code]}</b>
                <b>{m.away.code}</b><Crest code={m.away.code} size={20} />
              </a>
            )}
            <a className="lb-cta" href="/?page=analyse">Analyse the plays →</a>
          </div>
        </div>
        <nav className="lb-tabs">
          {LINKS.map(([k, label]) => <a key={k} href={k === "home" ? "/" : `/?page=${k}`} className={page === k ? "on" : ""}>{label}</a>)}
          <span className="lb-note">Synthetic match · fictional clubs</span>
        </nav>
      </header>
      <main className="l-main">{children}</main>
      <footer className="l-foot">
        <span>Every number comes from the match engine; every sentence is checked by AI agents before you see it.</span>
        <span><a href="/?view=console">Broadcast console</a> · <a href="/?view=vision">Vision</a></span>
      </footer>
    </div>
  );
}
