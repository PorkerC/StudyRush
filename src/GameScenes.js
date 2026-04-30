// ╔══════════════════════════════════════════════════════════════╗
// ║           STUDYRUSH GAME SCENES v3.0                        ║
// ║  5 arcade games — clean, functional, addictive              ║
// ╚══════════════════════════════════════════════════════════════╝

import { Scene, M, CBtn } from "./GameEngine.js";

// ── SHARED CONSTANTS ──────────────────────────────────────────────────────────
const C = {
  bg:    "#07070f",
  panel: "rgba(255,255,255,.05)",
  panelB:"rgba(255,255,255,.11)",
  text:  "#f0f0ff",
  muted: "rgba(255,255,255,.42)",
  y: "#fbbf24", r: "#f87171", g: "#34d399", b: "#60a5fa",
  p: "#c084fc", o: "#fb923c",
};
const CORRECT_COLORS = ["#34d399","#6ee7b7","#fbbf24","#a3e635","#60a5fa","#fff"];
const WRONG_COLORS   = ["#f87171","#fb923c","#ff6060"];
const LETTERS        = ["A","B","C","D"];
const LETTER_COLORS  = ["#fbbf24","#f87171","#34d399","#60a5fa"];

// ── SHARED: SCORE POPUP SYSTEM ────────────────────────────────────────────────
class PopupSystem {
  constructor() { this._pops = []; }
  add(x, y, text, col) { this._pops.push({ x, y, text, col, a: 1, vy: -1.2 }); }
  update(dt) { this._pops = this._pops.map(p => ({ ...p, y: p.y + p.vy * dt * 60, a: p.a - dt * 1.4 })).filter(p => p.a > 0); }
  draw(r) {
    this._pops.forEach(p => {
      const ctx = r.ctx;
      ctx.save(); ctx.globalAlpha = Math.max(0, p.a);
      r.text(p.text, p.x, p.y, { s: 20, w: "900", c: p.col, glow: p.col, gb: 10, a: "center" });
      ctx.restore();
    });
  }
}

// ── SHARED: COUNTDOWN + PHASE MANAGEMENT ─────────────────────────────────────
class GameBase extends Scene {
  // Call in subclass init()
  _baseInit(gameLabel, accentCol, onReady) {
    this._label    = gameLabel;
    this._accent   = accentCol;
    this._onReady  = onReady;
    this._phase    = "countdown"; // countdown | play | over
    this._cdCount  = 3;
    this._cdTimer  = 0;
    this._cdDur    = 0.85;
    this._cdScale  = 0;
    this._cdAlpha  = 1;
    this._flash    = 0;
    this._flashCol = C.g;
    this._pops     = new PopupSystem();
    this._combo    = 0;
    this._maxCombo = 0;
    this._comboFlash = 0;
  }
  _updateCountdown(dt) {
    this._cdTimer += dt;
    const t = Math.min(this._cdTimer / this._cdDur, 1);
    this._cdScale = M.ease.outBack(t);
    this._cdAlpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
    if (this._cdTimer >= this._cdDur) {
      this._cdTimer  = 0;
      this._cdCount--;
      if (this._cdCount > 0) this.audio.play("countdown");
      else { this.audio.play("go"); this._phase = "play"; this._onReady?.(); }
    }
  }
  _drawCountdown(r) {
    const { W, H } = r, ctx = r.ctx;
    // Clean dark background
    r.clear(C.bg);
    // Subtle accent glow
    ctx.save();
    ctx.globalAlpha = 0.06;
    const g = r.rgrad(W / 2, H / 2, 0, W / 2, H / 2, Math.min(W, H) * 0.7,
      [[0, this._accent], [1, "transparent"]]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // Game label
    r.text(this._label, W / 2, H * 0.25, { s: 13, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "center" });
    // Number
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this._cdScale, this._cdScale);
    ctx.globalAlpha = Math.max(0, this._cdAlpha);
    // Ring
    ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2);
    ctx.strokeStyle = this._accent + "33"; ctx.lineWidth = 2; ctx.stroke();
    // Number
    const num = this._cdCount > 0 ? String(this._cdCount) : "GO!";
    const sz  = this._cdCount > 0 ? 96 : 60;
    ctx.shadowColor = this._accent; ctx.shadowBlur = 30;
    ctx.font = `900 ${sz}px 'Bebas Neue',sans-serif`;
    ctx.fillStyle = this._cdCount > 0 ? "#fff" : this._accent;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(num, 0, 0);
    ctx.restore();
    r.scanlines(0.018);
  }
  _baseUpdate(dt) {
    this._flash = Math.max(0, this._flash - dt * 5);
    this._comboFlash = Math.max(0, this._comboFlash - dt * 3);
    this._pops.update(dt);
  }
  _onCorrect(x, y, pts) {
    this._combo++;
    if (this._combo > this._maxCombo) this._maxCombo = this._combo;
    const bonus = this._combo >= 3 ? Math.round(pts * (1 + this._combo * 0.2)) : pts;
    this._flash = 0.12; this._flashCol = C.g;
    this._pops.add(x, y - 20, `+${bonus}`, C.g);
    this.audio.play(this._combo >= 4 ? "combo" : "tap");
    this.particles.burst(x, y, { count: 20, colors: CORRECT_COLORS, maxSpd: 8, glow: true, ay: 0.12 });
    if (this._combo >= 3) { this.camera.shake(4); this._comboFlash = 1; }
    return bonus;
  }
  _onWrong(x, y) {
    this._combo = 0;
    this._flash = 0.1; this._flashCol = C.r;
    this._pops.add(x, y - 20, "✕", C.r);
    this.audio.play("miss");
    this.particles.burst(x, y, { count: 10, colors: WRONG_COLORS, maxSpd: 5, ay: 0.2 });
    this.camera.shake(6);
  }
  // Draw the question panel — top area of screen
  _drawQuestionPanel(r, question, qIdx, qTotal, score, accentCol) {
    const { W, H } = r;
    const panH = H * 0.22;
    // Panel background
    r.rr(0, 0, W, panH + 2, 0, "rgba(0,0,0,.55)");
    // Accent line at bottom of panel
    const grad = r.lgrad(0, panH, W, panH, [[0, "transparent"], [0.2, accentCol + "66"], [0.8, accentCol + "66"], [1, "transparent"]]);
    r.ctx.fillStyle = grad; r.ctx.fillRect(0, panH - 2, W, 2);
    // Progress bar
    r.bar(W * 0.05, 10, W * 0.9, 5, qIdx / qTotal, "rgba(255,255,255,.08)", accentCol, 3, accentCol);
    // Q counter + score
    r.text(`Q ${qIdx + 1} / ${qTotal}`, W * 0.05, 24, { s: 10, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "left", b: "middle" });
    r.text(String(score), W * 0.95, 24, { s: 14, w: "900", c: accentCol, glow: accentCol, gb: 8, a: "right", b: "middle" });
    // Combo badge
    if (this._combo >= 2) {
      const scale = 1 + this._comboFlash * 0.3;
      r.ctx.save(); r.ctx.translate(W / 2, 24); r.ctx.scale(scale, scale);
      r.text(`🔥 ×${this._combo}`, 0, 0, { s: 12, w: "800", c: C.o, glow: C.o, gb: 8, a: "center", b: "middle" });
      r.ctx.restore();
    }
    // Question text — word wrapped
    r.textWrap(question, W / 2, 42, W * 0.9, { s: 15, w: "700", c: C.text, a: "center", b: "top", lh: 22 });
  }
  // Draw over / result screen
  _drawOver(r, title, titleCol, score, stats, btn) {
    const { W, H } = r, ctx = r.ctx;
    r.clear(C.bg);
    // Glow
    ctx.save(); ctx.globalAlpha = 0.08;
    const g = r.rgrad(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.6, [[0, titleCol], [1, "transparent"]]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    // Icon + title
    r.text(title, W / 2, H * 0.22, { s: 36, w: "900", c: titleCol, f: "'Bebas Neue',sans-serif", glow: titleCol, gb: 20, a: "center" });
    // Score
    r.text(String(score), W / 2, H * 0.38, { s: 58, w: "900", c: "#fff", glow: titleCol, gb: 14, a: "center" });
    r.text("POINTS", W / 2, H * 0.48, { s: 11, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "center" });
    // Stats grid
    const entries = Object.entries(stats);
    const sw = Math.min(110, (W - 40) / entries.length - 8);
    const gap = 8;
    let sx = W / 2 - (entries.length * (sw + gap) - gap) / 2 + sw / 2;
    entries.forEach(([lbl, val]) => {
      r.rr(sx - sw / 2, H * 0.57 - 24, sw, 50, 10, "rgba(255,255,255,.06)", "rgba(255,255,255,.1)");
      r.text(String(val), sx, H * 0.57 - 3, { s: 18, w: "900", c: C.text, a: "center" });
      r.text(lbl, sx, H * 0.57 + 17, { s: 9, w: "600", c: C.muted, f: "'Space Mono',monospace", a: "center" });
      sx += sw + gap;
    });
    btn?.draw(r);
    r.scanlines(0.018);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// ⚡ LIGHTNING TAP
// A single answer option appears for a limited time — tap it if it's correct.
// Options rotate through A B C D one at a time. Speed increases.
// ══════════════════════════════════════════════════════════════════════════════
export class LightningTap extends GameBase {
  constructor(qs, onFinish) {
    super();
    this.qs = qs.filter(q => q.type === "mc" && q.options?.length === 4);
    this.onFinish = onFinish;
  }
  init() {
    this._baseInit("⚡  LIGHTNING TAP", C.y, () => this._startGame());
    this.audio.play("countdown");
    this.qIdx    = 0;
    this.score   = 0;
    this.hits    = 0;
    this.misses  = 0;
    this.showMs  = 1300; // ms to show each option
    // Per-question state
    this._optIdx   = 0;  // which option (0-3) is currently showing
    this._optTimer = 0;
    this._showOpt  = false;
    this._answered = false;
    this._resultTimer = 0;
    this._resultText  = "";
    this._resultOk    = false;
    this._btn         = null;
    this._needBuild   = false;
    this._continueBtn = null;
  }
  _startGame() {
    this._needBuild = true;
  }
  get q() { return this.qs[this.qIdx]; }
  _buildOpt() {
    if (!this.q) return;
    const { W, H } = this.renderer;
    // Show one option at a time in a large centered button
    const opt = this.q.options[this._optIdx];
    const letter = LETTERS[this._optIdx];
    const col = LETTER_COLORS[this._optIdx];
    const isCorrect = opt.startsWith(this.q.answer);
    this._currentOpt = { opt, letter, col, isCorrect, x: W / 2, y: H * 0.62, w: Math.min(W * 0.82, 420), h: 70 };
    this._optTimer = this.showMs / 1000;
    this._showOpt  = true;
  }
  _nextOption() {
    this._optIdx = (this._optIdx + 1) % 4;
    this._buildOpt();
  }
  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "over") { this._continueBtn?.update(this.input); return; }
    this._baseUpdate(dt);
    if (this._needBuild) { this._needBuild = false; this._optIdx = M.randInt(0, 3); this._buildOpt(); }
    // Show result briefly then next
    if (this._answered) {
      this._resultTimer -= dt;
      if (this._resultTimer <= 0) { this._answered = false; this._advance(); }
      return;
    }
    if (!this._showOpt || !this._currentOpt) return;
    this._optTimer -= dt;
    if (this._optTimer <= 0) {
      // Time ran out on this option
      if (this._currentOpt.isCorrect) {
        // Missed the correct answer
        this.misses++; this._combo = 0;
        this._flash = 0.08; this._flashCol = C.r;
        this.audio.play("miss");
        this._answered = true; this._resultOk = false; this._resultTimer = 0.4;
      } else {
        // Wrong option expired — good, move on
        this._nextOption();
      }
    }
    // Input
    const c = this._currentOpt;
    if (this.input.wasHit(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h)) {
      clearTimeout(this._to);
      if (c.isCorrect) {
        const pts = this._onCorrect(c.x, c.y, 10);
        this.score += pts; this.hits++;
        this._answered = true; this._resultOk = true; this._resultTimer = 0.35;
      } else {
        this._onWrong(c.x, c.y);
        this.misses++;
        this._answered = true; this._resultOk = false; this._resultTimer = 0.4;
      }
      this._showOpt = false;
    }
  }
  _advance() {
    this.qIdx++;
    if (this.qIdx >= this.qs.length) { this._finish(); return; }
    this.showMs = Math.max(380, this.showMs - 55);
    this._optIdx = M.randInt(0, 3);
    this._buildOpt();
  }
  _finish() {
    this._phase = "over"; this.audio.play("streak");
    const { W, H } = this.renderer;
    this._continueBtn = new CBtn(W / 2, H * 0.82, 200, 52, "Continue →",
      { col: C.y, txtCol: "#0a0a14", glow: true, onClick: () => this.onFinish(this.score, { "Hits": this.hits, "Misses": this.misses, "Max Combo": this._maxCombo }) });
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx;
    if (this._phase === "countdown") { this._drawCountdown(r); return; }
    if (this._phase === "over") {
      this._drawOver(r, "ROUND OVER", C.y, this.score, { "Hits": this.hits, "Misses": this.misses, "Max Combo": this._maxCombo }, this._continueBtn);
      return;
    }
    r.clear(C.bg);
    if (this._flash > 0) r.flash(this._flashCol, this._flash);
    // Question panel
    if (this.q) this._drawQuestionPanel(r, this.q.question, this.qIdx, this.qs.length, this.score, C.y);
    // Option display zone
    const zoneY = H * 0.28;
    const zoneH = H - zoneY - 20;
    // Timer bar under panel
    const optDur = this.showMs / 1000;
    const timerRatio = this._showOpt && !this._answered ? this._optTimer / optDur : 0;
    const tCol = timerRatio > 0.5 ? C.g : timerRatio > 0.25 ? C.y : C.r;
    r.bar(0, H * 0.22 + 4, W, 6, timerRatio, "rgba(255,255,255,.07)", tCol, 0, tCol);
    // Instruction
    r.text("TAP IF CORRECT →", W / 2, zoneY + 24, { s: 11, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "center" });
    // Option box
    if (this._showOpt && !this._answered && this._currentOpt) {
      const c = this._currentOpt;
      const hover = r.input?.hit?.(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h) ||
                    this.input.hit(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
      // Pulse effect based on timer
      const urgency = 1 - timerRatio;
      const borderAlpha = 0.3 + urgency * 0.5;
      ctx.save();
      ctx.shadowColor = c.col; ctx.shadowBlur = 10 + urgency * 20;
      r.rr(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 16,
        hover ? `${c.col}18` : "rgba(255,255,255,.06)",
        `${c.col}${Math.round(borderAlpha * 255).toString(16).padStart(2,"0")}`, 1.5 + urgency);
      ctx.shadowBlur = 0; ctx.restore();
      // Letter badge
      r.rr(c.x - c.w / 2 + 12, c.y - 18, 36, 36, 8, c.col + "22", c.col + "66");
      r.text(c.letter, c.x - c.w / 2 + 30, c.y, { s: 16, w: "900", c: c.col, a: "center", b: "middle" });
      // Option text
      r.text(c.opt.replace(/^[A-D]\.\s*/, ""), c.x + 12, c.y, { s: 15, w: "700", c: C.text, a: "left", b: "middle" });
    }
    // Result flash
    if (this._answered) {
      r.text(this._resultOk ? "✓ CORRECT!" : "✗ WRONG", W / 2, H * 0.62, {
        s: 32, w: "900", c: this._resultOk ? C.g : C.r, glow: this._resultOk ? C.g : C.r, gb: 16, a: "center"
      });
    }
    this._pops.draw(r);
    r.scanlines(0.018); r.vignette(0.3);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎯 AIM TRAINER
// Top 25%: question + A B C D labels
// Bottom 75%: A B C D circles move around — click the correct letter
// ══════════════════════════════════════════════════════════════════════════════
export class AimTrainer extends GameBase {
  constructor(qs, onFinish) {
    super();
    this.qs = qs.filter(q => q.type === "mc" && q.options?.length === 4);
    this.onFinish = onFinish;
  }
  init() {
    this._baseInit("🎯  AIM TRAINER", C.o, () => this._startGame());
    this.audio.play("countdown");
    this.qIdx = 0; this.score = 0; this.hits = 0; this.misses = 0;
    this._targets    = [];
    this._needSpawn  = false;
    this._answered   = false;
    this._hitAnim    = null;   // {letter, x, y, t}
    this._missAnim   = null;
    this._animTimer  = null;
    this._continueBtn= null;
  }
  _startGame() { this._needSpawn = true; }
  get q() { return this.qs[this.qIdx]; }
  _spawn() {
    if (!this.q) return;
    const { W, H } = this.renderer;
    const zoneTop = H * 0.28;  // below question panel
    const zoneBot = H - 60;
    const margin  = 48;
    this._targets = LETTERS.map((let_, i) => {
      const isCorrect = this.q.options[i]?.startsWith(this.q.answer) ?? false;
      const r = isCorrect ? 34 : 27;
      return {
        letter: let_,
        col:    LETTER_COLORS[i],
        isCorrect,
        r,
        x: M.rand(margin + r, W - margin - r),
        y: M.rand(zoneTop + r + 10, zoneBot - r),
        vx: M.rand(-1.1, 1.1) * (isCorrect ? 0.85 : 1.3),
        vy: M.rand(-0.9, 0.9) * (isCorrect ? 0.85 : 1.3),
        pulse: Math.random() * Math.PI * 2,
        scale: 1, targetScale: 1,
        ringAnim: 1.5, // starts large then collapses to normal
      };
    });
  }
  _spawnNext() {
    this.qIdx++;
    if (this.qIdx >= this.qs.length) { this._finish(); return; }
    this._answered = false;
    this._targets  = [];
    // Small delay then spawn
    this._spawnDelay = 0.28;
  }
  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "over")      { this._continueBtn?.update(this.input); return; }
    this._baseUpdate(dt);
    if (this._needSpawn) { this._needSpawn = false; this._spawn(); }
    if (this._spawnDelay > 0) { this._spawnDelay -= dt; if (this._spawnDelay <= 0) this._spawn(); return; }
    // Hit anim decay
    if (this._hitAnim) { this._hitAnim.t -= dt; if (this._hitAnim.t <= 0) this._hitAnim = null; }
    const { W, H } = this.renderer;
    const zoneTop = H * 0.28;
    // Move targets
    this._targets.forEach(t => {
      t.x += t.vx; t.y += t.vy;
      if (t.x - t.r < 0 || t.x + t.r > W) { t.vx *= -1; t.x = M.clamp(t.x, t.r, W - t.r); }
      if (t.y - t.r < zoneTop || t.y + t.r > H - 50) { t.vy *= -1; t.y = M.clamp(t.y, zoneTop + t.r, H - 50 - t.r); }
      t.pulse += dt * 2.5;
      t.ringAnim = Math.max(1, t.ringAnim - dt * 3);
      t.targetScale = this.input.hit(t.x - t.r - 6, t.y - t.r - 6, (t.r + 6) * 2, (t.r + 6) * 2) ? 1.08 : 1;
      t.scale = M.lerp(t.scale, t.targetScale, 0.18);
    });
    if (this._answered) return;
    // Check hits
    for (const t of this._targets) {
      if (this.input.wasCircle(t.x, t.y, t.r + 8)) {
        if (t.isCorrect) {
          const pts = this._onCorrect(t.x, t.y, 20);
          this.score += pts; this.hits++;
          this._hitAnim = { letter: t.letter, x: t.x, y: t.y, t: 0.5, col: t.col };
          this._answered = true;
          this._spawnNext();
        } else {
          this._onWrong(t.x, t.y);
          this.misses++;
          // Keep playing — don't end on wrong click
        }
        break;
      }
    }
  }
  _finish() {
    this._phase = "over"; this.audio.play("streak");
    const { W, H } = this.renderer;
    const acc = Math.round(this.hits / (this.hits + this.misses || 1) * 100);
    this._continueBtn = new CBtn(W / 2, H * 0.82, 200, 52, "Continue →",
      { col: C.o, txtCol: "#fff", glow: true, onClick: () => this.onFinish(this.score, { "Hits": this.hits, "Misses": this.misses, "Accuracy": `${acc}%` }) });
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx;
    if (this._phase === "countdown") { this._drawCountdown(r); return; }
    if (this._phase === "over") {
      const acc = Math.round(this.hits / (this.hits + this.misses || 1) * 100);
      this._drawOver(r, "MISSION COMPLETE", C.o, this.score, { "Hits": this.hits, "Misses": this.misses, "Accuracy": `${acc}%` }, this._continueBtn);
      return;
    }
    r.clear(C.bg);
    if (this._flash > 0) r.flash(this._flashCol, this._flash);
    // Question panel (top 25%)
    if (this.q) {
      this._drawQuestionPanel(r, this.q.question, this.qIdx, this.qs.length, this.score, C.o);
      // Answer key labels (small, right side of panel)
      const panH = H * 0.22;
      LETTERS.forEach((l, i) => {
        const opt = (this.q.options[i] || "").replace(/^[A-D]\.\s*/, "").slice(0, 22);
        const col = LETTER_COLORS[i];
        r.rr(W * 0.5 - 10 + (i % 2) * (W * 0.26), panH + 8 + Math.floor(i / 2) * 18, W * 0.23, 15, 4, col + "20", col + "44");
        r.text(`${l}: ${opt}`, W * 0.5 + (i % 2) * (W * 0.26) + W * 0.115, panH + 15.5 + Math.floor(i / 2) * 18, { s: 9, w: "600", c: col, a: "center", b: "middle", f: "'Space Mono',monospace" });
      });
    }
    // Zone separator
    const zoneTop = H * 0.28;
    ctx.save(); ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.moveTo(0, zoneTop); ctx.lineTo(W, zoneTop); ctx.stroke();
    ctx.restore();
    // Instruction
    r.text("CLICK THE CORRECT LETTER", W / 2, zoneTop + 18, { s: 10, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "center" });
    // Targets
    this._targets.forEach(t => {
      ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.scale, t.scale);
      // Ring that collapses on spawn
      if (t.ringAnim > 1) {
        ctx.globalAlpha = (t.ringAnim - 1) * 0.4;
        ctx.beginPath(); ctx.arc(0, 0, t.r * t.ringAnim, 0, Math.PI * 2);
        ctx.strokeStyle = t.col; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Pulse ring
      const pls = Math.sin(t.pulse) * 0.12 + 0.88;
      ctx.globalAlpha = 0.15 * pls;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = t.col; ctx.fill();
      ctx.globalAlpha = 1;
      // Main circle
      ctx.shadowColor = t.col; ctx.shadowBlur = t.isCorrect ? 18 : 10;
      ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI * 2);
      ctx.fillStyle = t.isCorrect ? `${t.col}28` : "rgba(255,255,255,.07)";
      ctx.fill(); ctx.strokeStyle = t.col; ctx.lineWidth = t.isCorrect ? 2.5 : 1.5; ctx.stroke();
      // Inner crosshair rings
      [t.r * 0.5, t.r * 0.78].forEach(ri => {
        ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, ri, 0, Math.PI * 2);
        ctx.strokeStyle = t.col; ctx.lineWidth = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      });
      ctx.shadowBlur = 0;
      // Letter
      r.text(t.letter, 0, 0, { s: t.isCorrect ? 17 : 14, w: "900", c: t.col, a: "center", b: "middle", f: "'Space Mono',monospace" });
      ctx.restore();
    });
    this._pops.draw(r);
    r.scanlines(0.018); r.vignette(0.3);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 💥 ANSWER BLITZ
// Question at top. A B C D answer bubbles float in the bottom zone.
// Tap the correct one. Wrong ones bounce back. Correct → next question.
// 45-second timer.
// ══════════════════════════════════════════════════════════════════════════════
export class AnswerBlitz extends GameBase {
  constructor(qs, onFinish) {
    super();
    this.qs = qs.filter(q => q.type === "mc" && q.options?.length === 4);
    this.onFinish = onFinish;
  }
  init() {
    this._baseInit("💥  ANSWER BLITZ", C.r, () => this._startGame());
    this.audio.play("countdown");
    this.qIdx = 0; this.score = 0; this.hits = 0;
    this._timeLeft   = 45;
    this._bubbles    = [];
    this._needSpawn  = false;
    this._timerInt   = null;
    this._answered   = false;
    this._continueBtn = null;
  }
  _startGame() {
    this._needSpawn = true;
    this._timerInt = setInterval(() => {
      this._timeLeft--;
      if (this._timeLeft <= 10) this.audio.play("tick");
      if (this._timeLeft <= 0) { clearInterval(this._timerInt); this._finish(); }
    }, 1000);
  }
  destroy() { clearInterval(this._timerInt); }
  get q() { return this.qs[this.qIdx]; }
  _spawn() {
    if (!this.q) return;
    const { W, H } = this.renderer;
    const zoneTop = H * 0.26;
    const margin  = 60;
    // Place 4 bubbles in a scattered grid
    const positions = [
      { x: W * 0.25, y: H * 0.48 },
      { x: W * 0.75, y: H * 0.48 },
      { x: W * 0.25, y: H * 0.72 },
      { x: W * 0.75, y: H * 0.72 },
    ];
    // Randomize positions slightly
    this._bubbles = LETTERS.map((let_, i) => {
      const base = positions[i];
      const isCorrect = (this.q.options[i] || "").startsWith(this.q.answer);
      return {
        letter: let_,
        col:    LETTER_COLORS[i],
        isCorrect,
        text:   (this.q.options[i] || "").replace(/^[A-D]\.\s*/, "").slice(0, 24),
        x: base.x + M.rand(-W * 0.08, W * 0.08),
        y: base.y + M.rand(-H * 0.04, H * 0.04),
        vx: M.rand(-0.4, 0.4),
        vy: M.rand(-0.3, 0.3),
        w: Math.min(W * 0.38, 180),
        h: 56,
        scale: 0,    // animate in
        targetScale: 1,
        pulse: Math.random() * Math.PI * 2,
        hitAnim: 0,  // wrong-answer bounce
      };
    });
    this._answered = false;
  }
  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "over")      { this._continueBtn?.update(this.input); return; }
    this._baseUpdate(dt);
    if (this._needSpawn) { this._needSpawn = false; this._spawn(); }
    const { W, H } = this.renderer;
    const zoneTop = H * 0.26;
    this._bubbles.forEach(b => {
      // Animate in
      b.scale = M.lerp(b.scale, b.targetScale, 0.14);
      b.pulse += dt * 1.8;
      b.hitAnim = Math.max(0, b.hitAnim - dt * 4);
      // Float gently
      b.x += b.vx; b.y += b.vy;
      if (b.x - b.w / 2 < 10)    { b.vx =  Math.abs(b.vx); }
      if (b.x + b.w / 2 > W - 10){ b.vx = -Math.abs(b.vx); }
      if (b.y - b.h / 2 < zoneTop + 10) { b.vy =  Math.abs(b.vy); }
      if (b.y + b.h / 2 > H - 20)       { b.vy = -Math.abs(b.vy); }
      // Input
      if (!this._answered && this.input.wasHit(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h)) {
        if (b.isCorrect) {
          const pts = this._onCorrect(b.x, b.y, 15);
          this.score += pts; this.hits++;
          this._answered = true;
          this.qIdx++;
          if (this.qIdx >= this.qs.length) { clearInterval(this._timerInt); this._finish(); return; }
          this._needSpawn = true;
        } else {
          this._onWrong(b.x, b.y);
          b.hitAnim = 1;
          // Bounce away
          b.vx = M.rand(-1.5, 1.5); b.vy = M.rand(-1.5, 0);
        }
      }
    });
  }
  _finish() {
    this._phase = "over"; this.audio.play("streak");
    const { W, H } = this.renderer;
    this._continueBtn = new CBtn(W / 2, H * 0.82, 200, 52, "Continue →",
      { col: C.r, txtCol: "#fff", glow: true, onClick: () => this.onFinish(this.score, { "Correct": this.hits, "Max Combo": this._maxCombo, "Time Left": `${this._timeLeft}s` }) });
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx;
    if (this._phase === "countdown") { this._drawCountdown(r); return; }
    if (this._phase === "over") {
      this._drawOver(r, "BLITZ OVER!", C.r, this.score, { "Correct": this.hits, "Max Combo": this._maxCombo, "Time Left": `${this._timeLeft}s` }, this._continueBtn);
      return;
    }
    r.clear(C.bg);
    if (this._flash > 0) r.flash(this._flashCol, this._flash);
    if (this.q) this._drawQuestionPanel(r, this.q.question, this.qIdx, this.qs.length, this.score, C.r);
    // Timer
    const tRatio = this._timeLeft / 45;
    const tCol = tRatio > 0.5 ? C.g : tRatio > 0.25 ? C.y : C.r;
    r.bar(W * 0.04, H * 0.24, W * 0.92, 8, tRatio, "rgba(255,255,255,.07)", tCol, 4, tCol);
    r.text(`${this._timeLeft}s`, W / 2, H * 0.24 + 4, { s: 10, w: "700", c: tCol, a: "center", b: "middle", f: "'Space Mono',monospace" });
    // Bubbles
    this._bubbles.forEach(b => {
      ctx.save(); ctx.translate(b.x, b.y);
      // Wrong hit shake
      if (b.hitAnim > 0) { ctx.translate(Math.sin(b.hitAnim * 20) * 5 * b.hitAnim, 0); }
      ctx.scale(b.scale, b.scale);
      const pulse = Math.sin(b.pulse) * 0.04 + 0.96;
      ctx.scale(pulse, pulse);
      // Glow for correct
      if (b.isCorrect) { ctx.shadowColor = b.col; ctx.shadowBlur = 12; }
      r.rr(-b.w / 2, -b.h / 2, b.w, b.h, 14,
        b.isCorrect ? `${b.col}18` : "rgba(255,255,255,.07)",
        b.isCorrect ? `${b.col}88` : "rgba(255,255,255,.18)", b.isCorrect ? 1.8 : 1);
      ctx.shadowBlur = 0;
      // Letter badge
      r.rr(-b.w / 2 + 8, -16, 30, 30, 6, b.col + "30");
      r.text(b.letter, -b.w / 2 + 23, 0, { s: 13, w: "900", c: b.col, a: "center", b: "middle", f: "'Space Mono',monospace" });
      // Answer text
      r.text(b.text, 8, 0, { s: 12, w: "700", c: b.isCorrect ? b.col : C.text, a: "left", b: "middle" });
      ctx.restore();
    });
    this._pops.draw(r);
    r.scanlines(0.018); r.vignette(0.3);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎵 RHYTHM REVIEW
// Question at top. 4 columns (A B C D), each with its answer text.
// Answer tokens fall from the correct column only. Hit the correct column.
// Beat synced at 88 BPM.
// ══════════════════════════════════════════════════════════════════════════════
export class RhythmReview extends GameBase {
  constructor(qs, onFinish) {
    super();
    this.qs = qs.filter(q => q.type === "mc" && q.options?.length === 4);
    this.onFinish = onFinish;
  }
  init() {
    this._baseInit("🎵  RHYTHM REVIEW", C.g, () => this._startGame());
    this.audio.play("countdown");
    this.qIdx = 0; this.score = 0; this.hits = 0;
    this._fallers     = [];
    this._needSpawn   = false;
    this._beatTimer   = 0;
    this._beatOn      = false;
    this._beatPulse   = 0;
    this.BPM          = 88;
    this._beatDur     = 60 / this.BPM;
    this._spawnDelay  = 0;
    this._answered    = false;
    this._missFlash   = 0;
    this._spawnTo     = null;   // setTimeout handle — cleared in destroy()
    this._continueBtn = null;
    // Column layout — computed in first draw
    this._cols        = [];
    this._lineY       = 0;
    this._colsBuilt   = false;
  }
  _buildCols() {
    const { W, H } = this.renderer;
    const panH  = H * 0.22;
    const gap   = 6;
    const cw    = (W - gap * 5) / 4;
    this._cols  = LETTERS.map((l, i) => ({
      letter: l,
      col: LETTER_COLORS[i],
      x: gap + i * (cw + gap) + cw / 2,
      w: cw,
      isCorrect: false, // set per question
    }));
    this._lineY = H * 0.84;
    this._colsBuilt = true;
  }
  _startGame() { this._needSpawn = true; }
  get q() { return this.qs[this.qIdx]; }
  _spawn() {
    if (!this.q || !this._colsBuilt) return;
    // Mark correct column
    const correctIdx = LETTERS.findIndex(l => this.q.answer === l);
    this._cols.forEach((c, i) => c.isCorrect = i === correctIdx);
    // Spawn falling token in correct column only
    const col = this._cols[correctIdx];
    this._fallers = [{
      x: col.x, y: -50, w: col.w - 4, h: 46,
      col: col.col, colIdx: correctIdx,
      vy: 2.2 + Math.random() * 0.6,
    }];
    this._answered = false;
    this._spawnDelay = 0;
  }
  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "over")      { this._continueBtn?.update(this.input); return; }
    if (!this._colsBuilt) { this._buildCols(); }
    this._baseUpdate(dt);
    if (this._needSpawn) { this._needSpawn = false; this._spawn(); }
    this._missFlash = Math.max(0, this._missFlash - dt * 4);
    // Beat
    this._beatTimer += dt;
    if (this._beatTimer >= this._beatDur) {
      this._beatTimer -= this._beatDur;
      this._beatOn = !this._beatOn;
      if (this._beatOn) { this.audio.play("beat"); this._beatPulse = 1; }
    }
    this._beatPulse = Math.max(0, this._beatPulse - dt * 6);
    // Move fallers
    const { H } = this.renderer;
    this._fallers.forEach(f => {
      f.y += f.vy * dt * 60;
    });
    // Remove off-screen fallers
    const missed = this._fallers.filter(f => f.y - f.h / 2 > H);
    if (missed.length > 0 && !this._answered) {
      // Missed the beat — move to next q
      this._missFlash = 0.18;
      this.audio.play("miss"); this._combo = 0;
      this._qNext();
    }
    this._fallers = this._fallers.filter(f => f.y < H + 60);
    // Column tap detection
    if (!this._answered && this._colsBuilt) {
      this._cols.forEach((col, i) => {
        const btnX = col.x - col.w / 2;
        const btnY = H * 0.86;
        const btnH = H - btnY - 8;
        if (this.input.wasHit(btnX, btnY, col.w - 4, btnH)) {
          if (col.isCorrect) {
            const pts = this._onCorrect(col.x, this._lineY, 12);
            this.score += pts; this.hits++;
            this._answered = true;
            this._fallers = [];
            this._qNext();
          } else {
            this._onWrong(col.x, this._lineY);
            this._missFlash = 0.12;
          }
        }
      });
    }
  }
  _qNext() {
    this.qIdx++;
    if (this.qIdx >= this.qs.length) { this._finish(); return; }
    if (this._spawnTo) clearTimeout(this._spawnTo);
    this._spawnTo = setTimeout(() => { this._needSpawn = true; this._spawnTo = null; }, 350);
  }
  destroy() {
    if (this._spawnTo) { clearTimeout(this._spawnTo); this._spawnTo = null; }
  }
  _finish() {
    this._phase = "over"; this.audio.play("streak");
    const { W, H } = this.renderer;
    this._continueBtn = new CBtn(W / 2, H * 0.82, 200, 52, "Continue →",
      { col: C.g, txtCol: "#fff", glow: true, onClick: () => this.onFinish(this.score, { "On Beat": this.hits, "Max Combo": this._maxCombo, "Completion": `${Math.round(this.hits / this.qs.length * 100)}%` }) });
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx;
    if (this._phase === "countdown") { this._drawCountdown(r); return; }
    if (this._phase === "over") {
      this._drawOver(r, "RHYTHM MASTER!", C.g, this.score, { "On Beat": this.hits, "Max Combo": this._maxCombo }, this._continueBtn);
      return;
    }
    if (!this._colsBuilt) this._buildCols();
    r.clear(C.bg);
    if (this._flash > 0)     r.flash(this._flashCol, this._flash);
    if (this._missFlash > 0) r.flash(C.r, this._missFlash);
    // Beat bg pulse
    ctx.save(); ctx.globalAlpha = this._beatPulse * 0.04;
    const gBeat = r.rgrad(W / 2, H * 0.6, 0, W / 2, H * 0.6, W * 0.6,
      [[0, C.g], [1, "transparent"]]);
    ctx.fillStyle = gBeat; ctx.fillRect(0, 0, W, H); ctx.restore();
    if (this.q) this._drawQuestionPanel(r, this.q.question, this.qIdx, this.qs.length, this.score, C.g);
    // Columns
    const panH = H * 0.22;
    const colAreaH = H * 0.84 - panH - 8;
    this._cols.forEach(col => {
      // Column background strip
      ctx.save(); ctx.globalAlpha = 0.04;
      r.rr(col.x - col.w / 2 + 2, panH + 8, col.w - 4, colAreaH, 4, col.col);
      ctx.restore();
      // Column label + answer at top of column
      r.rr(col.x - col.w / 2 + 2, panH + 10, col.w - 4, 38, 8,
        `${col.col}20`, `${col.col}55`);
      r.text(col.letter, col.x, panH + 20, { s: 13, w: "900", c: col.col, a: "center", f: "'Space Mono',monospace" });
      // Truncated answer text below letter
      const optText = (this.q?.options[LETTERS.indexOf(col.letter)] || "").replace(/^[A-D]\.\s*/, "").slice(0, 14);
      r.text(optText, col.x, panH + 36, { s: 8, w: "600", c: col.col + "bb", a: "center", f: "'Sora',sans-serif" });
    });
    // Hit line
    const lineY = this._lineY;
    const beatGlow = 6 + this._beatPulse * 12;
    ctx.save(); ctx.shadowColor = C.g; ctx.shadowBlur = beatGlow;
    ctx.strokeStyle = C.g; ctx.lineWidth = 1.5 + this._beatPulse;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(8, lineY); ctx.lineTo(W - 8, lineY); ctx.stroke();
    ctx.restore();
    // Beat indicator circle
    const bsz = 8 + this._beatPulse * 6;
    r.circle(W - 20, lineY, bsz, C.g + "88", C.g, 1.5);
    // Falling tokens
    this._fallers.forEach(f => {
      ctx.save();
      ctx.shadowColor = f.col; ctx.shadowBlur = 10 + this._beatPulse * 8;
      r.rr(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 10, `${f.col}28`, f.col, 2);
      ctx.shadowBlur = 0;
      r.text("TAP!", f.x, f.y, { s: 14, w: "900", c: f.col, a: "center", b: "middle" });
      ctx.restore();
    });
    // Tap buttons at bottom
    this._cols.forEach(col => {
      const btnY = H * 0.86;
      const btnH = H - btnY - 8;
      const isHov = r.input?.hit?.(col.x - col.w / 2, btnY, col.w - 4, btnH) ||
                    this.input.hit(col.x - col.w / 2, btnY, col.w - 4, btnH);
      r.rr(col.x - col.w / 2 + 2, btnY, col.w - 4, btnH, 10,
        isHov ? `${col.col}25` : "rgba(255,255,255,.06)",
        isHov ? col.col : "rgba(255,255,255,.12)", isHov ? 1.5 : 1);
      r.text(col.letter, col.x, btnY + btnH / 2, { s: 16, w: "900", c: isHov ? col.col : C.muted, a: "center", b: "middle", f: "'Space Mono',monospace" });
    });
    this._pops.draw(r);
    r.scanlines(0.018); r.vignette(0.3);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 🏎️ SPEED RUN
// Car races along a track at top.
// Question + MC buttons below.
// Correct = BOOST. Wrong = BRAKE. Race to the finish line.
// ══════════════════════════════════════════════════════════════════════════════
export class SpeedRun extends GameBase {
  constructor(qs, onFinish) {
    super();
    this.qs = qs.filter(q => q.type === "mc" && q.options?.length === 4);
    this.onFinish = onFinish;
  }
  init() {
    this._baseInit("🏎️  SPEED RUN", C.b, () => this._startGame());
    this.audio.play("countdown");
    this.qIdx    = 0;
    this.score   = 0;
    this._speed  = 18;   // km/h equivalent
    this._progress = 0;  // 0→1
    this._roadOffset = 0;
    this._carY   = 0;    // vertical oscillation
    this._carT   = 0;
    this._fb     = null; // feedback overlay {ok, text, timer}
    this._btns   = [];
    this._needBuild = false;
    this._continueBtn = null;
  }
  _startGame() { this._needBuild = true; }
  get q() { return this.qs[this.qIdx]; }
  _buildBtns() {
    if (!this.q) return;
    const { W, H } = this.renderer;
    const bw = Math.min(W * 0.43, 200);
    const bh = 52;
    const gap = 8;
    const startY = H * 0.6;
    this._btns = LETTERS.map((l, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      return {
        letter: l, col: LETTER_COLORS[i],
        isCorrect: (this.q.options[i] || "").startsWith(this.q.answer),
        text: (this.q.options[i] || "").replace(/^[A-D]\.\s*/, "").slice(0, 28),
        x: W / 2 + (col === 0 ? -1 : 1) * (bw / 2 + gap / 2),
        y: startY + row * (bh + gap),
        w: bw, h: bh,
        scale: 1, targetScale: 1,
      };
    });
  }
  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "over")      { this._continueBtn?.update(this.input); return; }
    this._baseUpdate(dt);
    if (this._needBuild) { this._needBuild = false; this._buildBtns(); }
    // Progress car
    this._progress = Math.min(1, this._progress + (this._speed / 6000));
    if (this._progress >= 1) { this._finish(); return; }
    // Road animation
    this._roadOffset = (this._roadOffset + this._speed * dt * 1.5) % 80;
    this._carT += dt * this._speed * 0.12;
    // Feedback timer
    if (this._fb) {
      this._fb.timer -= dt;
      if (this._fb.timer <= 0) { this._fb = null; this._needBuild = true; }
      return;
    }
    // Buttons
    this._btns.forEach(btn => {
      btn.targetScale = this.input.hit(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h) ? 1.05 : 1;
      btn.scale = M.lerp(btn.scale, btn.targetScale, 0.18);
      if (this.input.wasHit(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h)) {
        this._answer(btn);
      }
    });
  }
  _answer(btn) {
    if (btn.isCorrect) {
      this._speed = Math.min(this._speed + 7, 85);
      const pts = this._onCorrect(btn.x, btn.y, Math.round(this._speed));
      this.score += pts;
      this._fb = { ok: true, text: "BOOST! 🚀", timer: 0.5 };
      this.audio.play("boost");
    } else {
      this._speed = Math.max(this._speed - 12, 5);
      this._onWrong(btn.x, btn.y);
      this._fb = { ok: false, text: "BRAKE! 🛑", timer: 0.55 };
    }
    this.qIdx++;
    if (this.qIdx >= this.qs.length) { this._finish(); }
  }
  _finish() {
    this._phase = "over"; this.audio.play("jackpot");
    const { W, H } = this.renderer;
    this._continueBtn = new CBtn(W / 2, H * 0.82, 200, 52, "Continue →",
      { col: C.b, txtCol: "#fff", glow: true, onClick: () => this.onFinish(this.score, { "Top Speed": `${Math.round(this._speed)} km/h`, "Questions": this.qs.length }) });
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx;
    if (this._phase === "countdown") { this._drawCountdown(r); return; }
    if (this._phase === "over") {
      this._drawOver(r, "FINISH LINE! 🏁", C.b, this.score, { "Top Speed": `${Math.round(this._speed)} km/h`, "Questions": this.qs.length }, this._continueBtn);
      return;
    }
    r.clear(C.bg);
    if (this._flash > 0) r.flash(this._flashCol, this._flash);

    // ── TRACK (top area) ──
    const trackY = 40, trackH = 60;
    r.rr(0, trackY, W, trackH, 0, "#101018");
    // Road stripes
    ctx.save(); ctx.strokeStyle = "rgba(255,255,255,.15)"; ctx.lineWidth = 2;
    ctx.setLineDash([36, 36]); ctx.lineDashOffset = -this._roadOffset;
    ctx.beginPath(); ctx.moveTo(0, trackY + trackH / 2); ctx.lineTo(W, trackY + trackH / 2); ctx.stroke();
    ctx.restore();
    // Track borders
    ctx.strokeStyle = C.b + "44"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0, trackY); ctx.lineTo(W, trackY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, trackY + trackH); ctx.lineTo(W, trackY + trackH); ctx.stroke();
    // Progress fill
    r.rr(0, trackY + trackH - 4, W * this._progress, 4, 0, C.b);
    // Car
    const carX = W * 0.08 + this._progress * W * 0.84;
    const carY2 = trackY + trackH / 2 + Math.sin(this._carT) * 3;
    // Trail
    for (let ti = 1; ti <= 5; ti++) {
      ctx.save(); ctx.globalAlpha = 0.06 * (this._speed / 85) * (1 - ti / 6);
      ctx.font = "22px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🏎️", carX - ti * 10 * (this._speed / 40), carY2);
      ctx.restore();
    }
    ctx.font = "26px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🏎️", carX, carY2);
    // Finish flag
    ctx.font = "22px serif"; ctx.fillText("🏁", W * 0.95, carY2);

    // ── SPEED METER ──
    r.text("SPEED", W * 0.08, 24, { s: 9, w: "700", c: C.muted, a: "left", b: "middle", f: "'Space Mono',monospace" });
    const sRatio = this._speed / 85;
    const sCol = sRatio > 0.6 ? C.g : sRatio > 0.35 ? C.y : C.r;
    r.bar(W * 0.08, 30, W * 0.3, 7, sRatio, "rgba(255,255,255,.07)", sCol, 4, sCol);
    r.text(`${Math.round(this._speed)} km/h`, W * 0.08, 44, { s: 10, w: "700", c: sCol, a: "left", f: "'Space Mono',monospace" });
    r.text(`🏎️ ${this.score}`, W * 0.85, 28, { s: 18, w: "900", c: C.b, glow: C.b, gb: 8, a: "center" });

    // ── QUESTION ──
    const qY = trackY + trackH + 10;
    if (this.q) {
      r.textWrap(this.q.question, W / 2, qY, W * 0.9, { s: 15, w: "700", c: C.text, a: "center", b: "top", lh: 22 });
    }
    // Progress bar
    r.bar(W * 0.04, trackY + trackH + 4, W * 0.92, 4, this.qIdx / this.qs.length, "rgba(255,255,255,.07)", C.b, 2);

    // ── ANSWER BUTTONS or FEEDBACK ──
    if (this._fb) {
      const fscale = M.ease.outBack(Math.min((0.55 - this._fb.timer) / 0.55 * 2, 1));
      ctx.save(); ctx.translate(W / 2, H * 0.72); ctx.scale(fscale, fscale);
      r.text(this._fb.text, 0, 0, { s: 32, w: "900", c: this._fb.ok ? C.g : C.r, glow: this._fb.ok ? C.g : C.r, gb: 18, a: "center" });
      ctx.restore();
    } else {
      this._btns.forEach(btn => {
        ctx.save(); ctx.translate(btn.x, btn.y); ctx.scale(btn.scale, btn.scale);
        const hov = this.input.hit(btn.x - btn.w / 2, btn.y - btn.h / 2, btn.w, btn.h);
        r.rr(-btn.w / 2, -btn.h / 2, btn.w, btn.h, 12,
          hov ? `${btn.col}18` : "rgba(255,255,255,.06)",
          hov ? btn.col : "rgba(255,255,255,.14)", hov ? 1.8 : 1);
        // Letter badge
        r.rr(-btn.w / 2 + 8, -14, 27, 27, 6, btn.col + "25");
        r.text(btn.letter, -btn.w / 2 + 21, 0, { s: 11, w: "900", c: btn.col, a: "center", b: "middle", f: "'Space Mono',monospace" });
        r.text(btn.text, -btn.w / 2 + 45, 0, { s: 12, w: "600", c: hov ? btn.col : C.text, a: "left", b: "middle" });
        ctx.restore();
      });
    }
    this._pops.draw(r);
    r.scanlines(0.018); r.vignette(0.3);
  }
}

// ─── RESULT SCENE (shown after game + result screen transitions to this) ──────
export class ResultScene extends Scene {
  constructor(score, stats, col, title, onContinue) {
    super();
    this._score = score; this._stats = stats; this._col = col;
    this._title = title; this._onContinue = onContinue;
    this._anim = 0; this._disp = 0; this._btn = null;
  }
  init() {
    this.audio.play("levelUp");
    const { W, H } = this.renderer;
    this.particles.burst(W / 2, H * 0.32, { count: 55, colors: [this._col, "#fff", "#fbbf24"], maxSpd: 12, glow: true, ay: 0.12 });
    this._btn = new CBtn(W / 2, H * 0.82, 220, 54, "Continue →", { col: this._col, txtCol: "#0a0a14", glow: true, onClick: this._onContinue });
  }
  update(dt) {
    this._anim = Math.min(this._anim + dt * 1.8, 1);
    this._disp = Math.round(M.ease.outQ(this._anim) * this._score);
    this._btn.update(this.input);
  }
  draw(r) {
    const { W, H } = r, ctx = r.ctx, a = this._anim;
    r.clear(C.bg);
    // Glow
    ctx.save(); ctx.globalAlpha = 0.09 * a;
    const g = r.rgrad(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.65, [[0, this._col], [1, "transparent"]]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    // Title
    const ts = M.ease.outBack(Math.min(a * 1.5, 1));
    ctx.save(); ctx.translate(W / 2, H * 0.22); ctx.scale(ts, ts);
    r.text(this._title, 0, 0, { s: 34, w: "900", c: this._col, f: "'Bebas Neue',sans-serif", glow: this._col, gb: 22, a: "center" });
    ctx.restore();
    // Score
    ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = this._col; ctx.shadowBlur = 18;
    ctx.font = "900 58px 'Sora',sans-serif"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this._disp, W / 2, H * 0.42);
    ctx.restore();
    r.text("POINTS", W / 2, H * 0.51, { s: 11, w: "700", c: C.muted, f: "'Space Mono',monospace", a: "center" });
    // Stats
    const entries = Object.entries(this._stats || {});
    if (entries.length) {
      const sw = Math.min(110, (W - 40) / entries.length - 8);
      let sx = W / 2 - (entries.length * (sw + 8) - 8) / 2 + sw / 2;
      entries.forEach(([lbl, val]) => {
        r.rr(sx - sw / 2, H * 0.59 - 24, sw, 50, 10, "rgba(255,255,255,.06)", "rgba(255,255,255,.1)");
        r.text(String(val), sx, H * 0.59 - 4, { s: 18, w: "900", c: C.text, a: "center" });
        r.text(lbl, sx, H * 0.59 + 16, { s: 9, w: "600", c: C.muted, f: "'Space Mono',monospace", a: "center" });
        sx += sw + 8;
      });
    }
    this._btn.draw(r);
    r.scanlines(0.018); r.vignette(0.35);
  }
}
