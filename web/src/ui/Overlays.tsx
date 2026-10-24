import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { clock, live, useLang, useLive } from "../live/store";
import { directorReason, isRtl, statsLine, stepCaption, stepMeaning, storyLine, t as tr, type Lang } from "../i18n";
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

/** Form in words, from the engine's rating (code, never the model): what a fan wants to know
 *  instead of a number. Levels 0-4: struggling, quiet, steady, playing well, on fire. */
export function formLevel(rating: number): number {
  return rating >= 8.0 ? 4 : rating >= 7.0 ? 3 : rating >= 6.3 ? 2 : rating >= 5.6 ? 1 : 0;
}

function FormMeter({ level }: { level: number }) {
  return (
    <span className={`form-meter f${level}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= level ? "on" : ""} />)}
    </span>
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
  const [numbers, setNumbers] = useState(false);
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
  const level = formLevel(card.rating);
  // The story is the point; the numbers are one tap away. While the AI story is being written
  // and checked, say so instead of flashing the raw stats line.
  const story = waiting || storyComing
    ? <span className="explaining"><i />{tr(lang, "explaining")}</span>
    : line
      ? <span className="story-text" dir={rtl ? "rtl" : undefined}>{shown}</span>
      : <span className="story-text dim" dir={rtl ? "rtl" : undefined}>{lang === "en" && card.reason ? card.reason : tr(lang, "card_intro")}</span>;
  return (
    <div className={`card ${fresh ? (isUp ? "card-up" : "card-down") : ""}`} style={{ ["--team" as string]: team.color }}>
      <div className="card-name">
        <span className="first">{p.name.split(" ").slice(0, -1).join(" ")}</span>
        <span className="last">{p.name.split(" ").slice(-1)[0]}</span>
      </div>
      <div className="card-meta"><i className="team-dot" />{p.position} · #{p.number}</div>
      <div className={`form ${fresh ? (isUp ? "form-up" : "form-down") : ""}`}>
        <FormMeter level={level} />
        <span className="form-word">{tr(lang, `form_${level}`)}</span>
      </div>
      <div className="story">{story}</div>
      <div className="card-foot">
        {line && !storyComing && !waiting ? (
          <span className="verified" title={`${line.evidence.length} ${tr(lang, "evidence")}: ${line.evidence.join(", ")}`}>
            {tr(lang, "checked")}{translating ? ` · ${tr(lang, "lang_checking", { L: lang.toUpperCase() })}` : ""}
          </span>
        ) : <span />}
        <button className="numbers-btn" onClick={() => setNumbers((n) => !n)} aria-expanded={numbers}>{tr(lang, numbers ? "hide_numbers" : "numbers")}</button>
      </div>
      {numbers && (
        <div className="numbers">
          <div className="numbers-rating">
            <b>{rating.toFixed(1)}</b><span>{tr(lang, "rating")}</span>
            {fresh && <em className={`delta ${isUp ? "up" : "down"}`}>{isUp ? "▲" : "▼"} {up.label === "Rating" ? Math.abs(up.to - up.from).toFixed(1) : `${tr(lang, up.label)} ${Math.abs(up.to - up.from)}`}</em>}
          </div>
          <div className="attrs">
            {ATTRS.map((k) => {
              const v = card.attrs[k] ?? 0;
              const hot = fresh && up.label === k;
              return (
                <div key={k} className={`attr ${hot ? (isUp ? "attr-hot" : "attr-cold") : ""}`}>
                  <span className="attr-label">{tr(lang, k)}</span>
                  <span className="attr-bar"><i style={{ width: `${v}%` }} /></span>
                  <b>{v}</b>
                </div>
              );
            })}
          </div>
          {line && line.phase === "instant" && <div className="numbers-line">{lang === "en" ? line.text : localStats}</div>}
        </div>
      )}
    </div>
  );
}

export function DirectorTicker() {
  const director = useLive((s) => s.director);
  const breakdown = useLive((s) => s.buildup);
  const lang = useLang();
  const now = useTicker();
  if (!director || breakdown) return null;  // during a breakdown the panel says what's happening
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
  const breakdown = useLive((s) => s.buildup);
  const lang = useLang();
  if (!revisit) return null;
  return (
    <div className="revisit-badge">
      <span className="rv-tag">{tr(lang, "revisit")}</span>
      <span className="rv-time">{clock(revisit.t)}</span>
      <span>{revisit.label}</span>
      {revisit.play && !breakdown && <button className="rv-break" onClick={() => live.breakdown(revisit.play!)}>{tr(lang, "bd_open")}</button>}
      <button onClick={() => live.backToLive()}>{tr(lang, "back_live")}</button>
    </div>
  );
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
  const showSpace = useLive((s) => s.showSpace);
  const t = useLive((s) => s.t);
  const paused = useLive((s) => s.paused);
  const meta = useLive((s) => s.meta);
  const lang = useLang();
  useEffect(() => { live.stepBuildup(t); }, [t]);
  if (!b) return null;
  const idx = live.stepIndex(t);
  // Story: the AI line in your language if it passed the checks; else the facts-based line.
  const aiStory = lang === "en" ? (b.storySource === "model" ? b.story : null) : b.localized;
  const story = aiStory ?? storyLine(lang, b.storyArgs, b.story);
  const who = meta?.players.find((p) => p.id === b.scorer)?.short ?? "";
  const teamName = meta ? (meta.players.find((p) => p.id === b.scorer)?.team === meta.home.code ? meta.home.name : meta.away.name) : "";
  return (
    <div className="buildup" dir={isRtl(lang) ? "rtl" : undefined}>
      <div className="bu-head">
        <span className={`bu-kind ${b.kind}`}>{tr(lang, b.kind === "goal" ? "bd_goal" : "bd_chance")}</span>
        <span className="bu-title">{tr(lang, "bd_title")} · {who} {Math.floor(b.goalT / 60)}′</span>
      </div>
      <div className="bu-story">{story}{aiStory && <span className="verified"> {tr(lang, "verified")}</span>}</div>
      <ol>
        {b.steps.map((s, i) => (
          <li key={i} className={`bu-${s.kind} ${i < idx ? "done" : ""} ${i === idx ? "cur" : ""}`}>
            <button onClick={() => live.stepTo(i)}>
              <span className="bu-time">{(s.t - b.goalT).toFixed(1)}s</span>
              <span className="bu-cap">{stepCaption(lang, s)}</span>
            </button>
            {i === idx && (
              <div className="bu-stats">
                {stepMeaning(lang, s).map((m, j) => (
                  <div key={j} className="bu-stat"><b>{m.label}</b>{m.meaning && <span>{m.meaning}</span>}</div>
                ))}
                {s.space && (
                  <div className="bu-stat bu-space">
                    <b>{tr(lang, "sp_ahead", { team: teamName, m: s.space.final_third_m2 })}</b>
                    {s.space.gain_m2 !== null && <span>{tr(lang, "sp_gain", { sign: s.space.gain_m2 >= 0 ? "+" : "−", m: Math.abs(s.space.gain_m2) })}</span>}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="bu-controls">
        <button onClick={() => live.stepPrev()} aria-label="Previous touch"><Icon name="back" /></button>
        <button className="bu-play" onClick={() => live.toggleBreakdown()} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={16} /></button>
        <button onClick={() => live.stepNext()} aria-label="Next touch"><span className="flip"><Icon name="back" /></span></button>
        <button className={`bu-space-toggle ${showSpace ? "on" : ""}`} onClick={() => live.toggleSpace()}>{tr(lang, "sp_toggle")}</button>
        <span className="bu-count">{tr(lang, "bd_step", { i: Math.max(1, idx + 1), n: b.steps.length })}</span>
      </div>
    </div>
  );
}

export function ExplainGoalButton({ className = "" }: { className?: string }) {
  const keys = useLive((s) => s.keyMoments);
  const t = useLive((s) => s.t);
  const lang = useLang();
  const goals = keys.filter((k) => k.type === "goal" && k.t <= t + 1);
  if (!goals.length) return null;
  return <button className={`explain-goal ${className}`} onClick={() => live.explainGoal()}><Icon name="replay" size={15} />{tr(lang, "explain_goal")}</button>;
}
