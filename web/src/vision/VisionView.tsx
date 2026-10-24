// Vision view (?view=vision): the ring on real footage, with no tracking system. Players were
// found and tracked offline by vision/track_clip.py (pretrained YOLO + ByteTrack, no training);
// this page plays the clip and draws the tracks in sync with the video's own frames.
import { Icon } from "../ui/Icon";
import { useEffect, useRef, useState } from "react";

type Team = "light" | "dark" | "other";
type Box = [number, number, number, number, number, Team]; // id, x1, y1, x2, y2, team
interface Tracks {
  fps: number; w: number; h: number;
  frames: { t: number; p: Box[]; b: [number, number] | null }[];
  summary: { tracks: number; teams: Record<string, number>; ball_frames: number; frames: number };
}

const TEAM_COLOUR: Record<Team, string> = { light: "#f4f2ff", dark: "#4f7bff", other: "#f59e0b" };
const TEAM_NAME: Record<Team, string> = { light: "White", dark: "Navy", other: "Keeper / ref" };
const RING = () => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim() || "#d4ff3a";

/** The tracker can lose a player for a moment (the drone moves); hand the ring to the closest
 *  player of the same team near where they were, so it keeps following "them". */
function follow(boxes: Box[], id: number | null, last: { x: number; y: number; team: Team } | null): Box | undefined {
  const same = boxes.find((b) => b[0] === id);
  if (same || !last) return same;
  let best: Box | undefined, bd = 90;
  for (const b of boxes) {
    if (b[5] !== last.team) continue;
    const d = Math.hypot((b[1] + b[3]) / 2 - last.x, b[4] - last.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

export function VisionView() {
  const [data, setData] = useState<Tracks | null>(null);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const selected = useRef<number | null>(null);
  const last = useRef<{ x: number; y: number; team: Team } | null>(null);
  const ringAt = useRef<{ x: number; y: number; w: number } | null>(null);
  const tag = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/vision/tracks.json").then((r) => r.json()).then(setData);
  }, []);

  useEffect(() => {
    if (!data || !video.current || !canvas.current) return;
    const v = video.current, c = canvas.current, ctx = c.getContext("2d")!;
    // Start on a long-lived player close to the camera, so the ring is obvious from the start.
    const life = new Map<number, number>();
    for (const f of data.frames) for (const b of f.p) life.set(b[0], (life.get(b[0]) ?? 0) + 1);
    const first = data.frames[0].p.filter((b) => b[5] !== "other");
    const score = (b: Box) => (life.get(b[0]) ?? 0) * (b[4] - b[2]);
    first.sort((a, b) => score(b) - score(a));
    selected.current = first[0]?.[0] ?? null;
    let raf = 0;
    const draw = () => {
      const rect = v.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      if (c.width !== Math.round(rect.width * dpr)) { c.width = Math.round(rect.width * dpr); c.height = Math.round(rect.height * dpr); }
      const k = (rect.width / data.w) * dpr;
      ctx.clearRect(0, 0, c.width, c.height);
      const f = data.frames[Math.min(data.frames.length - 1, Math.floor(v.currentTime * data.fps))];
      if (f) {
        for (const [, x1, , x2, y2, team] of f.p) {  // a soft team-coloured ellipse at each player's feet
          const cx = ((x1 + x2) / 2) * k, cy = y2 * k, rx = Math.max(7, (x2 - x1) * 0.7) * k;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, rx * 0.32, 0, 0, Math.PI * 2);
          ctx.strokeStyle = TEAM_COLOUR[team];
          ctx.globalAlpha = 0.8;
          ctx.lineWidth = Math.max(1, Math.min(2.5 * dpr, rx * 0.12));
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        const target = follow(f.p, selected.current, last.current);
        if (target) {
          selected.current = target[0];
          const [, x1, , x2, y2, team] = target;
          last.current = { x: (x1 + x2) / 2, y: y2, team };
          const want = { x: ((x1 + x2) / 2) * k, y: y2 * k, w: Math.max(12, (x2 - x1) * 1.05) * k };
          const r = ringAt.current ?? want, s = 0.35;  // glide toward the target
          ringAt.current = { x: r.x + (want.x - r.x) * s, y: r.y + (want.y - r.y) * s, w: r.w + (want.w - r.w) * s };
          const g = ringAt.current;
          ctx.beginPath();
          ctx.ellipse(g.x, g.y, g.w, g.w * 0.32, 0, 0, Math.PI * 2);
          ctx.strokeStyle = RING();
          ctx.lineWidth = Math.max(1.5 * dpr, Math.min(4 * dpr, g.w * 0.14));
          ctx.shadowColor = RING();
          ctx.shadowBlur = 14 * dpr;
          ctx.stroke();
          ctx.shadowBlur = 0;
          if (tag.current) {
            tag.current.style.display = "flex";
            tag.current.style.transform = `translate(${g.x / dpr}px, ${(target[2] * k) / dpr - 4}px) translate(-50%, -100%)`;
            tag.current.dataset.team = team;
            tag.current.firstElementChild!.textContent = `Player ${target[0]}`;
            tag.current.lastElementChild!.textContent = TEAM_NAME[team];
          }
        } else if (tag.current) {
          tag.current.style.display = "none";
        }
        setCount(f.p.length);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [data]);

  const pick = (e: React.MouseEvent) => {
    if (!data || !video.current) return;
    const rect = video.current.getBoundingClientRect();
    const k = rect.width / data.w;
    const x = (e.clientX - rect.left) / k, y = (e.clientY - rect.top) / k;
    const f = data.frames[Math.floor(video.current.currentTime * data.fps)];
    let best: Box | undefined, bd = 80;
    for (const b of f?.p ?? []) {
      const d = Math.hypot((b[1] + b[3]) / 2 - x, (b[2] + b[4]) / 2 - y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { selected.current = best[0]; last.current = null; }
  };

  const toggle = () => {
    const v = video.current!;
    if (v.paused) { v.play(); setPaused(false); } else { v.pause(); setPaused(true); }
  };

  return (
    <div className="vision-view">
      <div className="vv-stage" onClick={pick}>
        <video ref={video} src="/vision/clip.mp4" autoPlay muted loop playsInline />
        <canvas ref={canvas} />
        <div ref={tag} className="name-tag vv-tag" style={{ display: "none" }}><b /><span /></div>
        <div className="vv-badge">
          <span className="vv-live">Camera only</span>
          <span><b>{count}</b> players tracked</span>
        </div>
      </div>
      <div className="vv-bar">
        <button className="round" onClick={toggle} aria-label={paused ? "Play" : "Pause"}><Icon name={paused ? "play" : "pause"} size={18} /></button>
        <div className="vv-copy">
          <b>No tracking system. Just a camera.</b>
          <span>Pretrained detector and tracker, no training. Click any player to follow them.</span>
        </div>
        {data && (
          <div className="vv-stats">
            <div><b>{data.summary.tracks}</b><span>tracks</span></div>
            <div><b>{data.summary.teams.light ?? 0}/{data.summary.teams.dark ?? 0}</b><span>white / navy</span></div>
            <div><b>{Math.round((data.summary.ball_frames / data.summary.frames) * 100)}%</b><span>ball found</span></div>
          </div>
        )}
        <a className="ghost-link" href="/">Back to the match</a>
      </div>
      <div className="vv-credit">Footage: Pexels (free licence). Processed offline by vision/track_clip.py.</div>
    </div>
  );
}
