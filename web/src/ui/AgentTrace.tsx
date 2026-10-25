// Agents, live: every moment as a row that fills in as each agent finishes it (Explainer,
// code Verifier, Reviewer, rewrites, safe fallback, Personalizer fan-out), with the time to
// air, plus what the AI cost this session. Everything comes from the server's trace messages
// and its token ledger; nothing here is estimated in the browser.
import { live, useLive, type TraceItem } from "../live/store";
import type { TraceStep } from "../live/protocol";

const AGENT: Record<string, [string, string]> = {
  explainer: ["Explainer", "gpt-4.1-mini"], verifier: ["Verifier", "code"], reviewer: ["Reviewer", "gpt-5-mini"],
  publish: ["Aired", ""], template: ["Safe template", "code"], "template-check": ["Stats line", "code"],
  cache: ["Reused", "cache"],
};

function label(stage: string): [string, string] {
  if (stage.startsWith("personalizer:")) {
    const [, lang] = stage.split(":")[1].split(".");
    return [lang ? lang.toUpperCase() : "Variant", "Personalizer"];
  }
  return AGENT[stage] ?? [stage, ""];
}

const fmtMs = (s: TraceStep) =>
  s.stage === "verifier" || s.stage === "template-check" ? (s.ms < 1 ? "<1 ms" : `${s.ms.toFixed(1)} ms`)
    : s.ms ? (s.ms >= 1000 ? `${(s.ms / 1000).toFixed(1)} s` : `${Math.round(s.ms)} ms`) : "";

function Row({ t }: { t: TraceItem }) {
  const meta = useLive((s) => s.meta);
  const who = meta?.players.find((p) => p.id === t.player)?.short;
  const main = t.steps.filter((s) => !s.stage.startsWith("personalizer:"));
  const fan = t.steps.filter((s) => s.stage.startsWith("personalizer:"));
  const rejected = t.steps.filter((s) => s.outcome === "rejected" || s.outcome === "blocked");
  const red = t.type.startsWith("red team");
  return (
    <div className={`at-row ${red ? "red" : ""}`}>
      <div className="at-top">
        <b>{t.type.replace(/_/g, " ")}{who ? ` · ${who}` : ""}</b>
        {t.aired?.ms != null && <span className="at-time">aired in {(t.aired.ms / 1000).toFixed(1)} s</span>}
      </div>
      <div className="at-steps">
        {main.map((s, i) => {
          const [name, model] = label(s.stage);
          return (
            <span key={i} className="at-wrap">
              {i > 0 && <i className="at-arrow">→</i>}
              <span className={`at-step o-${s.outcome}`} title={s.detail || undefined}>
                <b>{name}{s.attempt > 0 && s.stage === "explainer" ? " · rewrite" : ""}</b>
                <em>{[model, s.outcome === "ok" ? "" : s.outcome, fmtMs(s)].filter(Boolean).join(" · ")}</em>
              </span>
            </span>
          );
        })}
        {fan.length > 0 && <i className="at-arrow">→</i>}
        {fan.map((s, i) => {
          const [name] = label(s.stage);
          return <span key={`f${i}`} className={`at-step small o-${s.outcome}`} title={s.detail || "Personalizer, re-verified"}><b>{name}</b></span>;
        })}
      </div>
      {rejected.map((s, i) => <div key={i} className="at-why">✕ {label(s.stage)[0]} rejected: {s.detail}</div>)}
      {t.aired?.text && <p className="at-line">“{t.aired.text}”{t.aired.source !== "model" && <span> · stats line</span>}</p>}
    </div>
  );
}

export function AgentTrace() {
  const traces = useLive((s) => s.traces);
  const m = useLive((s) => s.metrics);
  const modelOn = useLive((s) => s.modelEnabled);
  const cost = m?.cost;
  const rewrites = m?.rewrites ?? 0;
  return (
    <div className="at">
      <div className="at-stats">
        <div><b>{m?.moments ?? 0}</b><span>moments</span></div>
        <div><b>{m?.claims_checked ?? 0}</b><span>lines checked</span></div>
        <div><b>{m?.blocked ?? 0}</b><span>rejected</span></div>
        <div><b>{rewrites}</b><span>fixed by a rewrite</span></div>
        <div className="good"><b>{m?.aired_unverified ?? 0}</b><span>unverified aired</span></div>
        <div><b>{m?.latency_p50_ms != null ? `${(m.latency_p50_ms / 1000).toFixed(1)} s` : "–"}</b><span>median to air</span></div>
        <button className="at-red" onClick={() => live.send({ type: "redteam" })} title="Plant a false claim in the next explanation and watch the checks catch it">Plant a lie</button>
      </div>
      {cost && cost.calls + cost.cache_hits > 0 && (
        <div className="at-cost">
          <span className="at-cost-h">AI cost this session</span>
          <b>${cost.usd < 0.01 ? cost.usd.toFixed(4) : cost.usd.toFixed(2)}</b>
          <span>{cost.calls} model calls · {(cost.tokens / 1000).toFixed(1)}k tokens · {cost.cache_pct}% reused from cache</span>
          <span className="at-agents">{Object.entries(cost.by_agent).map(([k, v]) => <i key={k}>{k} ${v.usd.toFixed(4)}</i>)}</span>
          <em>Estimated from {cost.prices}; token counts are exact.</em>
        </div>
      )}
      {!modelOn && <p className="at-note">AI lines are off, so moments show the code-checked stats line only.</p>}
      {traces.length === 0
        ? <p className="at-note">Rows appear here as moments happen. Press play, or jump to a goal on the timeline.</p>
        : <div className="at-list">{traces.map((t) => <Row key={`${t.moment}-${t.type}`} t={t} />)}</div>}
    </div>
  );
}
