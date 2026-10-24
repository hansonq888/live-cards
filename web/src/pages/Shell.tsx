// Light pages share this frame: a gradient brand band with tabs, then generous space.
import type { ReactNode } from "react";
import { Wordmark } from "../ui/Wordmark";

const LINKS = [["home", "Home"], ["watch", "Match"], ["learn", "Learn"], ["players", "Players"]] as const;

export function Shell({ page, children }: { page: string; children: ReactNode }) {
  return (
    <div className="light">
      <header className="l-band">
        <div className="lb-row">
          <a className="lb-brand" href="/"><Wordmark /></a>
          <span className="lb-note">Synthetic match · fictional clubs</span>
        </div>
        <nav className="lb-tabs">
          {LINKS.map(([k, label]) => <a key={k} href={k === "home" ? "/" : `/?page=${k}`} className={page === k ? "on" : ""}>{label}</a>)}
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
