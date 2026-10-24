// The stat registry from /api/stats (backend/livecards/engine/registry.py): each stat's
// meaning, formula, calibratable settings and fan wording in five languages. Loaded once at
// start; wording falls back to the built-in strings until it arrives.
import { useEffect, useState } from "react";

export interface StatDef {
  id: string; name: string; plain: string; how: string; formula: string; compute: string;
  settings: Record<string, number>; meaning: Record<string, Record<string, string>>;
  example: string; note: string; bands: number[];
}
export interface Registry { version: string; stats: StatDef[] }

let registry: Registry | null = null;
const loading: Promise<Registry | null> = fetch("/api/stats").then((r) => r.json())
  .then((r: Registry) => (registry = r)).catch(() => null);

export function stat(id: string): StatDef | undefined {
  return registry?.stats.find((s) => s.id === id);
}

/** A stat's fan wording in a language, with its placeholders filled; undefined until loaded. */
export function meaning(id: string, key: string, lang: string, args: Record<string, string | number> = {}): string | undefined {
  const t = stat(id)?.meaning[key];
  const text = t?.[lang] ?? t?.en;
  return text?.replace(/\{(\w+)\}/g, (_, k) => String(args[k] ?? ""));
}

/** Which band a value falls in (0 = below the first threshold). */
export function band(id: string, value: number, fallback: number[]): number {
  const b = stat(id)?.bands ?? fallback;
  return b.filter((x) => value >= x).length;
}

export function useRegistry(): Registry | null {
  const [r, set] = useState(registry);
  useEffect(() => { if (!r) loading.then(set); }, [r]);
  return r;
}
