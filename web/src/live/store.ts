// Live state: a tiny external store fed by the WebSocket. Frames go to a ring buffer
// read by the render loop (no React re-render per frame); everything else is React state.
import { matchId } from "../pages/summary";
import { useSyncExternalStore } from "react";
import { stepCaption, type Lang } from "../i18n";
import type { AnalystView, AnswerAction, AnswerTable, BuildStep, Heat, Play, CardState, ModelSpec, ClientMsg, Frame, MatchMeta, Metrics, Moment, ServerMsg, TraceStep, Variant } from "./protocol";

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
  aired?: { source: string; ms: number | null; text: string };
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

export interface KeyMoment { id: string; t: number; type: string; player: string | null; label: string; play?: string }

const HOLD_MS = 1600;  // how long a breakdown pauses on each drawn pass or shot
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
  heat: Record<string, Heat>;
  analyst: Record<string, AnalystView>;
  custom: Record<string, AnalystView & { name: string }>;
  yourModel: { status: string; name?: string; error?: string; spec: ModelSpec | null };
  // Latest verified line per player, and moments whose line is still being written.
  lines: Record<string, Line>;
  profile: string; // audience.lang.voice
  keyMoments: KeyMoment[];
  // Play breakdown: the steps of one attack, replayed from the data. `pauseAt` stops the
  // replay on a touch so it can be studied; `playing` is false once it has run to the end.
  buildup: { goal: string; kind: "goal" | "chance"; scorer: string; steps: BuildStep[]; start: number; goalT: number; story: string; storyArgs?: Record<string, string | number>; localized?: string | null; storySource: string; playing: boolean; at: number; resumeSpeed: number; pauseAt: number | null } | null;
  plays: Play[];
  showSpace: boolean; // shade space control during a breakdown
  tactical: boolean; // coach's tablet (top-down) instead of the broadcast camera
  showMe: boolean; // a play replaying on the tactical board with space shading and callouts
  liveEdge: number; // furthest match time watched
  revisit: KeyMoment | null;
  answers: { id: string; question: string; text?: string; source?: string; evidence?: string[]; tools?: string[]; ms?: number; problems?: string[]; minute?: number; actions?: AnswerAction[]; table?: AnswerTable | null; pending: boolean }[];
  redteam: { stage: string; mode?: string; player?: string | null; injected?: string; blockedBy?: string | null; reason?: string; aired?: string | null; at: number } | null;
  showcase: { player: string | null; type: string; t: number; base: string; variants: Variant[]; at: number } | null;
  pending: Record<string, Pending>;
  upgrades: Record<string, { from: number; to: number; type: string; at: number; label: string }>;
  alerts: { id: string; player: string; text: string; type: string; at: number; kmh?: number; count?: number }[];
  banner: { text: string; sub: string; at: number; player?: string; minute?: number; home?: number; away?: number } | null;
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
  // Rating and attributes of everyone on the pitch, and which one colours their rings.
  board: Record<string, Record<string, number>>;
  statRing: string | null;
}

/** Plays already seen stay listed after a rewind; new ones are added in time order. */
function mergePlays(seen: Play[], now: Play[] | undefined): Play[] {
  if (!now) return seen;
  const ids = new Set(now.map((p) => p.id));
  return [...now, ...seen.filter((p) => !ids.has(p.id))].sort((a, b) => a.t - b.t);
}

/** A WebSocket URL on this host, wss under https. */
export const wsUrl = (path: string) => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${path}`;

export const STAT_RINGS = ["rating", "pace", "passing", "threat", "defending", "engine"] as const;

function savedStatRing(): string | null {
  const q = new URLSearchParams(location.search).get("rings");
  if (q !== null) return (STAT_RINGS as readonly string[]).includes(q) ? q : null;
  try {
    const v = localStorage.getItem("statRing");
    return v && (STAT_RINGS as readonly string[]).includes(v) ? v : null;
  } catch { return null; }
}

const initial: LiveState = {
  connected: false, meta: null, t: 0, speed: 1, paused: false, modelEnabled: false,
  director: null, cards: {}, stats: {}, heat: {}, analyst: {}, custom: {}, yourModel: { status: "off", spec: null }, lines: {}, profile: "casual.en.neutral", showcase: null, redteam: null, answers: [],
  keyMoments: [], liveEdge: 0, revisit: null, buildup: null, plays: [], showSpace: true, tactical: false, showMe: false,
  pending: {}, upgrades: {}, alerts: [],
  banner: null, feed: [], traces: [], team: null, metrics: null, board: {}, statRing: null,
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
    this.state = { ...initial, statRing: savedStatRing() };
    const ws = new WebSocket(wsUrl(`/ws/live?speed=${speed}&start=${start}&match=${matchId()}`));
    this.ws = ws;
    ws.onopen = () => this.set({ connected: true });
    ws.onclose = () => {
      if (this.ws !== ws) return;  // replaced by a newer connection on purpose
      this.set({ connected: false });
      // The server went away (a restart or a network blip): pick up where we were.
      // A retry that fails before any frame arrives still knows the time it was resuming.
      const at = this.state.meta ? this.state.t : start;
      window.setTimeout(() => { if (this.ws === ws) this.connect(this.state.speed || speed, at); }, 2000);
    };
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

  /** "Show me": replay a play on the tactical board, space shaded, with big callouts. */
  showMe(play: string) {
    this.set({ showMe: true, tactical: true, showSpace: true });
    this.breakdown(play);
  }

  /** Break down any play (a shot's event id). */
  breakdown(play: string) {
    this.send({ type: "breakdown", play });
  }

  /** Jump to a step of the breakdown: replay into it at half speed and stop on the touch. */
  stepTo(i: number) {
    const b = this.state.buildup;
    if (!b) return;
    const k = Math.max(0, Math.min(b.steps.length - 1, i));
    const s = b.steps[k];
    this.lastBuildPlayer = null;
    this.heldStep = k;
    window.clearTimeout(this.holdTimer);
    this.set({ buildup: { ...b, pauseAt: s.t + 0.15, playing: true } });
    this.send({ type: "seek", t: Math.max(b.start - 2, s.t - 1.4) });
    this.send({ type: "speed", value: 0.5 });
    this.send({ type: "play" });
  }

  /** Hand the ring back to the auto-director. Updates the view at once, so the Following
   *  tag and card close even while paused (an older server only reports it on the next tick). */
  stopFollowing() {
    const d = this.state.director;
    if (d) this.set({ director: { ...d, mode: "auto" } });
    this.send({ type: "auto" });
  }

  stepIndex(t: number): number {
    const b = this.state.buildup;
    if (!b) return -1;
    let i = -1;
    b.steps.forEach((s, j) => { if (s.t <= t + 0.05) i = j; });
    return i;
  }

  toggleSpace() { this.set({ showSpace: !this.state.showSpace }); }
  toggleTactical() { this.set({ tactical: !this.state.tactical }); }

  stepNext() { this.stepTo(this.stepIndex(this.state.t) + 1); }
  stepPrev() { this.stepTo(this.stepIndex(this.state.t) - 1); }

  /** Play the rest of the breakdown without stopping (or pause it). */
  toggleBreakdown() {
    const b = this.state.buildup;
    if (!b) return;
    if (this.state.paused) {
      if (this.state.t > b.goalT + 1) { this.stepTo(0); this.set({ buildup: { ...this.state.buildup!, pauseAt: null } }); return; }
      this.set({ buildup: { ...b, pauseAt: null, playing: true } });
      this.send({ type: "speed", value: 0.5 });
      this.send({ type: "play" });
    } else {
      this.send({ type: "pause" });
    }
  }

  /** Called as the build-up replays: follow each step's player; hand back control at the end. */
  stepBuildup(t: number) {
    const b = this.state.buildup;
    if (!b || !b.playing) return;
    // Until the jump back to the play has landed the clock still reads where we were (often
    // full time); don't mistake that for the play having finished.
    if (!this.buildArrived) { if (t <= b.goalT) this.buildArrived = true; else return; }
    if (b.pauseAt !== null && t >= b.pauseAt) {
      this.set({ buildup: { ...b, pauseAt: null } });
      this.send({ type: "pause" });
    } else if (t > b.goalT + 2) {
      // The play is over: hold on the final frame so it can be studied; Back to live resumes.
      this.set({ buildup: { ...b, playing: false } });
      this.send({ type: "pause" });
      return;
    }
    const step = [...b.steps].reverse().find((s) => s.t <= t);
    if (step && step.player !== this.lastBuildPlayer) {
      this.lastBuildPlayer = step.player;
      this.send({ type: "select", player: step.player, reason: stepCaption(this.lang(), step) });
    }
    // Hold on each drawn touch (a pass or a shot) so its marking can be read, then carry on;
    // the board fades the marking out once the play moves past it.
    const k = b.steps.indexOf(step!);
    if (step && k > this.heldStep && b.pauseAt === null && (step.kind === "pass" || step.kind === "shot")) {
      this.heldStep = k;
      this.send({ type: "pause" });
      window.clearTimeout(this.holdTimer);
      this.holdTimer = window.setTimeout(() => {
        const cur = this.state.buildup;
        if (cur && cur.playing && cur.goal === b.goal) this.send({ type: "play" });
      }, HOLD_MS);
    }
  }
  private lastBuildPlayer: string | null = null;
  private heldStep = -1;
  private holdTimer = 0;
  private buildArrived = false;

  /** Leave a revisit where it is: after full time there is no live edge to go back to. */
  closeRevisit() {
    this.set({ revisit: null });
  }

  backToLive() {
    const b = this.state.buildup;
    if (b) {
      this.send({ type: "speed", value: b.resumeSpeed || 1 });
      this.send({ type: "auto" });
      this.send({ type: "play" });
    }
    this.set({ buildup: null, ...(this.state.showMe ? { showMe: false, tactical: false } : {}) });
    this.lastBuildPlayer = null;
    const edge = this.state.liveEdge;
    this.set({ revisit: null });
    this.send({ type: "seek", t: edge });
  }

  private keyMoment(mo: Moment): KeyMoment {
    const who = this.name(mo.player);
    const what = mo.type === "goal" ? "Goal" : mo.type === "rating_upgrade" ? `Card ▲ ${mo.facts.to}` : mo.type === "rating_downgrade" ? `Card ▼ ${mo.facts.to}` : mo.type === "fastest_sprint" ? `${mo.facts.speed_kmh} km/h` : mo.type === "momentum_swing" ? "Momentum swing" : mo.type === "big_chance" ? "Big chance" : mo.type === "card" ? "Yellow card" : "Substitution";
    return { id: mo.id, t: mo.t, type: mo.type, player: mo.player, label: `${what}${who ? " · " + who : ""}`, play: mo.type === "goal" || mo.type === "big_chance" ? mo.evidence[0] : undefined };
  }

  setStatRing(stat: string | null) {
    try { if (stat) localStorage.setItem("statRing", stat); else localStorage.removeItem("statRing"); } catch { /* private window */ }
    this.set({ statRing: stat });
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
        // Once a second is enough for the page, but a breakdown steps through touches tenths apart.
        if (s.buildup || Math.floor(m.t) !== Math.floor(s.t)) this.set({ t: m.t, liveEdge: s.revisit ? s.liveEdge : Math.max(s.liveEdge, m.t) });
        break;
      case "director":
        this.set({ director: { target: m.target, reason: m.reason, kind: m.kind, predicted: m.predicted, mode: m.mode, at: now, key: m.key, args: m.args } });
        break;
      case "card":
        this.set({
          cards: { ...s.cards, [m.card.player]: m.card }, stats: { ...s.stats, [m.card.player]: m.stats },
          ...(m.analyst ? { analyst: { ...s.analyst, [m.card.player]: m.analyst } } : {}),
          ...(m.custom ? { custom: { ...s.custom, [m.card.player]: m.custom } } : {}),
          ...(m.heat ? { heat: { ...s.heat, [m.card.player]: m.heat } } : {}),
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
          patch.banner = { text: "GOAL", sub: `${this.name(mo.player)} · ${mo.facts.score_home}–${mo.facts.score_away}`, at: now,
            player: mo.player ?? undefined, minute: Math.floor(mo.t / 60) + 1, home: Number(mo.facts.score_home), away: Number(mo.facts.score_away) };
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
          buildup: { goal: m.goal, kind: m.kind ?? "goal", scorer: m.scorer, steps: m.steps, start: m.start_t, goalT: m.goal_t, story: m.story, storyArgs: m.story_args, storySource: "stats", playing: true, at: now, resumeSpeed: s.buildup ? s.buildup.resumeSpeed : resume, pauseAt: null },
          revisit: { id: m.goal, t: m.goal_t, type: m.kind === "chance" ? "big_chance" : "goal", player: m.scorer, label: `${m.kind === "chance" ? "Chance" : "Goal"} · ${this.name(m.scorer)}` },
          liveEdge: Math.max(s.liveEdge, s.t),
        });
        this.buildArrived = false;
        this.heldStep = -1;
        this.send({ type: "seek", t: Math.max(0, m.start_t - 2) });
        this.send({ type: "speed", value: s.showMe ? 0.8 : 0.5 });  // Show me keeps it moving
        this.send({ type: "play" });
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
        this.set({ answers: s.answers.map((a) => a.id === m.id ? { id: m.id, question: m.question, text: m.text, source: m.source, evidence: m.evidence, tools: m.tools, ms: m.ms, problems: m.problems, minute: m.minute, actions: m.actions, table: m.table, pending: false } : a) });
        break;
      case "redteam":
        this.set({ redteam: { stage: m.stage, mode: m.mode, player: m.player, injected: m.injected, blockedBy: m.blocked_by, reason: m.reason, aired: m.aired, at: now } });
        break;
      case "trace": {
        // The explain path and the personalizer fan-out report separately: one row per moment.
        const prev = s.traces.find((x) => x.moment === m.moment && x.type === m.moment_type);
        const item: TraceItem = prev
          ? { ...prev, steps: [...prev.steps, ...m.steps], aired: m.aired ?? prev.aired }
          : { moment: m.moment, type: m.moment_type, player: m.player, steps: m.steps, at: now, aired: m.aired };
        this.set({ traces: [item, ...s.traces.filter((x) => x !== prev)].slice(0, 40) });
        break;
      }
      case "team":
        this.set({
          team: { possession: m.possession, possession_5m: m.possession_5m, momentum: m.momentum, chaos: m.chaos, score: m.score, xg: m.xg, shots: m.shots, shots_on_target: m.shots_on_target },
          metrics: m.metrics, speed: m.speed, modelEnabled: m.model_enabled, board: m.board ?? {}, plays: mergePlays(s.plays, m.plays),
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
// Exposed for the recording scripts (scripts/record_gif.py --after), e.g. to slow the replay.
(window as unknown as { fifthLive?: typeof live }).fifthLive = live;

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
