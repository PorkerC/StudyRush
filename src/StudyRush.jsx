import { useState, useEffect, useRef, useCallback } from "react";
import { Engine, HomeBG, StudyBG, ArcadeBG } from "./GameEngine.js";
import { LightningTap, AimTrainer, AnswerBlitz, RhythmReview, SpeedRun, ResultScene } from "./GameScenes.js";

// ── API ───────────────────────────────────────────────────────────────────────
const MODEL = "claude-haiku-4-5-20251001";
const HDRS = () => ({ "Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true" });
const safeJSON = raw => { const c=raw.replace(/```json|```/g,"").trim();try{return JSON.parse(c);}catch{}const s=c.indexOf("{"),e=c.lastIndexOf("}");if(s!==-1&&e!==-1)try{return JSON.parse(c.slice(s,e+1));}catch{}throw new Error("JSON parse failed"); };
const callAPI = async (prompt,max=1600) => { const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:HDRS(),body:JSON.stringify({model:MODEL,max_tokens:max,messages:[{role:"user",content:prompt}]})});if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}const d=await r.json();return d.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim(); };
const genQs = async (text,count,diff) => safeJSON(await callAPI(`Generate exactly ${count} ${diff} quiz questions from this material. Mix: mc(4 opts), tf, short. ONLY valid JSON:\n{"topic":"name","questions":[{"id":1,"type":"mc","question":"?","options":["A text","B text","C text","D text"],"answer":"A","explanation":"brief","hint":"one word"},{"id":2,"type":"tf","question":"?","answer":"True","explanation":"brief","hint":"clue"},{"id":3,"type":"short","question":"?","answer":"answer","explanation":"brief","hint":"clue"}]}\nMaterial:"""${text.slice(0,4000)}"""`,2000));
const genExam = async (text,count,dur) => safeJSON(await callAPI(`Create a formal ${dur}-minute exam, ${count} questions from this material. ONLY valid JSON:\n{"title":"Exam Title","topic":"topic","duration":${dur},"totalPoints":100,"sections":[{"name":"Part I: Multiple Choice","points":40,"questions":[{"id":1,"type":"mc","question":"?","options":["A opt","B opt","C opt","D opt"],"answer":"A","points":5}]},{"name":"Part II: True/False","points":20,"questions":[{"id":10,"type":"tf","question":"?","answer":"True","points":2}]},{"name":"Part III: Short Answer","points":40,"questions":[{"id":20,"type":"short","question":"?","answer":"answer","points":10}]}]}\nMaterial:"""${text.slice(0,4000)}"""`,2000));
const genGuide = async text => callAPI(`Create a comprehensive, beautifully structured study guide from this material. Use markdown headers (##), **bold key terms**, bullet lists. Include: Overview, Key Concepts, Detailed Notes, Key Terms, Summary, Practice Questions.\nMaterial:"""${text.slice(0,4000)}"""`,2000);
const genCards = async (text,count) => safeJSON(await callAPI(`Generate exactly ${count} flashcards. ONLY valid JSON:\n{"topic":"name","cards":[{"id":1,"front":"Term","back":"Definition","category":"cat"}]}\nMaterial:"""${text.slice(0,3000)}"""`,1500));
const checkShort = async (q,correct,user) => safeJSON(await callAPI(`Q:"${q}" Correct:"${correct}" Student:"${user}" Equivalent? ONLY JSON:{"correct":true,"feedback":"one sentence"}`,300));

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const LEVELS = [{name:"Rookie",xp:0,col:"#94a3b8"},{name:"Scholar",xp:200,col:"#34d399"},{name:"Expert",xp:500,col:"#60a5fa"},{name:"Master",xp:1000,col:"#fbbf24"},{name:"Legend",xp:2000,col:"#f87171"},{name:"Mythic",xp:5000,col:"#c084fc"},{name:"GOD MODE",xp:10000,col:"#ffffff"}];
const getLv = xp => [...LEVELS].reverse().find(l=>xp>=l.xp)||LEVELS[0];
const getNextLv = xp => LEVELS.find(l=>l.xp>xp);
const LETS = ["A","B","C","D"];
const gradeOf = p => p>=97?{l:"S+",col:"#fbbf24"}:p>=90?{l:"A+",col:"#34d399"}:p>=80?{l:"A",col:"#60a5fa"}:p>=70?{l:"B",col:"#c084fc"}:p>=60?{l:"C",col:"#fb923c"}:{l:"D",col:"#f87171"};
const LS = { get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}}, set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}} };

const GAMES = [
  {id:"lightning",name:"Lightning Tap", icon:"⚡",col:"#fbbf24",desc:"Tap the right answer before it vanishes!", Scene:LightningTap},
  {id:"aim",      name:"Aim Trainer",   icon:"🎯",col:"#fb923c",desc:"Click the correct moving target!",       Scene:AimTrainer},
  {id:"blitz",    name:"Answer Blitz",  icon:"💥",col:"#f87171",desc:"Tap correct answers popping up!",        Scene:AnswerBlitz},
  {id:"rhythm",   name:"Rhythm Review", icon:"🎵",col:"#34d399",desc:"Tap answers falling on the beat!",       Scene:RhythmReview},
  {id:"speedrun", name:"Speed Run",     icon:"🏎️",col:"#60a5fa",desc:"Answer correctly to accelerate!",        Scene:SpeedRun},
];

// ── ANIMATED BACKGROUND CANVAS ────────────────────────────────────────────────
function BGCanvas({ type }) {
  const ref = useRef(null);
  const bgRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.scale(dpr, dpr);
      if (bgRef.current) {
        bgRef.current.width = w;
        bgRef.current.height = h;
      }
    };

    bgRef.current = type === "home" ? new HomeBG() : type === "study" ? new StudyBG() : new ArcadeBG();
    bgRef.current.width = canvas.offsetWidth;
    bgRef.current.height = canvas.offsetHeight;
    resize();

    let last = performance.now();
    const loop = (now) => {
      rafRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      const bg = bgRef.current;
      if (type === "arcade") bg.update(dt, H);
      else bg.update(dt);
      ctx.clearRect(0, 0, W, H);
      bg.draw(ctx, W, H);
    };
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [type]);

  return <canvas ref={ref} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:0, pointerEvents:"none", display:"block" }}/>;
}

// ── ARCADE CANVAS ──────────────────────────────────────────────────────────────
function ArcadeCanvas({ gameConfig, onFinish }) {
  const ref = useRef(null);
  const engRef = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !gameConfig) return;
    const eng = new Engine(canvas);
    engRef.current = eng;
    const { Scene, questions, col, icon, name } = gameConfig;
    const scene = new Scene(questions, (score, stats) => {
      eng.setScene(new ResultScene(score, stats, col, icon, `${name} COMPLETE!`, () => onFinish(score, stats)));
    });
    eng.setScene(scene);
    eng.start();
    const onResize = () => eng.resize();
    window.addEventListener("resize", onResize);
    return () => { eng.stop(); window.removeEventListener("resize", onResize); engRef.current = null; };
  }, [gameConfig]);

  return (
    <canvas ref={ref} style={{ position:"fixed", inset:0, width:"100%", height:"100%", zIndex:100, display:"block", touchAction:"none", userSelect:"none", WebkitTapHighlightColor:"transparent" }}/>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
@keyframes sr_up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes sr_pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:scale(1)}}
@keyframes sr_spin{to{transform:rotate(360deg)}}
@keyframes sr_grd{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes sr_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes sr_feedin{from{opacity:0;transform:scale(.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes sr_xp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-80px) scale(1.3)}}
@keyframes sr_danger{0%,100%{box-shadow:0 0 0 rgba(248,113,113,0)}50%{box-shadow:0 0 28px rgba(248,113,113,.3)}}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;background:#07070f;color:#f0f0ff;font-family:'Sora',sans-serif;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:rgba(255,255,255,.03)}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}
input,textarea,select,button{font-family:'Sora',sans-serif;color:#f0f0ff}
input::placeholder,textarea::placeholder{color:rgba(255,255,255,.3)}
/* NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:600;display:flex;align-items:center;justify-content:space-between;padding:10px 18px;backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav-study{background:rgba(8,13,24,.9)}
.nav-arcade{background:rgba(7,7,15,.92)}
.nav-home{background:rgba(5,5,16,.88)}
.logo{font-weight:900;font-size:18px;cursor:pointer;letter-spacing:-.5px}
.logo-study{background:linear-gradient(90deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-arcade{background:linear-gradient(90deg,#fbbf24,#f87171,#c084fc);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:sr_grd 4s ease infinite}
.logo-home{background:linear-gradient(90deg,#a78bfa,#60a5fa,#34d399);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:sr_grd 5s ease infinite}
.msw{display:flex;gap:3px;background:rgba(255,255,255,.05);border-radius:11px;padding:3px}
.mb{padding:7px 14px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,.4);cursor:pointer;font-size:12px;font-weight:700;transition:all .2s;white-space:nowrap}
.mb.sa{background:rgba(96,165,250,.14);color:#60a5fa;border:1px solid rgba(96,165,250,.22)}
.mb.aa{background:rgba(251,191,36,.12);color:#fbbf24;border:1px solid rgba(251,191,36,.18)}
.nch{display:flex;gap:5px;align-items:center;flex-wrap:wrap}
.chip{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:100px;padding:3px 9px;font-size:10px;font-family:'Space Mono',monospace;white-space:nowrap}
/* PAGE */
.page{position:relative;z-index:10;padding:72px 18px 40px;max-width:860px;margin:0 auto;animation:sr_feedin .3s ease}
/* CARD */
.card{background:rgba(255,255,255,.04);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.08);border-radius:18px;padding:20px;margin-bottom:14px;position:relative;overflow:hidden}
.card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.03) 0%,transparent 60%);pointer-events:none;border-radius:18px}
.ctitle{font-size:11px;font-weight:700;color:rgba(255,255,255,.38);text-transform:uppercase;letter-spacing:.1em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.ctitle::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.1),transparent)}
/* BTNS */
.btn{padding:12px 18px;border-radius:12px;border:none;cursor:pointer;font-weight:700;font-size:14px;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:7px;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.btn-b{background:linear-gradient(135deg,#60a5fa,#818cf8);color:#fff;box-shadow:0 4px 18px rgba(96,165,250,.22)}
.btn-b:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(96,165,250,.38)}
.btn-y{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#07070f;box-shadow:0 4px 18px rgba(251,191,36,.22)}
.btn-y:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(251,191,36,.38)}
.btn-g{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.btn-g:hover:not(:disabled){border-color:rgba(255,255,255,.2);color:#fff}
.btn-f{width:100%;padding:14px;font-size:15px}
.btn:disabled{opacity:.3;cursor:not-allowed;transform:none!important}
/* INPUTS */
.inp{width:100%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;font-size:14px;outline:none;transition:all .2s;line-height:1.5}
.inp:focus{border-color:rgba(96,165,250,.5);box-shadow:0 0 0 3px rgba(96,165,250,.08)}
textarea.inp{min-height:140px;resize:vertical}
select.inp{cursor:pointer;font-size:13px;font-weight:600}
.rw{display:flex;gap:8px;flex-wrap:wrap}.rw>*{flex:1;min-width:110px}
/* TOOL */
.tgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px}
.tbtn{padding:14px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;cursor:pointer;text-align:left;transition:all .2s}
.tbtn:hover{border-color:rgba(96,165,250,.3);background:rgba(96,165,250,.05)}
.tbtn.on{background:rgba(96,165,250,.1);border-color:rgba(96,165,250,.35)}
/* QUIZ */
.qcard{background:rgba(255,255,255,.04);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:22px;margin-bottom:12px;position:relative;overflow:hidden;animation:sr_feedin .25s ease}
.qcard::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#60a5fa,#a78bfa,#34d399);background-size:200%;animation:sr_grd 3s linear infinite}
.qcard.shake{animation:none;border-color:rgba(248,113,113,.4)}
.qcard.fok{border-color:rgba(52,211,153,.5);box-shadow:0 0 24px rgba(52,211,153,.12)}
.qcard.fbad{animation:sr_danger .5s ease}
.hud{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}
.hc{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:9px 6px;text-align:center}
.hl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.3);font-family:'Space Mono',monospace;margin-bottom:2px}
.hv{font-size:22px;font-weight:900;line-height:1}
.tbar{height:6px;background:rgba(255,255,255,.07);border-radius:100px;margin-bottom:16px;overflow:hidden}
.tf{height:100%;border-radius:100px;transition:width .1s linear}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.opt{padding:12px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#f0f0ff;cursor:pointer;font-size:13px;font-weight:600;text-align:left;transition:all .18s;display:flex;align-items:center;gap:8px;line-height:1.35;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.opt:hover:not(:disabled){border-color:rgba(96,165,250,.4);background:rgba(96,165,250,.06);transform:translateY(-1px)}
.opt.sel{border-color:rgba(96,165,250,.5);background:rgba(96,165,250,.1)}
.opt.ok{border-color:rgba(52,211,153,.6)!important;background:rgba(52,211,153,.1)!important;color:#34d399!important}
.opt.bad{border-color:rgba(248,113,113,.5)!important;background:rgba(248,113,113,.07)!important;color:#f87171!important}
.opt:disabled{cursor:default}
.ol{width:26px;height:26px;border-radius:7px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;flex-shrink:0}
.tfr{display:flex;gap:8px}
.tfb{flex:1;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);cursor:pointer;font-size:18px;font-weight:800;transition:all .18s;user-select:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.tfb:hover:not(:disabled){border-color:rgba(96,165,250,.4)}
.tfb.sel{border-color:rgba(96,165,250,.5);background:rgba(96,165,250,.08)}
.tfb.ok{border-color:rgba(52,211,153,.6)!important;color:#34d399!important}
.tfb.bad{border-color:rgba(248,113,113,.5)!important;color:#f87171!important}
.fb{padding:11px 14px;border-radius:11px;margin-top:10px;font-size:13px;font-weight:600;line-height:1.5;animation:sr_up .2s ease}
.fb.ok{background:rgba(52,211,153,.07);border:1px solid rgba(52,211,153,.22);color:#6ee7b7;border-left:3px solid #34d399}
.fb.bad{background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.18);color:#fca5a5;border-left:3px solid #f87171}
/* PROGRESS */
.pr{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.pt{flex:1;height:5px;background:rgba(255,255,255,.07);border-radius:100px;overflow:hidden}
.pf{height:100%;background:linear-gradient(90deg,#60a5fa,#a78bfa);border-radius:100px;transition:width .5s ease}
/* FLASHCARD */
.fcw{perspective:1000px;cursor:pointer;height:190px;margin-bottom:12px}
.fci{width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform .5s ease}
.fcw.fl .fci{transform:rotateY(180deg)}
.fcf{position:absolute;inset:0;backface-visibility:hidden;border-radius:16px;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;font-weight:700;font-size:16px;line-height:1.5}
.fcfront{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.fcback{background:rgba(96,165,250,.08);border:1px solid rgba(96,165,250,.25);color:#60a5fa;transform:rotateY(180deg)}
/* GUIDE */
.guide{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px;font-size:14px;line-height:1.8;color:rgba(255,255,255,.8);white-space:pre-wrap;max-height:520px;overflow-y:auto}
/* EXAM */
.esec{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;margin-bottom:10px}
.estit{font-size:11px;font-weight:700;color:rgba(255,255,255,.38);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;font-family:'Space Mono',monospace}
.eq{margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.05)}
.eq:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none}
.einp{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 12px;font-size:13px;outline:none;transition:border-color .2s}
.einp:focus{border-color:rgba(96,165,250,.4)}
/* ARCADE CARD */
.agc{border-radius:18px;padding:18px;transition:all .25s;position:relative;overflow:hidden}
.agc:hover{transform:translateY(-4px)}
/* DNA */
.dnar{display:flex;align-items:center;gap:10px;margin:5px 0}
.dnal{font-size:12px;font-weight:600;width:90px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dnat{flex:1;height:7px;background:rgba(255,255,255,.07);border-radius:100px;overflow:hidden}
.dnaf{height:100%;border-radius:100px;transition:width 1.2s ease}
.dnap{font-family:'Space Mono',monospace;font-size:10px;color:rgba(255,255,255,.35);width:30px;text-align:right;flex-shrink:0}
/* LOADING */
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:20px;position:relative;z-index:10}
.lring{width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,255,255,.08);border-top-color:#60a5fa;animation:sr_spin 1s linear infinite}
/* OVERLAY */
.ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9500;background:rgba(7,7,15,.7);backdrop-filter:blur(6px)}
.ovb{background:rgba(10,10,20,.97);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:36px 52px;text-align:center;animation:sr_pop .4s cubic-bezier(.34,1.56,.64,1)}
/* XP */
.xp-pop{position:fixed;top:72px;right:18px;z-index:9000;font-size:24px;font-weight:900;color:#fbbf24;text-shadow:0 0 16px rgba(251,191,36,.6);pointer-events:none;animation:sr_xp .9s ease-out forwards;white-space:nowrap}
/* RING */
.rw2{position:relative;display:inline-block}
.rl{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* HOME */
.home-hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 24px;text-align:center;position:relative;z-index:10}
/* RESPONSIVE */
@media(max-width:600px){.hud{grid-template-columns:repeat(2,1fr)}.opts{grid-template-columns:1fr}.tgrid{grid-template-columns:1fr 1fr}.nav{padding:8px 12px}.page{padding:65px 14px 32px}.ovb{padding:28px 24px}}
`;

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function StudyRush() {
  // Persistent
  const [totalXp,setTotalXp]   = useState(()=>LS.get("sr_xp",0));
  const [dayStreak,setDayStreak] = useState(()=>LS.get("sr_streak",0));
  const [history,setHistory]   = useState(()=>LS.get("sr_hist",[]));
  const [library,setLibrary]   = useState(()=>LS.get("sr_lib",[]));
  const [dna,setDna]           = useState(()=>LS.get("sr_dna",{}));
  const [arcBests,setArcBests] = useState(()=>LS.get("sr_arc",{}));

  // App state
  const [appMode,setAppMode]   = useState("home");
  const [studySc,setStudySc]   = useState("home");
  const [toolMode,setToolMode] = useState("quiz");
  const [arcSc,setArcSc]       = useState("home");
  const [activeGame,setActiveGame] = useState(null);
  const [loading,setLoading]   = useState(false);
  const [loadMsg,setLoadMsg]   = useState("");

  // Input
  const [inputTab,setInputTab] = useState("text");
  const [notes,setNotes]       = useState("");
  const [fileText,setFileText] = useState("");
  const [fileName,setFileName] = useState("");
  const [qCount,setQCount]     = useState("10");
  const [diff,setDiff]         = useState("medium");
  const [dragOver,setDragOver] = useState(false);

  // Quiz
  const [questions,setQs]      = useState([]);
  const [topic,setTopic]       = useState("");
  const [qIdx,setQIdx]         = useState(0);
  const [answered,setAnswered] = useState(false);
  const [selected,setSelected] = useState(null);
  const [shortVal,setShortVal] = useState("");
  const [feedback,setFb]       = useState(null);
  const [checking,setChecking] = useState(false);
  const [showHint,setShowHint] = useState(false);
  const [flashQ,setFlashQ]     = useState(null);
  const [listening,setListen]  = useState(false);
  const [score,setScore]       = useState(0);
  const [xp,setXp]             = useState(0);
  const [streak,setStreak]     = useState(0);
  const [bestSt,setBestSt]     = useState(0);
  const [missed,setMissed]     = useState([]);
  const [timeLeft,setTimeLeft] = useState(100);
  const [timerOn,setTimerOn]   = useState(false);
  const timerRef               = useRef(null);

  // Exam
  const [examData,setExamData]     = useState(null);
  const [examAns,setExamAns]       = useState({});
  const [examTime,setExamTime]     = useState(0);
  const [examDone,setExamDone]     = useState(false);
  const [examScore,setExamScore]   = useState(null);

  // Guide & cards
  const [guide,setGuide]           = useState("");
  const [cards,setCards]           = useState([]);
  const [cardIdx,setCardIdx]       = useState(0);
  const [cardFlip,setCardFlip]     = useState(false);

  // Effects
  const [xpPop,setXpPop]           = useState(null);
  const [overlay,setOverlay]       = useState(null);

  const TIME = 30;

  useEffect(()=>{
    if(!timerOn)return;
    timerRef.current=setInterval(()=>{setTimeLeft(t=>{const n=t-(100/(TIME*10));if(n<=0){clearInterval(timerRef.current);handleTO();return 0;}return Math.max(0,n);});},100);
    return()=>clearInterval(timerRef.current);
  },[timerOn]);

  useEffect(()=>{
    if(studySc!=="examTake"||examDone)return;
    const t=setInterval(()=>setExamTime(t=>{if(t<=1){setExamDone(true);scoreExam();return 0;}return t-1;}),1000);
    return()=>clearInterval(t);
  },[studySc,examDone]);

  const handleTO=useCallback(()=>{
    if(answered)return;const q=questions[qIdx];
    setAnswered(true);setTimerOn(false);setStreak(0);
    setFb({ok:false,text:"⏰ Time's up! "+q?.explanation});
    setFlashQ("fbad");setTimeout(()=>setFlashQ(null),600);setMissed(p=>[...p,q?.id]);
  },[answered,questions,qIdx]);

  const showXP=txt=>{setXpPop(txt);setTimeout(()=>setXpPop(null),1000);};

  const readFile=useCallback(f=>{const r=new FileReader();r.onload=e=>{setFileText(e.target.result);setFileName(f.name);};r.readAsText(f);},[]);

  const getContent=()=>inputTab==="text"?notes:fileText;
  const hasContent=()=>(inputTab==="text"&&notes.trim())||(inputTab==="file"&&fileText.trim());

  const startQuiz=async()=>{
    const c=getContent();if(!c.trim())return;
    setLoading(true);setLoadMsg("Generating your quiz…");
    setScore(0);setXp(0);setStreak(0);setBestSt(0);setMissed([]);setQIdx(0);setAnswered(false);setFb(null);setSelected(null);
    try{
      const res=await genQs(c,parseInt(qCount),diff);
      setQs(res.questions);setTopic(res.topic||"Your Notes");
      const entry={id:Date.now(),topic:res.topic||"Your Notes",notes:c.slice(0,800),questions:res.questions,ts:Date.now()};
      const newLib=[entry,...library.filter(l=>l.topic!==entry.topic)].slice(0,20);
      setLibrary(newLib);LS.set("sr_lib",newLib);
      setLoading(false);setTimeLeft(100);setTimerOn(true);setStudySc("quiz");
    }catch(e){setLoading(false);alert("Error: "+e.message);}
  };

  const startExam=async()=>{
    const c=getContent();if(!c.trim())return;
    setLoading(true);setLoadMsg("Creating your exam…");
    try{const res=await genExam(c,parseInt(qCount),45);setExamData(res);setExamAns({});setExamTime(res.duration*60);setExamDone(false);setExamScore(null);setLoading(false);setStudySc("examTake");}
    catch(e){setLoading(false);alert("Error: "+e.message);}
  };

  const startGuide=async()=>{
    const c=getContent();if(!c.trim())return;
    setLoading(true);setLoadMsg("Creating your study guide…");
    try{const res=await genGuide(c);setGuide(res);setLoading(false);setStudySc("guide");}
    catch(e){setLoading(false);alert("Error: "+e.message);}
  };

  const startCards=async()=>{
    const c=getContent();if(!c.trim())return;
    setLoading(true);setLoadMsg("Creating flashcards…");
    try{const res=await genCards(c,Math.min(parseInt(qCount),20));setCards(res.cards||[]);setCardIdx(0);setCardFlip(false);setLoading(false);setStudySc("flashcards");}
    catch(e){setLoading(false);alert("Error: "+e.message);}
  };

  const calcXP=(ok,tl)=>{if(!ok)return 0;const base=diff==="easy"?8:diff==="hard"?22:14;const tb=Math.floor((tl/100)*8);const sm=streak>=5?3:streak>=3?2:1;return Math.round((base+tb)*sm);};

  const procResult=async(ok,earned,qId,expl)=>{
    if(ok){
      setScore(s=>s+1);setXp(x=>x+earned);
      const nt=totalXp+earned;const olv=getLv(totalXp);const nlv=getLv(nt);
      setTotalXp(nt);LS.set("sr_xp",nt);
      if(nlv.name!==olv.name){setOverlay({type:"lv",lv:nlv});setTimeout(()=>setOverlay(null),2500);}
      showXP(`+${earned} XP`);setFlashQ("fok");setTimeout(()=>setFlashQ(null),500);
      setStreak(s=>{const ns=s+1;if(ns>bestSt)setBestSt(ns);return ns;});setFb({ok:true,text:"✅ "+expl});
    }else{
      setStreak(0);setMissed(p=>[...p,qId]);setFlashQ("fbad");setTimeout(()=>setFlashQ(null),500);setFb({ok:false,text:"❌ "+expl});
    }
    setDna(d=>{const nd={...d};nd[topic]={correct:(nd[topic]?.correct||0)+(ok?1:0),total:(nd[topic]?.total||0)+1};LS.set("sr_dna",nd);return nd;});
  };

  const handleMC=async(opt,idx)=>{if(answered)return;clearInterval(timerRef.current);setTimerOn(false);setSelected(idx);setAnswered(true);const q=questions[qIdx];const ok=opt.startsWith(q.answer);await procResult(ok,calcXP(ok,timeLeft),q.id,q.explanation);};
  const handleTF=async val=>{if(answered)return;clearInterval(timerRef.current);setTimerOn(false);setSelected(val);setAnswered(true);const q=questions[qIdx];const ok=val===q.answer;await procResult(ok,calcXP(ok,timeLeft),q.id,q.explanation);};
  const handleShort=async()=>{if(!shortVal.trim()||answered)return;clearInterval(timerRef.current);setTimerOn(false);setChecking(true);const q=questions[qIdx];try{const res=await checkShort(q.question,q.answer,shortVal);setChecking(false);setAnswered(true);await procResult(res.correct,calcXP(res.correct,timeLeft),q.id,res.feedback);}catch{setChecking(false);setAnswered(true);await procResult(false,0,questions[qIdx]?.id,"Could not verify.");}};
  const handleVoice=()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return alert("Voice needs Chrome!");const r=new SR();r.continuous=false;r.lang="en-US";r.onstart=()=>setListen(true);r.onresult=e=>{setListen(false);setShortVal(e.results[0][0].transcript);};r.onerror=r.onend=()=>setListen(false);r.start();};

  const nextQ=()=>{clearInterval(timerRef.current);const next=qIdx+1;if(next>=questions.length){finishQuiz();return;}setQIdx(next);setAnswered(false);setSelected(null);setFb(null);setShortVal("");setShowHint(false);setTimeLeft(100);setTimerOn(true);};

  const finishQuiz=()=>{clearInterval(timerRef.current);const entry={topic,score,total:questions.length,xp,diff,ts:Date.now(),streak:bestSt};const newH=[entry,...history].slice(0,50);setHistory(newH);LS.set("sr_hist",newH);const today=new Date().toDateString();if(LS.get("sr_lastday","")!==today){const ns=dayStreak+1;setDayStreak(ns);LS.set("sr_streak",ns);LS.set("sr_lastday",today);}setStudySc("results");};

  const scoreExam=()=>{if(!examData)return;let pts=0,max=0;examData.sections?.forEach(s=>s.questions?.forEach(q=>{max+=q.points||0;const a=examAns[q.id]||"";if(q.type==="mc"&&a===q.answer)pts+=q.points||0;if(q.type==="tf"&&a===q.answer)pts+=q.points||0;if(q.type==="short"&&a.toLowerCase().trim()===q.answer?.toLowerCase().trim())pts+=q.points||0;}));setExamScore({pts,max,pct:Math.round((pts/(max||1))*100),grade:gradeOf(Math.round((pts/(max||1))*100))});setExamDone(true);};

  const launchGame=(game,qs)=>{const mcQs=qs?.filter(q=>q.type==="mc");if(!mcQs?.length){alert("Complete a study session first to unlock games!");return;}setActiveGame({...game,questions:mcQs.slice(0,15)});setArcSc("game");};
  const handleGameFinish=(score,stats)=>{const best=Math.max(arcBests[activeGame?.id]||0,score);const nb={...arcBests,[activeGame?.id]:best};setArcBests(nb);LS.set("sr_arc",nb);const bonus=Math.round(score/10);setTotalXp(t=>{const nv=t+bonus;LS.set("sr_xp",nv);return nv;});setArcSc("result");};

  const lv=getLv(totalXp),nlv=getNextLv(totalXp),lvPct=nlv?Math.round(((totalXp-lv.xp)/(nlv.xp-lv.xp))*100):100;
  const q=questions[qIdx],pct=questions.length?Math.round((score/questions.length)*100):0,gr=gradeOf(pct);
  const rf=LS.get("sr_files",[]);
  const isStudy=appMode==="study";const isArc=appMode==="arcade";

  const MatInput=()=>(
    <>
      <div style={{display:"flex",gap:5,marginBottom:12,background:"rgba(255,255,255,.04)",borderRadius:12,padding:3}}>
        {["text","file"].map(t=><button key={t} onClick={()=>setInputTab(t)} style={{flex:1,padding:8,borderRadius:9,border:inputTab===t?"1px solid rgba(96,165,250,.35)":"1px solid transparent",background:inputTab===t?"rgba(96,165,250,.1)":"transparent",color:inputTab===t?"#60a5fa":"rgba(255,255,255,.4)",cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .2s"}}>{t==="text"?"📝 Paste Text":"📁 File"}</button>)}
      </div>
      {inputTab==="text"&&<textarea className="inp" style={{marginBottom:10}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Paste notes, textbook chapter, lecture transcript…"/>}
      {inputTab==="file"&&<>
        <div onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)readFile(f);}} onClick={()=>document.getElementById("fi").click()} style={{border:`2px dashed ${dragOver?"#60a5fa":"rgba(255,255,255,.12)"}`,borderRadius:14,padding:24,textAlign:"center",cursor:"pointer",background:dragOver?"rgba(96,165,250,.05)":"rgba(255,255,255,.02)",color:dragOver?"#60a5fa":"rgba(255,255,255,.4)",marginBottom:8,transition:"all .25s"}}>
          <div style={{fontSize:30,marginBottom:6}}>📂</div>
          {fileName?<strong style={{color:"#60a5fa"}}>{fileName}</strong>:<><strong>Drop any file here</strong><p style={{fontSize:12,marginTop:4}}>TXT, MD, CSV or click</p></>}
        </div>
        <input id="fi" type="file" accept=".txt,.md,.csv,.json" style={{display:"none"}} onChange={e=>e.target.files[0]&&readFile(e.target.files[0])}/>
        {rf.slice(0,4).map((f,i)=><div key={i} onClick={()=>{setFileText(f.text);setFileName(f.name);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"9px 14px",cursor:"pointer",marginBottom:5,fontSize:13}}><span>📄 {f.name}</span><span style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{new Date(f.ts).toLocaleDateString()}</span></div>)}
      </>}
      <div className="rw" style={{marginTop:8}}>
        <select className="inp" value={qCount} onChange={e=>setQCount(e.target.value)}>{[5,10,15,20,25,30,40,50].map(n=><option key={n} value={n}>{n} Questions</option>)}</select>
        <select className="inp" value={diff} onChange={e=>setDiff(e.target.value)}><option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option></select>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>

      {/* Animated background canvas */}
      {appMode==="home"&&<BGCanvas type="home"/>}
      {appMode==="study"&&<BGCanvas type="study"/>}
      {appMode==="arcade"&&arcSc!=="game"&&<BGCanvas type="arcade"/>}

      {/* XP popup */}
      {xpPop&&<div className="xp-pop">{xpPop}</div>}

      {/* Overlay */}
      {overlay?.type==="lv"&&<div className="ov" onClick={()=>setOverlay(null)}><div className="ovb"><div style={{fontSize:52,marginBottom:10}}>⬆️</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:2,color:overlay.lv?.col}}>LEVEL UP!</div><div style={{fontSize:18,fontWeight:700,color:overlay.lv?.col,marginTop:4}}>{overlay.lv?.name}</div></div></div>}

      {/* NAV */}
      {appMode!=="home"&&arcSc!=="game"&&(
        <nav className={`nav ${isStudy?"nav-study":isArc?"nav-arcade":"nav-home"}`}>
          <div className={`logo ${isStudy?"logo-study":isArc?"logo-arcade":"logo-home"}`} onClick={()=>{setAppMode("home");setStudySc("home");setArcSc("home");}}>StudyRush</div>
          <div className="msw">
            <button className={`mb${isStudy?" sa":""}`} onClick={()=>{setAppMode("study");setStudySc("home");}}>📚 Study</button>
            <button className={`mb${isArc?" aa":""}`} onClick={()=>{setAppMode("arcade");setArcSc("home");}}>🕹️ Arcade</button>
          </div>
          <div className="nch">
            <div className="chip" style={{color:"#fbbf24",borderColor:"rgba(251,191,36,.2)"}}>⚡{totalXp.toLocaleString()}</div>
            <div className="chip" style={{color:lv.col,borderColor:`${lv.col}33`}}>{lv.name}</div>
            <div className="chip" style={{color:"#fb923c"}}>🔥{dayStreak}</div>
          </div>
        </nav>
      )}

      {/* ── HOME ── */}
      {appMode==="home"&&(
        <div className="home-hero">
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(64px,12vw,112px)",letterSpacing:6,lineHeight:.88,marginBottom:14,background:"linear-gradient(90deg,#a78bfa,#60a5fa,#34d399,#fbbf24)",backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"sr_grd 5s ease infinite"}}>STUDY<br/>RUSH</div>
          <p style={{fontSize:16,color:"rgba(255,255,255,.45)",marginBottom:40,maxWidth:420,lineHeight:1.7}}>Serious study tools meet addictive arcade games — beautifully designed for every learner.</p>
          <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:36}}>
            <button className="btn btn-b" style={{padding:"16px 40px",fontSize:16}} onClick={()=>{setAppMode("study");setStudySc("home");}}>📚 Study Mode</button>
            <button className="btn btn-y" style={{padding:"16px 40px",fontSize:16}} onClick={()=>{setAppMode("arcade");setArcSc("home");}}>🕹️ Arcade Mode</button>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
            {[{v:totalXp.toLocaleString(),l:"Total XP",c:"#fbbf24"},{v:lv.name,l:"Level",c:lv.col},{v:`${dayStreak}🔥`,l:"Streak",c:"#fb923c"},{v:history.length,l:"Sessions",c:"#60a5fa"}].map(s=>(
              <div key={s.l} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.09)",borderRadius:14,padding:"12px 20px",textAlign:"center",backdropFilter:"blur(10px)"}}>
                <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'Space Mono',monospace",marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STUDY MODE ── */}
      {appMode==="study"&&(
        <>
          {loading&&<div className="loading"><div className="lring"/><div style={{fontSize:14,color:"rgba(255,255,255,.5)",fontFamily:"'Space Mono',monospace"}}>{loadMsg}</div></div>}

          {!loading&&studySc==="home"&&(
            <div className="page">
              <div style={{marginBottom:22}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace",marginBottom:5}}>
                  <span style={{color:lv.col,fontWeight:700}}>{lv.name}</span>
                  <span>{nlv?`${totalXp.toLocaleString()} / ${nlv.xp.toLocaleString()} XP`:"MAX LEVEL 🏆"}</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,.07)",borderRadius:100,overflow:"hidden"}}><div style={{height:"100%",background:lv.col,borderRadius:100,width:`${lvPct}%`,transition:"width 1s ease"}}/></div>
              </div>
              <div className="card">
                <div className="ctitle">📚 Study Tools</div>
                <div className="tgrid">
                  {[{id:"quiz",icon:"❓",name:"Quiz",desc:`Up to 50 questions, timed`},{id:"exam",icon:"📝",name:"Exam",desc:"Formal timed exam with sections"},{id:"guide",icon:"📖",name:"Study Guide",desc:"AI-generated comprehensive notes"},{id:"flashcards",icon:"🃏",name:"Flashcards",desc:"Flip-card review system"}].map(t=>(
                    <button key={t.id} className={`tbtn${toolMode===t.id?" on":""}`} onClick={()=>setToolMode(t.id)}>
                      <div style={{fontSize:22,marginBottom:5}}>{t.icon}</div>
                      <div style={{fontSize:13,fontWeight:800,color:toolMode===t.id?"#60a5fa":"#f0f0ff",marginBottom:2}}>{t.name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.4)",lineHeight:1.4}}>{t.desc}</div>
                    </button>
                  ))}
                </div>
                <MatInput/>
                <button className="btn btn-b btn-f" style={{marginTop:12}} onClick={toolMode==="quiz"?startQuiz:toolMode==="exam"?startExam:toolMode==="guide"?startGuide:startCards} disabled={!hasContent()}>
                  {toolMode==="quiz"?"⚡ Start Quiz":toolMode==="exam"?"📝 Generate Exam":toolMode==="guide"?"📖 Create Guide":"🃏 Create Flashcards"}
                </button>
              </div>
              {history.length>0&&<div className="card"><div className="ctitle">📊 Recent Sessions</div>{history.slice(0,5).map((h,i)=>{const p=Math.round(h.score/h.total*100),g=gradeOf(p);return(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"10px 14px",marginBottom:6}}><div><div style={{fontWeight:700,fontSize:13}}>{h.topic}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{new Date(h.ts).toLocaleDateString()} · {h.diff}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:900,color:g.col}}>{g.l}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{h.score}/{h.total}</div></div></div>);})}</div>}
              {Object.keys(dna).length>0&&<div className="card"><div className="ctitle">🧬 Study DNA</div>{Object.entries(dna).sort((a,b)=>b[1].total-a[1].total).slice(0,6).map(([t,d])=>{const p=Math.round((d.correct/d.total)*100),col=p>=80?"#34d399":p>=60?"#fbbf24":"#f87171";return<div key={t} className="dnar"><span className="dnal">{t}</span><div className="dnat"><div className="dnaf" style={{width:`${p}%`,background:col}}/></div><span className="dnap">{p}%</span></div>;})}</div>}
            </div>
          )}

          {!loading&&studySc==="quiz"&&q&&(
            <div className="page">
              <div className="pr"><div className="pt"><div className="pf" style={{width:`${(qIdx/questions.length)*100}%`}}/></div><span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(255,255,255,.3)",whiteSpace:"nowrap"}}>{qIdx+1}/{questions.length}</span></div>
              <div className="hud">
                {[{v:score,l:"Score",c:"#60a5fa"},{v:`+${xp}`,l:"XP",c:"#a78bfa"},{v:streak>0?`🔥${streak}`:streak,l:"Streak",c:"#fb923c"},{v:bestSt,l:"Best",c:"#34d399"}].map(s=><div key={s.l} className="hc"><div className="hl">{s.l}</div><div className="hv" style={{color:s.c}}>{s.v}</div></div>)}
              </div>
              <div className="tbar"><div className="tf" style={{width:`${timeLeft}%`,background:timeLeft>50?"linear-gradient(90deg,#34d399,#60a5fa)":timeLeft>25?"#fbbf24":"linear-gradient(90deg,#f87171,#fb923c)"}}/></div>
              <div className={`qcard ${flashQ||""}`} key={qIdx}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>Q{qIdx+1} · {topic}</span>
                  <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",padding:"2px 9px",borderRadius:100,fontFamily:"'Space Mono',monospace",background:q.type==="mc"?"rgba(96,165,250,.1)":q.type==="tf"?"rgba(52,211,153,.1)":"rgba(248,113,113,.1)",color:q.type==="mc"?"#60a5fa":q.type==="tf"?"#34d399":"#f87171"}}>{q.type==="mc"?"MC":q.type==="tf"?"T/F":"Short"}</span>
                </div>
                <div style={{fontSize:18,fontWeight:800,lineHeight:1.45,marginBottom:14}}>{q.question}</div>
                {!answered&&!showHint&&<button onClick={()=>setShowHint(true)} style={{background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"rgba(255,255,255,.35)",padding:"3px 9px",fontSize:10,cursor:"pointer",marginBottom:8,fontFamily:"'Space Mono',monospace"}}>💡 Hint</button>}
                {showHint&&q.hint&&<div style={{fontSize:11,color:"#60a5fa",background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",borderRadius:7,padding:"5px 11px",marginBottom:10,fontFamily:"'Space Mono',monospace"}}>💡 {q.hint}</div>}
                {q.type==="mc"&&<div className="opts">{q.options.map((opt,i)=>{let cls="opt";if(answered){if(opt.startsWith(q.answer))cls+=" ok";else if(selected===i)cls+=" bad";}else if(selected===i)cls+=" sel";return<button key={i} className={cls} onClick={()=>handleMC(opt,i)} disabled={answered}><span className="ol">{LETS[i]}</span>{opt.replace(/^[A-D]\.\s*/,"")}</button>;})}</div>}
                {q.type==="tf"&&<div className="tfr">{["True","False"].map(v=>{let cls="tfb";if(answered){if(v===q.answer)cls+=" ok";else if(selected===v)cls+=" bad";}else if(selected===v)cls+=" sel";return<button key={v} className={cls} onClick={()=>handleTF(v)} disabled={answered}>{v==="True"?"✓ True":"✗ False"}</button>;})}</div>}
                {q.type==="short"&&<div style={{display:"flex",flexDirection:"column",gap:8}}><div style={{display:"flex",gap:8}}><input className="inp" value={shortVal} onChange={e=>setShortVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleShort()} placeholder="Type your answer…" disabled={answered||checking} style={{flex:1}}/><button onClick={handleVoice} style={{padding:"0 12px",background:listening?"rgba(248,113,113,.15)":"rgba(255,255,255,.06)",border:`1px solid ${listening?"rgba(248,113,113,.4)":"rgba(255,255,255,.15)"}`,borderRadius:10,cursor:"pointer",fontSize:15}}>🎤</button></div><button onClick={handleShort} disabled={!shortVal.trim()||answered||checking} className="btn btn-b" style={{opacity:!shortVal.trim()||answered||checking?.3:1}}>{checking?"Checking…":"Submit →"}</button></div>}
                {feedback&&<div className={`fb${feedback.ok?" ok":" bad"}`}>{feedback.text}</div>}
              </div>
              {answered&&<button onClick={nextQ} style={{width:"100%",padding:13,background:"rgba(255,255,255,.05)",border:"1px solid rgba(96,165,250,.3)",borderRadius:13,color:"#60a5fa",fontWeight:700,fontSize:15,cursor:"pointer"}}>{qIdx+1>=questions.length?"See Results →":"Next →"}</button>}
            </div>
          )}

          {!loading&&studySc==="results"&&(()=>{const circ=2*Math.PI*56,dash=circ-(pct/100)*circ;return(
            <div className="page" style={{textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(60px,10vw,88px)",letterSpacing:3,lineHeight:.9,color:gr.col,marginBottom:6,animation:"sr_pop .6s cubic-bezier(.34,1.56,.64,1)"}}>{gr.l}</div>
              <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>{pct>=80?"Outstanding!":pct>=60?"Good work!":"Keep practicing!"}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:28,fontFamily:"'Space Mono',monospace"}}>{topic} · {questions.length}Q · {diff}</div>
              <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
                <div className="rw2" style={{width:130,height:130}}>
                  <svg width={130} height={130} viewBox="0 0 130 130" style={{transform:"rotate(-90deg)"}}>
                    <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10"/>
                    <circle cx="65" cy="65" r="56" fill="none" stroke={gr.col} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} style={{transition:"stroke-dashoffset 1.2s ease",filter:`drop-shadow(0 0 6px ${gr.col})`}}/>
                  </svg>
                  <div className="rl"><div style={{fontSize:28,fontWeight:900,color:gr.col}}>{pct}%</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{score}/{questions.length}</div></div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxWidth:400,margin:"0 auto 20px"}}>
                {[{v:`+${xp}`,l:"XP",c:"#60a5fa"},{v:bestSt,l:"Streak",c:"#34d399"},{v:dayStreak,l:"Day🔥",c:"#fb923c"}].map(s=><div key={s.l} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:12}}><div style={{fontSize:26,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'Space Mono',monospace"}}>{s.l}</div></div>)}
              </div>
              {library.find(l=>l.topic===topic)&&<div className="card" style={{maxWidth:440,margin:"0 auto 14px",textAlign:"left"}}><div className="ctitle">🕹️ Play arcade with this material</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{GAMES.slice(0,3).map(g=><button key={g.id} onClick={()=>{const lib=library.find(l=>l.topic===topic);launchGame(g,lib?.questions);setAppMode("arcade");}} style={{padding:"10px 6px",background:`${g.col}10`,border:`1px solid ${g.col}25`,borderRadius:10,color:g.col,cursor:"pointer",fontSize:11,fontWeight:700,textAlign:"center"}}><div style={{fontSize:18,marginBottom:3}}>{g.icon}</div>{g.name}</button>)}</div></div>}
              <div style={{display:"flex",gap:8,maxWidth:440,margin:"0 auto"}}>
                <button className="btn btn-g" style={{flex:1}} onClick={()=>setStudySc("home")}>🔄 Again</button>
                <button className="btn btn-b" style={{flex:1}} onClick={()=>navigator.clipboard.writeText(`📚 StudyRush\n${topic}\n${score}/${questions.length} (${pct}%) — ${gr.l}\nstudyrush.app`)}>📋 Share</button>
              </div>
            </div>
          );})()}

          {!loading&&studySc==="examTake"&&examData&&(
            <div className="page">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:1}}>{examData.title}</div><div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{examData.totalPoints} pts · {examData.duration} min</div></div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:examTime<300?"#f87171":"#60a5fa"}}>{Math.floor(examTime/60)}:{String(examTime%60).padStart(2,"0")}</div>
              </div>
              {examDone&&examScore?(<div style={{textAlign:"center",padding:"32px 0"}}><div style={{fontSize:64,fontWeight:900,color:examScore.grade.col,marginBottom:8}}>{examScore.grade.l}</div><div style={{fontSize:24,fontWeight:800,marginBottom:4}}>{examScore.pts}/{examScore.max} pts ({examScore.pct}%)</div><div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:24}}>Exam complete!</div><button className="btn btn-b" onClick={()=>setStudySc("home")}>← Back</button></div>):(
                <>{examData.sections?.map((sec,si)=><div key={si} className="esec"><div className="estit">{sec.name} — {sec.points} pts</div>{sec.questions?.map((eq,qi)=><div key={qi} className="eq"><div style={{fontSize:14,fontWeight:600,marginBottom:8,lineHeight:1.5}}>Q{eq.id}. ({eq.points}pts) {eq.question}</div>{eq.type==="mc"&&<div style={{display:"flex",flexDirection:"column",gap:5}}>{eq.options?.map((opt,i)=><label key={i} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:"rgba(255,255,255,.7)"}}><input type="radio" name={`q${eq.id}`} value={LETS[i]} onChange={()=>setExamAns(a=>({...a,[eq.id]:LETS[i]}))} style={{accentColor:"#60a5fa"}}/>{opt}</label>)}</div>}{eq.type==="tf"&&<div style={{display:"flex",gap:12}}>{["True","False"].map(v=><label key={v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:13,color:"rgba(255,255,255,.7)"}}><input type="radio" name={`q${eq.id}`} onChange={()=>setExamAns(a=>({...a,[eq.id]:v}))} style={{accentColor:"#60a5fa"}}/>{v}</label>)}</div>}{eq.type==="short"&&<input className="einp" placeholder="Your answer…" onChange={e=>setExamAns(a=>({...a,[eq.id]:e.target.value}))}/>}</div>)}</div>)}<button className="btn btn-b btn-f" onClick={scoreExam}>Submit Exam →</button></>
              )}
            </div>
          )}

          {!loading&&studySc==="guide"&&<div className="page"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:1}}>📖 Study Guide</div><div style={{display:"flex",gap:8}}><button className="btn btn-g" style={{padding:"8px 14px",fontSize:12}} onClick={()=>navigator.clipboard.writeText(guide)}>📋 Copy</button><button className="btn btn-g" style={{padding:"8px 14px",fontSize:12}} onClick={()=>setStudySc("home")}>← Back</button></div></div><div className="guide">{guide}</div></div>}

          {!loading&&studySc==="flashcards"&&cards.length>0&&(
            <div className="page">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:1}}>🃏 Flashcards</div><div style={{fontSize:12,color:"rgba(255,255,255,.4)",fontFamily:"'Space Mono',monospace"}}>{cardIdx+1}/{cards.length}</div></div>
              <div className="pr"><div className="pt"><div className="pf" style={{width:`${((cardIdx+1)/cards.length)*100}%`}}/></div></div>
              <div className={`fcw${cardFlip?" fl":""}`} onClick={()=>setCardFlip(f=>!f)}>
                <div className="fci">
                  <div className="fcf fcfront"><div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8,fontFamily:"'Space Mono',monospace"}}>{cards[cardIdx]?.category}</div><div style={{fontSize:18,fontWeight:800}}>{cards[cardIdx]?.front}</div><div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:12}}>Tap to reveal →</div></div></div>
                  <div className="fcf fcback"><div style={{fontSize:16,fontWeight:700,lineHeight:1.5}}>{cards[cardIdx]?.back}</div></div>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:14}}>
                <button className="btn btn-g" style={{flex:1}} disabled={cardIdx===0} onClick={()=>{setCardIdx(i=>i-1);setCardFlip(false);}}>← Prev</button>
                <button className="btn btn-b" style={{flex:1}} disabled={cardIdx>=cards.length-1} onClick={()=>{setCardIdx(i=>i+1);setCardFlip(false);}}>Next →</button>
              </div>
              <button className="btn btn-g" style={{width:"100%",marginTop:8}} onClick={()=>setStudySc("home")}>← Back</button>
            </div>
          )}
        </>
      )}

      {/* ── ARCADE MODE ── */}
      {appMode==="arcade"&&(
        <>
          {arcSc==="game"&&activeGame&&(
            <div style={{position:"fixed",inset:0,zIndex:100}}>
              <ArcadeCanvas gameConfig={activeGame} onFinish={handleGameFinish}/>
              <button onClick={()=>{setArcSc("home");setActiveGame(null);}} style={{position:"absolute",top:14,right:14,zIndex:200,background:"rgba(0,0,0,.65)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,padding:"7px 14px",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,fontWeight:600,backdropFilter:"blur(8px)"}}>✕ Exit</button>
            </div>
          )}

          {arcSc==="home"&&(
            <div className="page">
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,letterSpacing:3,marginBottom:4,background:"linear-gradient(90deg,#fbbf24,#f87171)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>🕹️ ARCADE</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:22}}>5 engine-powered games running at 60fps. Real canvas rendering. Beat your high scores.</div>
              {library.length===0?(
                <div className="card" style={{textAlign:"center",padding:32}}>
                  <div style={{fontSize:40,marginBottom:12}}>📚</div>
                  <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>No study sets yet</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:20}}>Complete a quiz in Study Mode first to unlock arcade games!</div>
                  <button className="btn btn-y" onClick={()=>{setAppMode("study");setStudySc("home");}}>📚 Go to Study Mode</button>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
                  {GAMES.map(game=>(
                    <div key={game.id} className="agc" style={{background:`${game.col}08`,border:`1px solid ${game.col}25`}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                        <div style={{fontSize:30}}>{game.icon}</div>
                        <div>
                          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1.5,color:game.col}}>{game.name}</div>
                          {arcBests[game.id]&&<div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>Best: {arcBests[game.id]}</div>}
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,.5)",lineHeight:1.5,marginBottom:12}}>{game.desc}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace",marginBottom:6}}>Choose topic:</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:150,overflowY:"auto"}}>
                        {library.slice(0,6).map(l=>(
                          <button key={l.id} onClick={()=>launchGame(game,l.questions)} style={{padding:"7px 12px",background:`${game.col}10`,border:`1px solid ${game.col}22`,borderRadius:8,color:game.col,cursor:"pointer",fontSize:11,fontWeight:700,textAlign:"left",transition:"all .2s",touchAction:"manipulation"}}>
                            📚 {l.topic} <span style={{opacity:.5,fontWeight:400}}>({l.questions?.filter(q=>q.type==="mc").length||0} MC)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {arcSc==="result"&&(
            <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:10,paddingTop:70}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:64,marginBottom:12,animation:"sr_float 3s ease-in-out infinite"}}>{activeGame?.icon}</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,letterSpacing:3,color:activeGame?.col,marginBottom:8}}>COMPLETE!</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.4)",fontFamily:"'Space Mono',monospace",marginBottom:8}}>Best: {arcBests[activeGame?.id]||0}</div>
                <div style={{fontSize:14,color:"#fbbf24",marginBottom:28,fontWeight:700}}>+{Math.round((arcBests[activeGame?.id]||0)/10)} XP earned!</div>
                <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                  <button className="btn" style={{background:`linear-gradient(135deg,${activeGame?.col},${activeGame?.col}cc)`,color:"#0a0a14",fontWeight:900,padding:"13px 24px"}} onClick={()=>{setArcSc("game");}}>🔄 Play Again</button>
                  <button className="btn btn-g" onClick={()=>setArcSc("home")}>🕹️ All Games</button>
                  <button className="btn btn-g" onClick={()=>{setAppMode("study");setStudySc("home");}}>📚 Study Mode</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
