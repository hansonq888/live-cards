// Stat rings: colour every player by one live number, cool blue (lowest on the pitch) to hot
// orange (highest). Colours are relative to the players on the pitch right now; the exact
// value is one hover away, and the legend shows the range.
import type { PlayerMeta } from "../live/protocol";

const COOL: [number, number, number] = [59, 130, 246];
const MID: [number, number, number] = [148, 163, 184];
const HOT: [number, number, number] = [255, 122, 26];

export function heat(k: number): string {
  const x = Math.max(0, Math.min(1, k));
  const [a, b, f] = x < 0.5 ? [COOL, MID, x * 2] : [MID, HOT, (x - 0.5) * 2];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export interface StatScale { colors: Map<string, string>; lo: number; hi: number }

/** Colour per player for `stat`. Goalkeepers are left out of the range (their attributes
 *  aren't comparable with outfield players') and get no ring for attributes. */
export function statScale(board: Record<string, Record<string, number>>, stat: string,
                          players: Map<string, PlayerMeta>): StatScale | null {
  const rows = Object.entries(board).filter(([id, r]) => r[stat] !== undefined && players.get(id)?.role !== "GK");
  if (!rows.length) return null;
  const vals = rows.map(([, r]) => r[stat]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const colors = new Map<string, string>();
  for (const [id, r] of rows) colors.set(id, heat(hi > lo ? (r[stat] - lo) / (hi - lo) : 0.5));
  if (stat === "rating") {
    for (const [id, r] of Object.entries(board)) {
      if (players.get(id)?.role === "GK") colors.set(id, heat(hi > lo ? (r.rating - lo) / (hi - lo) : 0.5));
    }
  }
  return { colors, lo, hi };
}

export const fmtStat = (stat: string, v: number) => (stat === "rating" ? v.toFixed(1) : String(Math.round(v)));
