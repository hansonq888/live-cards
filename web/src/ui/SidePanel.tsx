import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { clock, live, STAT_RINGS, useLang, useLive } from "../live/store";
import { isRtl, t as tr } from "../i18n";
import { YourModelPanel } from "./YourModel";
import type { AnswerAction } from "../live/protocol";


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

function Metrics() {
  const m = useLive((s) => s.metrics);
  if (!m) return <div className="empty">Waiting for data…</div>;
  const secs = (ms: number | null | undefined) => (ms != null ? `${(ms / 1000).toFixed(1)} s` : "–");
  return (
    <div className="metrics">
      <div className="metric-grid">
        <div><b>{m.claims_checked}</b><span>lines checked</span></div>
        <div><b>{m.blocked}</b><span>lines blocked</span></div>
        <div><b className={m.aired_unverified === 0 ? "ok" : "bad"}>{m.aired_unverified}</b><span>unchecked lines shown</span></div>
        <div><b>{secs(m.latency_p50_ms)}</b><span>typical time to explain</span></div>
        <div><b>{secs(m.latency_p95_ms)}</b><span>slowest 1 in 20</span></div>
        <div><b>{m.model_lines} · {m.template_lines}</b><span>AI lines · stats lines</span></div>
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
  else if (act.type === "moment" && act.minute !== undefined) live.seekTo(act.minute * 60 - 5);
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

/** Stat rings on the video: a small "Colour by" button that opens the options; while a stat is
 *  on it shows which, with ✕ to turn it off. Hover a player for their value. */
export function StatChips() {
  const stat = useLive((s) => s.statRing);
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const pick = (k: string | null) => { live.setStatRing(k); setOpen(false); };
  return (
    <div className={`stat-chips ${open ? "open" : ""} ${stat ? "active" : ""}`}>
      {!open && (stat ? (
        <>
          <button className="sc-toggle on" onClick={() => setOpen(true)}>Colour: {tr(lang, stat)}</button>
          <button className="sc-x" onClick={() => pick(null)} aria-label="Turn off stat colours">✕</button>
        </>
      ) : <button className="sc-toggle" onClick={() => setOpen(true)}>◐ Colour by</button>)}
      {open && (
        <div role="radiogroup" aria-label="Colour every player by a stat" className="sc-opts">
          {STAT_RINGS.map((k) => (
            <button key={k} className={stat === k ? "on" : ""} onClick={() => pick(k)} role="radio" aria-checked={stat === k}>{tr(lang, k)}</button>
          ))}
          {stat && <button onClick={() => pick(null)}>Off</button>}
          <button className="sc-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}

/** "Under the hood": how it works, for judges and power users. A drawer from the header. */
export function UnderTheHood({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"fans" | "metrics" | "model" | "settings">("settings");
  return (
    <div className="hood-scrim" onClick={onClose}>
      <aside className="hood" onClick={(e) => e.stopPropagation()}>
        <header className="hood-head"><b>Settings</b><button onClick={onClose} aria-label="Close">✕</button></header>
        <nav className="tabs">
          {(["settings", "model", "fans", "metrics"] as const).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {{ fans: "One moment, four fans", metrics: "Checks & speed", model: "Your model", settings: "General" }[t]}
            </button>
          ))}
        </nav>
        <div className="hood-body">
          {tab === "fans" ? <><p className="hs-intro">The same verified moment, written for four different fans: plain or analytical, in their language, from their club's side. Every version is checked again before it airs.</p><Fans /></>
            : tab === "model" ? <YourModelPanel />
            : tab === "metrics" ? <><p className="hs-intro">How the checks are doing right now: lines checked and blocked, unverified lines that reached the screen (should always be 0), and how fast explanations arrive.</p><Metrics /></>
            : <HoodSettings />}
        </div>
      </aside>
    </div>
  );
}

function HoodSettings() {
  const modelEnabled = useLive((s) => s.modelEnabled);
  const profile = useLive((s) => s.profile);
  const meta = useLive((s) => s.meta);
  const [aud, lg, voice] = profile.split(".");
  const set = (a: string, l: string, v: string) => live.send({ type: "profile", key: `${a}.${l}.${v}` });
  return (
    <div className="hood-settings">
      <p className="hs-note">Playback speed, stat rings and the auto-director are in the ⚙ menu on the video.</p>
      <span className="hs-h">Display</span>
      <div className="hs-row"><div><b>Explanations for</b><span>Casual: plain words. Analyst: the full working.</span></div>
        <select value={aud} onChange={(e) => set(e.target.value, lg, voice)}><option value="casual">Casual fan</option><option value="analyst">Analyst</option></select></div>
      <div className="hs-row"><div><b>Language</b><span>Every line is re-checked in your language</span></div>
        <select value={lg} onChange={(e) => set(aud, e.target.value, voice)}>{Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="hs-row"><div><b>Voice</b><span>Neutral, or as a supporter of one club</span></div>
        <select value={voice} onChange={(e) => set(aud, lg, e.target.value)}><option value="neutral">Neutral</option>{meta && <><option value="home">{meta.home.name} fan</option><option value="away">{meta.away.name} fan</option></>}</select></div>
      <span className="hs-h">AI</span>
      <p className="hs-note">To watch the agents work, or plant a false claim and see it blocked, open the Agents tab under the video.</p>
      <div className="hs-row"><div><b>AI explanations</b><span>Off: only the engine's checked stats lines air</span></div>
        <button className={modelEnabled ? "on" : ""} onClick={() => live.send({ type: "model", enabled: !modelEnabled })}>{modelEnabled ? "On" : "Off"}</button></div>
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
  const keys = useLive((s) => s.keyMoments);
  const goals = keys.filter((k) => k.type === "goal");  // this match's goals, whichever match it is
  const [settings, setSettings] = useState(false);
  return (
    <div className="controls">
      <span className="c-side" />
      <button className="play-main" onClick={() => live.send({ type: paused ? "play" : "pause" })} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={20} /></button>
      <div className="c-side right">
        <select className="ring-pick" value="" onChange={(e) => e.target.value && live.seekTo(Number(e.target.value))} aria-label="Jump to">
          <option value="">Jump to…</option>
          <option value="0">Kick-off (watch it unfold)</option>
          {goals.map((g) => <option key={g.id} value={Math.max(0, Math.round(g.t - 25))}>{Math.floor(g.t / 60) + 1}′ · {g.label}</option>)}
        </select>
        <span className={`conn ${connected ? "up" : "down"}`} title={connected ? "connected" : "offline"} />
      </div>
    </div>
  );
}

const SPEEDS = [0.5, 1, 2, 5, 10, 20];

/** Viewing settings, YouTube-style: a gear on the video opens a menu of rows, each row opens
 *  its own list of choices. */
export function ViewerSettings() {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<null | "speed" | "rings" | "level" | "lang">(null);
  const speed = useLive((s) => s.speed);
  const stat = useLive((s) => s.statRing);
  const director = useLive((s) => s.director);
  const profile = useLive((s) => s.profile);
  const lang = useLang();
  const [aud, lg, voice] = profile.split(".");
  const setProfile = (a: string, l: string) => live.send({ type: "profile", key: `${a}.${l}.${voice}` });
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".vset")) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const auto = director?.mode !== "manual";
  const pick = <T,>(label: string, options: [T, string][], cur: T, on: (v: T) => void) => (
    <div className="vset-menu">
      <button className="vset-back" onClick={() => setSub(null)}><Icon name="back" size={14} />{label}</button>
      {options.map(([v, l]) => (
        <button key={String(v)} className={`vset-opt ${v === cur ? "on" : ""}`} onClick={() => { on(v); setSub(null); }}>
          <span className="vset-tick">{v === cur ? "✓" : ""}</span>{l}
        </button>
      ))}
    </div>
  );
  return (
    <div className="vset">
      <button className={`vset-gear ${open ? "open" : ""}`} onClick={() => { setOpen((o) => !o); setSub(null); }} aria-label="Viewing settings" title="Viewing settings">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && !sub && (
        <div className="vset-menu">
          <button className="vset-row" onClick={() => live.send({ type: "auto" })} disabled={auto}>
            <span>Auto-director</span><em className={`vset-switch ${auto ? "on" : ""}`}><i /></em>
          </button>
          <button className="vset-row" onClick={() => setSub("rings")}><span>Stat rings</span><em>{stat ? tr(lang, stat) : "Off"} ›</em></button>
          <button className="vset-row" onClick={() => setSub("level")}><span>Explanations</span><em>{aud === "analyst" ? "Analyst" : "Casual"} ›</em></button>
          <button className="vset-row" onClick={() => setSub("lang")}><span>Language</span><em>{LANGS[lg] ?? lg} ›</em></button>
          <button className="vset-row" onClick={() => setSub("speed")}><span>Playback speed</span><em>{speed === 1 ? "Normal" : `${speed}×`} ›</em></button>
        </div>
      )}
      {open && sub === "speed" && pick("Playback speed", SPEEDS.map((v) => [v, v === 1 ? "Normal" : `${v}×`] as [number, string]), speed, (v) => live.send({ type: "speed", value: v }))}
      {open && sub === "rings" && pick("Stat rings", [["", "Off"] as [string, string], ...STAT_RINGS.map((k) => [k, tr(lang, k)] as [string, string])], stat ?? "", (v) => live.setStatRing(v || null))}
      {open && sub === "level" && pick("Explanations", [["casual", "Casual fan"], ["analyst", "Analyst"]] as [string, string][], aud, (v) => setProfile(v, lg))}
      {open && sub === "lang" && pick("Language", Object.entries(LANGS) as [string, string][], lg, (v) => setProfile(aud, v))}
    </div>
  );
}
