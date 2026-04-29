// ============================================================
// STUDYRUSH GAME ENGINE v1.0
// A lightweight but powerful 2D game engine for StudyRush
// ============================================================

// ── MATH UTILITIES ───────────────────────────────────────────────────────────
export const Math2 = {
  lerp: (a, b, t) => a + (b - a) * t,
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  map: (v, a, b, c, d) => c + ((v - a) / (b - a)) * (d - c),
  dist: (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
  angle: (x1, y1, x2, y2) => Math.atan2(y2-y1, x2-x1),
  rand: (min, max) => Math.random() * (max - min) + min,
  randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  randFrom: arr => arr[Math.floor(Math.random() * arr.length)],
  ease: {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => t * (2 - t),
    inOutQuad: t => t < .5 ? 2*t*t : -1+(4-2*t)*t,
    outBack: t => { const c1=1.70158,c3=c1+1; return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2); },
    outElastic: t => { if(t===0||t===1)return t; const c4=(2*Math.PI)/3; return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*c4)+1; },
    outBounce: t => { if(t<1/2.75)return 7.5625*t*t; if(t<2/2.75){t-=1.5/2.75;return 7.5625*t*t+0.75;}if(t<2.5/2.75){t-=2.25/2.75;return 7.5625*t*t+0.9375;}t-=2.625/2.75;return 7.5625*t*t+0.984375; },
    inOutElastic: t => { const c5=(2*Math.PI)/4.5; if(t===0||t===1)return t; return t<.5?-(Math.pow(2,20*t-10)*Math.sin((20*t-11.125)*c5))/2:(Math.pow(2,-20*t+10)*Math.sin((20*t-11.125)*c5))/2+1; },
  },
  degToRad: d => d * Math.PI / 180,
  radToDeg: r => r * 180 / Math.PI,
  intersects: (ax,ay,aw,ah,bx,by,bw,bh) => ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by,
  circleIntersects: (ax,ay,ar,bx,by,br) => Math2.dist(ax,ay,bx,by) < ar+br,
};

// ── TWEEN ENGINE ─────────────────────────────────────────────────────────────
export class Tween {
  constructor(target, props, duration, ease = Math2.ease.outQuad, onComplete) {
    this.target = target;
    this.start = {};
    this.end = props;
    this.duration = duration;
    this.ease = ease;
    this.onComplete = onComplete;
    this.elapsed = 0;
    this.done = false;
    for (const k in props) this.start[k] = target[k] || 0;
  }
  update(dt) {
    if (this.done) return;
    this.elapsed = Math.min(this.elapsed + dt, this.duration);
    const t = this.ease(this.elapsed / this.duration);
    for (const k in this.end) this.target[k] = Math2.lerp(this.start[k], this.end[k], t);
    if (this.elapsed >= this.duration) { this.done = true; this.onComplete?.(); }
  }
}

// ── PARTICLE SYSTEM ──────────────────────────────────────────────────────────
export class Particle {
  constructor(x, y, options = {}) {
    this.x = x; this.y = y;
    this.vx = options.vx ?? Math2.rand(-4, 4);
    this.vy = options.vy ?? Math2.rand(-8, -2);
    this.gravity = options.gravity ?? 0.25;
    this.life = 1.0;
    this.decay = options.decay ?? Math2.rand(0.015, 0.035);
    this.size = options.size ?? Math2.rand(4, 10);
    this.color = options.color ?? "#fbbf24";
    this.shape = options.shape ?? (Math.random() > .5 ? "circle" : "square");
    this.rotation = Math2.rand(0, Math.PI * 2);
    this.rotSpeed = Math2.rand(-0.15, 0.15);
    this.scale = 1;
    this.friction = options.friction ?? 0.98;
    this.bounce = options.bounce ?? 0;
    this.alive = true;
    this.glow = options.glow ?? false;
    this.trail = [];
  }
  update() {
    this.vx *= this.friction;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotSpeed;
    this.life -= this.decay;
    this.scale = this.life;
    if (this.life <= 0) this.alive = false;
    if (this.trail.length > 0) {
      this.trail.push({ x: this.x, y: this.y, life: this.life });
      if (this.trail.length > 6) this.trail.shift();
    }
  }
  draw(ctx) {
    if (!this.alive) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    if (this.glow) {
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.size * 2;
    }
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(this.scale, this.scale);
    ctx.fillStyle = this.color;
    if (this.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.shape === "square") {
      ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
    } else if (this.shape === "star") {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? this.size / 2 : this.size / 4;
        i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export class ParticleSystem {
  constructor() { this.particles = []; }
  emit(x, y, count = 20, options = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, { ...options,
        vx: options.vx !== undefined ? options.vx + Math2.rand(-2,2) : Math2.rand(-6, 6),
        vy: options.vy !== undefined ? options.vy + Math2.rand(-2,2) : Math2.rand(-10, -2),
        color: Array.isArray(options.colors) ? Math2.randFrom(options.colors) : options.color ?? "#fbbf24",
      }));
    }
  }
  burst(x, y, options = {}) {
    const count = options.count ?? 30;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = Math2.rand(options.minSpeed ?? 2, options.maxSpeed ?? 8);
      this.particles.push(new Particle(x, y, { ...options,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Array.isArray(options.colors) ? Math2.randFrom(options.colors) : options.color ?? "#fbbf24",
        gravity: options.gravity ?? 0.15,
      }));
    }
  }
  update() {
    this.particles = this.particles.filter(p => { p.update(); return p.alive; });
  }
  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
  }
  clear() { this.particles = []; }
}

// ── CAMERA ───────────────────────────────────────────────────────────────────
export class Camera {
  constructor() {
    this.x = 0; this.y = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeMag = 0; this.shakeDur = 0; this.shakeTimer = 0;
    this.zoom = 1; this.targetZoom = 1;
  }
  shake(magnitude = 8, duration = 0.3) {
    this.shakeMag = magnitude;
    this.shakeDur = duration;
    this.shakeTimer = duration;
  }
  update(dt) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const t = this.shakeTimer / this.shakeDur;
      this.shakeX = Math2.rand(-this.shakeMag, this.shakeMag) * t;
      this.shakeY = Math2.rand(-this.shakeMag, this.shakeMag) * t;
    } else { this.shakeX = 0; this.shakeY = 0; }
    this.zoom = Math2.lerp(this.zoom, this.targetZoom, 0.1);
  }
  apply(ctx) {
    ctx.translate(this.shakeX, this.shakeY);
    if (this.zoom !== 1) {
      const cx = ctx.canvas.width / 2, cy = ctx.canvas.height / 2;
      ctx.translate(cx, cy); ctx.scale(this.zoom, this.zoom); ctx.translate(-cx, -cy);
    }
  }
}

// ── INPUT MANAGER ─────────────────────────────────────────────────────────────
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.pointers = new Map(); // id -> {x,y,down}
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.keys = new Set();
    this.justPressedKeys = new Set();
    this._bindEvents();
  }
  _getPos(e) {
    const r = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / r.width;
    const scaleY = this.canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
  }
  _bindEvents() {
    const onDown = e => {
      e.preventDefault();
      const touches = e.touches || [e];
      for (const t of touches) {
        const pos = this._getPos(t);
        const id = t.identifier ?? "mouse";
        this.pointers.set(id, { ...pos, down: true });
        this.justPressed.add(id);
      }
    };
    const onUp = e => {
      e.preventDefault();
      const touches = e.changedTouches || [e];
      for (const t of touches) {
        const id = t.identifier ?? "mouse";
        this.justReleased.add(id);
        this.pointers.delete(id);
      }
    };
    const onMove = e => {
      e.preventDefault();
      const touches = e.touches || [e];
      for (const t of touches) {
        const pos = this._getPos(t);
        const id = t.identifier ?? "mouse";
        if (this.pointers.has(id)) this.pointers.set(id, { ...pos, down: true });
      }
    };
    this.canvas.addEventListener("pointerdown", onDown, { passive: false });
    this.canvas.addEventListener("pointerup", onUp, { passive: false });
    this.canvas.addEventListener("pointermove", onMove, { passive: false });
    this.canvas.addEventListener("touchstart", onDown, { passive: false });
    this.canvas.addEventListener("touchend", onUp, { passive: false });
    this.canvas.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("keydown", e => { this.keys.add(e.code); this.justPressedKeys.add(e.code); });
    window.addEventListener("keyup", e => this.keys.delete(e.code));
  }
  isDown() { return this.pointers.size > 0; }
  wasPressed() { return this.justPressed.size > 0; }
  getPressPositions() { return [...this.justPressed].map(id => this.pointers.get(id) || null).filter(Boolean); }
  getAllPointers() { return [...this.pointers.values()]; }
  clearFrame() { this.justPressed.clear(); this.justReleased.clear(); this.justPressedKeys.clear(); }
  hitTest(x, y, w, h) {
    for (const [, p] of this.pointers) {
      if (p.x >= x && p.x <= x+w && p.y >= y && p.y <= y+h) return true;
    }
    return false;
  }
  wasHit(x, y, w, h) {
    for (const id of this.justPressed) {
      const p = this.pointers.get(id);
      if (p && p.x >= x && p.x <= x+w && p.y >= y && p.y <= y+h) return true;
    }
    return false;
  }
  wasCircleHit(cx, cy, r) {
    for (const id of this.justPressed) {
      const p = this.pointers.get(id);
      if (p && Math2.dist(p.x, p.y, cx, cy) <= r) return true;
    }
    return false;
  }
}

// ── AUDIO ENGINE ─────────────────────────────────────────────────────────────
export class AudioEngine {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._sfxPool = new Map();
    this._music = null;
    this.muted = false;
  }
  _init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.connect(this._ctx.destination);
      this._masterGain.gain.value = 0.7;
    } catch {}
  }
  _tone(freq, dur, type = "sine", vol = 0.2, delay = 0, attack = 0.01, release = 0.1) {
    if (this.muted) return;
    this._init();
    const c = this._ctx; if (!c) return;
    try {
      const o = c.createOscillator();
      const g = c.createGain();
      o.connect(g); g.connect(this._masterGain);
      o.type = type;
      o.frequency.setValueAtTime(freq, c.currentTime + delay);
      g.gain.setValueAtTime(0, c.currentTime + delay);
      g.gain.linearRampToValueAtTime(vol, c.currentTime + delay + attack);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + dur);
      o.start(c.currentTime + delay);
      o.stop(c.currentTime + delay + dur + 0.05);
    } catch {}
  }
  play(name, options = {}) {
    if (this.muted) return;
    this._init();
    const sounds = {
      correct: () => {
        this._tone(523, .1, "sine", .22); this._tone(659, .1, "sine", .22, .09);
        this._tone(784, .25, "sine", .22, .18); this._tone(1047, .3, "sine", .15, .28);
      },
      wrong: () => {
        this._tone(220, .18, "sawtooth", .2); this._tone(160, .22, "sawtooth", .16, .14);
      },
      tap: () => {
        this._tone(900, .05, "sine", .2); this._tone(1200, .03, "sine", .15, .04);
      },
      miss: () => this._tone(180, .12, "sawtooth", .15),
      streak: () => [523,587,659,784,1047].forEach((f,i) => this._tone(f,.1,"sine",.18,i*.07)),
      jackpot: () => {
        [523,659,784,1047,1319,1568].forEach((f,i) => this._tone(f,.12,"sine",.22,i*.055));
        this._tone(1047,.7,"sine",.1,.5);
      },
      levelUp: () => [392,494,587,784,1047].forEach((f,i) => this._tone(f,.2,"sine",.22,i*.09)),
      click: () => this._tone(600,.04,"sine",.1),
      countdown: () => this._tone(440,.15,"square",.2),
      go: () => { this._tone(660,.08,"sine",.28); this._tone(880,.15,"sine",.24,.09); this._tone(1100,.2,"sine",.2,.18); },
      combo: () => { this._tone(660,.1,"sine",.22); this._tone(880,.12,"sine",.2,.08); this._tone(1100,.15,"sine",.18,.16); },
      boost: () => { this._tone(440,.08,"square",.15); this._tone(880,.15,"sine",.2,.08); },
      brake: () => { this._tone(200,.15,"sawtooth",.18); },
      tick: () => this._tone(880,.03,"square",.06),
      danger: () => this._tone(110,.1,"sawtooth",.22),
      swoosh: () => this._tone(400,.06,"sine",.1),
      boss: () => [60,45,35].forEach((f,i) => this._tone(f,.4,"sawtooth",.28,i*.28)),
      beat: () => { this._tone(60,.08,"sine",.18); this._tone(120,.05,"sine",.1,.06); },
      hitBeat: () => { this._tone(523,.1,"sine",.25); this._tone(660,.08,"sine",.2,.07); },
    };
    sounds[name]?.();
  }
  tts(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9; u.pitch = 1; window.speechSynthesis.speak(u);
    }
  }
}

// ── RENDERER ──────────────────────────────────────────────────────────────────
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = canvas.width;
    this.height = canvas.height;
    this._setupCanvas();
  }
  _setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width;
    this.height = rect.height;
  }
  clear(color = "#07070f") {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (color) { this.ctx.fillStyle = color; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  }
  // Rounded rect
  roundRect(x, y, w, h, r, fill, stroke, strokeW = 1) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeW; ctx.stroke(); }
  }
  // Glow effect
  glow(color, blur) {
    this.ctx.shadowColor = color; this.ctx.shadowBlur = blur;
  }
  clearGlow() { this.ctx.shadowBlur = 0; }
  // Text with glow
  text(str, x, y, options = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${options.weight||"700"} ${options.size||16}px ${options.family||"'Sora',sans-serif"}`;
    ctx.textAlign = options.align || "center";
    ctx.textBaseline = options.baseline || "middle";
    ctx.fillStyle = options.color || "#f0f0ff";
    if (options.glow) { ctx.shadowColor = options.glow; ctx.shadowBlur = options.glowBlur || 12; }
    if (options.stroke) { ctx.strokeStyle = options.stroke; ctx.lineWidth = options.strokeW || 2; ctx.strokeText(str, x, y); }
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  // Gradient fill
  linearGrad(x1, y1, x2, y2, stops) {
    const g = this.ctx.createLinearGradient(x1, y1, x2, y2);
    stops.forEach(([pos, col]) => g.addColorStop(pos, col));
    return g;
  }
  radialGrad(x, y, r1, x2, y2, r2, stops) {
    const g = this.ctx.createRadialGradient(x, y, r1, x2, y2, r2);
    stops.forEach(([pos, col]) => g.addColorStop(pos, col));
    return g;
  }
  // Progress bar
  progressBar(x, y, w, h, progress, bg, fg, radius = 4, glow = null) {
    this.roundRect(x, y, w, h, radius, bg);
    if (glow) { this.ctx.shadowColor = glow; this.ctx.shadowBlur = 8; }
    this.roundRect(x, y, Math.max(0, w * Math.min(1, progress)), h, radius, fg);
    if (glow) this.clearGlow();
  }
  // Circle
  circle(x, y, r, fill, stroke, strokeW = 1) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { this.ctx.fillStyle = fill; this.ctx.fill(); }
    if (stroke) { this.ctx.strokeStyle = stroke; this.ctx.lineWidth = strokeW; this.ctx.stroke(); }
  }
  // Screen overlay flash
  flash(color, alpha = 0.3) {
    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
  }
  // Scanline effect
  scanlines(alpha = 0.03) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let y = 0; y < this.height; y += 3) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, y, this.width, 1);
    }
    ctx.restore();
  }
  // Vignette
  vignette(strength = 0.4) {
    const g = this.radialGrad(this.width/2, this.height/2, this.height*0.3, this.width/2, this.height/2, this.height*0.8, [
      [0, "rgba(0,0,0,0)"], [1, `rgba(0,0,0,${strength})`]
    ]);
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}

// ── GAME ENGINE ───────────────────────────────────────────────────────────────
export class GameEngine {
  constructor(canvas, options = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this.audio = new AudioEngine();
    this.camera = new Camera();
    this.particles = new ParticleSystem();
    this.tweens = [];
    this.scene = null;
    this.running = false;
    this._lastTime = 0;
    this._frameId = null;
    this.fps = 0;
    this._fpsFrames = 0;
    this._fpsTimer = 0;
    this.time = 0;
    this.options = options;
  }
  setScene(scene) {
    this.scene?.destroy?.();
    this.scene = scene;
    scene.engine = this;
    scene.renderer = this.renderer;
    scene.input = this.input;
    scene.audio = this.audio;
    scene.camera = this.camera;
    scene.particles = this.particles;
    scene.init?.();
  }
  tween(target, props, duration, ease, onComplete) {
    const t = new Tween(target, props, duration, ease, onComplete);
    this.tweens.push(t);
    return t;
  }
  start() {
    if (this.running) return;
    this.running = true;
    this._lastTime = performance.now();
    this._loop(this._lastTime);
  }
  stop() {
    this.running = false;
    if (this._frameId) cancelAnimationFrame(this._frameId);
  }
  _loop(now) {
    if (!this.running) return;
    this._frameId = requestAnimationFrame(t => this._loop(t));
    const dt = Math.min((now - this._lastTime) / 1000, 0.05); // cap at 50ms
    this._lastTime = now;
    this.time += dt;
    // FPS counter
    this._fpsFrames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 1) { this.fps = this._fpsFrames; this._fpsFrames = 0; this._fpsTimer = 0; }
    // Update
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
  resize() {
    this.renderer._setupCanvas();
  }
}

// ── BASE SCENE ────────────────────────────────────────────────────────────────
export class Scene {
  constructor() {
    this.engine = null; this.renderer = null; this.input = null;
    this.audio = null; this.camera = null; this.particles = null;
  }
  init() {}
  update(dt) {}
  draw(renderer) {}
  destroy() {}
}

// ── UI BUTTON (canvas) ────────────────────────────────────────────────────────
export class CanvasButton {
  constructor(x, y, w, h, label, options = {}) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.label = label;
    this.color = options.color || "#fbbf24";
    this.textColor = options.textColor || "#07070f";
    this.radius = options.radius || 12;
    this.fontSize = options.fontSize || 14;
    this.hover = false;
    this.scale = 1;
    this._targetScale = 1;
    this.alpha = options.alpha || 1;
    this.onClick = options.onClick || null;
    this.glow = options.glow || false;
    this.disabled = options.disabled || false;
    this.sublabel = options.sublabel || "";
    this.icon = options.icon || "";
  }
  update(input) {
    if (this.disabled) return;
    const hit = input.hitTest(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    this._targetScale = hit ? 1.05 : 1.0;
    this.scale = Math2.lerp(this.scale, this._targetScale, 0.2);
    if (input.wasHit(this.x - this.w/2, this.y - this.h/2, this.w, this.h)) {
      this.onClick?.();
    }
  }
  draw(renderer) {
    const ctx = renderer.ctx;
    ctx.save();
    ctx.globalAlpha = this.disabled ? 0.35 : this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    if (this.glow) { ctx.shadowColor = this.color; ctx.shadowBlur = 16; }
    // Background
    const x = -this.w/2, y = -this.h/2;
    renderer.roundRect(x, y, this.w, this.h, this.radius, this.color);
    // Shine
    ctx.globalAlpha *= 0.3;
    renderer.roundRect(x+2, y+2, this.w-4, this.h/2-2, this.radius-1, "rgba(255,255,255,.3)");
    ctx.globalAlpha = this.disabled ? 0.35 : this.alpha;
    ctx.shadowBlur = 0;
    // Text
    ctx.fillStyle = this.textColor;
    ctx.font = `800 ${this.fontSize}px 'Sora',sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const textY = this.sublabel ? -6 : 0;
    ctx.fillText(this.icon ? `${this.icon} ${this.label}` : this.label, 0, textY);
    if (this.sublabel) {
      ctx.font = `500 ${this.fontSize - 3}px 'Sora',sans-serif`;
      ctx.globalAlpha *= 0.6;
      ctx.fillText(this.sublabel, 0, textY + 16);
    }
    ctx.restore();
  }
}
