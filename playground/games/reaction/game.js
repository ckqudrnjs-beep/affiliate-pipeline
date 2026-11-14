// 반응속도 측정 v2 (2026-11-14 디자인 개편): 네온 신호등 오락기. 규칙 그대로(5회 평균, 먼저 누르면 그 회차 다시).
// 그림·소리 모두 코드로 생성. 기록은 이 기기에서만.
(function(){
const cab=document.getElementById('rx-cab'),c=document.getElementById('rx'),x=c.getContext('2d'),sh=document.getElementById('sh'),again=document.getElementById('rx-again'),log=document.getElementById('log');
const FN='"Press Start 2P",monospace',FK='"Black Han Sans",system-ui,sans-serif';
// 미니 상점 신호 색(겉모습만): 기본 빨강→초록, 바다 보라→하늘, 사탕 분홍→노랑
const PADC={'':['#ff3b4e','#2bff88','초록'],ocean:['#7b5cff','#22d3ee','하늘색'],candy:['#ff4fc3','#ffd23f','노란색']};
let W=0,H=0,d=1,st='idle',t0=0,tm=0,goPend=false,rs=[],fx=[],shake=0,last=0,msg='',msgT=0,pc=PADC[''],best=0,flash=0;
try{best=+localStorage.getItem('rx_best')||0}catch(e){}
function size(){d=Math.min(devicePixelRatio||1,2);W=cab.clientWidth;H=cab.clientHeight;c.width=W*d;c.height=H*d}
/* 소리 */
let A=null;function ac(){if(!A){const C=window.AudioContext||window.webkitAudioContext;if(C)try{A=new C()}catch(e){}}if(A&&A.state==='suspended')A.resume()}
function tone(f,dur,a,type,f2,dl){if(!A)return;const t=A.currentTime+(dl||0),o=A.createOscillator(),g=A.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*.8);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a,t+.005);g.gain.exponentialRampToValueAtTime(.0005,t+dur);o.connect(g);g.connect(A.destination);o.start(t);o.stop(t+dur+.02)}
const S={arm:()=>tone(220,.25,.08,'triangle',330),go:()=>tone(1320,.12,.16,'square'),hit:ms=>{tone(ms<220?1568:ms<300?1175:880,.18,.14,'triangle')},foul:()=>{tone(140,.35,.18,'sawtooth',70)},done:()=>[523,659,784,1047,1319].forEach((f,i)=>tone(f,.25,.12,'triangle',null,i*.08))};
function rate(ms){return ms<180?['번개 손','#ffd23f']:ms<220?['치타급','#2bff88']:ms<260?['고양이급','#22d3ee']:ms<320?['사람 평균','#b06bff']:['느긋한 거북이','#ff8a3d']}
function burst(col,n,sp){for(let i=0;i<n;i++){const a=Math.random()*6.283,v=(.3+Math.random())*(sp||1);fx.push({x:W/2,y:H*.43,vx:Math.cos(a)*v*260,vy:Math.sin(a)*v*260,t:0,l:.5+Math.random()*.5,col})}}
function arm(){pc=PADC[window.Bonus?Bonus.gitem('reaction','pad'):'']||PADC[''];st='wait';msg='';S.arm();tm=setTimeout(()=>{st='go';goPend=true;S.go()},1200+Math.random()*2500)}
function tap(e){ac();
 if(st==='idle'||st==='done'){if(st==='done'){rs=[];again.hidden=true;sh.hidden=true;log.textContent=''}arm();return}
 if(st==='wait'){clearTimeout(tm);st='idle';shake=.5;msg='foul';msgT=0;S.foul();return}
 if(st==='go'){if(goPend)return;const ms=Math.max(1,Math.round((e&&e.timeStamp&&e.timeStamp>t0?e.timeStamp:performance.now())-t0));rs.push(ms);S.hit(ms);burst(pc[1],26);flash=.5;msg='ms';msgT=0;
  log.textContent=rs.map((v,i)=>(i+1)+'회 '+v+'ms').join(' · ');
  if(rs.length>=5){const avg=Math.round(rs.reduce((a,b)=>a+b)/5);st='done';if(window.Bonus)Bonus.played('reaction');sh.hidden=false;again.hidden=false;sh.dataset.r=avg;
   if(!best||avg<best){best=avg;msg='best';try{localStorage.setItem('rx_best',avg)}catch(er){}}setTimeout(()=>{S.done();burst('#ffd23f',40,1.4);burst('#ff3d9a',30,1.2)},250)}
  else st='idle'}}
cab.addEventListener('pointerdown',e=>{e.preventDefault();tap(e)});
addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&document.activeElement===cab){e.preventDefault();tap(e)}});
again.onclick=()=>{rs=[];again.hidden=true;sh.hidden=true;log.textContent='';st='idle';ac();arm()};
sh.onclick=()=>{const t='5락실 반응속도 평균 '+sh.dataset.r+'ms ('+rate(+sh.dataset.r)[0]+'), 너는 몇 ms?\n'+location.href;shareText(t)};
function glowC(X,Y,r,col,a){const g=x.createRadialGradient(X,Y,0,X,Y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.globalAlpha=a;x.fillStyle=g;x.fillRect(X-r,Y-r,r*2,r*2);x.globalAlpha=1}
function draw(now){requestAnimationFrame(draw);const dt=Math.min(.05,(now-last)/1000);last=now;if(cab.clientWidth!==W||cab.clientHeight!==H)size();
 x.setTransform(d,0,0,d,0,0);const T=now/1000;
 if(goPend){t0=now;goPend=false} // 초록 불이 실제로 그려지는 프레임부터 잰다
 x.save();if(shake>0){x.translate((Math.random()-.5)*16*shake,(Math.random()-.5)*16*shake);shake=Math.max(0,shake-dt*1.5)}
 // 배경: 그라데이션 + 원근 격자 + 성운 빛
 const bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#07031a');bg.addColorStop(1,'#1a0838');x.fillStyle=bg;x.fillRect(-20,-20,W+40,H+40);
 glowC(W*.15,H*.2,W*.5,'#ff3d9a',.12);glowC(W*.9,H*.3,W*.45,'#22d3ee',.1);
 x.strokeStyle='#b06bff';x.lineWidth=1;const hz=H*.78;x.globalAlpha=.22;x.beginPath();
 for(let i=-10;i<=10;i++){x.moveTo(W/2+i*W*.05,hz);x.lineTo(W/2+i*W*.25,H)}for(let k=0;k<6;k++){const yy=hz+(H-hz)*Math.pow(((k+T*.6)%6)/6,2);x.moveTo(0,yy);x.lineTo(W,yy)}x.stroke();x.globalAlpha=1;
 // 신호등 램프
 const R=Math.min(W*.24,H*.27),cx=W/2,cy=H*.43;
 let col='#1d3a4a',on=0,label='',sub='';
 if(st==='idle'||st==='done'){col='#22d3ee';on=.25+.15*Math.sin(T*3)}
 if(st==='wait'){col=pc[0];on=.75+.08*Math.sin(T*14)}
 if(st==='go'){col=pc[1];on=1}
 glowC(cx,cy,R*2.4,col,on*.55);
 // 크롬 테두리
 const rg=x.createLinearGradient(cx-R,cy-R,cx+R,cy+R);rg.addColorStop(0,'#e9e4ff');rg.addColorStop(.5,'#5b4f8a');rg.addColorStop(1,'#cfc8ff');x.fillStyle=rg;x.beginPath();x.arc(cx,cy,R*1.12,0,7);x.fill();
 x.fillStyle='#0a0518';x.beginPath();x.arc(cx,cy,R*1.03,0,7);x.fill();
 const lg=x.createRadialGradient(cx-R*.3,cy-R*.35,R*.1,cx,cy,R);lg.addColorStop(0,on>.5?'#ffffff':col);lg.addColorStop(.35,col);lg.addColorStop(1,'#000');x.globalAlpha=.35+on*.65;x.fillStyle=lg;x.beginPath();x.arc(cx,cy,R,0,7);x.fill();x.globalAlpha=1;
 // 렌즈 무늬 + 반사광
 x.save();x.beginPath();x.arc(cx,cy,R,0,7);x.clip();x.strokeStyle='#ffffff18';x.lineWidth=2;for(let i=-6;i<=6;i++){x.beginPath();x.moveTo(cx+i*R/5,cy-R);x.lineTo(cx+i*R/5,cy+R);x.stroke()}x.restore();
 x.fillStyle='#ffffff55';x.beginPath();x.ellipse(cx-R*.35,cy-R*.45,R*.32,R*.14,-.6,0,7);x.fill();
 // 기다리는 동안 도는 점(긴장감)
 if(st==='wait'){for(let i=0;i<12;i++){const a=T*4+i*.5236;x.fillStyle=col;x.globalAlpha=(i/12);x.beginPath();x.arc(cx+Math.cos(a)*R*1.3,cy+Math.sin(a)*R*1.3,3,0,7);x.fill()}x.globalAlpha=1}
 // 초록 불 = 빛줄기
 if(st==='go'){x.save();x.translate(cx,cy);x.rotate(T*.8);x.globalCompositeOperation='lighter';for(let i=0;i<12;i++){x.rotate(.5236);x.fillStyle=col+'33';x.beginPath();x.moveTo(R*1.15,-6);x.lineTo(R*2.2,-18);x.lineTo(R*2.2,18);x.lineTo(R*1.15,6);x.fill()}x.restore()}
 // 램프 안 글자
 x.textAlign='center';x.textBaseline='middle';
 if(st==='go'){label='지금!';sub=''}else if(st==='wait'){label='기다려…';sub=pc[2]+' 불에 누르기'}
 else if(st==='done'){label='';sub='눌러서 다시 재기'}
 else if(msg==='foul'&&msgT<1.8){label='너무 빨라요!';sub='눌러서 이 회차 다시'}
 else if(msg==='ms'&&rs.length){label='';sub='눌러서 다음 ('+(rs.length+1)+'/5)'}
 else{label='TAP';sub='눌러서 시작'}
 if(label){x.font=`${label==='TAP'?Math.round(R*.32):Math.round(R*.34)}px ${label==='TAP'?FN:FK}`;x.fillStyle='#fff';x.shadowColor=col;x.shadowBlur=16;x.fillText(label,cx,cy);x.shadowBlur=0}
 if(st!=='done'&&msg==='ms'&&rs.length&&st==='idle'){const v=rs[rs.length-1],r=rate(v),sc=1+Math.max(0,.4-msgT)*1.2;x.font=`${Math.round(R*.3*sc)}px ${FN}`;x.fillStyle='#fff';x.shadowColor=r[1];x.shadowBlur=18;x.fillText(v,cx,cy-R*.08);x.shadowBlur=0;x.font=`${Math.max(10,Math.round(R*.11))}px ${FN}`;x.fillStyle='#e9e4ff';x.fillText('ms',cx,cy+R*.2);x.font=`${Math.max(14,Math.round(R*.17))}px ${FK}`;x.fillStyle=r[1];x.fillText(r[0],cx,cy+R*.45)}
 if(st==='done'){const avg=+sh.dataset.r,r=rate(avg),sc=1+Math.max(0,.4-msgT)*1.2;x.font=`${Math.max(13,Math.round(R*.14))}px ${FK}`;x.fillStyle='#cfc8ff';x.fillText('5회 평균',cx,cy-R*.42);x.font=`${Math.round(R*.32*sc)}px ${FN}`;x.fillStyle='#fff';x.shadowColor=r[1];x.shadowBlur=20;x.fillText(avg,cx,cy-R*.05);x.shadowBlur=0;x.font=`${Math.round(R*.2)}px ${FK}`;x.fillStyle=r[1];x.fillText(r[0],cx,cy+R*.38)}
 if(sub){x.font=`${Math.max(12,Math.round(H*.035))}px ${FK}`;x.fillStyle='#e9e4ff';x.fillText(sub,cx,cy+R*1.45)}
 // 5회 기록 칸
 const n=5,bw=Math.min(78,W*.17),gap=6,y0=H*.9,x0=cx-(n*bw+(n-1)*gap)/2;
 for(let i=0;i<n;i++){const v=rs[i],bx=x0+i*(bw+gap),r=v?rate(v):null;x.fillStyle=v?'#ffffff14':'#ffffff08';x.strokeStyle=v?r[1]:'#ffffff22';x.lineWidth=1.5;x.beginPath();x.roundRect?x.roundRect(bx,y0-16,bw,32,8):x.rect(bx,y0-16,bw,32);x.fill();x.stroke();
  x.font=`${Math.round(Math.min(11,bw*.15))}px ${FN}`;x.fillStyle=v?'#fff':'#ffffff44';x.fillText(v?v:(i+1)+'',bx+bw/2,y0+1)}
 if(best){x.textAlign='left';x.font=`9px ${FN}`;x.fillStyle='#ffd23f';x.fillText('BEST '+best+'ms',10,14)}
 x.textAlign='right';x.font=`9px ${FN}`;x.fillStyle='#a99fd6';x.fillText('REACTION',W-10,14);
 // 입자·번쩍임
 x.globalCompositeOperation='lighter';for(const p of fx){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;const a=1-p.t/p.l;if(a>0){x.globalAlpha=a;x.fillStyle=p.col;x.fillRect(p.x-2,p.y-2,4,4)}}x.globalAlpha=1;x.globalCompositeOperation='source-over';fx=fx.filter(p=>p.t<p.l);
 if(flash>0){x.fillStyle=`rgba(255,255,255,${flash*.4})`;x.fillRect(0,0,W,H);flash=Math.max(0,flash-dt*3)}
 x.restore();msgT+=dt}
size();requestAnimationFrame(draw);
try{document.fonts&&document.fonts.load('10px "Press Start 2P"')}catch(e){}
})();
