import { useEffect, useRef, useState } from "react";
import { clock, live, useLang, useLive } from "../live/store";
import { directorReason, isRtl, statsLine, stepCaption, storyLine, t as tr, type Lang } from "../i18n";
import { AnalystCard, TeamStrip } from "./Analyst";

const STORY_TYPES = new Set(["goal", "rating_upgrade", "rating_downgrade", "big_chance", "momentum_swing", "fastest_sprint", "attr_upgrade", "attr_downgrade"]);

const ATTRS = ["pace", "passing", "threat", "defending", "engine"];

function useLangFrom(profile: string): Lang {
  return (profile.split(".")[1] as Lang) || "en";
}

function useTicker(ms = 250) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return performance.now();
}

/** Animate a number toward its target (count-up on upgrades). */
function useAnimated(value: number, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    if (a === b) return;
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [value, ms]);
  return shown;
}

export function ScoreBug() {
  const meta = useLive((s) => s.meta);
  const team = useLive((s) => s.team);
  const t = useLive((s) => s.t);
  if (!meta) return null;
  const sc = team?.score ?? { [meta.home.code]: 0, [meta.away.code]: 0 };
  return (
    <div className="bug">
      <div className="team" style={{ background: meta.home.color }}>{meta.home.code}</div>
      <div className="score">{sc[meta.home.code]} – {sc[meta.away.code]}</div>
      <div className="team" style={{ background: meta.away.color }}>{meta.away.code}</div>
      <div className="clock">{clock(t)}</div>
    </div>
  );
}

export function PlayerCard() {
  const meta = useLive((s) => s.meta);
  const director = useLive((s) => s.director);
  const cards = useLive((s) => s.cards);
  const lines = useLive((s) => s.lines);
  const pending = useLive((s) => s.pending);
  const profile = useLive((s) => s.profile);
  const modelEnabled = useLive((s) => s.modelEnabled);
  const upgrades = useLive((s) => s.upgrades);
  const now = useTicker();
  const pid = director?.target;
  const card = pid ? cards[pid] : undefined;
  const rating = useAnimated(card?.rating ?? 6.0);
  if (!meta || !pid || !card) return null;
  if (profile.startsWith("analyst.")) return <><AnalystCard pid={pid} /><TeamStrip /></>;
  const p = meta.players.find((x) => x.id === pid)!;
  const team = p.team === meta.home.code ? meta.home : meta.away;
  const up = upgrades[pid];
  const fresh = up && now - up.at < 5000;
  const isUp = fresh && up.to >= up.from;
  const line = lines[pid];
  const waiting = !line && pending[pid] && now - pending[pid].at < 6000;
  const personal = profile !== "casual.en.neutral";
  const variant = line && personal ? line.variants[profile] : undefined;
  const lang = useLangFrom(profile);
  // Until the verified AI line in your language arrives, show the stats line in your language
  // (rendered from the engine's facts), never a line in a language you didn't pick.
  const localStats = line ? statsLine(lang, line.type, line.facts ?? {}, p.short, line.text, meta.home.code, meta.away.code) : "";
  const shown = variant && variant.source === "model" ? variant.text : lang === "en" ? line?.text : localStats;
  const rtl = isRtl(lang);
  const storyComing = line?.phase === "instant" && modelEnabled && STORY_TYPES.has(line.type) && now - line.at < 6000;
  const translating = personal && line?.phase === "story" && !variant && now - line.at < 6000;
  return (
    <div className={`card ${fresh ? (isUp ? "card-up" : "card-down") : ""}`} style={{ ["--team" as string]: team.color }}>
      <div className="card-top">
        <div className="card-rating">
          {rating.toFixed(1)}
          {fresh && <span className={`delta ${isUp ? "up" : "down"}`}>{isUp ? "▲" : "▼"} {up.label === "Rating" ? Math.abs(up.to - up.from).toFixed(1) : `${tr(lang, up.label)} ${Math.abs(up.to - up.from)}`}</span>}
        </div>
        <div className="card-id">
          <div className="card-name">
            <span className="first">{p.name.split(" ").slice(0, -1).join(" ")}</span>
            <span className="last">{p.name.split(" ").slice(-1)[0]}</span>
          </div>
          <div className="card-meta"><i className="team-dot" />{p.position} · #{p.number}</div>
        </div>
      </div>
      <div className="attrs">
        {ATTRS.map((k) => {
          const label = tr(lang, k);
          const v = card.attrs[k] ?? 0;
          const hot = fresh && up.label === k;
          return (
            <div key={k} className={`attr ${hot ? (isUp ? "attr-hot" : "attr-cold") : ""}`}>
              <span className="attr-label">{label}</span>
              <span className="attr-bar"><i style={{ width: `${v}%` }} /></span>
              <b>{v}</b>
            </div>
          );
        })}
      </div>
      <div className="reason">
        {waiting ? (
          <span className="explaining"><i />{tr(lang, "explaining")}</span>
        ) : line ? (
          <>
            <span className={`reason-text ${line.phase === "instant" && !(variant?.source === "model") ? "instant" : ""}`} dir={rtl ? "rtl" : undefined}>{shown}</span>
            <span className="reason-meta">
              <span className="verified" title={`${line.evidence.length} ${tr(lang, "evidence")}: ${line.evidence.join(", ")}`}>{tr(lang, "verified")}</span>
              <span className={`src src-${variant?.source === "model" ? "model" : line.source}`}>{variant?.source === "model" ? `${tr(lang, "ai")} · ${lang.toUpperCase()}` : line.source === "model" && lang === "en" ? tr(lang, "ai") : tr(lang, "stats")}</span>
              {storyComing && <span className="coming"><i />{tr(lang, "ai_checking")}</span>}
              {translating && <span className="coming"><i />{tr(lang, "lang_checking", { L: lang.toUpperCase() })}</span>}
            </span>
          </>
        ) : (
          <span className="reason-text dim" dir={rtl ? "rtl" : undefined}>{lang === "en" && card.reason ? card.reason : tr(lang, "card_intro")}</span>
        )}
      </div>
    </div>
  );
}

export function DirectorTicker() {
  const director = useLive((s) => s.director);
  const lang = useLang();
  const now = useTicker();
  if (!director) return null;
  const fresh = now - director.at < 1500;
  const label = director.mode === "replay" ? "replay" : director.mode === "manual" ? "your_pick" : director.predicted ? "predicted" : "auto";
  return (
    <div className={`director ${fresh ? "director-fresh" : ""} ${director.predicted ? "director-predict" : ""}`}>
      <span className="director-label">{tr(lang, label)}</span>
      <span className="director-reason" dir={isRtl(lang) ? "rtl" : undefined}>{directorReason(lang, director.key, director.args, director.reason)}</span>
    </div>
  );
}

export function RedTeamPanel() {
  const rt = useLive((s) => s.redteam);
  const now = useTicker(200);
  if (!rt || now - rt.at > 14000) return null;
  if (rt.stage === "unavailable") return <div className="redteam"><div className="rt-title">RED TEAM</div><div className="rt-row">Nothing to attack yet: wait for an explained moment.</div></div>;
  const layer = rt.blockedBy === "reviewer" ? "Reviewer (gpt-5-mini)" : "Verifier (code)";
  return (
    <div className="redteam">
      <div className="rt-title">RED TEAM · {rt.mode === "event" ? "made-up event" : "made-up number"}</div>
      {rt.stage === "started" ? (
        <div className="rt-row rt-wait"><i />Injecting a false claim into the Explainer…</div>
      ) : (
        <>
          <div className="rt-row rt-lie"><b>INJECTED</b>{rt.injected}</div>
          <div className="rt-row rt-block"><b>✕ BLOCKED</b>by {layer}: {rt.reason}</div>
          <div className="rt-row rt-ok"><b>✓ AIRED</b>{rt.aired ?? "nothing (no verified line)"}</div>
        </>
      )}
    </div>
  );
}

export function RevisitBadge() {
  const revisit = useLive((s) => s.revisit);
  const lang = useLang();
  if (!revisit) return null;
  return <div className="revisit-badge">{tr(lang, "revisit")} · {clock(revisit.t)} · {revisit.label}</div>;
}

export function GoalBanner() {
  const banner = useLive((s) => s.banner);
  const lang = useLang();
  const now = useTicker(200);
  if (!banner || now - banner.at > 4500) return null;
  return (
    <div className="goal-banner">
      <div className="goal-word">{tr(lang, "goal")}</div>
      <div className="goal-sub">{banner.sub}</div>
    </div>
  );
}

/** "How the goal was built": steps tick off as the replay passes them. */
export function BuildUpPanel() {
  const b = useLive((s) => s.buildup);
  const t = useLive((s) => s.t);
  const lang = useLang();
  const now = useTicker(200);
  useEffect(() => { live.stepBuildup(t); }, [t]);
  if (!b || (!b.playing && now - b.at > 60000)) return null;
  const cur = [...b.steps].reverse().find((s) => s.t <= t);
  // Story: the AI line in your language if it passed the checks; else the facts-based line.
  const aiStory = lang === "en" ? (b.storySource === "model" ? b.story : null) : b.localized;
  const story = aiStory ?? storyLine(lang, b.storyArgs, b.story);
  return (
    <div className="buildup" dir={isRtl(lang) ? "rtl" : undefined}>
      <div className="bu-title">{tr(lang, "how_built")}</div>
      <div className="bu-story">{story}{aiStory && <span className="verified"> {tr(lang, "verified")}</span>}</div>
      <ol>
        {b.steps.map((s, i) => (
          <li key={i} className={`bu-${s.kind} ${s.t <= t ? "done" : ""} ${s === cur ? "cur" : ""}`}>
            <span className="bu-time">{(s.t - b.goalT).toFixed(1)}s</span>{stepCaption(lang, s)}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ExplainGoalButton({ className = "" }: { className?: string }) {
  const keys = useLive((s) => s.keyMoments);
  const t = useLive((s) => s.t);
  const lang = useLang();
  const goals = keys.filter((k) => k.type === "goal" && k.t <= t + 1);
  if (!goals.length) return null;
  return <button className={`explain-goal ${className}`} onClick={() => live.explainGoal()}>{tr(lang, "explain_goal")}</button>;
}
