// The coach's tablet: the same live frames as the 3D view, drawn top-down. Every player is a
// numbered dot; during a breakdown the current touch is drawn on the board (the pass, the shot)
// and the space-control map shades the grass. `mini` is the corner map in Watch.
import { useEffect, useRef } from "react";
import { live, useLive } from "../live/store";
import type { BuildStep } from "../live/protocol";
import { interpolate } from "./Viewer";

const L = 105, W = 68, M = 3;  // pitch metres and margin

function arrow(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, s: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45));
  g.lineTo(x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45));
  g.closePath(); g.fill();
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, px: number) {
  g.font = `600 ${px}px "Inter Tight", Inter, sans-serif`;
  const w = g.measureText(text).width + px * 1.2, h = px * 1.8;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill();
  g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, x, y + 0.5);
}

export function TacticalBoard({ mini = false }: { mini?: boolean }) {
  const meta = useLive((s) => s.meta);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!meta || !canvas.current) return;
    const c = canvas.current, g = c.getContext("2d")!;
    const team = new Map(meta.players.map((p) => [p.id, p]));
    const colour = (id: string) => (team.get(id)?.team === meta.home.code ? meta.home.color : meta.away.color);
    const off = document.createElement("canvas");
    let spaceKey = -1;
    const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    let raf = 0;
    const draw = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const cw = c.clientWidth, ch = c.clientHeight;
      if (c.width !== Math.round(cw * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
      const k = Math.min(cw / (L + 2 * M), ch / (W + 2 * M)) * dpr;
      const ox = c.width / 2, oy = c.height / 2;
      const X = (x: number) => ox + x * k, Y = (y: number) => oy - y * k;  // +y is the far touchline
      g.clearRect(0, 0, c.width, c.height);
      g.fillStyle = "#123321"; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 12; i++) {  // mowing stripes
        g.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0)";
        g.fillRect(X(-L / 2 + (i * L) / 12), Y(W / 2), (L / 12) * k, W * k);
      }
      const s = live.get(), b = s.buildup;
      // Space control for the touch being studied.
      const step: BuildStep | undefined = b ? [...b.steps].reverse().find((st) => st.t <= s.t + 0.05) ?? b.steps[0] : undefined;
      const spaceStep = b ? [...b.steps].reverse().find((st) => st.space && st.t <= s.t + 0.05) ?? b.steps.find((st) => st.space) : undefined;
      if (b && s.showSpace && spaceStep?.space) {
        // One pixel per cell on a small canvas, scaled up with smoothing: soft gradients, not tiles.
        const sp = spaceStep.space;
        if (spaceKey !== spaceStep.t) {
          spaceKey = spaceStep.t;
          const mine = hex(colour(b.scorer)), theirs = hex(team.get(b.scorer)?.team === meta.home.code ? meta.away.color : meta.home.color);
          off.width = sp.cols; off.height = sp.rows;
          const img = off.getContext("2d")!.createImageData(sp.cols, sp.rows);
          for (let r = 0; r < sp.rows; r++) for (let q = 0; q < sp.cols; q++) {
            const p = sp.grid[r * sp.cols + q] / 255, c = p >= 0.5 ? mine : theirs;
            const i = ((sp.rows - 1 - r) * sp.cols + q) * 4;  // image rows run top-down; pitch y runs up
            img.data.set([c[0], c[1], c[2], Math.abs(p - 0.5) * 2 * 115], i);
          }
          off.getContext("2d")!.putImageData(img, 0, 0);
        }
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
        g.drawImage(off, X(-L / 2), Y(-W / 2 + sp.rows * sp.cell), sp.cols * sp.cell * k, sp.rows * sp.cell * k);
      }
      // Markings.
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = Math.max(1, 0.18 * k);
      g.strokeRect(X(-L / 2), Y(W / 2), L * k, W * k);
      g.beginPath(); g.moveTo(X(0), Y(W / 2)); g.lineTo(X(0), Y(-W / 2)); g.stroke();
      g.beginPath(); g.arc(X(0), Y(0), 9.15 * k, 0, Math.PI * 2); g.stroke();
      for (const sd of [-1, 1]) {
        const gx = (L / 2) * sd;
        g.strokeRect(Math.min(X(gx), X(gx - 16.5 * sd)), Y(20.16), 16.5 * k, 40.32 * k);
        g.strokeRect(Math.min(X(gx), X(gx - 5.5 * sd)), Y(9.16), 5.5 * k, 18.32 * k);
        g.strokeRect(Math.min(X(gx), X(gx + 1.5 * sd)), Y(3.66), 1.5 * k, 7.32 * k);
      }
      // The touch being studied: the pass or shot drawn on the board.
      if (!mini && step?.args) {
        const a = step.args as Record<string, number | string | boolean | null>;
        g.strokeStyle = "#ffffff"; g.fillStyle = "#ffffff"; g.lineWidth = 0.35 * k; g.setLineDash([1.2 * k, 0.9 * k]);
        if (step.kind === "pass" && a.end_x != null) {
          arrow(g, X(Number(a.x)), Y(Number(a.y)), X(Number(a.end_x)), Y(Number(a.end_y)), 1.6 * k);
          g.setLineDash([]);
          label(g, `${a.m} m ${a.kind === "ground" ? "pass" : a.kind}`, (X(Number(a.x)) + X(Number(a.end_x))) / 2, (Y(Number(a.y)) + Y(Number(a.end_y))) / 2 - 1.6 * k, "#121418", "#ffffff", 1.25 * k);
        } else if (step.kind === "shot" && a.goal_x != null) {
          g.strokeStyle = "#ff7a1a"; g.fillStyle = "#ff7a1a";
          arrow(g, X(Number(a.x)), Y(Number(a.y)), X(Number(a.goal_x)), Y(0), 1.6 * k);
          g.setLineDash([]);
          label(g, `xG ${Number(a.xg).toFixed(2)}`, X(Number(a.x)), Y(Number(a.y)) - 2.4 * k, "#ff7a1a", "#121418", 1.25 * k);
        }
        g.setLineDash([]);
        if (spaceStep?.space && s.showSpace && spaceStep === step && spaceStep.space.gain_m2) {
          // Next to the touch it belongs to: the pass's receiving end, the run's player, the shot.
          const gain = spaceStep.space.gain_m2;
          const ax = Number(a.end_x ?? a.x ?? 0), ay = Number(a.end_y ?? a.y ?? 0);
          label(g, `${gain > 0 ? "+" : "−"}${Math.abs(gain)} m² of final-third space`, X(ax), Y(ay) + 3.2 * k, gain > 0 ? "#ff7a1a" : "#fb7185", "#121418", 1.15 * k);
        }
      }
      // Players and ball.
      const st = interpolate(now);
      if (st) {
        const target = s.director?.target;
        for (const p of st.poses) {
          const r = (mini ? 1.5 : 1.25) * k;
          if (p.id === target) {
            g.strokeStyle = "#ff7a1a"; g.lineWidth = 0.4 * k;
            g.beginPath(); g.arc(X(p.x), Y(p.y), r + 0.9 * k, 0, Math.PI * 2); g.stroke();
          }
          g.fillStyle = team.get(p.id)?.role === "GK" ? "#f5c518" : colour(p.id);
          g.beginPath(); g.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = Math.max(1, 0.15 * k); g.stroke();
          if (!mini) {
            g.fillStyle = "#ffffff"; g.font = `700 ${1.25 * k}px "Inter Tight", Inter, sans-serif`;
            g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(String(team.get(p.id)?.number ?? ""), X(p.x), Y(p.y) + 0.5);
          }
        }
        g.fillStyle = "#ffffff"; g.strokeStyle = "#121418"; g.lineWidth = Math.max(1, 0.12 * k);
        g.beginPath(); g.arc(X(st.ball[0]), Y(st.ball[1]), (mini ? 0.9 : 0.75) * k, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [meta, mini]);

  // Click a dot to follow that player, as in the 3D view.
  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mini || !meta) return;
    const c = e.currentTarget, rect = c.getBoundingClientRect();
    const k = Math.min(rect.width / (L + 2 * M), rect.height / (W + 2 * M));
    const x = (e.clientX - rect.left - rect.width / 2) / k, y = -(e.clientY - rect.top - rect.height / 2) / k;
    const st = interpolate(performance.now());
    let best: string | null = null, bd = 4;
    for (const p of st?.poses ?? []) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p.id; } }
    if (best) live.send({ type: "select", player: best });
  };

  return <canvas ref={canvas} className={`tactical ${mini ? "mini" : ""}`} onClick={onClick} />;
}
