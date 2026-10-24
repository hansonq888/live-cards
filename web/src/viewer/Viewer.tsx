import { useEffect, useMemo, useRef } from "react";
import { live, useLang, useLive } from "../live/store";
import { t as tr } from "../i18n";
import type { Frame } from "../live/protocol";
import { PitchScene, type PlayerPose } from "./PitchScene";
import { fmtStat, heat, statScale } from "./statRings";

const RENDER_DELAY_MS = 120;

/** Name tag: bold name, light detail. Touches the DOM only when the text changes. */
function setTag(el: HTMLElement, name: string, detail: string) {
  const key = `${name}|${detail}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const b = document.createElement("b");
  b.textContent = name;
  const span = document.createElement("span");
  span.textContent = detail;
  el.replaceChildren(b, span);
} // play slightly behind the newest frame so we can interpolate

function interpolate(now: number): { poses: PlayerPose[]; ball: [number, number, number]; t: number } | null {
  const fs = live.frames;
  if (!fs.length) return null;
  const at = now - RENDER_DELAY_MS;
  let i = fs.length - 1;
  while (i > 0 && fs[i - 1].at > at) i--;
  const b = fs[i];
  const a = i > 0 ? fs[i - 1] : b;
  const span = b.at - a.at;
  const k = span > 0 ? Math.min(1, Math.max(0, (at - a.at) / span)) : 1;
  const prev = new Map(a.frame.players.map((p) => [p[0], p]));
  const lerp = (x: number, y: number) => x + (y - x) * k;
  const poses = b.frame.players.map(([id, x, y, v]) => {
    const p = prev.get(id);
    return p ? { id, x: lerp(p[1], x), y: lerp(p[2], y), v: lerp(p[3], v) } : { id, x, y, v };
  });
  const ball = [0, 1, 2].map((j) => lerp(a.frame.ball[j], b.frame.ball[j])) as [number, number, number];
  return { poses, ball, t: lerp(a.frame.t, b.frame.t) };
}

export function Viewer() {
  const meta = useLive((s) => s.meta);
  const director = useLive((s) => s.director);
  const alerts = useLive((s) => s.alerts);
  const lang = useLang();
  const board = useLive((s) => s.board);
  const statRing = useLive((s) => s.statRing);
  const host = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const hoverTag = useRef<HTMLDivElement>(null);
  const hoverId = useRef<string | null>(null);
  const players = useMemo(() => new Map(meta?.players.map((p) => [p.id, p]) ?? []), [meta]);
  const scale = useMemo(() => (statRing ? statScale(board, statRing, players) : null), [board, statRing, players]);
  // The render loop reads these through a ref so it never restarts.
  const statRef = useRef({ stat: statRing, board, lang });
  statRef.current = { stat: statRing, board, lang };
  const alertEl = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PitchScene | null>(null);
  const targetRef = useRef<string | null>(null);
  targetRef.current = director?.target ?? null;

  useEffect(() => {
    if (!meta || !host.current) return;
    const scene = new PitchScene(host.current, meta);
    sceneRef.current = scene;
    scene.setStatColors(scale?.colors ?? null);
    const el = host.current;
    const fit = () => scene.resize(el.clientWidth, el.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const names = new Map(meta.players.map((p) => [p.id, p]));
    // ?capture=1: a clean feed plus ground truth, for measuring the vision layer
    // (backend/vision/). The page exposes exactly what it drew and where.
    const capture = new URLSearchParams(location.search).has("capture")
      ? { last: null as ReturnType<typeof interpolate> } : null;
    if (capture) {
      scene.clean = true;
      (window as unknown as Record<string, unknown>).__livecards = {
        project: (x: number, y: number, h = 0) => scene.project(x, y, h),
        truth: () => capture.last && {
          t: capture.last.t, ball: capture.last.ball,
          players: capture.last.poses.map((p) => ({ id: p.id, team: names.get(p.id)?.team, role: names.get(p.id)?.role, x: p.x, y: p.y, foot: scene.project(p.x, p.y, 0), head: scene.project(p.x, p.y, 1.95) })),
        },
      };
    }
    const statSuffix = (id: string) => {
      const { stat, board: b, lang: l } = statRef.current;
      const v = stat ? b[id]?.[stat] : undefined;
      return stat && v !== undefined ? `  ·  ${tr(l, stat)} ${fmtStat(stat, v)}` : "";
    };
    let raf = 0, last = performance.now(), lastT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = interpolate(now);
      if (st) {
        scene.ringTarget = targetRef.current;
        const gameDt = Math.max(0, Math.min(1, st.t - lastT));
        lastT = st.t;
        scene.update(st.poses, st.ball, dt, gameDt, st.t);
        if (capture) capture.last = st;
        const pos = scene.ringScreenPos();
        const p = targetRef.current ? names.get(targetRef.current) : undefined;
        if (tag.current) {
          tag.current.style.display = pos && p ? "block" : "none";
          if (pos && p) {
            tag.current.style.transform = `translate(${pos[0]}px, ${pos[1]}px) translate(-50%, -100%)`;
            setTag(tag.current, p.short, `#${p.number}${statSuffix(p.id)}`);
          }
        }
        const hp = hoverId.current && hoverId.current !== targetRef.current ? names.get(hoverId.current) : undefined;
        const hpos = hp ? scene.screenPos(hp.id) : null;
        if (hoverTag.current) {
          hoverTag.current.style.display = hp && hpos ? "block" : "none";
          if (hp && hpos) {
            hoverTag.current.style.transform = `translate(${hpos[0]}px, ${hpos[1]}px) translate(-50%, -100%)`;
            setTag(hoverTag.current, hp.short, statSuffix(hp.id).replace(/^\s*·\s*/, ""));
          }
        }
        if (alertEl.current && pos) {
          alertEl.current.style.transform = `translate(${pos[0]}px, ${pos[1] - 30}px) translate(-50%, -100%)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [meta]);

  useEffect(() => { sceneRef.current?.setStatColors(scale?.colors ?? null); }, [scale]);

  // Space control for the touch being studied in a breakdown.
  const breakdown = useLive((s) => s.buildup);
  const showSpace = useLive((s) => s.showSpace);
  const t = useLive((s) => s.t);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !meta) return;
    if (!breakdown || !showSpace) { scene.setSpace(null, "", ""); return; }
    let step = breakdown.steps.find((s) => s.space);
    for (const s of breakdown.steps) if (s.space && s.t <= t + 0.05) step = s;
    const mine = breakdown.steps.length && meta.players.find((p) => p.id === breakdown.scorer)?.team === meta.home.code ? meta.home : meta.away;
    const theirs = mine === meta.home ? meta.away : meta.home;
    scene.setSpace(step?.space ?? null, mine.color, theirs.color);
  }, [breakdown, showSpace, t, meta]);

  // Keyboard: Tab / Shift+Tab cycles the followed player's team, A returns to auto, Space pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const frame: Frame | undefined = live.frames[live.frames.length - 1]?.frame;
      if (e.key === "Tab" && frame && meta) {
        e.preventDefault();
        const cur = targetRef.current;
        const team = meta.players.find((p) => p.id === cur)?.team ?? meta.home.code;
        const ids = frame.players.map((p) => p[0]).filter((id) => id.startsWith(team));
        const idx = ids.indexOf(cur ?? "");
        const next = ids[(idx + (e.shiftKey ? -1 : 1) + ids.length) % ids.length];
        live.send({ type: "select", player: next });
      } else if (e.key === "a" || e.key === "A") {
        live.send({ type: "auto" });
      } else if (e.key === " ") {
        e.preventDefault();
        live.send({ type: live.get().paused ? "play" : "pause" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [meta]);

  // Hover a player to read their number (only while stat rings are on).
  const onMove = (e: React.MouseEvent) => {
    hoverId.current = statRing ? sceneRef.current?.pick(e.clientX, e.clientY) ?? null : null;
  };

  const onClick = (e: React.MouseEvent) => {
    const id = sceneRef.current?.pick(e.clientX, e.clientY);
    if (id) live.send({ type: "select", player: id });
  };

  const alert = director ? [...alerts].reverse().find((a) => a.player === director.target && performance.now() - a.at < 5000) : undefined;

  return (
    <div className="stage" onClick={onClick} onMouseMove={onMove} onMouseLeave={() => { hoverId.current = null; }}>
      <div ref={host} className="canvas-host" />
      <div ref={tag} className="name-tag" />
      <div ref={hoverTag} className="name-tag hover-tag" />
      {statRing && scale && (
        <div className="stat-legend">
          <span className="sl-name">{tr(lang, statRing)}</span>
          <span>{fmtStat(statRing, scale.lo)}</span>
          <span className="sl-bar" style={{ background: `linear-gradient(90deg, ${heat(0)}, ${heat(0.5)}, ${heat(1)})` }} />
          <span>{fmtStat(statRing, scale.hi)}</span>
          <span className="sl-hint">{tr(lang, "rings_hint")}</span>
        </div>
      )}
      <div ref={alertEl} className="alert-badge" style={{ display: alert ? "block" : "none" }}>
        {alert ? (alert.type === "streak" ? `🔥 ${alert.count} ${tr(lang, "in_a_row")}` : `⚡ ${alert.kmh?.toFixed(1)} KM/H${alert.type === "fastest_sprint" ? ` · ${tr(lang, "fastest")}` : ""}`) : ""}
      </div>
    </div>
  );
}
