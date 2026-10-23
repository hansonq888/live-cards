// Live state: a tiny external store fed by the WebSocket. Frames go to a ring buffer
// read by the render loop (no React re-render per frame); everything else is React state.
import { useSyncExternalStore } from "react";
import { stepCaption, type Lang } from "../i18n";
import type { AnalystView, BuildStep, CardState, ModelSpec, ClientMsg, Frame, MatchMeta, Metrics, Moment, ServerMsg, TraceStep, Variant } from "./protocol";

export interface Director {
  target: string;
  reason: string;
  kind: string;
  predicted: boolean;
  mode: string;
  at: number; // wall ms
  key?: string;
  args?: Record<string, string | number | boolean | null>;
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
  facts?: Record<string, string | number>;
  text: string;
  source: string;
  phase: "instant" | "story";
  type: string;
  at: number;
  evidence: string[];
  latency: number;
  variants: Record<string, Variant>;
}

export interface KeyMoment { id: string; t: number; type: string; player: string | null; label: string }

const KEY_TYPES = new Set(["goal", "big_chance", "fastest_sprint", "rating_upgrade", "rating_downgrade", "momentum_swing", "card", "substitution"]);

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
  analyst: Record<string, AnalystView>;
  custom: Record<string, AnalystView & { name: string }>;
  yourModel: { status: string; name?: string; error?: string; spec: ModelSpec | null };
  // Latest verified line per player, and moments whose line is still being written.
  lines: Record<string, Line>;
  profile: string; // audience.lang.voice
  keyMoments: KeyMoment[];
  buildup: { goal: string; steps: BuildStep[]; start: number; goalT: number; story: string; storyArgs?: Record<string, string | number>; localized?: string | null; storySource: string; playing: boolean; at: number; resumeSpeed: number } | null;
  liveEdge: number; // furthest match time watched
  revisit: KeyMoment | null;
  answers: { id: string; question: string; text?: string; source?: string; evidence?: string[]; tools?: string[]; ms?: number; problems?: string[]; minute?: number; pending: boolean }[];
  redteam: { stage: string; mode?: string; player?: string | null; injected?: string; blockedBy?: string | null; reason?: string; aired?: string | null; at: number } | null;
  showcase: { player: string | null; type: string; t: number; base: string; variants: Variant[]; at: number } | null;
  pending: Record<string, Pending>;
  upgrades: Record<string, { from: number; to: number; type: string; at: number; label: string }>;
  alerts: { id: string; player: string; text: string; type: string; at: number; kmh?: number; count?: number }[];
  banner: { text: string; sub: string; at: number } | null;
  feed: FeedItem[];
  traces: TraceItem[];
  team: {
    possession: Record<string, number>;
    possession_5m: Record<string, number>;
    momentum: number;
    chaos: number;
    score: Record<string, number>;
    xg: Record<string, number>;
    shots: Record<string, number>;
    shots_on_target: Record<string, number>;
  } | null;
  metrics: Metrics | null;
}

const initial: LiveState = {
  connected: false, meta: null, t: 0, speed: 1, paused: false, modelEnabled: false,
  director: null, cards: {}, stats: {}, analyst: {}, custom: {}, yourModel: { status: "off", spec: null }, lines: {}, profile: "casual.en.neutral", showcase: null, redteam: null, answers: [],
  keyMoments: [], liveEdge: 0, revisit: null, buildup: null,
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

  /** Jump back to just before a key moment; the replay shows the ring and card as they were. */
  revisitMoment(k: KeyMoment) {
    this.set({ revisit: k, liveEdge: Math.max(this.state.liveEdge, this.state.t) });
    this.send({ type: "seek", t: Math.max(0, k.t - 8) });
  }

  applyModel(spec: ModelSpec | null) {
    this.set({ yourModel: { ...this.state.yourModel, spec, status: spec ? "building" : "off" }, custom: {} });
    this.send({ type: "your_model", spec });
    try { if (spec) localStorage.setItem("livecards.model", JSON.stringify(spec)); else localStorage.removeItem("livecards.model"); } catch { /* storage may be blocked */ }
  }

  explainGoal(goal?: string) {
    this.send({ type: "explain_goal", goal });
  }

  /** Called as the build-up replays: follow each step's player; hand back control at the end. */
  stepBuildup(t: number) {
    const b = this.state.buildup;
    if (!b || !b.playing) return;
    if (t > b.goalT + 3) {
      this.set({ buildup: { ...b, playing: false } });
      this.send({ type: "speed", value: b.resumeSpeed || 1 });
      this.send({ type: "auto" });
      return;
    }
    const step = [...b.steps].reverse().find((s) => s.t <= t);
    if (step && step.player !== this.lastBuildPlayer) {
      this.lastBuildPlayer = step.player;
      this.send({ type: "select", player: step.player, reason: stepCaption(this.lang(), step) });
    }
  }
  private lastBuildPlayer: string | null = null;

  backToLive() {
    this.set({ buildup: null });
    this.lastBuildPlayer = null;
    const edge = this.state.liveEdge;
    this.set({ revisit: null });
    this.send({ type: "seek", t: edge });
  }

  private keyMoment(mo: Moment): KeyMoment {
    const who = this.name(mo.player);
    const what = mo.type === "goal" ? "Goal" : mo.type === "rating_upgrade" ? `Card ▲ ${mo.facts.to}` : mo.type === "rating_downgrade" ? `Card ▼ ${mo.facts.to}` : mo.type === "fastest_sprint" ? `${mo.facts.speed_kmh} km/h` : mo.type === "momentum_swing" ? "Momentum swing" : mo.type === "big_chance" ? "Big chance" : mo.type === "card" ? "Yellow card" : "Substitution";
    return { id: mo.id, t: mo.t, type: mo.type, player: mo.player, label: `${what}${who ? " · " + who : ""}` };
  }

  lang(): Lang {
    return (this.state.profile.split(".")[1] as Lang) || "en";
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
        if (Math.floor(m.t) !== Math.floor(s.t)) this.set({ t: m.t, liveEdge: s.revisit ? s.liveEdge : Math.max(s.liveEdge, m.t) });
        break;
      case "director":
        this.set({ director: { target: m.target, reason: m.reason, kind: m.kind, predicted: m.predicted, mode: m.mode, at: now, key: m.key, args: m.args } });
        break;
      case "card":
        this.set({
          cards: { ...s.cards, [m.card.player]: m.card }, stats: { ...s.stats, [m.card.player]: m.stats },
          ...(m.analyst ? { analyst: { ...s.analyst, [m.card.player]: m.analyst } } : {}),
          ...(m.custom ? { custom: { ...s.custom, [m.card.player]: m.custom } } : {}),
        });
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
          patch.alerts = [...s.alerts.filter((a) => now - a.at < 6000), { id: mo.id, player: mo.player, text, type: mo.type, at: now, kmh: Number(mo.facts.speed_kmh), count: Number(mo.facts.count) }];
        }
        if (mo.type === "goal") {
          patch.banner = { text: "GOAL", sub: `${this.name(mo.player)} · ${mo.facts.score_home}–${mo.facts.score_away}`, at: now };
        }
        if ((KEY_TYPES.has(mo.type) && mo.importance >= 0.55) || mo.type === "goal") {
          if (!s.keyMoments.some((k) => k.id === mo.id)) {
            patch.keyMoments = [...s.keyMoments, this.keyMoment(mo)].sort((a, b) => a.t - b.t);
          }
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
            patch.lines = { ...s.lines, [c.player]: { cue: c.cue, facts: m.facts, text, source: m.source, phase: m.phase, type: m.moment_type, at: now, evidence: c.evidence, latency: m.latency_ms, variants: prev?.cue === c.cue ? prev.variants : {} } };
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
      case "buildup": {
        if (m.error) break;
        const resume = s.speed;
        this.set({
          buildup: { goal: m.goal, steps: m.steps, start: m.start_t, goalT: m.goal_t, story: m.story, storyArgs: m.story_args, storySource: "stats", playing: true, at: now, resumeSpeed: resume },
          revisit: { id: m.goal, t: m.goal_t, type: "goal", player: m.scorer, label: `Build-up · ${this.name(m.scorer)}` },
          liveEdge: Math.max(s.liveEdge, s.t),
        });
        this.send({ type: "seek", t: Math.max(0, m.start_t - 2) });
        this.send({ type: "speed", value: 0.5 });
        break;
      }
      case "buildup_story":
        if (s.buildup?.goal === m.goal) this.set({ buildup: { ...s.buildup, story: m.text, storySource: m.source, localized: m.localized } });
        break;
      case "your_model":
        this.set({ yourModel: { ...s.yourModel, status: m.status, name: m.name, error: m.error }, ...(m.status === "off" ? { custom: {} } : {}) });
        break;
      case "history": {
        const known = new Set(s.keyMoments.map((k) => k.id));
        const add = m.moments.filter((mo) => !known.has(mo.id)).map((mo) => this.keyMoment(mo));
        if (add.length) this.set({ keyMoments: [...s.keyMoments, ...add].sort((a, b) => a.t - b.t) });
        break;
      }
      case "answer_status":
        this.set({ answers: [{ id: m.id, question: m.question, pending: true }, ...s.answers.filter((a) => a.id !== m.id)].slice(0, 12) });
        break;
      case "answer":
        this.set({ answers: s.answers.map((a) => a.id === m.id ? { id: m.id, question: m.question, text: m.text, source: m.source, evidence: m.evidence, tools: m.tools, ms: m.ms, problems: m.problems, minute: m.minute, pending: false } : a) });
        break;
      case "redteam":
        this.set({ redteam: { stage: m.stage, mode: m.mode, player: m.player, injected: m.injected, blockedBy: m.blocked_by, reason: m.reason, aired: m.aired, at: now } });
        break;
      case "trace":
        this.set({ traces: [{ moment: m.moment, type: m.moment_type, player: m.player, steps: m.steps, at: now }, ...s.traces].slice(0, 30) });
        break;
      case "team":
        this.set({
          team: { possession: m.possession, possession_5m: m.possession_5m, momentum: m.momentum, chaos: m.chaos, score: m.score, xg: m.xg, shots: m.shots, shots_on_target: m.shots_on_target },
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

export function useLang(): Lang {
  return (useLive((s) => s.profile).split(".")[1] as Lang) || "en";
}

export function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
