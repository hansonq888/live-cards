// Messages from the backend WebSocket (backend/livecards/server/session.py).

export interface PlayerMeta {
  id: string;
  team: string;
  number: number;
  name: string;
  short: string;
  role: string;
  position: string;
  starter: boolean;
  base_attrs: Record<string, number>;
}

export interface TeamMeta {
  code: string;
  name: string;
  color: string;
  secondary: string;
  attack_dir: 1 | -1;
  formation: string;
}

export interface MatchMeta {
  match_id: string;
  venue: string;
  home: TeamMeta;
  away: TeamMeta;
  players: PlayerMeta[];
  duration: number;
}

export interface Frame {
  t: number;
  ball: [number, number, number];
  players: [string, number, number, number][]; // id, x, y, speed m/s
  ring: string | null;
}

export interface CardState {
  player: string;
  t: number;
  rating: number;
  delta: number;
  attrs: Record<string, number>;
  reason: string;
  evidence: string[];
}

export interface Moment {
  id: string;
  t: number;
  minute: number;
  type: string;
  player: string | null;
  team: string | null;
  importance: number;
  facts: Record<string, number | string>;
  evidence: string[];
  template: string;
}

export interface Cue {
  cue: string;
  start: number;
  duration: number;
  type: string;
  player: string | null;
  ring: boolean;
  text: Record<string, string>;
  lang: string;
  evidence: string[];
}

export interface Variant {
  key: string; // audience.lang.voice
  text: string;
  source: "model" | "fallback";
  attempts: number;
  ms: number;
  problems: string[];
}

export interface BuildStep { t: number; kind: string; player: string; text: string; evidence: string[] }

export interface TraceStep {
  moment_id: string;
  stage: string;
  outcome: string;
  ms: number;
  detail: string;
  attempt: number;
}

export interface Metrics {
  moments: number;
  cues: number;
  claims_checked: number;
  blocked: number;
  model_lines: number;
  template_lines: number;
  rewrites: number;
  aired_unverified: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
}

export type ServerMsg =
  | { type: "hello"; meta: MatchMeta; speed: number; t: number; model_enabled: boolean }
  | ({ type: "frame" } & Frame)
  | { type: "director"; t: number; target: string; reason: string; kind: string; predicted: boolean; mode: string }
  | { type: "card"; card: CardState; stats: Record<string, number> }
  | { type: "moment"; moment: Moment; card?: CardState }
  | { type: "cue"; cue: Cue; moment_type: string; phase: "instant" | "story"; source: string; attempts: number; latency_ms: number; claims_checked: number }
  | { type: "variants"; cue: string; moment: string; moment_type: string; player: string | null; t: number; base: string; variants: Variant[] }
  | { type: "profile"; key: string }
  | { type: "history"; moments: Moment[] }
  | { type: "buildup"; error?: string; goal: string; team: string; scorer: string; start_t: number; goal_t: number; story: string; steps: BuildStep[] }
  | { type: "buildup_story"; goal: string; text: string; source: string }
  | { type: "answer_status"; id: string; question: string; stage: string }
  | { type: "answer"; id: string; question: string; text: string; verified: boolean; source: string; evidence: string[]; tools: string[]; ms: number; problems: string[]; minute: number }
  | { type: "redteam"; stage: "started" | "result" | "unavailable"; mode?: string; moment?: string; player?: string | null; injected?: string; blocked_by?: string | null; reason?: string; aired?: string | null; aired_source?: string | null }
  | { type: "trace"; moment: string; moment_type: string; player: string | null; steps: TraceStep[] }
  | {
      type: "team";
      t: number;
      possession: Record<string, number>;
      possession_5m: Record<string, number>;
      momentum: number;
      chaos: number;
      score: Record<string, number>;
      metrics: Metrics;
      speed: number;
      model_enabled: boolean;
    }
  | { type: "model"; enabled: boolean }
  | { type: "seeked"; t: number }
  | { type: "end"; score: Record<string, number> };

export type ClientMsg =
  | { type: "select"; player: string; reason?: string }
  | { type: "auto" }
  | { type: "speed"; value: number }
  | { type: "pause" }
  | { type: "play" }
  | { type: "seek"; t: number }
  | { type: "model"; enabled: boolean }
  | { type: "profile"; key: string }
  | { type: "redteam" }
  | { type: "ask"; id: string; question: string }
  | { type: "explain_goal"; goal?: string };
