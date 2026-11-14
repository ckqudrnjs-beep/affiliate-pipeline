// 딱 멈춰! v2 (2026-11-14 디자인 개편): 네온 게이지 오락기. 규칙·점수·같은 판 그대로(칸 위치 seeded('stop'+KST), 속도 38+단계×7 %/초).
// 그림·소리 모두 코드로 생성.
(function(){
const $=id=>document.getElementById(id),cab=$('st'),c=$('st-cv'),x=c.getContext('2d');
const FN='"Press Start 2P",monospace',FK='"Black Han Sans",system-ui,sans-serif';
let R,lv=0,score=0,pos=0,dir=1,speed=38,zw=26,zx=37,run=false,over=true,started=false,last=0,best=0;
let W=0,H=0,d=1,fx=[],texts=[],shake=0,flash=0,flashC='#fff',zAnim=1,ozx=37,ozw=26,trail=[],perf=0,BAR='',FX='';
try{best=+localStorage.getItem('st_best_'+KST)||0}catch(e){}
function size(){d=Math.min(devicePixelRatio||1,2);W=cab.clientWidth;H=cab.clientHeight;c.width=W*d;c.height=H*d}
/* 소리 */
let A=null;function ac(){if(!A){const C=window.AudioContext||window.webkitAudioContext;if(C)try{A=new C()}catch(e){}}if(A&&A.state==='suspended')A.resume()}
function tone(f,dur,a,type,f2,dl){if(!A)return;const t=A.currentTime+(dl||0),o=A.createOscillator(),g=A.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*.8);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.005);g.gain.exponentialRampToValueAtTime(.0005,t+dur);o.connect(g);g.connect(A.destination);o.start(t);o.stop(t+dur+.02)}
const midi=n=>440*Math.pow(2,(n-69)/12),SC=[0,2,4,7,9,12,14,16,19,21,24];
function setZone(){ozx=zx;ozw=zw;zAnim=0;zw=Math.max(5,26-lv*1.6);zx=5+R()*(90-zw);speed=38+lv*7}
function look(){BAR=window.Bonus?Bonus.gitem('stop','bar'):'';FX=window.Bonus?Bonus.gitem('stop','fx'):''}
function start(){look();R=seeded('stop'+KST);lv=0;score=0;pos=0;dir=1;over=false;started=true;perf=0;setZone();zAnim=1;run=true;last=performance.now();fx=[];texts=[];$('st-res').hidden=true;tone(523,.12,.1,'triangle');tone(784,.15,.1,'triangle',null,.08)}
// 화면 좌표: 게이지
function G(){const gx=W*.07,gw=W*.86,gy=H*.5,gh=Math.max(46,H*.11);return{gx,gw,gy,gh}}
function px(p){const g=G();return g.gx+g.gw*p/100}
function hit(){ac();if(over){start();return}const cz=zx+zw/2,g=G(),bx=px(pos);
 if(pos>=zx&&pos<=zx+zw){const p=Math.round(100-Math.abs(pos-cz)/(zw/2)*60);score+=p;lv++;
  const pf=p>=90;perf=pf?perf+1:0;texts.push({x:bx,y:g.gy-g.gh*.9,s:(pf?'PERFECT ':'')+'+'+p,col:pf?'#ffd23f':'#3ddc84',t:0,big:pf});
  if(pf&&perf>=2)texts.push({x:W/2,y:H*.3,s:perf+' 연속 완벽!',col:'#ff3d9a',t:0,ui:1});
  const n=SC[Math.min(SC.length-1,lv%11)];tone(midi(72+n),.16,.14,'triangle');if(pf){tone(midi(84+n),.22,.08,'sine',null,.05)}
  burst(bx,g.gy,pf?28:16,pf?'#ffd23f':'#3ddc84');flash=pf?.35:.18;flashC=pf?'#ffd23f':'#3ddc84';setZone()}
 else{run=false;over=true;shake=.7;flash=.5;flashC='#ff4d4d';tone(160,.4,.18,'sawtooth',60);burst(bx,g.gy,36,'#ff4d4d');
  const nb=score>best;if(nb){best=score;try{localStorage.setItem('st_best_'+KST,score)}catch(e){}}
  $('st-rs').innerHTML=(nb&&score?'<b class="nb">NEW BEST</b> ':'')+'<b>'+score+'점</b> · '+lv+'단계 · 오늘 최고 '+best+'점';$('st-res').hidden=false;
  if(window.submitScore)submitScore(score)}}
function burst(X,Y,n,col){const shape=FX==='heart'?'h':FX==='star'?'s':'';for(let i=0;i<n;i++){const a=Math.random()*6.283,v=80+Math.random()*260;fx.push({x:X,y:Y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-80,t:0,l:.5+Math.random()*.5,col:shape?(i%2?'#fff':(FX==='heart'?'#ff5fa8':'#ffd23f')):col,sh:shape,s:shape?8+Math.random()*6:3})}}
$('st-again').onclick=e=>{e.stopPropagation();start()};
$('st-sh').onclick=e=>{e.stopPropagation();shareText('5락실 딱 멈춰! '+KST.slice(5)+'\n🎯 '+lv+'단계 '+score+'점. 이겨 볼래?\n'+challengeUrl(score))};
cab.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();hit()});
addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();hit()}});
const THM=[['#120630','#3a0c4f','#ff7a59'],['#05122e','#0b3a5a','#22d3ee'],['#0a0420','#2a0b45','#b06bff'],['#0b1a10','#0a3a2a','#3ddc84'],['#1a0610','#4a0c2a','#ff3d9a']];
function star(cx,cy,r){x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*.6283,rr=i%2?r*.45:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr)}x.closePath();x.fill()}
function heart(cx,cy,r){x.beginPath();x.moveTo(cx,cy+r*.8);x.bezierCurveTo(cx-r*1.4,cy-r*.2,cx-r*.6,cy-r*1.2,cx,cy-r*.4);x.bezierCurveTo(cx+r*.6,cy-r*1.2,cx+r*1.4,cy-r*.2,cx,cy+r*.8);x.fill()}
function draw(now){requestAnimationFrame(draw);const rdt=(now-last)/1000,dt=Math.min(.05,rdt);last=now;if(cab.clientWidth!==W||cab.clientHeight!==H)size();
 if(run){pos+=dir*speed*rdt;let b=0;if(pos>99){pos=99;dir=-1;b=1}if(pos<0){pos=0;dir=1;b=1}if(b)tone(1800,.03,.03,'square')}
 x.setTransform(d,0,0,d,0,0);const T=now/1000,th=THM[Math.floor(lv/5)%THM.length],g=G();
 x.save();if(shake>0){x.translate((Math.random()-.5)*18*shake,(Math.random()-.5)*18*shake);shake=Math.max(0,shake-dt*1.6)}
 // 배경: 단계 5마다 색이 바뀌는 하늘 + 빛 + 아래 원근 격자
 const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,th[0]);bg.addColorStop(1,th[1]);x.fillStyle=bg;x.fillRect(-20,-20,W+40,H+40);
 const gl=(X,Y,r,col,a)=>{const gg=x.createRadialGradient(X,Y,0,X,Y,r);gg.addColorStop(0,col);gg.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=a;x.fillStyle=gg;x.fillRect(X-r,Y-r,r*2,r*2);x.globalAlpha=1};
 gl(W*.5,H*.5,W*.7,th[2],.16);
 x.fillStyle='#ffffff';for(let i=0;i<40;i++){const sx=(i*97.3)%W,sy=(i*53.7)%(H*.4);x.globalAlpha=.25+.25*Math.sin(T*2+i);x.fillRect(sx,sy,1.5,1.5)}x.globalAlpha=1;
 x.strokeStyle=th[2];x.globalAlpha=.2;x.lineWidth=1;const hz=H*.74;x.beginPath();for(let i=-10;i<=10;i++){x.moveTo(W/2+i*W*.05,hz);x.lineTo(W/2+i*W*.28,H)}for(let k=0;k<6;k++){const yy=hz+(H-hz)*Math.pow(((k+T*.5)%6)/6,2);x.moveTo(0,yy);x.lineTo(W,yy)}x.stroke();x.globalAlpha=1;
 // 위쪽 정보
 x.textAlign='center';x.textBaseline='middle';
 x.font=`${Math.round(Math.min(W,H)*.07)}px ${FN}`;x.fillStyle='#ffd23f';x.shadowColor='#ffd23f';x.shadowBlur=14;x.fillText(score,W/2,H*.14);x.shadowBlur=0;
 x.font=`10px ${FN}`;x.fillStyle='#cfc8ff';x.fillText('STAGE '+(lv+1)+(best?'   BEST '+best:''),W/2,H*.22);
 // 게이지 틀(크롬) + 홈
 const r=g.gh/2,X0=g.gx-10,Y0=g.gy-r-10;const fr=x.createLinearGradient(0,Y0,0,Y0+g.gh+20);fr.addColorStop(0,'#e9e4ff');fr.addColorStop(.5,'#4b3f7a');fr.addColorStop(1,'#bdb6e0');x.fillStyle=fr;
 x.beginPath();x.roundRect?x.roundRect(X0,Y0,g.gw+20,g.gh+20,r+10):x.rect(X0,Y0,g.gw+20,g.gh+20);x.fill();
 x.fillStyle='#07031a';x.beginPath();x.roundRect?x.roundRect(g.gx,g.gy-r,g.gw,g.gh,r*.6):x.rect(g.gx,g.gy-r,g.gw,g.gh);x.fill();
 // 눈금
 x.strokeStyle='#ffffff22';x.lineWidth=1;for(let i=1;i<20;i++){const tx=g.gx+g.gw*i/20,l=i%5?g.gh*.18:g.gh*.32;x.beginPath();x.moveTo(tx,g.gy+r-l);x.lineTo(tx,g.gy+r);x.stroke()}
 // 초록 칸(새 위치로 미끄러지듯)
 zAnim=Math.min(1,zAnim+dt*5);const e=1-Math.pow(1-zAnim,3),zX=ozx+(zx-ozx)*e,zW=ozw+(zw-ozw)*e,za=px(zX),zb=px(zX+zW);
 x.save();x.beginPath();x.roundRect?x.roundRect(g.gx,g.gy-r,g.gw,g.gh,r*.6):x.rect(g.gx,g.gy-r,g.gw,g.gh);x.clip();
 const zg=x.createLinearGradient(za,0,zb,0);zg.addColorStop(0,'#1f7a46');zg.addColorStop(.5,'#5dffa8');zg.addColorStop(1,'#1f7a46');x.fillStyle=zg;x.globalAlpha=.85+.15*Math.sin(T*6);x.fillRect(za,g.gy-r,zb-za,g.gh);x.globalAlpha=1;
 x.shadowColor='#3ddc84';x.shadowBlur=18;x.fillStyle='#fff';x.fillRect((za+zb)/2-1,g.gy-r,2,g.gh);x.shadowBlur=0;
 x.fillStyle='#ffffff55';x.fillRect(g.gx,g.gy-r,g.gw,g.gh*.18);x.restore();
 x.strokeStyle='#3ddc84';x.lineWidth=2;x.shadowColor='#3ddc84';x.shadowBlur=12;x.strokeRect(za,g.gy-r,zb-za,g.gh);x.shadowBlur=0;
 // 막대(바늘) + 잔상
 const bx=px(pos);if(run){trail.push(bx);if(trail.length>8)trail.shift()}else trail=[];
 const bc=BAR==='gold'?'#ffd23f':BAR==='rainbow'?`hsl(${(T*240)%360},100%,65%)`:'#ffffff',bg2=BAR==='gold'?'#ffb000':BAR==='rainbow'?'#ff7ad9':'#22d3ee';
 x.globalCompositeOperation='lighter';trail.forEach((tx,i)=>{x.globalAlpha=(i+1)/trail.length*.25;x.fillStyle=bg2;x.fillRect(tx-3,g.gy-r-6,6,g.gh+12)});x.globalAlpha=1;gl(bx,g.gy,g.gh*1.1,bg2,.55);x.globalCompositeOperation='source-over';
 if(!(over&&started&&shake>0&&Math.floor(T*20)%2)){x.shadowColor=bg2;x.shadowBlur=16;x.fillStyle=bc;x.beginPath();x.roundRect?x.roundRect(bx-4,g.gy-r-10,8,g.gh+20,4):x.rect(bx-4,g.gy-r-10,8,g.gh+20);x.fill();x.shadowBlur=0;
  x.fillStyle=bc;x.beginPath();x.moveTo(bx-9,g.gy-r-18);x.lineTo(bx+9,g.gy-r-18);x.lineTo(bx,g.gy-r-8);x.fill()}
 // 안내 글자
 x.font=`${Math.max(14,Math.round(H*.038))}px ${FK}`;x.fillStyle='#e9e4ff';
 if(!started)x.fillText('눌러서 시작 (PC는 스페이스)',W/2,H*.72);else if(run&&lv===0)x.fillText('막대가 초록 칸에 오면 누르세요!',W/2,H*.72);
 else if(over){x.font=`${Math.round(Math.min(W,H)*.06)}px ${FN}`;x.fillStyle='#ff4d4d';x.shadowColor='#ff4d4d';x.shadowBlur=14;x.fillText('MISS!',W/2,H*.33);x.shadowBlur=0}
 // 입자·글자
 for(const p of fx){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=400*dt;const a=1-p.t/p.l;if(a<=0)continue;x.globalAlpha=a;x.fillStyle=p.col;if(p.sh==='s')star(p.x,p.y,p.s*.6);else if(p.sh==='h')heart(p.x,p.y,p.s*.6);else x.fillRect(p.x-p.s/2,p.y-p.s/2,p.s,p.s)}x.globalAlpha=1;fx=fx.filter(p=>p.t<p.l);
 for(const t of texts){t.t+=dt;const a=Math.max(0,1-t.t/(t.ui?1.4:.9));x.globalAlpha=a;x.fillStyle=t.col;x.shadowColor=t.col;x.shadowBlur=12;if(t.ui){x.font=`${Math.max(16,Math.round(H*.045))}px ${FK}`;x.fillText(t.s,t.x,t.y-t.t*20)}else{x.font=`${t.big?13:11}px ${FN}`;x.fillText(t.s,clamp(t.x,60,W-60),t.y-t.t*40)}x.shadowBlur=0}x.globalAlpha=1;texts=texts.filter(t=>t.t<(t.ui?1.4:.9));
 x.restore();if(flash>0){x.globalAlpha=flash*.35;x.fillStyle=flashC;x.fillRect(0,0,W,H);x.globalAlpha=1;flash=Math.max(0,flash-dt*2.5)}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
size();requestAnimationFrame(t=>{last=t;draw(t)});
try{document.fonts&&document.fonts.load('10px "Press Start 2P"')}catch(e){}
})();
