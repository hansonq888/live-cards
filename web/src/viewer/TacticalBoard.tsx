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

type Label = { text: string; x: number; y: number; bg: string; fg: string; px: number; spots: [number, number][] };

/** Put each label at whichever of its candidate spots covers the fewest players and labels. */
function placeLabels(g: CanvasRenderingContext2D, labels: Label[], dots: [number, number][], r: number) {
  const taken: [number, number, number, number][] = [];
  for (const l of labels) {
    g.font = `600 ${l.px}px "Inter Tight", Inter, sans-serif`;
    const w = g.measureText(l.text).width + l.px * 1.2, h = l.px * 1.8;
    let best = l.spots[0], bestScore = Infinity;
    for (const [x, y] of l.spots) {
      const x0 = x - w / 2, y0 = y - h / 2;
      let score = 0;
      for (const [dx, dy] of dots) if (dx > x0 - r && dx < x0 + w + r && dy > y0 - r && dy < y0 + h + r) score += 1;
      for (const [tx, ty, tw, th] of taken) if (x0 < tx + tw && x0 + w > tx && y0 < ty + th && y0 + h > ty) score += 3;
      if (score < bestScore) { best = [x, y]; bestScore = score; }
    }
    taken.push([best[0] - w / 2, best[1] - h / 2, w, h]);
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = l.px * 0.6;
    label(g, l.text, best[0], best[1], l.bg, l.fg, l.px);
    g.shadowBlur = 0;
  }
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
    const off = document.createElement("canvas"), prev = document.createElement("canvas");
    let spaceKey = -1, spaceAt = 0;   // crossfade from the previous touch's map to this one
    let stepKey = -1, stepAt = 0;     // draw each touch's arrow in over a moment
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
      g.fillStyle = "#2a8a47"; g.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < 12; i++) {  // mowing stripes
        g.fillStyle = i % 2 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0)";
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
          if (spaceKey !== -1) { prev.width = off.width; prev.height = off.height; prev.getContext("2d")!.drawImage(off, 0, 0); }
          spaceAt = spaceKey === -1 ? now - 1000 : now;
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
        const f = Math.min(1, (now - spaceAt) / 600), dx = X(-L / 2), dy = Y(-W / 2 + sp.rows * sp.cell), dw = sp.cols * sp.cell * k, dh = sp.rows * sp.cell * k;
        if (f < 1 && prev.width) { g.globalAlpha = 1 - f; g.drawImage(prev, dx, dy, dw, dh); }
        g.globalAlpha = f; g.drawImage(off, dx, dy, dw, dh); g.globalAlpha = 1;
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
      // The touch being studied: the pass or shot drawn on the board, the arrow drawing itself in.
      const labels: Label[] = [];
      if (!mini && step?.args) {
        if (stepKey !== step.t) { stepKey = step.t; stepAt = now; }
        const grow = Math.min(1, (now - stepAt) / 450), ease = 1 - (1 - grow) ** 3;
        // Once play moves on from this touch, fade its marking out over a second of match time.
        const fade = Math.max(0, Math.min(1, 1 - (s.t - step.t - 0.35) / 1.0));
        g.globalAlpha = fade;
        const a = step.args as Record<string, number | string | boolean | null>;
        const x1 = X(Number(a.x)), y1 = Y(Number(a.y));
        g.strokeStyle = "#ffffff"; g.fillStyle = "#ffffff"; g.lineWidth = 0.35 * k; g.setLineDash([1.2 * k, 0.9 * k]);
        if (step.kind === "pass" && a.end_x != null) {
          const x2 = X(Number(a.end_x)), y2 = Y(Number(a.end_y));
          arrow(g, x1, y1, x1 + (x2 - x1) * ease, y1 + (y2 - y1) * ease, 1.6 * k);
          // the length label sits off the middle of the arrow, on whichever side is clearer
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, len = Math.hypot(x2 - x1, y2 - y1) || 1;
          const nx = -(y2 - y1) / len * 2.4 * k, ny = (x2 - x1) / len * 2.4 * k;
          if (grow >= 1) labels.push({ text: `${a.m} m ${a.kind === "ground" ? "pass" : a.kind}`, x: mx, y: my, bg: "#0d0a24", fg: "#ffffff", px: 1.2 * k,
            spots: [[mx + nx, my + ny], [mx - nx, my - ny], [mx + nx * 1.8, my + ny * 1.8], [mx - nx * 1.8, my - ny * 1.8]] });
        } else if (step.kind === "shot" && a.goal_x != null) {
          g.strokeStyle = "#d4ff3a"; g.fillStyle = "#d4ff3a";
          const x2 = X(Number(a.goal_x)), y2 = Y(0);
          arrow(g, x1, y1, x1 + (x2 - x1) * ease, y1 + (y2 - y1) * ease, 1.6 * k);
          if (grow >= 1) labels.push({ text: `xG ${Number(a.xg).toFixed(2)}`, x: x1, y: y1, bg: "#d4ff3a", fg: "#0d0a24", px: 1.2 * k,
            spots: [[x1, y1 - 2.6 * k], [x1, y1 + 2.6 * k], [x1 - 4.5 * k, y1], [x1 + 4.5 * k, y1]] });
        }
        g.setLineDash([]);
        g.globalAlpha = 1;
        if (fade < 0.6) labels.length = 0;
        // Show me puts the space gain in its big callout; otherwise label it next to the touch.
        if (!s.showMe && grow >= 1 && fade >= 0.6 && spaceStep?.space && s.showSpace && spaceStep === step && spaceStep.space.gain_m2) {
          const gain = spaceStep.space.gain_m2;
          const ax = X(Number(a.end_x ?? a.x ?? 0)), ay = Y(Number(a.end_y ?? a.y ?? 0));
          labels.push({ text: `${gain > 0 ? "+" : "−"}${Math.abs(gain)} m² of final-third space`, x: ax, y: ay, bg: gain > 0 ? "#d4ff3a" : "#fb7185", fg: "#0d0a24", px: 1.1 * k,
            spots: [[ax, ay + 3.2 * k], [ax, ay - 3.2 * k], [ax + 9 * k, ay], [ax - 9 * k, ay], [ax, ay + 5.6 * k]] });
        }
      }
      // Players and ball.
      const st = interpolate(now);
      if (st) {
        const target = s.director?.target;
        for (const p of st.poses) {
          const r = (mini ? 1.5 : 1.25) * k;
          if (p.id === target) {
            g.strokeStyle = "#d4ff3a"; g.lineWidth = 0.4 * k;
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
        g.fillStyle = "#ffffff"; g.strokeStyle = "#0d0a24"; g.lineWidth = Math.max(1, 0.12 * k);
        g.beginPath(); g.arc(X(st.ball[0]), Y(st.ball[1]), (mini ? 0.9 : 0.75) * k, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      // Labels last, on top of the players, each where it covers the fewest of them.
      if (labels.length) placeLabels(g, labels, st ? st.poses.map((p) => [X(p.x), Y(p.y)] as [number, number]) : [], 1.3 * k);
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
