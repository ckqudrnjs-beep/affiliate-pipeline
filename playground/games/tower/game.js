(function(){
// 하늘 탑 쌓기: 5락실 창작 원터치 타이밍 탑 쌓기. 블록·배경·소리 모두 코드로 생성(외부 파일 없음).
const $=id=>document.getElementById(id);
const cab=$('tw-cab'),cv=$('tw-c'),cx=cv.getContext('2d');
const COARSE=matchMedia('(pointer: coarse)').matches,IOS=/iP(hone|od|ad)/.test(navigator.userAgent);
const DEBUG=location.hash.indexOf('twdebug')>=0;
// ── 월드 단위: 화면 폭 360 기준. 블록 높이 BH, 처음 폭 BW, 퍼펙트 허용 PERF
const VW=360,BH=34,BW=210,PERF=5,GROW=8,A=158;
let W=0,H=0,dpr=1,S=1;
function size(){const r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);
 cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);S=Math.min(W/VW,H/560);}
// ── 꾸미기(겉모습만)
let SK,DES='base',THM='base',TRL='',CHIP=false;
function look(){const B=window.Bonus;SK=(B&&B.skin().c)||['#e9fdff','#22d3ee','#0e7490'];DES=B?B.design('tower'):'base';THM=B?B.theme('tower'):'base';TRL=B?B.trail():'';CHIP=!!(B&&B.sound())}
// ── 소리(웹오디오 합성)
let AC=null,MUTE=false;try{MUTE=localStorage.getItem('nr_tw_mute')==='1'}catch(e){}
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(type,f,a,dur,f2,delay){if(MUTE||!AC)return;if(CHIP){type='square';a*=0.45}const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
 o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.02)}
const SCALE=[0,2,4,7,9,12,14,16,19,21,24];
function sPlace(perf,combo){if(perf){const n=SCALE[Math.min(SCALE.length-1,combo-1)];const f=523*Math.pow(2,n/12);tone('sine',f,0.22,0.22);tone('triangle',f*2,0.08,0.18,0,0.03)}else{tone('triangle',190,0.28,0.14,90);tone('sine',420,0.05,0.06)}}
function sCut(){tone('sawtooth',300,0.05,0.18,80)}
function sOver(){tone('triangle',330,0.25,0.6,70);tone('sine',165,0.2,0.7,50,0.08)}
function sGrow(){tone('sine',784,0.12,0.12,1175)}
// ── 상태
let phase='idle',stack,cur,falls,parts,rings,pops,R,score,combo,perfs,camY,camT,T,overT,pauseUsed,cnt,windOn,best=0,bestF=0,newBest=false,lastRun=null;
const fl=()=>stack.length-1;
function bestLoad(){try{best=+localStorage.getItem('nr_best_tower_'+KST)||0;bestF=+localStorage.getItem('nr_tw_bf_'+KST)||0}catch(e){}}
function reset(){R=seeded('tower'+KST);stack=[{x:0,w:BW,f:0,p:0}];falls=[];parts=[];rings=[];pops=[];score=0;combo=0;perfs=0;camY=-BH*2.5;camT=camY;T=0;pauseUsed=false;cnt=0;spawn()}
// 층마다 R() 를 정확히 3번 써서, 오늘 모두 같은 순서·속도가 된다.
function spawn(){const n=stack.length,top=stack[n-1],side=R()<0.5?-1:1,jit=0.9+0.2*R(),wr=R();
 const v=(140+3.4*Math.min(n,50)+1.1*Math.max(0,Math.min(n,160)-50))*jit;
 windOn=n>=20&&wr<0.3;cur={x:side*A,w:top.w,dir:-side,v,wind:windOn,ph:wr*6.28,f:n}}
function emit(x,y,w,kind){const k=TRL||'base';for(let i=0;i<14;i++){const ex=x+(i%2?1:-1)*w/2;parts.push({x:ex,y:y,vx:(i%2?1:-1)*(20+Math.random()*70),vy:40+Math.random()*90,l:0.7+Math.random()*0.4,t:0,k,h:(i*40+T*90)%360,big:kind})}}
function drop(){if(phase!=='play')return;const n=stack.length,top=stack[n-1],d=cur.x-top.x,y=(n)*BH;let perf=false,x=cur.x,w=cur.w;
 if(Math.abs(d)<=PERF){perf=true;x=top.x;combo++;perfs++;if(combo>=3&&w<BW){const nw=Math.min(BW,w+GROW);w=nw;sGrow()}}
 else{const ov=w-Math.abs(d);if(ov<0.8){falls.push({x:cur.x,w:cur.w,y,vx:Math.sign(d)*60,vy:0,r:0,vr:Math.sign(d)*1.6,f:n});cur=null;over();return}
  combo=0;w=ov;x=top.x+d/2;const cw=Math.abs(d),cxp=d>0?x+w/2+cw/2:x-w/2-cw/2;falls.push({x:cxp,w:cw,y,vx:Math.sign(d)*50,vy:0,r:0,vr:Math.sign(d)*(1+Math.random()),f:n});sCut()}
 stack.push({x,w,f:n,p:perf?1:0});score+=10+(perf?5*Math.min(combo,5):0);sPlace(perf,combo);emit(x,y,w,perf);
 if(perf){rings.push({x,y,w,t:0});pops.push({t:0,s:combo>=2?'PERFECT ×'+combo:'PERFECT'})}
 if(fl()===30&&window.Bonus&&!DEBUG)Bonus.ach('tw30');
 spawn()}
function over(){phase='over';overT=0;sOver();const f=fl();newBest=false;
 if(f>bestF){bestF=f;try{localStorage.setItem('nr_tw_bf_'+KST,f)}catch(e){}}
 if(score>best){newBest=score>0;best=score}
 lastRun={f,score,perfs};
 if(!DEBUG){if(window.Bonus)Bonus.played('tower');if(score>0&&window.submitScore)submitScore(score)}
 setTimeout(()=>{if(phase==='over'){$('tw-go').textContent='↻ 다시 쌓기';$('tw-go').style.display='';$('tw-ov').style.display='flex'}},700);
 $('tw-msg').textContent='이번 판 '+f+'층 · '+score+'점'+(newBest?' · 오늘 최고 기록!':'')}
// ── 시작·전체화면
function full(on){if(on){cab.classList.add('on');document.body.style.overflow='hidden';
  if(!IOS&&cab.requestFullscreen&&!document.fullscreenElement){cab.requestFullscreen({navigationUI:'hide'}).then(()=>{try{COARSE&&screen.orientation&&screen.orientation.lock&&screen.orientation.lock('portrait').catch(()=>{})}catch(e){}}).catch(()=>{})}
  if(IOS&&!navigator.standalone){const p=$('tw-ios');p.style.display='block';setTimeout(()=>p.style.display='none',4000)}}
 else{cab.classList.remove('on');document.body.style.overflow='';if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
 setTimeout(size,60);size()}
function start(){ac();look();bestLoad();full(true);reset();phase='play';$('tw-go').style.display='none';$('tw-ov').style.display='none';$('tw-pa').style.opacity=1;$('tw-msg').textContent='블록이 아래 블록과 겹칠 때 누르세요!'}
function act(){if(phase==='idle')start();else if(phase==='play')drop();else if(phase==='pause')resume()}
function pause(auto){if(phase!=='play')return;if(!auto){if(pauseUsed)return;pauseUsed=true;$('tw-pa').style.opacity=0.35}phase='pause';$('tw-go').textContent='▶ 이어 하기';$('tw-go').style.display=''}
function resume(){if(phase!=='pause')return;phase='count';cnt=3;$('tw-go').style.display='none'}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&cab.classList.contains('on')&&!IOS){pause(true);cab.classList.remove('on');document.body.style.overflow='';setTimeout(size,60)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true)});addEventListener('blur',()=>pause(true));
cab.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();act()});
addEventListener('keydown',e=>{if(!cab.classList.contains('on')&&phase==='idle')return;const k=e.key;
 if(k===' '||k==='ArrowUp'||k==='Enter'){e.preventDefault();if(e.repeat)return;if(phase==='over'){if(overT>0.6)start()}else act()}
 else if(k==='p'||k==='P'){if(phase==='play')pause(false);else if(phase==='pause')resume()}
 else if(k==='Escape'&&phase!=='play')full(false)});
$('tw-go').onclick=()=>{if(phase==='pause')resume();else start()};
$('tw-pa').onclick=()=>{if(phase==='play')pause(false);else if(phase==='pause')resume()};
$('tw-x').onclick=()=>{if(phase==='play')pause(true);full(false)};
const muIc=()=>{$('tw-mu').textContent=MUTE?'🔇':'🔊'};muIc();
$('tw-mu').onclick=()=>{MUTE=!MUTE;muIc();try{localStorage.setItem('nr_tw_mute',MUTE?'1':'0')}catch(e){}};
$('tw-sh').onclick=()=>{const r=lastRun||{f:0,score:0};shareText('5락실 하늘 탑 쌓기 '+KST.slice(5)+'\n🏗️ 오늘 탑 '+r.f+'층 · '+r.score+'점 쌓았어요. 이겨 볼래?\n'+challengeUrl(r.score))};
$('tw-rk').onclick=()=>{full(false);const r=$('rankbox');if(r)setTimeout(()=>r.scrollIntoView({behavior:'smooth'}),120)};
addEventListener('resize',()=>setTimeout(size,50));
addEventListener('bonus-look',()=>{if(phase==='idle'||phase==='over')look()});
// ── 배경(높이에 따라 노을 도시 → 구름 위 → 별빛 → 우주). 테마는 색만 바꿈
const SKY={base:[[0,'#1a1045','#ff5e9a'],[18,'#0e1a4a','#5a5fe0'],[40,'#070b2c','#232a80'],[75,'#020109','#120a33']],
 sunset:[[0,'#3a0f3d','#ff9a3d'],[18,'#4a1650','#ff6a5a'],[40,'#1e0b38','#8a2a6a'],[75,'#07020f','#2a0b2e']],
 blossom:[[0,'#ffb3cf','#fff0f6'],[18,'#ff8fbf','#ffe0ef'],[40,'#6a3a8a','#e58ac0'],[75,'#1a0b2e','#5a2a6a']],
 aurora:[[0,'#04121c','#0d4d4a'],[18,'#031a24','#0b5d63'],[40,'#020c18','#08304a'],[75,'#01040a','#061a2a']]};
const hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
function mix(a,b,t){const A_=hx(a),B_=hx(b);return 'rgb('+A_.map((v,i)=>Math.round(v+(B_[i]-v)*t)).join(',')+')'}
function skyAt(alt){const L=SKY[THM]||SKY.base;let i=0;while(i<L.length-1&&alt>L[i+1][0])i++;if(i>=L.length-1)return [L[i][1],L[i][2]];const t=Math.min(1,Math.max(0,(alt-L[i][0])/(L[i+1][0]-L[i][0])));return [mix(L[i][1],L[i+1][1],t),mix(L[i][2],L[i+1][2],t)]}
const STARS=[];for(let i=0;i<140;i++)STARS.push({x:Math.random(),y:Math.random(),s:Math.random()*1.6+0.4,p:Math.random()*6.28});
const CLOUDS=[];for(let i=0;i<26;i++)CLOUDS.push({x:(Math.random()-0.5)*900,a:10+Math.random()*42,w:70+Math.random()*120,sp:4+Math.random()*10});
const CITY=[];{let x=-700;while(x<700){const w=26+Math.random()*44,h=40+Math.random()*150;CITY.push({x,w,h,c:Math.random()});x+=w+2+Math.random()*8}}
const PETALS=[];for(let i=0;i<34;i++)PETALS.push({x:Math.random(),y:Math.random(),v:0.03+Math.random()*0.05,s:3+Math.random()*3,p:Math.random()*6.28});
const sy=y=>H-(y-camY)*S, sx=x=>W/2+x*S;
function drawBg(){const alt=Math.max(0,camY/BH),[top,bot]=skyAt(alt);const g=cx.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(1,bot);cx.fillStyle=g;cx.fillRect(0,0,W,H);
 // 별: 25층 위부터 서서히
 const sa=Math.min(1,Math.max(0,(alt-14)/26))*(THM==='blossom'?0.6:1);if(sa>0||THM==='aurora'){const a0=THM==='aurora'?Math.max(sa,0.5):sa;cx.fillStyle='#fff';
  for(const s of STARS){const yy=((s.y*H+camY*S*0.05)%H+H)%H;cx.globalAlpha=a0*(0.45+0.55*Math.abs(Math.sin(T*1.3+s.p)));cx.fillRect(s.x*W,yy,s.s,s.s)}cx.globalAlpha=1}
 if(THM==='aurora'){for(let k=0;k<3;k++){cx.beginPath();const yb=H*(0.18+k*0.1);cx.moveTo(0,yb);for(let x=0;x<=W;x+=20)cx.lineTo(x,yb+Math.sin(x*0.01+T*(0.5+k*0.2)+k)*22);cx.lineTo(W,yb+70);cx.lineTo(0,yb+70);cx.closePath();
  const ag=cx.createLinearGradient(0,yb-20,0,yb+70);ag.addColorStop(0,k===1?'#b06bff00':'#3ddc8400');ag.addColorStop(0.3,k===1?'#b06bff44':'#3ddc8455');ag.addColorStop(1,'#22d3ee00');cx.fillStyle=ag;cx.fill()}}
 // 행성·달: 60층 위
 const pa=Math.min(1,Math.max(0,(alt-50)/25));if(pa>0){cx.globalAlpha=pa;const px=W*0.78,py=H*0.22,pr=Math.min(W,H)*0.09;const pg=cx.createRadialGradient(px-pr*0.4,py-pr*0.4,pr*0.1,px,py,pr);pg.addColorStop(0,'#ffd9a8');pg.addColorStop(1,'#b0507a');cx.fillStyle=pg;cx.beginPath();cx.arc(px,py,pr,0,7);cx.fill();
  cx.strokeStyle='#ffe6c8aa';cx.lineWidth=Math.max(2,pr*0.08);cx.beginPath();cx.ellipse(px,py,pr*1.7,pr*0.4,-0.35,0,7);cx.stroke();cx.globalAlpha=1}
 else if(alt<20&&THM!=='blossom'){const ma=1-alt/20;cx.globalAlpha=ma*0.9;cx.fillStyle=THM==='sunset'?'#ffcf6a':'#fff4d6';const mr=Math.min(W,H)*0.06;cx.beginPath();cx.arc(W*0.8,H*0.17+(camY/BH)*4,mr,0,7);cx.fill();cx.globalAlpha=1}
 // 구름: 10~50층 높이에 걸쳐(시차 0.7)
 cx.fillStyle=THM==='blossom'?'#fff':'#ffffff';for(const c of CLOUDS){const yy=H-(c.a*BH-camY*0.7)*S*0.9;if(yy<-60||yy>H+60)continue;const xx=W/2+(((c.x+T*c.sp)%900+900)%900-450)*S;cx.globalAlpha=THM==='aurora'?0.08:0.16;
  cx.beginPath();cx.ellipse(xx,yy,c.w*S*0.5,c.w*S*0.16,0,0,7);cx.ellipse(xx+c.w*S*0.18,yy-c.w*S*0.1,c.w*S*0.25,c.w*S*0.14,0,0,7);cx.fill()}cx.globalAlpha=1;
 // 도시 실루엣(시차 0.45)
 const gy=H-(0-camY*0.45)*S;if(gy>-10&&gy<H+260){for(const b of CITY){const bx=W/2+b.x*S*0.8,bw=b.w*S*0.8,bh=b.h*S*0.8;if(bx+bw<0||bx>W)continue;cx.fillStyle=THM==='blossom'?'#c46a9a':THM==='aurora'?'#03141d':'#160b33';cx.fillRect(bx,gy-bh,bw,bh+400);
   cx.fillStyle=THM==='blossom'?'#ffe0ef':b.c<0.5?'#ffd23f':'#22d3ee';cx.globalAlpha=0.55;for(let wy=gy-bh+8;wy<gy-6;wy+=12)for(let wx=bx+5;wx<bx+bw-6;wx+=10)if(((wx*7+wy*13)|0)%5<2)cx.fillRect(wx,wy,3.5,5);cx.globalAlpha=1}}
 if(THM==='blossom'){cx.fillStyle='#ff9ec8';for(const p of PETALS){const yy=((p.y+T*p.v)%1)*H,xx=((p.x+Math.sin(T*0.8+p.p)*0.03)%1+1)%1*W;cx.globalAlpha=0.8;cx.beginPath();cx.ellipse(xx,yy,p.s,p.s*0.55,T+p.p,0,7);cx.fill()}cx.globalAlpha=1}}
// ── 블록 그리기(디자인별, 크기·판정 동일)
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
function block(b,X,Y,w,h,mov){const f=b.f;
 if(DES==='cake'){const lay=f%2?'#7a3f22':'#f2c98a';cx.fillStyle=lay;rr(X,Y,w,h,4*S);cx.fill();cx.fillStyle='#fff6fb';cx.fillRect(X,Y,w,h*0.28);
  for(let dx=X+6*S;dx<X+w-4*S;dx+=14*S){cx.beginPath();cx.arc(dx,Y+h*0.28,Math.min(4*S,(X+w-dx)/2),0,3.15);cx.fill()}
  cx.fillStyle=f%2?'#5a2c16':'#e8b26a';cx.fillRect(X,Y+h*0.62,w,h*0.08);if(b.p||mov){cx.fillStyle='#ff3d5a';for(let dx=X+10*S;dx<X+w-8*S;dx+=26*S){cx.beginPath();cx.arc(dx,Y-2*S,3.6*S,0,7);cx.fill()}}
  cx.strokeStyle='#00000033';cx.lineWidth=1;rr(X,Y,w,h,4*S);cx.stroke();return}
 if(DES==='brick'){cx.fillStyle=f%3===0?'#b5523b':f%3===1?'#a8492f':'#bd5c40';cx.fillRect(X,Y,w,h);cx.strokeStyle='#5c2618';cx.lineWidth=Math.max(1,1.4*S);cx.beginPath();
  cx.moveTo(X,Y+h/2);cx.lineTo(X+w,Y+h/2);const bw=26*S,o=(f%2)*bw/2;for(let r=0;r<2;r++){const off=(r?o+bw/2:o);for(let bx=X+((off)%bw);bx<X+w;bx+=bw){cx.moveTo(bx,Y+r*h/2);cx.lineTo(bx,Y+(r+1)*h/2)}}cx.stroke();
  cx.fillStyle='#ffffff1c';cx.fillRect(X,Y,w,2*S);if(mov){cx.fillStyle='#8f3a26';const cw=10*S;for(let bx=X;bx<X+w-cw*0.5;bx+=cw*2)cx.fillRect(bx,Y-6*S,Math.min(cw,X+w-bx),6*S)}cx.strokeRect(X,Y,w,h);return}
 if(DES==='ice'){const g=cx.createLinearGradient(X,Y,X+w,Y+h);g.addColorStop(0,'#e6fbffdd');g.addColorStop(0.5,'#8fdcf5aa');g.addColorStop(1,'#4fb3e0cc');cx.fillStyle=g;rr(X,Y,w,h,5*S);cx.fill();
  cx.strokeStyle='#ffffffcc';cx.lineWidth=Math.max(1,1.5*S);cx.stroke();cx.strokeStyle='#ffffff88';cx.beginPath();for(let dx=X+12*S;dx<X+w-6*S;dx+=34*S){cx.moveTo(dx,Y+h-4*S);cx.lineTo(Math.min(X+w-2,dx+14*S),Y+4*S)}cx.stroke();
  cx.fillStyle='#fff';for(let k=0;k<3;k++){const px=X+((f*37+k*53)%100)/100*w,py=Y+((f*17+k*29)%100)/100*h;cx.globalAlpha=0.5+0.5*Math.sin(T*3+k+f);cx.fillRect(px,py,2*S,2*S)}cx.globalAlpha=1;return}
 if(DES==='crystal'){const h1=(f*26+T*50)%360,h2=(h1+70)%360;const g=cx.createLinearGradient(X,Y,X+w,Y+h);g.addColorStop(0,`hsl(${h1},90%,68%)`);g.addColorStop(1,`hsl(${h2},90%,52%)`);cx.fillStyle=g;rr(X,Y,w,h,3*S);cx.fill();
  cx.strokeStyle='#ffffffaa';cx.lineWidth=Math.max(1,1.2*S);cx.beginPath();for(let dx=X;dx<X+w;dx+=22*S){cx.moveTo(dx,Y);cx.lineTo(Math.min(X+w,dx+11*S),Y+h);cx.moveTo(Math.min(X+w,dx+22*S),Y);cx.lineTo(Math.min(X+w,dx+11*S),Y+h)}cx.stroke();
  cx.strokeStyle=`hsla(${h1},100%,85%,.6)`;cx.lineWidth=3*S;rr(X-1.5*S,Y-1.5*S,w+3*S,h+3*S,4*S);cx.stroke();
  cx.fillStyle='#fff';for(let k=0;k<2;k++){const tw=Math.sin(T*4+f*1.7+k*2);if(tw<0.3)continue;const px=X+((f*41+k*61)%100)/100*w,py=Y+h*0.3+k*h*0.3,r=(tw-0.3)*5*S;cx.beginPath();cx.moveTo(px,py-r);cx.lineTo(px+r*0.3,py);cx.lineTo(px,py+r);cx.lineTo(px-r*0.3,py);cx.closePath();cx.fill()}return}
 // 기본: 네온 유리 빌딩(내 네온 색)
 const g=cx.createLinearGradient(0,Y,0,Y+h);g.addColorStop(0,SK[1]);g.addColorStop(1,SK[2]);cx.fillStyle=g;cx.globalAlpha=f%2?0.88:1;rr(X,Y,w,h,3*S);cx.fill();cx.globalAlpha=1;
 cx.strokeStyle=SK[0];cx.lineWidth=Math.max(1,1.4*S);cx.stroke();cx.strokeStyle=SK[1]+'55';cx.lineWidth=4*S;rr(X-2*S,Y-2*S,w+4*S,h+4*S,4*S);cx.stroke();
 cx.fillStyle=SK[0];for(let r=0;r<2;r++)for(let dx=X+6*S;dx<X+w-8*S;dx+=13*S){if(((dx-X)/S*3+f*7+r*5|0)%7<3)continue;cx.globalAlpha=0.55;cx.fillRect(dx,Y+(7+r*12)*S,6*S,6*S)}cx.globalAlpha=1}
function drawWorld(){
 // 땅·받침
 const gy=sy(0);if(gy<H+10){cx.fillStyle=THM==='blossom'?'#7a3a6a':'#0b0620';cx.fillRect(0,gy,W,H-gy+2);cx.fillStyle='#ffffff22';cx.fillRect(0,gy,W,2)}
 // 10층마다 높이 표시 + 오늘 최고
 cx.font=`700 ${Math.round(11*S)}px sans-serif`;cx.textAlign='right';
 for(let k=10;;k+=10){const yy=sy(k*BH+BH);if(yy<-20)break;if(yy>H+20)continue;cx.fillStyle='#ffffff40';for(let x=0;x<W;x+=14)cx.fillRect(x,yy,7,1);cx.fillStyle='#ffffff99';cx.fillText(k+'층',W-6,yy-4)}
 if(bestF>0){const yy=sy(bestF*BH+BH);if(yy>-10&&yy<H+10){cx.fillStyle='#ffd23f';for(let x=0;x<W;x+=10)cx.fillRect(x,yy,6,2);cx.textAlign='left';cx.fillText('🚩 오늘 최고 '+bestF+'층',6,yy-4)}}
 for(let i=0;i<stack.length;i++){const b=stack[i],Y=sy((i+1)*BH);if(Y>H+BH*S)continue;if(Y<-BH*S*2)continue;block(b,sx(b.x-b.w/2),Y,b.w*S,BH*S,false)}
 for(const p of falls){cx.save();cx.translate(sx(p.x),sy(p.y+BH/2));cx.rotate(p.r);block(p,-p.w*S/2,-BH*S/2,p.w*S,BH*S,false);cx.restore()}
 if(cur&&(phase==='play'||phase==='count'||phase==='idle')){const Y=sy((stack.length+1)*BH);block(cur,sx(cur.x-cur.w/2),Y,cur.w*S,BH*S,true);
  if(cur.wind&&phase!=='idle'){cx.textAlign='center';cx.fillStyle='#bfefff';cx.font=`700 ${Math.round(12*S)}px sans-serif`;cx.fillText('🌬️ 바람 층',W/2,Y-10*S)}}
 for(const r of rings){const a=1-r.t/0.5;if(a<=0)continue;cx.strokeStyle=`rgba(255,255,255,${a})`;cx.lineWidth=2*S;const e=r.t*40;cx.strokeRect(sx(r.x-r.w/2)-e*S,sy(r.y+BH)-e*S,(r.w+2*e)*S,(BH+2*e)*S)}
 for(const p of parts){const a=1-p.t/p.l;if(a<=0)continue;cx.globalAlpha=a;const X=sx(p.x),Y=sy(p.y);
  if(p.k==='heart'){cx.fillStyle='#ff5fa8';cx.font=`${Math.round(12*S)}px sans-serif`;cx.fillText('♥',X,Y)}else if(p.k==='star'){cx.fillStyle='#ffd23f';cx.font=`${Math.round(12*S)}px sans-serif`;cx.fillText('★',X,Y)}
  else if(p.k==='rainbow'){cx.fillStyle=`hsl(${p.h},95%,62%)`;cx.fillRect(X-3*S,Y-3*S,6*S,6*S)}else if(p.k==='spark'){cx.fillStyle='#fff8c8';cx.fillRect(X-1.5*S,Y-4*S,3*S,8*S);cx.fillRect(X-4*S,Y-1.5*S,8*S,3*S)}
  else{cx.fillStyle=p.big?'#ffffff':SK[0];cx.fillRect(X-2*S,Y-2*S,4*S,4*S)}}cx.globalAlpha=1}
function drawHud(){cx.textAlign='center';const f=fl();cx.fillStyle='#fff';cx.shadowColor='#000a';cx.shadowBlur=6;
 cx.font=`800 ${Math.round(40*S)}px sans-serif`;cx.fillText(f+'층',W/2,62*S);cx.font=`700 ${Math.round(14*S)}px sans-serif`;cx.fillStyle='#ffd23f';cx.fillText(score+'점'+(combo>=2?' · 연속 퍼펙트 '+combo:''),W/2,84*S);cx.shadowBlur=0;
 for(const p of pops){const a=1-p.t/0.9;if(a<=0)continue;cx.globalAlpha=a;cx.fillStyle='#fff';cx.font=`900 ${Math.round((22+Math.min(8,p.t*60))*S)}px sans-serif`;cx.fillText(p.s,W/2,H*0.36-p.t*40*S);cx.globalAlpha=1}}
function drawOver(){const a=Math.min(1,overT/0.5);cx.fillStyle=`rgba(5,2,20,${0.6*a})`;cx.fillRect(0,0,W,H);cx.globalAlpha=a;cx.textAlign='center';cx.fillStyle='#fff';const r=lastRun||{f:0,score:0,perfs:0};
 cx.font=`800 ${Math.round(22*S)}px sans-serif`;cx.fillText('탑이 무너졌어요!',W/2,H*0.3);cx.font=`900 ${Math.round(48*S)}px sans-serif`;cx.fillStyle='#ffd23f';cx.fillText(r.f+'층',W/2,H*0.3+56*S);
 cx.fillStyle='#fff';cx.font=`700 ${Math.round(16*S)}px sans-serif`;cx.fillText(r.score+'점 · 퍼펙트 '+r.perfs+'번',W/2,H*0.3+84*S);
 cx.font=`700 ${Math.round(14*S)}px sans-serif`;cx.fillStyle=newBest?'#3ddc84':'#ffffffaa';cx.fillText(newBest?'🎉 오늘 최고 기록!':'오늘 최고 '+best+'점',W/2,H*0.3+108*S);cx.globalAlpha=1}
function drawPause(){cx.fillStyle='#0b0620';cx.fillRect(0,0,W,H);cx.textAlign='center';cx.fillStyle='#fff';cx.font=`800 ${Math.round(24*S)}px sans-serif`;cx.fillText('일시정지',W/2,H*0.4);
 cx.font=`600 ${Math.round(13*S)}px sans-serif`;cx.fillStyle='#ffffffaa';cx.fillText(pauseUsed?'손으로 멈추기는 이번 판에 다 썼어요':'',W/2,H*0.4+28*S)}
function drawIdle(){cx.textAlign='center';cx.fillStyle='#fff';cx.shadowColor='#000a';cx.shadowBlur=8;cx.font=`900 ${Math.round(34*S)}px sans-serif`;cx.fillText('하늘 탑 쌓기',W/2,H*0.26);
 cx.font=`600 ${Math.round(14*S)}px sans-serif`;cx.fillText('딱 맞게 눌러서 하늘 끝까지!',W/2,H*0.26+28*S);if(bestF){cx.fillStyle='#ffd23f';cx.fillText('오늘 내 최고 '+bestF+'층 · '+best+'점',W/2,H*0.26+50*S)}cx.shadowBlur=0}
// ── 루프
let last=performance.now();
function step(dt){T+=dt;
 if(phase==='play'||phase==='idle'){const m=cur.wind?1+0.5*Math.sin(T*2.4+cur.ph):1;cur.x+=cur.dir*cur.v*m*dt*(phase==='idle'?0.6:1);if(cur.x>A){cur.x=A;cur.dir=-1}if(cur.x<-A){cur.x=-A;cur.dir=1}}
 if(phase==='count'){cnt-=dt;if(cnt<=0)phase='play'}
 if(phase==='over')overT+=dt;
 if(phase!=='pause'){for(const p of falls){p.vy-=900*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=p.vr*dt}falls=falls.filter(p=>p.y>camY-BH*12);
  for(const p of parts){p.t+=dt;p.vy-=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}parts=parts.filter(p=>p.t<p.l);rings.forEach(r=>r.t+=dt);rings=rings.filter(r=>r.t<0.5);pops.forEach(p=>p.t+=dt);pops=pops.filter(p=>p.t<0.9)}
 const n=stack.length;camT=(n+1)*BH-(H*0.6)/S;if(phase==='over')camT=Math.min(camT,Math.max(-BH*2.5,(n)*BH-(H*0.55)/S));camT=Math.max(-BH*2.5,camT);camY+=(camT-camY)*Math.min(1,dt*5)}
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;
 if(DEBUG&&DBG.bot&&phase==='play'){const top=stack[stack.length-1],e=DBG.err;if(Math.abs(cur.x-(top.x+cur.tgt))<=Math.max(2,cur.v*dt*0.6)){drop();if(cur)cur.tgt=(Math.random()*2-1)*e}else if(cur.tgt===undefined)cur.tgt=(Math.random()*2-1)*e}
 const k=DEBUG&&DBG.fast?DBG.fast:1;for(let i=0;i<k;i++)step(dt);
 if(!W)size();cx.setTransform(dpr,0,0,dpr,0,0);
 if(phase==='pause'){drawPause()}else{drawBg();drawWorld();if(phase==='idle')drawIdle();else drawHud();if(phase==='count'){cx.fillStyle='#0008';cx.fillRect(0,0,W,H);cx.fillStyle='#fff';cx.textAlign='center';cx.font=`900 ${Math.round(64*S)}px sans-serif`;cx.fillText(Math.ceil(cnt),W/2,H*0.5)}if(phase==='over')drawOver()}
 requestAnimationFrame(frame)}
const DBG={bot:false,err:0,fast:0};
if(DEBUG)window.__tw={dbg:DBG,start,drop,state:()=>({phase,floors:stack?fl():0,score,combo,w:cur&&cur.w}),setLook(d,t){DES=d||'base';THM=t||'base'},build(n,e){for(let i=0;i<n&&phase==='play';i++){cur.x=stack[stack.length-1].x+(Math.random()*2-1)*(e||0);drop()}camY=camT=(stack.length+1)*BH-(H*0.6)/S},look:()=>({DES,THM,TRL})};
look();bestLoad();size();reset();requestAnimationFrame(frame);
})();
