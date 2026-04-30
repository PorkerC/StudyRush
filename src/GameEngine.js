// ============================================================
// STUDYRUSH ULTIMATE ENGINE v2.0
// Full-featured 2D game engine with advanced rendering
// ============================================================

// ── MATH ─────────────────────────────────────────────────────────────────────
export const M = {
  lerp:(a,b,t)=>a+(b-a)*t,
  clamp:(v,lo,hi)=>Math.min(Math.max(v,lo),hi),
  map:(v,a,b,c,d)=>c+((v-a)/(b-a))*(d-c),
  dist:(x1,y1,x2,y2)=>Math.sqrt((x2-x1)**2+(y2-y1)**2),
  rand:(a,b)=>Math.random()*(b-a)+a,
  randInt:(a,b)=>Math.floor(Math.random()*(b-a+1))+a,
  pick:arr=>arr[Math.floor(Math.random()*arr.length)],
  smoothstep:(e0,e1,x)=>{const t=Math.min(Math.max((x-e0)/(e1-e0),0),1);return t*t*(3-2*t)},
  ease:{
    linear:t=>t,
    outQ:t=>t*(2-t),
    inQ:t=>t*t,
    inOutQ:t=>t<.5?2*t*t:-1+(4-2*t)*t,
    outCubic:t=>--t*t*t+1,
    outBack:t=>{const c=1.70158,c3=c+1;return 1+c3*(t-1)**3+c*(t-1)**2},
    outElastic:t=>{if(t===0||t===1)return t;const c4=(2*Math.PI)/3;return 2**(-10*t)*Math.sin((t*10-.75)*c4)+1},
    outBounce:t=>{const n1=7.5625,d1=2.75;if(t<1/d1)return n1*t*t;if(t<2/d1)return n1*(t-=1.5/d1)*t+.75;if(t<2.5/d1)return n1*(t-=2.25/d1)*t+.9375;return n1*(t-=2.625/d1)*t+.984375},
  },
  d2r:d=>d*Math.PI/180,
  within:(ax,ay,aw,ah,bx,by,bw,bh)=>ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by,
  circHit:(ax,ay,ar,bx,by,br)=>M.dist(ax,ay,bx,by)<ar+br,
};

// ── OBJECT POOL ───────────────────────────────────────────────────────────────
export class Pool {
  constructor(factory,reset,size=64){
    this._f=factory;this._r=reset;this._free=[];this._active=new Set();
    for(let i=0;i<size;i++)this._free.push(factory());
  }
  get(){const o=this._free.length?this._free.pop():this._f();this._active.add(o);return o;}
  release(o){if(!this._active.has(o))return;this._active.delete(o);this._r(o);this._free.push(o);}
  releaseAll(){[...this._active].forEach(o=>this.release(o));}
  get active(){return this._active;}
}

// ── PARTICLE ──────────────────────────────────────────────────────────────────
export class Particle {
  constructor(){this.alive=false;this.x=this.y=this.vx=this.vy=this.rot=this.rotV=0;this.life=this.decay=this.size=this.scale=this.alpha=0;this.color="#fff";this.shape="circle";this.friction=1;this.ay=0.3;this.glow=false;this.glowSize=0;}
  init(x,y,opts={}){
    this.alive=true;this.x=x;this.y=y;
    this.vx=opts.vx??M.rand(-5,5);this.vy=opts.vy??M.rand(-9,-2);
    this.ay=opts.ay??0.28;this.ax=opts.ax??0;
    this.life=1;this.decay=opts.decay??M.rand(0.012,0.028);
    this.size=opts.size??M.rand(4,10);
    this.color=Array.isArray(opts.colors)?M.pick(opts.colors):(opts.color||"#fbbf24");
    this.shape=opts.shape??(Math.random()>.6?"square":Math.random()>.5?"star":"circle");
    this.rot=M.rand(0,Math.PI*2);this.rotV=M.rand(-.12,.12);
    this.friction=opts.friction??0.97;this.glow=opts.glow??false;
    this.glowSize=opts.glowSize??this.size*2;this.scale=1;
  }
  reset(){this.alive=false;}
  update(){
    this.vx=(this.vx+this.ax)*this.friction;
    this.vy=(this.vy+this.ay)*this.friction;
    this.x+=this.vx;this.y+=this.vy;
    this.rot+=this.rotV;this.life-=this.decay;
    this.scale=Math.max(0,this.life);this.alpha=Math.max(0,this.life);
    if(this.life<=0)this.alive=false;
  }
  draw(ctx){
    if(!this.alive||this.alpha<=0)return;
    ctx.save();
    ctx.globalAlpha=this.alpha;
    if(this.glow){ctx.shadowColor=this.color;ctx.shadowBlur=this.glowSize;}
    ctx.translate(this.x,this.y);ctx.rotate(this.rot);ctx.scale(this.scale,this.scale);
    ctx.fillStyle=this.color;
    if(this.shape==="circle"){ctx.beginPath();ctx.arc(0,0,this.size/2,0,Math.PI*2);ctx.fill();}
    else if(this.shape==="square"){ctx.fillRect(-this.size/2,-this.size/2,this.size,this.size);}
    else if(this.shape==="star"){
      ctx.beginPath();
      for(let i=0;i<10;i++){const r=i%2===0?this.size/2:this.size/4,a=(i/10)*Math.PI*2-Math.PI/2;i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
      ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}

// ── PARTICLE SYSTEM ───────────────────────────────────────────────────────────
export class PS {
  constructor(size=300){this._pool=new Pool(()=>new Particle(),(p)=>p.reset(),size);}
  _spawn(x,y,opts){const p=this._pool.get();p.init(x,y,opts);return p;}
  emit(x,y,n=20,opts={}){for(let i=0;i<n;i++)this._spawn(x,y,{...opts,vx:(opts.vx??0)+M.rand(-4,4),vy:(opts.vy??-5)+M.rand(-3,1)});}
  burst(x,y,opts={}){
    const n=opts.count??30;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2,spd=M.rand(opts.minSpd??2,opts.maxSpd??9);this._spawn(x,y,{...opts,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,ay:opts.ay??0.15});}
  }
  update(){this._pool.active.forEach(p=>{p.update();if(!p.alive)this._pool.release(p);});}
  draw(ctx){this._pool.active.forEach(p=>p.draw(ctx));}
  clear(){this._pool.releaseAll();}
}

// ── TWEEN ─────────────────────────────────────────────────────────────────────
export class Tween {
  constructor(target,props,dur,ease,onDone){
    this.target=target;this.s={};this.e=props;this.dur=dur;this.ease=ease||M.ease.outQ;
    this.onDone=onDone;this.elapsed=0;this.done=false;
    for(const k in props)this.s[k]=target[k]??0;
  }
  update(dt){
    if(this.done)return;
    this.elapsed=Math.min(this.elapsed+dt,this.dur);
    const t=this.ease(this.elapsed/this.dur);
    for(const k in this.e)this.target[k]=M.lerp(this.s[k],this.e[k],t);
    if(this.elapsed>=this.dur){this.done=true;this.onDone?.();}
  }
}

// ── CAMERA ────────────────────────────────────────────────────────────────────
export class Camera {
  constructor(){this._sx=0;this._sy=0;this._trauma=0;}
  addTrauma(t){this._trauma=Math.min(this._trauma+t,1);}
  shake(mag,dur){this.addTrauma(mag/20);}
  update(dt){
    if(this._trauma>0){
      this._trauma=Math.max(0,this._trauma-dt*1.8);
      const m=this._trauma**2;
      this._sx=M.rand(-18,18)*m;this._sy=M.rand(-18,18)*m;
    }else{this._sx=M.lerp(this._sx,0,.25);this._sy=M.lerp(this._sy,0,.25);}
  }
  apply(ctx){ctx.translate(this._sx,this._sy);}
}

// ── INPUT ─────────────────────────────────────────────────────────────────────
export class Input {
  constructor(canvas){
    this.canvas=canvas;this._ptrs=new Map();this._pressed=new Set();this._released=new Set();
    this._bind();
  }
  _pos(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
  _bind(){
    const dn=e=>{e.preventDefault();const list=e.touches||[e];for(const t of list){const p=this._pos(t),id=t.identifier??"m";this._ptrs.set(id,{...p,down:true});this._pressed.add(id);}};
    const up=e=>{e.preventDefault();const list=e.changedTouches||[e];for(const t of list){const id=t.identifier??"m";this._released.add(id);this._ptrs.delete(id);}};
    const mv=e=>{e.preventDefault();const list=e.touches||[e];for(const t of list){const p=this._pos(t),id=t.identifier??"m";if(this._ptrs.has(id))this._ptrs.set(id,{...p,down:true});}};
    ["pointerdown","touchstart"].forEach(ev=>this.canvas.addEventListener(ev,dn,{passive:false}));
    ["pointerup","touchend"].forEach(ev=>this.canvas.addEventListener(ev,up,{passive:false}));
    ["pointermove","touchmove"].forEach(ev=>this.canvas.addEventListener(ev,mv,{passive:false}));
  }
  hit(x,y,w,h){for(const[,p]of this._ptrs)if(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h)return true;return false;}
  wasHit(x,y,w,h){for(const id of this._pressed){const p=this._ptrs.get(id);if(p&&p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h)return true;}return false;}
  wasCircle(cx,cy,r){for(const id of this._pressed){const p=this._ptrs.get(id);if(p&&M.dist(p.x,p.y,cx,cy)<=r)return true;}return false;}
  anyPress(){return this._pressed.size>0;}
  getPresses(){return[...this._pressed].map(id=>this._ptrs.get(id)).filter(Boolean);}
  clearFrame(){this._pressed.clear();this._released.clear();}
}

// ── RENDERER ──────────────────────────────────────────────────────────────────
export class Renderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext("2d");
    this.dpr=window.devicePixelRatio||1;this.width=0;this.height=0;
    this.resize();
  }
  resize(){
    const r=this.canvas.getBoundingClientRect();
    this.width=r.width;this.height=r.height;
    this.canvas.width=Math.round(r.width*this.dpr);
    this.canvas.height=Math.round(r.height*this.dpr);
    this.ctx.scale(this.dpr,this.dpr);
  }
  get W(){return this.width;}get H(){return this.height;}
  clear(col="#07070f"){this.ctx.fillStyle=col;this.ctx.fillRect(0,0,this.W,this.H);}
  rr(x,y,w,h,r,fill,stroke,sw=1){
    const ctx=this.ctx,mn=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+mn,y);ctx.lineTo(x+w-mn,y);ctx.quadraticCurveTo(x+w,y,x+w,y+mn);ctx.lineTo(x+w,y+h-mn);ctx.quadraticCurveTo(x+w,y+h,x+w-mn,y+h);ctx.lineTo(x+mn,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-mn);ctx.lineTo(x,y+mn);ctx.quadraticCurveTo(x,y,x+mn,y);ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}
  }
  circle(x,y,r,fill,stroke,sw=1){const ctx=this.ctx;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=sw;ctx.stroke();}}
  text(str,x,y,opts={}){
    const ctx=this.ctx;ctx.save();
    ctx.font=`${opts.w||"700"} ${opts.s||16}px ${opts.f||"'Sora',sans-serif"}`;
    ctx.textAlign=opts.a||"center";ctx.textBaseline=opts.b||"middle";ctx.fillStyle=opts.c||"#f0f0ff";
    if(opts.glow){ctx.shadowColor=opts.glow;ctx.shadowBlur=opts.gb||12;}
    if(opts.outline){ctx.strokeStyle=opts.outline;ctx.lineWidth=opts.ow||2;ctx.strokeText(str,x,y);}
    ctx.fillText(str,x,y);ctx.restore();
  }
  textWrap(str,x,y,maxW,opts={}){
    const ctx=this.ctx;ctx.save();
    ctx.font=`${opts.w||"700"} ${opts.s||15}px ${opts.f||"'Sora',sans-serif"}`;
    ctx.textAlign=opts.a||"center";ctx.textBaseline=opts.b||"top";ctx.fillStyle=opts.c||"#f0f0ff";
    if(opts.glow){ctx.shadowColor=opts.glow;ctx.shadowBlur=opts.gb||8;}
    const words=str.split(" ");let lines=[],line="";
    words.forEach(w=>{const t=line?line+" "+w:w;ctx.measureText(t).width>maxW?(lines.push(line),line=w):line=t;});
    lines.push(line);
    const lh=opts.lh||(opts.s||15)*1.45;
    lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lh));
    ctx.restore();return lines.length;
  }
  bar(x,y,w,h,t,bg,fg,r=4,glow=null){
    this.rr(x,y,w,h,r,bg);
    if(glow){this.ctx.shadowColor=glow;this.ctx.shadowBlur=8;}
    this.rr(x,y,Math.max(0,w*Math.min(1,Math.max(0,t))),h,r,fg);
    if(glow)this.ctx.shadowBlur=0;
  }
  lgrad(x1,y1,x2,y2,stops){const g=this.ctx.createLinearGradient(x1,y1,x2,y2);stops.forEach(([p,c])=>g.addColorStop(p,c));return g;}
  rgrad(x,y,r1,x2,y2,r2,stops){const g=this.ctx.createRadialGradient(x,y,r1,x2,y2,r2);stops.forEach(([p,c])=>g.addColorStop(p,c));return g;}
  flash(col,a=0.25){const ctx=this.ctx;ctx.save();ctx.globalAlpha=a;ctx.fillStyle=col;ctx.fillRect(0,0,this.W,this.H);ctx.restore();}
  vignette(str=0.5){const g=this.rgrad(this.W/2,this.H/2,this.H*.2,this.W/2,this.H/2,this.H*.85,[[0,"rgba(0,0,0,0)"],[1,`rgba(0,0,0,${str})`]]);this.ctx.fillStyle=g;this.ctx.fillRect(0,0,this.W,this.H);}
  scanlines(a=0.02){const ctx=this.ctx;ctx.save();ctx.globalAlpha=a;for(let y=0;y<this.H;y+=3){ctx.fillStyle="#000";ctx.fillRect(0,y,this.W,1);}ctx.restore();}
  glow(col,blur){this.ctx.shadowColor=col;this.ctx.shadowBlur=blur;}
  noGlow(){this.ctx.shadowBlur=0;}
}

// ── AUDIO ENGINE ──────────────────────────────────────────────────────────────
export class Audio {
  constructor(){this._ctx=null;this._master=null;this.muted=false;}
  _init(){if(this._ctx)return;try{this._ctx=new(window.AudioContext||window.webkitAudioContext)();this._master=this._ctx.createGain();this._master.gain.value=0.65;this._master.connect(this._ctx.destination);}catch{}}
  _t(freq,dur,type="sine",vol=0.18,delay=0){
    if(this.muted)return;this._init();const c=this._ctx;if(!c)return;
    try{const o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(this._master);o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);g.gain.setValueAtTime(0,c.currentTime+delay);g.gain.linearRampToValueAtTime(vol,c.currentTime+delay+.01);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+delay+dur);o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur+.05);}catch{}
  }
  play(name){
    const s={
      correct:()=>{this._t(523,.09,"sine",.22);this._t(659,.09,"sine",.22,.1);this._t(784,.25,"sine",.2,.19);this._t(1047,.3,"sine",.14,.3);},
      wrong:()=>{this._t(220,.18,"sawtooth",.2);this._t(160,.22,"sawtooth",.16,.15);},
      tap:()=>{this._t(900,.05,"sine",.22);this._t(1200,.03,"sine",.15,.05);},
      miss:()=>this._t(180,.12,"sawtooth",.15),
      streak:()=>[523,587,659,784,1047].forEach((f,i)=>this._t(f,.1,"sine",.18,i*.07)),
      jackpot:()=>{[523,659,784,1047,1319,1568].forEach((f,i)=>this._t(f,.12,"sine",.22,i*.055));this._t(1047,.7,"sine",.1,.5);},
      levelUp:()=>[392,494,587,784,1047].forEach((f,i)=>this._t(f,.2,"sine",.22,i*.09)),
      click:()=>this._t(600,.04,"sine",.1),
      countdown:()=>this._t(440,.15,"square",.2),
      go:()=>{this._t(660,.08,"sine",.28);this._t(880,.15,"sine",.24,.1);this._t(1100,.2,"sine",.2,.19);},
      combo:()=>{this._t(660,.1,"sine",.22);this._t(880,.12,"sine",.2,.09);this._t(1100,.15,"sine",.18,.17);},
      boost:()=>{this._t(440,.08,"square",.15);this._t(880,.15,"sine",.2,.09);},
      brake:()=>this._t(200,.15,"sawtooth",.18),
      tick:()=>this._t(880,.03,"square",.06),
      danger:()=>this._t(110,.1,"sawtooth",.22),
      beat:()=>{this._t(60,.08,"sine",.18);this._t(120,.05,"sine",.1,.06);},
      hitBeat:()=>{this._t(523,.1,"sine",.25);this._t(660,.08,"sine",.2,.08);},
      uiClick:()=>{this._t(600,.04,"sine",.1);this._t(800,.03,"sine",.08,.04);},
    };
    s[name]?.();
  }
  tts(t){if(!('speechSynthesis'in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.rate=.9;window.speechSynthesis.speak(u);}
}

// ── BACKGROUNDS ───────────────────────────────────────────────────────────────
export class StudyBG {
  constructor(){
    this.t=0;
    const syms="∑∫∂∇πeφ∞αβγδλμσθΩΔ∈∀∃⊕∧∨√≈≠≤≥±×÷⊂⊃∩∪".split("");
    const eqs=["E = mc²","F = ma","∫f(x)dx","∇²φ = 0","a² + b² = c²","d/dx[xⁿ]=nxⁿ⁻¹","∑ᵢ₌₁ⁿ i=n(n+1)/2","P(A|B)=P(B|A)·P(A)/P(B)","σ=√(Σ(x-μ)²/N)","lim(x→∞)"];
    this.symbols=[...Array(30)].map(()=>({x:Math.random(),y:Math.random(),sym:M.pick(syms),size:M.rand(14,30),alpha:M.rand(.03,.1),vx:M.rand(-.008,.008),vy:M.rand(-.005,.005),pulse:Math.random()*Math.PI*2,ps:M.rand(.3,.8)}));
    this.equations=[...Array(8)].map(()=>({x:Math.random(),y:Math.random(),eq:M.pick(eqs),alpha:M.rand(.04,.09),vx:M.rand(-.004,.004),vy:M.rand(-.003,.003),size:M.rand(11,15)}));
  }
  update(dt){
    this.t+=dt;
    this.symbols.forEach(s=>{s.x=(s.x+s.vx+1)%1;s.y=(s.y+s.vy+1)%1;s.pulse+=s.ps*dt;});
    this.equations.forEach(e=>{e.x=(e.x+e.vx+1)%1;e.y=(e.y+e.vy+1)%1;});
  }
  draw(ctx,W,H){
    ctx.save();
    // Base
    const bg=ctx.createLinearGradient(0,0,W*.3,H);
    bg.addColorStop(0,"#080d18");bg.addColorStop(.5,"#07080f");bg.addColorStop(1,"#080e1a");
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // Glow top-left
    let g=ctx.createRadialGradient(W*.15,H*.1,0,W*.15,H*.1,W*.5);
    g.addColorStop(0,"rgba(96,165,250,.045)");g.addColorStop(1,"transparent");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Glow bottom-right
    g=ctx.createRadialGradient(W*.85,H*.9,0,W*.85,H*.9,W*.4);
    g.addColorStop(0,"rgba(167,139,250,.03)");g.addColorStop(1,"transparent");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Dot grid
    ctx.globalAlpha=0.04;ctx.fillStyle="#60a5fa";
    for(let x=32;x<W;x+=48)for(let y=32;y<H;y+=48){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=1;
    // Symbols
    this.symbols.forEach(s=>{
      const pulse=Math.sin(s.pulse)*.4+.6;
      ctx.globalAlpha=s.alpha*pulse;ctx.fillStyle="#60a5fa";
      ctx.font=`300 ${s.size}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(s.sym,s.x*W,s.y*H);
    });
    // Equations
    this.equations.forEach(e=>{
      ctx.globalAlpha=e.alpha;ctx.fillStyle="#a78bfa";
      ctx.font=`400 ${e.size}px 'Space Mono',monospace`;ctx.textAlign="left";
      ctx.fillText(e.eq,e.x*W,e.y*H);
    });
    ctx.globalAlpha=1;ctx.restore();
  }
}

export class ArcadeBG {
  constructor(){
    this.t=0;this.cols=[];this.floaters=[];this.radar=0;
    const chars="01アイウエオカキ∑∫πφ∞αβγδ01101010サシスセソ".split("");
    const numCols=Math.max(20,Math.floor(window.innerWidth/18)+4);
    for(let i=0;i<numCols;i++){
      this.cols.push({x:i*18,y:M.rand(-400,0),speed:M.rand(60,160),chars:[...Array(M.randInt(8,22))].map(()=>M.pick(chars)),alpha:M.rand(.06,.16),color:Math.random()>.7?"#fbbf24":Math.random()>.5?"#f87171":"#34d399",hi:M.randInt(0,3)});
    }
    const items=["GAME THEORY","NASH EQ.","∑ KNOWLEDGE","π × SKILL","LEVEL UP","XP +100","COMBO x3","CRITICAL HIT","PERFECT","∞ LEARNING","POWER UP","∇SKILL"];
    this.floaters=[...Array(10)].map(()=>({x:Math.random(),y:Math.random(),text:M.pick(items),size:M.rand(10,15),alpha:M.rand(.04,.1),vx:M.rand(-.007,.007),vy:M.rand(-.005,.005),col:M.pick(["#fbbf24","#f87171","#34d399","#60a5fa","#c084fc"]),pulse:Math.random()*Math.PI*2}));
  }
  update(dt,H){
    this.t+=dt;this.radar=(this.radar+dt*.4)%(Math.PI*2);
    this.cols.forEach(c=>{
      c.y+=c.speed*dt;
      if(c.y>H+200){c.y=M.rand(-300,-50);c.speed=M.rand(60,160);}
      if(Math.random()<.07)c.chars[M.randInt(0,c.chars.length-1)]="01アイ∑π∞αβ01".split("")[M.randInt(0,12)];
    });
    this.floaters.forEach(f=>{f.x=(f.x+f.vx+1)%1;f.y=(f.y+f.vy+1)%1;f.pulse+=dt*.8;});
  }
  draw(ctx,W,H){
    ctx.save();
    ctx.fillStyle="#07070f";ctx.fillRect(0,0,W,H);
    // Top glow
    let g=ctx.createRadialGradient(W*.5,0,0,W*.5,0,W*.7);
    g.addColorStop(0,"rgba(251,191,36,.04)");g.addColorStop(1,"transparent");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Bottom glow
    g=ctx.createRadialGradient(W*.5,H,0,W*.5,H,W*.7);
    g.addColorStop(0,"rgba(248,113,113,.04)");g.addColorStop(1,"transparent");
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    // Horizontal lines
    ctx.globalAlpha=.03;ctx.strokeStyle="#fbbf24";ctx.lineWidth=.5;
    for(let y=0;y<H;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    ctx.globalAlpha=1;
    // Matrix
    ctx.font="700 13px 'Space Mono',monospace";ctx.textAlign="center";ctx.textBaseline="top";
    this.cols.forEach(c=>{
      const n=c.chars.length;
      c.chars.forEach((ch,i)=>{
        const cy=c.y+i*18;if(cy<-20||cy>H+20)return;
        const isHead=i===n-1,isHi=i===c.hi;
        ctx.globalAlpha=isHead?Math.min(1,c.alpha*3.5):isHi?c.alpha*2:c.alpha*(1-i/n*.5);
        ctx.fillStyle=isHead?"#fff":c.color;
        if(isHead){ctx.shadowColor=c.color;ctx.shadowBlur=10;}
        ctx.fillText(ch,c.x,cy);ctx.shadowBlur=0;
      });
    });
    ctx.globalAlpha=1;
    // Circuit lines
    ctx.strokeStyle="rgba(251,191,36,.06)";ctx.lineWidth=1;ctx.setLineDash([4,10]);
    for(let i=0;i<6;i++){const x=W*(i/6)+30,y=H*(((i*.17)%1));ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,y);ctx.lineTo(x+M.rand(-60,60),y);ctx.stroke();}
    ctx.setLineDash([]);
    // Radar (top-right)
    ctx.save();ctx.translate(W*.84,H*.12);
    const rr=Math.min(W,H)*.07;
    ctx.globalAlpha=.06;ctx.strokeStyle="#34d399";ctx.lineWidth=.5;
    for(let r2=rr;r2>0;r2-=rr*.33){ctx.beginPath();ctx.arc(0,0,r2,0,Math.PI*2);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-rr,0);ctx.lineTo(rr,0);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-rr);ctx.lineTo(0,rr);ctx.stroke();
    ctx.globalAlpha=.12;
    const g2=ctx.createRadialGradient(0,0,0,0,0,rr);
    g2.addColorStop(0,"rgba(52,211,153,.4)");g2.addColorStop(1,"transparent");
    ctx.fillStyle=g2;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,rr,this.radar-.9,this.radar);ctx.closePath();ctx.fill();
    ctx.restore();
    // Floaters
    ctx.textAlign="left";
    this.floaters.forEach(f=>{
      const p=Math.sin(f.pulse)*.4+.6;
      ctx.globalAlpha=f.alpha*p;ctx.fillStyle=f.col;
      ctx.font=`700 ${f.size}px 'Space Mono',monospace`;
      ctx.fillText(f.text,f.x*W,f.y*H);
    });
    ctx.globalAlpha=1;ctx.restore();
  }
}

export class HomeBG {
  constructor(){
    this.t=0;
    this.stars=[...Array(140)].map(()=>({x:Math.random(),y:Math.random(),r:M.rand(.4,2.2),a:M.rand(.1,.8),pulse:Math.random()*Math.PI*2,spd:M.rand(.5,2)}));
    const consts=[{s:"π",v:"3.14159…"},{s:"e",v:"2.71828…"},{s:"φ",v:"1.61803…"},{s:"√2",v:"1.41421…"},{s:"∞",v:"∞"},{s:"i",v:"√-1"},{s:"c",v:"3×10⁸ m/s"},{s:"ℏ",v:"1.054×10⁻³⁴"},{s:"G",v:"6.674×10⁻¹¹"}];
    this.consts=consts.map(c=>({...c,x:M.rand(.05,.92),y:M.rand(.05,.92),vx:M.rand(-.003,.003),vy:M.rand(-.002,.002),a:M.rand(.06,.16),sz:M.rand(14,22),pulse:Math.random()*Math.PI*2,ps:M.rand(.2,.6)}));
    this.auroras=[0,1,2].map(i=>({phase:i*(Math.PI*2/3),spd:M.rand(.08,.15),amp:M.rand(.12,.22),col:M.pick(["#60a5fa","#a78bfa","#34d399","#fbbf24"])}));
  }
  update(dt){this.t+=dt;this.stars.forEach(s=>s.pulse+=s.spd*dt);this.consts.forEach(c=>{c.x=(c.x+c.vx+1)%1;c.y=(c.y+c.vy+1)%1;c.pulse+=c.ps*dt;});}
  draw(ctx,W,H){
    ctx.save();
    const bg=ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,"#05050f");bg.addColorStop(.4,"#070712");bg.addColorStop(1,"#050510");
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    // Auroras
    this.auroras.forEach(a=>{
      ctx.save();ctx.globalAlpha=.04;ctx.fillStyle=a.col;
      ctx.beginPath();
      for(let x=0;x<=W;x+=8){
        const y=H*(.38+a.amp*Math.sin(x/W*Math.PI*3+this.t*a.spd+a.phase));
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();
      ctx.restore();
    });
    // Stars
    this.stars.forEach(s=>{
      const a2=Math.sin(s.pulse)*.4+.6;
      ctx.globalAlpha=s.a*a2;ctx.fillStyle="#fff";
      ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,Math.PI*2);ctx.fill();
    });
    // Constants
    this.consts.forEach(c=>{
      const p=Math.sin(c.pulse)*.4+.6;
      ctx.globalAlpha=c.a*p;ctx.fillStyle="#a78bfa";
      ctx.font=`300 ${c.sz}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(c.s,c.x*W,c.y*H);
      ctx.globalAlpha=c.a*p*.55;ctx.fillStyle="#60a5fa";
      ctx.font=`400 ${c.sz*.52}px 'Space Mono',monospace`;
      ctx.fillText(c.v,c.x*W,c.y*H+c.sz*.82);
    });
    ctx.globalAlpha=1;ctx.restore();
  }
}

// ── SCENE BASE ────────────────────────────────────────────────────────────────
export class Scene {
  constructor(){this.engine=null;this.renderer=null;this.input=null;this.audio=null;this.camera=null;this.particles=null;}
  init(){}update(dt){}draw(r){}destroy(){}
}

// ── CANVAS BUTTON ─────────────────────────────────────────────────────────────
export class CBtn {
  constructor(x,y,w,h,label,opts={}){
    this.x=x;this.y=y;this.w=w;this.h=h;this.label=label;
    this.col=opts.col||"#fbbf24";this.txtCol=opts.txtCol||"#07070f";
    this.r=opts.r||12;this.size=opts.size||14;this.scale=1;this._ts=1;
    this.alpha=1;this.glow=opts.glow||false;this.onClick=opts.onClick||null;
    this.disabled=opts.disabled||false;this.icon=opts.icon||"";
  }
  update(input){
    if(this.disabled)return;
    this._ts=input.hit(this.x-this.w/2,this.y-this.h/2,this.w,this.h)?1.06:1;
    this.scale=M.lerp(this.scale,this._ts,.18);
    if(input.wasHit(this.x-this.w/2,this.y-this.h/2,this.w,this.h))this.onClick?.();
  }
  draw(r){
    const ctx=r.ctx;ctx.save();ctx.globalAlpha=this.disabled?.35:this.alpha;
    ctx.translate(this.x,this.y);ctx.scale(this.scale,this.scale);
    if(this.glow){ctx.shadowColor=this.col;ctx.shadowBlur=18;}
    r.rr(-this.w/2,-this.h/2,this.w,this.h,this.r,this.col);
    ctx.globalAlpha*=.22;r.rr(-this.w/2+2,-this.h/2+2,this.w-4,this.h/2-2,this.r-1,"rgba(255,255,255,.4)");
    ctx.globalAlpha=this.disabled?.35:this.alpha;ctx.shadowBlur=0;
    r.text(this.icon?`${this.icon} ${this.label}`:this.label,0,0,{c:this.txtCol,w:"800",s:this.size,a:"center",b:"middle"});
    ctx.restore();
  }
}

// ── MAIN ENGINE ───────────────────────────────────────────────────────────────
export class Engine {
  constructor(canvas){
    this.renderer=new Renderer(canvas);
    this.input=new Input(canvas);
    this.audio=new Audio();
    this.camera=new Camera();
    this.particles=new PS(400);
    this.tweens=[];this.scene=null;this.running=false;
    this._last=0;this._raf=null;this.fps=0;this._fpsF=0;this._fpsT=0;this.time=0;
  }
  setScene(s){
    this.scene?.destroy?.();this.particles.clear();this.tweens=[];
    this.scene=s;s.engine=this;s.renderer=this.renderer;s.input=this.input;
    s.audio=this.audio;s.camera=this.camera;s.particles=this.particles;s.init?.();
  }
  tween(target,props,dur,ease,onDone){const t=new Tween(target,props,dur,ease,onDone);this.tweens.push(t);return t;}
  start(){if(this.running)return;this.running=true;this._last=performance.now();this._loop(this._last);}
  stop(){this.running=false;if(this._raf)cancelAnimationFrame(this._raf);}
  _loop(now){
    if(!this.running)return;
    this._raf=requestAnimationFrame(t=>this._loop(t));
    const dt=Math.min((now-this._last)/1000,.05);
    this._last=now;this.time+=dt;
    this._fpsF++;this._fpsT+=dt;if(this._fpsT>=1){this.fps=this._fpsF;this._fpsF=0;this._fpsT=0;}
    this.camera.update(dt);this.particles.update();
    this.tweens=this.tweens.filter(t=>{t.update(dt);return!t.done;});
    this.scene?.update?.(dt);this.input.clearFrame();
    const ctx=this.renderer.ctx;ctx.save();
    this.camera.apply(ctx);
    this.scene?.draw?.(this.renderer);
    this.particles.draw(ctx);
    ctx.restore();
  }
  resize(){this.renderer.resize();}
}
