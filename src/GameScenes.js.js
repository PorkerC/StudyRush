import { Scene, Math2, CanvasButton, Particle } from "./GameEngine.js";

// ── SHARED COLORS ─────────────────────────────────────────────────────────────
const COLORS = {
  bg: "#07070f", surface: "rgba(255,255,255,.06)", border: "rgba(255,255,255,.12)",
  text: "#f0f0ff", muted: "rgba(255,255,255,.4)",
  yellow: "#fbbf24", red: "#f87171", green: "#34d399", blue: "#60a5fa",
  purple: "#c084fc", orange: "#fb923c", cyan: "#40e0d0",
  correct: "#34d399", wrong: "#f87171",
};
const CORRECT_COLS = ["#34d399","#fbbf24","#60a5fa","#fff","#a3e635"];
const WRONG_COLS   = ["#f87171","#fb923c","#ff0000"];

const LETTERS = ["A","B","C","D"];

// ── COUNTDOWN SCENE MIXIN ─────────────────────────────────────────────────────
class CountdownMixin extends Scene {
  _initCountdown(label, color, onDone) {
    this._cdLabel = label; this._cdColor = color; this._cdDone = onDone;
    this._cdCount = 3; this._cdTimer = 0; this._cdInterval = 0.85;
    this._cdScale = 1; this._cdAlpha = 1; this._phase = "countdown";
  }
  _updateCountdown(dt) {
    this._cdTimer += dt;
    const t = this._cdTimer / this._cdInterval;
    this._cdScale = Math2.ease.outBack(Math.min(t, 1)) * 1.1;
    this._cdAlpha = 1 - Math.pow(Math.max(0, t - 0.5) / 0.5, 2);
    if (this._cdTimer >= this._cdInterval) {
      this._cdTimer = 0; this._cdCount--;
      if (this._cdCount > 0) { this.audio.play("countdown"); }
      else { this.audio.play("go"); this._phase = "playing"; this._cdDone?.(); }
    }
  }
  _drawCountdown(renderer) {
    const { width: W, height: H } = renderer;
    // Background
    renderer.clear(COLORS.bg);
    // Glowing circle
    const ctx = renderer.ctx;
    ctx.save();
    ctx.translate(W/2, H/2);
    // Outer ring
    ctx.globalAlpha = 0.15 * this._cdAlpha;
    renderer.circle(0, 0, 100 * this._cdScale, null, this._cdColor, 3);
    ctx.globalAlpha = 1;
    // Number
    const num = this._cdCount > 0 ? String(this._cdCount) : "GO!";
    ctx.scale(this._cdScale, this._cdScale);
    ctx.shadowColor = this._cdColor; ctx.shadowBlur = 30;
    ctx.fillStyle = this._cdColor; ctx.globalAlpha = this._cdAlpha;
    ctx.font = `900 ${this._cdCount > 0 ? 100 : 64}px 'Bebas Neue',sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(num, 0, 0);
    ctx.restore();
    // Game label
    renderer.text(this._cdLabel, W/2, 60, { size:14, weight:"700", color:COLORS.muted, family:"'Space Mono',monospace", align:"center" });
  }
}

// ── RESULT SCREEN MIXIN ───────────────────────────────────────────────────────
class ResultMixin {
  _initResult(score, stats, color, icon, title, onContinue) {
    this._resScore = score; this._resStats = stats; this._resColor = color;
    this._resIcon = icon; this._resTitle = title; this._resContinue = onContinue;
    this._resAnim = 0; this._resDisplayScore = 0;
    this._continueBtn = new CanvasButton(0, 0, 200, 52, "Continue →", { color: color, textColor: "#0a0a14", glow: true, onClick: onContinue });
    this._phase = "result";
  }
  _updateResult(dt, input, renderer) {
    this._resAnim = Math.min(this._resAnim + dt * 2, 1);
    this._resDisplayScore = Math.round(Math2.ease.outQuad(this._resAnim) * this._resScore);
    this._continueBtn.x = renderer.width / 2;
    this._continueBtn.y = renderer.height * 0.82;
    this._continueBtn.update(input);
  }
  _drawResult(renderer) {
    const { width: W, height: H } = renderer;
    renderer.clear(COLORS.bg);
    const ctx = renderer.ctx;
    const a = this._resAnim;

    // Animated background glow
    ctx.save();
    ctx.globalAlpha = 0.08 * a;
    const g = renderer.radialGrad(W/2, H*0.35, 0, W/2, H*0.35, W*0.6, [[0,this._resColor],[1,"transparent"]]);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.restore();

    // Icon
    ctx.save();
    const iconScale = Math2.ease.outBack(Math.min(a * 1.5, 1));
    ctx.translate(W/2, H*0.2);
    ctx.scale(iconScale, iconScale);
    ctx.font = "64px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this._resIcon, 0, 0);
    ctx.restore();

    // Title
    renderer.text(this._resTitle, W/2, H*0.36, { size:32, weight:"900", color:this._resColor, family:"'Bebas Neue',sans-serif", glow:this._resColor, glowBlur:20, align:"center" });

    // Score counter
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = this._resColor; ctx.shadowBlur = 16;
    ctx.font = "900 56px 'Sora',sans-serif";
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(this._resDisplayScore, W/2, H*0.5);
    ctx.restore();

    // Stats
    const statY = H * 0.62;
    if (this._resStats) {
      const stats = Object.entries(this._resStats);
      const sw = 120, gap = 14, total = stats.length * sw + (stats.length-1)*gap;
      let sx = W/2 - total/2 + sw/2;
      stats.forEach(([label, val]) => {
        renderer.roundRect(sx - sw/2, statY - 30, sw, 58, 12, "rgba(255,255,255,.06)", "rgba(255,255,255,.1)");
        renderer.text(String(val), sx, statY - 4, { size:22, weight:"900", color:COLORS.text, align:"center" });
        renderer.text(label, sx, statY + 18, { size:10, weight:"600", color:COLORS.muted, family:"'Space Mono',monospace", align:"center" });
        sx += sw + gap;
      });
    }

    this._continueBtn.draw(renderer);
    renderer.scanlines(0.02);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ⚡ LIGHTNING TAP GAME
// ════════════════════════════════════════════════════════════════════════════
export class LightningTapScene extends CountdownMixin {
  constructor(questions, onFinish) {
    super();
    this.questions = questions;
    this.onFinish = onFinish;
    this._phase = "countdown";
  }

  init() {
    this.audio.play("countdown");
    this._initCountdown("LIGHTNING TAP", COLORS.yellow, () => this._startGame());

    this.qIdx = 0; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = 0; this.misses = 0;
    this.showMs = 1400; this._visible = true;
    this._visTimer = 0; this._resultTimer = 0;
    this._ansResult = null; this._buttons = [];
    this._timerRatio = 1;
    this._bgFlash = 0; this._bgFlashColor = COLORS.correct;
    this._scorePopups = [];
    this._comboAnim = 0;
    this._buildButtons();
  }

  _startGame() { this._visible = true; this._visTimer = this.showMs / 1000; this._buildButtons(); }

  get q() { return this.questions[this.qIdx]; }

  _buildButtons() {
    if (!this.q) return;
    const { width: W, height: H } = this.renderer;
    const cols = 2, bw = W * 0.44, bh = 52, gap = W * 0.04;
    const startX = W/2 - bw/2 - gap/2 - bw/2 + bw/2;
    this._buttons = this.q.options?.map((opt, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = W/2 + (col - 0.5) * (bw + gap);
      const y = H * 0.62 + row * (bh + 10);
      const isCorrect = opt.startsWith(this.q.answer);
      return {
        opt, isCorrect, x, y, w: bw, h: bh,
        scale: 1, targetScale: 1, alpha: 1,
        hover: false, pressed: false,
        text: opt.replace(/^[A-D]\.\s*/, "").slice(0, 28),
        letter: ["A","B","C","D"][i],
      };
    }) || [];
  }

  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "result") return;

    const { width: W, height: H } = this.renderer;

    // BG flash decay
    this._bgFlash = Math.max(0, this._bgFlash - dt * 4);

    // Combo anim
    this._comboAnim = Math.max(0, this._comboAnim - dt * 3);

    // Score popups
    this._scorePopups = this._scorePopups.map(p => ({ ...p, y: p.y - 60*dt, alpha: p.alpha - dt * 1.5 })).filter(p => p.alpha > 0);

    // Answer revealed
    if (this._ansResult !== null) {
      this._resultTimer -= dt;
      if (this._resultTimer <= 0) { this._ansResult = null; this._nextQ(); }
      return;
    }

    // Visibility timer
    if (this._visible) {
      this._visTimer -= dt;
      this._timerRatio = Math.max(0, this._visTimer / (this.showMs / 1000));
      if (this._visTimer <= 0) {
        this._visible = false; this._onMiss(); return;
      }
    }

    // Button hover & input
    this._buttons.forEach(btn => {
      btn.hover = this.input.hitTest(btn.x - btn.w/2, btn.y - btn.h/2, btn.w, btn.h);
      btn.targetScale = btn.hover ? 1.04 : 1;
      btn.scale = Math2.lerp(btn.scale, btn.targetScale, 0.2);
      if (this.input.wasHit(btn.x - btn.w/2, btn.y - btn.h/2, btn.w, btn.h)) this._onAnswer(btn);
    });
  }

  _onAnswer(btn) {
    const ok = btn.isCorrect;
    const newCombo = ok ? this.combo + 1 : 0;
    const speed = this.showMs / 1400;
    const pts = ok ? Math.round(10 * (1 + newCombo * 0.25) * (speed < 0.5 ? 1.5 : 1)) : 0;
    this.combo = newCombo;
    if (newCombo > this.maxCombo) this.maxCombo = newCombo;
    if (ok) {
      this.score += pts; this.hits++;
      this.audio.play(newCombo >= 3 ? "combo" : "tap");
      this._bgFlash = 0.15; this._bgFlashColor = COLORS.correct;
      this._scorePopups.push({ x: btn.x, y: btn.y, text: `+${pts}`, color: COLORS.green, alpha: 1 });
      this.particles.burst(btn.x, btn.y, { count: 18, colors: CORRECT_COLS, maxSpeed: 7, glow: true });
      if (newCombo >= 3) { this._comboAnim = 1; this.camera.shake(4, 0.2); }
    } else {
      this.misses++; this.audio.play("miss");
      this._bgFlash = 0.12; this._bgFlashColor = COLORS.wrong;
      this.camera.shake(6, 0.25);
      this.particles.burst(btn.x, btn.y, { count: 12, colors: WRONG_COLS, maxSpeed: 5 });
    }
    this._ansResult = ok ? "hit" : "miss";
    this._resultTimer = 0.45;
    this._visible = false;
    btn.pressed = true;
    // Increase speed
    if (ok) this.showMs = Math.max(300, this.showMs - 65);
  }

  _onMiss() {
    this.misses++; this.combo = 0; this.audio.play("miss");
    this._bgFlash = 0.12; this._bgFlashColor = COLORS.wrong;
    this.camera.shake(5, 0.2);
    this._ansResult = "timeout"; this._resultTimer = 0.5;
  }

  _nextQ() {
    this.qIdx++;
    if (this.qIdx >= this.questions.length) { this._finish(); return; }
    this._visible = true; this._visTimer = this.showMs / 1000; this._timerRatio = 1;
    this._buildButtons();
  }

  _finish() {
    this.audio.play("streak");
    this.onFinish(this.score, { "Hits": this.hits, "Misses": this.misses, "Max Combo": this.maxCombo });
  }

  draw(renderer) {
    const { width: W, height: H } = renderer;
    if (this._phase === "countdown") { this._drawCountdown(renderer); return; }

    renderer.clear(COLORS.bg);
    const ctx = renderer.ctx;

    // BG flash
    if (this._bgFlash > 0) renderer.flash(this._bgFlashColor, this._bgFlash);

    // Background glow
    ctx.save();
    ctx.globalAlpha = 0.06;
    const g = renderer.radialGrad(W/2, H*0.3, 0, W/2, H*0.3, W*0.6, [[0,COLORS.yellow],[1,"transparent"]]);
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    ctx.restore();

    // Header
    renderer.text("⚡ LIGHTNING TAP", W/2, 36, { size:14, weight:"700", color:COLORS.muted, family:"'Space Mono',monospace", align:"center" });

    // Score & combo
    renderer.text(`${this.score}`, W/2, H * 0.14, { size:38, weight:"900", color:COLORS.yellow, glow:COLORS.yellow, glowBlur:14, align:"center" });
    if (this.combo >= 2) {
      const cs = 1 + this._comboAnim * 0.4;
      ctx.save(); ctx.translate(W/2, H*0.21); ctx.scale(cs, cs);
      renderer.text(`🔥 x${this.combo} COMBO`, 0, 0, { size:14, weight:"800", color:COLORS.orange, glow:COLORS.orange, glowBlur:10, align:"center" });
      ctx.restore();
    }

    // Progress
    renderer.progressBar(W*0.08, H*0.27, W*0.84, 6, this.qIdx/this.questions.length, "rgba(255,255,255,.08)", COLORS.yellow, 3, COLORS.yellow);
    renderer.text(`${this.qIdx+1}/${this.questions.length}`, W-24, H*0.27+3, { size:10, weight:"700", color:COLORS.muted, family:"'Space Mono',monospace", align:"right", baseline:"middle" });

    // Timer bar
    const tCol = this._timerRatio > 0.5 ? COLORS.green : this._timerRatio > 0.25 ? COLORS.yellow : COLORS.red;
    renderer.progressBar(W*0.08, H*0.32, W*0.84, 10, this._timerRatio, "rgba(255,255,255,.07)", tCol, 5, tCol);

    // Question
    if (this.q) {
      const qText = this.q.question;
      ctx.save();
      ctx.font = `700 17px 'Sora',sans-serif`;
      ctx.fillStyle = COLORS.text; ctx.textAlign = "center"; ctx.textBaseline = "top";
      // Word wrap
      const maxW = W * 0.84, lh = 24;
      const words = qText.split(" "); let lines = [], line = "";
      words.forEach(w => { const test = line ? line+" "+w : w; if(ctx.measureText(test).width>maxW){lines.push(line);line=w;}else line=test; });
      lines.push(line);
      const qY = H * 0.38;
      lines.forEach((l, i) => ctx.fillText(l, W/2, qY + i*lh));
      ctx.restore();
    }

    // Answer buttons
    if (this._visible) {
      this._buttons.forEach((btn, i) => {
        ctx.save();
        ctx.translate(btn.x, btn.y);
        ctx.scale(btn.scale, btn.scale);
        const hover = btn.hover;
        renderer.roundRect(-btn.w/2, -btn.h/2, btn.w, btn.h, 12,
          hover ? "rgba(251,191,36,.12)" : "rgba(255,255,255,.06)",
          hover ? COLORS.yellow : "rgba(255,255,255,.14)", hover ? 1.5 : 1);
        // Letter badge
        renderer.roundRect(-btn.w/2+8, -14, 28, 28, 6, "rgba(255,255,255,.1)");
        renderer.text(btn.letter, -btn.w/2+22, 0, { size:11, weight:"700", color:hover?COLORS.yellow:COLORS.muted, family:"'Space Mono',monospace", align:"center" });
        renderer.text(btn.text, 8, 0, { size:13, weight:"600", color:hover?COLORS.yellow:COLORS.text, align:"left", baseline:"middle" });
        ctx.restore();
      });
    } else if (this._ansResult) {
      ctx.save();
      ctx.translate(W/2, H*0.62 + 26);
      const ok = this._ansResult === "hit";
      const scale = Math2.ease.outBack(Math.min(this._resultTimer > 0 ? (0.45-this._resultTimer)/0.45*2 : 1, 1));
      ctx.scale(scale, scale);
      ctx.font = "56px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ok ? "✅" : this._ansResult === "timeout" ? "⏰" : "❌", 0, 0);
      renderer.text(ok ? `+${Math.round(10*(1+this.combo*0.25))} pts` : this._ansResult==="timeout"?"TOO SLOW!":"WRONG!", 0, 40, { size:16, weight:"800", color:ok?COLORS.green:COLORS.red, glow:ok?COLORS.green:COLORS.red, glowBlur:12, align:"center" });
      ctx.restore();
    }

    // Score popups
    this._scorePopups.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.alpha;
      renderer.text(p.text, p.x, p.y, { size:18, weight:"900", color:p.color, glow:p.color, glowBlur:10, align:"center" });
      ctx.restore();
    });

    renderer.scanlines(0.025);
    renderer.vignette(0.3);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🎯 AIM TRAINER GAME
// ════════════════════════════════════════════════════════════════════════════
export class AimTrainerScene extends CountdownMixin {
  constructor(questions, onFinish) {
    super();
    this.questions = questions;
    this.onFinish = onFinish;
  }

  init() {
    this.audio.play("countdown");
    this._initCountdown("AIM TRAINER", COLORS.orange, () => this._startGame());
    this.qIdx = 0; this.score = 0; this.hits = 0; this.misses = 0;
    this._targets = []; this._flash = 0; this._flashColor = COLORS.correct;
    this._scorePopups = []; this._hitAnim = null;
  }

  _startGame() { this._spawnTargets(); }

  get q() { return this.questions[this.qIdx]; }

  _spawnTargets() {
    if (!this.q) return;
    const { width: W, height: H } = this.renderer;
    const margin = 60;
    this._targets = this.q.options.map((opt, i) => {
      const isCorrect = opt.startsWith(this.q.answer);
      const r = isCorrect ? 32 : 24;
      return {
        opt, isCorrect, r, letter: LETTERS[i],
        x: Math2.rand(margin + r, W - margin - r),
        y: Math2.rand(H * 0.35 + r, H - 90 - r),
        vx: Math2.rand(-1.2, 1.2) * (isCorrect ? 0.8 : 1.2),
        vy: Math2.rand(-1.0, 1.0) * (isCorrect ? 0.8 : 1.2),
        pulse: Math2.rand(0, Math.PI * 2),
        scale: 1, alpha: 1,
        ring: 0, // ring expansion on spawn
        color: isCorrect ? COLORS.correct : COLORS.red,
      };
    });
    // Ring spawn animation
    this._targets.forEach(t => { t.ring = 1; });
  }

  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "result") return;

    const { width: W, height: H } = this.renderer;
    this._flash = Math.max(0, this._flash - dt * 4);
    this._scorePopups = this._scorePopups.map(p => ({ ...p, y: p.y - 50*dt, alpha: p.alpha - dt * 1.5 })).filter(p => p.alpha > 0);

    this._targets.forEach(t => {
      t.x += t.vx; t.y += t.vy;
      if (t.x - t.r < 0 || t.x + t.r > W) { t.vx *= -1; t.x = Math2.clamp(t.x, t.r, W - t.r); }
      if (t.y - t.r < 0 || t.y + t.r > H) { t.vy *= -1; t.y = Math2.clamp(t.y, t.r, H - t.r); }
      t.pulse += dt * 3;
      t.ring = Math.max(0, t.ring - dt * 2);
      t.scale = Math2.lerp(t.scale, 1, 0.15);

      // Click/tap detection
      if (this.input.wasCircleHit(t.x, t.y, t.r + 8)) {
        this._onHit(t);
      }
    });
  }

  _onHit(target) {
    const ok = target.isCorrect;
    if (ok) {
      this.score += 20; this.hits++;
      this.audio.play("tap");
      this._flash = 0.15; this._flashColor = COLORS.correct;
      this.particles.burst(target.x, target.y, { count:22, colors:CORRECT_COLS, maxSpeed:8, glow:true });
      this._scorePopups.push({ x: target.x, y: target.y - 20, text:"+20", color:COLORS.green, alpha:1 });
      this.camera.shake(3, 0.15);
      this._targets = this._targets.filter(t => t !== target);
      this.qIdx++;
      if (this.qIdx >= this.questions.length) { this._finish(); return; }
      setTimeout(() => this._spawnTargets(), 300);
    } else {
      this.misses++; this.audio.play("miss");
      this._flash = 0.1; this._flashColor = COLORS.wrong;
      target.scale = 0.8;
      this.camera.shake(5, 0.2);
      this.particles.burst(target.x, target.y, { count:10, colors:WRONG_COLS, maxSpeed:5 });
      this._scorePopups.push({ x: target.x, y: target.y - 20, text:"-5", color:COLORS.red, alpha:1 });
      this.score = Math.max(0, this.score - 5);
    }
  }

  _finish() {
    this.audio.play("streak");
    const acc = Math.round(this.hits/(this.hits+this.misses||1)*100);
    this.onFinish(this.score, { "Hits":this.hits, "Misses":this.misses, "Accuracy":`${acc}%` });
  }

  draw(renderer) {
    const { width: W, height: H } = renderer;
    if (this._phase === "countdown") { this._drawCountdown(renderer); return; }
    renderer.clear(COLORS.bg);
    const ctx = renderer.ctx;

    if (this._flash > 0) renderer.flash(this._flashColor, this._flash);

    // Header
    renderer.text("🎯 AIM TRAINER", W/2, 36, { size:14, weight:"700", color:COLORS.muted, family:"'Space Mono',monospace", align:"center" });
    renderer.text(`🎯 ${this.score}`, W/2, H*0.1, { size:32, weight:"900", color:COLORS.orange, glow:COLORS.orange, glowBlur:12, align:"center" });

    // Progress
    renderer.progressBar(W*0.08, H*0.17, W*0.84, 5, this.qIdx/this.questions.length, "rgba(255,255,255,.07)", COLORS.orange, 3, COLORS.orange);

    // Question
    if (this.q) {
      ctx.save(); ctx.font = "700 16px 'Sora',sans-serif"; ctx.fillStyle = COLORS.text; ctx.textAlign = "center"; ctx.textBaseline = "top";
      const words = this.q.question.split(" "); let lines=[], line="";
      words.forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>W*0.84){lines.push(line);line=w;}else line=t;});
      lines.push(line);
      lines.slice(0,3).forEach((l,i) => ctx.fillText(l, W/2, H*0.22 + i*22));
      ctx.restore();
    }

    // Crosshair cursor hint
    ctx.save(); ctx.globalAlpha = 0.2; ctx.strokeStyle = COLORS.orange; ctx.lineWidth = 1;
    const cx2 = W/2, cy2 = H*0.6;
    ctx.beginPath(); ctx.moveTo(cx2-15,cy2); ctx.lineTo(cx2+15,cy2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx2,cy2-15); ctx.lineTo(cx2,cy2+15); ctx.stroke();
    ctx.restore();

    // Targets
    this._targets.forEach(t => {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);

      // Spawn ring
      if (t.ring > 0) {
        ctx.globalAlpha = t.ring * 0.5;
        ctx.beginPath(); ctx.arc(0, 0, t.r * (1 + (1-t.ring) * 1.5), 0, Math.PI * 2);
        ctx.strokeStyle = t.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Pulse ring
      const pulse = Math.sin(t.pulse) * 0.15 + 0.85;
      ctx.globalAlpha = 0.2 * pulse;
      ctx.beginPath(); ctx.arc(0, 0, t.r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = t.color; ctx.fill();
      ctx.globalAlpha = 1;

      // Main circle
      ctx.shadowColor = t.color; ctx.shadowBlur = t.isCorrect ? 16 : 8;
      ctx.beginPath(); ctx.arc(0, 0, t.r, 0, Math.PI * 2);
      ctx.fillStyle = t.isCorrect ? "rgba(52,211,153,.18)" : "rgba(248,113,113,.1)";
      ctx.fill();
      ctx.strokeStyle = t.color; ctx.lineWidth = t.isCorrect ? 2.5 : 1.5; ctx.stroke();

      // Crosshair rings
      [t.r * 0.4, t.r * 0.7].forEach(r => {
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = t.color; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.4; ctx.stroke(); ctx.globalAlpha = 1;
      });

      // Letter
      ctx.shadowBlur = 0;
      renderer.text(t.letter, 0, 0, { size: t.isCorrect ? 15 : 12, weight:"700", color:t.color, align:"center", baseline:"middle", family:"'Space Mono',monospace" });
      ctx.restore();
    });

    // Score popups
    this._scorePopups.forEach(p => { ctx.save(); ctx.globalAlpha=p.alpha; renderer.text(p.text, p.x, p.y, {size:18,weight:"900",color:p.color,glow:p.color,glowBlur:10,align:"center"}); ctx.restore(); });

    renderer.scanlines(0.02); renderer.vignette(0.3);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 💥 ANSWER BLITZ GAME
// ════════════════════════════════════════════════════════════════════════════
export class AnswerBlitzScene extends CountdownMixin {
  constructor(questions, onFinish) {
    super();
    this.questions = questions;
    this.onFinish = onFinish;
  }
  init() {
    this.audio.play("countdown");
    this._initCountdown("ANSWER BLITZ", COLORS.red, () => this._startGame());
    this.qIdx = 0; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hits = 0; this._timeLeft = 45; this._flash = 0; this._flashColor = COLORS.correct;
    this._bubbles = []; this._scorePopups = []; this._lastSpawn = 0;
  }

  _startGame() {
    this._spawnBubbles();
    this._timerInterval = setInterval(() => {
      this._timeLeft--;
      if (this._timeLeft <= 10) this.audio.play("tick");
      if (this._timeLeft <= 0) { clearInterval(this._timerInterval); this._finish(); }
    }, 1000);
  }

  get q() { return this.questions[this.qIdx]; }

  _spawnBubbles() {
    if (!this.q) return;
    const { width: W, height: H } = this.renderer;
    const margin = 70;
    this._bubbles = this.q.options.map((opt, i) => ({
      opt, isCorrect: opt.startsWith(this.q.answer),
      letter: LETTERS[i],
      x: Math2.rand(margin, W - margin),
      y: Math2.rand(H * 0.35, H - 80),
      w: Math.min(160, W * 0.38), h: 42,
      scale: 0, targetScale: 1, alpha: 1,
      pulse: Math2.rand(0, Math.PI * 2),
    }));
  }

  destroy() { clearInterval(this._timerInterval); }

  update(dt) {
    if (this._phase === "countdown") { this._updateCountdown(dt); return; }
    if (this._phase === "result") return;
    this._flash = Math.max(0, this._flash - dt * 4);
    this._scorePopups = this._scorePopups.map(p=>({...p,y:p.y-50*dt,alpha:p.alpha-dt*1.5})).filter(p=>p.alpha>0);
    this._bubbles.forEach(b => {
      b.scale = Math2.lerp(b.scale, b.targetScale, 0.15);
      b.pulse += dt * 2;
      if (this.input.wasHit(b.x - b.w/2, b.y - b.h/2, b.w, b.h)) this._onTap(b);
    });
  }

  _onTap(bubble) {
    const ok = bubble.isCorrect;
    const nc = ok ? this.combo + 1 : 0;
    const pts = ok ? Math.round(15 * (1 + nc * 0.3)) : 0;
    this.combo = nc; if (nc > this.maxCombo) this.maxCombo = nc;
    if (ok) {
      this.score += pts; this.hits++;
      this.audio.play(nc >= 3 ? "combo" : "tap");
      this._flash = 0.12; this._flashColor = COLORS.correct;
      this.particles.burst(bubble.x, bubble.y, { count:18, colors:CORRECT_COLS, maxSpeed:7, glow:true });
      this._scorePopups.push({x:bubble.x,y:bubble.y,text:`+${pts}`,color:COLORS.green,alpha:1});
      if (nc >= 3) this.camera.shake(4, 0.2);
      this.qIdx++; if (this.qIdx >= this.questions.length) { clearInterval(this._timerInterval); this._finish(); return; }
      this._spawnBubbles();
    } else {
      this.combo = 0; this.score = Math.max(0, this.score - 5);
      this.audio.play("miss"); this._flash = 0.1; this._flashColor = COLORS.wrong;
      bubble.targetScale = 0.85; setTimeout(() => { bubble.targetScale = 1; }, 200);
      this.camera.shake(5, 0.2);
      this._scorePopups.push({x:bubble.x,y:bubble.y,text:"-5",color:COLORS.red,alpha:1});
    }
  }

  _finish() {
    this.audio.play("streak");
    this.onFinish(this.score, {"Hits":this.hits,"Combo":this.maxCombo,"Time":"45s"});
  }

  draw(renderer) {
    const { width: W, height: H } = renderer;
    if (this._phase === "countdown") { this._drawCountdown(renderer); return; }
    renderer.clear(COLORS.bg); const ctx = renderer.ctx;
    if (this._flash > 0) renderer.flash(this._flashColor, this._flash);
    renderer.text("💥 ANSWER BLITZ", W/2, 36, {size:14,weight:"700",color:COLORS.muted,family:"'Space Mono',monospace",align:"center"});
    // Timer
    const tRatio = this._timeLeft / 45;
    const tCol = tRatio > .5 ? COLORS.green : tRatio > .25 ? COLORS.yellow : COLORS.red;
    renderer.text(`⏱ ${this._timeLeft}s`, W*0.15, H*0.11, {size:22,weight:"900",color:tCol,glow:tRatio<.25?COLORS.red:null,glowBlur:14,align:"center"});
    renderer.text(`💥 ${this.score}`, W*0.75, H*0.11, {size:22,weight:"900",color:COLORS.red,align:"center"});
    if (this.combo >= 2) renderer.text(`🔥 x${this.combo}`, W/2, H*0.11, {size:16,weight:"800",color:COLORS.orange,align:"center"});
    renderer.progressBar(W*.08, H*.17, W*.84, 5, tRatio, "rgba(255,255,255,.07)", tCol, 3, tCol);
    if (this.q) {
      ctx.save(); ctx.font="700 15px 'Sora',sans-serif"; ctx.fillStyle=COLORS.text; ctx.textAlign="center"; ctx.textBaseline="top";
      const words=this.q.question.split(" ");let lines=[],line="";
      words.forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>W*.84){lines.push(line);line=w;}else line=t;});
      lines.push(line); lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,W/2,H*.22+i*22));
      ctx.restore();
    }
    this._bubbles.forEach(b => {
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.scale, b.scale);
      const pulse = Math.sin(b.pulse) * 0.05 + 0.95;
      ctx.scale(pulse, pulse);
      const col = b.isCorrect ? COLORS.correct : COLORS.text;
      const bg = b.isCorrect ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.07)";
      const bc = b.isCorrect ? "rgba(52,211,153,.5)" : "rgba(255,255,255,.15)";
      if (b.isCorrect) { ctx.shadowColor = COLORS.correct; ctx.shadowBlur = 12; }
      renderer.roundRect(-b.w/2,-b.h/2,b.w,b.h,10,bg,bc,b.isCorrect?1.5:1);
      ctx.shadowBlur = 0;
      renderer.text(`${b.letter}. ${b.opt.replace(/^[A-D]\.\s*/,"").slice(0,20)}`, 0, 0, {size:12,weight:"700",color:col,align:"center",baseline:"middle"});
      ctx.restore();
    });
    this._scorePopups.forEach(p=>{ctx.save();ctx.globalAlpha=p.alpha;renderer.text(p.text,p.x,p.y,{size:18,weight:"900",color:p.color,glow:p.color,glowBlur:10,align:"center"});ctx.restore();});
    renderer.scanlines(0.02); renderer.vignette(0.3);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🎵 RHYTHM REVIEW GAME
// ════════════════════════════════════════════════════════════════════════════
export class RhythmScene extends CountdownMixin {
  constructor(questions, onFinish) {
    super();
    this.questions = questions;
    this.onFinish = onFinish;
  }
  init() {
    this.audio.play("countdown");
    this._initCountdown("RHYTHM REVIEW", COLORS.green, () => this._startGame());
    this.qIdx=0; this.score=0; this.hits=0; this._flash=0; this._flashColor=COLORS.correct;
    this._fallers=[]; this._spawnTimer=0; this._beatTimer=0; this._beatOn=false;
    this._scorePopups=[]; this._lineY=0.82; this._missFlash=0;
    this.BPM=88; this._beatMs=60000/this.BPM/1000;
  }
  _startGame() { this._spawnFallers(); }
  get q() { return this.questions[this.qIdx]; }
  _spawnFallers() {
    if (!this.q) return;
    const { width: W } = this.renderer;
    const cols = this.q.options.length;
    const bw = Math.min((W - 40) / cols - 8, 140);
    const startX = W/2 - ((cols-1)/2) * (bw + 8);
    this._fallers = this.q.options.map((opt,i) => ({
      opt, isCorrect: opt.startsWith(this.q.answer), letter:LETTERS[i],
      x: startX + i*(bw+8), w:bw, h:44,
      y: -50, vy: 1.4 + Math.random()*0.4,
      scale:1, alpha:1,
      text: opt.replace(/^[A-D]\.\s*/,"").slice(0,16),
    }));
  }
  destroy() {}
  update(dt) {
    if (this._phase==="countdown") { this._updateCountdown(dt); return; }
    if (this._phase==="result") return;
    const { height: H } = this.renderer;
    this._flash = Math.max(0, this._flash - dt*4);
    this._missFlash = Math.max(0, this._missFlash - dt*3);
    this._beatTimer += dt;
    if (this._beatTimer >= this._beatMs) {
      this._beatTimer = 0; this._beatOn = !this._beatOn;
      if (this._beatOn) this.audio.play("beat");
    }
    this._scorePopups = this._scorePopups.map(p=>({...p,y:p.y-50*dt,alpha:p.alpha-dt*1.5})).filter(p=>p.alpha>0);
    const lineY = H * this._lineY;
    this._fallers.forEach(f => {
      f.y += f.vy * (60 * dt);
      // Auto-miss if correct passes line
      if (f.isCorrect && f.y - f.h/2 > lineY + 30) {
        this._onMiss(); return;
      }
      if (f.y > H + 60) { f.alpha = 0; }
      // Tap detection
      if (this.input.wasHit(f.x - f.w/2, f.y - f.h/2, f.w, f.h)) this._onTap(f);
    });
  }
  _onTap(f) {
    const ok = f.isCorrect;
    if (ok) {
      this.score+=12; this.hits++;
      this.audio.play("hitBeat");
      this._flash=0.12; this._flashColor=COLORS.correct;
      this.particles.burst(f.x, f.y, {count:16,colors:CORRECT_COLS,maxSpeed:6,glow:true});
      this._scorePopups.push({x:f.x,y:f.y,text:"+12",color:COLORS.green,alpha:1});
      this.camera.shake(3,0.15);
      this.qIdx++; if(this.qIdx>=this.questions.length){this._finish();return;}
      this._fallers=[]; setTimeout(()=>this._spawnFallers(),400);
    } else {
      this.audio.play("miss"); this._flash=0.08; this._flashColor=COLORS.wrong;
      this._scorePopups.push({x:f.x,y:f.y,text:"WRONG",color:COLORS.red,alpha:1});
      this.camera.shake(4,0.2);
    }
  }
  _onMiss() {
    this.audio.play("miss"); this._missFlash=0.15;
    this.qIdx++; if(this.qIdx>=this.questions.length){this._finish();return;}
    this._fallers=[]; setTimeout(()=>this._spawnFallers(),400);
  }
  _finish() {
    this.audio.play("streak");
    this.onFinish(this.score,{"Hits":this.hits,"Completion":`${Math.round(this.hits/this.questions.length*100)}%`});
  }
  draw(renderer) {
    const { width:W, height:H } = renderer;
    if (this._phase==="countdown") { this._drawCountdown(renderer); return; }
    renderer.clear(COLORS.bg); const ctx=renderer.ctx;
    if (this._flash>0) renderer.flash(this._flashColor,this._flash);
    if (this._missFlash>0) renderer.flash(COLORS.wrong,this._missFlash);
    // Background beat pulse
    ctx.save(); ctx.globalAlpha=this._beatOn?0.04:0.02;
    const bg2=renderer.radialGrad(W/2,H*.6,0,W/2,H*.6,W*.5,[[0,COLORS.green],[1,"transparent"]]);
    ctx.fillStyle=bg2; ctx.fillRect(0,0,W,H); ctx.restore();
    renderer.text("🎵 RHYTHM REVIEW",W/2,36,{size:14,weight:"700",color:COLORS.muted,family:"'Space Mono',monospace",align:"center"});
    renderer.text(`🎵 ${this.score}`,W/2,H*.1,{size:28,weight:"900",color:COLORS.green,glow:COLORS.green,glowBlur:12,align:"center"});
    // Beat indicator
    const beatSize = this._beatOn ? 14 : 10;
    renderer.circle(W-30,H*.1,beatSize,"rgba(52,211,153,.8)");
    renderer.progressBar(W*.08,H*.17,W*.84,5,this.qIdx/this.questions.length,"rgba(255,255,255,.07)",COLORS.green,3,COLORS.green);
    if (this.q) {
      ctx.save(); ctx.font="700 15px 'Sora',sans-serif"; ctx.fillStyle=COLORS.text; ctx.textAlign="center"; ctx.textBaseline="top";
      const words=this.q.question.split(" ");let lines=[],line="";
      words.forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>W*.84){lines.push(line);line=w;}else line=t;});
      lines.push(line); lines.slice(0,3).forEach((l,i)=>ctx.fillText(l,W/2,H*.22+i*22));
      ctx.restore();
    }
    // Hit line
    const lineY=H*this._lineY;
    ctx.save(); ctx.shadowColor=COLORS.green; ctx.shadowBlur=this._beatOn?12:6;
    ctx.strokeStyle=COLORS.green; ctx.lineWidth=this._beatOn?2.5:1.5; ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.moveTo(W*.05,lineY); ctx.lineTo(W*.95,lineY); ctx.stroke();
    ctx.restore();
    // Fallers
    this._fallers.forEach(f => {
      if (f.alpha<=0) return;
      ctx.save(); ctx.globalAlpha=f.alpha; ctx.translate(f.x,f.y);
      const col=f.isCorrect?COLORS.correct:COLORS.text;
      const bg2=f.isCorrect?"rgba(52,211,153,.15)":"rgba(255,255,255,.07)";
      const bc=f.isCorrect?"rgba(52,211,153,.5)":"rgba(255,255,255,.15)";
      if(f.isCorrect){ctx.shadowColor=COLORS.correct;ctx.shadowBlur=10;}
      renderer.roundRect(-f.w/2,-f.h/2,f.w,f.h,10,bg2,bc,f.isCorrect?1.5:1);
      ctx.shadowBlur=0;
      renderer.text(`${f.letter}. ${f.text}`,0,0,{size:11,weight:"700",color:col,align:"center",baseline:"middle"});
      ctx.restore();
    });
    this._scorePopups.forEach(p=>{ctx.save();ctx.globalAlpha=p.alpha;renderer.text(p.text,p.x,p.y,{size:16,weight:"900",color:p.color,glow:p.color,glowBlur:8,align:"center"});ctx.restore();});
    renderer.scanlines(0.02); renderer.vignette(0.3);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// 🏎️ SPEED RUN GAME
// ════════════════════════════════════════════════════════════════════════════
export class SpeedRunScene extends CountdownMixin {
  constructor(questions, onFinish) {
    super();
    this.questions = questions;
    this.onFinish = onFinish;
  }
  init() {
    this.audio.play("countdown");
    this._initCountdown("SPEED RUN", COLORS.blue, () => this._startGame());
    this.qIdx=0; this.score=0; this._speed=20; this._progress=0;
    this._flash=0; this._flashColor=COLORS.correct; this._feedback=null; this._fbTimer=0;
    this._buttons=[]; this._roadOffset=0; this._carBounce=0; this._carBounceDir=1;
    this._scorePopups=[]; this._streakBoost=0;
  }
  _startGame() { this._buildButtons(); }
  get q() { return this.questions[this.qIdx]; }
  _buildButtons() {
    if (!this.q) return;
    const { width:W, height:H } = this.renderer;
    const bw=W*.44, bh=50, gap=W*.04;
    this._buttons = this.q.options.map((opt,i)=>({
      opt, isCorrect:opt.startsWith(this.q.answer), letter:LETTERS[i],
      x:W/2+(i%2===0?-1:1)*(bw/2+gap/2), y:H*.68+Math.floor(i/2)*(bh+10),
      w:bw, h:bh, scale:1, targetScale:1, hover:false,
      text:opt.replace(/^[A-D]\.\s*/,"").slice(0,26),
    }));
  }
  update(dt) {
    if (this._phase==="countdown"){this._updateCountdown(dt);return;}
    if (this._phase==="result") return;
    this._flash=Math.max(0,this._flash-dt*4);
    this._scorePopups=this._scorePopups.map(p=>({...p,y:p.y-50*dt,alpha:p.alpha-dt*1.5})).filter(p=>p.alpha>0);
    // Progress
    this._progress=Math.min(1,this._progress+this._speed/6000);
    if(this._progress>=1){this._finish();return;}
    // Road animation
    this._roadOffset=(this._roadOffset+this._speed*dt*2)%80;
    // Car bounce
    this._carBounce+=dt*this._speed*0.15; 
    // Feedback timer
    if(this._feedback){this._fbTimer-=dt;if(this._fbTimer<=0){this._feedback=null;this._buildButtons();}}
    if(this._feedback) return;
    // Buttons
    this._buttons.forEach(btn=>{
      btn.hover=this.input.hitTest(btn.x-btn.w/2,btn.y-btn.h/2,btn.w,btn.h);
      btn.targetScale=btn.hover?1.04:1;
      btn.scale=Math2.lerp(btn.scale,btn.targetScale,0.2);
      if(this.input.wasHit(btn.x-btn.w/2,btn.y-btn.h/2,btn.w,btn.h)) this._onAnswer(btn);
    });
  }
  _onAnswer(btn) {
    const ok=btn.isCorrect;
    if(ok){
      this._speed=Math.min(this._speed+6,80);
      this.score+=Math.round(this._speed);
      this.audio.play("boost"); this._flash=0.12; this._flashColor=COLORS.correct;
      this._feedback={ok:true,text:"BOOST! 🚀"};
      this._streakBoost=Math.min(this._streakBoost+1,5);
      this.particles.emit(0,0,{count:12,colors:CORRECT_COLS,vy:-5,glow:true});
      this._scorePopups.push({x:this.renderer.width/2,y:this.renderer.height*.55,text:`+${Math.round(this._speed)}`,color:COLORS.green,alpha:1});
      this.camera.shake(2,0.1);
    } else {
      this._speed=Math.max(this._speed-10,5);
      this.audio.play("brake"); this._flash=0.1; this._flashColor=COLORS.wrong;
      this._feedback={ok:false,text:"BRAKE! 🛑"};
      this._streakBoost=0; this.camera.shake(6,0.3);
    }
    this._fbTimer=0.55;
    this.qIdx++; if(this.qIdx>=this.questions.length){this._finish();}
  }
  _finish() {
    this.audio.play("jackpot");
    this.onFinish(this.score,{"Top Speed":`${Math.round(this._speed)}km/h`,"Questions":this.questions.length});
  }
  draw(renderer) {
    const { width:W, height:H } = renderer;
    if(this._phase==="countdown"){this._drawCountdown(renderer);return;}
    renderer.clear(COLORS.bg); const ctx=renderer.ctx;
    if(this._flash>0) renderer.flash(this._flashColor,this._flash);
    // Sky gradient
    const sky=renderer.linearGrad(0,0,0,H*.5,[[0,"#0a0a1f"],[1,"#07070f"]]);
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H*.5);
    // Road
    const roadY=H*.42, roadH=H*.28;
    renderer.roundRect(0,roadY,W,roadH,0,"#111118");
    // Lane markings
    ctx.save(); ctx.strokeStyle="rgba(251,191,36,.3)"; ctx.lineWidth=3; ctx.setLineDash([40,40]);
    ctx.lineDashOffset=-this._roadOffset;
    ctx.beginPath(); ctx.moveTo(0,roadY+roadH/2); ctx.lineTo(W,roadY+roadH/2); ctx.stroke();
    ctx.restore();
    // Road edges
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(0,roadY); ctx.lineTo(W,roadY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,roadY+roadH); ctx.lineTo(W,roadY+roadH); ctx.stroke();
    // Progress on road
    const carX=W*.1+this._progress*(W*.8);
    const carY=roadY+roadH/2+Math.sin(this._carBounce)*2;
    // Speed trail
    for(let i=1;i<=4;i++){
      ctx.save(); ctx.globalAlpha=(0.08*this._speed/80)*(1-i/5);
      ctx.font="28px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText("🏎️",carX-i*14*this._speed/40,carY);
      ctx.restore();
    }
    // Car
    ctx.font="32px serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("🏎️",carX,carY);
    // Finish flag
    ctx.font="24px serif"; ctx.fillText("🏁",W*.95,carY);
    // Speed bar
    renderer.text("⚡ SPEED",W*.08,H*.12,{size:10,weight:"700",color:COLORS.muted,family:"'Space Mono',monospace",align:"left"});
    const speedRatio=this._speed/80;
    const sCol=speedRatio>.6?COLORS.green:speedRatio>.3?COLORS.yellow:COLORS.red;
    renderer.progressBar(W*.08,H*.155,W*.45,8,speedRatio,"rgba(255,255,255,.07)",sCol,4,sCol);
    renderer.text(`${Math.round(this._speed)} km/h`,W*.08,H*.19,{size:11,weight:"700",color:sCol,align:"left"});
    renderer.text(`🏎️ ${this.score}`,W*.75,H*.12,{size:22,weight:"900",color:COLORS.blue,glow:COLORS.blue,glowBlur:10,align:"center"});
    renderer.progressBar(W*.08,H*.26,W*.84,5,this._progress,"rgba(255,255,255,.07)",COLORS.blue,3,COLORS.blue);
    renderer.text(`Q${this.qIdx}/${this.questions.length}`,W*.92,H*.26+3,{size:10,weight:"700",color:COLORS.muted,family:"'Space Mono',monospace",align:"right",baseline:"middle"});
    // Question
    if(this.q&&!this._feedback){
      ctx.save(); ctx.font="700 15px 'Sora',sans-serif"; ctx.fillStyle=COLORS.text; ctx.textAlign="center"; ctx.textBaseline="top";
      const words=this.q.question.split(" ");let lines=[],line="";
      words.forEach(w=>{const t=line?line+" "+w:w;if(ctx.measureText(t).width>W*.84){lines.push(line);line=w;}else line=t;});
      lines.push(line); lines.slice(0,2).forEach((l,i)=>ctx.fillText(l,W/2,H*.31+i*22));
      ctx.restore();
      // Buttons
      this._buttons.forEach(btn=>{
        ctx.save(); ctx.translate(btn.x,btn.y); ctx.scale(btn.scale,btn.scale);
        renderer.roundRect(-btn.w/2,-btn.h/2,btn.w,btn.h,12,btn.hover?"rgba(96,165,250,.12)":"rgba(255,255,255,.06)",btn.hover?COLORS.blue:"rgba(255,255,255,.14)",btn.hover?1.5:1);
        renderer.roundRect(-btn.w/2+8,-14,28,28,6,"rgba(255,255,255,.1)");
        renderer.text(btn.letter,-btn.w/2+22,0,{size:11,weight:"700",color:btn.hover?COLORS.blue:COLORS.muted,family:"'Space Mono',monospace",align:"center"});
        renderer.text(btn.text,10,0,{size:13,weight:"600",color:btn.hover?COLORS.blue:COLORS.text,align:"left",baseline:"middle"});
        ctx.restore();
      });
    }
    if(this._feedback){
      ctx.save(); ctx.translate(W/2,H*.62);
      const sc=Math2.ease.outBack(Math.min((0.55-this._fbTimer)/0.55*2,1));
      ctx.scale(sc,sc);
      renderer.text(this._feedback.text,0,0,{size:28,weight:"900",color:this._feedback.ok?COLORS.green:COLORS.red,glow:this._feedback.ok?COLORS.green:COLORS.red,glowBlur:14,align:"center"});
      ctx.restore();
    }
    this._scorePopups.forEach(p=>{ctx.save();ctx.globalAlpha=p.alpha;renderer.text(p.text,p.x,p.y,{size:18,weight:"900",color:p.color,glow:p.color,glowBlur:10,align:"center"});ctx.restore();});
    renderer.scanlines(0.02); renderer.vignette(0.3);
  }
}

// ── RESULT SCENE ──────────────────────────────────────────────────────────────
export class ResultScene extends Scene {
  constructor(score, stats, color, icon, title, onContinue) {
    super();
    this._score=score; this._stats=stats; this._color=color;
    this._icon=icon; this._title=title; this._onContinue=onContinue;
    this._anim=0; this._displayScore=0;
    this._continueBtn=null;
  }
  init() {
    this.audio.play("levelUp");
    this.particles.burst(this.renderer.width/2, this.renderer.height*.35, {count:50,colors:[this._color,"#fff","#fbbf24"],maxSpeed:10,glow:true});
    this._continueBtn = new CanvasButton(this.renderer.width/2, this.renderer.height*.82, 220, 54, "Continue →", {color:this._color,textColor:"#0a0a14",glow:true,onClick:this._onContinue});
  }
  update(dt) {
    this._anim=Math.min(this._anim+dt*1.8,1);
    this._displayScore=Math.round(Math2.ease.outQuad(this._anim)*this._score);
    this._continueBtn.update(this.input);
  }
  draw(renderer) {
    const {width:W,height:H}=renderer; const ctx=renderer.ctx;
    renderer.clear(COLORS.bg);
    ctx.save(); ctx.globalAlpha=0.1*this._anim;
    const g=renderer.radialGrad(W/2,H*.35,0,W/2,H*.35,W*.6,[[0,this._color],[1,"transparent"]]);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H); ctx.restore();
    const iconScale=Math2.ease.outBack(Math.min(this._anim*1.5,1));
    ctx.save(); ctx.translate(W/2,H*.2); ctx.scale(iconScale,iconScale);
    ctx.font="64px serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText(this._icon,0,0);
    ctx.restore();
    renderer.text(this._title,W/2,H*.35,{size:32,weight:"900",color:this._color,family:"'Bebas Neue',sans-serif",glow:this._color,glowBlur:20,align:"center"});
    ctx.save(); ctx.globalAlpha=this._anim; ctx.shadowColor=this._color; ctx.shadowBlur=16;
    ctx.font="900 56px 'Sora',sans-serif"; ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(this._displayScore,W/2,H*.5); ctx.restore();
    if(this._stats){
      const stats=Object.entries(this._stats);
      const sw=Math.min(120,(W-40)/stats.length-10),gap=8;
      const total=stats.length*(sw+gap)-gap;
      let sx=W/2-total/2+sw/2;
      stats.forEach(([label,val])=>{
        renderer.roundRect(sx-sw/2,H*.6-28,sw,56,12,"rgba(255,255,255,.06)","rgba(255,255,255,.1)");
        renderer.text(String(val),sx,H*.6-5,{size:20,weight:"900",color:COLORS.text,align:"center"});
        renderer.text(label,sx,H*.6+16,{size:9,weight:"600",color:COLORS.muted,family:"'Space Mono',monospace",align:"center"});
        sx+=sw+gap;
      });
    }
    this._continueBtn.draw(renderer);
    renderer.scanlines(0.02); renderer.vignette(0.3);
  }
}
