import { useState } from "react";
import { clock, live, useLive } from "../live/store";

const STAGE_LABEL: Record<string, string> = {
  explainer: "Explainer", verifier: "Verifier", "template-check": "Verifier", reviewer: "Reviewer",
  template: "Template", publish: "Publish",
};
const stageLabel = (s: string) => STAGE_LABEL[s] ?? (s.startsWith("personalizer:") ? `Personalizer ${s.split(":")[1].split(".").slice(0, 2).join(" ").toUpperCase()}` : s);

function Feed() {
  const feed = useLive((s) => s.feed);
  const meta = useLive((s) => s.meta);
  const name = (id: string | null) => meta?.players.find((p) => p.id === id)?.short ?? "";
  return (
    <div className="feed">
      {feed.length === 0 && <div className="empty">Verified lines appear here as moments happen.</div>}
      {feed.map((f) => (
        <div key={f.id} className={`feed-item feed-${f.kind}`}>
          <div className="feed-head">
            <span className="feed-time">{clock(f.t)}</span>
            <span className="feed-type">{f.type.replace(/_/g, " ")}</span>
            {f.player && <span className="feed-player">{name(f.player)}</span>}
            {f.kind === "cue" ? (
              <span className={`src src-${f.source}`}>{f.source === "model" ? "AI" : "template"} · {Math.round(f.latency ?? 0)} ms</span>
            ) : (
              <span className="src src-pending">explaining…</span>
            )}
          </div>
          <div className="feed-text">{f.text}</div>
          <div className="feed-evidence">{f.evidence.slice(0, 4).join(" · ")}{f.evidence.length > 4 ? " …" : ""}</div>
        </div>
      ))}
    </div>
  );
}

function Trace() {
  const traces = useLive((s) => s.traces);
  return (
    <div className="trace">
      <div className="trace-legend">Explainer → Verifier (code) → Reviewer (gpt-5-mini) → Publish, then Personalizer fan-out, each re-verified. Rejected lines never air.</div>
      {traces.map((tr) => (
        <div key={tr.moment} className="trace-row">
          <div className="trace-title">{tr.type.replace(/_/g, " ")} <span className="dim">{tr.moment}</span></div>
          <div className="trace-steps">
            {tr.steps.map((s, i) => (
              <span key={i} className={`step step-${s.outcome}`} title={s.detail}>
                {stageLabel(s.stage)}
                {s.attempt > 0 && s.stage !== "publish" ? ` #${s.attempt + 1}` : ""}
                <em>{s.outcome}{s.stage === "verifier" || s.stage === "template-check" ? (s.ms < 1 ? " · <1ms" : ` · ${s.ms.toFixed(1)}ms`) : s.ms ? ` · ${Math.round(s.ms)}ms` : ""}</em>
              </span>
            ))}
          </div>
          {tr.steps.filter((s) => s.outcome === "rejected").map((s, i) => (
            <div key={i} className="trace-reject">✕ {s.detail}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Metrics() {
  const m = useLive((s) => s.metrics);
  const team = useLive((s) => s.team);
  const meta = useLive((s) => s.meta);
  if (!m || !team || !meta) return <div className="empty">Waiting for data…</div>;
  const h = meta.home.code, a = meta.away.code;
  const mom = team.momentum;
  return (
    <div className="metrics">
      <div className="metric-grid">
        <div><b>{m.claims_checked}</b><span>lines checked</span></div>
        <div><b>{m.blocked}</b><span>lines blocked</span></div>
        <div><b className={m.aired_unverified === 0 ? "ok" : "bad"}>{m.aired_unverified}</b><span>unverified aired</span></div>
        <div><b>{m.latency_p50_ms != null ? `${(m.latency_p50_ms / 1000).toFixed(2)}s` : "–"}</b><span>explain p50</span></div>
        <div><b>{m.latency_p95_ms != null ? `${(m.latency_p95_ms / 1000).toFixed(2)}s` : "–"}</b><span>explain p95</span></div>
        <div><b>{m.model_lines}/{m.template_lines}</b><span>AI / template</span></div>
      </div>
      <div className="team-bars">
        <div className="tb-label">Possession (last 5′)</div>
        <div className="split">
          <i style={{ width: `${team.possession_5m[h] ?? 50}%`, background: meta.home.color }} />
          <i style={{ width: `${team.possession_5m[a] ?? 50}%`, background: meta.away.color }} />
        </div>
        <div className="tb-label">Momentum</div>
        <div className="momentum">
          <i style={{ left: `${50 + mom * 50}%` }} />
        </div>
        <div className="tb-ends"><span>{a}</span><span>{h}</span></div>
        <div className="tb-label">Control ↔ chaos: <b>{team.chaos}</b>/100</div>
        <div className="chaos"><i style={{ width: `${team.chaos}%` }} /></div>
      </div>
    </div>
  );
}

const LANGS: Record<string, string> = { en: "English", es: "Español", fr: "Français", ar: "العربية", pt: "Português" };

function profileLabel(key: string, home: string, away: string) {
  const [aud, lang, voice] = key.split(".");
  const v = voice === "home" ? `${home} fan` : voice === "away" ? `${away} fan` : "neutral";
  return `${aud === "analyst" ? "Analyst" : "Casual"} · ${LANGS[lang]} · ${v}`;
}

function Fans() {
  const sc = useLive((s) => s.showcase);
  const meta = useLive((s) => s.meta);
  if (!sc || !meta) return <div className="empty">On goals and card upgrades, the same verified moment appears here for four very different fans, each version re-verified in its own language.</div>;
  const name = meta.players.find((p) => p.id === sc.player)?.short ?? "";
  return (
    <div className="fans">
      <div className="fans-head">{clock(sc.t)} · {sc.type.replace(/_/g, " ")} · {name}</div>
      <div className="fan base"><div className="fan-who">Verified English line</div><div className="fan-text">{sc.base}</div></div>
      {sc.variants.map((v) => (
        <div key={v.key} className="fan">
          <div className="fan-who">{profileLabel(v.key, meta.home.name, meta.away.name)}
            <span className={`src ${v.source === "model" ? "src-model" : "src-template"}`}>{v.source === "model" ? `✓ ${Math.round(v.ms)} ms` : "fallback"}</span>
          </div>
          <div className="fan-text" dir={v.key.includes(".ar.") ? "rtl" : undefined}>{v.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ProfilePicker() {
  const profile = useLive((s) => s.profile);
  const meta = useLive((s) => s.meta);
  const [aud, lang, voice] = profile.split(".");
  const set = (a: string, l: string, v: string) => live.send({ type: "profile", key: `${a}.${l}.${v}` });
  if (!meta) return null;
  return (
    <div className="profile">
      <select value={aud} onChange={(e) => set(e.target.value, lang, voice)} aria-label="Audience">
        <option value="casual">Casual fan</option>
        <option value="analyst">Analyst</option>
      </select>
      <select value={lang} onChange={(e) => set(aud, e.target.value, voice)} aria-label="Language">
        {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={voice} onChange={(e) => set(aud, lang, e.target.value)} aria-label="Voice">
        <option value="neutral">Neutral</option>
        <option value="home">{meta.home.name} fan</option>
        <option value="away">{meta.away.name} fan</option>
      </select>
    </div>
  );
}

export function SidePanel() {
  const [tab, setTab] = useState<"feed" | "fans" | "trace" | "metrics">("feed");
  return (
    <aside className="side">
      <nav className="tabs">
        {(["feed", "fans", "trace", "metrics"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "feed" ? "Live feed" : t === "fans" ? "Fans" : t === "trace" ? "Agent trace" : "Metrics"}
          </button>
        ))}
      </nav>
      {tab === "feed" ? <Feed /> : tab === "fans" ? <Fans /> : tab === "trace" ? <Trace /> : <Metrics />}
    </aside>
  );
}

export function Controls() {
  const speed = useLive((s) => s.speed);
  const paused = useLive((s) => s.paused);
  const modelEnabled = useLive((s) => s.modelEnabled);
  const director = useLive((s) => s.director);
  const connected = useLive((s) => s.connected);
  return (
    <div className="controls">
      <button onClick={() => live.send({ type: paused ? "play" : "pause" })}>{paused ? "▶ Play" : "❚❚ Pause"}</button>
      {[1, 2, 5, 10, 20].map((v) => (
        <button key={v} className={speed === v ? "on" : ""} onClick={() => live.send({ type: "speed", value: v })}>{v}×</button>
      ))}
      <span className="sep" />
      <button onClick={() => live.send({ type: "seek", t: 3915 })}>Jump to 65′</button>
      <button onClick={() => live.send({ type: "seek", t: 1780 })}>30′</button>
      <button onClick={() => live.send({ type: "seek", t: 5210 })}>87′</button>
      <span className="sep" />
      <button className={director?.mode !== "manual" ? "on" : ""} onClick={() => live.send({ type: "auto" })}>Auto-director</button>
      <button className={modelEnabled ? "on" : "off"} onClick={() => live.send({ type: "model", enabled: !modelEnabled })}>
        AI model {modelEnabled ? "on" : "off"}
      </button>
      <span className={`conn ${connected ? "up" : "down"}`}>{connected ? "live" : "offline"}</span>
      <span className="hint">Click a player or press Tab to follow · A = auto · Space = pause</span>
    </div>
  );
}
