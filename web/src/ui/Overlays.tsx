import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Flame } from "./Flame";
import { Avatar } from "./Avatar";
import { Crest } from "./Crest";
import { band } from "../live/stats";
import { clock, live, useLang, useLive } from "../live/store";
import { directorReason, isRtl, statsLine, stepCaption, stepMeaning, storyLine, t as tr, type Lang } from "../i18n";
import { AnalystCard, TeamStrip } from "./Analyst";
import { useSpeed } from "./FocusPanel";

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
      <div className="team" style={{ background: meta.home.color }}><Crest code={meta.home.code} size={26} />{meta.home.code}</div>
      <div className="score">{sc[meta.home.code]} – {sc[meta.away.code]}</div>
      <div className="team" style={{ background: meta.away.color }}><Crest code={meta.away.code} size={26} />{meta.away.code}</div>
      <div className="clock">{clock(t)}</div>
    </div>
  );
}

/** Form in words, from the engine's rating (code, never the model): what a fan wants to know
 *  instead of a number. Levels 0-4: struggling, quiet, steady, playing well, on fire. */
export function formLevel(rating: number): number {
  return band("rating", rating, [5.6, 6.3, 7.0, 8.0]);  // thresholds from the stat registry
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
  const speed = useSpeed(pid ?? "");
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
      <div className={`card-hero ${speed >= 25.2 ? "sprinting" : ""}`}>
        <span className="card-num" aria-hidden="true">{p.number}</span>
        <span className="card-crest"><Crest code={team.code} size={22} /></span>
        <span className="card-bust"><Avatar player={p} color={team.color} size={118} bare /></span>
        <div className="card-id">
          <div className="card-name">
            <span className="first">{p.name.split(" ").slice(0, -1).join(" ")}</span>
            <span className="last">{p.name.split(" ").slice(-1)[0]}</span>
          </div>
        </div>
        <div className="card-meta">{p.position} <b>#{p.number}</b></div>
        <span className={`card-speed ${speed >= 25.2 ? "sprint" : speed >= 19.8 ? "fast" : ""}`}><b>{speed.toFixed(1)}</b> km/h</span>
      </div>
      <div className={`form ${fresh ? (isUp ? "form-up" : "form-down") : ""}`}>
        <FormMeter level={level} />
        <span className="form-word">{level === 4 && <Flame size={20} />}{tr(lang, `form_${level}`)}</span>
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
  const meta = useLive((s) => s.meta);
  const breakdown = useLive((s) => s.buildup);
  const lang = useLang();
  const now = useTicker();
  if (!director || breakdown) return null;  // during a breakdown the panel says what's happening
  const fresh = now - director.at < 1500;
  const label = director.mode === "replay" ? "replay" : director.mode === "manual" ? "your_pick" : director.predicted ? "predicted" : "auto";
  if (director.mode === "manual") {
    // Your own pick: just who, and a way to hand the ring back to the auto-director.
    const name = meta?.players.find((p) => p.id === director.target)?.short ?? "";
    return (
      <div className="director director-pick">
        <span className="director-reason">Following{" "}<b>{name}</b></span>
        <button className="director-x" onClick={(e) => { e.stopPropagation(); live.stopFollowing(); }} aria-label="Stop following" title="Stop following">✕</button>
      </div>
    );
  }
  return (
    <div className={`director ${fresh ? "director-fresh" : ""} ${director.predicted ? "director-predict" : ""}`}>
      {label !== "auto" && <span className="director-label">{tr(lang, label)}</span>}
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
  const over = useLive((s) => s.liveEdge >= (s.meta?.duration ?? 5400) - 2);
  // In play-by-play the bar under the header says where you are.
  if (!revisit || breakdown) return null;
  return (
    <div className="revisit-badge">
      <span className="rv-tag">{tr(lang, "revisit")}</span>
      <span className="rv-time">{clock(revisit.t)}</span>
      <span>{revisit.label}</span>
      {revisit.play && !breakdown && <button className="rv-break" onClick={() => live.breakdown(revisit.play!)}>{tr(lang, "bd_open")}</button>}
      {over
        ? <button className="rv-close" onClick={() => live.closeRevisit()} aria-label="Close">✕</button>
        : <button onClick={() => live.backToLive()}>{tr(lang, "back_live")}</button>}
    </div>
  );
}

/** A goal, the way a broadcast graphic shows it: a lower-third strip in the scorer's colours,
 *  with the crest, the scorer and minute, and the new score. */
export function GoalBanner() {
  const banner = useLive((s) => s.banner);
  const meta = useLive((s) => s.meta);
  const lang = useLang();
  const now = useTicker(200);
  if (!banner || !meta || now - banner.at > 5000) return null;
  const p = meta.players.find((x) => x.id === banner.player);
  const team = p?.team === meta.away.code ? meta.away : meta.home;
  const leaving = now - banner.at > 4400;
  return (
    <div className={`goal-strip ${leaving ? "out" : ""}`} style={{ ["--team" as string]: team.color }}>
      <span className="gs-tag">{tr(lang, "goal")}</span>
      <span className="gs-crest"><Crest code={team.code} size={34} /></span>
      <span className="gs-who"><b>{p?.name ?? banner.sub}</b>{banner.minute ? <em>{banner.minute}′</em> : null}</span>
      {banner.home !== undefined && <span className="gs-score">{meta.home.code} <b>{banner.home}–{banner.away}</b> {meta.away.code}</span>}
    </div>
  );
}

/** "How the goal was built": steps tick off as the replay passes them. */
/** The play breakdown. Overlaid on the picture in Watch; `docked` (Analyse) renders it at
 *  full size in the side column instead of inside the scaled broadcast frame. */
export function BuildUpPanel({ docked = false }: { docked?: boolean }) {
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
    <div className={`buildup ${docked ? "docked" : ""}`} dir={isRtl(lang) ? "rtl" : undefined}>
      {docked && <button className="bu-back" onClick={() => live.backToLive()}><Icon name="back" size={14} />Close</button>}
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

/** Play-by-play mode: a thin bar under the header that says you're stepping through one play,
 * with the touches as chips, the current touch explained, and a clear way back to the analysis. */
export function BreakdownBar() {
  const b = useLive((s) => s.buildup);
  const showSpace = useLive((s) => s.showSpace);
  const t = useLive((s) => s.t);
  const paused = useLive((s) => s.paused);
  const meta = useLive((s) => s.meta);
  const lang = useLang();
  useEffect(() => { live.stepBuildup(t); }, [t]);
  if (!b) return null;
  const idx = live.stepIndex(t);
  const cur = b.steps[Math.max(0, idx)];
  const aiStory = lang === "en" ? (b.storySource === "model" ? b.story : null) : b.localized;
  const story = aiStory ?? storyLine(lang, b.storyArgs, b.story);
  const who = meta?.players.find((p) => p.id === b.scorer)?.short ?? "";
  const exit = () => {
    const q = new URLSearchParams(location.search);
    q.delete("play"); q.delete("showme"); q.delete("start");
    history.replaceState(null, "", `${location.pathname}?${q}`);
    live.backToLive();
  };
  return (
    <div className="pbar" dir={isRtl(lang) ? "rtl" : undefined}>
      <div className="pbar-row">
        <span className="pbar-mode">Play breakdown</span>
        <span className={`pbar-kind ${b.kind}`}>{tr(lang, b.kind === "goal" ? "bd_goal" : "bd_chance")}</span>
        <b className="pbar-title">{who} {Math.floor(b.goalT / 60)}′</b>
        <span className="pbar-story" title={story}>{story}{aiStory && <em> {tr(lang, "verified")}</em>}</span>
        <div className="pbar-ctl">
          <button onClick={() => live.stepPrev()} aria-label="Previous touch"><Icon name="back" size={14} /></button>
          <button className="on" onClick={() => live.toggleBreakdown()} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={14} /></button>
          <button onClick={() => live.stepNext()} aria-label="Next touch"><span className="flip"><Icon name="back" size={14} /></span></button>
          <button className={`pbar-space ${showSpace ? "on" : ""}`} onClick={() => live.toggleSpace()}>{tr(lang, "sp_toggle")}</button>
        </div>
        <button className="pbar-exit" onClick={exit}>Exit to analysis ✕</button>
      </div>
      <div className="pbar-row steps">
        <ol className="pbar-steps">
          {b.steps.map((s, i) => (
            <li key={i}><button className={`${i < idx ? "done" : ""} ${i === idx ? "cur" : ""}`} onClick={() => live.stepTo(i)} title={stepCaption(lang, s)}>
              {i + 1}
            </button></li>
          ))}
        </ol>
        {cur && (
          <span className="pbar-now">
            <b>{stepCaption(lang, cur)}</b>
            {idx >= 0 && stepMeaning(lang, cur).map((m, j) => <span key={j}>{m.label}{m.meaning ? ` · ${m.meaning}` : ""}</span>)}
          </span>
        )}
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

/** "Show me" callouts over the tactical board: which touch, what it did, and the final-third
 * space the attack controls (from the engine's space model), then the verified story. */
export function ShowMeHUD() {
  const on = useLive((s) => s.showMe);
  const b = useLive((s) => s.buildup);
  const meta = useLive((s) => s.meta);
  const t = useLive((s) => s.t);
  const lang = useLang();
  // Shown for every play breakdown, not only Show me: the card over the video is the play-by-play.
  if (!b || !meta) return null;
  const i = Math.max(0, live.stepIndex(t));
  const step = b.steps[i];
  const sp = b.steps.slice(0, i + 1).reverse().find((s) => s.space)?.space;
  const scorer = meta.players.find((p) => p.id === b.scorer);
  const team = scorer?.team === meta.home.code ? meta.home : meta.away;
  const done = t > b.goalT + 0.3;
  const gain = sp?.gain_m2 ?? 0;
  return (
    // Sit at the end the team defends, so the card never covers the goal they attack.
    <div className={`sm-hud ${team.attack_dir < 0 ? "right" : ""}`} style={{ ["--team" as string]: team.color }}>
      <span className="sm-kicker">{on ? "Show me" : "Play breakdown"} · how the {b.kind === "goal" ? "goal" : "chance"} was built</span>
      <h3>{scorer?.short ?? ""}</h3>
      <div className="sm-steps" aria-label={`Touch ${i + 1} of ${b.steps.length}`}>{b.steps.map((_, j) => <i key={j} className={j < i ? "done" : j === i ? "on" : ""} />)}</div>
      <p className="sm-cap" key={done ? "story" : i}>{done ? (b.localized ?? b.story) : stepCaption(lang, step)}</p>
      {!done && (
        <div className="sm-why">
          {stepMeaning(lang, step).slice(0, 2).map((m, j) => <div key={j}><b>{m.label}</b>{m.meaning && <span>{m.meaning}</span>}</div>)}
        </div>
      )}
      {sp && !done && sp.final_third_m2 >= 20 && (
        <div className="sm-space">
          <b>{sp.final_third_m2}<small> m²</small></b><span>of the final third controlled</span>
          {gain !== 0 && <em className={gain > 0 ? "up" : "down"} key={i}>{gain > 0 ? "+" : "−"}{Math.abs(gain)} m²</em>}
        </div>
      )}
    </div>
  );
}
