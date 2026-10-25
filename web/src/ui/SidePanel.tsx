import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { clock, live, STAT_RINGS, useLang, useLive } from "../live/store";
import { isRtl, t as tr } from "../i18n";
import { YourModelPanel } from "./YourModel";
import type { AnswerAction } from "../live/protocol";

const STAGE_LABEL: Record<string, string> = {
  explainer: "Explainer", verifier: "Verifier", "template-check": "Verifier", reviewer: "Reviewer",
  template: "Template", publish: "Publish",
};
const stageLabel = (s: string) => STAGE_LABEL[s] ?? (s.startsWith("personalizer:") ? `Personalizer ${s.split(":")[1].split(".").slice(0, 2).join(" ").toUpperCase()}` : s);

export function Feed() {
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
              <span className={`src src-${f.source}`} title={`${Math.round(f.latency ?? 0)} ms · ${f.evidence.join(", ")}`}>{f.source === "model" ? "AI" : "Stats"}</span>
            ) : (
              <span className="src src-pending">explaining…</span>
            )}
          </div>
          <div className="feed-text">{f.text}</div>
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

/** What an answer lets you do next: open the play it talks about, jump to the moment, follow
 *  the player. Actions come from the tools the agent used, never from its wording. */
function runAction(act: AnswerAction) {
  if (act.type === "play" && act.id) live.showMe(act.id);
  else if (act.type === "moment" && act.minute !== undefined) live.send({ type: "seek", t: Math.max(0, act.minute * 60 - 5) });
  else if (act.type === "player" && act.id) live.send({ type: "select", player: act.id });
}

export function Ask() {
  const answers = useLive((s) => s.answers);
  const lang = useLang();
  const SUGGESTIONS = ["q1", "q2", "q3", "q4", "q5"].map((k) => tr(lang, k));
  const [q, setQ] = useState("");
  const send = (question: string) => {
    if (!question.trim()) return;
    live.send({ type: "ask", id: Math.random().toString(36).slice(2), question });
    setQ("");
  };
  return (
    <div className="ask">
      <div className="answers" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
        {answers.length === 0 && <div className="empty" dir={isRtl(lang) ? "rtl" : undefined}>{tr(lang, "ask_intro")}</div>}
        {[...answers].reverse().map((a) => (
          <div key={a.id} className="answer">
            <div className="q">{a.question}</div>
            {a.pending ? (
              <div className="explaining"><i />{tr(lang, "checking")}</div>
            ) : (
              <>
                <div className={`a ${a.source === "refusal" ? "refusal" : ""}`} dir="auto">{a.text}</div>
                {a.table && (
                  <table className="a-table">
                    <thead><tr>{a.table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                    <tbody>{a.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
                  </table>
                )}
                {a.actions && a.actions.length > 0 && (
                  <div className="a-actions">
                    {a.actions.map((act, i) => (
                      act.type === "play" && a.actions!.findIndex((x) => x.type === "play") === i
                        ? <button key={i} className="a-show" onClick={() => runAction(act)}>▶ Show me<small>{act.label}</small></button>
                        : <button key={i} onClick={() => runAction(act)}>{act.type === "moment" ? "↺ " : act.type === "play" ? "▶ " : ""}{act.label}</button>
                    ))}
                  </div>
                )}
                <div className="a-meta">
                  {a.source === "model" ? <span className="verified">{tr(lang, "verified")}</span> : <span className="src src-template">{tr(lang, "refused")}</span>}
                  <span className="evidence">{(a.tools ?? []).join(" · ")} · {Math.round((a.ms ?? 0) / 100) / 10}s</span>
                  {a.evidence && a.evidence.length > 0 && <span className="evidence">{a.evidence.slice(0, 4).join(" ")}{a.evidence.length > 4 ? " …" : ""}</span>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="ask-foot">
        {answers.length === 0 && <div className="chips">{SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}</div>}
        <form onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr(lang, "ask_ph")} dir={isRtl(lang) ? "rtl" : undefined} />
          <button type="submit">{tr(lang, "ask")}</button>
        </form>
      </div>
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

export function StatRingPicker() {
  const stat = useLive((s) => s.statRing);
  const lang = useLang();
  return (
    <select className="ring-pick" value={stat ?? ""} onChange={(e) => live.setStatRing(e.target.value || null)} aria-label={tr(lang, "rings")}>
      <option value="">{tr(lang, "rings_off")}</option>
      {STAT_RINGS.map((k) => <option key={k} value={k}>{tr(lang, "rings")}: {tr(lang, k)}</option>)}
    </select>
  );
}

/** Audience, language, voice and stat rings in one menu, so the header stays quiet. */
export function ViewMenu({ up = false }: { up?: boolean }) {
  const [open, setOpen] = useState(false);
  const lang = useLang();
  return (
    <div className={`view-menu ${up ? "up" : ""}`}>
      <button className={`switch-view ${open ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>{tr(lang, "view")} <Icon name="chevron" size={14} /></button>
      {open && <div className="fb-pop"><ProfilePicker /><StatRingPicker /></div>}
    </div>
  );
}

/** Every attack so far that ended in a shot; open any one in the play breakdown. */
export function Plays() {
  const plays = useLive((s) => s.plays);
  const meta = useLive((s) => s.meta);
  const lang = useLang();
  const name = (id: string) => meta?.players.find((p) => p.id === id)?.short ?? id;
  const team = (code: string) => (meta?.home.code === code ? meta.home : meta?.away);
  if (!plays.length) return (
    <div className="feed">
      <div className="empty">No shots yet. Every attack that ends in a shot appears here as the match goes on.</div>
      <button className="load-full" onClick={() => live.send({ type: "seek", t: 5395 })}>Load the full match</button>
    </div>
  );
  return (
    <div className="feed plays">
      {[...plays].reverse().map((p) => (
        <button key={p.id} className="play-row" onClick={() => live.breakdown(p.id)}>
          <span className="pr-min">{p.minute}′</span>
          <span className="pr-main">
            <b><i className="team-dot" style={{ ["--team" as string]: team(p.team)?.color }} />{name(p.player)}</b>
            <span>{p.outcome === "goal" ? tr(lang, "bd_goal") : tr(lang, `out_${p.outcome}`)} · xG {p.xg.toFixed(2)}</span>
          </span>
          <span className={`pr-tag ${p.outcome === "goal" ? "goal" : ""}`}>{tr(lang, "bd_open")}</span>
        </button>
      ))}
    </div>
  );
}

/** "Under the hood": how it works, for judges and power users. A drawer from the header. */
export function UnderTheHood({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"fans" | "trace" | "metrics" | "model" | "settings">("settings");
  return (
    <div className="hood-scrim" onClick={onClose}>
      <aside className="hood" onClick={(e) => e.stopPropagation()}>
        <header className="hood-head"><b>Settings</b><button onClick={onClose} aria-label="Close">✕</button></header>
        <nav className="tabs">
          {(["settings", "trace", "fans", "metrics", "model"] as const).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {{ trace: "Agents", fans: "Fans", metrics: "Metrics", model: "Your model", settings: "General" }[t]}
            </button>
          ))}
        </nav>
        <div className="hood-body">
          {tab === "fans" ? <Fans /> : tab === "trace" ? <Trace /> : tab === "model" ? <YourModelPanel /> : tab === "metrics" ? <Metrics /> : <HoodSettings />}
        </div>
      </aside>
    </div>
  );
}

function HoodSettings() {
  const speed = useLive((s) => s.speed);
  const modelEnabled = useLive((s) => s.modelEnabled);
  const director = useLive((s) => s.director);
  const profile = useLive((s) => s.profile);
  const meta = useLive((s) => s.meta);
  const stat = useLive((s) => s.statRing);
  const lang = useLang();
  const [aud, lg, voice] = profile.split(".");
  const set = (a: string, l: string, v: string) => live.send({ type: "profile", key: `${a}.${l}.${v}` });
  return (
    <div className="hood-settings">
      <span className="hs-h">Display</span>
      <div className="hs-row"><div><b>Explanations for</b><span>Casual: plain words. Analyst: the full working.</span></div>
        <select value={aud} onChange={(e) => set(e.target.value, lg, voice)}><option value="casual">Casual fan</option><option value="analyst">Analyst</option></select></div>
      <div className="hs-row"><div><b>Language</b><span>Every line is re-checked in your language</span></div>
        <select value={lg} onChange={(e) => set(aud, e.target.value, voice)}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="hs-row"><div><b>Voice</b><span>Neutral, or as a supporter of one club</span></div>
        <select value={voice} onChange={(e) => set(aud, lg, e.target.value)}><option value="neutral">Neutral</option>{meta && <><option value="home">{meta.home.name} fan</option><option value="away">{meta.away.name} fan</option></>}</select></div>
      <div className="hs-row"><div><b>Stat rings</b><span>Colour every player by a stat</span></div>
        <select value={stat ?? ""} onChange={(e) => live.setStatRing(e.target.value || null)}><option value="">Off</option>{STAT_RINGS.map((k) => <option key={k} value={k}>{tr(lang, k)}</option>)}</select></div>
      <span className="hs-h">Playback and AI</span>
      <div className="hs-row"><div><b>Auto-director</b><span>Moves the ring to the player who matters</span></div>
        <button className={director?.mode !== "manual" ? "on" : ""} onClick={() => live.send({ type: "auto" })}>{director?.mode !== "manual" ? "On" : "Turn on"}</button></div>
      <div className="hs-row"><div><b>AI explanations</b><span>Off: only the engine's checked stats lines air</span></div>
        <button className={modelEnabled ? "on" : ""} onClick={() => live.send({ type: "model", enabled: !modelEnabled })}>{modelEnabled ? "On" : "Off"}</button></div>
      <div className="hs-row"><div><b>Red team</b><span>Plant a false claim and watch the checks block it</span></div>
        <button className="danger" onClick={() => live.send({ type: "redteam" })}>Run</button></div>
      <div className="hs-row"><div><b>Playback speed</b><span>How fast the match plays</span></div>
        <div className="seg-speed">{[0.5, 1, 2, 5, 10, 20].map((v) => <button key={v} className={speed === v ? "on" : ""} onClick={() => live.send({ type: "speed", value: v })}>{v}×</button>)}</div></div>
    </div>
  );
}

/** Ask, as a floating chat: a button bottom-right that opens the conversation. */
export function AskFloat() {
  const [open, setOpen] = useState(false);
  const showMe = useLive((s) => s.showMe);
  useEffect(() => { if (showMe) setOpen(false); }, [showMe]);  // get out of the way of the replay
  return (
    <>
      {open && <div className="askf-drawer"><Ask /></div>}
      <button className={`askf-btn ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>{open ? "✕ Close" : "Ask the match"}</button>
    </>
  );
}

export function Controls() {
  // Simple transport only; switches live under the hood.
  const speed = useLive((s) => s.speed);
  const paused = useLive((s) => s.paused);
  const modelEnabled = useLive((s) => s.modelEnabled);
  const director = useLive((s) => s.director);
  const connected = useLive((s) => s.connected);
  const [settings, setSettings] = useState(false);
  return (
    <div className="controls">
      <span className="c-side" />
      <button className="play-main" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={20} /></button>
      <div className="c-side right">
        <select className="ring-pick" value="" onChange={(e) => e.target.value && live.send({ type: "seek", t: Number(e.target.value) })} aria-label="Jump to">
          <option value="">Jump to…</option>
          <option value="0">Kick-off (watch it unfold)</option>
          <option value="1780">30′ · first goal</option>
          <option value="3915">65′ · sprint and equaliser</option>
          <option value="5210">87′ · late winner</option>
        </select>
        <span className={`conn ${connected ? "up" : "down"}`} title={connected ? "connected" : "offline"} />
      </div>
    </div>
  );
}
