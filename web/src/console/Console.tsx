// Broadcast console: what airs, what was blocked, and who decided. Open with ?view=console.
import { Wordmark } from "../ui/Wordmark";
import { useEffect, useMemo, useRef, useState } from "react";
import { clock } from "../live/store";
import type { CostSummary } from "../live/protocol";

interface Entry {
  id: number;
  ts: number;
  match_t: number | null;
  session: string | null;
  kind: string;
  moment: string | null;
  moment_type: string | null;
  player: string | null;
  text: string | null;
  source: string | null;
  stage: string | null;
  reason: string | null;
  evidence: string[];
  decision: string | null;
  operator: string | null;
  lang: string | null;
}

interface Controls {
  features: Record<string, boolean>;
  allow: Record<string, boolean>;
  approval: "auto" | "manual";
}

const FEATURE_LABELS: Record<string, [string, string]> = {
  ai_lines: ["AI explanations", "Off: only the engine's verified stats lines air"],
  personalization: ["Personalization", "Languages, audiences and club voice"],
  ask: ["Fan Q&A", "Ask answers from match data"],
  alerts: ["Alerts", "Sprint, streak and distance badges"],
  director: ["Auto-director", "Off: the ring holds the current player"],
};

const FILTERS: [string, string][] = [
  ["all", "All"], ["aired", "Aired"], ["blocked", "Blocked"], ["pending", "Approvals"],
  ["answer", "Q&A"], ["redteam", "Red team"],
];

/** Server-wide model usage and estimated cost (all viewers), refreshed every 5 s. */
function useCost() {
  const [cost, setCost] = useState<CostSummary | null>(null);
  useEffect(() => {
    let on = true;
    const load = () => fetch("/api/cost").then((r) => (r.ok ? r.json() : null)).then((c) => on && setCost(c)).catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => { on = false; clearInterval(id); };
  }, []);
  return cost;
}

export function Console() {
  const [controls, setControls] = useState<Controls | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState<Record<number, { entry: Entry; until: number }>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("all");
  const [connected, setConnected] = useState(false);
  const [via, setVia] = useState("app socket");
  const commander = useRef<(msg: object) => void>(() => {});
  const [, tick] = useState(0);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    let sock: WebSocket | null = null;
    let closed = false;
    const handle = (m: any) => {
      if (m.type === "console_hello") {
        setControls(m.controls);
        setEntries(m.recent);
        setCounts(m.counts);
        const now = Date.now();
        setPending(Object.fromEntries(m.pending.filter((e: Entry) => !e.decision).map((e: Entry) => [e.id, { entry: e, until: now + 25000 }])));
      } else if (m.type === "controls") {
        setControls(m.controls);
      } else if (m.type === "audit") {
        setEntries((es) => [m.entry, ...es].slice(0, 400));
        setCounts(m.counts);
      } else if (m.type === "pending") {
        setPending((p) => ({ ...p, [m.entry.id]: { entry: m.entry, until: Date.now() + m.timeout_s * 1000 } }));
        setCounts(m.counts);
        setEntries((es) => [m.entry, ...es].slice(0, 400));
      } else if (m.type === "decided") {
        setPending((p) => { const n = { ...p }; delete n[m.id]; return n; });
        setEntries((es) => es.map((e) => (e.id === m.id ? m.entry : e)));
        setCounts(m.counts);
      }
    };
    (async () => {
      // In the cloud, console events fan out through Azure Web PubSub; locally, the app socket.
      const neg = await fetch("/api/console/negotiate").then((r) => r.json()).catch(() => ({ url: null }));
      if (closed) return;
      if (neg.url) {
        setVia("Azure Web PubSub");
        handle(await fetch("/api/console/snapshot").then((r) => r.json()));
        sock = new WebSocket(neg.url);
        commander.current = (msg) => fetch("/api/console/command", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msg) });
      } else {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        sock = new WebSocket(`${proto}://${location.host}/ws/console`);
        commander.current = (msg) => sock?.readyState === WebSocket.OPEN && sock.send(JSON.stringify(msg));
      }
      ws.current = sock;
      sock.onopen = () => setConnected(true);
      sock.onclose = () => setConnected(false);
      sock.onmessage = (ev) => handle(JSON.parse(ev.data));
    })();
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => { closed = true; clearInterval(id); sock?.close(); };
  }, []);

  const send = (msg: object) => commander.current(msg);
  const patch = (p: object) => send({ type: "controls", patch: p });
  const decide = (id: number, approve: boolean) => send({ type: "decide", id, approve, operator: "producer" });

  const shown = useMemo(
    () => entries.filter((e) => filter === "all" || e.kind === filter || (filter === "pending" && (e.kind === "pending" || e.decision))),
    [entries, filter],
  );
  const queue = Object.values(pending).sort((a, b) => a.entry.id - b.entry.id);
  const aired = counts.aired ?? 0, blocked = counts.blocked ?? 0;
  const cost = useCost();

  return (
    <div className="console">
      <header className="top">
        <div className="brand"><Wordmark suffix="Broadcast console" /></div>
        <div className="fixture">Every line on air, every line blocked, and who decided.</div>
        <a className="switch-view" href="/" target="_blank" rel="noreferrer">Open viewer ↗</a>
        <span className={`conn ${connected ? "up" : "down"}`}>{connected ? `connected · ${via}` : "offline"}</span>
      </header>

      <div className="c-stats">
        <div><b>{aired}</b><span>lines aired</span></div>
        <div><b className="bad">{blocked}</b><span>lines blocked</span></div>
        <div><b>{queue.length}</b><span>awaiting approval</span></div>
        <div><b>{(counts.pending ?? 0)}</b><span>sent for approval</span></div>
        <div><b>{counts.answer ?? 0}</b><span>fan questions</span></div>
        <div><b>{counts.redteam ?? 0}</b><span>red-team attacks</span></div>
        {cost && <div title={`${cost.calls} model calls · ${cost.tokens.toLocaleString()} tokens · ${cost.prices}`}><b>${cost.usd.toFixed(cost.usd < 1 ? 3 : 2)}</b><span>AI cost (est.) · {cost.calls} calls · {cost.cache_pct}% cached</span></div>}
      </div>

      <div className="c-grid">
        <section className="c-panel">
          <h3>On-air controls</h3>
          {controls && (
            <>
              <div className="c-group">
                <div className="c-label">Approval mode</div>
                <div className="seg">
                  <button className={controls.approval === "auto" ? "on" : ""} onClick={() => patch({ approval: "auto" })}>Auto (verified lines air)</button>
                  <button className={controls.approval === "manual" ? "on" : ""} onClick={() => patch({ approval: "manual" })}>Manual (human approves)</button>
                </div>
              </div>
              <div className="c-group">
                <div className="c-label">Kill switches</div>
                {Object.entries(FEATURE_LABELS).map(([k, [label, hint]]) => (
                  <label key={k} className="toggle">
                    <input type="checkbox" checked={controls.features[k]} onChange={(e) => patch({ features: { [k]: e.target.checked } })} />
                    <span className="knob" />
                    <span className="t-text"><b>{label}</b><em>{hint}</em></span>
                  </label>
                ))}
              </div>
              <div className="c-group">
                <div className="c-label">Insight allowlist</div>
                <div className="allow">
                  {Object.entries(controls.allow).map(([k, v]) => (
                    <label key={k} className={v ? "on" : ""}>
                      <input type="checkbox" checked={v} onChange={(e) => patch({ allow: { [k]: e.target.checked } })} />
                      {k.replace(/_/g, " ")}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>

        <section className="c-panel">
          <h3>Approval queue {controls?.approval === "manual" ? "" : <em className="dim">(manual mode is off)</em>}</h3>
          {queue.length === 0 && <div className="empty">Nothing waiting. In manual mode, every verified AI line stops here until a producer approves it; unanswered lines expire and never air.</div>}
          {queue.map(({ entry, until }) => {
            const left = Math.max(0, until - Date.now());
            return (
              <div key={entry.id} className="approval">
                <div className="ap-head">
                  <span>{entry.match_t != null ? clock(entry.match_t) : ""} · {entry.moment_type?.replace(/_/g, " ")} · {entry.player}</span>
                  <span className="verified">✓ verified by code + reviewer</span>
                </div>
                <div className="ap-text">{entry.text}</div>
                <div className="ap-evidence">{entry.evidence.join(" · ")}</div>
                <div className="ap-bar"><i style={{ width: `${(left / 25000) * 100}%` }} /></div>
                <div className="ap-actions">
                  <button className="approve" onClick={() => decide(entry.id, true)}>✓ Air it</button>
                  <button className="reject" onClick={() => decide(entry.id, false)}>✕ Hold back</button>
                  <span className="dim">{Math.ceil(left / 1000)} s</span>
                </div>
              </div>
            );
          })}
        </section>

        <section className="c-panel c-audit">
          <h3>Audit log <em className="dim">persisted · every entry carries its evidence</em></h3>
          <nav className="tabs small">
            {FILTERS.map(([k, label]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{label}</button>)}
          </nav>
          <div className="audit-list">
            {shown.length === 0 && <div className="empty">Entries appear as the match plays in any open viewer.</div>}
            {shown.map((e) => (
              <div key={e.id} className={`audit-row k-${e.kind}`}>
                <div className="ar-head">
                  <span className={`kind k-${e.kind}`}>{e.kind}{e.decision ? ` · ${e.decision}` : ""}</span>
                  <span className="dim">{e.match_t != null ? clock(e.match_t) : ""}</span>
                  {e.moment_type && <span>{e.moment_type.replace(/_/g, " ")}</span>}
                  {e.player && <span className="feed-player">{e.player}</span>}
                  <span className="dim">{[e.source, e.stage, e.lang].filter(Boolean).join(" · ")}</span>
                </div>
                <div className={`ar-text ${e.kind === "blocked" || e.kind === "redteam" ? "struck" : ""}`}>{e.text}</div>
                {e.reason && <div className="ar-reason">✕ {e.reason}</div>}
                {e.evidence.length > 0 && <div className="ar-evidence">{e.evidence.slice(0, 6).join(" · ")}{e.evidence.length > 6 ? " …" : ""}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
