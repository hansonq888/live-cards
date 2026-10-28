// The finished match for the light pages (Home, Learn, Players): one fetch of /api/summary.
import { useEffect, useState } from "react";
import type { MatchMeta, Play } from "../live/protocol";

export interface PlayerSummary {
  id: string; name: string; short: string; team: string; number: number; position: string; role: string;
  rating: number; attrs: Record<string, number>; stats: Record<string, number>; plays: string[];
  spot?: [number, number] | null; starter?: boolean;
}
export interface Summary {
  meta: MatchMeta; score: Record<string, number>; plays: Play[]; players: PlayerSummary[];
  examples: Record<string, string | null>;
  team: Record<string, Record<string, number>>;
  flow: ({ minute: number } & Record<string, { passes: number; shots: number } | number>)[];
  events: { minute: number; t: number; type: string; team: string; player: string; off?: string }[];
}

/** The match being looked at: ?match= in the URL (remembered), else the last one picked. */
export function matchId(): number {
  const q = new URLSearchParams(location.search).get("match");
  if (q) {
    try { localStorage.setItem("fo.match", q); } catch { /* storage may be blocked */ }
    return Number(q) || 7;
  }
  try { return Number(localStorage.getItem("fo.match")) || 7; } catch { return 7; }
}

const cached: Record<number, Promise<Summary>> = {};

export function useSummary(): Summary | null {
  const [s, set] = useState<Summary | null>(null);
  useEffect(() => {
    const id = matchId();
    cached[id] ??= fetch(`/api/summary?match=${id}`).then((r) => r.json());
    cached[id].then(set).catch(() => { delete cached[id]; });
  }, []);
  return s;
}

export interface MatchListing {
  match: number; title: string; date: string; venue: string; home: string; away: string;
  score: Record<string, number>; goals: { player: string; name: string; team: string; minute: number }[]; plays: number;
}

export const playHref = (id: string) => `/?page=play&play=${encodeURIComponent(id)}`;
export const outcomeLabel = (o: string) => ({ goal: "Goal", saved: "Saved", off_target: "Off target", blocked: "Blocked" }[o] ?? o);
/** xG as a fan reads it: "about n in 10". A fixed rule, so it can't drift from the number. */
export const xgWords = (q: number) => {
  const n = Math.round(Number(q.toFixed(2)) * 10);  // words agree with the xG shown (2 dp)
  return n >= 1 ? `goes in about ${n} time${n === 1 ? "" : "s"} in 10` : "goes in fewer than 1 time in 10";
};
