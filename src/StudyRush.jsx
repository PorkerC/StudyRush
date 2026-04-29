import { useState, useEffect, useRef, useCallback } from "react";

const MODEL = "claude-haiku-4-5-20251001";
const HDRS = () => ({
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

// ── Audio Engine ──────────────────────────────────────────────────────────────
let actx = null;
function getACtx() {
  if (!actx) try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  return actx;
}
function tone(freq, dur, type = "sine", vol = 0.25, delay = 0) {
  const ctx = getACtx(); if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    g.gain.setValueAtTime(vol, ctx.currentTime + delay);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    o.start(ctx.currentTime + delay); o.stop(ctx.currentTime + delay + dur);
  } catch {}
}
const SFX = {
  click:   () => tone(600, 0.04, "square", 0.1),
  correct: () => { tone(523,.1,"sine",.25); tone(659,.1,"sine",.25,.1); tone(784,.25,"sine",.25,.2); },
  wrong:   () => { tone(220,.15,"sawtooth",.2); tone(165,.2,"sawtooth",.18,.12); },
  streak:  () => [523,587,659,784,1047].forEach((f,i)=>tone(f,.1,"sine",.22,i*.07)),
  jackpot: () => { [523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.12,"sine",.28,i*.06)); tone(1047,.6,"sine",.15,.5); },
  levelUp: () => [392,494,587,784,1047].forEach((f,i)=>tone(f,.18,"sine",.28,i*.09)),
  boss:    () => { [80,60,40].forEach((f,i)=>tone(f,.35,"sawtooth",.3,i*.25)); },
  tick:    () => tone(880,.03,"square",.06),
  danger:  () => tone(110,.08,"sine",.3),
  select:  () => tone(440,.05,"sine",.12),
};

// ── Personas ──────────────────────────────────────────────────────────────────
const PERSONAS = [
  { id:"wit",      emoji:"🎓", name:"Dr. Wit",        color:"#b87fff", tone:"witty and sarcastic like a genius professor who thinks you're barely keeping up" },
  { id:"drill",    emoji:"⚔️", name:"Sgt. Drill",     color:"#ff4d6d", tone:"intense military drill sergeant — harsh but you WILL learn" },
  { id:"hype",     emoji:"🔥", name:"Coach Hype",     color:"#f0e040", tone:"absolutely unhinged hype beast — every correct answer is the greatest achievement in human history" },
  { id:"chill",    emoji:"😎", name:"Alex Chill",     color:"#40e0d0", tone:"super relaxed supportive friend, no pressure, good vibes only" },
  { id:"sensei",   emoji:"🥷", name:"Sensei",         color:"#39d98a", tone:"ancient wise master who speaks in metaphors and riddles" },
  { id:"skibidi",  emoji:"🗣️", name:"Skibidi Scholar",color:"#ff8800", tone:"full Gen Z brainrot — uses rizz, sigma, skibidi, no cap, bussin, fr fr, but somehow explains things perfectly" },
  { id:"girl",     emoji:"💅", name:"That Girl",      color:"#ff6eb4", tone:"main character energy, studying is her Roman Empire, manifestation meets academia, everything is a vibe" },
  { id:"gigabot",  emoji:"🤖", name:"GigaBot",        color:"#4080ff", tone:"malfunctioning AI that glitches mid-sentence with [ERROR] and [REBOOTING] but somehow teaches perfectly" },
  { id:"gremlin",  emoji:"🧌", name:"Gremlin",        color:"#a8ff40", tone:"chaotic unhinged little creature who is inexplicably a genius — feral energy, random capitalization" },
  { id:"shakespeare", emoji:"🎭", name:"Shakespeare", color:"#ffd700", tone:"full Shakespearean dramatic prose — doth thou understand? thine answer was most excellent/wretched" },
];

const LEVELS = [
  {name:"Rookie",xp:0,col:"#888"},{name:"Scholar",xp:150,col:"#40e0d0"},
  {name:"Expert",xp:400,col:"#39d98a"},{name:"Master",xp:900,col:"#f0e040"},
  {name:"Legend",xp:2000,col:"#ff4d6d"},{name:"Mythic",xp:5000,col:"#b87fff"},
  {name:"GOD MODE",xp:10000,col:"#fff"},
];
const getLevel = xp => [...LEVELS].reverse().find(l=>xp>=l.xp) || LEVELS[0];
const getNextLevel = xp => LEVELS.find(l=>l.xp>xp);

// ── API ───────────────────────────────────────────────────────────────────────
async function api(prompt, maxTokens=1400) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:HDRS(),
    body:JSON.stringify({model:MODEL, max_tokens:maxTokens, messages:[{role:"user",content:prompt}]})
  });
  if (!r.ok) { const e=await r.json(); throw new Error(e.error?.message||`HTTP ${r.status}`); }
  const d = await r.json();
  return d.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
}

async function genQuestions(text, count, diff, persona) {
  const p = `You are a quiz generator. Persona: ${persona?.tone||"neutral"}.
Generate exactly ${count} quiz questions at ${diff} difficulty from this material.
Mix types: mc (4 options), tf, short. Return ONLY valid JSON, no markdown:
{"topic":"name","questions":[
{"id":1,"type":"mc","question":"?","options":["A text","B text","C text","D text"],"answer":"A","explanation":"why","hint":"one word"},
{"id":2,"type":"tf","question":"?","answer":"True","explanation":"why","hint":"clue"},
{"id":3,"type":"short","question":"?","answer":"answer","explanation":"why","hint":"clue"}
]}
Material:"""${text.slice(0,3500)}"""`;
  return JSON.parse(await api(p,1600));
}

async function checkShort(question, correct, userAnswer) {
  const raw = await api(`Q:"${question}" Correct:"${correct}" Student:"${userAnswer}"
Is it correct or essentially equivalent? ONLY valid JSON no markdown:{"correct":true,"feedback":"one sentence"}`);
  return JSON.parse(raw);
}

async function personaReact(persona, correct, streak, qText) {
  const raw = await api(`You are ${persona.name}. Tone: ${persona.tone}.
Student answered "${qText.slice(0,60)}" ${correct?"CORRECTLY":"INCORRECTLY"}. Streak: ${streak}.
React in character. 1 punchy sentence max 15 words. No quotes around response.`, 200);
  return raw.trim().replace(/^["']|["']$/g,"");
}

async function predictScore(history) {
  const s = history.slice(-15).map(h=>`${h.topic}:${h.score}/${h.total}(${h.diff})`).join(",");
  const raw = await api(`Study history: ${s}
Predict exam performance. ONLY valid JSON:{"grade":"B+","pct":85,"strong":["topic"],"weak":["topic"],"tip":"2 sentence advice","confidence":"medium"}`);
  return JSON.parse(raw);
}

async function genBoss(topic, wrongQs) {
  const raw = await api(`Generate 3 VERY HARD boss-level questions on "${topic}". Focus on: ${wrongQs.slice(0,3).join(", ")||"core concepts"}.
ONLY valid JSON: {"questions":[{"id":99,"type":"mc","question":"?","options":["A text","B text","C text","D text"],"answer":"A","explanation":"why","hint":"clue"}]}`);
  return JSON.parse(raw);
}

// ── Particle System ───────────────────────────────────────────────────────────
function Particles({ type, active }) {
  if (!active) return null;
  const colors = {
    correct:["#f0e040","#39d98a","#40e0d0","#fff"],
    wrong:["#ff4d6d","#ff8800"],
    jackpot:["#f0e040","#fff","#ffd700","#ff8800","#40e0d0"],
    boss:["#ff4d6d","#b87fff","#ff8800","#fff"],
  }[type]||["#f0e040"];
  const count = type==="jackpot"?80:type==="boss"?60:25;
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      {Array.from({length:count}).map((_,i)=>{
        const col = colors[i%colors.length];
        const size = Math.random()*12+4;
        const x = Math.random()*100;
        const delay = Math.random()*0.6;
        const dur = 0.9+Math.random()*1.4;
        return <div key={i} style={{
          position:"absolute",left:`${x}%`,top:"-10px",
          width:size,height:size,background:col,
          borderRadius:Math.random()>.5?"50%":"3px",
          animation:`sr_fall ${dur}s ease-in ${delay}s forwards`,
          transform:`rotate(${Math.random()*360}deg)`
        }}/>;
      })}
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

@keyframes sr_fall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}
@keyframes sr_up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes sr_pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes sr_spin{to{transform:rotate(360deg)}}
@keyframes sr_pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes sr_shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}
@keyframes sr_glow{0%,100%{box-shadow:0 0 15px rgba(240,224,64,.25)}50%{box-shadow:0 0 40px rgba(240,224,64,.6),0 0 80px rgba(240,224,64,.2)}}
@keyframes sr_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes sr_xpfly{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-90px) scale(1.4)}}
@keyframes sr_bossIn{from{opacity:0;transform:scale(1.8) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
@keyframes sr_scan{0%{top:-5%}100%{top:105%}}
@keyframes sr_fire{0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.12) scaleX(.9)}}
@keyframes sr_slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07070f;--s1:#0e0e1b;--s2:#151525;--s3:#1c1c30;
  --bd:#22223a;--bd2:#2e2e50;
  --y:#f0e040;--r:#ff4d6d;--c:#40e0d0;--g:#39d98a;--p:#b87fff;--o:#ff8800;
  --tx:#f0f0ff;--mu:#5858a0;--rad:14px;
}
html,body,#root{height:100%;background:var(--bg);color:var(--tx);font-family:'Outfit',sans-serif}
.sr-app{min-height:100vh;position:relative;
  background:var(--bg);
  background-image:radial-gradient(ellipse 70% 50% at 15% 0%,rgba(240,224,64,.05) 0%,transparent 55%),
    radial-gradient(ellipse 50% 40% at 85% 100%,rgba(255,77,109,.05) 0%,transparent 55%),
    radial-gradient(ellipse 40% 30% at 50% 50%,rgba(64,224,208,.03) 0%,transparent 60%);
}
.sr-app::after{content:'';position:fixed;top:-5%;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,rgba(240,224,64,.15),transparent);animation:sr_scan 4s linear infinite;pointer-events:none;z-index:999}

/* NAV */
.nav{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;border-bottom:1px solid var(--bd);position:sticky;top:0;z-index:200;background:rgba(7,7,15,.88);backdrop-filter:blur(20px)}
.logo{font-family:'Bebas Neue',sans-serif;font-size:26px;letter-spacing:3px;color:var(--y);text-shadow:0 0 25px rgba(240,224,64,.45);cursor:pointer}
.nav-pills{display:flex;gap:8px;flex-wrap:wrap}
.pill{display:flex;align-items:center;gap:5px;background:var(--s2);border:1px solid var(--bd);border-radius:100px;padding:4px 11px;font-size:11px;font-family:'Space Mono',monospace;white-space:nowrap;cursor:default}
.pill.y{color:var(--y);border-color:rgba(240,224,64,.25)}
.pill.c{color:var(--c);border-color:rgba(64,224,208,.25)}
.pill.g{color:var(--g);border-color:rgba(57,217,138,.25)}
.pill.p{color:var(--p);border-color:rgba(184,127,255,.25)}

/* SCREENS */
.screen{max-width:800px;margin:0 auto;padding:36px 18px;animation:sr_up .3s ease}

/* HOME NAV */
.home-tabs{display:flex;gap:10px;margin-bottom:32px;flex-wrap:wrap}
.home-tab{flex:1;min-width:100px;padding:12px;border-radius:12px;border:1px solid var(--bd);background:var(--s1);color:var(--mu);cursor:pointer;font-weight:700;font-size:13px;transition:all .2s;text-align:center}
.home-tab:hover{border-color:var(--y);color:var(--y)}
.home-tab.active{background:rgba(240,224,64,.1);border-color:var(--y);color:var(--y)}

/* HERO */
.hero-badge{display:inline-block;background:rgba(240,224,64,.08);border:1px solid rgba(240,224,64,.25);color:var(--y);border-radius:100px;padding:4px 14px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px;font-family:'Space Mono',monospace}
.hero h1{font-family:'Bebas Neue',sans-serif;font-size:clamp(52px,9vw,88px);letter-spacing:4px;line-height:.9;margin-bottom:14px}
.hero h1 em{color:var(--y);text-shadow:0 0 30px rgba(240,224,64,.4);font-style:normal}
.hero p{font-size:16px;color:var(--mu);max-width:460px;line-height:1.6;margin-bottom:36px}

/* CARD */
.card{background:var(--s1);border:1px solid var(--bd);border-radius:20px;padding:22px;margin-bottom:16px}
.card-title{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1.5px;color:var(--y);margin-bottom:14px}

/* TABS */
.tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.tab{flex:1;min-width:70px;padding:8px 10px;border-radius:9px;border:1px solid var(--bd);background:transparent;color:var(--mu);cursor:pointer;font-size:12px;font-weight:700;transition:all .2s;text-align:center}
.tab:hover{border-color:var(--y);color:var(--y)}
.tab.on{background:rgba(240,224,64,.1);border-color:var(--y);color:var(--y)}

/* INPUTS */
textarea,.inp{width:100%;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rad);color:var(--tx);font-family:'Outfit',sans-serif;font-size:14px;padding:12px 14px;outline:none;transition:border-color .2s}
textarea{min-height:130px;resize:vertical;line-height:1.6}
textarea:focus,.inp:focus{border-color:var(--y)}
textarea::placeholder,.inp::placeholder{color:var(--mu)}
.inp{font-family:'Space Mono',monospace;font-size:13px}
.inp:focus{border-color:var(--c)}
select{width:100%;background:var(--s2);border:1px solid var(--bd);border-radius:var(--rad);color:var(--tx);padding:10px 12px;font-family:'Outfit',sans-serif;font-size:13px;outline:none;cursor:pointer}
select:focus{border-color:var(--y)}
.row{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
.row>*{flex:1;min-width:120px}

/* PERSONA GRID */
.persona-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
.p-btn{padding:10px 6px;border-radius:12px;border:2px solid var(--bd);background:var(--s2);cursor:pointer;text-align:center;transition:all .2s;position:relative}
.p-btn:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.2)}
.p-btn.on{border-color:var(--y);background:rgba(240,224,64,.07);animation:sr_glow 2s infinite}
.p-em{font-size:22px;display:block;margin-bottom:3px}
.p-nm{font-size:9px;color:var(--mu);font-family:'Space Mono',monospace;line-height:1.2}
.p-btn.on .p-nm{color:var(--y)}

/* DRAG DROP */
.drop{border:2px dashed var(--bd);border-radius:16px;padding:28px;text-align:center;cursor:pointer;transition:all .25s;color:var(--mu);font-size:13px}
.drop:hover,.drop.over{border-color:var(--y);background:rgba(240,224,64,.04);color:var(--y)}
.drop .drop-icon{font-size:32px;margin-bottom:8px}
.recent-files{display:flex;flex-direction:column;gap:6px;margin-top:10px}
.recent-file{display:flex;align-items:center;justify-content:space-between;background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;cursor:pointer;transition:all .2s;font-size:13px}
.recent-file:hover{border-color:var(--y);color:var(--y)}

/* BTNS */
.btn{padding:12px 18px;border-radius:var(--rad);border:none;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px}
.btn-y{background:var(--y);color:#07070f;width:100%;padding:15px;font-size:15px;margin-top:14px}
.btn-y:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(240,224,64,.3)}
.btn-y:disabled{opacity:.35;cursor:not-allowed}
.btn-ghost{background:var(--s2);border:1px solid var(--bd);color:var(--tx)}
.btn-ghost:hover{border-color:var(--y);color:var(--y)}
.btn-r{background:var(--r);color:#fff}
.btn-r:hover{box-shadow:0 6px 20px rgba(255,77,109,.4)}
.btn-boss{background:linear-gradient(135deg,#ff4d6d,#b87fff);color:#fff;font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;width:100%;padding:18px;animation:sr_pulse 1.5s infinite;border:none;border-radius:var(--rad);cursor:pointer;margin-top:14px}
.btn-boss:hover{box-shadow:0 0 40px rgba(255,77,109,.5)}

/* HUD */
.hud{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
.hud-c{background:var(--s1);border:1px solid var(--bd);border-radius:var(--rad);padding:10px;text-align:center}
.hud-l{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu);font-family:'Space Mono',monospace;margin-bottom:2px}
.hud-v{font-family:'Bebas Neue',sans-serif;font-size:30px;line-height:1}

/* TIMER */
.timer-track{height:8px;background:var(--s2);border-radius:100px;margin-bottom:20px;overflow:hidden}
.timer-fill{height:100%;border-radius:100px;transition:width .1s linear,background .4s;background:linear-gradient(90deg,var(--c),var(--y))}
.timer-fill.low{background:linear-gradient(90deg,var(--r),var(--o));animation:sr_pulse .5s infinite}

/* PROGRESS */
.prog-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.prog-track{flex:1;height:5px;background:var(--s2);border-radius:100px;overflow:hidden}
.prog-fill{height:100%;background:var(--y);border-radius:100px;transition:width .4s ease}
.prog-lbl{font-family:'Space Mono',monospace;font-size:11px;color:var(--mu);white-space:nowrap}

/* QUESTION */
.q-card{background:var(--s1);border:1px solid var(--bd);border-radius:20px;padding:26px;margin-bottom:14px;animation:sr_up .25s ease}
.q-card.shake{animation:sr_shake .4s ease}
.q-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.q-num{font-family:'Space Mono',monospace;font-size:10px;color:var(--mu)}
.q-badge{font-size:9px;text-transform:uppercase;letter-spacing:.09em;padding:3px 9px;border-radius:100px;font-family:'Space Mono',monospace}
.q-text{font-size:18px;font-weight:800;line-height:1.4;letter-spacing:-.3px;margin-bottom:18px}
.hint-btn{background:none;border:1px solid var(--bd);border-radius:8px;color:var(--mu);padding:4px 10px;font-size:11px;cursor:pointer;margin-bottom:12px;transition:all .2s}
.hint-btn:hover{border-color:var(--c);color:var(--c)}
.hint-text{font-size:12px;color:var(--c);background:rgba(64,224,208,.08);border:1px solid rgba(64,224,208,.2);border-radius:8px;padding:6px 12px;margin-bottom:12px;font-family:'Space Mono',monospace}

/* OPTIONS */
.opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.opt{padding:13px 15px;background:var(--s2);border:2px solid var(--bd);border-radius:var(--rad);color:var(--tx);cursor:pointer;font-family:'Outfit',sans-serif;font-size:13px;text-align:left;transition:all .15s;display:flex;align-items:center;gap:9px;line-height:1.4;font-weight:600}
.opt:hover:not(:disabled){border-color:var(--y);background:rgba(240,224,64,.06);transform:translateY(-1px)}
.opt.sel{border-color:var(--y);background:rgba(240,224,64,.09)}
.opt.ok{border-color:var(--g)!important;background:rgba(57,217,138,.1)!important;color:var(--g)!important}
.opt.bad{border-color:var(--r)!important;background:rgba(255,77,109,.08)!important;color:var(--r)!important}
.opt:disabled{cursor:default}
.opt-ltr{width:24px;height:24px;border-radius:6px;background:var(--s1);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;flex-shrink:0}
.tf-row{display:flex;gap:10px}
.tf-btn{flex:1;padding:15px;border-radius:var(--rad);border:2px solid var(--bd);background:var(--s2);color:var(--tx);cursor:pointer;font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:1px;transition:all .15s}
.tf-btn:hover:not(:disabled){border-color:var(--y);transform:translateY(-1px)}
.tf-btn.sel{border-color:var(--y);background:rgba(240,224,64,.09)}
.tf-btn.ok{border-color:var(--g)!important;background:rgba(57,217,138,.1)!important;color:var(--g)!important}
.tf-btn.bad{border-color:var(--r)!important;background:rgba(255,77,109,.08)!important;color:var(--r)!important}
.short-wrap{display:flex;flex-direction:column;gap:8px}
.short-inp{width:100%;background:var(--s2);border:2px solid var(--bd);border-radius:var(--rad);color:var(--tx);font-family:'Outfit',sans-serif;font-size:15px;padding:12px 14px;outline:none;transition:border-color .2s}
.short-inp:focus{border-color:var(--y)}
.btn-submit{padding:12px;background:var(--y);color:#07070f;border:none;border-radius:var(--rad);font-family:'Outfit',sans-serif;font-weight:800;font-size:14px;cursor:pointer;transition:all .2s}
.btn-submit:hover{transform:translateY(-1px)}
.btn-submit:disabled{opacity:.35;cursor:not-allowed}

/* FEEDBACK */
.fb{padding:12px 16px;border-radius:var(--rad);margin-top:12px;font-size:13px;line-height:1.5;animation:sr_up .2s ease}
.fb.ok{background:rgba(57,217,138,.08);border:1px solid rgba(57,217,138,.25);color:#8dffc0}
.fb.bad{background:rgba(255,77,109,.07);border:1px solid rgba(255,77,109,.22);color:#ff9090}

/* PERSONA BUBBLE */
.p-bubble{display:flex;align-items:flex-start;gap:11px;background:var(--s2);border:1px solid var(--bd2);border-radius:14px;padding:12px 16px;margin-top:12px;animation:sr_up .3s ease}
.p-av{font-size:26px;flex-shrink:0;animation:sr_float 3s ease-in-out infinite}
.p-txt{font-size:13px;line-height:1.55;font-style:italic;color:var(--tx)}

/* XP POPUP */
.xp-pop{position:fixed;top:70px;right:20px;z-index:9000;font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--y);text-shadow:0 0 20px rgba(240,224,64,.7);pointer-events:none;animation:sr_xpfly .9s ease-out forwards}

/* STREAK OVERLAY */
.streak-ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9500;pointer-events:none}
.streak-box{background:var(--s1);border:3px solid var(--y);border-radius:24px;padding:32px 52px;text-align:center;animation:sr_pop .4s cubic-bezier(.34,1.56,.64,1)}
.streak-em{font-size:56px;display:block;animation:sr_fire 1s ease-in-out infinite}
.streak-txt{font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--y);letter-spacing:2px}

/* JACKPOT */
.jackpot-ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9600;background:rgba(0,0,0,.7);pointer-events:none}
.jackpot-box{background:linear-gradient(135deg,#1a1a00,#0f1a0f);border:3px solid var(--y);border-radius:24px;padding:40px 60px;text-align:center;animation:sr_pop .5s cubic-bezier(.34,1.56,.64,1)}
.jackpot-txt{font-family:'Bebas Neue',sans-serif;font-size:52px;color:var(--y);text-shadow:0 0 30px rgba(240,224,64,.6);letter-spacing:3px}

/* BOSS SCREEN */
.boss-screen{text-align:center;margin-bottom:28px;animation:sr_bossIn .5s ease}
.boss-emoji{font-size:80px;display:block;margin-bottom:12px;animation:sr_float 2s ease-in-out infinite}
.boss-title{font-family:'Bebas Neue',sans-serif;font-size:52px;letter-spacing:3px;color:var(--r);text-shadow:0 0 30px rgba(255,77,109,.5)}
.boss-hp{height:18px;background:var(--s2);border-radius:100px;overflow:hidden;margin:16px 0;border:1px solid rgba(255,77,109,.2)}
.boss-hp-fill{height:100%;background:linear-gradient(90deg,var(--r),var(--o));border-radius:100px;transition:width .5s ease}

/* RESULTS */
.results{text-align:center;padding-bottom:40px}
.grade{font-family:'Bebas Neue',sans-serif;font-size:96px;letter-spacing:2px;line-height:1;background:linear-gradient(135deg,var(--y),var(--c));-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:sr_pop .5s cubic-bezier(.34,1.56,.64,1)}
.res-title{font-family:'Bebas Neue',sans-serif;font-size:32px;letter-spacing:2px;margin-bottom:6px}
.res-sub{color:var(--mu);font-size:14px;margin-bottom:32px}
.ring-wrap{display:flex;justify-content:center;margin-bottom:32px;position:relative}
.ring-wrap svg{filter:drop-shadow(0 0 20px rgba(240,224,64,.3))}
.ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring-pct{font-family:'Bebas Neue',sans-serif;font-size:42px;color:var(--y)}
.ring-sub{font-size:11px;color:var(--mu);font-family:'Space Mono',monospace}
.res-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
.res-stat{background:var(--s1);border:1px solid var(--bd);border-radius:var(--rad);padding:14px}
.res-val{font-family:'Bebas Neue',sans-serif;font-size:32px;margin-bottom:2px}
.res-lbl{font-size:10px;color:var(--mu);text-transform:uppercase;letter-spacing:.08em;font-family:'Space Mono',monospace}
.share-card{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:20px;margin-bottom:16px;text-align:left}
.share-txt{background:var(--s2);border-radius:10px;padding:12px 14px;font-family:'Space Mono',monospace;font-size:12px;color:var(--mu);line-height:1.7;margin-bottom:12px;white-space:pre-wrap}
.share-btns{display:flex;gap:8px}
.share-btn{flex:1;padding:10px;border-radius:10px;border:1px solid var(--bd);background:var(--s2);color:var(--tx);cursor:pointer;font-size:13px;font-weight:700;transition:all .2s;font-family:'Outfit',sans-serif}
.share-btn:hover{border-color:var(--y);color:var(--y)}

/* PREDICTOR */
.predict-card{background:linear-gradient(135deg,var(--s1),rgba(184,127,255,.05));border:1px solid rgba(184,127,255,.2);border-radius:20px;padding:24px;margin-bottom:16px;animation:sr_up .4s ease}
.predict-grade{font-family:'Bebas Neue',sans-serif;font-size:64px;color:var(--p);text-shadow:0 0 30px rgba(184,127,255,.4);line-height:1}
.tag{display:inline-block;padding:3px 10px;border-radius:100px;font-size:11px;font-family:'Space Mono',monospace;margin:3px}
.tag-g{background:rgba(57,217,138,.1);border:1px solid rgba(57,217,138,.25);color:var(--g)}
.tag-r{background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.25);color:var(--r)}

/* HISTORY */
.history-list{display:flex;flex-direction:column;gap:8px}
.hist-item{background:var(--s2);border:1px solid var(--bd);border-radius:12px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;animation:sr_up .2s ease}
.hist-topic{font-weight:700;font-size:14px;margin-bottom:2px}
.hist-meta{font-size:11px;color:var(--mu);font-family:'Space Mono',monospace}
.hist-score{font-family:'Bebas Neue',sans-serif;font-size:24px;text-align:right}

/* DNA */
.dna-card{background:var(--s1);border:1px solid var(--bd);border-radius:16px;padding:18px;margin-bottom:10px}
.dna-bar-wrap{display:flex;align-items:center;gap:10px;margin:6px 0}
.dna-label{font-size:12px;width:100px;flex-shrink:0;text-overflow:ellipsis;overflow:hidden;white-space:nowrap}
.dna-track{flex:1;height:8px;background:var(--s2);border-radius:100px;overflow:hidden}
.dna-fill{height:100%;border-radius:100px;transition:width 1s ease}
.dna-pct{font-family:'Space Mono',monospace;font-size:11px;color:var(--mu);width:36px;text-align:right;flex-shrink:0}

/* DAILY */
.daily-card{background:linear-gradient(135deg,rgba(64,224,208,.08),rgba(57,217,138,.05));border:1px solid rgba(64,224,208,.2);border-radius:20px;padding:24px;text-align:center;animation:sr_up .3s ease}
.daily-title{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:2px;color:var(--c);margin-bottom:8px}
.daily-timer{font-family:'Space Mono',monospace;font-size:13px;color:var(--mu);margin-bottom:16px}
.leaderboard{display:flex;flex-direction:column;gap:6px}
.lb-row{display:flex;align-items:center;gap:12px;background:var(--s2);border:1px solid var(--bd);border-radius:10px;padding:10px 14px}
.lb-rank{font-family:'Bebas Neue',sans-serif;font-size:22px;width:28px;flex-shrink:0}
.lb-name{font-weight:700;flex:1;font-size:13px}
.lb-score{font-family:'Space Mono',monospace;font-size:12px;color:var(--y)}

/* LEVEL BAR */
.level-bar-wrap{margin:12px 0}
.level-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px}
.level-name{font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1px}
.level-track{height:6px;background:var(--s2);border-radius:100px;overflow:hidden}
.level-fill{height:100%;border-radius:100px;transition:width 1s ease}

/* NEXT BTN */
.btn-next{width:100%;padding:14px;background:var(--s2);border:2px solid var(--y);border-radius:var(--rad);color:var(--y);font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;cursor:pointer;margin-top:12px;transition:all .2s}
.btn-next:hover{background:rgba(240,224,64,.08);transform:translateY(-1px)}

/* LOADING */
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:55vh;gap:20px}
.loading-orb{width:72px;height:72px;border-radius:50%;border:3px solid var(--bd);border-top-color:var(--y);animation:sr_spin 1s linear infinite}
.loading-steps{display:flex;flex-direction:column;gap:8px;align-items:center}
.l-step{font-size:13px;color:var(--mu);display:flex;align-items:center;gap:8px;font-family:'Space Mono',monospace;transition:color .3s}
.l-step.done{color:var(--g)} .l-step.cur{color:var(--y)}

/* RESPONSIVE */
@media(max-width:600px){
  .hud{grid-template-columns:repeat(2,1fr)}
  .opts{grid-template-columns:1fr}
  .res-grid{grid-template-columns:repeat(2,1fr)}
  .persona-grid{grid-template-columns:repeat(5,1fr)}
  .nav{padding:10px 14px}
  .nav-pills{gap:5px}
  .pill{font-size:10px;padding:3px 8px}
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const LS = { get:(k,d)=>{ try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d} }, set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v))}catch{} } };
const LETTERS = ["A","B","C","D"];
function grade(pct){ if(pct>=95)return{l:"S+",m:"LEGENDARY! 🏆"}; if(pct>=90)return{l:"A+",m:"FLAWLESS! 🎉"}; if(pct>=80)return{l:"A",m:"Outstanding! 🔥"}; if(pct>=70)return{l:"B",m:"Solid work! 💪"}; if(pct>=60)return{l:"C",m:"Keep pushing! 📚"}; return{l:"D",m:"More practice needed 💡"}; }
function shareText(score,total,xp,topic,persona){ const pct=Math.round((score/total)*100); const g=grade(pct); return `🎮 STUDYRUSH\n📖 ${topic}\n✅ ${score}/${total} (${pct}%) — Grade: ${g.l}\n⚡ +${xp} XP${persona?"\n🎭 Tutor: "+persona.name:""}\n${g.m}\nstudyrush.app`; }

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function StudyRush() {
  // ── Persistent state ──
  const [totalXp, setTotalXp]       = useState(()=>LS.get("sr_xp",0));
  const [dayStreak, setDayStreak]   = useState(()=>LS.get("sr_streak",0));
  const [history, setHistory]       = useState(()=>LS.get("sr_history",[]));
  const [recentFiles, setRecentFiles] = useState(()=>LS.get("sr_files",[]));
  const [dna, setDna]               = useState(()=>LS.get("sr_dna",{})); // topic -> {correct,total}

  // ── UI state ──
  const [screen, setScreen]   = useState("home"); // home | loading | game | boss | results | history | dna | daily
  const [homeTab, setHomeTab] = useState("study");

  // ── Input state ──
  const [inputTab, setInputTab]   = useState("text");
  const [notes, setNotes]         = useState("");
  const [fileText, setFileText]   = useState("");
  const [fileName, setFileName]   = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [qCount, setQCount]       = useState("10");
  const [diff, setDiff]           = useState("medium");
  const [persona, setPersona]     = useState(PERSONAS[0]);
  const [dragOver, setDragOver]   = useState(false);

  // ── Game state ──
  const [questions, setQuestions] = useState([]);
  const [topic, setTopic]         = useState("");
  const [qIdx, setQIdx]           = useState(0);
  const [answered, setAnswered]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [shortVal, setShortVal]   = useState("");
  const [feedback, setFeedback]   = useState(null);
  const [checking, setChecking]   = useState(false);
  const [showHint, setShowHint]   = useState(false);
  const [shakeQ, setShakeQ]       = useState(false);
  const [personaMsg, setPersonaMsg] = useState(null);
  const [loadStep, setLoadStep]   = useState(0);

  // ── Score state ──
  const [score, setScore]       = useState(0);
  const [xp, setXp]             = useState(0);
  const [streak, setStreak]     = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [missedQs, setMissedQs] = useState([]);
  const [wrongTexts, setWrongTexts] = useState([]);
  const [multiplier, setMultiplier] = useState(1);

  // ── Effects ──
  const [particles, setParticles]   = useState(null);
  const [xpPopup, setXpPopup]       = useState(null);
  const [streakPopup, setStreakPopup] = useState(false);
  const [jackpotPopup, setJackpotPopup] = useState(false);
  const [levelUpPopup, setLevelUpPopup] = useState(false);

  // ── Boss state ──
  const [bossQs, setBossQs]       = useState([]);
  const [bossIdx, setBossIdx]     = useState(0);
  const [bossHp, setBossHp]       = useState(100);
  const [bossAnswered, setBossAnswered] = useState(false);
  const [bossSelected, setBossSelected] = useState(null);
  const [bossFeedback, setBossFeedback] = useState(null);
  const [bossScore, setBossScore] = useState(0);

  // ── Predictor ──
  const [prediction, setPrediction] = useState(null);
  const [predicting, setPredicting] = useState(false);

  // ── Timer ──
  const [timeLeft, setTimeLeft]     = useState(100);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const TIME = 30;

  useEffect(()=>{
    if (!timerActive) return;
    timerRef.current = setInterval(()=>{
      setTimeLeft(t=>{
        const next = t - (100/(TIME*10));
        if (next <= 20 && next > 19.9) SFX.danger();
        if (next <= 10) SFX.tick();
        if (next <= 0) { clearInterval(timerRef.current); if (!answered) handleTimeout(); return 0; }
        return next;
      });
    },100);
    return ()=>clearInterval(timerRef.current);
  },[timerActive]);

  const handleTimeout = useCallback(()=>{
    if (answered) return;
    setAnswered(true); setTimerActive(false); setStreak(0);
    const q = questions[qIdx];
    setFeedback({ok:false,text:"⏰ Time's up! "+q?.explanation});
    setShakeQ(true); setTimeout(()=>setShakeQ(false),500);
    SFX.wrong();
    setMissedQs(p=>[...p,q?.id]);
    setWrongTexts(p=>[...p,q?.question]);
  },[answered,questions,qIdx]);

  // ── File reading ──
  const readFile = useCallback((file)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const text = e.target.result;
      setFileText(text); setFileName(file.name);
      const entry = {name:file.name, text:text.slice(0,500), ts:Date.now()};
      const updated = [entry, ...recentFiles.filter(f=>f.name!==file.name)].slice(0,8);
      setRecentFiles(updated); LS.set("sr_files",updated);
      SFX.click();
    };
    reader.readAsText(file);
  },[recentFiles]);

  const handleDrop = useCallback(e=>{
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  },[readFile]);

  // ── Generate ──
  const handleGenerate = async ()=>{
    const content = inputTab==="text" ? notes : inputTab==="file" ? fileText : `YouTube: ${youtubeUrl} — generate questions about the topic from this URL.`;
    if (!content.trim()) return;
    SFX.click();
    setScreen("loading"); setLoadStep(0);
    setScore(0); setXp(0); setStreak(0); setBestStreak(0);
    setMissedQs([]); setWrongTexts([]); setQIdx(0);
    setAnswered(false); setFeedback(null); setSelected(null); setPersonaMsg(null);

    const steps = ["Analyzing material…","Crafting questions…","Calibrating difficulty…","Prepping game…"];
    for (let i=0;i<steps.length-1;i++){ setLoadStep(i); await new Promise(r=>setTimeout(r,500)); }

    try {
      const result = await genQuestions(content, parseInt(qCount), diff, persona);
      setQuestions(result.questions); setTopic(result.topic||"Your Notes");
      setLoadStep(3); await new Promise(r=>setTimeout(r,300));
      setTimeLeft(100); setTimerActive(true); setScreen("game");
    } catch(e) {
      alert("Error: "+e.message); setScreen("home");
    }
  };

  // ── Answer logic ──
  const calcXP = (ok, tl) => {
    if (!ok) return 0;
    const base = diff==="easy"?8:diff==="hard"?22:14;
    const tb = Math.floor((tl/100)*8);
    const sm = streak>=4?3:streak>=2?2:1;
    return Math.round((base+tb)*sm*multiplier);
  };

  const processResult = async (ok, earned, qId, expl, qText) => {
    if (ok) {
      setScore(s=>s+1); setXp(x=>x+earned);
      const newTotalXp = totalXp + earned;
      const oldLevel = getLevel(totalXp); const newLevel = getLevel(newTotalXp);
      setTotalXp(newTotalXp); LS.set("sr_xp",newTotalXp);
      if (newLevel.name !== oldLevel.name) { setLevelUpPopup(true); SFX.levelUp(); setTimeout(()=>setLevelUpPopup(false),2500); }

      // Random jackpot multiplier
      const roll = Math.random();
      if (roll < 0.05) { // 5% chance
        setMultiplier(3); setJackpotPopup(true); SFX.jackpot();
        setParticles("jackpot"); setTimeout(()=>{ setJackpotPopup(false); setParticles(null); },2000);
        showXP("🎰 JACKPOT! +"+earned*3+" XP");
      } else {
        setMultiplier(1);
        showXP("+"+earned+" XP");
        setParticles("correct"); setTimeout(()=>setParticles(null),1200);
      }

      setStreak(s=>{
        const ns = s+1;
        if (ns>bestStreak) setBestStreak(ns);
        if (ns>0 && ns%3===0){ setStreakPopup(true); SFX.streak(); setTimeout(()=>setStreakPopup(false),1800); }
        return ns;
      });
      SFX.correct();
      setFeedback({ok:true, text:"✅ "+expl});

      // Update DNA
      setDna(d=>{ const nd={...d}; nd[topic]={correct:(nd[topic]?.correct||0)+1,total:(nd[topic]?.total||0)+1}; LS.set("sr_dna",nd); return nd; });
    } else {
      setStreak(0); setMissedQs(p=>[...p,qId]); setWrongTexts(p=>[...p,qText]);
      SFX.wrong(); setShakeQ(true); setTimeout(()=>setShakeQ(false),500);
      setParticles("wrong"); setTimeout(()=>setParticles(null),800);
      setFeedback({ok:false, text:"❌ "+expl});
      setDna(d=>{ const nd={...d}; nd[topic]={correct:(nd[topic]?.correct||0),total:(nd[topic]?.total||0)+1}; LS.set("sr_dna",nd); return nd; });
    }

    // Persona reaction
    if (persona) {
      try {
        const msg = await personaReact(persona, ok, streak+(ok?1:0), qText);
        setPersonaMsg(msg);
      } catch {}
    }
  };

  const showXP = txt => { setXpPopup(txt); setTimeout(()=>setXpPopup(null),900); };

  const handleMC = async (opt, idx) => {
    if (answered) return; SFX.select();
    clearInterval(timerRef.current); setTimerActive(false);
    setSelected(idx); setAnswered(true);
    const q = questions[qIdx];
    const ok = opt.startsWith(q.answer);
    const earned = calcXP(ok, timeLeft);
    await processResult(ok, earned, q.id, q.explanation, q.question);
  };

  const handleTF = async val => {
    if (answered) return; SFX.select();
    clearInterval(timerRef.current); setTimerActive(false);
    setSelected(val); setAnswered(true);
    const q = questions[qIdx];
    const ok = val===q.answer;
    const earned = calcXP(ok, timeLeft);
    await processResult(ok, earned, q.id, q.explanation, q.question);
  };

  const handleShort = async () => {
    if (!shortVal.trim()||answered) return; SFX.select();
    clearInterval(timerRef.current); setTimerActive(false);
    setChecking(true);
    const q = questions[qIdx];
    try {
      const res = await checkShort(q.question, q.answer, shortVal);
      setChecking(false); setAnswered(true);
      const earned = calcXP(res.correct, timeLeft);
      await processResult(res.correct, earned, q.id, res.feedback, q.question);
    } catch { setChecking(false); setAnswered(true); await processResult(false,0,questions[qIdx]?.id,"Could not verify.",questions[qIdx]?.question); }
  };

  const nextQ = () => {
    const next = qIdx+1;
    if (next >= questions.length) { finishQuiz(); return; }
    setQIdx(next); setAnswered(false); setSelected(null);
    setFeedback(null); setShortVal(""); setShowHint(false);
    setPersonaMsg(null); setTimeLeft(100); setTimerActive(true);
  };

  const finishQuiz = () => {
    clearInterval(timerRef.current);
    // Save history
    const entry = {topic,score,total:questions.length,xp,diff,ts:Date.now(),streak:bestStreak};
    const newHistory = [entry,...history].slice(0,50);
    setHistory(newHistory); LS.set("sr_history",newHistory);
    // Day streak
    const today = new Date().toDateString();
    if (LS.get("sr_lastday","")!==today){ const ns=dayStreak+1; setDayStreak(ns); LS.set("sr_streak",ns); LS.set("sr_lastday",today); }
    setScreen("results");
  };

  // ── Boss battle ──
  const startBoss = async () => {
    SFX.boss(); setScreen("loading"); setLoadStep(0);
    try {
      const res = await genBoss(topic, wrongTexts);
      setBossQs(res.questions); setBossIdx(0); setBossHp(100);
      setBossScore(0); setBossAnswered(false); setBossSelected(null); setBossFeedback(null);
      setScreen("boss");
    } catch(e) { alert("Boss error: "+e.message); setScreen("results"); }
  };

  const handleBossMC = (opt, idx) => {
    if (bossAnswered) return; SFX.select();
    setBossSelected(idx); setBossAnswered(true);
    const q = bossQs[bossIdx];
    const ok = opt.startsWith(q.answer);
    if (ok) { setBossScore(s=>s+1); setBossHp(h=>Math.max(0,h-34)); SFX.correct(); setBossFeedback({ok:true,text:"⚔️ HIT! "+q.explanation}); setParticles("boss"); setTimeout(()=>setParticles(null),1200); }
    else { SFX.wrong(); setBossFeedback({ok:false,text:"💀 MISS! "+q.explanation}); }
  };

  const nextBossQ = () => {
    const next = bossIdx+1;
    if (next >= bossQs.length) {
      const won = bossScore >= 2;
      if (won) { SFX.jackpot(); setParticles("jackpot"); setTimeout(()=>setParticles(null),2500); const bonus=150; setTotalXp(t=>{const nv=t+bonus;LS.set("sr_xp",nv);return nv;}); setXp(x=>x+bonus); }
      setScreen("results");
      return;
    }
    setBossIdx(next); setBossAnswered(false); setBossSelected(null); setBossFeedback(null);
  };

  // ── Exam predictor ──
  const handlePredict = async () => {
    if (history.length<2) return;
    setPredicting(true);
    try { const p=await predictScore(history); setPrediction(p); } catch(e){ alert("Prediction error: "+e.message); }
    setPredicting(false);
  };

  // ── Daily challenge ──
  const dailyTopic = ["Photosynthesis","World War II","Calculus Derivatives","Shakespeare","The Solar System","Cell Biology","The American Revolution","Python Basics","Economics Supply & Demand","Ancient Rome"][new Date().getDate()%10];
  const mockLB = [{name:"Alex K.",score:980},{name:"Jordan M.",score:950},{name:"Sam R.",score:920},{name:"Taylor B.",score:890},{name:"You",score:xp}].sort((a,b)=>b.score-a.score);

  // ── Render helpers ──
  const lv = getLevel(totalXp);
  const nlv = getNextLevel(totalXp);
  const lvPct = nlv ? Math.round(((totalXp-lv.xp)/(nlv.xp-lv.xp))*100) : 100;
  const q = questions[qIdx];
  const pct = questions.length?Math.round((score/questions.length)*100):0;
  const g = grade(pct);
  const circ = 2*Math.PI*58;

  return (
    <>
      <style>{CSS}</style>
      <div className="sr-app">

        {/* OVERLAYS */}
        {particles && <Particles type={particles} active />}
        {xpPopup && <div className="xp-pop">{xpPopup}</div>}
        {streakPopup && <div className="streak-ov"><div className="streak-box"><span className="streak-em">🔥</span><div className="streak-txt">{streak} IN A ROW!</div></div></div>}
        {jackpotPopup && <div className="jackpot-ov"><div className="jackpot-box"><div style={{fontSize:48,marginBottom:8}}>🎰</div><div className="jackpot-txt">JACKPOT! 3x XP!</div></div></div>}
        {levelUpPopup && <div className="jackpot-ov"><div className="jackpot-box"><div style={{fontSize:48,marginBottom:8}}>⬆️</div><div className="jackpot-txt" style={{color:"var(--c)"}}>LEVEL UP!</div><div style={{color:"var(--mu)",fontFamily:"'Outfit',sans-serif",fontSize:14,marginTop:8}}>{lv.name}</div></div></div>}

        {/* NAV */}
        <nav className="nav">
          <div className="logo" onClick={()=>setScreen("home")}>STUDYRUSH</div>
          <div className="nav-pills">
            <div className="pill y">⚡ {totalXp} XP</div>
            <div className="pill p" style={{color:lv.col,borderColor:lv.col+"44"}}>{lv.name}</div>
            <div className="pill g">🔥 {dayStreak}d</div>
            {persona && <div className="pill c">{persona.emoji} {persona.name}</div>}
          </div>
        </nav>

        {/* ── HOME ── */}
        {screen==="home" && (
          <div className="screen">
            <div className="home-tabs">
              {["study","history","dna","daily","predict"].map(t=>(
                <button key={t} className={`home-tab${homeTab===t?" active":""}`} onClick={()=>setHomeTab(t)}>
                  {t==="study"?"📚 Study":t==="history"?"📊 History":t==="dna"?"🧬 Study DNA":t==="daily"?"🌍 Daily":"🔮 Predictor"}
                </button>
              ))}
            </div>

            {/* STUDY TAB */}
            {homeTab==="study" && (
              <>
                <div style={{marginBottom:32}}>
                  <div className="hero-badge">🎮 AI-Powered Study Game</div>
                  <h1 className="hero" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(52px,9vw,88px)",letterSpacing:4,lineHeight:.9,marginBottom:14}}>
                    STUDY SMARTER.<br/><span style={{color:"var(--y)",textShadow:"0 0 30px rgba(240,224,64,.4)"}}>PLAY HARDER.</span>
                  </h1>
                  <p style={{fontSize:16,color:"var(--mu)",maxWidth:460,lineHeight:1.6,marginBottom:28}}>Drop your notes, pick a tutor, and turn studying into an addictive game.</p>
                  <div className="level-bar-wrap">
                    <div className="level-row"><span className="level-name" style={{color:lv.col}}>{lv.name}</span><span style={{fontSize:11,color:"var(--mu)",fontFamily:"'Space Mono',monospace"}}>{nlv?`${totalXp}/${nlv.xp} XP`:"MAX LEVEL"}</span></div>
                    <div className="level-track"><div className="level-fill" style={{width:`${lvPct}%`,background:lv.col}}/></div>
                  </div>
                </div>

                {/* PERSONA SELECT */}
                <div className="card">
                  <div className="card-title">🎭 Choose Your Tutor</div>
                  <div className="persona-grid">
                    {PERSONAS.map(p=>(
                      <button key={p.id} className={`p-btn${persona?.id===p.id?" on":""}`} onClick={()=>{setPersona(p);SFX.click();}}>
                        <span className="p-em">{p.emoji}</span>
                        <div className="p-nm">{p.name}</div>
                      </button>
                    ))}
                  </div>
                  {persona && <div style={{fontSize:12,color:"var(--mu)",padding:"8px 12px",background:"var(--s2)",borderRadius:10,fontStyle:"italic"}}>{persona.emoji} {persona.name} — {persona.tone.slice(0,80)}…</div>}
                </div>

                {/* INPUT */}
                <div className="card">
                  <div className="card-title">📥 Your Material</div>
                  <div className="tabs">
                    {["text","file","youtube"].map(t=>(
                      <button key={t} className={`tab${inputTab===t?" on":""}`} onClick={()=>setInputTab(t)}>
                        {t==="text"?"📝 Text":t==="file"?"📁 File":"▶️ YouTube"}
                      </button>
                    ))}
                  </div>

                  {inputTab==="text" && <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Paste your notes, textbook chapter, or any study material…"/>}

                  {inputTab==="file" && (
                    <>
                      <div className={`drop${dragOver?" over":""}`}
                        onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                        onDragLeave={()=>setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={()=>document.getElementById("fileInput").click()}>
                        <div className="drop-icon">📂</div>
                        {fileName ? <strong>{fileName}</strong> : <><strong>Drop any file here</strong><p>TXT, PDF text, MD, or click to browse</p></>}
                      </div>
                      <input id="fileInput" type="file" accept=".txt,.md,.csv,.json" style={{display:"none"}} onChange={e=>e.target.files[0]&&readFile(e.target.files[0])}/>
                      {recentFiles.length>0 && <>
                        <div style={{fontSize:11,color:"var(--mu)",margin:"12px 0 6px",fontFamily:"'Space Mono',monospace",textTransform:"uppercase",letterSpacing:".08em"}}>Recent Files</div>
                        <div className="recent-files">
                          {recentFiles.slice(0,4).map((f,i)=>(
                            <div key={i} className="recent-file" onClick={()=>{setFileText(f.text);setFileName(f.name);SFX.click();}}>
                              <span>📄 {f.name}</span>
                              <span style={{fontSize:10,color:"var(--mu)",fontFamily:"'Space Mono',monospace"}}>{new Date(f.ts).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      </>}
                    </>
                  )}

                  {inputTab==="youtube" && <>
                    <input className="inp" value={youtubeUrl} onChange={e=>setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."/>
                    <p style={{fontSize:12,color:"var(--mu)",marginTop:8}}>💡 Generates questions about the video's topic</p>
                  </>}

                  <div className="row">
                    <select value={qCount} onChange={e=>setQCount(e.target.value)}>
                      <option value="5">5 Questions</option>
                      <option value="10">10 Questions</option>
                      <option value="15">15 Questions</option>
                      <option value="20">20 Questions</option>
                    </select>
                    <select value={diff} onChange={e=>setDiff(e.target.value)}>
                      <option value="easy">🟢 Easy</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="hard">🔴 Hard</option>
                    </select>
                  </div>
                  <button className="btn btn-y" onClick={handleGenerate}
                    disabled={(inputTab==="text"&&!notes.trim())||(inputTab==="file"&&!fileText.trim())||(inputTab==="youtube"&&!youtubeUrl.trim())}>
                    ⚡ GENERATE MY QUIZ
                  </button>
                </div>
              </>
            )}

            {/* HISTORY TAB */}
            {homeTab==="history" && (
              <div className="card">
                <div className="card-title">📊 Study History</div>
                {history.length===0 ? <p style={{color:"var(--mu)",fontSize:14}}>No sessions yet — play your first quiz!</p> :
                <div className="history-list">
                  {history.slice(0,20).map((h,i)=>{
                    const p=Math.round((h.score/h.total)*100);
                    const g=grade(p);
                    return <div key={i} className="hist-item">
                      <div><div className="hist-topic">{h.topic}</div><div className="hist-meta">{new Date(h.ts).toLocaleDateString()} · {h.diff} · streak {h.streak}</div></div>
                      <div><div className="hist-score" style={{color:p>=80?"var(--g)":p>=60?"var(--y)":"var(--r)"}}>{g.l}</div><div style={{fontSize:10,color:"var(--mu)",fontFamily:"'Space Mono',monospace",textAlign:"right"}}>{h.score}/{h.total}</div></div>
                    </div>;
                  })}
                </div>}
              </div>
            )}

            {/* DNA TAB */}
            {homeTab==="dna" && (
              <div className="card">
                <div className="card-title">🧬 Study DNA</div>
                <p style={{fontSize:13,color:"var(--mu)",marginBottom:16}}>Your personal learning profile — built from every quiz you take.</p>
                {Object.keys(dna).length===0 ? <p style={{color:"var(--mu)",fontSize:14}}>Play some quizzes to build your DNA!</p> :
                Object.entries(dna).map(([t,d])=>{
                  const p=Math.round((d.correct/d.total)*100);
                  const col=p>=80?"var(--g)":p>=60?"var(--y)":"var(--r)";
                  return <div key={t} className="dna-bar-wrap">
                    <span className="dna-label" title={t}>{t}</span>
                    <div className="dna-track"><div className="dna-fill" style={{width:`${p}%`,background:col}}/></div>
                    <span className="dna-pct">{p}%</span>
                  </div>;
                })}
              </div>
            )}

            {/* DAILY TAB */}
            {homeTab==="daily" && (
              <>
                <div className="daily-card">
                  <div className="daily-title">🌍 DAILY CHALLENGE</div>
                  <div className="daily-timer">Today's topic: <strong style={{color:"var(--c)"}}>{dailyTopic}</strong></div>
                  <p style={{fontSize:13,color:"var(--mu)",marginBottom:20}}>A new topic every day. Compete globally. Streaks matter.</p>
                  <button className="btn btn-y" onClick={()=>{setNotes(`Generate questions about: ${dailyTopic}`);setInputTab("text");setHomeTab("study");setTimeout(handleGenerate,100);}}>
                    ⚡ PLAY TODAY'S CHALLENGE
                  </button>
                </div>
                <div className="card">
                  <div className="card-title">🏆 Leaderboard</div>
                  <div className="leaderboard">
                    {mockLB.map((p,i)=>(
                      <div key={i} className="lb-row">
                        <div className="lb-rank" style={{color:i===0?"var(--y)":i===1?"#c0c0c0":i===2?"#cd7f32":"var(--mu)"}}>{i+1}</div>
                        <div className="lb-name" style={{color:p.name==="You"?"var(--y)":""}}>{p.name}</div>
                        <div className="lb-score">{p.score} XP</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* PREDICTOR TAB */}
            {homeTab==="predict" && (
              <div className="card">
                <div className="card-title">🔮 Exam Score Predictor</div>
                <p style={{fontSize:13,color:"var(--mu)",marginBottom:16}}>Based on your {history.length} study sessions, we'll predict your exam performance and tell you exactly what to fix.</p>
                {history.length<2 ? <p style={{color:"var(--r)",fontSize:13}}>Need at least 2 study sessions to predict. Go play some quizzes!</p> : <>
                  <button className="btn btn-y" onClick={handlePredict} disabled={predicting}>
                    {predicting?"🔮 Analyzing…":"🔮 PREDICT MY EXAM SCORE"}
                  </button>
                  {prediction && (
                    <div className="predict-card" style={{marginTop:16}}>
                      <div className="predict-grade">{prediction.grade}</div>
                      <div style={{fontSize:24,fontFamily:"'Bebas Neue',sans-serif",color:"var(--mu)",marginBottom:12}}>{prediction.pct}% PREDICTED</div>
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:"var(--mu)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontFamily:"'Space Mono',monospace"}}>Strong Topics</div>
                        {prediction.strong?.map(t=><span key={t} className="tag tag-g">{t}</span>)}
                      </div>
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:11,color:"var(--mu)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontFamily:"'Space Mono',monospace"}}>Needs Work</div>
                        {prediction.weak?.map(t=><span key={t} className="tag tag-r">{t}</span>)}
                      </div>
                      <div style={{background:"var(--s2)",borderRadius:12,padding:"12px 16px",fontSize:13,lineHeight:1.6,color:"var(--tx)",borderLeft:"3px solid var(--p)"}}>
                        💡 {prediction.tip}
                      </div>
                    </div>
                  )}
                </>}
              </div>
            )}
          </div>
        )}

        {/* ── LOADING ── */}
        {screen==="loading" && (
          <div className="screen loading">
            <div className="loading-orb"/>
            <div className="loading-steps">
              {["Analyzing material…","Crafting questions…","Calibrating difficulty…","Preparing game…"].map((s,i)=>(
                <div key={i} className={`l-step${i<loadStep?" done":i===loadStep?" cur":""}`}>
                  {i<loadStep?"✓":i===loadStep?"→":"·"} {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GAME ── */}
        {screen==="game" && q && (
          <div className="screen">
            {/* Progress */}
            <div className="prog-row">
              <div className="prog-track"><div className="prog-fill" style={{width:`${(qIdx/questions.length)*100}%`}}/></div>
              <span className="prog-lbl">{qIdx+1}/{questions.length}</span>
            </div>

            {/* HUD */}
            <div className="hud">
              <div className="hud-c"><div className="hud-l">Score</div><div className="hud-v" style={{color:"var(--y)"}}>{score}</div></div>
              <div className="hud-c"><div className="hud-l">XP</div><div className="hud-v" style={{color:"var(--c)"}}>+{xp}</div></div>
              <div className="hud-c"><div className="hud-l">Streak</div><div className="hud-v" style={{color:streak>=3?"var(--y)":"var(--tx)"}}>{streak>0?`🔥${streak}`:streak}</div></div>
              <div className="hud-c"><div className="hud-l">Best</div><div className="hud-v" style={{color:"var(--g)"}}>{bestStreak}</div></div>
            </div>

            {/* Timer */}
            <div className="timer-track">
              <div className={`timer-fill${timeLeft<25?" low":""}`} style={{width:`${timeLeft}%`}}/>
            </div>

            {/* Question */}
            <div className={`q-card${shakeQ?" shake":""}`} key={qIdx}>
              <div className="q-meta">
                <span className="q-num">Q{qIdx+1} · {topic}</span>
                <span className="q-badge" style={
                  q.type==="mc"?{background:"rgba(240,224,64,.1)",color:"var(--y)",border:"1px solid rgba(240,224,64,.2)"}:
                  q.type==="tf"?{background:"rgba(64,224,208,.1)",color:"var(--c)",border:"1px solid rgba(64,224,208,.2)"}:
                  {background:"rgba(255,77,109,.1)",color:"var(--r)",border:"1px solid rgba(255,77,109,.2)"}
                }>{q.type==="mc"?"Multiple Choice":q.type==="tf"?"True / False":"Short Answer"}</span>
              </div>

              <div className="q-text">{q.question}</div>

              {!answered && !showHint && <button className="hint-btn" onClick={()=>{setShowHint(true);SFX.click();}}>💡 Show Hint (-5 XP)</button>}
              {showHint && <div className="hint-text">💡 {q.hint}</div>}

              {/* MC */}
              {q.type==="mc" && (
                <div className="opts">
                  {q.options.map((opt,i)=>{
                    let cls="opt";
                    if (answered){ if(opt.startsWith(q.answer))cls+=" ok"; else if(selected===i)cls+=" bad"; }
                    else if(selected===i)cls+=" sel";
                    return <button key={i} className={cls} onClick={()=>handleMC(opt,i)} disabled={answered}>
                      <span className="opt-ltr">{LETTERS[i]}</span>{opt.replace(/^[A-D]\.\s*/,"")}
                    </button>;
                  })}
                </div>
              )}

              {/* TF */}
              {q.type==="tf" && (
                <div className="tf-row">
                  {["True","False"].map(v=>{
                    let cls="tf-btn";
                    if(answered){ if(v===q.answer)cls+=" ok"; else if(selected===v)cls+=" bad"; }
                    else if(selected===v)cls+=" sel";
                    return <button key={v} className={cls} onClick={()=>handleTF(v)} disabled={answered}>{v==="True"?"✓ TRUE":"✗ FALSE"}</button>;
                  })}
                </div>
              )}

              {/* Short */}
              {q.type==="short" && (
                <div className="short-wrap">
                  <input className="short-inp" value={shortVal} onChange={e=>setShortVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleShort()} placeholder="Type your answer…" disabled={answered||checking}/>
                  <button className="btn-submit" onClick={handleShort} disabled={!shortVal.trim()||answered||checking}>{checking?"Checking…":"Submit →"}</button>
                </div>
              )}

              {feedback && <div className={`fb${feedback.ok?" ok":" bad"}`}>{feedback.text}</div>}
              {personaMsg && persona && (
                <div className="p-bubble">
                  <div className="p-av">{persona.emoji}</div>
                  <div className="p-txt">"{personaMsg}"<br/><span style={{fontSize:11,color:"var(--mu)",fontStyle:"normal",marginTop:4,display:"block"}}>— {persona.name}</span></div>
                </div>
              )}
            </div>

            {answered && <button className="btn-next" onClick={nextQ}>{qIdx+1>=questions.length?"See Results →":"Next Question →"}</button>}
          </div>
        )}

        {/* ── BOSS BATTLE ── */}
        {screen==="boss" && bossQs[bossIdx] && (
          <div className="screen">
            <div className="boss-screen">
              <span className="boss-emoji">👹</span>
              <div className="boss-title">BOSS BATTLE</div>
              <div style={{fontSize:14,color:"var(--mu)",marginTop:6}}>Defeat the boss to earn 150 bonus XP!</div>
              <div className="boss-hp">
                <div className="boss-hp-fill" style={{width:`${bossHp}%`}}/>
              </div>
              <div style={{fontSize:11,color:"var(--mu)",fontFamily:"'Space Mono',monospace"}}>BOSS HP: {bossHp}%</div>
            </div>

            <div className={`q-card${shakeQ?" shake":""}`}>
              <div className="q-meta">
                <span className="q-num">BOSS Q{bossIdx+1}/3</span>
                <span className="q-badge" style={{background:"rgba(255,77,109,.1)",color:"var(--r)",border:"1px solid rgba(255,77,109,.2)"}}>HARD</span>
              </div>
              <div className="q-text">{bossQs[bossIdx].question}</div>
              <div className="opts">
                {bossQs[bossIdx].options.map((opt,i)=>{
                  let cls="opt";
                  if(bossAnswered){ if(opt.startsWith(bossQs[bossIdx].answer))cls+=" ok"; else if(bossSelected===i)cls+=" bad"; }
                  else if(bossSelected===i)cls+=" sel";
                  return <button key={i} className={cls} onClick={()=>handleBossMC(opt,i)} disabled={bossAnswered}>
                    <span className="opt-ltr">{LETTERS[i]}</span>{opt.replace(/^[A-D]\.\s*/,"")}
                  </button>;
                })}
              </div>
              {bossFeedback && <div className={`fb${bossFeedback.ok?" ok":" bad"}`}>{bossFeedback.text}</div>}
            </div>

            {bossAnswered && <button className="btn-next" onClick={nextBossQ}>{bossIdx+1>=bossQs.length?"Finish Battle →":"Next Attack →"}</button>}
          </div>
        )}

        {/* ── RESULTS ── */}
        {screen==="results" && (
          <div className="screen results">
            <div className="grade">{g.l}</div>
            <div className="res-title">{g.m}</div>
            <div className="res-sub">{topic} · {questions.length} questions · {diff}</div>

            {/* Ring */}
            <div className="ring-wrap">
              <svg width="148" height="148" viewBox="0 0 148 148">
                <circle cx="74" cy="74" r="58" fill="none" stroke="var(--s2)" strokeWidth="14"/>
                <circle cx="74" cy="74" r="58" fill="none" stroke="var(--y)" strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ-(pct/100)*circ}
                  transform="rotate(-90 74 74)" style={{transition:"stroke-dashoffset 1.2s ease"}}/>
              </svg>
              <div className="ring-label">
                <div className="ring-pct">{pct}%</div>
                <div className="ring-sub">{score}/{questions.length}</div>
              </div>
            </div>

            <div className="res-grid">
              <div className="res-stat"><div className="res-val" style={{color:"var(--y)"}}>+{xp}</div><div className="res-lbl">XP Earned</div></div>
              <div className="res-stat"><div className="res-val" style={{color:"var(--g)"}}>{bestStreak}</div><div className="res-lbl">Best Streak</div></div>
              <div className="res-stat"><div className="res-val" style={{color:"var(--c)"}}>{dayStreak}</div><div className="res-lbl">Day Streak 🔥</div></div>
            </div>

            {missedQs.length>0 && (
              <div style={{background:"rgba(255,77,109,.07)",border:"1px solid rgba(255,77,109,.2)",borderRadius:var(--rad)||12,padding:"12px 16px",fontSize:13,color:"#ff9090",marginBottom:16,borderRadius:12}}>
                📌 {missedQs.length} missed — play again to review them!
              </div>
            )}

            {/* Boss battle unlock */}
            {pct>=60 && (
              <>
                <div style={{textAlign:"center",fontSize:13,color:"var(--mu)",margin:"8px 0"}}>⚔️ You unlocked the Boss Battle! Earn 150 bonus XP</div>
                <button className="btn-boss" onClick={startBoss}>👹 ENTER BOSS BATTLE</button>
              </>
            )}

            {/* Share */}
            <div className="share-card" style={{marginTop:20}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,marginBottom:12,color:"var(--y)"}}>📤 Share Your Score</div>
              <div className="share-txt">{shareText(score,questions.length,xp,topic,persona)}</div>
              <div className="share-btns">
                <button className="share-btn" onClick={()=>{navigator.clipboard.writeText(shareText(score,questions.length,xp,topic,persona));SFX.click();}}>📋 Copy</button>
                <button className="share-btn" onClick={()=>window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(score,questions.length,xp,topic,persona))}`)}>🐦 Tweet</button>
              </div>
            </div>

            <button className="btn btn-y" style={{marginTop:8}} onClick={()=>setScreen("home")}>⚡ Play Again</button>
          </div>
        )}
      </div>
    </>
  );
}
