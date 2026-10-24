// Light pages share this frame: a quiet top bar and generous space.
import type { ReactNode } from "react";
import { Bolt } from "../ui/Bolt";

const LINKS = [["home", "Home"], ["watch", "Watch"], ["analyse", "Analyse"], ["learn", "Learn"], ["players", "Players"]] as const;

export function Shell({ page, children }: { page: string; children: ReactNode }) {
  return (
    <div className="light">
      <header className="l-top">
        <a className="l-brand" href="/"><Bolt size={20} />Live Cards</a>
        <nav className="l-nav">
          {LINKS.map(([k, label]) => <a key={k} href={k === "home" ? "/" : `/?page=${k}`} className={page === k ? "on" : ""}>{label}</a>)}
        </nav>
        <span className="l-note">Synthetic match · fictional clubs</span>
      </header>
      <main className="l-main">{children}</main>
      <footer className="l-foot">
        <span>Every number comes from the match engine; every sentence is checked by AI agents before you see it.</span>
        <span><a href="/?view=console">Broadcast console</a> · <a href="/?view=vision">Vision</a></span>
      </footer>
    </div>
  );
}
