// Live state: a tiny external store fed by the WebSocket. Frames go to a ring buffer
// read by the render loop (no React re-render per frame); everything else is React state.
import { useSyncExternalStore } from "react";
import type { CardState, ClientMsg, Frame, MatchMeta, Metrics, ServerMsg, TraceStep, Variant } from "./protocol";

export interface Director {
  target: string;
  reason: string;
  kind: string;
  predicted: boolean;
  mode: string;
  at: number; // wall ms
}

export interface FeedItem {
  id: string;
  t: number;
  kind: "cue" | "moment";
  type: string;
  player: string | null;
  text: string;
  source?: string;
  latency?: number;
  evidence: string[];
}

export interface TraceItem {
  moment: string;
  type: string;
  player: string | null;
  steps: TraceStep[];
  at: number;
}

export interface Line {
  cue: string;
  text: string;
  source: string;
  phase: "instant" | "story";
  type: string;
  at: number;
  evidence: string[];
  latency: number;
  variants: Record<string, Variant>;
}

export interface Pending {
  momentId: string;
  type: string;
  at: number;
}

export interface LiveState {
  connected: boolean;
  meta: MatchMeta | null;
  t: number;
  speed: number;
  paused: boolean;
  modelEnabled: boolean;
  director: Director | null;
  cards: Record<string, CardState>;
  stats: Record<string, Record<string, number>>;
  // Latest verified line per player, and moments whose line is still being written.
  lines: Record<string, Line>;
  profile: string; // audience.lang.voice
  showcase: { player: string | null; type: string; t: number; base: string; variants: Variant[]; at: number } | null;
  pending: Record<string, Pending>;
  upgrades: Record<string, { from: number; to: number; type: string; at: number; label: string }>;
  alerts: { id: string; player: string; text: string; type: string; at: number }[];
  banner: { text: string; sub: string; at: number } | null;
  feed: FeedItem[];
  traces: TraceItem[];
  team: {
    possession: Record<string, number>;
    possession_5m: Record<string, number>;
    momentum: number;
    chaos: number;
    score: Record<string, number>;
  } | null;
  metrics: Metrics | null;
}

const initial: LiveState = {
  connected: false, meta: null, t: 0, speed: 1, paused: false, modelEnabled: false,
  director: null, cards: {}, stats: {}, lines: {}, profile: "casual.en.neutral", showcase: null,
  pending: {}, upgrades: {}, alerts: [],
  banner: null, feed: [], traces: [], team: null, metrics: null,
};

export interface TimedFrame { frame: Frame; at: number }

class LiveStore {
  state: LiveState = initial;
  frames: TimedFrame[] = [];
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  get = () => this.state;
  private set(patch: Partial<LiveState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  connect(speed = 1, start = 0) {
    this.ws?.close();
    this.frames = [];
    this.state = { ...initial };
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/live?speed=${speed}&start=${start}`);
    this.ws = ws;
    ws.onopen = () => this.set({ connected: true });
    ws.onclose = () => this.ws === ws && this.set({ connected: false });
    ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data) as ServerMsg);
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    if (msg.type === "pause") this.set({ paused: true });
    if (msg.type === "play") this.set({ paused: false });
    if (msg.type === "speed") this.set({ speed: msg.value });
    if (msg.type === "seek") { this.frames = []; }
    if (msg.type === "profile") this.set({ profile: msg.key });
  }

  private name(id: string | null) {
    return this.state.meta?.players.find((p) => p.id === id)?.short ?? id ?? "";
  }

  private onMessage(m: ServerMsg) {
    const now = performance.now();
    const s = this.state;
    switch (m.type) {
      case "hello":
        this.set({ meta: m.meta, speed: m.speed, t: m.t, modelEnabled: m.model_enabled });
        break;
      case "frame":
        this.frames.push({ frame: m, at: now });
        if (this.frames.length > 40) this.frames.splice(0, this.frames.length - 40);
        if (Math.floor(m.t) !== Math.floor(s.t)) this.set({ t: m.t });
        break;
      case "director":
        this.set({ director: { target: m.target, reason: m.reason, kind: m.kind, predicted: m.predicted, mode: m.mode, at: now } });
        break;
      case "card":
        this.set({ cards: { ...s.cards, [m.card.player]: m.card }, stats: { ...s.stats, [m.card.player]: m.stats } });
        break;
      case "moment": {
        const mo = m.moment;
        const patch: Partial<LiveState> = {};
        if (m.card && mo.player) patch.cards = { ...s.cards, [mo.player]: m.card };
        if (mo.player && mo.importance >= 0.3 && mo.type !== "distance_milestone") {
          patch.pending = { ...s.pending, [mo.player]: { momentId: mo.id, type: mo.type, at: now } };
        }
        if (mo.player && (mo.type === "rating_upgrade" || mo.type === "rating_downgrade")) {
          patch.upgrades = { ...s.upgrades, [mo.player]: { from: Number(mo.facts.from), to: Number(mo.facts.to), type: mo.type, at: now, label: "Rating" } };
        }
        if (mo.player && (mo.type === "attr_upgrade" || mo.type === "attr_downgrade")) {
          const attr = String(mo.facts.attr);
          patch.upgrades = { ...s.upgrades, [mo.player]: { from: Number(mo.facts.from), to: Number(mo.facts.to), type: mo.type, at: now, label: attr } };
        }
        if (mo.player && ["fastest_sprint", "sprint", "streak"].includes(mo.type)) {
          const text = mo.type === "streak" ? `🔥 ${mo.facts.count} IN A ROW` : `⚡ ${Number(mo.facts.speed_kmh).toFixed(1)} KM/H${mo.type === "fastest_sprint" ? " · FASTEST" : ""}`;
          patch.alerts = [...s.alerts.filter((a) => now - a.at < 6000), { id: mo.id, player: mo.player, text, type: mo.type, at: now }];
        }
        if (mo.type === "goal") {
          patch.banner = { text: "GOAL", sub: `${this.name(mo.player)} · ${mo.facts.score_home}–${mo.facts.score_away}`, at: now };
        }
        if (mo.importance >= 0.45) {
          patch.feed = [{ id: mo.id, t: mo.t, kind: "moment" as const, type: mo.type, player: mo.player, text: mo.template, evidence: mo.evidence }, ...s.feed].slice(0, 40);
        }
        this.set(patch);
        break;
      }
      case "cue": {
        const c = m.cue;
        const text = c.text.casual;
        const patch: Partial<LiveState> = {
          feed: [
            { id: c.cue, t: c.start, kind: "cue" as const, type: m.moment_type, player: c.player, text, source: m.source, latency: m.latency_ms, evidence: c.evidence },
            ...s.feed.filter((f) => f.id !== c.cue && !(f.kind === "moment" && f.type === m.moment_type && f.t === c.start)),
          ].slice(0, 40),
        };
        if (c.player) {
          const prev = s.lines[c.player];
          // An instant line never overwrites a newer story line from another moment.
          if (m.phase === "story" || !prev || prev.cue !== c.cue) {
            patch.lines = { ...s.lines, [c.player]: { cue: c.cue, text, source: m.source, phase: m.phase, type: m.moment_type, at: now, evidence: c.evidence, latency: m.latency_ms, variants: prev?.cue === c.cue ? prev.variants : {} } };
          }
          const p = { ...s.pending };
          delete p[c.player];
          patch.pending = p;
        }
        this.set(patch);
        break;
      }
      case "variants": {
        const byKey = Object.fromEntries(m.variants.map((v) => [v.key, v]));
        const patch: Partial<LiveState> = {};
        const line = m.player ? s.lines[m.player] : undefined;
        if (m.player && line && line.cue === m.cue) {
          patch.lines = { ...s.lines, [m.player]: { ...line, variants: { ...line.variants, ...byKey } } };
        }
        if (m.variants.length > 1) {
          patch.showcase = { player: m.player, type: m.moment_type, t: m.t, base: m.base, variants: m.variants, at: now };
        }
        this.set(patch);
        break;
      }
      case "profile":
        this.set({ profile: m.key });
        break;
      case "trace":
        this.set({ traces: [{ moment: m.moment, type: m.moment_type, player: m.player, steps: m.steps, at: now }, ...s.traces].slice(0, 30) });
        break;
      case "team":
        this.set({
          team: { possession: m.possession, possession_5m: m.possession_5m, momentum: m.momentum, chaos: m.chaos, score: m.score },
          metrics: m.metrics, speed: m.speed, modelEnabled: m.model_enabled,
        });
        break;
      case "model":
        this.set({ modelEnabled: m.enabled });
        break;
      case "seeked":
        this.frames = [];
        this.set({ t: m.t, alerts: [], banner: null, pending: {}, upgrades: {} });
        break;
    }
  }
}

export const live = new LiveStore();

export function useLive<T>(select: (s: LiveState) => T): T {
  return useSyncExternalStore(live.subscribe, () => select(live.get()));
}

export function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
