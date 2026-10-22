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
  | { type: "cue"; cue: Cue; moment_type: string; source: string; attempts: number; latency_ms: number; claims_checked: number }
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
  | { type: "select"; player: string }
  | { type: "auto" }
  | { type: "speed"; value: number }
  | { type: "pause" }
  | { type: "play" }
  | { type: "seek"; t: number }
  | { type: "model"; enabled: boolean };
