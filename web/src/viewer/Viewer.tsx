import { useEffect, useRef } from "react";
import { live, useLive } from "../live/store";
import type { Frame } from "../live/protocol";
import { PitchScene, type PlayerPose } from "./PitchScene";

const RENDER_DELAY_MS = 120; // play slightly behind the newest frame so we can interpolate

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
  const host = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const alertEl = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PitchScene | null>(null);
  const targetRef = useRef<string | null>(null);
  targetRef.current = director?.target ?? null;

  useEffect(() => {
    if (!meta || !host.current) return;
    const scene = new PitchScene(host.current, meta);
    sceneRef.current = scene;
    const el = host.current;
    const fit = () => scene.resize(el.clientWidth, el.clientHeight);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const names = new Map(meta.players.map((p) => [p.id, p]));
    let raf = 0, last = performance.now(), lastT = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const st = interpolate(now);
      if (st) {
        scene.ringTarget = targetRef.current;
        const gameDt = Math.max(0, Math.min(1, st.t - lastT));
        lastT = st.t;
        scene.update(st.poses, st.ball, dt, gameDt);
        const pos = scene.ringScreenPos();
        const p = targetRef.current ? names.get(targetRef.current) : undefined;
        if (tag.current) {
          tag.current.style.display = pos && p ? "block" : "none";
          if (pos && p) {
            tag.current.style.transform = `translate(${pos[0]}px, ${pos[1]}px) translate(-50%, -100%)`;
            tag.current.textContent = `${p.short}  #${p.number}`;
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

  const onClick = (e: React.MouseEvent) => {
    const id = sceneRef.current?.pick(e.clientX, e.clientY);
    if (id) live.send({ type: "select", player: id });
  };

  const alert = director ? [...alerts].reverse().find((a) => a.player === director.target && performance.now() - a.at < 5000) : undefined;

  return (
    <div className="stage" onClick={onClick}>
      <div ref={host} className="canvas-host" />
      <div ref={tag} className="name-tag" />
      <div ref={alertEl} className="alert-badge" style={{ display: alert ? "block" : "none" }}>
        {alert?.text}
      </div>
    </div>
  );
}
