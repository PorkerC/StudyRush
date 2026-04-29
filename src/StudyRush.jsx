import { useState, useEffect, useRef, useCallback } from "react";

const MODEL = "claude-haiku-4-5-20251001";
const HDRS = () => ({
  "Content-Type": "application/json",
  "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});

// ── AUDIO ─────────────────────────────────────────────────────────────────────
let _ac = null;
const ac = () => { if (!_ac) try { _ac = new (window.AudioContext||window.webkitAudioContext)(); } catch{} return _ac; };
const tone = (f,d,type="sine",v=.18,delay=0) => {
  const c=ac(); if(!c)return;
  try{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.type=type;o.frequency.setValueAtTime(f,c.currentTime+delay);g.gain.setValueAtTime(v,c.currentTime+delay);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+d);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+d);}catch{}
};
const SFX = {
  correct: ()=>{tone(523,.08,"sine",.2);tone(659,.08,"sine",.2,.09);tone(784,.2,"sine",.2,.18)},
  wrong:   ()=>{tone(220,.15,"sawtooth",.18);tone(160,.2,"sawtooth",.14,.13)},
  streak:  ()=>[523,587,659,784,1047].forEach((f,i)=>tone(f,.1,"sine",.18,i*.07)),
  jackpot: ()=>{[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.12,"sine",.22,i*.055));tone(1047,.7,"sine",.1,.5)},
  levelUp: ()=>[392,494,587,784,1047].forEach((f,i)=>tone(f,.2,"sine",.22,i*.09)),
  boss:    ()=>[60,45,35].forEach((f,i)=>tone(f,.4,"sawtooth",.25,i*.28)),
  click:   ()=>tone(600,.05,"sine",.1),
  swoosh:  ()=>tone(300,.08,"sine",.08),
  danger:  ()=>tone(110,.1,"sawtooth",.2),
  tick:    ()=>tone(880,.03,"square",.05),
  loot:    ()=>[392,523,659,784].forEach((f,i)=>tone(f,.15,"sine",.18,i*.08)),
  badge:   ()=>[523,784,1047].forEach((f,i)=>tone(f,.18,"sine",.22,i*.1)),
  select:  ()=>tone(440,.05,"sine",.1),
  pop:     ()=>tone(800,.04,"sine",.15),
  tap:     ()=>tone(1000,.04,"square",.2),
  miss:    ()=>tone(200,.1,"sawtooth",.15),
  arcade:  ()=>{tone(440,.1,"square",.15);tone(660,.1,"sine",.12,.1)},
  tts:     (text)=>{if('speechSynthesis'in window){window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.rate=0.9;window.speechSynthesis.speak(u);}},
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const TUTORS = [
  {id:"wit",   name:"Dr. Wit",         emoji:"🎓",col:"#c084fc",bg:"linear-gradient(135deg,#2d1b69,#1a0a3d)",tone:"witty sarcastic genius professor who barely tolerates you but secretly wants you to succeed",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a1" cx="50%" cy="40%"><stop offset="0%" stop-color="#f5cba7"/><stop offset="100%" stop-color="#d4a574"/></radialGradient></defs><circle cx="60" cy="55" r="32" fill="url(#a1)"/><ellipse cx="60" cy="95" rx="28" ry="18" fill="#4a235a"/><rect x="28" y="28" width="64" height="8" rx="4" fill="#2c1654"/><rect x="32" y="18" width="56" height="14" rx="7" fill="#1a0a3d"/><circle cx="47" cy="52" r="5" fill="#fff"/><circle cx="73" cy="52" r="5" fill="#fff"/><circle cx="47" cy="52" r="3" fill="#333"/><circle cx="73" cy="52" r="3" fill="#333"/><path d="M50 65 Q60 72 70 65" stroke="#8b5e3c" stroke-width="2.5" fill="none" stroke-linecap="round"/><rect x="85" y="48" width="3" height="14" rx="1.5" fill="#c084fc"/></svg>`},
  {id:"drill", name:"Sgt. Drill",       emoji:"⚔️",col:"#f87171",bg:"linear-gradient(135deg,#450a0a,#1a0000)",tone:"brutal military drill sergeant — zero sympathy, maximum results, you WILL learn or else",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a2" cx="50%" cy="40%"><stop offset="0%" stop-color="#c8864e"/><stop offset="100%" stop-color="#a0622a"/></radialGradient></defs><rect x="20" y="15" width="80" height="40" rx="8" fill="#2d4a1e"/><rect x="22" y="17" width="76" height="36" rx="7" fill="#3d6428"/><circle cx="60" cy="62" r="28" fill="url(#a2)"/><rect x="35" y="42" width="50" height="12" rx="3" fill="#1a3310"/><circle cx="47" cy="60" r="5" fill="#fff"/><circle cx="73" cy="60" r="5" fill="#fff"/><circle cx="47" cy="60" r="3" fill="#1a1a2e"/><circle cx="73" cy="60" r="3" fill="#1a1a2e"/><path d="M47 73 L60 78 L73 73" stroke="#7a4010" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="90" rx="30" ry="18" fill="#1a3310"/></svg>`},
  {id:"hype",  name:"Coach Hype",       emoji:"🔥",col:"#fb923c",bg:"linear-gradient(135deg,#431407,#1a0800)",tone:"absolutely unhinged hype coach — every correct answer is the greatest moment in human history",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a3" cx="50%" cy="40%"><stop offset="0%" stop-color="#fcd5b0"/><stop offset="100%" stop-color="#e8a87c"/></radialGradient></defs><circle cx="60" cy="58" r="30" fill="url(#a3)"/><path d="M30 38 Q60 20 90 38 L88 32 Q60 12 32 32Z" fill="#e63946"/><rect x="28" y="28" width="64" height="12" rx="6" fill="#e63946"/><circle cx="47" cy="56" r="5.5" fill="#fff"/><circle cx="73" cy="56" r="5.5" fill="#fff"/><circle cx="47" cy="56" r="3" fill="#1a1a2e"/><circle cx="73" cy="56" r="3" fill="#1a1a2e"/><path d="M44 70 Q60 80 76 70" stroke="#c87941" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="88" rx="26" ry="16" fill="#e63946"/></svg>`},
  {id:"chill", name:"Alex Chill",       emoji:"😎",col:"#34d399",bg:"linear-gradient(135deg,#064e3b,#022c22)",tone:"super chill supportive homie, good vibes only, believes in you unconditionally",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a4" cx="50%" cy="40%"><stop offset="0%" stop-color="#d4a574"/><stop offset="100%" stop-color="#b8834a"/></radialGradient></defs><circle cx="60" cy="58" r="30" fill="url(#a4)"/><rect x="28" y="35" width="64" height="10" rx="5" fill="#1a1a2e"/><rect x="38" y="53" width="18" height="8" rx="4" fill="#1a1a2e"/><rect x="64" y="53" width="18" height="8" rx="4" fill="#1a1a2e"/><rect x="56" y="55" width="8" height="4" rx="2" fill="#333"/><path d="M44 70 Q60 82 76 70" stroke="#8b5e3c" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="90" rx="28" ry="16" fill="#065f46"/></svg>`},
  {id:"sensei",name:"Sensei",           emoji:"🥷",col:"#60a5fa",bg:"linear-gradient(135deg,#0c1445,#060d2e)",tone:"ancient wise master who speaks only in profound metaphors that somehow make perfect sense",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><ellipse cx="60" cy="58" rx="30" ry="30" fill="#1a1a2e"/><circle cx="60" cy="52" r="22" fill="#2d2d5e"/><rect x="30" y="48" width="60" height="20" rx="2" fill="#1a1a2e"/><circle cx="47" cy="56" r="5" fill="#60a5fa" opacity=".9"/><circle cx="73" cy="56" r="5" fill="#60a5fa" opacity=".9"/><path d="M48 68 Q60 75 72 68" stroke="#60a5fa" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="92" rx="30" ry="16" fill="#1a1a2e"/><circle cx="60" cy="25" r="4" fill="#fbbf24" opacity=".7"/></svg>`},
  {id:"skib",  name:"Skibidi Scholar",  emoji:"🗣️",col:"#fb923c",bg:"linear-gradient(135deg,#431407,#1a0500)",tone:"full Gen Z brainrot — rizz, sigma, skibidi, no cap, bussin fr fr — but explains everything perfectly",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a6" cx="50%" cy="40%"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#f59e0b"/></radialGradient></defs><circle cx="60" cy="58" r="28" fill="url(#a6)"/><ellipse cx="60" cy="35" rx="30" ry="12" fill="#1a1a2e"/><rect x="30" y="24" width="60" height="14" rx="7" fill="#0f172a"/><circle cx="47" cy="56" r="6" fill="#fff"/><circle cx="73" cy="56" r="6" fill="#fff"/><circle cx="48" cy="55" r="3.5" fill="#1a1a2e"/><circle cx="74" cy="55" r="3.5" fill="#1a1a2e"/><path d="M47 70 Q60 80 73 70" stroke="#d97706" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="90" rx="26" ry="15" fill="#0f172a"/></svg>`},
  {id:"girl",  name:"That Girl",        emoji:"💅",col:"#f472b6",bg:"linear-gradient(135deg,#500724,#1a0010)",tone:"main character energy, it's giving academia, manifestation meets neuroscience, bestie energy",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a7" cx="50%" cy="35%"><stop offset="0%" stop-color="#fce7f3"/><stop offset="100%" stop-color="#fbcfe8"/></radialGradient></defs><circle cx="60" cy="58" r="30" fill="url(#a7)"/><path d="M30 40 Q40 15 60 20 Q80 15 90 40 Q88 35 60 28 Q32 35 30 40Z" fill="#ec4899"/><circle cx="47" cy="58" r="5" fill="#fff"/><circle cx="73" cy="58" r="5" fill="#fff"/><circle cx="47" cy="58" r="3" fill="#be185d"/><circle cx="73" cy="58" r="3" fill="#be185d"/><path d="M47 72 Q60 82 73 72" stroke="#be185d" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="35" cy="62" r="4" fill="#fda4af" opacity=".7"/><circle cx="85" cy="62" r="4" fill="#fda4af" opacity=".7"/><ellipse cx="60" cy="90" rx="28" ry="16" fill="#ec4899"/></svg>`},
  {id:"robot", name:"GigaBot 3000",    emoji:"🤖",col:"#38bdf8",bg:"linear-gradient(135deg,#0c2a4a,#040e1a)",tone:"malfunctioning AI that randomly [GLITCHES] and [REBOOTS] mid-sentence but explains everything correctly",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="28" y="35" width="64" height="55" rx="8" fill="#0f2744"/><rect x="30" y="37" width="60" height="51" rx="7" fill="#0c3a5e"/><rect x="52" y="25" width="16" height="14" rx="4" fill="#0f2744"/><circle cx="60" cy="22" r="5" fill="#38bdf8"/><rect x="38" y="50" width="18" height="14" rx="3" fill="#0a1628"/><rect x="64" y="50" width="18" height="14" rx="3" fill="#0a1628"/><rect x="40" y="52" width="6" height="10" rx="1" fill="#38bdf8" opacity=".8"/><rect x="66" y="52" width="6" height="10" rx="1" fill="#38bdf8" opacity=".8"/><rect x="38" y="72" width="44" height="8" rx="4" fill="#0a1628"/><rect x="40" y="74" width="20" height="4" rx="2" fill="#38bdf8" opacity=".9"/><rect x="20" y="48" width="8" height="24" rx="4" fill="#0f2744"/><rect x="92" y="48" width="8" height="24" rx="4" fill="#0f2744"/></svg>`},
  {id:"grem",  name:"Gremlin",         emoji:"🧌",col:"#a3e635",bg:"linear-gradient(135deg,#1a2e00,#0a1400)",tone:"chaotic feral genius with random capitalization and unhinged energy who is inexplicably brilliant",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a9" cx="50%" cy="40%"><stop offset="0%" stop-color="#86efac"/><stop offset="100%" stop-color="#4ade80"/></radialGradient></defs><ellipse cx="60" cy="62" rx="32" ry="28" fill="url(#a9)"/><path d="M28 55 Q20 35 35 25 Q40 20 38 30Z" fill="#4ade80"/><path d="M92 55 Q100 35 85 25 Q80 20 82 30Z" fill="#4ade80"/><circle cx="45" cy="58" r="8" fill="#fff"/><circle cx="75" cy="58" r="8" fill="#fff"/><circle cx="45" cy="57" r="5" fill="#1a1a2e"/><circle cx="75" cy="57" r="5" fill="#1a1a2e"/><path d="M44 76 Q60 90 76 76" stroke="#16a34a" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="48" y="78" width="5" height="6" rx="1" fill="#fff"/><rect x="55" y="78" width="5" height="6" rx="1" fill="#fff"/><rect x="62" y="78" width="5" height="6" rx="1" fill="#fff"/><ellipse cx="60" cy="94" rx="28" ry="14" fill="#166534"/></svg>`},
  {id:"shake", name:"Shakespeare",     emoji:"🎭",col:"#fcd34d",bg:"linear-gradient(135deg,#451a03,#1a0900)",tone:"full Shakespearean English — doth thou understand? thine intellect doth shine most magnificently",
   avatar:`<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="a10" cx="50%" cy="40%"><stop offset="0%" stop-color="#fde8c8"/><stop offset="100%" stop-color="#d4a574"/></radialGradient></defs><circle cx="60" cy="58" r="28" fill="url(#a10)"/><path d="M32 45 Q60 15 88 45 Q85 30 60 22 Q35 30 32 45Z" fill="#1a0900"/><path d="M22 55 Q18 45 25 38 Q28 35 30 42Z" fill="#f5e6d3"/><path d="M98 55 Q102 45 95 38 Q92 35 90 42Z" fill="#f5e6d3"/><circle cx="47" cy="56" r="5" fill="#fff"/><circle cx="73" cy="56" r="5" fill="#fff"/><circle cx="47" cy="56" r="3" fill="#5c3317"/><circle cx="73" cy="56" r="3" fill="#5c3317"/><path d="M50 69 Q60 76 70 69" stroke="#8b5e3c" stroke-width="2.5" fill="none" stroke-linecap="round"/><ellipse cx="60" cy="90" rx="28" ry="16" fill="#2d1b00"/></svg>`},
];

const MODES = [
  {id:"casual",  name:"CASUAL",   icon:"☁️",col:"#34d399",desc:"No timer. No pressure. Learn at your pace.",   timeLimit:0, hintFree:true,  lives:Infinity},
  {id:"ranked",  name:"RANKED",   icon:"⚔️",col:"#f87171",desc:"Compete for rank. XP multipliers. Climb.",      timeLimit:30,hintFree:false, lives:Infinity},
  {id:"blitz",   name:"BLITZ",    icon:"⚡",col:"#fbbf24",desc:"60 seconds. Answer as many as possible.",       timeLimit:60,hintFree:false, lives:Infinity,blitz:true},
  {id:"survival",name:"SURVIVAL", icon:"❤️",col:"#f472b6",desc:"3 lives. Wrong answers cost. Survive.",         timeLimit:20,hintFree:false, lives:3},
  {id:"zen",     name:"ZEN",      icon:"🧘",col:"#818cf8",desc:"Deep focus. Full explanations. No rush.",       timeLimit:0, hintFree:true,  lives:Infinity,zen:true},
];

const STYLES = [
  {id:"visual",     name:"VISUAL",      icon:"👁️",col:"#c084fc",desc:"Color-coded answers & visual cues"},
  {id:"auditory",   name:"AUDITORY",    icon:"🎵",col:"#34d399",desc:"Text-to-speech & audio feedback"},
  {id:"kinesthetic",name:"KINESTHETIC", icon:"✋",col:"#fb923c",desc:"Interactive & hands-on"},
  {id:"reading",    name:"READING",     icon:"📖",col:"#60a5fa",desc:"Detailed text & structured notes"},
  {id:"mixed",      name:"MIXED",       icon:"🔀",col:"#fbbf24",desc:"AI-adaptive to your DNA"},
];

const ARCADE_GAMES = [
  {id:"lightning", name:"Lightning Tap",  icon:"⚡",col:"#fbbf24",desc:"Answers flash for a split second. Tap the right one fast!",          difficulty:"Reaction Speed"},
  {id:"blastzone", name:"Answer Blitz",   icon:"💥",col:"#f87171",desc:"Correct answers pop up randomly. Tap before they vanish!",            difficulty:"Reflex & Recall"},
  {id:"hexdodge",  name:"Hex Dodge",      icon:"🔷",col:"#818cf8",desc:"Dodge wrong answers rotating toward you. Answer to survive!",          difficulty:"Spatial + Memory"},
  {id:"rhythm",    name:"Rhythm Review",  icon:"🎵",col:"#34d399",desc:"Answers fall in rhythm. Hit them on the beat!",                       difficulty:"Timing & Memory"},
  {id:"aimtrainer",name:"Aim Trainer",    icon:"🎯",col:"#fb923c",desc:"Answer targets move across the screen. Click them accurately!",        difficulty:"Precision Focus"},
  {id:"speedrun",  name:"Speed Run",      icon:"🏎️",col:"#60a5fa",desc:"Answer correctly to accelerate. Wrong answers slow you down!",         difficulty:"Speed + Knowledge"},
];

const LEVELS=[
  {name:"Rookie",xp:0,col:"#94a3b8"},{name:"Scholar",xp:200,col:"#34d399"},
  {name:"Expert",xp:500,col:"#60a5fa"},{name:"Master",xp:1000,col:"#fbbf24"},
  {name:"Legend",xp:2000,col:"#f87171"},{name:"Mythic",xp:5000,col:"#c084fc"},
  {name:"GOD MODE",xp:10000,col:"#ffffff"},
];
const getLevel=xp=>[...LEVELS].reverse().find(l=>xp>=l.xp)||LEVELS[0];
const getNext=xp=>LEVELS.find(l=>l.xp>xp);
const LETTERS=["A","B","C","D"];
const gradeOf=p=>p>=97?{l:"S+",m:"MYTHIC!"}:p>=93?{l:"S",m:"LEGENDARY!"}:p>=90?{l:"A+",m:"FLAWLESS!"}:p>=80?{l:"A",m:"Outstanding!"}:p>=70?{l:"B",m:"Solid work!"}:p>=60?{l:"C",m:"Keep going!"}:{l:"D",m:"More practice!"};
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}},set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};

// ── API ───────────────────────────────────────────────────────────────────────
const callAPI=async(prompt,max=1500)=>{
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:HDRS(),body:JSON.stringify({model:MODEL,max_tokens:max,messages:[{role:"user",content:prompt}]})});
  if(!r.ok){const e=await r.json();throw new Error(e.error?.message||`HTTP ${r.status}`);}
  const d=await r.json();
  return d.content.map(b=>b.text||"").join("").replace(/```json|```/g,"").trim();
};
const genQs=async(text,count,diff,tutor,style)=>JSON.parse(await callAPI(
  `Quiz generator. Tutor: ${tutor?.tone||"neutral"}. Style: ${style?.id||"mixed"}.
Generate exactly ${count} ${diff} questions from material. Mix: mc(4 opts), tf, short.
ONLY valid JSON:{"topic":"name","questions":[
{"id":1,"type":"mc","question":"?","options":["A text","B text","C text","D text"],"answer":"A","explanation":"brief","hint":"one word","visual_cue":"emoji"},
{"id":2,"type":"tf","question":"?","answer":"True","explanation":"brief","hint":"clue","visual_cue":"emoji"},
{"id":3,"type":"short","question":"?","answer":"answer","explanation":"brief","hint":"clue","visual_cue":"emoji"}
]}
Material:"""${text.slice(0,3500)}"""`,1700));
const checkShort=async(q,correct,user)=>JSON.parse(await callAPI(`Q:"${q}" Correct:"${correct}" Student:"${user}" Equivalent? ONLY JSON:{"correct":true,"feedback":"one sentence"}`,300));
const personaReact=async(tutor,ok,streak,qText)=>{const raw=await callAPI(`You are ${tutor.name}. Tone: ${tutor.tone}. Student answered "${qText.slice(0,60)}" ${ok?"CORRECTLY":"INCORRECTLY"}. Streak: ${streak}. React. Max 13 words. No quotes.`,150);return raw.trim().replace(/^["']|["']$/g,"");};
const genMindMap=async(topic,questions)=>JSON.parse(await callAPI(
  `Create a mind map for "${topic}" based on these concepts: ${questions.map(q=>q.question.slice(0,60)).join("; ")}.
ONLY JSON:{"center":"${topic}","branches":[{"concept":"main idea","color":"#fbbf24","children":["detail 1","detail 2"]},{"concept":"main idea 2","color":"#34d399","children":["detail"]},{"concept":"main idea 3","color":"#60a5fa","children":["detail 1","detail 2","detail 3"]},{"concept":"main idea 4","color":"#f87171","children":["detail"]},{"concept":"main idea 5","color":"#c084fc","children":["detail 1","detail 2"]}]}`,600));
const genBoss=async(topic,wrong)=>JSON.parse(await callAPI(`3 VERY HARD boss questions on "${topic}". Focus: ${wrong.slice(0,3).join(",")||"core"}. ONLY JSON:{"questions":[{"id":99,"type":"mc","question":"?","options":["A t","B t","C t","D t"],"answer":"A","explanation":"why","hint":"clue","visual_cue":"emoji"}]}`,800));

// ── PARTICLES ─────────────────────────────────────────────────────────────────
function Particles({type,active}){
  if(!active)return null;
  const cfgs={correct:{cols:["#34d399","#fbbf24","#60a5fa","#fff"],n:28},wrong:{cols:["#f87171","#fb923c"],n:12},jackpot:{cols:["#fbbf24","#fff","#fcd34d","#34d399","#c084fc"],n:80},boss:{cols:["#f87171","#c084fc","#fb923c","#fff"],n:55},level:{cols:["#fbbf24","#fff","#60a5fa"],n:65},arcade:{cols:["#fbbf24","#f87171","#c084fc","#34d399","#60a5fa"],n:50}};
  const cfg=cfgs[type]||cfgs.correct;
  return(<div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>{Array.from({length:cfg.n}).map((_,i)=>{const col=cfg.cols[i%cfg.cols.length];const sz=Math.random()*12+4;return<div key={i} style={{position:"absolute",left:`${Math.random()*100}%`,top:"-12px",width:sz,height:sz,background:col,borderRadius:Math.random()>.5?"50%":"3px",animation:`sr_fall ${.9+Math.random()*1.4}s ease-in ${Math.random()*.65}s forwards`,transform:`rotate(${Math.random()*360}deg)`,boxShadow:`0 0 ${sz}px ${col}55`}}/>;})}</div>);
}

// ── ANIMATED BACKGROUND ───────────────────────────────────────────────────────
function GameBG({col="#fbbf24"}){
  return(<div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none"}}>
    <div style={{position:"absolute",inset:0,background:"#07070f"}}/>
    <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 70% 60% at 15% 0%,${col}08 0%,transparent 55%),radial-gradient(ellipse 50% 50% at 85% 100%,${col}06 0%,transparent 55%)`}}/>
    <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(${col}0a 1px,transparent 1px),linear-gradient(90deg,${col}0a 1px,transparent 1px)`,backgroundSize:"80px 80px",animation:"sr_grid 12s linear infinite"}}/>
    {[...Array(5)].map((_,i)=><div key={i} style={{position:"absolute",left:`${10+i*18}%`,top:`${15+Math.sin(i)*25}%`,width:`${80+i*35}px`,height:`${80+i*35}px`,borderRadius:"50%",background:`radial-gradient(circle,${col}${Math.floor(3+i)}0 0%,transparent 70%)`,animation:`sr_orb ${8+i*2}s ease-in-out ${i*1.5}s infinite`,filter:"blur(40px)"}}/>)}
    <div style={{position:"absolute",left:0,right:0,height:"1px",background:`linear-gradient(90deg,transparent,${col}40,transparent)`,animation:"sr_scan 6s linear infinite"}}/>
  </div>);
}

// ── MIND MAP ──────────────────────────────────────────────────────────────────
function MindMap({data}){
  if(!data)return null;
  const cx=300,cy=220,r=140;
  return(
    <svg viewBox="0 0 600 440" style={{width:"100%",height:"auto",maxHeight:400}}>
      {/* Center */}
      <ellipse cx={cx} cy={cy} rx={70} ry={35} fill="rgba(251,191,36,.15)" stroke="#fbbf24" strokeWidth="2"/>
      <text x={cx} y={cy+5} textAnchor="middle" fill="#fbbf24" fontSize="13" fontWeight="800" fontFamily="Sora,sans-serif">{data.center?.slice(0,18)}</text>
      {/* Branches */}
      {data.branches?.slice(0,5).map((b,i)=>{
        const angle=(i/data.branches.length)*2*Math.PI-Math.PI/2;
        const bx=cx+Math.cos(angle)*r;const by=cy+Math.sin(angle)*r;
        return(<g key={i}>
          <line x1={cx} y1={cy} x2={bx} y2={by} stroke={b.color||"#60a5fa"} strokeWidth="2" strokeDasharray="4 2" opacity=".6"/>
          <ellipse cx={bx} cy={by} rx={55} ry={24} fill={`${b.color||"#60a5fa"}20`} stroke={b.color||"#60a5fa"} strokeWidth="1.5"/>
          <text x={bx} y={by+5} textAnchor="middle" fill={b.color||"#60a5fa"} fontSize="10" fontWeight="700" fontFamily="Sora,sans-serif">{b.concept?.slice(0,14)}</text>
          {b.children?.slice(0,3).map((ch,j)=>{
            const ca=angle+(j-1)*.4;const cr=r+80;
            const chx=cx+Math.cos(ca)*cr;const chy=cy+Math.sin(ca)*cr;
            return(<g key={j}>
              <line x1={bx} y1={by} x2={chx} y2={chy} stroke={b.color||"#60a5fa"} strokeWidth="1" opacity=".3"/>
              <circle cx={chx} cy={chy} r="22" fill={`${b.color||"#60a5fa"}10`} stroke={b.color||"#60a5fa"} strokeWidth="1" opacity=".7"/>
              <text x={chx} y={chy+4} textAnchor="middle" fill="rgba(255,255,255,.7)" fontSize="8" fontFamily="Sora,sans-serif">{ch?.slice(0,12)}</text>
            </g>);
          })}
        </g>);
      })}
    </svg>
  );
}

// ── ARCADE: LIGHTNING TAP ─────────────────────────────────────────────────────
function LightningTap({questions,onFinish}){
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [visible,setVisible]=useState(true);
  const [showTime,setShowTime]=useState(1200);
  const [result,setResult]=useState(null);
  const [done,setDone]=useState(false);
  const [hits,setHits]=useState(0);
  const [misses,setMisses]=useState(0);
  const timerRef=useRef(null);
  const q=questions[idx];

  useEffect(()=>{
    if(done||!q)return;
    setVisible(true);setResult(null);
    timerRef.current=setTimeout(()=>{setVisible(false);setResult("miss");setMisses(m=>m+1);setTimeout(next,800);},showTime);
    return()=>clearTimeout(timerRef.current);
  },[idx,done]);

  const next=()=>{
    if(idx+1>=questions.length){setDone(true);return;}
    setIdx(i=>i+1);
    setShowTime(t=>Math.max(400,t-80));
  };

  const handleTap=(opt)=>{
    clearTimeout(timerRef.current);
    const ok=opt.startsWith(q.answer);
    setResult(ok?"hit":"miss");
    if(ok){setScore(s=>s+10);setHits(h=>h+1);SFX.tap();}else{setMisses(m=>m+1);SFX.miss();}
    setTimeout(next,600);
  };

  if(done)return(
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:64,marginBottom:8}}>⚡</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#fbbf24",letterSpacing:2}}>ROUND COMPLETE</div>
      <div style={{fontSize:24,fontWeight:800,margin:"12px 0"}}>Score: {score}</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>✅ {hits} hits · ❌ {misses} misses · {Math.round(hits/(hits+misses||1)*100)}% accuracy</div>
      <button onClick={()=>onFinish(score)} style={{background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#07070f",border:"none",borderRadius:14,padding:"14px 32px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Continue →</button>
    </div>
  );

  if(!q)return null;
  return(
    <div style={{textAlign:"center",padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16,fontSize:14,fontFamily:"'Space Mono',monospace",color:"rgba(255,255,255,.5)"}}>
        <span>Q {idx+1}/{questions.length}</span><span style={{color:"#fbbf24",fontSize:18,fontWeight:800}}>⚡ {score}</span><span style={{color:"rgba(255,255,255,.3)"}}>Speed: {Math.round(showTime/100)/10}s</span>
      </div>
      <div style={{height:6,background:"rgba(255,255,255,.08)",borderRadius:100,overflow:"hidden",marginBottom:20}}>
        <div style={{height:"100%",background:"#fbbf24",borderRadius:100,width:`${(idx/questions.length)*100}%`,transition:"width .3s"}}/>
      </div>
      <div style={{fontSize:17,fontWeight:700,lineHeight:1.4,marginBottom:20,minHeight:60}}>{q.question}</div>
      {visible?(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {q.options?.map((opt,i)=>(
            <button key={i} onClick={()=>handleTap(opt)} style={{padding:"14px 12px",background:result==="hit"&&opt.startsWith(q.answer)?"rgba(52,211,153,.2)":"rgba(255,255,255,.06)",border:`1px solid ${result==="hit"&&opt.startsWith(q.answer)?"rgba(52,211,153,.5)":"rgba(255,255,255,.12)"}`,borderRadius:12,color:"#f0f0ff",cursor:"pointer",fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,transition:"all .15s",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,flexShrink:0}}>{LETTERS[i]}</span>
              {opt.replace(/^[A-D]\.\s*/,"")}
            </button>
          ))}
        </div>
      ):(
        <div style={{padding:32,textAlign:"center"}}>
          <div style={{fontSize:48}}>{result==="hit"?"✅":"❌"}</div>
          <div style={{fontSize:16,fontWeight:700,color:result==="hit"?"#34d399":"#f87171",marginTop:8}}>{result==="hit"?"HIT!":"MISSED!"}</div>
        </div>
      )}
    </div>
  );
}

// ── ARCADE: ANSWER BLITZ (Whack-a-mole) ─────────────────────────────────────
function AnswerBlitz({questions,onFinish}){
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [positions,setPositions]=useState([]);
  const [timeLeft,setTimeLeft]=useState(45);
  const [done,setDone]=useState(false);
  const [hits,setHits]=useState(0);
  const q=questions[idx];

  useEffect(()=>{
    if(done)return;
    const t=setInterval(()=>setTimeLeft(t=>{if(t<=1){setDone(true);return 0;}return t-1;}),1000);
    return()=>clearInterval(t);
  },[done]);

  useEffect(()=>{
    if(!q||done)return;
    const allOpts=q.options||[];
    const newPos=allOpts.map((opt,i)=>({opt,i,x:10+Math.random()*70,y:10+Math.random()*70,id:Date.now()+i}));
    setPositions(newPos);
  },[idx,done]);

  const handleClick=(opt)=>{
    const ok=opt.startsWith(q?.answer);
    if(ok){setScore(s=>s+15);setHits(h=>h+1);SFX.tap();if(idx+1<questions.length)setIdx(i=>i+1);else setDone(true);}
    else{setScore(s=>Math.max(0,s-5));SFX.miss();}
  };

  if(done)return(
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:64,marginBottom:8}}>💥</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#f87171",letterSpacing:2}}>BLITZ OVER!</div>
      <div style={{fontSize:24,fontWeight:800,margin:"12px 0"}}>Score: {score}</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>✅ {hits} correct answers</div>
      <button onClick={()=>onFinish(score)} style={{background:"linear-gradient(135deg,#f87171,#fb923c)",color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Continue →</button>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:14,fontFamily:"'Space Mono',monospace"}}>
        <span style={{color:"#f87171",fontSize:18,fontWeight:800}}>⏱ {timeLeft}s</span>
        <span style={{color:"#fbbf24",fontSize:18,fontWeight:800}}>💥 {score}</span>
      </div>
      <div style={{fontSize:15,fontWeight:700,textAlign:"center",marginBottom:12,padding:"10px",background:"rgba(255,255,255,.04)",borderRadius:12,lineHeight:1.4}}>{q?.question}</div>
      <div style={{position:"relative",height:280,background:"rgba(255,255,255,.02)",borderRadius:16,border:"1px solid rgba(255,255,255,.08)",overflow:"hidden"}}>
        {positions.map(p=>(
          <button key={p.id} onClick={()=>handleClick(p.opt)} style={{position:"absolute",left:`${p.x}%`,top:`${p.y}%`,transform:"translate(-50%,-50%)",padding:"8px 14px",background:"rgba(255,255,255,.08)",border:`1px solid ${p.opt.startsWith(q?.answer)?"rgba(52,211,153,.3)":"rgba(255,255,255,.15)"}`,borderRadius:10,color:"#f0f0ff",cursor:"pointer",fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap",transition:"all .15s",maxWidth:140,animation:"sr_pop .2s ease"}}>
            {p.opt.replace(/^[A-D]\.\s*/,"").slice(0,20)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ARCADE: AIM TRAINER ───────────────────────────────────────────────────────
function AimTrainer({questions,onFinish}){
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [targets,setTargets]=useState([]);
  const [done,setDone]=useState(false);
  const [hits,setHits]=useState(0);
  const [misses,setMisses]=useState(0);
  const animRef=useRef(null);
  const q=questions[idx];

  useEffect(()=>{
    if(!q||done)return;
    const allOpts=(q.options||[]).map((opt,i)=>({opt,i,x:10+Math.random()*80,y:10+Math.random()*70,vx:(Math.random()-.5)*0.3,vy:(Math.random()-.5)*0.2,id:Date.now()+i}));
    setTargets(allOpts);
  },[idx,done]);

  useEffect(()=>{
    if(done)return;
    animRef.current=setInterval(()=>{
      setTargets(ts=>ts.map(t=>{
        let nx=t.x+t.vx;let ny=t.y+t.vy;
        if(nx<5||nx>90){t.vx*=-1;nx=t.x+t.vx;}
        if(ny<5||ny>80){t.vy*=-1;ny=t.y+t.vy;}
        return{...t,x:nx,y:ny};
      }));
    },50);
    return()=>clearInterval(animRef.current);
  },[done]);

  const handleClick=(opt)=>{
    const ok=opt.startsWith(q?.answer);
    if(ok){setScore(s=>s+20);setHits(h=>h+1);SFX.tap();if(idx+1<questions.length)setIdx(i=>i+1);else setDone(true);}
    else{setScore(s=>Math.max(0,s-8));setMisses(m=>m+1);SFX.miss();}
  };

  if(done)return(
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:64,marginBottom:8}}>🎯</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#fb923c",letterSpacing:2}}>MISSION COMPLETE</div>
      <div style={{fontSize:24,fontWeight:800,margin:"12px 0"}}>Score: {score}</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>🎯 {hits} hits · ❌ {misses} misses · {Math.round(hits/(hits+misses||1)*100)}% accuracy</div>
      <button onClick={()=>onFinish(score)} style={{background:"linear-gradient(135deg,#fb923c,#f87171)",color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Continue →</button>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:14,fontFamily:"'Space Mono',monospace"}}>
        <span>Q {idx+1}/{questions.length}</span><span style={{color:"#fb923c",fontSize:18,fontWeight:800}}>🎯 {score}</span><span>Acc: {hits+misses>0?Math.round(hits/(hits+misses)*100):100}%</span>
      </div>
      <div style={{fontSize:15,fontWeight:700,textAlign:"center",marginBottom:12,padding:"10px",background:"rgba(255,255,255,.04)",borderRadius:12,lineHeight:1.4}}>{q?.question}</div>
      <div style={{position:"relative",height:280,background:"rgba(255,255,255,.02)",borderRadius:16,border:"1px solid rgba(255,255,255,.08)",overflow:"hidden",cursor:"crosshair"}}>
        {targets.map(t=>{
          const isCorrect=t.opt.startsWith(q?.answer);
          return(
            <button key={t.id} onClick={()=>handleClick(t.opt)} style={{position:"absolute",left:`${t.x}%`,top:`${t.y}%`,transform:"translate(-50%,-50%)",width:isCorrect?52:44,height:isCorrect?52:44,borderRadius:"50%",background:isCorrect?"rgba(52,211,153,.15)":"rgba(248,113,113,.1)",border:`2px solid ${isCorrect?"rgba(52,211,153,.5)":"rgba(248,113,113,.3)"}`,color:isCorrect?"#34d399":"#f87171",cursor:"crosshair",fontFamily:"'Space Mono',monospace",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:4,lineHeight:1.2,boxShadow:isCorrect?"0 0 12px rgba(52,211,153,.2)":"none"}}>
              {LETTERS[t.i]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── ARCADE: RHYTHM REVIEW ─────────────────────────────────────────────────────
function RhythmReview({questions,onFinish}){
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [falling,setFalling]=useState([]);
  const [done,setDone]=useState(false);
  const [hits,setHits]=useState(0);
  const [beat,setBeat]=useState(0);
  const q=questions[idx];
  const BPM=90;const beatMs=60000/BPM;

  useEffect(()=>{
    if(done)return;
    const b=setInterval(()=>{setBeat(b=>b+1);SFX.tick();},beatMs);
    return()=>clearInterval(b);
  },[done]);

  useEffect(()=>{
    if(!q||done)return;
    const opts=(q.options||[]).map((opt,i)=>({opt,i,id:Date.now()+i,y:-10,speed:1.5+Math.random(),x:10+i*22}));
    setFalling(opts);
  },[idx,done]);

  useEffect(()=>{
    if(done)return;
    const t=setInterval(()=>{
      setFalling(fs=>{
        const moved=fs.map(f=>({...f,y:f.y+f.speed}));
        const missed=moved.filter(f=>f.y>100);
        if(missed.some(f=>f.opt.startsWith(q?.answer))){setIdx(i=>{if(i+1>=questions.length){setDone(true);}return i+1;});SFX.miss();}
        return moved.filter(f=>f.y<=100);
      });
    },50);
    return()=>clearInterval(t);
  },[q,done]);

  const handleClick=(opt)=>{
    const ok=opt.startsWith(q?.answer);
    if(ok){setScore(s=>s+12);setHits(h=>h+1);SFX.tap();if(idx+1<questions.length)setIdx(i=>i+1);else setDone(true);}
    else{setScore(s=>Math.max(0,s-5));SFX.miss();}
  };

  if(done)return(
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:64,marginBottom:8}}>🎵</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#34d399",letterSpacing:2}}>RHYTHM MASTER!</div>
      <div style={{fontSize:24,fontWeight:800,margin:"12px 0"}}>Score: {score}</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>🎵 {hits} on beat · Accuracy: {Math.round(hits/(questions.length||1)*100)}%</div>
      <button onClick={()=>onFinish(score)} style={{background:"linear-gradient(135deg,#34d399,#059669)",color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Continue →</button>
    </div>
  );

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:14,fontFamily:"'Space Mono',monospace"}}>
        <span>Q {idx+1}/{questions.length}</span><span style={{color:"#34d399",fontSize:18,fontWeight:800}}>🎵 {score}</span><span style={{color:beat%2===0?"#34d399":"rgba(255,255,255,.3)",transition:"color .1s"}}>♪</span>
      </div>
      <div style={{fontSize:14,fontWeight:700,textAlign:"center",marginBottom:8,padding:"8px",background:"rgba(255,255,255,.04)",borderRadius:10,lineHeight:1.4}}>{q?.question}</div>
      <div style={{position:"relative",height:240,background:"rgba(255,255,255,.02)",borderRadius:16,border:"1px solid rgba(255,255,255,.08)",overflow:"hidden"}}>
        {/* Beat line */}
        <div style={{position:"absolute",bottom:"15%",left:0,right:0,height:2,background:"rgba(52,211,153,.3)",zIndex:1}}/>
        {falling.map(f=>(
          <button key={f.id} onClick={()=>handleClick(f.opt)} style={{position:"absolute",left:`${f.x}%`,top:`${f.y}%`,transform:"translateX(-50%)",padding:"8px 12px",background:f.opt.startsWith(q?.answer)?"rgba(52,211,153,.15)":"rgba(255,255,255,.06)",border:`1px solid ${f.opt.startsWith(q?.answer)?"rgba(52,211,153,.4)":"rgba(255,255,255,.15)"}`,borderRadius:10,color:"#f0f0ff",cursor:"pointer",fontFamily:"'Sora',sans-serif",fontSize:11,fontWeight:700,whiteSpace:"nowrap",boxShadow:f.opt.startsWith(q?.answer)?"0 0 8px rgba(52,211,153,.2)":"none"}}>
            {f.opt.replace(/^[A-D]\.\s*/,"").slice(0,16)}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        {q?.options?.map((opt,i)=>(
          <button key={i} onClick={()=>handleClick(opt)} style={{flex:1,padding:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace"}}>
            {LETTERS[i]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ARCADE: SPEED RUN ─────────────────────────────────────────────────────────
function SpeedRun({questions,onFinish}){
  const [idx,setIdx]=useState(0);
  const [score,setScore]=useState(0);
  const [speed,setSpeed]=useState(30);
  const [progress,setProgress]=useState(0);
  const [done,setDone]=useState(false);
  const [feedback,setFeedback]=useState(null);
  const q=questions[idx];

  useEffect(()=>{
    if(done)return;
    const t=setInterval(()=>setProgress(p=>{if(p>=100){setDone(true);return 100;}return p+(speed/1000);}),16);
    return()=>clearInterval(t);
  },[speed,done]);

  const handleAnswer=(opt)=>{
    const ok=opt.startsWith(q?.answer);
    if(ok){setScore(s=>s+Math.round(speed));setSpeed(s=>Math.min(s+5,80));SFX.tap();setFeedback({ok:true,text:"BOOST! 🚀"});}
    else{setSpeed(s=>Math.max(s-10,10));SFX.miss();setFeedback({ok:false,text:"BRAKE! 🛑"});}
    setTimeout(()=>{setFeedback(null);if(idx+1<questions.length)setIdx(i=>i+1);else setDone(true);},500);
  };

  if(done)return(
    <div style={{textAlign:"center",padding:32}}>
      <div style={{fontSize:64,marginBottom:8}}>🏎️</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:40,color:"#60a5fa",letterSpacing:2}}>FINISH LINE!</div>
      <div style={{fontSize:24,fontWeight:800,margin:"12px 0"}}>Score: {score}</div>
      <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:24}}>Max speed: {Math.round(speed)} · {questions.length} questions answered</div>
      <button onClick={()=>onFinish(score)} style={{background:"linear-gradient(135deg,#60a5fa,#818cf8)",color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>Continue →</button>
    </div>
  );

  return(
    <div>
      {/* Road */}
      <div style={{position:"relative",height:80,background:"rgba(255,255,255,.03)",borderRadius:12,marginBottom:16,overflow:"hidden",border:"1px solid rgba(255,255,255,.08)"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(255,255,255,.05) 40px,rgba(255,255,255,.05) 42px)",animation:"sr_grid 1s linear infinite"}}/>
        <div style={{position:"absolute",top:"50%",left:`${progress}%`,transform:"translate(-50%,-50%)",fontSize:28,transition:"left .05s linear"}}>🏎️</div>
        <div style={{position:"absolute",top:"50%",right:8,transform:"translateY(-50%)",fontSize:20}}>🏁</div>
      </div>
      {/* Speed meter */}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontFamily:"'Space Mono',monospace",fontSize:12}}>
        <span>Speed: <strong style={{color:speed>50?"#34d399":speed>30?"#fbbf24":"#f87171"}}>{Math.round(speed)} km/h</strong></span>
        <span style={{color:"#60a5fa",fontWeight:800,fontSize:16}}>🏎️ {score}</span>
        <span>Q {idx+1}/{questions.length}</span>
      </div>
      <div style={{fontSize:15,fontWeight:700,textAlign:"center",marginBottom:12,padding:"10px",background:"rgba(255,255,255,.04)",borderRadius:12}}>{q?.question}</div>
      {feedback?(
        <div style={{textAlign:"center",padding:20,fontSize:24,fontWeight:800,color:feedback.ok?"#34d399":"#f87171",animation:"sr_pop .3s ease"}}>{feedback.text}</div>
      ):(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {q?.options?.map((opt,i)=>(
            <button key={i} onClick={()=>handleAnswer(opt)} style={{padding:"12px 14px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,color:"#f0f0ff",cursor:"pointer",fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,textAlign:"left",transition:"all .15s",display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,flexShrink:0}}>{LETTERS[i]}</span>
              {opt.replace(/^[A-D]\.\s*/,"")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function StudyRush(){
  // Persistent state
  const [totalXp,setTotalXp]         = useState(()=>LS.get("sr_xp",0));
  const [dayStreak,setDayStreak]     = useState(()=>LS.get("sr_streak",0));
  const [history,setHistory]         = useState(()=>LS.get("sr_hist",[]));
  const [library,setLibrary]         = useState(()=>LS.get("sr_lib",[])); // saved study sets
  const [recentFiles,setRecentFiles] = useState(()=>LS.get("sr_files",[]));
  const [dna,setDna]                 = useState(()=>LS.get("sr_dna",{}));
  const [earnedBadges,setEarnedBadges] = useState(()=>LS.get("sr_badges",[]));
  const [arcadeScores,setArcadeScores] = useState(()=>LS.get("sr_arcade",{}));

  // UI
  const [section,setSection]         = useState("lobby"); // lobby | study | arcade | library | profile
  const [screen,setScreen]           = useState("lobby"); // lobby | setup | loading | game | boss | results | mindmap | arcadeGame
  const [setupStep,setSetupStep]     = useState(0);
  const [activeArcadeGame,setActiveArcadeGame] = useState(null);
  const [arcadeGameScore,setArcadeGameScore]   = useState(0);

  // Config
  const [tutor,setTutor]             = useState(TUTORS[0]);
  const [mode,setMode]               = useState(MODES[0]);
  const [style,setStyle]             = useState(STYLES[4]);
  const [inputTab,setInputTab]       = useState("text");
  const [notes,setNotes]             = useState("");
  const [fileText,setFileText]       = useState("");
  const [fileName,setFileName]       = useState("");
  const [ytUrl,setYtUrl]             = useState("");
  const [qCount,setQCount]           = useState("10");
  const [diff,setDiff]               = useState("medium");
  const [dragOver,setDragOver]       = useState(false);

  // Game state
  const [questions,setQuestions]     = useState([]);
  const [topic,setTopic]             = useState("");
  const [qIdx,setQIdx]               = useState(0);
  const [answered,setAnswered]       = useState(false);
  const [selected,setSelected]       = useState(null);
  const [shortVal,setShortVal]       = useState("");
  const [feedback,setFeedback]       = useState(null);
  const [checking,setChecking]       = useState(false);
  const [showHint,setShowHint]       = useState(false);
  const [shakeQ,setShakeQ]           = useState(false);
  const [flashScreen,setFlashScreen] = useState(null);
  const [personaMsg,setPersonaMsg]   = useState(null);
  const [loadStep,setLoadStep]       = useState(0);
  const [loadMsg,setLoadMsg]         = useState("");
  const [eliminated,setEliminated]   = useState([]);
  const [listening,setListening]     = useState(false);
  const [mindMapData,setMindMapData] = useState(null);
  const [showMindMap,setShowMindMap] = useState(false);
  const [roomCode,setRoomCode]       = useState(null);

  // Score
  const [score,setScore]             = useState(0);
  const [xp,setXp]                   = useState(0);
  const [streak,setStreak]           = useState(0);
  const [bestStreak,setBestStreak]   = useState(0);
  const [lives,setLives]             = useState(3);
  const [missedQs,setMissedQs]       = useState([]);
  const [wrongTexts,setWrongTexts]   = useState([]);
  const [blitzTime,setBlitzTime]     = useState(60);

  // Effects
  const [particles,setParticles]     = useState(null);
  const [xpPop,setXpPop]             = useState(null);
  const [streakPop,setStreakPop]     = useState(false);
  const [jackpotPop,setJackpotPop]   = useState(false);
  const [lvlUpPop,setLvlUpPop]       = useState(false);
  const [killFeed,setKillFeed]       = useState([]);

  // Boss
  const [bossQs,setBossQs]           = useState([]);
  const [bossIdx,setBossIdx]         = useState(0);
  const [bossHp,setBossHp]           = useState(100);
  const [bossSel,setBossSel]         = useState(null);
  const [bossAns,setBossAns]         = useState(false);
  const [bossFb,setBossFb]           = useState(null);
  const [bossScore,setBossScore]     = useState(0);

  // Timer
  const [timeLeft,setTimeLeft]       = useState(100);
  const [timerActive,setTimerActive] = useState(false);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const TIME = mode?.timeLimit||30;

  // TTS for auditory
  useEffect(()=>{if(style?.id==="auditory"&&questions[qIdx]&&screen==="game"&&!answered)SFX.tts(questions[qIdx].question);},[qIdx,screen,style]);

  // Timer
  useEffect(()=>{
    if(!timerActive||mode?.timeLimit===0)return;
    if(mode?.blitz){timerRef.current=setInterval(()=>setBlitzTime(t=>{if(t<=1){clearInterval(timerRef.current);finishQuiz();return 0;}return t-1;}),1000);return()=>clearInterval(timerRef.current);}
    timerRef.current=setInterval(()=>setTimeLeft(t=>{const n=t-(100/(TIME*10));if(n<=20&&n>19.9)SFX.danger();if(n<=10&&Math.floor(n*10)%3===0)SFX.tick();if(n<=0){clearInterval(timerRef.current);handleTimeout();return 0;}return Math.max(0,n);}),100);
    return()=>clearInterval(timerRef.current);
  },[timerActive,qIdx]);

  const handleTimeout=useCallback(()=>{
    if(answered)return;const q=questions[qIdx];
    setAnswered(true);setTimerActive(false);setStreak(0);
    setFeedback({ok:false,text:"⏰ Time's up! "+q?.explanation});
    setShakeQ(true);setTimeout(()=>setShakeQ(false),500);flashSc("red");SFX.wrong();
    setMissedQs(p=>[...p,q?.id]);setWrongTexts(p=>[...p,q?.question||""]);
    if(mode?.id==="survival")setLives(l=>{const nl=l-1;if(nl<=0)setTimeout(finishQuiz,1500);return nl;});
  },[answered,questions,qIdx,mode]);

  const flashSc=(col)=>{setFlashScreen(col);setTimeout(()=>setFlashScreen(null),400);};
  const addKF=(text,col)=>{const id=Date.now();setKillFeed(f=>[{id,text,col},...f].slice(0,4));setTimeout(()=>setKillFeed(f=>f.filter(x=>x.id!==id)),3000);};

  const readFile=useCallback((file)=>{
    const reader=new FileReader();
    reader.onload=e=>{const text=e.target.result;setFileText(text);setFileName(file.name);const entry={name:file.name,text:text.slice(0,500),ts:Date.now()};const updated=[entry,...recentFiles.filter(f=>f.name!==file.name)].slice(0,8);setRecentFiles(updated);LS.set("sr_files",updated);SFX.click();};
    reader.readAsText(file);
  },[recentFiles]);

  const handleDrop=useCallback(e=>{e.preventDefault();setDragOver(false);const file=e.dataTransfer.files[0];if(file)readFile(file);},[readFile]);

  const handleGenerate=async(savedNotes=null,savedTopic=null)=>{
    const content=savedNotes||(inputTab==="text"?notes:inputTab==="file"?fileText:`Questions about: ${ytUrl}`);
    if(!content.trim())return;
    SFX.click();setScreen("loading");setLoadStep(0);setLoadMsg("Analyzing your material…");
    setScore(0);setXp(0);setStreak(0);setBestStreak(0);setMissedQs([]);setWrongTexts([]);setQIdx(0);
    setAnswered(false);setFeedback(null);setSelected(null);setPersonaMsg(null);setEliminated([]);setLives(mode?.lives||3);setBlitzTime(60);setMindMapData(null);setShowMindMap(false);
    const steps=["Analyzing your material…","Crafting personalized questions…","Calibrating for your mode & style…","Preparing your arena…"];
    for(let i=0;i<steps.length-1;i++){setLoadStep(i);setLoadMsg(steps[i]);await new Promise(r=>setTimeout(r,500));}
    try{
      const result=await genQs(content,parseInt(qCount),diff,tutor,style);
      setQuestions(result.questions);setTopic(savedTopic||result.topic||"Your Notes");
      // Save to library
      const libEntry={id:Date.now(),topic:savedTopic||result.topic||"Your Notes",notes:content.slice(0,1000),questions:result.questions,ts:Date.now()};
      const newLib=[libEntry,...library.filter(l=>l.topic!==libEntry.topic)].slice(0,20);
      setLibrary(newLib);LS.set("sr_lib",newLib);
      setLoadStep(3);await new Promise(r=>setTimeout(r,400));
      setTimeLeft(100);setTimerActive(true);setScreen("game");setSection("study");
    }catch(e){alert("Error: "+e.message);setScreen("setup");setSetupStep(3);}
  };

  const calcXP=(ok,tl)=>{
    if(!ok)return 0;const base=diff==="easy"?8:diff==="hard"?22:14;const tb=mode?.timeLimit?Math.floor((tl/100)*8):0;const sm=streak>=5?3:streak>=3?2:1;const mm=mode?.id==="ranked"?1.5:mode?.id==="blitz"?2:mode?.id==="survival"?1.8:1;return Math.round((base+tb)*sm*mm);
  };

  const processResult=async(ok,earned,qId,expl,qText,visualCue)=>{
    if(ok){
      setScore(s=>s+1);setXp(x=>x+earned);
      const newTotal=totalXp+earned;const oldLv=getLevel(totalXp);const newLv=getLevel(newTotal);
      setTotalXp(newTotal);LS.set("sr_xp",newTotal);
      if(newLv.name!==oldLv.name){setLvlUpPop(true);SFX.levelUp();setParticles("level");setTimeout(()=>{setLvlUpPop(false);setParticles(null);},2800);}
      if(Math.random()<.04){setJackpotPop(true);SFX.jackpot();setParticles("jackpot");showXP("🎰 JACKPOT! ×3!");addKF("🎰 JACKPOT!","#fbbf24");setTimeout(()=>{setJackpotPop(false);setParticles(null);},2200);}
      else{showXP(`+${earned} XP${visualCue?" "+visualCue:""}`);setParticles("correct");setTimeout(()=>setParticles(null),1200);}
      setStreak(s=>{const ns=s+1;if(ns>bestStreak)setBestStreak(ns);if(ns>0&&ns%3===0){setStreakPop(true);SFX.streak();addKF(`🔥 ${ns} STREAK!`,"#fb923c");setTimeout(()=>setStreakPop(false),1800);}return ns;});
      SFX.correct();flashSc("green");setFeedback({ok:true,text:"✅ "+expl});
      addKF(`✅ CORRECT! +${earned} XP`,"#34d399");
      if(style?.id==="auditory")SFX.tts("Correct! "+expl.slice(0,50));
    }else{
      setStreak(0);setMissedQs(p=>[...p,qId]);setWrongTexts(p=>[...p,qText||""]);
      SFX.wrong();setShakeQ(true);setTimeout(()=>setShakeQ(false),500);flashSc("red");
      setParticles("wrong");setTimeout(()=>setParticles(null),800);
      setFeedback({ok:false,text:"❌ "+expl});addKF("❌ ELIMINATED","#f87171");
      if(style?.id==="auditory")SFX.tts("Incorrect. "+expl.slice(0,50));
      if(mode?.id==="survival")setLives(l=>{const nl=l-1;if(nl<=0)setTimeout(finishQuiz,1500);return nl;});
    }
    setDna(d=>{const nd={...d};nd[topic]={correct:(nd[topic]?.correct||0)+(ok?1:0),total:(nd[topic]?.total||0)+1};LS.set("sr_dna",nd);return nd;});
    if(tutor){try{const msg=await personaReact(tutor,ok,streak+(ok?1:0),qText||"the question");setPersonaMsg(msg);}catch{}}
  };

  const showXP=txt=>{setXpPop(txt);setTimeout(()=>setXpPop(null),1000);};

  const handleMC=async(opt,idx)=>{
    if(answered||eliminated.includes(idx))return;SFX.select();
    clearInterval(timerRef.current);setTimerActive(false);
    setSelected(idx);setAnswered(true);const q=questions[qIdx];const ok=opt.startsWith(q.answer);
    await processResult(ok,calcXP(ok,timeLeft),q.id,q.explanation,q.question,q.visual_cue);
  };
  const handleTF=async val=>{
    if(answered)return;SFX.select();clearInterval(timerRef.current);setTimerActive(false);
    setSelected(val);setAnswered(true);const q=questions[qIdx];const ok=val===q.answer;
    await processResult(ok,calcXP(ok,timeLeft),q.id,q.explanation,q.question,q.visual_cue);
  };
  const handleShort=async()=>{
    if(!shortVal.trim()||answered)return;SFX.select();clearInterval(timerRef.current);setTimerActive(false);
    setChecking(true);const q=questions[qIdx];
    try{const res=await checkShort(q.question,q.answer,shortVal);setChecking(false);setAnswered(true);await processResult(res.correct,calcXP(res.correct,timeLeft),q.id,res.feedback,q.question,q.visual_cue);}
    catch{setChecking(false);setAnswered(true);await processResult(false,0,q?.id,"Could not verify.",q?.question);}
  };

  // Voice answer
  const handleVoice=()=>{
    if(!('webkitSpeechRecognition' in window||'SpeechRecognition' in window)){alert("Voice not supported in this browser. Try Chrome!");return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const r=new SR();r.continuous=false;r.interimResults=false;r.lang='en-US';
    r.onstart=()=>setListening(true);
    r.onresult=(e)=>{setListening(false);const t=e.results[0][0].transcript;setShortVal(t);};
    r.onerror=()=>setListening(false);
    r.onend=()=>setListening(false);
    r.start();recognitionRef.current=r;
  };

  const nextQ=()=>{
    clearInterval(timerRef.current);const next=qIdx+1;
    if(next>=questions.length){finishQuiz();return;}
    SFX.swoosh();setQIdx(next);setAnswered(false);setSelected(null);setFeedback(null);
    setShortVal("");setShowHint(false);setPersonaMsg(null);setEliminated([]);
    if(!mode?.blitz){setTimeLeft(100);setTimerActive(true);}
  };

  const finishQuiz=async()=>{
    clearInterval(timerRef.current);
    const entry={topic,score,total:questions.length,xp,diff,mode:mode?.id,ts:Date.now(),streak:bestStreak};
    const newHist=[entry,...history].slice(0,50);setHistory(newHist);LS.set("sr_hist",newHist);
    const today=new Date().toDateString();
    if(LS.get("sr_lastday","")!==today){const ns=dayStreak+1;setDayStreak(ns);LS.set("sr_streak",ns);LS.set("sr_lastday",today);}
    // Generate mind map
    try{const mm=await genMindMap(topic,questions.slice(0,8));setMindMapData(mm);}catch{}
    setScreen("results");
  };

  const startBoss=async()=>{
    SFX.boss();setScreen("loading");setLoadStep(2);setLoadMsg("Summoning the boss…");
    try{const res=await genBoss(topic,wrongTexts);setBossQs(res.questions);setBossIdx(0);setBossHp(100);setBossScore(0);setBossAns(false);setBossSel(null);setBossFb(null);setScreen("boss");}
    catch(e){alert("Boss error: "+e.message);setScreen("results");}
  };

  const handleBossMC=(opt,idx)=>{
    if(bossAns)return;SFX.select();setBossSel(idx);setBossAns(true);
    const q=bossQs[bossIdx];const ok=opt.startsWith(q.answer);
    if(ok){setBossScore(s=>s+1);setBossHp(h=>Math.max(0,h-34));SFX.correct();setBossFb({ok:true,text:"⚔️ HIT! "+q.explanation});setParticles("boss");setTimeout(()=>setParticles(null),1200);}
    else{SFX.wrong();setBossFb({ok:false,text:"💀 Miss! "+q.explanation});}
  };

  const nextBossQ=()=>{
    const next=bossIdx+1;
    if(next>=bossQs.length){
      const won=bossScore>=2;
      if(won){SFX.jackpot();setParticles("jackpot");setTotalXp(t=>{const nv=t+150;LS.set("sr_xp",nv);return nv;});showXP("+150 BOSS XP!");}
      setTimeout(()=>setParticles(null),2500);setScreen("results");return;
    }
    setBossIdx(next);setBossAns(false);setBossSel(null);setBossFb(null);
  };

  // Arcade
  const launchArcadeGame=(game,savedQuestions)=>{
    SFX.arcade();setActiveArcadeGame({game,questions:savedQuestions||questions});setArcadeGameScore(0);setScreen("arcadeGame");
  };

  const handleArcadeFinish=(finalScore)=>{
    setArcadeGameScore(finalScore);
    const newScores={...arcadeScores,[activeArcadeGame?.game?.id]:Math.max(arcadeScores[activeArcadeGame?.game?.id]||0,finalScore)};
    setArcadeScores(newScores);LS.set("sr_arcade",newScores);
    const bonus=Math.round(finalScore/10);setTotalXp(t=>{const nv=t+bonus;LS.set("sr_xp",nv);return nv;});
    setParticles("arcade");setTimeout(()=>setParticles(null),2000);
    setScreen("arcadeDone");
  };

  // Report card
  const generateReportCard=()=>{
    const pct=Math.round((score/questions.length)*100);const g=gradeOf(pct);const lv=getLevel(totalXp);
    const text=`📊 STUDYRUSH REPORT CARD\n\n👤 Level: ${lv.name} (${totalXp.toLocaleString()} XP)\n📖 Topic: ${topic}\n✅ Score: ${score}/${questions.length} (${pct}%) — ${g.l}\n🔥 Best Streak: ${bestStreak}\n📅 Day Streak: ${dayStreak}\n🎭 Tutor: ${tutor?.name}\n⚔️ Mode: ${mode?.name}\n\n${g.m}\nPlay at studyrush.app`;
    navigator.clipboard.writeText(text);SFX.badge();alert("📋 Report card copied to clipboard!");
  };

  // Share profile
  const shareProfile=()=>{
    const lv=getLevel(totalXp);
    const text=`🎮 My StudyRush Profile\n\n⚡ ${totalXp.toLocaleString()} XP · ${lv.name}\n🔥 ${dayStreak} day streak\n📚 ${history.length} sessions\n🏆 ${earnedBadges.length} badges\n\nstudyrush.app`;
    navigator.clipboard.writeText(text);SFX.badge();alert("👤 Profile copied!");
  };

  const lv=getLevel(totalXp);const nlv=getNext(totalXp);const lvPct=nlv?Math.round(((totalXp-lv.xp)/(nlv.xp-lv.xp))*100):100;
  const q=questions[qIdx];const pct=questions.length?Math.round((score/questions.length)*100):0;const gr=gradeOf(pct);
  const modeCol=mode?.col||"#fbbf24";

  // ── NAV ──
  const Nav=()=>(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:600,background:"rgba(7,7,15,.9)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,.07)",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:18,background:"linear-gradient(90deg,#fbbf24,#a78bfa,#34d399)",backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"sr_grd 4s ease infinite",cursor:"pointer"}} onClick={()=>{setScreen("lobby");setSection("lobby");}}>StudyRush</div>
      <div style={{display:"flex",gap:4}}>
        {[{id:"study",icon:"📚",label:"Study"},{id:"arcade",icon:"🕹️",label:"Arcade"},{id:"library",icon:"📖",label:"Library"},{id:"profile",icon:"👤",label:"Profile"}].map(s=>(
          <button key={s.id} onClick={()=>{SFX.click();setSection(s.id);setScreen(s.id);}} style={{padding:"6px 10px",borderRadius:9,border:section===s.id?"1px solid rgba(251,191,36,.4)":"1px solid transparent",background:section===s.id?"rgba(251,191,36,.1)":"transparent",color:section===s.id?"#fbbf24":"rgba(255,255,255,.4)",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Sora',sans-serif",transition:"all .2s"}}>
            {s.icon} {s.label}
          </button>
        ))}
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
        <div style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(251,191,36,.2)",borderRadius:100,padding:"3px 9px",fontSize:10,fontFamily:"'Space Mono',monospace",color:"#fbbf24"}}>⚡{totalXp.toLocaleString()}</div>
        <div style={{background:"rgba(255,255,255,.05)",border:`1px solid ${lv.col}33`,borderRadius:100,padding:"3px 9px",fontSize:10,fontFamily:"'Space Mono',monospace",color:lv.col}}>{lv.name}</div>
      </div>
    </div>
  );

  const Wrap=({children,pad=true})=>(
    <div style={{minHeight:"100vh",position:"relative",zIndex:10,paddingTop:60,...(pad?{padding:"72px 18px 32px"}:{})}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>{children}</div>
    </div>
  );

  const GlassCard=({children,style:s={}})=>(
    <div style={{background:"rgba(255,255,255,.04)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:20,marginBottom:14,position:"relative",overflow:"hidden",...s}}>
      {children}
    </div>
  );

  const Btn=({children,onClick,col="#fbbf24",disabled=false,style:s={}})=>(
    <button onClick={onClick} disabled={disabled} style={{background:`linear-gradient(135deg,${col},${col}cc)`,color:col==="#fbbf24"?"#07070f":"#fff",border:"none",borderRadius:12,padding:"13px 20px",fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1,transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6,...s}}>
      {children}
    </button>
  );

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');
        @keyframes sr_fall{0%{opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes sr_up{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sr_pop{from{opacity:0;transform:scale(.4) rotate(-8deg)}to{opacity:1;transform:scale(1) rotate(0)}}
        @keyframes sr_spin{to{transform:rotate(360deg)}}
        @keyframes sr_pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.04)}}
        @keyframes sr_shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-12px)}40%{transform:translateX(12px)}60%{transform:translateX(-7px)}80%{transform:translateX(7px)}}
        @keyframes sr_float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes sr_xp{0%{opacity:1;transform:translateY(0) scale(1)}100%{opacity:0;transform:translateY(-90px) scale(1.4)}}
        @keyframes sr_grd{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes sr_grid{from{background-position:0 0}to{background-position:80px 80px}}
        @keyframes sr_orb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-30px) scale(1.1)}}
        @keyframes sr_scan{0%{top:0}100%{top:100%}}
        @keyframes sr_killfeed{0%{opacity:0;transform:translateX(100%)}10%{opacity:1;transform:translateX(0)}80%{opacity:1}100%{opacity:0;transform:translateX(100%)}}
        @keyframes sr_streak{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.15) scaleX(.9)}}
        @keyframes sr_bossIn{0%{opacity:0;transform:scale(2.5) rotate(-10deg)}70%{transform:scale(.93)}100%{opacity:1;transform:scale(1)}}
        @keyframes sr_feedin{from{opacity:0;transform:scale(.97) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes sr_tutorin{from{opacity:0;transform:translateX(-20px) scale(.9)}to{opacity:1;transform:translateX(0) scale(1)}}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body,#root{height:100%;background:#07070f;color:#f0f0ff;font-family:'Sora',sans-serif;overflow-x:hidden}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:rgba(255,255,255,.04)}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
        input,textarea,select{color:#f0f0ff}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,.3)}
      `}</style>

      <div style={{minHeight:"100vh",position:"relative",overflow:"hidden"}}>
        <GameBG col={modeCol}/>

        {/* Screen flash */}
        {flashScreen&&<div style={{position:"fixed",inset:0,zIndex:9990,pointerEvents:"none",background:flashScreen==="green"?"rgba(52,211,153,.12)":"rgba(248,113,113,.12)",animation:"sr_pulse .4s ease"}}/>}

        {particles&&<Particles type={particles} active/>}

        {/* XP popup */}
        {xpPop&&<div style={{position:"fixed",top:80,right:24,zIndex:9000,fontFamily:"'Sora',sans-serif",fontSize:26,fontWeight:900,color:"#fbbf24",textShadow:"0 0 20px rgba(251,191,36,.7)",pointerEvents:"none",animation:"sr_xp .9s ease-out forwards",whiteSpace:"nowrap"}}>{xpPop}</div>}

        {/* Kill feed */}
        <div style={{position:"fixed",top:80,right:16,zIndex:8000,display:"flex",flexDirection:"column",gap:6,pointerEvents:"none"}}>
          {killFeed.map(k=><div key={k.id} style={{background:"rgba(0,0,0,.8)",backdropFilter:"blur(10px)",border:`1px solid ${k.col||"rgba(255,255,255,.1)"}40`,borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,color:k.col||"#fff",fontFamily:"'Space Mono',monospace",animation:"sr_killfeed 3s ease forwards",whiteSpace:"nowrap"}}>{k.text}</div>)}
        </div>

        {/* Overlays */}
        {streakPop&&<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9500,pointerEvents:"none"}}><div style={{background:"rgba(10,10,20,.95)",border:"2px solid rgba(251,191,36,.4)",borderRadius:24,padding:"32px 52px",textAlign:"center",animation:"sr_pop .4s cubic-bezier(.34,1.56,.64,1)"}}><div style={{fontSize:52,marginBottom:8,animation:"sr_streak 1s ease-in-out infinite"}}>🔥</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:2,color:"#fb923c"}}>{streak} IN A ROW!</div></div></div>}
        {jackpotPop&&<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9600,background:"rgba(7,7,15,.7)",backdropFilter:"blur(6px)"}}><div style={{background:"rgba(10,10,20,.98)",border:"2px solid rgba(251,191,36,.5)",borderRadius:24,padding:"40px 60px",textAlign:"center",animation:"sr_pop .5s cubic-bezier(.34,1.56,.64,1)"}}><div style={{fontSize:56,marginBottom:10}}>🎰</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:3,color:"#fbbf24"}}>JACKPOT! ×3 XP!</div></div></div>}
        {lvlUpPop&&<div style={{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:9500,pointerEvents:"none"}}><div style={{background:"rgba(10,10,20,.95)",border:"2px solid rgba(192,132,252,.4)",borderRadius:24,padding:"32px 52px",textAlign:"center",animation:"sr_pop .4s cubic-bezier(.34,1.56,.64,1)"}}><div style={{fontSize:52,marginBottom:8}}>⬆️</div><div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:2,color:lv.col}}>LEVEL UP!</div><div style={{fontSize:18,color:lv.col,fontWeight:700,marginTop:4}}>{lv.name}</div></div></div>}

        {/* ── LOBBY ── */}
        {screen==="lobby"&&(
          <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:10}}>
            <div style={{marginBottom:8,animation:"sr_float 4s ease-in-out infinite"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(72px,12vw,120px)",letterSpacing:8,lineHeight:.9,background:"linear-gradient(90deg,#fbbf24,#f87171,#c084fc,#60a5fa,#fbbf24)",backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"sr_grd 4s ease infinite",filter:"drop-shadow(0 0 30px rgba(251,191,36,.3))"}}>
                STUDY<br/>RUSH
              </div>
            </div>
            <div style={{fontSize:14,color:"rgba(255,255,255,.4)",letterSpacing:4,textTransform:"uppercase",fontFamily:"'Space Mono',monospace",marginBottom:40}}>The Ultimate Study Game</div>
            <div style={{display:"flex",gap:10,marginBottom:48,flexWrap:"wrap",justifyContent:"center"}}>
              {[{l:"Total XP",v:totalXp.toLocaleString(),c:"#fbbf24"},{l:"Level",v:lv.name,c:lv.col},{l:"Day Streak",v:`${dayStreak}🔥`,c:"#fb923c"},{l:"Sessions",v:history.length,c:"#60a5fa"}].map(s=>(
                <div key={s.l} style={{background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"12px 20px",textAlign:"center",backdropFilter:"blur(10px)"}}>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".1em",fontFamily:"'Space Mono',monospace",marginBottom:4}}>{s.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>{SFX.click();setSetupStep(0);setScreen("setup");setSection("study");}} style={{background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#07070f",border:"none",borderRadius:20,padding:"20px 64px",fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,cursor:"pointer",marginBottom:16,boxShadow:"0 0 40px rgba(251,191,36,.4),inset 0 1px 0 rgba(255,255,255,.3)",transition:"all .2s",animation:"sr_pulse 2s ease infinite"}}>⚡ ENTER THE ARENA</button>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              {[{label:"🕹️ Arcade",sc:"arcade"},{label:"📖 Library",sc:"library"},{label:"👤 Profile",sc:"profile"}].map(b=>(
                <button key={b.sc} onClick={()=>{SFX.click();setSection(b.sc);setScreen(b.sc);}} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"10px 18px",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"'Sora',sans-serif",transition:"all .2s"}}>{b.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── SETUP ── */}
        {screen==="setup"&&(()=>{
          const steps=["Mode","Style","Tutor","Material"];
          return(
            <Wrap>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <button onClick={()=>{SFX.click();if(setupStep===0){setScreen("lobby");setSection("lobby");}else setSetupStep(s=>s-1);}} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"8px 16px",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:"'Sora',sans-serif"}}>← Back</button>
                <div style={{display:"flex",gap:5}}>{steps.map((s,i)=><div key={s} style={{width:50,height:4,borderRadius:2,background:i<=setupStep?"#fbbf24":"rgba(255,255,255,.12)",transition:"background .3s"}}/>)}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{setupStep+1}/4</div>
              </div>

              {setupStep===0&&(
                <div style={{animation:"sr_feedin .3s ease"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:4}}>CHOOSE YOUR MODE</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>Each mode is a completely different experience</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10,marginBottom:24}}>
                    {MODES.map(m=>(
                      <div key={m.id} onClick={()=>{setMode(m);SFX.click();}} style={{cursor:"pointer",borderRadius:16,padding:"16px 14px",border:`2px solid ${mode?.id===m.id?m.col:m.col+"30"}`,background:mode?.id===m.id?`${m.col}12`:"rgba(255,255,255,.03)",transition:"all .25s",transform:mode?.id===m.id?"scale(1.03)":"none",boxShadow:mode?.id===m.id?`0 0 24px ${m.col}25`:"none"}}>
                        <div style={{fontSize:26,marginBottom:8}}>{m.icon}</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,color:m.col,marginBottom:4}}>{m.name}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.5)",lineHeight:1.5}}>{m.desc}</div>
                      </div>
                    ))}
                  </div>
                  <Btn onClick={()=>{SFX.click();setSetupStep(1);}} style={{width:"100%"}}>Continue →</Btn>
                </div>
              )}

              {setupStep===1&&(
                <div style={{animation:"sr_feedin .3s ease"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:4}}>YOUR LEARNING STYLE</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>How does your brain learn best?</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
                    {STYLES.map(s=>(
                      <div key={s.id} onClick={()=>{setStyle(s);SFX.click();}} style={{cursor:"pointer",borderRadius:14,padding:"14px 10px",border:`2px solid ${style?.id===s.id?s.col:s.col+"30"}`,background:style?.id===s.id?`${s.col}10`:"rgba(255,255,255,.03)",transition:"all .22s",transform:style?.id===s.id?"scale(1.04)":"none",textAlign:"center"}}>
                        <div style={{fontSize:22,marginBottom:6}}>{s.icon}</div>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1.5,color:s.col,marginBottom:4}}>{s.name}</div>
                        <div style={{fontSize:10,color:"rgba(255,255,255,.4)",lineHeight:1.4}}>{s.desc}</div>
                      </div>
                    ))}
                  </div>
                  <Btn onClick={()=>{SFX.click();setSetupStep(2);}} style={{width:"100%"}}>Continue →</Btn>
                </div>
              )}

              {setupStep===2&&(
                <div style={{animation:"sr_feedin .3s ease"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:4}}>PICK YOUR TUTOR</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:20}}>They'll react to every answer in character</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:14}}>
                    {TUTORS.map(t=>(
                      <div key={t.id} onClick={()=>{setTutor(t);SFX.click();}} style={{cursor:"pointer",borderRadius:14,overflow:"hidden",border:`2px solid ${tutor?.id===t.id?t.col+"66":"rgba(255,255,255,.08)"}`,background:tutor?.id===t.id?t.bg:"rgba(255,255,255,.03)",transition:"all .25s",transform:tutor?.id===t.id?"translateY(-4px)":"none",boxShadow:tutor?.id===t.id?`0 12px 30px ${t.col}20`:"none",padding:"10px 6px",textAlign:"center"}}>
                        <div style={{width:56,height:56,margin:"0 auto 6px",borderRadius:10,overflow:"hidden",border:`1px solid ${t.col}33`}} dangerouslySetInnerHTML={{__html:t.avatar}}/>
                        <div style={{fontSize:9,fontWeight:800,color:tutor?.id===t.id?t.col:"rgba(255,255,255,.5)",letterSpacing:".03em"}}>{t.name}</div>
                      </div>
                    ))}
                  </div>
                  {tutor&&<GlassCard style={{marginBottom:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,animation:"sr_tutorin .3s ease"}}><div style={{width:52,height:52,borderRadius:10,overflow:"hidden",border:`2px solid ${tutor.col}44`,flexShrink:0}} dangerouslySetInnerHTML={{__html:tutor.avatar}}/><div><div style={{fontWeight:800,color:tutor.col}}>{tutor.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,.45)",lineHeight:1.5,marginTop:2}}>{tutor.tone.slice(0,90)}…</div></div></GlassCard>}
                  <Btn onClick={()=>{SFX.click();setSetupStep(3);}} style={{width:"100%"}}>Continue →</Btn>
                </div>
              )}

              {setupStep===3&&(
                <div style={{animation:"sr_feedin .3s ease"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:4}}>YOUR MATERIAL</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:16}}>Paste notes, upload a file, or drop a YouTube link</div>
                  <div style={{display:"flex",gap:5,marginBottom:12,background:"rgba(255,255,255,.04)",borderRadius:12,padding:4}}>
                    {["text","file","youtube"].map(t=>(
                      <button key={t} onClick={()=>setInputTab(t)} style={{flex:1,padding:"8px",borderRadius:9,border:inputTab===t?"1px solid rgba(251,191,36,.35)":"1px solid transparent",background:inputTab===t?"rgba(251,191,36,.1)":"transparent",color:inputTab===t?"#fbbf24":"rgba(255,255,255,.4)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif",transition:"all .2s"}}>
                        {t==="text"?"📝 Paste Text":t==="file"?"📁 File":"▶️ YouTube"}
                      </button>
                    ))}
                  </div>
                  {inputTab==="text"&&<textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Paste your notes, textbook chapter, lecture transcript…" style={{width:"100%",minHeight:150,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,fontFamily:"'Sora',sans-serif",fontSize:14,padding:14,resize:"vertical",outline:"none",lineHeight:1.6}}/>}
                  {inputTab==="file"&&(
                    <>
                      <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>document.getElementById("fi").click()} style={{border:`2px dashed ${dragOver?"#fbbf24":"rgba(255,255,255,.12)"}`,borderRadius:14,padding:24,textAlign:"center",cursor:"pointer",background:dragOver?"rgba(251,191,36,.05)":"rgba(255,255,255,.02)",transition:"all .25s",color:dragOver?"#fbbf24":"rgba(255,255,255,.4)"}}>
                        <div style={{fontSize:32,marginBottom:8,animation:"sr_float 3s ease-in-out infinite"}}>📂</div>
                        {fileName?<strong style={{color:"#fbbf24"}}>{fileName}</strong>:<><strong>Drop any file here</strong><p style={{fontSize:12,marginTop:4}}>TXT, MD, CSV or click to browse</p></>}
                      </div>
                      <input id="fi" type="file" accept=".txt,.md,.csv,.json" style={{display:"none"}} onChange={e=>e.target.files[0]&&readFile(e.target.files[0])}/>
                      {recentFiles.slice(0,4).map((f,i)=><div key={i} onClick={()=>{setFileText(f.text);setFileName(f.name);SFX.click();}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"10px 14px",cursor:"pointer",marginTop:6,fontSize:13,transition:"all .2s"}}><span>📄 {f.name}</span><span style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{new Date(f.ts).toLocaleDateString()}</span></div>)}
                    </>
                  )}
                  {inputTab==="youtube"&&<><input value={ytUrl} onChange={e=>setYtUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:14,fontFamily:"'Space Mono',monospace",fontSize:13,padding:"12px 14px",outline:"none",marginBottom:8}}/><p style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>💡 Generates questions about the video's topic</p></>}
                  <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
                    <select value={qCount} onChange={e=>setQCount(e.target.value)} style={{flex:1,minWidth:110,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 12px",fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,outline:"none",cursor:"pointer"}}><option value="5">5 Questions</option><option value="10">10 Questions</option><option value="15">15 Questions</option><option value="20">20 Questions</option></select>
                    <select value={diff} onChange={e=>setDiff(e.target.value)} style={{flex:1,minWidth:110,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 12px",fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,outline:"none",cursor:"pointer"}}><option value="easy">🟢 Easy</option><option value="medium">🟡 Medium</option><option value="hard">🔴 Hard</option></select>
                  </div>
                  <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                    {[{l:mode?.name,c:mode?.col,i:mode?.icon},{l:style?.name,c:style?.col,i:style?.icon},{l:tutor?.name,c:tutor?.col,i:tutor?.emoji}].map(x=><div key={x.l} style={{background:`${x.c}15`,border:`1px solid ${x.c}30`,borderRadius:8,padding:"4px 10px",fontSize:10,color:x.c,fontWeight:700,fontFamily:"'Space Mono',monospace"}}>{x.i} {x.l}</div>)}
                  </div>
                  <Btn onClick={()=>handleGenerate()} disabled={(inputTab==="text"&&!notes.trim())||(inputTab==="file"&&!fileText.trim())||(inputTab==="youtube"&&!ytUrl.trim())} style={{width:"100%",marginTop:14,fontSize:16,padding:15}}>⚡ Launch Quiz</Btn>
                </div>
              )}
            </Wrap>
          );
        })()}

        {/* ── LOADING ── */}
        {screen==="loading"&&(
          <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,position:"relative",zIndex:10}}>
            <div style={{width:64,height:64,borderRadius:"50%",border:"2px solid rgba(255,255,255,.08)",borderTopColor:"#fbbf24",animation:"sr_spin 1s linear infinite",boxShadow:"0 0 20px rgba(251,191,36,.2)"}}/>
            <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"center"}}>
              {["Analyzing your material…","Crafting personalized questions…","Calibrating for your mode & style…","Preparing your arena…"].map((s,i)=>(
                <div key={i} style={{fontSize:13,color:i<loadStep?"#34d399":i===loadStep?"#fbbf24":"rgba(255,255,255,.25)",display:"flex",alignItems:"center",gap:8,fontFamily:"'Space Mono',monospace",transition:"color .3s"}}>
                  {i<loadStep?"✓":i===loadStep?"→":"·"} {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GAME ── */}
        {screen==="game"&&q&&(
          <div style={{minHeight:"100vh",position:"relative",zIndex:10,display:"flex",flexDirection:"column"}}>
            <Nav/>
            {/* HUD */}
            <div style={{position:"fixed",top:60,left:0,right:0,zIndex:500,background:"rgba(7,7,15,.85)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.07)",padding:"8px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,maxWidth:860,margin:"0 auto"}}>
                <div style={{background:`${mode?.col}20`,border:`1px solid ${mode?.col}40`,borderRadius:8,padding:"3px 9px",fontSize:10,fontWeight:700,color:mode?.col,fontFamily:"'Space Mono',monospace",whiteSpace:"nowrap"}}>{mode?.icon} {mode?.name}</div>
                <div style={{flex:1,height:6,background:"rgba(255,255,255,.08)",borderRadius:100,overflow:"hidden"}}>
                  <div style={{height:"100%",background:"linear-gradient(90deg,#fbbf24,#f87171,#c084fc)",backgroundSize:"200%",animation:"sr_grd 3s linear infinite",borderRadius:100,width:`${(qIdx/questions.length)*100}%`,transition:"width .5s ease"}}/>
                </div>
                <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"rgba(255,255,255,.4)",whiteSpace:"nowrap"}}>{qIdx+1}/{questions.length}</div>
                {[{v:`+${xp}`,l:"XP",c:"#fbbf24"},{v:score,l:"SCORE",c:"#34d399"},{v:streak>0?`🔥${streak}`:streak,l:"STREAK",c:"#fb923c"}].map(s=>(
                  <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,.05)",borderRadius:8,padding:"3px 9px"}}>
                    <div style={{fontSize:14,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:8,color:"rgba(255,255,255,.3)",letterSpacing:".1em",fontFamily:"'Space Mono',monospace"}}>{s.l}</div>
                  </div>
                ))}
                {mode?.id==="survival"&&<div style={{display:"flex",gap:2}}>{[...Array(3)].map((_,i)=><div key={i} style={{fontSize:14,filter:i<lives?"none":"grayscale(1) brightness(.3)"}}>❤️</div>)}</div>}
                {mode?.blitz&&<div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:blitzTime<=10?"#f87171":"#fbbf24",letterSpacing:1}}>{blitzTime}s</div>}
              </div>
              {mode?.timeLimit>0&&!mode?.blitz&&(
                <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:100,overflow:"hidden",marginTop:5,maxWidth:860,margin:"5px auto 0"}}>
                  <div style={{height:"100%",borderRadius:100,transition:"width .1s linear,background .4s",background:timeLeft<25?"linear-gradient(90deg,#f87171,#fb923c)":"linear-gradient(90deg,#34d399,#fbbf24)",width:`${timeLeft}%`}}/>
                </div>
              )}
            </div>

            {/* Game area */}
            <div style={{flex:1,paddingTop:mode?.timeLimit>0?116:100,paddingBottom:20,maxWidth:860,margin:"0 auto",width:"100%",padding:`${mode?.timeLimit>0?120:106}px 16px 20px`}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                {/* Tutor */}
                <div style={{width:130,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:10,paddingTop:8}}>
                  <div style={{width:110,height:110,borderRadius:18,overflow:"hidden",border:`2px solid ${tutor?.col}44`,background:tutor?.bg,animation:"sr_float 4s ease-in-out infinite",boxShadow:`0 0 24px ${tutor?.col}20`}} dangerouslySetInnerHTML={{__html:tutor?.avatar||""}}/>
                  <div style={{fontSize:10,fontWeight:700,color:tutor?.col,textAlign:"center",fontFamily:"'Space Mono',monospace"}}>{tutor?.name}</div>
                  {personaMsg&&<div style={{background:"rgba(255,255,255,.05)",border:`1px solid ${tutor?.col}30`,borderRadius:10,padding:"8px 10px",fontSize:10,fontStyle:"italic",color:"rgba(255,255,255,.6)",lineHeight:1.5,textAlign:"center",animation:"sr_tutorin .3s ease",maxWidth:120}}>{personaMsg}</div>}
                  {style?.id==="visual"&&q?.visual_cue&&<div style={{fontSize:36,textAlign:"center",animation:"sr_float 3s ease-in-out infinite"}}>{q.visual_cue}</div>}
                </div>

                {/* Q card */}
                <div style={{flex:1}}>
                  <div style={{background:"rgba(255,255,255,.04)",backdropFilter:"blur(16px)",border:"1px solid rgba(255,255,255,.1)",borderRadius:22,padding:22,marginBottom:10,position:"relative",overflow:"hidden",animation:shakeQ?"sr_shake .4s ease":"sr_feedin .3s ease",boxShadow:"0 20px 60px rgba(0,0,0,.4)"}} key={qIdx}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${mode?.col||"#fbbf24"},${tutor?.col||"#c084fc"})`,backgroundSize:"200%",animation:"sr_grd 3s linear infinite"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>Q{qIdx+1} · {topic}</span>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {style?.id==="auditory"&&<button onClick={()=>SFX.tts(q.question)} style={{background:"rgba(52,211,153,.1)",border:"1px solid rgba(52,211,153,.2)",borderRadius:6,padding:"2px 8px",color:"#34d399",fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>🔊</button>}
                        <span style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",padding:"2px 9px",borderRadius:100,fontFamily:"'Space Mono',monospace",background:q.type==="mc"?"rgba(251,191,36,.12)":q.type==="tf"?"rgba(96,165,250,.12)":"rgba(248,113,113,.12)",color:q.type==="mc"?"#fbbf24":q.type==="tf"?"#60a5fa":"#f87171",border:`1px solid ${q.type==="mc"?"rgba(251,191,36,.25)":q.type==="tf"?"rgba(96,165,250,.25)":"rgba(248,113,113,.25)"}`}}>
                          {q.type==="mc"?"MC":q.type==="tf"?"T/F":"Short"}
                        </span>
                      </div>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,lineHeight:1.45,marginBottom:14}}>{q.question}</div>
                    {!answered&&!showHint&&!mode?.hintFree&&<button onClick={()=>{setShowHint(true);SFX.click();}} style={{background:"none",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,color:"rgba(255,255,255,.35)",padding:"3px 9px",fontSize:10,cursor:"pointer",marginBottom:8,fontFamily:"'Space Mono',monospace"}}>💡 Hint</button>}
                    {(showHint||mode?.hintFree)&&q.hint&&<div style={{fontSize:11,color:"#60a5fa",background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",borderRadius:7,padding:"5px 11px",marginBottom:10,fontFamily:"'Space Mono',monospace"}}>💡 {q.hint}</div>}

                    {q.type==="mc"&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        {q.options.map((opt,i)=>{
                          const isElim=eliminated.includes(i);let bg="rgba(255,255,255,.04)",bc="rgba(255,255,255,.1)",col="#f0f0ff";
                          if(!isElim&&answered){if(opt.startsWith(q.answer)){bg="rgba(52,211,153,.12)";bc="rgba(52,211,153,.5)";col="#34d399";}else if(selected===i){bg="rgba(248,113,113,.1)";bc="rgba(248,113,113,.4)";col="#f87171";}}
                          else if(!isElim&&selected===i){bg="rgba(251,191,36,.1)";bc="rgba(251,191,36,.5)";}
                          return<button key={i} onClick={()=>handleMC(opt,i)} disabled={answered||isElim} style={{padding:"11px 12px",background:bg,border:`1px solid ${bc}`,borderRadius:12,color:isElim?"rgba(255,255,255,.15)":col,cursor:answered||isElim?"default":"pointer",fontFamily:"'Sora',sans-serif",fontSize:13,fontWeight:600,textAlign:"left",transition:"all .18s",display:"flex",alignItems:"center",gap:8,lineHeight:1.3,boxShadow:answered&&opt.startsWith(q.answer)?"0 0 16px rgba(52,211,153,.2)":"none"}}>
                            <span style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,flexShrink:0}}>{LETTERS[i]}</span>
                            {opt.replace(/^[A-D]\.\s*/,"")}
                          </button>;
                        })}
                      </div>
                    )}
                    {q.type==="tf"&&(
                      <div style={{display:"flex",gap:8}}>
                        {["True","False"].map(v=>{let bc="rgba(255,255,255,.1)",bg="rgba(255,255,255,.04)",col="#f0f0ff";if(answered){if(v===q.answer){bg="rgba(52,211,153,.12)";bc="rgba(52,211,153,.5)";col="#34d399";}else if(selected===v){bg="rgba(248,113,113,.1)";bc="rgba(248,113,113,.4)";col="#f87171";}}else if(selected===v){bg="rgba(251,191,36,.1)";bc="rgba(251,191,36,.5)";}return<button key={v} onClick={()=>handleTF(v)} disabled={answered} style={{flex:1,padding:14,borderRadius:12,border:`1px solid ${bc}`,background:bg,color:col,cursor:answered?"default":"pointer",fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:800,transition:"all .18s"}}>{v==="True"?"✓ True":"✗ False"}</button>;})}
                      </div>
                    )}
                    {q.type==="short"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <div style={{display:"flex",gap:8}}>
                          <input value={shortVal} onChange={e=>setShortVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleShort()} placeholder="Type your answer…" disabled={answered||checking} style={{flex:1,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:10,fontFamily:"'Sora',sans-serif",fontSize:15,fontWeight:600,padding:"11px 13px",outline:"none",transition:"all .2s"}}/>
                          <button onClick={handleVoice} style={{padding:"0 14px",background:listening?"rgba(248,113,113,.2)":"rgba(255,255,255,.06)",border:`1px solid ${listening?"rgba(248,113,113,.4)":"rgba(255,255,255,.15)"}`,borderRadius:10,color:listening?"#f87171":"rgba(255,255,255,.5)",cursor:"pointer",fontSize:16,transition:"all .2s",animation:listening?"sr_pulse .8s infinite":"none"}}>🎤</button>
                        </div>
                        <button onClick={handleShort} disabled={!shortVal.trim()||answered||checking} style={{padding:11,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#07070f",border:"none",borderRadius:10,fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer",opacity:!shortVal.trim()||answered||checking?.3:1,transition:"all .2s"}}>{checking?"Checking…":"Submit →"}</button>
                      </div>
                    )}
                    {feedback&&<div style={{padding:"11px 14px",borderRadius:10,marginTop:10,fontSize:13,fontWeight:600,lineHeight:1.5,animation:"sr_up .2s ease",background:feedback.ok?"rgba(52,211,153,.08)":"rgba(248,113,113,.06)",border:feedback.ok?"1px solid rgba(52,211,153,.25)":"1px solid rgba(248,113,113,.2)",color:feedback.ok?"#6ee7b7":"#fca5a5",borderLeft:`3px solid ${feedback.ok?"#34d399":"#f87171"}`}}>{feedback.text}</div>}
                  </div>
                  {answered&&<button onClick={nextQ} style={{width:"100%",padding:13,background:"rgba(255,255,255,.06)",border:"1px solid rgba(251,191,36,.35)",borderRadius:13,color:"#fbbf24",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .2s"}}>{qIdx+1>=questions.length?"See Results →":"Next Question →"}</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BOSS ── */}
        {screen==="boss"&&bossQs[bossIdx]&&(
          <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:10}}>
            <Nav/>
            <div style={{textAlign:"center",marginBottom:20,animation:"sr_bossIn .6s ease",marginTop:60}}>
              <div style={{fontSize:72,animation:"sr_float 2.5s ease-in-out infinite",filter:"drop-shadow(0 0 30px rgba(248,113,113,.5))"}}>👹</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,letterSpacing:3,background:"linear-gradient(135deg,#f87171,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>BOSS BATTLE</div>
              <div style={{height:12,background:"rgba(255,255,255,.08)",borderRadius:100,overflow:"hidden",maxWidth:280,margin:"10px auto",border:"1px solid rgba(248,113,113,.15)"}}>
                <div style={{height:"100%",background:"linear-gradient(90deg,#f87171,#fb923c)",borderRadius:100,width:`${bossHp}%`,transition:"width .5s ease"}}/>
              </div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>BOSS HP: {bossHp}%</div>
            </div>
            <div style={{width:"100%",maxWidth:540,background:"rgba(255,255,255,.04)",backdropFilter:"blur(16px)",border:"1px solid rgba(248,113,113,.2)",borderRadius:22,padding:22,position:"relative"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#f87171,#c084fc,#f87171)",backgroundSize:"200%",animation:"sr_grd 2s linear infinite",borderRadius:"22px 22px 0 0"}}/>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace",marginBottom:10}}>BOSS Q{bossIdx+1}/3 · {topic}</div>
              <div style={{fontSize:17,fontWeight:800,lineHeight:1.45,marginBottom:14}}>{bossQs[bossIdx].question}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {bossQs[bossIdx].options.map((opt,i)=>{let bg="rgba(255,255,255,.04)",bc="rgba(255,255,255,.1)",col="#f0f0ff";if(bossAns){if(opt.startsWith(bossQs[bossIdx].answer)){bg="rgba(52,211,153,.12)";bc="rgba(52,211,153,.5)";col="#34d399";}else if(bossSel===i){bg="rgba(248,113,113,.1)";bc="rgba(248,113,113,.4)";col="#f87171";}}else if(bossSel===i){bg="rgba(251,191,36,.1)";bc="rgba(251,191,36,.5)";}return<button key={i} onClick={()=>handleBossMC(opt,i)} disabled={bossAns} style={{padding:"11px 12px",background:bg,border:`1px solid ${bc}`,borderRadius:11,color:col,cursor:bossAns?"default":"pointer",fontFamily:"'Sora',sans-serif",fontSize:12,fontWeight:600,textAlign:"left",transition:"all .18s",display:"flex",alignItems:"center",gap:7}}><span style={{width:22,height:22,borderRadius:5,background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",fontSize:10,fontWeight:700,flexShrink:0}}>{LETTERS[i]}</span>{opt.replace(/^[A-D]\.\s*/,"")}</button>;})}
              </div>
              {bossFb&&<div style={{padding:"11px 14px",borderRadius:10,marginTop:10,fontSize:13,fontWeight:600,lineHeight:1.5,background:bossFb.ok?"rgba(52,211,153,.08)":"rgba(248,113,113,.06)",border:bossFb.ok?"1px solid rgba(52,211,153,.25)":"1px solid rgba(248,113,113,.2)",color:bossFb.ok?"#6ee7b7":"#fca5a5",borderLeft:`3px solid ${bossFb.ok?"#34d399":"#f87171"}`}}>{bossFb.text}</div>}
              {bossAns&&<button onClick={nextBossQ} style={{width:"100%",padding:12,background:"rgba(255,255,255,.06)",border:"1px solid rgba(248,113,113,.35)",borderRadius:11,color:"#f87171",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer",marginTop:10}}>{bossIdx+1>=bossQs.length?"Finish Battle →":"Next Attack →"}</button>}
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {screen==="results"&&(()=>{
          const circ=2*Math.PI*58;const dash=circ-(pct/100)*circ;const col=pct>=80?"#34d399":pct>=60?"#fbbf24":"#f87171";
          return(
            <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"32px 18px",position:"relative",zIndex:10,paddingTop:72}}>
              <Nav/>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"clamp(64px,10vw,96px)",letterSpacing:3,lineHeight:.9,marginBottom:6,background:`linear-gradient(135deg,${col},#fff,${col})`,backgroundSize:"200%",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"sr_grd 3s ease infinite,sr_pop .6s cubic-bezier(.34,1.56,.64,1)",marginTop:8}}>
                {gr.l}
              </div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,marginBottom:4}}>{gr.m}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.35)",marginBottom:24,fontFamily:"'Space Mono',monospace",textAlign:"center"}}>{topic} · {questions.length}Q · {mode?.name} · {style?.name} · {tutor?.name}</div>
              <div style={{position:"relative",width:130,height:130,marginBottom:24}}>
                <svg width={130} height={130} viewBox="0 0 140 140" style={{transform:"rotate(-90deg)"}}>
                  <circle cx="70" cy="70" r="58" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="12"/>
                  <circle cx="70" cy="70" r="58" fill="none" stroke={col} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={dash} style={{transition:"stroke-dashoffset 1.2s cubic-bezier(.34,1.06,.64,1)",filter:`drop-shadow(0 0 8px ${col})`}}/>
                </svg>
                <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{fontFamily:"'Sora',sans-serif",fontSize:30,fontWeight:900,color,lineHeight:1}}>{pct}%</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{score}/{questions.length}</div></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,width:"100%",maxWidth:480,marginBottom:16}}>
                {[{v:`+${xp}`,l:"XP",c:"#fbbf24"},{v:bestStreak,l:"Streak",c:"#34d399"},{v:dayStreak,l:"Day🔥",c:"#60a5fa"}].map(s=>(
                  <div key={s.l} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:12,textAlign:"center"}}>
                    <div style={{fontSize:26,fontWeight:900,color:s.c,marginBottom:2}}>{s.v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'Space Mono',monospace"}}>{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Mind Map */}
              {mindMapData&&(
                <GlassCard style={{width:"100%",maxWidth:480,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10,fontFamily:"'Space Mono',monospace"}}>🗺️ AI Mind Map</div>
                  <MindMap data={mindMapData}/>
                </GlassCard>
              )}

              {/* Arcade launch */}
              {questions.length>0&&(
                <GlassCard style={{width:"100%",maxWidth:480,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10,fontFamily:"'Space Mono',monospace"}}>🕹️ Play Arcade with this material</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                    {ARCADE_GAMES.slice(0,3).map(g=>(
                      <button key={g.id} onClick={()=>launchArcadeGame(g,questions)} style={{padding:"10px 6px",background:`${g.col}12`,border:`1px solid ${g.col}30`,borderRadius:10,color:g.col,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Sora',sans-serif",textAlign:"center",transition:"all .2s"}}>
                        <div style={{fontSize:18,marginBottom:4}}>{g.icon}</div>{g.name}
                      </button>
                    ))}
                  </div>
                </GlassCard>
              )}

              {/* Boss */}
              {pct>=60&&<button onClick={startBoss} style={{background:"linear-gradient(135deg,#f87171,#c084fc)",color:"#fff",border:"none",borderRadius:14,padding:"14px 28px",fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:15,cursor:"pointer",marginBottom:10,width:"100%",maxWidth:480,boxShadow:"0 0 24px rgba(248,113,113,.3)",animation:"sr_pulse 1.8s ease infinite"}}>👹 Boss Battle (+150 XP)</button>}

              {/* Actions */}
              <div style={{display:"flex",gap:6,width:"100%",maxWidth:480,marginBottom:8,flexWrap:"wrap"}}>
                <button onClick={generateReportCard} style={{flex:1,padding:11,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:11,color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>📊 Report Card</button>
                <button onClick={()=>navigator.clipboard.writeText(`🎮 STUDYRUSH\n${topic} · ${score}/${questions.length} (${pct}%) · ${gr.l}\nstudyrush.app`)} style={{flex:1,padding:11,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:11,color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>📋 Share</button>
              </div>
              <div style={{display:"flex",gap:6,width:"100%",maxWidth:480}}>
                <button onClick={()=>{SFX.click();setSetupStep(3);setScreen("setup");}} style={{flex:1,padding:12,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,color:"rgba(255,255,255,.7)",fontFamily:"'Sora',sans-serif",fontWeight:700,fontSize:14,cursor:"pointer"}}>🔄 Again</button>
                <button onClick={()=>{SFX.click();setScreen("lobby");setSection("lobby");}} style={{flex:1,padding:12,background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#07070f",border:"none",borderRadius:12,fontFamily:"'Sora',sans-serif",fontWeight:900,fontSize:14,cursor:"pointer",boxShadow:"0 4px 16px rgba(251,191,36,.3)"}}>🏠 Lobby</button>
              </div>
            </div>
          );
        })()}

        {/* ── ARCADE SECTION ── */}
        {screen==="arcade"&&(
          <Wrap>
            <Nav/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:6}}>🕹️ ARCADE MODE</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>Play any game with your saved study material. Earn XP. Beat your high scores.</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12,marginBottom:24}}>
              {ARCADE_GAMES.map(g=>(
                <GlassCard key={g.id} style={{cursor:"pointer",transition:"all .25s",border:`1px solid ${g.col}30`}} onClick={()=>{}}>
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                    <div style={{fontSize:32}}>{g.icon}</div>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:1.5,color:g.col}}>{g.name}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{g.difficulty}</div>
                    </div>
                    {arcadeScores[g.id]&&<div style={{marginLeft:"auto",fontSize:12,color:g.col,fontFamily:"'Space Mono',monospace",fontWeight:700}}>Best: {arcadeScores[g.id]}</div>}
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.5)",lineHeight:1.5,marginBottom:12}}>{g.desc}</div>
                  {library.length>0?(
                    <>
                      <div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace",marginBottom:6}}>Choose a saved study set:</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:140,overflowY:"auto"}}>
                        {library.slice(0,5).map(l=>(
                          <button key={l.id} onClick={()=>{SFX.arcade();setActiveArcadeGame({game:g,questions:l.questions});setScreen("arcadeGame");}} style={{padding:"7px 12px",background:`${g.col}12`,border:`1px solid ${g.col}25`,borderRadius:8,color:g.col,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Sora',sans-serif",textAlign:"left",transition:"all .2s"}}>
                            📚 {l.topic} <span style={{opacity:.5,fontWeight:400}}>({l.questions?.length||0} Q)</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ):(
                    <div style={{fontSize:12,color:"rgba(255,255,255,.3)",fontStyle:"italic"}}>Complete a study session first to unlock this game!</div>
                  )}
                </GlassCard>
              ))}
            </div>
          </Wrap>
        )}

        {/* ── ARCADE GAME SCREEN ── */}
        {screen==="arcadeGame"&&activeArcadeGame&&(
          <div style={{minHeight:"100vh",position:"relative",zIndex:10,paddingTop:60}}>
            <Nav/>
            <div style={{maxWidth:640,margin:"0 auto",padding:"20px 16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontSize:24}}>{activeArcadeGame.game.icon}</div>
                  <div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:1.5,color:activeArcadeGame.game.col}}>{activeArcadeGame.game.name}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{activeArcadeGame.game.difficulty}</div>
                  </div>
                </div>
                <button onClick={()=>{SFX.click();setScreen("arcade");}} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"6px 12px",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"'Sora',sans-serif"}}>✕ Exit</button>
              </div>
              <GlassCard style={{border:`1px solid ${activeArcadeGame.game.col}30`}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg,${activeArcadeGame.game.col},${activeArcadeGame.game.col}66)`,borderRadius:"20px 20px 0 0"}}/>
                {activeArcadeGame.game.id==="lightning"&&<LightningTap questions={activeArcadeGame.questions?.filter(q=>q.type==="mc")||[]} onFinish={handleArcadeFinish}/>}
                {activeArcadeGame.game.id==="blastzone"&&<AnswerBlitz questions={activeArcadeGame.questions?.filter(q=>q.type==="mc")||[]} onFinish={handleArcadeFinish}/>}
                {activeArcadeGame.game.id==="aimtrainer"&&<AimTrainer questions={activeArcadeGame.questions?.filter(q=>q.type==="mc")||[]} onFinish={handleArcadeFinish}/>}
                {activeArcadeGame.game.id==="rhythm"&&<RhythmReview questions={activeArcadeGame.questions?.filter(q=>q.type==="mc")||[]} onFinish={handleArcadeFinish}/>}
                {activeArcadeGame.game.id==="speedrun"&&<SpeedRun questions={activeArcadeGame.questions?.filter(q=>q.type==="mc")||[]} onFinish={handleArcadeFinish}/>}
                {(activeArcadeGame.game.id==="hexdodge")&&(
                  <div style={{textAlign:"center",padding:32}}>
                    <div style={{fontSize:48,marginBottom:12}}>🔷</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"#818cf8",marginBottom:8}}>HEX DODGE</div>
                    <div style={{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:20}}>Coming soon — this mode is in development!</div>
                    <button onClick={()=>handleArcadeFinish(0)} style={{background:"linear-gradient(135deg,#818cf8,#6366f1)",color:"#fff",border:"none",borderRadius:12,padding:"12px 24px",fontFamily:"'Sora',sans-serif",fontWeight:700,cursor:"pointer"}}>← Back to Arcade</button>
                  </div>
                )}
              </GlassCard>
            </div>
          </div>
        )}

        {/* ── ARCADE DONE ── */}
        {screen==="arcadeDone"&&(
          <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",zIndex:10}}>
            <Nav/>
            <div style={{textAlign:"center",marginTop:60}}>
              <div style={{fontSize:72,marginBottom:12,animation:"sr_float 3s ease-in-out infinite"}}>{activeArcadeGame?.game?.icon}</div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:3,color:activeArcadeGame?.game?.col,marginBottom:6}}>GAME OVER!</div>
              <div style={{fontSize:28,fontWeight:900,marginBottom:4}}>Score: {arcadeGameScore}</div>
              <div style={{fontSize:14,color:"rgba(255,255,255,.4)",marginBottom:8,fontFamily:"'Space Mono',monospace"}}>High Score: {arcadeScores[activeArcadeGame?.game?.id]||0}</div>
              <div style={{fontSize:14,color:"#fbbf24",marginBottom:28}}>+{Math.round(arcadeGameScore/10)} XP earned!</div>
              <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
                <button onClick={()=>{SFX.arcade();setScreen("arcadeGame");}} style={{background:`linear-gradient(135deg,${activeArcadeGame?.game?.col},${activeArcadeGame?.game?.col}99)`,color:"#fff",border:"none",borderRadius:12,padding:"13px 24px",fontFamily:"'Sora',sans-serif",fontWeight:800,fontSize:14,cursor:"pointer"}}>🔄 Play Again</button>
                <button onClick={()=>{SFX.click();setScreen("arcade");setSection("arcade");}} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"13px 24px",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>🕹️ All Games</button>
                <button onClick={()=>{SFX.click();setScreen("lobby");setSection("lobby");}} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"13px 24px",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:14,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>🏠 Lobby</button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIBRARY ── */}
        {screen==="library"&&(
          <Wrap>
            <Nav/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:6}}>📖 MY LIBRARY</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.4)",marginBottom:24}}>Every study set you've ever created. One click to study again, play arcade, or review.</div>
            {library.length===0?(
              <GlassCard><div style={{textAlign:"center",padding:24,color:"rgba(255,255,255,.3)",fontSize:14}}>No saved study sets yet. Complete your first quiz to save to your library!</div></GlassCard>
            ):(
              library.map(l=>{
                const lastSession=history.find(h=>h.topic===l.topic);const lPct=lastSession?Math.round(lastSession.score/lastSession.total*100):null;const g=lPct!==null?gradeOf(lPct):null;
                return(
                  <GlassCard key={l.id} style={{transition:"all .2s"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:800,fontSize:16,marginBottom:3}}>{l.topic}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace",marginBottom:8}}>{new Date(l.ts).toLocaleDateString()} · {l.questions?.length||0} questions saved</div>
                        {lPct!==null&&<div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Last score: <strong style={{color:lPct>=80?"#34d399":lPct>=60?"#fbbf24":"#f87171"}}>{lPct}% ({g?.l})</strong></div>}
                      </div>
                      <div style={{fontSize:36}}>{lPct>=80?"🏆":lPct>=60?"📚":"📖"}</div>
                    </div>
                    <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
                      <button onClick={()=>{SFX.click();setSetupStep(0);setScreen("setup");setSection("study");setTimeout(()=>handleGenerate(l.notes,l.topic),100);}} style={{padding:"8px 14px",background:"rgba(251,191,36,.12)",border:"1px solid rgba(251,191,36,.3)",borderRadius:9,color:"#fbbf24",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>📚 Study Again</button>
                      {ARCADE_GAMES.slice(0,3).map(g=>(
                        <button key={g.id} onClick={()=>{SFX.arcade();setActiveArcadeGame({game:g,questions:l.questions});setArcadeGameScore(0);setScreen("arcadeGame");setSection("arcade");}} style={{padding:"8px 14px",background:`${g.col}12`,border:`1px solid ${g.col}30`,borderRadius:9,color:g.col,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>{g.icon} {g.name}</button>
                      ))}
                    </div>
                  </GlassCard>
                );
              })
            )}
          </Wrap>
        )}

        {/* ── PROFILE ── */}
        {screen==="profile"&&(
          <Wrap>
            <Nav/>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,letterSpacing:3,marginBottom:6}}>👤 MY PROFILE</div>

            {/* Profile card */}
            <GlassCard style={{background:`linear-gradient(135deg,${lv.col}12,rgba(255,255,255,.04))`,border:`1px solid ${lv.col}30`}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
                <div style={{width:72,height:72,borderRadius:20,background:`${lv.col}20`,border:`2px solid ${lv.col}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>{tutor?.emoji||"🎮"}</div>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:1,color:lv.col}}>{lv.name}</div>
                  <div style={{fontSize:14,color:"rgba(255,255,255,.5)",fontFamily:"'Space Mono',monospace"}}>{totalXp.toLocaleString()} XP total</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>🔥 {dayStreak} day streak · {history.length} sessions</div>
                </div>
              </div>
              {/* Level bar */}
              <div style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,.4)",fontFamily:"'Space Mono',monospace",marginBottom:5}}>
                  <span>{lv.name}</span><span>{nlv?`${totalXp.toLocaleString()} / ${nlv.xp.toLocaleString()} XP → ${nlv.name}`:"MAX LEVEL"}</span>
                </div>
                <div style={{height:6,background:"rgba(255,255,255,.06)",borderRadius:100,overflow:"hidden"}}>
                  <div style={{height:"100%",background:lv.col,borderRadius:100,width:`${lvPct}%`,transition:"width 1s ease"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={shareProfile} style={{padding:"9px 14px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>🔗 Share Profile</button>
                <button onClick={generateReportCard} style={{padding:"9px 14px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:9,color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"'Sora',sans-serif"}}>📊 Report Card</button>
              </div>
            </GlassCard>

            {/* Stats grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
              {[{v:totalXp.toLocaleString(),l:"Total XP",c:"#fbbf24"},{v:dayStreak,l:"Day Streak",c:"#fb923c"},{v:history.length,l:"Sessions",c:"#60a5fa"},{v:earnedBadges.length,l:"Badges",c:"#c084fc"},{v:library.length,l:"Topics Saved",c:"#34d399"},{v:Object.values(arcadeScores).reduce((a,b)=>a+b,0),l:"Arcade Score",c:"#f87171"}].map(s=>(
                <div key={s.l} style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:22,fontWeight:900,color:s.c,marginBottom:2}}>{s.v}</div>
                  <div style={{fontSize:9,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"'Space Mono',monospace"}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Study DNA */}
            <GlassCard>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1.5,color:"rgba(255,255,255,.5)",marginBottom:14}}>🧬 STUDY DNA</div>
              {Object.keys(dna).length===0?<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>Play some quizzes to build your DNA profile!</div>:
              Object.entries(dna).sort((a,b)=>b[1].total-a[1].total).map(([t,d])=>{
                const p=Math.round((d.correct/d.total)*100);const col=p>=80?"#34d399":p>=60?"#fbbf24":"#f87171";
                return<div key={t} style={{display:"flex",alignItems:"center",gap:10,margin:"5px 0"}}>
                  <span style={{fontSize:12,fontWeight:600,width:100,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t}</span>
                  <div style={{flex:1,height:7,background:"rgba(255,255,255,.06)",borderRadius:100,overflow:"hidden"}}><div style={{height:"100%",background:col,borderRadius:100,width:`${p}%`,transition:"width 1.2s ease"}}/></div>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.4)",fontFamily:"'Space Mono',monospace",width:30,textAlign:"right"}}>{p}%</span>
                </div>;
              })}
            </GlassCard>

            {/* Recent history */}
            <GlassCard>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1.5,color:"rgba(255,255,255,.5)",marginBottom:14}}>📊 RECENT SESSIONS</div>
              {history.length===0?<div style={{fontSize:13,color:"rgba(255,255,255,.3)"}}>No sessions yet!</div>:
              history.slice(0,8).map((h,i)=>{const p=Math.round(h.score/h.total*100);const g=gradeOf(p);return(
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"10px 14px",marginBottom:5}}>
                  <div><div style={{fontWeight:700,fontSize:13}}>{h.topic}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{new Date(h.ts).toLocaleDateString()} · {h.mode||"casual"} · {h.diff}</div></div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:900,color:p>=80?"#34d399":p>=60?"#fbbf24":"#f87171"}}>{g.l}</div><div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"'Space Mono',monospace"}}>{h.score}/{h.total}</div></div>
                </div>
              );})}
            </GlassCard>

            {/* Arcade high scores */}
            {Object.keys(arcadeScores).length>0&&(
              <GlassCard>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1.5,color:"rgba(255,255,255,.5)",marginBottom:14}}>🕹️ ARCADE HIGH SCORES</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                  {ARCADE_GAMES.filter(g=>arcadeScores[g.id]).map(g=>(
                    <div key={g.id} style={{background:`${g.col}10`,border:`1px solid ${g.col}25`,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                      <div style={{fontSize:20,marginBottom:4}}>{g.icon}</div>
                      <div style={{fontSize:16,fontWeight:900,color:g.col}}>{arcadeScores[g.id]}</div>
                      <div style={{fontSize:9,color:"rgba(255,255,255,.35)",fontFamily:"'Space Mono',monospace"}}>{g.name}</div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </Wrap>
        )}

        {/* ── STUDY SECTION (nav redirect) ── */}
        {screen==="study"&&(
          <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:10}}>
            <Nav/>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:48,marginBottom:16}}>📚</div>
              <button onClick={()=>{SFX.click();setSetupStep(0);setScreen("setup");}} style={{background:"linear-gradient(135deg,#fbbf24,#f59e0b)",color:"#07070f",border:"none",borderRadius:16,padding:"16px 36px",fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,cursor:"pointer",boxShadow:"0 0 30px rgba(251,191,36,.3)"}}>⚡ START STUDY SESSION</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
