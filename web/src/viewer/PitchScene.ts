// three.js broadcast scene, ported from prototype/index.html and driven by live frames.
// Backend coords: x along the pitch (+x = right goal), y across. three.js: x = x, z = -y.
import * as THREE from "three";
import type { MatchMeta } from "../live/protocol";

export interface PlayerPose { id: string; x: number; y: number; v: number }

// Ring colour comes from the theme (--ring), read when the scene is built.
const ringColour = () => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim() || "#d4ff3a";
const TRAIL_POINTS = 48;
const TRAIL_MS = 2200;

function pitchTexture(): THREE.CanvasTexture {
  const PX = 20, pad = 6 * PX;
  const cv = document.createElement("canvas");
  cv.width = 105 * PX + 2 * pad;
  cv.height = 68 * PX + 2 * pad;
  const g = cv.getContext("2d")!;
  for (let i = 0; i < 18; i++) {
    g.fillStyle = i % 2 ? "#245e2a" : "#2a6a30"; // graded darker so the graphics carry
    g.fillRect((i * cv.width) / 18, 0, cv.width / 18 + 1, cv.height);
  }
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.fillStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 3.2;
  const P = (x: number, z: number): [number, number] => [pad + (x + 52.5) * PX, pad + (z + 34) * PX];
  const rect = (x0: number, z0: number, x1: number, z1: number) => {
    const [a, b] = P(x0, z0), [c, d] = P(x1, z1);
    g.strokeRect(a, b, c - a, d - b);
  };
  rect(-52.5, -34, 52.5, 34);
  g.beginPath(); g.moveTo(...P(0, -34)); g.lineTo(...P(0, 34)); g.stroke();
  g.beginPath(); g.arc(...P(0, 0), 9.15 * PX, 0, Math.PI * 2); g.stroke();
  for (const s of [[0, 0], [-41.5, 0], [41.5, 0]]) {
    g.beginPath(); g.arc(...P(s[0], s[1]), 0.25 * PX, 0, Math.PI * 2); g.fill();
  }
  for (const sd of [-1, 1]) {
    const gx = 52.5 * sd;
    rect(Math.min(gx, gx - 16.5 * sd), -20.16, Math.max(gx, gx - 16.5 * sd), 20.16);
    rect(Math.min(gx, gx - 5.5 * sd), -9.16, Math.max(gx, gx - 5.5 * sd), 9.16);
    const [cx, cz] = P(41.5 * sd, 0);
    g.beginPath();
    g.arc(cx, cz, 9.15 * PX, sd > 0 ? Math.PI - 0.927 : -0.927, sd > 0 ? Math.PI + 0.927 : 0.927);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function boardTexture(home: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 2048; c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#121a2a"; x.fillRect(0, 0, 2048, 64);
  x.font = "bold 40px Arial";
  // Alternate the home club and our name, each spaced by its own width so nothing overlaps.
  let px = 40;
  for (let i = 0; px < 2048; i++) {
    const text = i % 2 ? "THE FIFTH OFFICIAL" : home.toUpperCase();
    x.fillStyle = i % 2 ? ringColour() : "#ffffff";
    x.fillText(text, px, 46);
    px += x.measureText(text).width + 120;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Body { grp: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; phase: number; stride: number; stat: THREE.Mesh }

const STAT_DISC = new THREE.RingGeometry(0.5, 0.78, 40);

export class PitchScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(24, 16 / 9, 1, 600);
  private bodies = new Map<string, Body>();
  private ball: THREE.Mesh;
  private ring = new THREE.Group();
  private ring2: THREE.Mesh;
  private ringPos = new THREE.Vector3(0, 0.04, 0);
  private camX = 0;
  private camZ = 0;
  private poses = new Map<string, PlayerPose>();
  ringTarget: string | null = null;
  clean = false; // capture mode: no ring or trail, just the "camera feed"
  private spaceMesh: THREE.Mesh | null = null;
  private spaceKey = "";
  private ringFor: string | null = null; // glide for 0.6 s after a switch, then lock on
  private ringSince = 0;
  // Speed trail behind the followed player: a ground ribbon, wider and hotter with speed.
  private trail: { x: number; z: number; v: number; at: number }[] = [];
  // Recent path of every player, so a newly followed player's trail appears at once.
  private history = new Map<string, { x: number; z: number; v: number; at: number }[]>();
  private trailGeom = new THREE.BufferGeometry();
  private trailMesh: THREE.Mesh;

  constructor(container: HTMLElement, meta: MatchMeta) {
    const r = new THREE.WebGLRenderer({ antialias: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    this.renderer = r;

    const s = this.scene;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0a0720";
    s.background = new THREE.Color(bg);
    s.fog = new THREE.Fog(bg, 120, 220);
    s.add(new THREE.HemisphereLight("#dfe8ff", "#2a4a22", 0.95));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6);
    sun.position.set(-30, 70, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50, near: 10, far: 200 });
    sun.shadow.bias = -0.0005;
    s.add(sun);

    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(117, 80), new THREE.MeshLambertMaterial({ map: pitchTexture() }));
    pitch.rotation.x = -Math.PI / 2;
    pitch.receiveShadow = true;
    s.add(pitch);
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(220, 160), new THREE.MeshLambertMaterial({ color: "#24572a" }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    s.add(apron);
    const boardMat = new THREE.MeshLambertMaterial({ color: "#141b2b" });
    const board = new THREE.Mesh(new THREE.BoxGeometry(120, 1, 0.2),
      [boardMat, boardMat, boardMat, boardMat, new THREE.MeshBasicMaterial({ map: boardTexture(meta.home.name) }), boardMat]);
    board.position.set(0, 0.5, -39);
    s.add(board);

    const white = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    for (const sd of [-1, 1]) {
      const gx = 52.5 * sd;
      for (const z of [-3.66, 3.66]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 12), white);
        post.position.set(gx, 1.22, z);
        post.castShadow = true;
        s.add(post);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 12), white);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(gx, 2.44, 0);
      s.add(bar);
      const net = new THREE.Mesh(new THREE.BoxGeometry(2, 2.44, 7.32, 6, 8, 20),
        new THREE.MeshBasicMaterial({ color: "#ffffff", wireframe: true, transparent: true, opacity: 0.35 }));
      net.position.set(gx + sd, 1.22, 0);
      s.add(net);
    }

    for (const p of meta.players) {
      const team = p.team === meta.home.code ? meta.home : meta.away;
      this.bodies.set(p.id, this.makePlayer(team.color, team.secondary, p.role === "GK", p.id));
    }

    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshLambertMaterial({ color: "#ffffff" }));
    this.ball.castShadow = true;
    s.add(this.ball);

    const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.12, 64),
      new THREE.MeshBasicMaterial({ color: ringColour(), transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    this.ring2 = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.36, 64),
      new THREE.MeshBasicMaterial({ color: ringColour(), transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    for (const m of [ring1, this.ring2]) { m.rotation.x = -Math.PI / 2; this.ring.add(m); }
    this.ring.position.y = 0.04;
    s.add(this.ring);

    const max = TRAIL_POINTS * 2;
    this.trailGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    this.trailGeom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL_POINTS - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    this.trailGeom.setIndex(idx);
    this.trailMesh = new THREE.Mesh(this.trailGeom, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide,
    }));
    this.trailMesh.frustumCulled = false;
    s.add(this.trailMesh);
  }

  /** Rebuild the ribbon from recent positions: width and colour from speed, fading with age. */
  private recordHistory(players: PlayerPose[], now: number) {
    for (const p of players) {
      let h = this.history.get(p.id);
      // A real jump back (Revisit), not the interpolated clock wobbling by a few milliseconds.
      if (!h || (h.length && now < h[h.length - 1].at - 2000)) { h = []; this.history.set(p.id, h); }
      const last = h[h.length - 1];
      if (!last || Math.hypot(p.x - last.x, -p.y - last.z) > 0.2) h.push({ x: p.x, z: -p.y, v: p.v, at: now });
      while (h.length && (now - h[0].at > TRAIL_MS || h.length > TRAIL_POINTS)) h.shift();
    }
  }

  private updateTrail(target: PlayerPose | undefined, now: number) {
    this.trail = target ? (this.history.get(target.id) ?? []).filter((p) => now - p.at < TRAIL_MS) : [];
    const pos = this.trailGeom.getAttribute("position") as THREE.BufferAttribute;
    const col = this.trailGeom.getAttribute("color") as THREE.BufferAttribute;
    const n = this.trail.length;
    const cool = new THREE.Color(ringColour()), hot = new THREE.Color("#ff9b4a"), white = new THREE.Color("#ffffff");
    for (let i = 0; i < TRAIL_POINTS; i++) {
      if (n < 2 || i >= n) {  // unused slots collapse onto the newest point (zero-area triangles)
        const q = this.trail[n - 1] ?? { x: 0, z: 0 };
        pos.setXYZ(i * 2, q.x, -0.5, q.z); pos.setXYZ(i * 2 + 1, q.x, -0.5, q.z);
        col.setXYZ(i * 2, 0, 0, 0); col.setXYZ(i * 2 + 1, 0, 0, 0);
        continue;
      }
      const p = this.trail[i];
      const a = this.trail[Math.max(0, i - 1)], b = this.trail[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const fresh = 1 - (now - p.at) / TRAIL_MS;            // 1 new .. 0 old
      const kmh = p.v * 3.6;
      const heat = Math.min(1, Math.max(0, (kmh - 18) / 14)); // 18 km/h cool .. 32 km/h hot
      const w = (0.18 + 0.75 * heat) * Math.max(0.15, fresh) * (i / Math.max(1, n - 1));
      pos.setXYZ(i * 2, p.x - dz * w, 0.03, p.z + dx * w);
      pos.setXYZ(i * 2 + 1, p.x + dz * w, 0.03, p.z - dx * w);
      const c = heat < 0.7 ? cool.clone().lerp(white, heat / 0.7) : white.clone().lerp(hot, (heat - 0.7) / 0.3);
      c.multiplyScalar(Math.max(0, fresh) * (0.35 + 0.65 * heat));
      col.setXYZ(i * 2, c.r, c.g, c.b); col.setXYZ(i * 2 + 1, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  private makePlayer(shirt: string, shorts: string, gk: boolean, id: string): Body {
    const grp = new THREE.Group();
    const mShirt = new THREE.MeshLambertMaterial({ color: gk ? "#f5c518" : shirt });
    const mShorts = new THREE.MeshLambertMaterial({ color: shorts });
    const mSkin = new THREE.MeshLambertMaterial({ color: "#c99a77" });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), mShirt);
    torso.position.y = 1.28;
    grp.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mSkin);
    head.position.y = 1.86;
    grp.add(head);
    const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.26, 10), mShorts);
    hip.position.y = 0.92;
    grp.add(hip);
    const limb = (off: number, y: number, r: number, len: number, mat: THREE.Material) => {
      const pivot = new THREE.Group();
      pivot.position.set(off, y, 0);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
      m.position.y = -len * 0.7;
      pivot.add(m);
      grp.add(pivot);
      return pivot;
    };
    const legs = [-0.11, 0.11].map((o) => limb(o, 0.88, 0.075, 0.6, mShirt));
    const arms = [-0.3, 0.3].map((o) => limb(o, 1.55, 0.06, 0.45, mSkin));
    grp.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.userData.playerId = id; }
    });
    const stat = new THREE.Mesh(STAT_DISC, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    stat.rotation.x = -Math.PI / 2;
    stat.position.y = 0.03;
    stat.visible = false;
    stat.userData.playerId = id;
    grp.add(stat);
    grp.visible = false;
    this.scene.add(grp);
    return { grp, legs, arms, phase: Math.random() * 6, stride: 0, stat };
  }

  /** Stat rings: a colour per player (CSS colour), or none to hide them all. */
  setStatColors(colors: Map<string, string> | null) {
    for (const [id, b] of this.bodies) {
      const c = colors?.get(id);
      b.stat.visible = !!c;
      if (c) (b.stat.material as THREE.MeshBasicMaterial).color.set(c);
    }
  }

  /** Space control: shade each cell toward the team that controls it (null hides it). */
  setSpace(snap: { cols: number; rows: number; cell: number; grid: number[] } | null, mine: string, theirs: string) {
    const key = snap ? `${snap.grid.length}:${snap.grid[0]}:${snap.grid[snap.grid.length >> 1]}:${mine}` : "";
    if (key === this.spaceKey) return;
    this.spaceKey = key;
    if (this.spaceMesh) { this.scene.remove(this.spaceMesh); this.spaceMesh.geometry.dispose(); ((this.spaceMesh.material as THREE.MeshBasicMaterial).map as THREE.Texture | null)?.dispose(); this.spaceMesh = null; }
    if (!snap) return;
    const a = new THREE.Color(mine), b = new THREE.Color(theirs);
    const data = new Uint8Array(snap.cols * snap.rows * 4);
    snap.grid.forEach((v, i) => {
      const p = v / 255, c = p >= 0.5 ? a : b, strength = Math.abs(p - 0.5) * 2;
      data.set([c.r * 255, c.g * 255, c.b * 255, strength * 120], i * 4);
    });
    const tex = new THREE.DataTexture(data, snap.cols, snap.rows, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const w = snap.cols * snap.cell, h = snap.rows * snap.cell;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    // Grid cell centres start at -52.5 + cell/2 along both axes, so the grid's centre is offset.
    mesh.position.set(-52.5 + w / 2, 0.02, -(-34 + h / 2));
    this.scene.add(mesh);
    this.spaceMesh = mesh;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Apply one interpolated pose set; dt is wall seconds since the last render. */
  update(players: PlayerPose[], ball: [number, number, number], dt: number, gameDt: number, gameT = 0) {
    const seen = new Set<string>();
    for (const p of players) {
      seen.add(p.id);
      const b = this.bodies.get(p.id);
      if (!b) continue;
      const prev = this.poses.get(p.id);
      b.grp.visible = true;
      b.grp.position.set(p.x, 0, -p.y);
      if (prev && p.v > 0.4) {
        const dx = p.x - prev.x, dz = -(p.y - prev.y);
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) b.grp.rotation.y = Math.atan2(dx, dz);
      } else {
        b.grp.rotation.y = Math.atan2(ball[0] - p.x, -ball[1] + p.y);
      }
      b.stride += p.v * gameDt * 1.9;
      const ph = b.phase + b.stride, amp = Math.min(1, p.v / 6) * 0.75;
      b.legs[0].rotation.x = Math.sin(ph) * amp;
      b.legs[1].rotation.x = -Math.sin(ph) * amp;
      b.arms[0].rotation.x = -Math.sin(ph) * amp * 0.8;
      b.arms[1].rotation.x = Math.sin(ph) * amp * 0.8;
      this.poses.set(p.id, p);
    }
    for (const [id, b] of this.bodies) if (!seen.has(id)) b.grp.visible = false;
    this.ball.position.set(ball[0], Math.max(0.12, ball[2]), -ball[1]);

    // Ring glides toward the followed player (critically damped, ~0.4 s).
    const target = this.ringTarget ? this.poses.get(this.ringTarget) : undefined;
    if (target) {
      // Glide on a switch; once it has arrived, lock on so a sprinter doesn't outrun it.
      const nowMs = performance.now();
      if (target.id !== this.ringFor) { this.ringFor = target.id; this.ringSince = nowMs; }
      const k = nowMs - this.ringSince > 600 ? 1 : 1 - Math.exp(-dt * 9);
      this.ringPos.x += (target.x - this.ringPos.x) * k;
      this.ringPos.z += (-target.y - this.ringPos.z) * k;
    }
    this.ring.visible = !!target && !this.clean;
    this.trailMesh.visible = !this.clean;
    this.recordHistory(players, gameT * 1000);
    this.updateTrail(target, gameT * 1000);
    this.ring.position.set(this.ringPos.x, 0.04, this.ringPos.z);
    const pulse = 1 + 0.08 * Math.sin(performance.now() / 160);
    this.ring2.scale.set(pulse, pulse, pulse);

    // Broadcast camera: follows the ball, leaning toward the followed player.
    const focusX = target ? ball[0] * 0.6 + target.x * 0.4 : ball[0];
    const wantX = Math.max(-33, Math.min(33, focusX * 0.92));
    const wantZ = Math.max(-8, Math.min(8, -ball[1] * 0.18));
    const kc = 1 - Math.exp(-dt * 3.2);
    this.camX += (wantX - this.camX) * kc;
    this.camZ += (wantZ - this.camZ) * kc;
    this.camera.position.set(this.camX, 26, 62 + this.camZ);
    this.camera.lookAt(this.camX + 2, 0, this.camZ + 1.5);
    this.renderer.render(this.scene, this.camera);
  }

  /** Screen position (px) of a point above a player's head, or null if off-screen. */
  screenPos(id: string, height = 2.35): [number, number] | null {
    const p = this.poses.get(id);
    if (!p) return null;
    const v = new THREE.Vector3(p.x, height, -p.y).project(this.camera);
    if (v.z > 1) return null;
    const el = this.renderer.domElement;
    return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight];
  }

  /** Screen position (px) of any pitch point (x, y in pitch metres, h above the grass). */
  project(x: number, y: number, h = 0): [number, number] {
    const v = new THREE.Vector3(x, h, -y).project(this.camera);
    const el = this.renderer.domElement;
    return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight];
  }

  ringScreenPos(height = 2.35): [number, number] | null {
    const v = new THREE.Vector3(this.ringPos.x, height, this.ringPos.z).project(this.camera);
    const el = this.renderer.domElement;
    return [((v.x + 1) / 2) * el.clientWidth, ((1 - v.y) / 2) * el.clientHeight];
  }

  /** Player id under a click, if any. */
  pick(clientX: number, clientY: number): string | null {
    const el = this.renderer.domElement;
    const rect = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const b of this.bodies.values()) if (b.grp.visible) meshes.push(b.grp);
    const hit = ray.intersectObjects(meshes, true)[0];
    if (hit) return hit.object.userData.playerId ?? null;
    // Forgiving fallback: nearest player to the click on the ground plane.
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    if (!ray.ray.intersectPlane(ground, pt)) return null;
    let best: string | null = null, bd = 3;
    for (const p of this.poses.values()) {
      const d = Math.hypot(p.x - pt.x, -p.y - pt.z);
      if (d < bd && this.bodies.get(p.id)?.grp.visible) { bd = d; best = p.id; }
    }
    return best;
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
