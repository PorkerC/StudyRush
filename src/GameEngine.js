// ╔══════════════════════════════════════════════════════════════╗
// ║         STUDYRUSH ENGINE v3.0 — Production Build            ║
// ║  Full 2D canvas engine: rendering, physics, audio, input    ║
// ╚══════════════════════════════════════════════════════════════╝

// ─── MATH UTILITIES ──────────────────────────────────────────────────────────
export const M = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  rand: (a, b) => Math.random() * (b - a) + a,
  randInt: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  dist: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
  norm: (v, a, b) => (v - a) / (b - a),
  ease: {
    outQ:      t => t * (2 - t),
    outCubic:  t => --t * t * t + 1,
    outBack:   t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * (t - 1) ** 3 + c * (t - 1) ** 2; },
    outElastic:t => { if (t === 0 || t === 1) return t; return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1; },
    inQ:       t => t * t,
    linear:    t => t,
  },
};

// ─── OBJECT POOL ─────────────────────────────────────────────────────────────
export class Pool {
  constructor(factory, reset, size = 64) {
    this._f = factory; this._r = reset;
    this._free = []; this._active = new Set();
    for (let i = 0; i < size; i++) this._free.push(factory());
  }
  get() {
    const o = this._free.length ? this._free.pop() : this._f();
    this._active.add(o); return o;
  }
  release(o) {
    if (!this._active.has(o)) return;
    this._active.delete(o); this._r(o); this._free.push(o);
  }
  releaseAll() { [...this._active].forEach(o => this.release(o)); }
  get active() { return this._active; }
}

// ─── PARTICLE ────────────────────────────────────────────────────────────────
class Particle {
  constructor() { this.alive = false; this.x = this.y = this.vx = this.vy = this.rot = this.rotV = 0; this.life = 0; this.decay = 0.02; this.size = 6; this.color = "#fff"; this.shape = "circle"; this.friction = 0.97; this.ay = 0.28; this.glow = false; }
  init(x, y, opts = {}) {
    this.alive = true; this.x = x; this.y = y;
    this.vx = opts.vx ?? M.rand(-5, 5);
    this.vy = opts.vy ?? M.rand(-9, -2);
    this.ay = opts.ay ?? 0.28;
    this.life = opts.life ?? 1;
    this.decay = opts.decay ?? M.rand(0.012, 0.028);
    this.size = opts.size ?? M.rand(4, 10);
    this.color = Array.isArray(opts.colors) ? M.pick(opts.colors) : (opts.color ?? "#fbbf24");
    this.shape = opts.shape ?? (Math.random() > 0.6 ? "square" : "circle");
    this.rot = M.rand(0, Math.PI * 2);
    this.rotV = M.rand(-0.12, 0.12);
    this.friction = opts.friction ?? 0.97;
    this.glow = opts.glow ?? false;
  }
  reset() { this.alive = false; }
  update() {
    this.vx *= this.friction;
    this.vy = (this.vy + this.ay) * this.friction;
    this.x += this.vx; this.y += this.vy;
    this.rot += this.rotV;
    this.life -= this.decay;
    if (this.life <= 0) this.alive = false;
  }
  draw(ctx) {
    if (!this.alive || this.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    if (this.glow) { ctx.shadowColor = this.color; ctx.shadowBlur = this.size * 2; }
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    if (this.shape === "circle") { ctx.beginPath(); ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size); }
    ctx.restore();
  }
}

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────
export class PS {
  constructor(n = 300) {
    this._pool = new Pool(() => new Particle(), p => p.reset(), n);
  }
  burst(x, y, opts = {}) {
    const n = opts.count ?? 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const spd = M.rand(opts.minSpd ?? 2, opts.maxSpd ?? 9);
      const p = this._pool.get();
      p.init(x, y, { ...opts, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, ay: opts.ay ?? 0.15 });
    }
  }
  emit(x, y, n = 16, opts = {}) {
    for (let i = 0; i < n; i++) {
      const p = this._pool.get();
      p.init(x, y, { ...opts, vx: (opts.vx ?? 0) + M.rand(-3, 3), vy: (opts.vy ?? -4) + M.rand(-2, 1) });
    }
  }
  update() { this._pool.active.forEach(p => { p.update(); if (!p.alive) this._pool.release(p); }); }
  draw(ctx) { this._pool.active.forEach(p => p.draw(ctx)); }
  clear() { this._pool.releaseAll(); }
}

// ─── CAMERA ──────────────────────────────────────────────────────────────────
export class Camera {
  constructor() { this._sx = 0; this._sy = 0; this._trauma = 0; }
  shake(mag = 8) { this._trauma = Math.min(this._trauma + mag / 20, 1); }
  update(dt) {
    if (this._trauma > 0) {
      this._trauma = Math.max(0, this._trauma - dt * 2.2);
      const m = this._trauma ** 2;
      this._sx = M.rand(-16, 16) * m;
      this._sy = M.rand(-10, 10) * m;
    } else {
      this._sx = M.lerp(this._sx, 0, 0.3);
      this._sy = M.lerp(this._sy, 0, 0.3);
    }
  }
  apply(ctx) { ctx.translate(Math.round(this._sx), Math.round(this._sy)); }
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this._ptrs = new Map();   // id -> {x,y}
    this._pressed = new Set(); // ids pressed this frame
    this._bind();
  }
  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  _bind() {
    const dn = e => {
      e.preventDefault();
      const list = e.touches || [e];
      for (const t of list) {
        const id = t.identifier ?? "m";
        const p = this._pos(t);
        this._ptrs.set(id, p);
        this._pressed.add(id);
      }
    };
    const up = e => {
      e.preventDefault();
      const list = e.changedTouches || [e];
      for (const t of list) this._ptrs.delete(t.identifier ?? "m");
    };
    const mv = e => {
      e.preventDefault();
      const list = e.touches || [e];
      for (const t of list) {
        const id = t.identifier ?? "m";
        if (this._ptrs.has(id)) this._ptrs.set(id, this._pos(t));
      }
    };
    ["pointerdown", "touchstart"].forEach(ev => this.canvas.addEventListener(ev, dn, { passive: false }));
    ["pointerup", "touchend"].forEach(ev => this.canvas.addEventListener(ev, up, { passive: false }));
    ["pointermove", "touchmove"].forEach(ev => this.canvas.addEventListener(ev, mv, { passive: false }));
  }
  // Was any pointer pressed this frame in rect?
  wasHit(x, y, w, h) {
    for (const id of this._pressed) {
      const p = this._ptrs.get(id);
      if (p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return true;
    }
    return false;
  }
  // Was any pointer pressed this frame within circle?
  wasCircle(cx, cy, r) {
    for (const id of this._pressed) {
      const p = this._ptrs.get(id);
      if (p && M.dist(p.x, p.y, cx, cy) <= r) return true;
    }
    return false;
  }
  // Is any pointer currently inside rect?
  hit(x, y, w, h) {
    for (const [, p] of this._ptrs)
      if (p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h) return true;
    return false;
  }
  clearFrame() { this._pressed.clear(); }
}

// ─── RENDERER ────────────────────────────────────────────────────────────────
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2x for perf
    this.W = 0; this.H = 0;
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }
  clear(col = "#07070f") {
    this.ctx.fillStyle = col;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }
  // Rounded rect
  rr(x, y, w, h, r, fill, stroke, sw = 1) {
    const ctx = this.ctx, mn = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + mn, y); ctx.lineTo(x + w - mn, y); ctx.quadraticCurveTo(x + w, y, x + w, y + mn);
    ctx.lineTo(x + w, y + h - mn); ctx.quadraticCurveTo(x + w, y + h, x + w - mn, y + h);
    ctx.lineTo(x + mn, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - mn);
    ctx.lineTo(x, y + mn); ctx.quadraticCurveTo(x, y, x + mn, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
  }
  circle(x, y, r, fill, stroke, sw = 1) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
  }
  // Smart text renderer
  text(str, x, y, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${opts.w || "700"} ${opts.s || 16}px ${opts.f || "'Sora',sans-serif"}`;
    ctx.textAlign = opts.a || "center";
    ctx.textBaseline = opts.b || "middle";
    ctx.fillStyle = opts.c || "#f0f0ff";
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.gb || 12; }
    if (opts.outline) { ctx.strokeStyle = opts.outline; ctx.lineWidth = opts.ow || 2; ctx.strokeText(str, x, y); }
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  // Auto word-wrap text, returns line count
  textWrap(str, x, y, maxW, opts = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${opts.w || "700"} ${opts.s || 15}px ${opts.f || "'Sora',sans-serif"}`;
    ctx.textAlign = opts.a || "center";
    ctx.textBaseline = opts.b || "top";
    ctx.fillStyle = opts.c || "#f0f0ff";
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = opts.gb || 8; }
    const words = str.split(" ");
    let lines = [], line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    lines.push(line);
    const lh = opts.lh || (opts.s || 15) * 1.45;
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    ctx.restore();
    return lines.length;
  }
  bar(x, y, w, h, t, bg, fg, r = 4, glow = null) {
    this.rr(x, y, w, h, r, bg);
    if (glow) { this.ctx.shadowColor = glow; this.ctx.shadowBlur = 8; }
    const fw = Math.max(0, w * Math.min(1, Math.max(0, t)));
    if (fw > 0) this.rr(x, y, fw, h, r, fg);
    if (glow) this.ctx.shadowBlur = 0;
  }
  lgrad(x1, y1, x2, y2, stops) {
    const g = this.ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([p, c]) => g.addColorStop(p, c)); return g;
  }
  rgrad(x, y, r1, x2, y2, r2, stops) {
    const g = this.ctx.createRadialGradient(x, y, r1, x2, y2, r2);
    stops.forEach(([p, c]) => g.addColorStop(p, c)); return g;
  }
  flash(col, a = 0.2) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col;
    ctx.fillRect(0, 0, this.W, this.H); ctx.restore();
  }
  vignette(str = 0.45) {
    const g = this.rgrad(this.W / 2, this.H / 2, this.H * 0.2, this.W / 2, this.H / 2, this.H * 0.85,
      [[0, "rgba(0,0,0,0)"], [1, `rgba(0,0,0,${str})`]]);
    this.ctx.fillStyle = g; this.ctx.fillRect(0, 0, this.W, this.H);
  }
  scanlines(a = 0.018) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = a;
    for (let y = 0; y < this.H; y += 3) { ctx.fillStyle = "#000"; ctx.fillRect(0, y, this.W, 1); }
    ctx.restore();
  }
}

// ─── AUDIO ───────────────────────────────────────────────────────────────────
export class Audio {
  constructor() { this._ctx = null; this._master = null; this.muted = false; }
  _init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.6;
      this._master.connect(this._ctx.destination);
    } catch {}
  }
  _t(freq, dur, type = "sine", vol = 0.18, delay = 0) {
    if (this.muted) return; this._init();
    const c = this._ctx; if (!c) return;
    try {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(this._master);
      o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + delay);
      g.gain.setValueAtTime(0, c.currentTime + delay);
      g.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      o.start(c.currentTime + delay); o.stop(c.currentTime + delay + dur + 0.05);
    } catch {}
  }
  play(name) {
    const s = {
      correct:   () => { this._t(523,.08,"sine",.22);this._t(659,.08,"sine",.22,.09);this._t(784,.22,"sine",.2,.18);this._t(1047,.28,"sine",.14,.29); },
      wrong:     () => { this._t(220,.18,"sawtooth",.2);this._t(160,.22,"sawtooth",.16,.15); },
      tap:       () => { this._t(900,.05,"sine",.22);this._t(1100,.03,"sine",.15,.05); },
      miss:      () => this._t(180,.12,"sawtooth",.15),
      combo:     () => { this._t(660,.09,"sine",.22);this._t(880,.1,"sine",.2,.08);this._t(1100,.14,"sine",.18,.17); },
      streak:    () => [523,587,659,784,1047].forEach((f,i) => this._t(f,.1,"sine",.18,i*.07)),
      jackpot:   () => { [523,659,784,1047,1319,1568].forEach((f,i)=>this._t(f,.12,"sine",.22,i*.055));this._t(1047,.7,"sine",.1,.5); },
      levelUp:   () => [392,494,587,784,1047].forEach((f,i) => this._t(f,.2,"sine",.22,i*.09)),
      countdown: () => this._t(440,.15,"square",.22),
      go:        () => { this._t(660,.08,"sine",.28);this._t(880,.14,"sine",.24,.09);this._t(1100,.2,"sine",.2,.18); },
      boost:     () => { this._t(440,.08,"square",.15);this._t(880,.15,"sine",.2,.09); },
      brake:     () => this._t(200,.15,"sawtooth",.18),
      tick:      () => this._t(880,.03,"square",.06),
      danger:    () => this._t(110,.1,"sawtooth",.22),
      beat:      () => { this._t(80,.08,"sine",.18);this._t(160,.05,"sine",.1,.06); },
      hitBeat:   () => { this._t(523,.09,"sine",.24);this._t(660,.08,"sine",.2,.08); },
      click:     () => this._t(600,.04,"sine",.1),
      select:    () => { this._t(600,.04,"sine",.1);this._t(800,.03,"sine",.08,.04); },
    };
    s[name]?.();
  }
}

// ─── BACKGROUNDS (home screens only) ─────────────────────────────────────────

/**
 * HOME BACKGROUND — Deep space, stars, drifting aurora, floating math constants
 * Very slow, calm, majestic
 */
export class HomeBG {
  constructor() {
    this.t = 0;
    // Stars — many, very faint
    this.stars = Array.from({ length: 180 }, () => ({
      x: Math.random(), y: Math.random(),
      r: M.rand(0.3, 1.8),
      a: M.rand(0.08, 0.6),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: M.rand(0.2, 0.8),
    }));
    // Floating constants — very slow drift
    const consts = [
      { s: "π", v: "≈ 3.14159265…" }, { s: "e", v: "≈ 2.71828182…" },
      { s: "φ", v: "≈ 1.61803398…" }, { s: "√2", v: "≈ 1.41421356…" },
      { s: "∞", v: "unbounded" }, { s: "i", v: "= √−1" },
      { s: "c", v: "≈ 3×10⁸ m/s" }, { s: "ℏ", v: "≈ 1.054×10⁻³⁴ J·s" },
      { s: "G", v: "≈ 6.674×10⁻¹¹" }, { s: "γ", v: "≈ 0.57721566…" },
      { s: "τ", v: "≈ 6.28318530…" }, { s: "ζ(2)", v: "= π²/6" },
    ];
    this.floats = consts.map(c => ({
      ...c,
      x: M.rand(0.05, 0.92), y: M.rand(0.05, 0.92),
      vx: M.rand(-0.0015, 0.0015), vy: M.rand(-0.001, 0.001),
      a: M.rand(0.06, 0.14), sz: M.rand(15, 24),
      pulse: Math.random() * Math.PI * 2, ps: M.rand(0.15, 0.4),
    }));
    // Aurora bands — 3 slow waves
    this.auroras = [0, 1, 2].map(i => ({
      hue: [220, 270, 160][i],
      phase: i * (Math.PI * 2 / 3),
      speed: M.rand(0.04, 0.09),
      amp: M.rand(0.08, 0.16),
      y: M.rand(0.25, 0.6),
    }));
  }
  update(dt) {
    this.t += dt;
    this.stars.forEach(s => s.twinklePhase += s.twinkleSpeed * dt);
    this.floats.forEach(c => {
      c.x = (c.x + c.vx + 1) % 1;
      c.y = (c.y + c.vy + 1) % 1;
      c.pulse += c.ps * dt;
    });
  }
  draw(ctx, W, H) {
    ctx.save();
    // Deep space base
    const bg = ctx.createLinearGradient(0, 0, W * 0.3, H);
    bg.addColorStop(0, "#04040e"); bg.addColorStop(0.5, "#060610"); bg.addColorStop(1, "#050510");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Aurora waves (very subtle)
    this.auroras.forEach(a => {
      const wave = Math.sin(this.t * a.speed + a.phase);
      const y = H * (a.y + a.amp * wave);
      const g = ctx.createRadialGradient(W * 0.5, y, 0, W * 0.5, y, W * 0.55);
      const alpha = 0.035 + 0.015 * Math.sin(this.t * a.speed * 1.3 + a.phase);
      g.addColorStop(0, `hsla(${a.hue},80%,65%,${alpha})`);
      g.addColorStop(0.5, `hsla(${a.hue},60%,50%,${alpha * 0.4})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });

    // Stars
    this.stars.forEach(s => {
      const twinkle = Math.sin(s.twinklePhase) * 0.35 + 0.65;
      ctx.globalAlpha = s.a * twinkle;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2); ctx.fill();
    });

    // Floating constants
    this.floats.forEach(c => {
      const pulse = Math.sin(c.pulse) * 0.3 + 0.7;
      ctx.globalAlpha = c.a * pulse;
      ctx.fillStyle = "#a78bfa";
      ctx.font = `300 ${c.sz}px serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(c.s, c.x * W, c.y * H);
      ctx.globalAlpha = c.a * pulse * 0.5;
      ctx.fillStyle = "#6366f1";
      ctx.font = `400 ${c.sz * 0.48}px 'Space Mono',monospace`;
      ctx.fillText(c.v, c.x * W, c.y * H + c.sz * 0.88);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/**
 * STUDY BACKGROUND — Nature-inspired calm
 * Slow breathing gradients, soft aurora, no symbols — pure focus environment
 */
export class StudyBG {
  constructor() {
    this.t = 0;
    // Slow breathing orbs in nature tones
    this.orbs = [
      { x: 0.15, y: 0.2, col: "#1e3a5f", r: 0.5, speed: 0.06, phase: 0 },
      { x: 0.85, y: 0.8, col: "#162a3a", r: 0.45, speed: 0.04, phase: 1.8 },
      { x: 0.5,  y: 0.5, col: "#0f2318", r: 0.35, speed: 0.05, phase: 0.9 },
      { x: 0.2,  y: 0.75,col: "#1a2f1a", r: 0.3,  speed: 0.07, phase: 2.4 },
    ];
    // Very subtle horizontal shimmer bands (like northern lights over a lake)
    this.bands = Array.from({ length: 5 }, (_, i) => ({
      y: 0.2 + i * 0.15,
      hue: [200, 180, 210, 190, 205][i],
      phase: M.rand(0, Math.PI * 2),
      speed: M.rand(0.02, 0.05),
      alpha: M.rand(0.012, 0.028),
    }));
  }
  update(dt) { this.t += dt; }
  draw(ctx, W, H) {
    ctx.save();
    // Very dark blue-green-black base
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#060c12"); bg.addColorStop(0.4, "#060d0a"); bg.addColorStop(1, "#07090f");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Breathing orbs
    this.orbs.forEach(o => {
      const pulse = Math.sin(this.t * o.speed + o.phase) * 0.12 + 0.88;
      const radius = W * o.r * pulse;
      const g = ctx.createRadialGradient(o.x * W, o.y * H, 0, o.x * W, o.y * H, radius);
      g.addColorStop(0, o.col + "55"); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });

    // Shimmer bands (like moonlight on water)
    this.bands.forEach(b => {
      const wave = Math.sin(this.t * b.speed + b.phase) * 0.02;
      const y = H * (b.y + wave);
      const g = ctx.createLinearGradient(0, y - H * 0.04, 0, y + H * 0.04);
      const alpha = b.alpha * (Math.sin(this.t * b.speed * 0.7 + b.phase) * 0.4 + 0.6);
      g.addColorStop(0, "transparent");
      g.addColorStop(0.5, `hsla(${b.hue},50%,65%,${alpha})`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.fillRect(0, y - H * 0.04, W, H * 0.08);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

/**
 * ARCADE BACKGROUND — Wide range of global symbols, equations, formulas
 * Sparse enough to read, engaging enough to catch the eye
 * ZERO undefined — all values pre-computed and valid
 */
export class ArcadeBG {
  constructor() {
    this.t = 0;
    // Curated global symbols from many fields — never undefined
    const symbolSets = {
      math:    ["∑", "∫", "∂", "∇", "∞", "∈", "∉", "∩", "∪", "⊂", "⊃", "∀", "∃", "¬", "∧", "∨", "⊕", "≈", "≠", "≡", "≤", "≥", "±", "√", "∛", "∜", "∏", "Δ", "∝", "∠"],
      greek:   ["α", "β", "γ", "δ", "ε", "ζ", "η", "θ", "ι", "κ", "λ", "μ", "ν", "ξ", "π", "ρ", "σ", "τ", "υ", "φ", "χ", "ψ", "ω", "Γ", "Λ", "Σ", "Φ", "Ψ", "Ω"],
      physics: ["ℏ", "ħ", "c²", "mc²", "eV", "J·s", "m/s²", "N·m", "Pa", "Hz", "Wb", "Ω", "F", "H", "T", "μ₀", "ε₀", "kB", "NA"],
      chem:    ["→", "⇌", "⇒", "H₂O", "CO₂", "NaCl", "O₂", "NH₃", "CH₄", "pH", "mol", "atm", "ΔH", "ΔG", "ΔS", "Ka", "Kb"],
      music:   ["♩", "♪", "♫", "♬", "𝄞", "𝄢", "𝄡", "♭", "♯", "𝄻", "𝄼", "𝄽", "𝄾", "𝄿"],
      chess:   ["♔", "♕", "♖", "♗", "♘", "♙", "♚", "♛", "♜", "♝", "♞", "♟"],
      japanese:["文", "数", "理", "科", "学", "知", "識", "力", "思", "考", "解", "答"],
      arabic:  ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "٠", "∞"],
      cyrillic:["Д", "Ж", "И", "Л", "Ф", "Ц", "Ч", "Ш", "Щ", "Э", "Ю", "Я"],
      binary:  ["0", "1", "0", "1", "10", "11", "01", "00", "101", "110", "010", "111"],
      logic:   ["⊤", "⊥", "∴", "∵", "⟹", "⟺", "⊢", "⊨", "□", "◇", "¬", "↔"],
    };
    // Flatten all symbols into one array, guaranteed non-empty strings
    const allSyms = Object.values(symbolSets).flat().filter(s => s && s.length > 0);
    // Formulas / equations to show inline — carefully curated, no undefined
    const equations = [
      "E = mc²", "F = ma", "a² + b² = c²", "∫f(x)dx",
      "∇²φ = 0", "PV = nRT", "F = qvB", "ΔE = hf",
      "d/dx[xⁿ] = nxⁿ⁻¹", "∑ᵢ₌₁ⁿ i = n(n+1)/2",
      "sin²θ + cos²θ = 1", "eⁱᵖⁱ + 1 = 0",
      "v = λf", "p = mv", "W = Fd·cosθ",
      "H = -∑p·log(p)", "∂u/∂t = α∇²u",
      "F = GmM/r²", "E = ½mv²", "λ = h/p",
      "det(A) = ad − bc", "lim(x→0) sin(x)/x = 1",
    ];

    // Create sparse floating items — only 18 total, well-spaced
    this.items = Array.from({ length: 18 }, (_, i) => {
      const isEq = Math.random() > 0.55;
      return {
        text: isEq ? equations[i % equations.length] : allSyms[M.randInt(0, allSyms.length - 1)],
        x: M.rand(0.05, 0.92),
        y: M.rand(0.05, 0.92),
        vx: M.rand(-0.0018, 0.0018),
        vy: M.rand(-0.001, 0.001),
        a: M.rand(0.055, 0.14),
        sz: isEq ? M.rand(11, 15) : M.rand(18, 30),
        col: M.pick(["#fbbf24", "#f87171", "#34d399", "#60a5fa", "#c084fc", "#fb923c"]),
        pulse: Math.random() * Math.PI * 2,
        ps: M.rand(0.12, 0.35),
        isEq,
      };
    });

    // Falling code columns — fewer, slower
    const colCount = Math.max(12, Math.floor(window.innerWidth / 32));
    const colChars = ["0","1","∑","π","∫","∞","α","β","γ","δ","λ","φ","0","1","0","1"];
    this.cols = Array.from({ length: colCount }, (_, i) => ({
      x: (i / colCount) * (window.innerWidth || 400) + M.rand(-8, 8),
      y: M.rand(-300, -20),
      speed: M.rand(25, 65), // much slower
      chars: Array.from({ length: M.randInt(6, 16) }, () => M.pick(colChars)),
      alpha: M.rand(0.04, 0.1),
      col: M.pick(["#fbbf24", "#f87171", "#34d399"]),
    }));
  }
  update(dt, H = 600) {
    this.t += dt;
    this.items.forEach(it => {
      it.x = (it.x + it.vx + 1) % 1;
      it.y = (it.y + it.vy + 1) % 1;
      it.pulse += it.ps * dt;
    });
    this.cols.forEach(c => {
      c.y += c.speed * dt;
      if (c.y > H + 200) {
        c.y = M.rand(-200, -30);
        c.speed = M.rand(25, 65);
        c.alpha = M.rand(0.04, 0.1);
      }
      // Slowly mutate chars
      if (Math.random() < 0.03) {
        const ci = M.randInt(0, c.chars.length - 1);
        const opts = ["0","1","∑","π","∫","∞","α","λ"];
        c.chars[ci] = opts[M.randInt(0, opts.length - 1)];
      }
    });
  }
  draw(ctx, W, H) {
    ctx.save();
    // Black base
    ctx.fillStyle = "#07070f"; ctx.fillRect(0, 0, W, H);
    // Subtle top glow
    const g1 = ctx.createRadialGradient(W * 0.5, 0, 0, W * 0.5, 0, W * 0.65);
    g1.addColorStop(0, "rgba(251,191,36,.035)"); g1.addColorStop(1, "transparent");
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    // Subtle bottom glow
    const g2 = ctx.createRadialGradient(W * 0.5, H, 0, W * 0.5, H, W * 0.65);
    g2.addColorStop(0, "rgba(248,113,113,.025)"); g2.addColorStop(1, "transparent");
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

    // Matrix columns
    ctx.font = "700 13px 'Space Mono',monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    this.cols.forEach(c => {
      const n = c.chars.length;
      c.chars.forEach((ch, i) => {
        const cy = c.y + i * 20;
        if (cy < -24 || cy > H + 24) return;
        const isHead = i === n - 1;
        ctx.globalAlpha = isHead ? Math.min(1, c.alpha * 3.5) : c.alpha * (1 - i / n * 0.5);
        ctx.fillStyle = isHead ? "#fff" : c.col;
        if (isHead) { ctx.shadowColor = c.col; ctx.shadowBlur = 8; }
        ctx.fillText(ch, c.x, cy);
        ctx.shadowBlur = 0;
      });
    });
    ctx.globalAlpha = 1;

    // Floating symbols & equations
    this.items.forEach(it => {
      const pulse = Math.sin(it.pulse) * 0.28 + 0.72;
      ctx.globalAlpha = it.a * pulse;
      ctx.fillStyle = it.col;
      ctx.font = it.isEq
        ? `500 ${it.sz}px 'Space Mono',monospace`
        : `300 ${it.sz}px serif`;
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(it.text, it.x * W, it.y * H);
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ─── SCENE BASE ───────────────────────────────────────────────────────────────
export class Scene {
  constructor() { this.engine = null; this.renderer = null; this.input = null; this.audio = null; this.camera = null; this.particles = null; }
  init() {} update(dt) {} draw(r) {} destroy() {}
}

// ─── CANVAS BUTTON ───────────────────────────────────────────────────────────
export class CBtn {
  constructor(x, y, w, h, label, opts = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
    this.col = opts.col || "#fbbf24"; this.txtCol = opts.txtCol || "#07070f";
    this.r = opts.r || 12; this.fontSize = opts.fontSize || 14;
    this.scale = 1; this._ts = 1; this.alpha = opts.alpha || 1;
    this.glow = opts.glow || false; this.onClick = opts.onClick || null;
    this.disabled = opts.disabled || false; this.sublabel = opts.sublabel || "";
  }
  update(input) {
    if (this.disabled) return;
    const hov = input.hit(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    this._ts = hov ? 1.06 : 1.0;
    this.scale = M.lerp(this.scale, this._ts, 0.18);
    if (input.wasHit(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h)) {
      this.onClick?.();
    }
  }
  draw(r) {
    const ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = this.disabled ? 0.3 : this.alpha;
    ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
    if (this.glow) { ctx.shadowColor = this.col; ctx.shadowBlur = 18; }
    r.rr(-this.w / 2, -this.h / 2, this.w, this.h, this.r, this.col);
    // Shine overlay
    ctx.globalAlpha *= 0.2;
    r.rr(-this.w / 2 + 2, -this.h / 2 + 2, this.w - 4, this.h / 2 - 2, this.r - 1, "rgba(255,255,255,.5)");
    ctx.globalAlpha = this.disabled ? 0.3 : this.alpha;
    ctx.shadowBlur = 0;
    const ty = this.sublabel ? -7 : 0;
    r.text(this.label, 0, ty, { c: this.txtCol, w: "800", s: this.fontSize, a: "center", b: "middle" });
    if (this.sublabel) r.text(this.sublabel, 0, ty + 15, { c: this.txtCol + "99", w: "500", s: this.fontSize - 3, a: "center", b: "middle" });
    ctx.restore();
  }
}

// ─── MAIN ENGINE ─────────────────────────────────────────────────────────────
export class Engine {
  constructor(canvas) {
    this.renderer = new Renderer(canvas);
    this.input    = new Input(canvas);
    this.audio    = new Audio();
    this.camera   = new Camera();
    this.particles = new PS(350);
    this.tweens   = [];
    this.scene    = null;
    this.running  = false;
    this._last    = 0;
    this._raf     = null;
    this.fps      = 0;
    this._fpsF    = 0;
    this._fpsT    = 0;
    this.time     = 0;
  }
  setScene(scene) {
    this.scene?.destroy?.();
    this.particles.clear();
    this.tweens = [];
    this.scene = scene;
    scene.engine    = this;
    scene.renderer  = this.renderer;
    scene.input     = this.input;
    scene.audio     = this.audio;
    scene.camera    = this.camera;
    scene.particles = this.particles;
    scene.init?.();
  }
  tween(target, props, dur, ease, onDone) {
    const t = new Tween(target, props, dur, ease, onDone);
    this.tweens.push(t); return t;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._loop(this._last);
  }
  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }
  _loop(now) {
    if (!this.running) return;
    this._raf = requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now; this.time += dt;
    // FPS counter
    this._fpsF++; this._fpsT += dt;
    if (this._fpsT >= 1) { this.fps = this._fpsF; this._fpsF = 0; this._fpsT = 0; }
    // Update systems
    this.camera.update(dt);
    this.particles.update();
    this.tweens = this.tweens.filter(t => { t.update(dt); return !t.done; });
    this.scene?.update?.(dt);
    this.input.clearFrame();
    // Render
    const ctx = this.renderer.ctx;
    ctx.save();
    this.camera.apply(ctx);
    this.scene?.draw?.(this.renderer);
    this.particles.draw(ctx);
    ctx.restore();
  }
  resize() { this.renderer.resize(); }
}
