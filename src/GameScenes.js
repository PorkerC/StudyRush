import { Scene, M, CBtn, ArcadeBG } from "./GameEngine.js";

const C = {
  bg:"#07070f",text:"#f0f0ff",muted:"rgba(255,255,255,.4)",
  y:"#fbbf24",r:"#f87171",g:"#34d399",b:"#60a5fa",p:"#c084fc",o:"#fb923c",
};
const CCOLS = ["#34d399","#fbbf24","#60a5fa","#fff","#a3e635"];
const WCOLS  = ["#f87171","#fb923c"];
const LETS   = ["A","B","C","D"];

// ── SHARED: COUNTDOWN ─────────────────────────────────────────────────────────
class Base extends Scene {
  _initCD(label,col,onDone){
    this._cdLabel=label;this._cdCol=col;this._cdDone=onDone;
    this._cdN=3;this._cdT=0;this._cdI=0.88;this._cdSc=0;this._cdAl=1;
  }
  _updateCD(dt){
    this._cdT+=dt;
    const t=this._cdT/this._cdI;
    this._cdSc=M.ease.outBack(Math.min(t,1));
    this._cdAl=Math.max(0,1-Math.pow(Math.max(0,t-.5)/.5,2));
    if(this._cdT>=this._cdI){this._cdT=0;this._cdN--;this._cdN>0?this.audio.play("countdown"):(this.audio.play("go"),this._phase="play",this._cdDone?.());}
  }
  _drawCD(r){
    const{W,H}=r,ctx=r.ctx;
    // Arcade BG
    if(this._bg){this._bg.draw(ctx,W,H);}else{r.clear(C.bg);}
    // Vignette
    r.vignette(.5);
    // Ring
    ctx.save();ctx.translate(W/2,H/2);
    ctx.globalAlpha=.14*this._cdAl;
    r.circle(0,0,100*this._cdSc,null,this._cdCol,2);
    ctx.globalAlpha=this._cdAl;
    const num=this._cdN>0?String(this._cdN):"GO!";
    ctx.scale(this._cdSc,this._cdSc);
    ctx.shadowColor=this._cdCol;ctx.shadowBlur=35;
    ctx.font=`900 ${this._cdN>0?100:62}px 'Bebas Neue',sans-serif`;
    ctx.fillStyle=this._cdCol;ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(num,0,0);ctx.restore();
    // Label
    r.text(this._cdLabel,W/2,60,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    r.scanlines(.02);
  }
  _drawHUD(r,score,qIdx,qTotal,col){
    const{W,H}=r;
    r.text(String(score),W/2,H*.1,{s:36,w:"900",c:col,glow:col,gb:14,a:"center"});
    r.bar(W*.08,H*.17,W*.84,5,qIdx/qTotal,"rgba(255,255,255,.08)",col,3,col);
    r.text(`${qIdx+1}/${qTotal}`,W*.95,H*.17,{s:10,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"right",b:"middle"});
  }
  _drawQ(r,question){
    const{W,H}=r;
    r.textWrap(question,W/2,H*.23,W*.84,{s:16,w:"700",c:C.text,a:"center",b:"top",lh:24});
  }
  _popupUpdate(dt){
    this._popups=(this._popups||[]).map(p=>({...p,y:p.y-55*dt,a:p.a-dt*1.6})).filter(p=>p.a>0);
  }
  _popupDraw(r){
    const ctx=r.ctx;
    (this._popups||[]).forEach(p=>{
      ctx.save();ctx.globalAlpha=p.a;
      r.text(p.txt,p.x,p.y,{s:18,w:"900",c:p.col,glow:p.col,gb:10,a:"center"});
      ctx.restore();
    });
  }
  _popup(x,y,txt,col){(this._popups=this._popups||[]).push({x,y,txt,col,a:1});}
}

// ── RESULT SCENE ──────────────────────────────────────────────────────────────
export class ResultScene extends Scene {
  constructor(score,stats,col,icon,title,onContinue){
    super();this._score=score;this._stats=stats;this._col=col;this._icon=icon;this._title=title;this._cont=onContinue;
    this._anim=0;this._disp=0;this._btn=null;this._bg=null;
  }
  init(){
    this.audio.play("levelUp");
    const{W,H}=this.renderer;
    this._bg=new ArcadeBG();
    this.particles.burst(W/2,H*.3,{count:60,colors:[this._col,"#fff","#fbbf24"],maxSpd:12,glow:true,ay:.12});
    this._btn=new CBtn(W/2,H*.83,210,52,"Continue →",{col:this._col,txtCol:"#0a0a14",glow:true,onClick:this._cont});
  }
  update(dt){
    this._anim=Math.min(this._anim+dt*1.8,1);
    this._disp=Math.round(M.ease.outQ(this._anim)*this._score);
    this._bg?.update(dt,this.renderer.H);
    this._btn.update(this.input);
  }
  draw(r){
    const{W,H}=r,ctx=r.ctx,a=this._anim;
    this._bg?.draw(ctx,W,H);
    r.vignette(.6);
    // Glow
    ctx.save();ctx.globalAlpha=.1*a;
    const g=r.rgrad(W/2,H*.35,0,W/2,H*.35,W*.6,[[0,this._col],[1,"transparent"]]);
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();
    // Icon
    const isc=M.ease.outBack(Math.min(a*1.4,1));
    ctx.save();ctx.translate(W/2,H*.18);ctx.scale(isc,isc);
    ctx.font="60px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(this._icon,0,0);ctx.restore();
    // Title
    r.text(this._title,W/2,H*.33,{s:30,w:"900",c:this._col,f:"'Bebas Neue',sans-serif",glow:this._col,gb:18,a:"center"});
    // Score
    ctx.save();ctx.globalAlpha=a;ctx.shadowColor=this._col;ctx.shadowBlur=16;
    ctx.font="900 54px 'Sora',sans-serif";ctx.fillStyle="#fff";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(this._disp,W/2,H*.48);ctx.restore();
    // Stats
    if(this._stats){
      const entries=Object.entries(this._stats),sw=Math.min(110,(W-40)/entries.length-10),gap=8;
      let sx=W/2-(entries.length*(sw+gap)-gap)/2+sw/2;
      entries.forEach(([lbl,val])=>{
        r.rr(sx-sw/2,H*.6-27,sw,54,12,"rgba(255,255,255,.06)","rgba(255,255,255,.1)");
        r.text(String(val),sx,H*.6-5,{s:20,w:"900",c:C.text,a:"center"});
        r.text(lbl,sx,H*.6+17,{s:9,w:"600",c:C.muted,f:"'Space Mono',monospace",a:"center"});
        sx+=sw+gap;
      });
    }
    this._btn.draw(r);
    r.scanlines(.02);r.vignette(.35);
  }
}

// ═══════════════════════════════════════════════════════════
// ⚡ LIGHTNING TAP
// ═══════════════════════════════════════════════════════════
export class LightningTap extends Base {
  constructor(qs,onFinish){super();this.qs=qs;this.onFinish=onFinish;}
  init(){
    this._phase="cd";this._bg=new ArcadeBG();
    this._initCD("⚡ LIGHTNING TAP",C.y,()=>this._start());
    this.audio.play("countdown");
    this.qIdx=0;this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;this.misses=0;
    this.showMs=1400;this._visible=false;this._visT=0;this._ansRes=null;this._resT=0;
    this._btns=[];this._flash=0;this._flashCol=C.g;this._popups=[];this._comboAnim=0;
    this._tRatio=1;this._needBuild=false;
  }
  _start(){this._visible=true;this._visT=this.showMs/1000;this._needBuild=true;}
  get q(){return this.qs[this.qIdx];}
  _build(){
    if(!this.q)return;
    const{W,H}=this.renderer;
    const bw=Math.min(W*.44,200),bh=54,gap=10;
    this._btns=(this.q.options||[]).map((opt,i)=>{
      const col=i%2,row=Math.floor(i/2);
      const x=W/2+(col===0?-1:1)*(bw/2+gap/2);
      const y=H*.6+row*(bh+10);
      return{opt,ok:opt.startsWith(this.q.answer),x,y,w:bw,h:bh,let:LETS[i],scale:1,ts:1,hover:false,text:opt.replace(/^[A-D]\.\s*/,"").slice(0,28)};
    });
  }
  update(dt){
    if(this._phase==="cd"){this._bg?.update(dt,this.renderer.H);this._updateCD(dt);return;}
    const{W,H}=this.renderer;
    this._bg?.update(dt,H);
    if(this._needBuild){this._needBuild=false;this._build();}
    this._flash=Math.max(0,this._flash-dt*4);
    this._comboAnim=Math.max(0,this._comboAnim-dt*3);
    this._popupUpdate(dt);
    if(this._ansRes!==null){this._resT-=dt;if(this._resT<=0){this._ansRes=null;this._next();}return;}
    if(this._visible){
      this._visT-=dt;this._tRatio=Math.max(0,this._visT/(this.showMs/1000));
      if(this._visT<=0){this._visible=false;this._onMiss();return;}
    }
    this._btns.forEach(b=>{
      b.hover=this.input.hit(b.x-b.w/2,b.y-b.h/2,b.w,b.h);
      b.ts=b.hover?1.05:1;b.scale=M.lerp(b.scale,b.ts,.2);
      if(this.input.wasHit(b.x-b.w/2,b.y-b.h/2,b.w,b.h))this._answer(b);
    });
  }
  _answer(btn){
    const ok=btn.ok,nc=ok?this.combo+1:0;
    const spd=this.showMs/1400;
    const pts=ok?Math.round(10*(1+nc*.25)*(spd<.5?1.5:1)):0;
    this.combo=nc;if(nc>this.maxCombo)this.maxCombo=nc;
    if(ok){this.score+=pts;this.hits++;this.audio.play(nc>=3?"combo":"tap");this._flash=.15;this._flashCol=C.g;this._popup(btn.x,btn.y-10,`+${pts}`,C.g);this.particles.burst(btn.x,btn.y,{count:18,colors:CCOLS,maxSpd:7,glow:true});if(nc>=3){this._comboAnim=1;this.camera.shake(4,.2);}}
    else{this.misses++;this.audio.play("miss");this._flash=.12;this._flashCol=C.r;this.camera.shake(6,.25);this.particles.burst(btn.x,btn.y,{count:12,colors:WCOLS,maxSpd:5});}
    this._ansRes=ok?"hit":"miss";this._resT=.45;this._visible=false;
    if(ok)this.showMs=Math.max(300,this.showMs-65);
  }
  _onMiss(){this.misses++;this.combo=0;this.audio.play("miss");this._flash=.12;this._flashCol=C.r;this.camera.shake(5,.2);this._ansRes="timeout";this._resT=.5;}
  _next(){this.qIdx++;if(this.qIdx>=this.qs.length){this._finish();return;}this._visible=true;this._visT=this.showMs/1000;this._tRatio=1;this._build();}
  _finish(){this.audio.play("streak");this.onFinish(this.score,{"Hits":this.hits,"Misses":this.misses,"Max Combo":this.maxCombo});}
  draw(r){
    const{W,H}=r,ctx=r.ctx;
    if(this._phase==="cd"){this._drawCD(r);return;}
    this._bg?.draw(ctx,W,H);
    r.vignette(.55);
    if(this._flash>0)r.flash(this._flashCol,this._flash);
    r.text("⚡ LIGHTNING TAP",W/2,36,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    this._drawHUD(r,this.score,this.qIdx,this.qs.length,C.y);
    if(this.combo>=2){const cs=1+this._comboAnim*.4;ctx.save();ctx.translate(W/2,H*.21);ctx.scale(cs,cs);r.text(`🔥 x${this.combo} COMBO`,0,0,{s:14,w:"800",c:C.o,glow:C.o,gb:10,a:"center"});ctx.restore();}
    const tCol=this._tRatio>.5?C.g:this._tRatio>.25?C.y:C.r;
    r.bar(W*.08,H*.32,W*.84,10,this._tRatio,"rgba(255,255,255,.07)",tCol,5,tCol);
    if(this.q)this._drawQ(r,this.q.question);
    if(this._visible){
      this._btns.forEach(b=>{
        ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.scale,b.scale);
        r.rr(-b.w/2,-b.h/2,b.w,b.h,12,b.hover?"rgba(251,191,36,.12)":"rgba(255,255,255,.06)",b.hover?C.y:"rgba(255,255,255,.14)",b.hover?1.5:1);
        r.rr(-b.w/2+8,-14,26,28,6,"rgba(255,255,255,.1)");
        r.text(b.let,-b.w/2+21,0,{s:11,w:"700",c:b.hover?C.y:C.muted,f:"'Space Mono',monospace",a:"center"});
        r.text(b.text,10,0,{s:13,w:"600",c:b.hover?C.y:C.text,a:"left",b:"middle"});
        ctx.restore();
      });
    } else if(this._ansRes){
      const ok=this._ansRes==="hit";
      ctx.save();ctx.translate(W/2,H*.62+20);
      ctx.font="52px serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(ok?"✅":this._ansRes==="timeout"?"⏰":"❌",0,0);
      r.text(ok?`+${Math.round(10*(1+this.combo*.25))} pts`:this._ansRes==="timeout"?"TOO SLOW!":"WRONG!",0,48,{s:16,w:"800",c:ok?C.g:C.r,glow:ok?C.g:C.r,gb:12,a:"center"});
      ctx.restore();
    }
    this._popupDraw(r);r.scanlines(.022);
  }
}

// ═══════════════════════════════════════════════════════════
// 🎯 AIM TRAINER
// ═══════════════════════════════════════════════════════════
export class AimTrainer extends Base {
  constructor(qs,onFinish){super();this.qs=qs;this.onFinish=onFinish;}
  init(){
    this._phase="cd";this._bg=new ArcadeBG();
    this._initCD("🎯 AIM TRAINER",C.o,()=>this._start());
    this.audio.play("countdown");
    this.qIdx=0;this.score=0;this.hits=0;this.misses=0;
    this._targets=[];this._flash=0;this._flashCol=C.g;this._popups=[];this._needSpawn=false;
    this._animId=null;
  }
  _start(){this._needSpawn=true;}
  get q(){return this.qs[this.qIdx];}
  _spawn(){
    if(!this.q)return;
    const{W,H}=this.renderer,m=65;
    this._targets=(this.q.options||[]).map((opt,i)=>{
      const ok=opt.startsWith(this.q.answer),r=ok?34:25;
      return{opt,ok,r,let:LETS[i],x:M.rand(m+r,W-m-r),y:M.rand(H*.38+r,H-90-r),vx:M.rand(-1.2,1.2)*(ok?.8:1.2),vy:M.rand(-1,1)*(ok?.8:1.2),pulse:Math.random()*Math.PI*2,scale:1,ring:1,col:ok?C.g:C.r};
    });
  }
  update(dt){
    if(this._phase==="cd"){this._bg?.update(dt,this.renderer.H);this._updateCD(dt);return;}
    const{W,H}=this.renderer;
    this._bg?.update(dt,H);
    if(this._needSpawn){this._needSpawn=false;this._spawn();}
    this._flash=Math.max(0,this._flash-dt*4);
    this._popupUpdate(dt);
    this._targets.forEach(t=>{
      t.x+=t.vx;t.y+=t.vy;
      if(t.x-t.r<0||t.x+t.r>W){t.vx*=-1;t.x=M.clamp(t.x,t.r,W-t.r);}
      if(t.y-t.r<0||t.y+t.r>H){t.vy*=-1;t.y=M.clamp(t.y,t.r,H-t.r);}
      t.pulse+=dt*3;t.ring=Math.max(0,t.ring-dt*2);t.scale=M.lerp(t.scale,1,.15);
      if(this.input.wasCircle(t.x,t.y,t.r+10))this._hit(t);
    });
  }
  _hit(t){
    const ok=t.ok;
    if(ok){this.score+=20;this.hits++;this.audio.play("tap");this._flash=.15;this._flashCol=C.g;this.particles.burst(t.x,t.y,{count:22,colors:CCOLS,maxSpd:8,glow:true});this._popup(t.x,t.y-20,"+20",C.g);this.camera.shake(3,.15);this._targets=this._targets.filter(x=>x!==t);this.qIdx++;if(this.qIdx>=this.qs.length){this._finish();return;}setTimeout(()=>{this._needSpawn=true;},300);}
    else{this.misses++;this.audio.play("miss");this._flash=.1;this._flashCol=C.r;t.scale=.8;this.camera.shake(5,.2);this.particles.burst(t.x,t.y,{count:10,colors:WCOLS,maxSpd:5});this._popup(t.x,t.y-20,"-5",C.r);this.score=Math.max(0,this.score-5);}
  }
  _finish(){this.audio.play("streak");const acc=Math.round(this.hits/(this.hits+this.misses||1)*100);this.onFinish(this.score,{"Hits":this.hits,"Misses":this.misses,"Accuracy":`${acc}%`});}
  draw(r){
    const{W,H}=r,ctx=r.ctx;
    if(this._phase==="cd"){this._drawCD(r);return;}
    this._bg?.draw(ctx,W,H);r.vignette(.55);
    if(this._flash>0)r.flash(this._flashCol,this._flash);
    r.text("🎯 AIM TRAINER",W/2,36,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    this._drawHUD(r,this.score,this.qIdx,this.qs.length,C.o);
    if(this.q)this._drawQ(r,this.q.question);
    this._targets.forEach(t=>{
      ctx.save();ctx.translate(t.x,t.y);ctx.scale(t.scale,t.scale);
      if(t.ring>0){ctx.globalAlpha=t.ring*.5;ctx.beginPath();ctx.arc(0,0,t.r*(1+(1-t.ring)*1.5),0,Math.PI*2);ctx.strokeStyle=t.col;ctx.lineWidth=1.5;ctx.stroke();ctx.globalAlpha=1;}
      const pls=Math.sin(t.pulse)*.15+.85;
      ctx.globalAlpha=.18*pls;ctx.beginPath();ctx.arc(0,0,t.r*1.5,0,Math.PI*2);ctx.fillStyle=t.col;ctx.fill();ctx.globalAlpha=1;
      ctx.shadowColor=t.col;ctx.shadowBlur=t.ok?18:10;
      ctx.beginPath();ctx.arc(0,0,t.r,0,Math.PI*2);ctx.fillStyle=t.ok?"rgba(52,211,153,.18)":"rgba(248,113,113,.1)";ctx.fill();ctx.strokeStyle=t.col;ctx.lineWidth=t.ok?2.5:1.5;ctx.stroke();
      [t.r*.4,t.r*.72].forEach(rr=>{ctx.beginPath();ctx.arc(0,0,rr,0,Math.PI*2);ctx.strokeStyle=t.col;ctx.lineWidth=.5;ctx.globalAlpha=.35;ctx.stroke();ctx.globalAlpha=1;});
      ctx.shadowBlur=0;
      r.text(t.let,0,0,{s:t.ok?15:12,w:"700",c:t.col,a:"center",b:"middle",f:"'Space Mono',monospace"});
      ctx.restore();
    });
    this._popupDraw(r);r.scanlines(.02);
  }
}

// ═══════════════════════════════════════════════════════════
// 💥 ANSWER BLITZ
// ═══════════════════════════════════════════════════════════
export class AnswerBlitz extends Base {
  constructor(qs,onFinish){super();this.qs=qs;this.onFinish=onFinish;}
  init(){
    this._phase="cd";this._bg=new ArcadeBG();
    this._initCD("💥 ANSWER BLITZ",C.r,()=>this._start());
    this.audio.play("countdown");
    this.qIdx=0;this.score=0;this.combo=0;this.maxCombo=0;this.hits=0;
    this._timeLeft=45;this._bubbles=[];this._flash=0;this._flashCol=C.g;this._popups=[];
    this._needSpawn=false;this._timerInterval=null;
  }
  _start(){this._needSpawn=true;this._timerInterval=setInterval(()=>{this._timeLeft--;if(this._timeLeft<=10)this.audio.play("tick");if(this._timeLeft<=0){clearInterval(this._timerInterval);this._finish();}},1000);}
  destroy(){clearInterval(this._timerInterval);}
  get q(){return this.qs[this.qIdx];}
  _spawn(){
    if(!this.q)return;
    const{W,H}=this.renderer,m=70;
    this._bubbles=(this.q.options||[]).map((opt,i)=>({opt,ok:opt.startsWith(this.q.answer),let:LETS[i],x:M.rand(m,W-m),y:M.rand(H*.38,H-80),w:Math.min(155,W*.38),h:44,scale:0,ts:1,pulse:Math.random()*Math.PI*2,text:opt.replace(/^[A-D]\.\s*/,"").slice(0,22)}));
  }
  update(dt){
    if(this._phase==="cd"){this._bg?.update(dt,this.renderer.H);this._updateCD(dt);return;}
    this._bg?.update(dt,this.renderer.H);
    if(this._needSpawn){this._needSpawn=false;this._spawn();}
    this._flash=Math.max(0,this._flash-dt*4);this._popupUpdate(dt);
    this._bubbles.forEach(b=>{b.scale=M.lerp(b.scale,b.ts,.15);b.pulse+=dt*2;if(this.input.wasHit(b.x-b.w/2,b.y-b.h/2,b.w,b.h))this._tap(b);});
  }
  _tap(b){
    const ok=b.ok,nc=ok?this.combo+1:0,pts=ok?Math.round(15*(1+nc*.3)):0;
    this.combo=nc;if(nc>this.maxCombo)this.maxCombo=nc;
    if(ok){this.score+=pts;this.hits++;this.audio.play(nc>=3?"combo":"tap");this._flash=.12;this._flashCol=C.g;this.particles.burst(b.x,b.y,{count:18,colors:CCOLS,maxSpd:7,glow:true});this._popup(b.x,b.y-10,`+${pts}`,C.g);if(nc>=3)this.camera.shake(4,.2);this.qIdx++;if(this.qIdx>=this.qs.length){clearInterval(this._timerInterval);this._finish();return;}this._needSpawn=true;}
    else{this.combo=0;this.score=Math.max(0,this.score-5);this.audio.play("miss");this._flash=.1;this._flashCol=C.r;b.ts=.8;setTimeout(()=>{b.ts=1;},200);this.camera.shake(5,.2);this._popup(b.x,b.y-10,"-5",C.r);}
  }
  _finish(){this.audio.play("streak");this.onFinish(this.score,{"Hits":this.hits,"Combo":this.maxCombo,"Time":"45s"});}
  draw(r){
    const{W,H}=r,ctx=r.ctx;
    if(this._phase==="cd"){this._drawCD(r);return;}
    this._bg?.draw(ctx,W,H);r.vignette(.55);
    if(this._flash>0)r.flash(this._flashCol,this._flash);
    r.text("💥 ANSWER BLITZ",W/2,36,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    const tR=this._timeLeft/45,tCol=tR>.5?C.g:tR>.25?C.y:C.r;
    r.text(`⏱ ${this._timeLeft}s`,W*.18,H*.1,{s:22,w:"900",c:tCol,glow:tR<.25?C.r:null,gb:14,a:"center"});
    r.text(`💥 ${this.score}`,W*.75,H*.1,{s:22,w:"900",c:C.r,a:"center"});
    if(this.combo>=2)r.text(`🔥 x${this.combo}`,W/2,H*.1,{s:16,w:"800",c:C.o,a:"center"});
    r.bar(W*.08,H*.17,W*.84,5,tR,"rgba(255,255,255,.07)",tCol,3,tCol);
    if(this.q)this._drawQ(r,this.q.question);
    this._bubbles.forEach(b=>{
      ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.scale,b.scale);
      const pls=Math.sin(b.pulse)*.05+.95;ctx.scale(pls,pls);
      if(b.ok){ctx.shadowColor=C.g;ctx.shadowBlur=12;}
      r.rr(-b.w/2,-b.h/2,b.w,b.h,10,b.ok?"rgba(52,211,153,.14)":"rgba(255,255,255,.07)",b.ok?"rgba(52,211,153,.5)":"rgba(255,255,255,.15)",b.ok?1.5:1);
      ctx.shadowBlur=0;
      r.text(`${b.let}. ${b.text}`,0,0,{s:12,w:"700",c:b.ok?C.g:C.text,a:"center",b:"middle"});
      ctx.restore();
    });
    this._popupDraw(r);r.scanlines(.022);
  }
}

// ═══════════════════════════════════════════════════════════
// 🎵 RHYTHM REVIEW
// ═══════════════════════════════════════════════════════════
export class RhythmReview extends Base {
  constructor(qs,onFinish){super();this.qs=qs;this.onFinish=onFinish;}
  init(){
    this._phase="cd";this._bg=new ArcadeBG();
    this._initCD("🎵 RHYTHM REVIEW",C.g,()=>this._start());
    this.audio.play("countdown");
    this.qIdx=0;this.score=0;this.hits=0;this._flash=0;this._flashCol=C.g;
    this._fallers=[];this._beatT=0;this._beatOn=false;this._popups=[];this._needSpawn=false;
    this.BPM=88;this._beatMs=60000/this.BPM/1000;this._missFlash=0;this._animT=null;
  }
  _start(){this._needSpawn=true;this._animT=setInterval(()=>{this._tick();},40);}
  destroy(){clearInterval(this._animT);}
  _tick(){
    if(this._phase!=="play"||!this.q)return;
    const H=this.renderer.H,lineY=H*.82;
    this._fallers.forEach(f=>{f.y+=f.vy;});
    const miss=this._fallers.find(f=>f.ok&&f.y-f.h/2>lineY+32);
    if(miss){this._onMiss();}
    this._fallers=this._fallers.filter(f=>f.y<H+60);
  }
  get q(){return this.qs[this.qIdx];}
  _spawn(){
    if(!this.q)return;
    const{W}=this.renderer,n=this.q.options.length,bw=Math.min((W-40)/n-8,140);
    const sx=W/2-((n-1)/2)*(bw+8);
    this._fallers=(this.q.options||[]).map((opt,i)=>({opt,ok:opt.startsWith(this.q.answer),let:LETS[i],x:sx+i*(bw+8),w:bw,h:44,y:-50,vy:1.4+Math.random()*.4,text:opt.replace(/^[A-D]\.\s*/,"").slice(0,16)}));
  }
  update(dt){
    if(this._phase==="cd"){this._bg?.update(dt,this.renderer.H);this._updateCD(dt);return;}
    this._bg?.update(dt,this.renderer.H);
    if(this._needSpawn){this._needSpawn=false;this._spawn();}
    this._flash=Math.max(0,this._flash-dt*4);this._missFlash=Math.max(0,this._missFlash-dt*3);
    this._beatT+=dt;if(this._beatT>=this._beatMs){this._beatT=0;this._beatOn=!this._beatOn;if(this._beatOn)this.audio.play("beat");}
    this._popupUpdate(dt);
    this._fallers.forEach(f=>{if(this.input.wasHit(f.x-f.w/2,f.y-f.h/2,f.w,f.h))this._tap(f);});
  }
  _tap(f){
    const ok=f.ok;
    if(ok){this.score+=12;this.hits++;this.audio.play("hitBeat");this._flash=.12;this._flashCol=C.g;this.particles.burst(f.x,f.y,{count:16,colors:CCOLS,maxSpd:6,glow:true});this._popup(f.x,f.y-10,"+12",C.g);this.camera.shake(3,.15);this.qIdx++;if(this.qIdx>=this.qs.length){this._finish();return;}this._fallers=[];setTimeout(()=>{this._needSpawn=true;},400);}
    else{this.audio.play("miss");this._flash=.08;this._flashCol=C.r;this._popup(f.x,f.y,"WRONG",C.r);this.camera.shake(4,.2);}
  }
  _onMiss(){this.audio.play("miss");this._missFlash=.15;this.qIdx++;if(this.qIdx>=this.qs.length){this._finish();return;}this._fallers=[];setTimeout(()=>{this._needSpawn=true;},400);}
  _finish(){this.audio.play("streak");this.onFinish(this.score,{"Hits":this.hits,"Completion":`${Math.round(this.hits/this.qs.length*100)}%`});}
  draw(r){
    const{W,H}=r,ctx=r.ctx;
    if(this._phase==="cd"){this._drawCD(r);return;}
    this._bg?.draw(ctx,W,H);r.vignette(.55);
    if(this._flash>0)r.flash(this._flashCol,this._flash);
    if(this._missFlash>0)r.flash(C.r,this._missFlash);
    // Beat pulse bg
    ctx.save();ctx.globalAlpha=this._beatOn?.04:.02;
    const g2=r.rgrad(W/2,H*.6,0,W/2,H*.6,W*.5,[[0,C.g],[1,"transparent"]]);
    ctx.fillStyle=g2;ctx.fillRect(0,0,W,H);ctx.restore();
    r.text("🎵 RHYTHM REVIEW",W/2,36,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    r.text(`🎵 ${this.score}`,W/2,H*.1,{s:28,w:"900",c:C.g,glow:C.g,gb:12,a:"center"});
    const beatSz=this._beatOn?15:10;r.circle(W-30,H*.1,beatSz,C.g.replace(")",",.8)").replace("#34d399","rgba(52,211,153"));
    r.circle(W-30,H*.1,beatSz,"rgba(52,211,153,.8)");
    r.bar(W*.08,H*.17,W*.84,5,this.qIdx/this.qs.length,"rgba(255,255,255,.07)",C.g,3,C.g);
    if(this.q)this._drawQ(r,this.q.question);
    // Hit line
    const lineY=H*.82;
    ctx.save();ctx.shadowColor=C.g;ctx.shadowBlur=this._beatOn?14:7;
    ctx.strokeStyle=C.g;ctx.lineWidth=this._beatOn?2.5:1.5;ctx.setLineDash([8,6]);
    ctx.beginPath();ctx.moveTo(W*.06,lineY);ctx.lineTo(W*.94,lineY);ctx.stroke();ctx.restore();
    // Fallers
    this._fallers.forEach(f=>{
      ctx.save();ctx.translate(f.x,f.y);
      if(f.ok){ctx.shadowColor=C.g;ctx.shadowBlur=10;}
      r.rr(-f.w/2,-f.h/2,f.w,f.h,10,f.ok?"rgba(52,211,153,.15)":"rgba(255,255,255,.07)",f.ok?"rgba(52,211,153,.5)":"rgba(255,255,255,.15)",f.ok?1.5:1);
      ctx.shadowBlur=0;
      r.text(`${f.let}. ${f.text}`,0,0,{s:11,w:"700",c:f.ok?C.g:C.text,a:"center",b:"middle"});
      ctx.restore();
    });
    // Keyboard buttons
    const bw2=(W*.84)/4,bx2=W*.08;
    (this.q?.options||[]).forEach((opt,i)=>{
      const bx=bx2+i*(bw2+2),by=H-52;
      r.rr(bx,by,bw2-2,40,8,"rgba(255,255,255,.05)","rgba(255,255,255,.1)");
      r.text(LETS[i],bx+bw2/2-1,by+20,{s:13,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center",b:"middle"});
      if(this.input.wasHit(bx,by,bw2-2,40)){const f2=this._fallers.find(f=>f.let===LETS[i]);if(f2)this._tap(f2);}
    });
    this._popupDraw(r);r.scanlines(.022);
  }
}

// ═══════════════════════════════════════════════════════════
// 🏎️ SPEED RUN
// ═══════════════════════════════════════════════════════════
export class SpeedRun extends Base {
  constructor(qs,onFinish){super();this.qs=qs;this.onFinish=onFinish;}
  init(){
    this._phase="cd";this._bg=new ArcadeBG();
    this._initCD("🏎️ SPEED RUN",C.b,()=>this._start());
    this.audio.play("countdown");
    this.qIdx=0;this.score=0;this._spd=20;this._progress=0;
    this._flash=0;this._flashCol=C.g;this._fb=null;this._fbT=0;
    this._btns=[];this._road=0;this._carB=0;this._popups=[];this._needBuild=false;
  }
  _start(){this._needBuild=true;}
  get q(){return this.qs[this.qIdx];}
  _build(){
    if(!this.q)return;
    const{W,H}=this.renderer,bw=Math.min(W*.44,200),bh=52,gap=10;
    this._btns=(this.q.options||[]).map((opt,i)=>{
      const col2=i%2,row=Math.floor(i/2);
      const x=W/2+(col2===0?-1:1)*(bw/2+gap/2);
      const y=H*.67+row*(bh+10);
      return{opt,ok:opt.startsWith(this.q.answer),let:LETS[i],x,y,w:bw,h:bh,scale:1,ts:1,hover:false,text:opt.replace(/^[A-D]\.\s*/,"").slice(0,26)};
    });
  }
  update(dt){
    if(this._phase==="cd"){this._bg?.update(dt,this.renderer.H);this._updateCD(dt);return;}
    this._bg?.update(dt,this.renderer.H);
    if(this._needBuild){this._needBuild=false;this._build();}
    this._flash=Math.max(0,this._flash-dt*4);this._popupUpdate(dt);
    this._progress=Math.min(1,this._progress+this._spd/6000);
    this._road=(this._road+this._spd*dt*2)%80;
    this._carB+=dt*this._spd*.15;
    if(this._progress>=1){this._finish();return;}
    if(this._fb){this._fbT-=dt;if(this._fbT<=0){this._fb=null;this._needBuild=true;}return;}
    this._btns.forEach(b=>{
      b.hover=this.input.hit(b.x-b.w/2,b.y-b.h/2,b.w,b.h);
      b.ts=b.hover?1.04:1;b.scale=M.lerp(b.scale,b.ts,.2);
      if(this.input.wasHit(b.x-b.w/2,b.y-b.h/2,b.w,b.h))this._answer(b);
    });
  }
  _answer(b){
    const ok=b.ok;
    if(ok){this._spd=Math.min(this._spd+6,80);this.score+=Math.round(this._spd);this.audio.play("boost");this._flash=.12;this._flashCol=C.g;this._fb={ok:true,text:"BOOST! 🚀"};this._popup(this.renderer.W/2,this.renderer.H*.5,`+${Math.round(this._spd)}`,C.g);this.camera.shake(2,.1);}
    else{this._spd=Math.max(this._spd-10,5);this.audio.play("brake");this._flash=.1;this._flashCol=C.r;this._fb={ok:false,text:"BRAKE! 🛑"};this.camera.shake(6,.3);}
    this._fbT=.55;this.qIdx++;if(this.qIdx>=this.qs.length)this._finish();
  }
  _finish(){this.audio.play("jackpot");this.onFinish(this.score,{"Top Speed":`${Math.round(this._spd)}km/h`,"Questions":this.qs.length});}
  draw(r){
    const{W,H}=r,ctx=r.ctx;
    if(this._phase==="cd"){this._drawCD(r);return;}
    this._bg?.draw(ctx,W,H);r.vignette(.5);
    if(this._flash>0)r.flash(this._flashCol,this._flash);
    // Road
    const roadY=H*.43,roadH=H*.22;
    r.rr(0,roadY,W,roadH,0,"#111118");
    ctx.save();ctx.strokeStyle="rgba(251,191,36,.3)";ctx.lineWidth=3;ctx.setLineDash([40,40]);ctx.lineDashOffset=-this._road;
    ctx.beginPath();ctx.moveTo(0,roadY+roadH/2);ctx.lineTo(W,roadY+roadH/2);ctx.stroke();ctx.restore();
    ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=1.5;ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(0,roadY);ctx.lineTo(W,roadY);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,roadY+roadH);ctx.lineTo(W,roadY+roadH);ctx.stroke();
    // Car trail
    const carX=W*.08+this._progress*(W*.84),carY=roadY+roadH/2+Math.sin(this._carB)*2;
    for(let i=1;i<=4;i++){ctx.save();ctx.globalAlpha=.07*this._spd/80*(1-i/5);ctx.font="26px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🏎️",carX-i*13*this._spd/40,carY);ctx.restore();}
    ctx.font="30px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("🏎️",carX,carY);
    ctx.font="22px serif";ctx.fillText("🏁",W*.96,carY);
    // HUD
    r.text("🏎️ SPEED RUN",W/2,36,{s:14,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"center"});
    const sR=this._spd/80,sCol=sR>.6?C.g:sR>.3?C.y:C.r;
    r.bar(W*.08,H*.13,W*.45,8,sR,"rgba(255,255,255,.07)",sCol,4,sCol);
    r.text(`${Math.round(this._spd)} km/h`,W*.08,H*.17,{s:11,w:"700",c:sCol,a:"left"});
    r.text(`🏎️ ${this.score}`,W*.78,H*.12,{s:20,w:"900",c:C.b,glow:C.b,gb:10,a:"center"});
    r.bar(W*.08,H*.22,W*.84,5,this._progress,"rgba(255,255,255,.07)",C.b,3,C.b);
    r.text(`Q${this.qIdx}/${this.qs.length}`,W*.94,H*.22,{s:10,w:"700",c:C.muted,f:"'Space Mono',monospace",a:"right",b:"middle"});
    if(this.q&&!this._fb)this._drawQ(r,this.q.question);
    if(!this._fb){
      this._btns.forEach(b=>{
        ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.scale,b.scale);
        r.rr(-b.w/2,-b.h/2,b.w,b.h,12,b.hover?"rgba(96,165,250,.12)":"rgba(255,255,255,.06)",b.hover?C.b:"rgba(255,255,255,.14)",b.hover?1.5:1);
        r.rr(-b.w/2+8,-14,26,28,6,"rgba(255,255,255,.1)");
        r.text(b.let,-b.w/2+21,0,{s:11,w:"700",c:b.hover?C.b:C.muted,f:"'Space Mono',monospace",a:"center"});
        r.text(b.text,10,0,{s:13,w:"600",c:b.hover?C.b:C.text,a:"left",b:"middle"});
        ctx.restore();
      });
    }
    if(this._fb){
      const sc=M.ease.outBack(Math.min((0.55-this._fbT)/0.55*2,1));
      ctx.save();ctx.translate(W/2,H*.75);ctx.scale(sc,sc);
      r.text(this._fb.text,0,0,{s:28,w:"900",c:this._fb.ok?C.g:C.r,glow:this._fb.ok?C.g:C.r,gb:14,a:"center"});
      ctx.restore();
    }
    this._popupDraw(r);r.scanlines(.022);
  }
}
