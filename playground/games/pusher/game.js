(function(){
// 동전탑: 5락실 창작 동전 밀어내기 물리 게임. 동전·기계·배경·소리 모두 코드로 생성(외부 파일 없음).
// 화면을 눌러 동전을 떨어뜨리면 앞뒤로 움직이는 미는 판(동전이 얼굴)이 동전 더미를 밀어 앞 턱 아래로 떨어뜨린다.
// 앞으로 떨어진 동전·보석·보물 상자 = 점수(동전은 다시 넣을 동전으로 돌아옴), 옆 홈으로 빠지면 잃음.
// 움직이는 '파워 컵'에 동전을 3번 넣으면 미는 판이 3번 크게 밀어요(큰 밀기). 운이 아니라 타이밍.
// 동전이 0.8초 안에 연달아 떨어지면 '우르르 연쇄' 배수가 붙어요(×1.25씩, 최대 ×3).
// 층(5층)마다 목표 점수를 넘기면 기계 개조를 하나 골라요. 게임 안 동전만 쓰고 현금·코인은 쓰지 않아요.
const $=id=>document.getElementById(id);
const cab=$('cp-cab'),cv=$('cp-c'),cx=cv.getContext('2d');
const COARSE=matchMedia('(pointer: coarse)').matches,IOS=/iP(hone|od|ad)/.test(navigator.userAgent);
const DEBUG=location.hash.indexOf('cpdebug')>=0;
const FN='"Press Start 2P",monospace',FK='"Black Han Sans","Noto Sans KR",sans-serif';
try{document.fonts&&document.fonts.load('10px "Press Start 2P"');document.fonts&&document.fonts.load('16px "Black Han Sans"','동전탑')}catch(e){}
const VW=360,VH=640;
let W=0,H=0,dpr=1,S=1,OX=0,OY=0;
function size(){const r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);
 if(W*H*dpr*dpr>3.6e6)dpr=Math.max(1,Math.sqrt(3.6e6/(W*H)));cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);S=Math.min(W/VW,H/VH);OX=(W-VW*S)/2;OY=(H-VH*S)/2}
// ── 기계 치수(가상 360×640)
const FL=24,FR=336,BACK=118,EDGE=520,RAIL=94,GUT0=455,GUT1=492;// 옆 홈: GUT 아래로는 옆벽이 없음(옆벽 개조 시 GUT1)
const CR=12;// 동전 반지름
const KIND={coin:{r:12,v:10,m:1,n:'동전'},gold:{r:12,v:30,m:1,n:'황금 동전'},gem:{r:11,v:40,m:0.8,n:'보석'},chest:{r:19,v:120,m:3,n:'보물 상자'},bomb:{r:12,v:10,m:1,n:'폭탄 동전'}};
const TARGET=[300,420,560,720,900],FLOORS=5,START_COINS=30;
const UPS=[
 {id:'wall',n:'옆벽 늘리기',d:'옆 홈이 짧아져 덜 새요'},{id:'wide',n:'긴 미는 판',d:'미는 판이 30만큼 더 깊이 밀어요'},
 {id:'gem',n:'보석 감정사',d:'보석·보물 상자 값 1.5배'},{id:'cup',n:'큰 파워 컵',d:'파워 컵 입구가 2배 넓어져요'},
 {id:'bomb',n:'폭탄 동전 3개',d:'다음 3번은 터지며 주변을 밀어내요'},{id:'bag',n:'동전 주머니',d:'넣을 동전 +15개 바로'},
 {id:'gold',n:'황금 손',d:'넣는 동전 5개 중 1개는 황금'},{id:'tilt',n:'기계 흔들기',d:'층마다 흔들기 2번'}];
// ── 꾸미기(겉모습만): 동전 디자인 cn, 떨어질 때 효과 fx
let CN='',FXS='';
function look(){const B=window.Bonus;try{CN=B&&B.gitem?B.gitem('pusher','cn')||'':'';FXS=B&&B.gitem?B.gitem('pusher','fx')||'':''}catch(e){CN=FXS=''}}
// ── 소리
let AC=null,MUTE=false;try{MUTE=localStorage.getItem('nr_cp_mute')==='1'}catch(e){}
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(type,f,a,dur,f2,delay){if(MUTE||!AC)return;const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
 o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.02)}
function noise(a,dur,hp){if(MUTE||!AC)return;const n=Math.floor(AC.sampleRate*dur),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
 const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=b;f.type='highpass';f.frequency.value=hp||1200;g.gain.value=a;s.connect(f);f.connect(g);g.connect(AC.destination);s.start()}
let sndGate=0;
const sDrop=()=>{tone('triangle',1800,0.06,0.05,2400);tone('sine',900,0.05,0.08,0,0.03)};
const sClink=()=>{if(T-sndGate<0.04)return;sndGate=T;tone('square',2200+Math.random()*900,0.025,0.03)};
const sWin=k=>{const b=k==='chest'?[523,659,784,1047,1319]:k==='gem'?[1047,1319,1568]:[1568,2093];b.forEach((f,i)=>tone('triangle',f,0.1,0.12,0,i*0.05))};
const sLost=()=>{tone('sine',300,0.08,0.18,120)};
const sCup=()=>{noise(0.12,0.3,2400);[880,1175,1568].forEach((f,i)=>tone('square',f,0.06,0.08,0,i*0.06))};
const sJack=()=>{[784,988,1175,1568,1175,1568,2093].forEach((f,i)=>tone('square',f,0.08,0.12,0,i*0.07));tone('sine',392,0.14,0.9)};
const sBoom=()=>{noise(0.4,0.4,200);tone('sawtooth',90,0.2,0.4,40)};
const sClear=()=>{[523,659,784,1047,1319].forEach((f,i)=>tone('triangle',f,0.18,0.22,0,i*0.08));tone('sine',262,0.12,0.6)};
const sOver=()=>{tone('triangle',392,0.22,0.3,330);tone('triangle',330,0.22,0.5,196,0.25)};
const sBad=()=>{tone('square',140,0.07,0.1);tone('square',110,0.07,0.1,0,0.07)};
let bgmT=null,bgmI=0;const MEL=[784,0,659,784,880,0,784,0,659,587,0,523,587,0,659,0],BAS=[131,131,165,165,175,175,196,196];
function bgm(on){if(bgmT){clearInterval(bgmT);bgmT=null}if(!on)return;bgmT=setInterval(()=>{if(MUTE||!AC||phase==='idle'||phase==='pause')return;const m=MEL[bgmI%16];if(m)tone('square',m,0.018,0.16);if(bgmI%2===0)tone('triangle',BAS[(bgmI>>1)%8],0.05,0.25);bgmI++},220)}
// ── 상태
let phase='idle',run,B=[],drops=[],fall=[],parts=[],pops=[],shake=0,T=0,best=0,newBest=false,lastRun=null,offer=null,banner=null,prevPhase='play',seedOverride=null,idleT=0,pT=0,cool=0;
function bestLoad(){try{best=+localStorage.getItem('nr_best_pusher_'+KST)||0}catch(e){}}
function genRun(seed){const R=seeded(seed);const offs=[];for(let f=0;f<FLOORS-1;f++){const p=UPS.map(u=>u.id);for(let i=p.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[p[i],p[j]]=[p[j],p[i]]}offs.push(p)}
 return {R,fr:seeded(seed+'#놓기'),floor:0,score:0,fpts:0,coins:START_COINS,up:{},offs,bombs:0,goldN:0,tilts:0,
  charge:0,superUntil:-1,amp:70,chain:0,lastGot:-9,st:{drops:0,cup:0,sup:0,got:0,lost:0,maxChain:0,best:0,fl:[]}}}
function body(k,x,y){const d=KIND[k];return {k,x,y,vx:0,vy:0,r:d.r,m:d.m,t:0,fuse:k==='bomb'?2:0,rot:Math.random()*6.28}}
function free(x,y,r){for(const b of B)if(Math.hypot(b.x-x,b.y-y)<b.r+r+0.5)return false;return true}
function seedField(){B=[];const R=run.fr;let row=0;for(let y=EDGE-7;y>BACK+18+70+CR-4;y-=20.8,row++){for(let x=FL+CR+1+(row%2)*12;x<FR-CR;x+=24.1){if(R()<0.02)continue;B.push(body('coin',x+(R()-0.5)*3,y+(R()-0.5)*3))}}
 floorPrizes()}
function floorPrizes(){const R=run.fr,f=run.floor;const list=[['chest',1],['gem',2+(f>>1)],['gold',2]];for(const [k,n] of list)for(let i=0;i<n;i++){let ok=false;for(let t=0;t<60&&!ok;t++){const x=FL+30+R()*(FR-FL-60),y=BACK+100+R()*160;const near=B.filter(b=>b.k==='coin'&&Math.hypot(b.x-x,b.y-y)<KIND[k].r+b.r);if(near.length<=2){for(const nb of near)B.splice(B.indexOf(nb),1);B.push(body(k,x,y));ok=true}}}}
// ── 미는 판(앞면 y)
const stroke=()=>(run&&run.up.wide?100:70)+(run&&pT<run.superUntil?75:0);
function pushY(t){return BACK+18+(run?run.amp:70)*(0.5-0.5*Math.cos(t*1.6))}
const superOn=()=>run&&pT<run.superUntil;
// ── 파워 컵
const cupW=()=>run&&run.up.cup?52:28;
function cupX(t){return 180+116*Math.sin(t*1.9)+14*Math.sin(t*4.3)}
// ── 동전 넣기: 위에서 떨어져 RAIL에서 컵 판정 → 판 위(미는 판 앞)로
function drop(x){if(phase!=='play'||cool>0)return false;if(run.coins<=0){sBad();return false}x=Math.max(FL+CR+4,Math.min(FR-CR-4,x));
 run.coins--;run.st.drops++;cool=0.22;let k='coin';if(run.bombs>0){k='bomb';run.bombs--}else if(run.up.gold){run.goldN++;if(run.goldN%5===0)k='gold'}
 drops.push({x,y:40,t:0,k});sDrop();idleT=0;return true}
function land(d){const cw=cupW(),c=cupX(T);if(Math.abs(d.x-c)<cw/2){run.st.cup++;run.charge++;sCup();for(let i=0;i<10;i++){const a=Math.random()*6.28,v=50+Math.random()*80;parts.push({x:c,y:RAIL,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,l:0.5,c:'#ff8ab8',f:'sq'})}
  if(run.charge>=3){run.charge=0;run.st.sup++;const cyc=Math.PI*2/1.6;run.superUntil=Math.max(run.superUntil,pT)+cyc*3;sJack();shake=0.3;banner={t:0,s:'큰 밀기!',s2:'미는 판이 3번 크게 밀어요',c:'#ff4d8a'}}
  else pops.push({x:c,y:RAIL+26,t:0,s:'파워 '+run.charge+'/3',c:'#ff8ab8'});return}
 const y=pushY(pT)+KIND[d.k].r+2,b=body(d.k,d.x,y);b.vy=60;b.drop=0.25;B.push(b)}
// ── 물리(고정 시간 1/120초)
const HS=1/120;
function physics(){pT+=HS;const py0=pushY(pT-HS);run.amp+=(stroke()-run.amp)*Math.min(1,HS*2.5);const py=pushY(pT),pv=(py-py0)/HS;const gut=run.up.wall?GUT1:GUT0;
 for(const b of B){b.t+=HS;if(b.drop>0)b.drop-=HS;b.x+=b.vx*HS;b.y+=b.vy*HS;const fr=Math.exp(-5.5*HS);b.vx*=fr;b.vy*=fr;if(Math.abs(b.vx)<1.5)b.vx=0;if(Math.abs(b.vy)<1.5)b.vy=0;
  if(b.y-b.r<py){b.y=py+b.r;if(pv>0&&b.vy<pv)b.vy=pv}
  if(b.y<gut){if(b.x-b.r<FL){b.x=FL+b.r;b.vx=Math.abs(b.vx)*0.3}if(b.x+b.r>FR){b.x=FR-b.r;b.vx=-Math.abs(b.vx)*0.3}}
  if(b.k==='bomb'&&b.fuse>0){b.fuse-=HS;if(b.fuse<=0)boom(b)}}
 for(let it=0;it<5;it++){for(let i=0;i<B.length;i++){const a=B[i];for(let j=i+1;j<B.length;j++){const b=B[j],dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r;if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d2=dx*dx+dy*dy;if(d2>=rr*rr||d2===0)continue;
   const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,ov=rr-d,ia=1/a.m,ib=1/b.m,s=ia+ib;
   // 미는 판에 붙은 쪽은 뒤로 못 감
   let wa=ia/s,wb=ib/s;if(a.y-a.r<=py+0.5&&ny>0){wa=0;wb=1}else if(b.y-b.r<=py+0.5&&ny<0){wb=0;wa=1}
   a.x-=nx*ov*wa;a.y-=ny*ov*wa;b.x+=nx*ov*wb;b.y+=ny*ov*wb;
   if(it===0){const rv=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rv<0){const jn=-(1.15)*rv/s;a.vx-=jn*ia*nx;a.vy-=jn*ia*ny;b.vx+=jn*ib*nx;b.vy+=jn*ib*ny;if(rv<-40)sClink()}}}}}
 // 떨어짐 판정
 for(let i=B.length-1;i>=0;i--){const b=B[i];if(b.y>EDGE){B.splice(i,1);got(b)}else if(b.y>=gut&&(b.x<FL-2||b.x>FR+2)){B.splice(i,1);lost(b)}}}
function boom(b){sBoom();shake=0.35;for(const o of B){if(o===b)continue;const dx=o.x-b.x,dy=o.y-b.y,d=Math.hypot(dx,dy);if(d<80&&d>0){const f=(80-d)/80*260/o.m;o.vx+=dx/d*f*0.6;o.vy+=(dy/d*0.6+0.7)*f}}
 for(let i=0;i<18;i++){const a=Math.random()*6.28,v=80+Math.random()*140;parts.push({x:b.x,y:b.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,l:0.6,c:['#ff9d3d','#ffd23f','#ff4d6d'][i%3],f:'sq'})}b.k='coin';b.fuse=0}
function val(b){let v=KIND[b.k].v;if(run.up.gem&&(b.k==='gem'||b.k==='chest'))v=Math.round(v*1.5);return v}
function got(b){if(T-run.lastGot<0.8)run.chain++;else run.chain=1;run.lastGot=T;run.st.maxChain=Math.max(run.st.maxChain,run.chain);const mul=Math.min(3,1+0.25*(run.chain-1)),v=Math.round(val(b)*mul);
 if(run.chain>=3&&run.chain%2===1)pops.push({x:180,y:EDGE-30,t:0,s:'우르르 ×'+mul.toFixed(2).replace(/0$/,''),c:'#ff9db5',big:1});run.score+=v;run.fpts+=v;run.st.got++;if(b.k==='coin'||b.k==='gold'||b.k==='bomb')run.coins++;fall.push({b,t:0,lost:0});
 pops.push({x:b.x,y:EDGE+14,t:0,s:'+'+v,c:b.k==='chest'?'#d9a8ff':b.k==='gem'?'#7ff0ff':'#ffd23f',big:b.k==='chest'||b.k==='gem'});if(b.k!=='coin'&&b.k!=='bomb')sWin(b.k);else sClink();
 for(let i=0;i<(b.k==='chest'?20:5);i++){const a=-Math.PI/2+(Math.random()-0.5)*2.4,sp=60+Math.random()*120;parts.push({x:b.x,y:EDGE+6,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,l:0.7,c:FXS==='spark'?'#fffbe0':b.k==='gem'?'#7ff0ff':'#ffd23f',f:FXS||'sq'})}
 if(run.fpts>=TARGET[run.floor]&&phase==='play')clearFloor()}
function lost(b){run.st.lost++;fall.push({b,t:0,lost:b.x<180?-1:1});sLost()}
// ── 층
function clearFloor(){run.st.fl.push(run.fpts);if(run.floor>=FLOORS-1){run.clear=1;run.score+=run.coins*5;over();return}
 phase='up';sClear();offer={t:0,ids:run.offs[run.floor].filter(id=>!run.up[id]||id==='bomb'||id==='bag').slice(0,3)}}
function pickUp(i){if(phase!=='up'||!offer||offer.t<0.35||!offer.ids[i])return;const id=offer.ids[i];run.up[id]=(run.up[id]||0)+1;
 if(id==='bomb')run.bombs+=3;if(id==='bag')run.coins+=15;offer=null;run.floor++;run.fpts=0;run.tilts=run.up.tilt?2:0;floorPrizes();phase='play';idleT=0;
 banner={t:0,s:(run.floor+1)+'층',s2:'목표 '+TARGET[run.floor]+'점 · 새 보물이 놓였어요',c:'#ffd23f'};sClear()}
function tilt(){if(phase!=='play'||run.tilts<=0){sBad();return}run.tilts--;shake=0.4;noise(0.3,0.3,300);for(const b of B){if(b.y>BACK+60){b.vx+=(Math.random()-0.5)*90;b.vy+=40+Math.random()*80}}idleT=0}
function over(){if(phase==='over')return;phase='over';bgm(false);newBest=false;const sc=run.score;
 if(sc>best){newBest=sc>0;best=sc;try{localStorage.setItem('nr_best_pusher_'+KST,sc)}catch(e){}}
 lastRun={sc,floor:run.floor+(run.clear?1:0),drops:run.st.drops,cup:run.st.cup,sup:run.st.sup,got:run.st.got,lost:run.st.lost,maxChain:run.st.maxChain,fl:run.st.fl.slice(),clear:!!run.clear};
 if(!DEBUG){if(window.Bonus)Bonus.played('pusher');if(sc>0&&window.submitScore)submitScore(sc)}
 run.clear?sClear():sOver();
 setTimeout(()=>{if(phase==='over'){$('cp-go').textContent='↻ 다시 하기';$('cp-go').style.display='';$('cp-ov').style.display='flex'}},900);
 $('cp-msg').textContent='이번 판 '+sc+'점 · '+lastRun.floor+'층까지'+(newBest?' · 오늘 최고 기록!':'')}
// ── 시작·전체화면
function full(on){if(on){cab.classList.add('on');document.body.style.overflow='hidden';
  if(!IOS&&cab.requestFullscreen&&!document.fullscreenElement){cab.requestFullscreen({navigationUI:'hide'}).then(()=>{try{COARSE&&screen.orientation&&screen.orientation.lock&&screen.orientation.lock('portrait').catch(()=>{})}catch(e){}}).catch(()=>{})}
  if(IOS&&!navigator.standalone){const p=$('cp-ios');p.style.display='block';setTimeout(()=>p.style.display='none',4000)}}
 else{cab.classList.remove('on');document.body.style.overflow='';if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
 setTimeout(size,60);size()}
let runT0=0,acc=0;
function start(){ac();look();bestLoad();full(true);run=genRun(seedOverride||('pusher'+KST));pT=0;drops=[];fall=[];parts=[];pops=[];offer=null;seedField();
 {const m0=MUTE;MUTE=true;for(let i=0;i<240;i++)physics();MUTE=m0}// 처음 더미 자리 잡기
 run.score=0;run.fpts=0;run.coins=START_COINS;run.st.got=0;run.st.lost=0;run.st.maxChain=0;run.chain=0;fall=[];pops=[];
 phase='play';idleT=0;runT0=T;banner={t:0,s:'1층',s2:'목표 '+TARGET[0]+'점',c:'#ffd23f'};
 $('cp-go').style.display='none';$('cp-ov').style.display='none';$('cp-msg').textContent='화면을 눌러 동전을 넣으세요. 움직이는 파워 컵에 3번 넣으면 큰 밀기!';bgm(true)}
function pause(){if(phase==='play'||phase==='up'){prevPhase=phase;phase='pause';$('cp-go').textContent='▶ 이어 하기';$('cp-go').style.display=''}}
function resume(){if(phase!=='pause')return;phase=prevPhase;$('cp-go').style.display='none'}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&cab.classList.contains('on')&&!IOS){pause();cab.classList.remove('on');document.body.style.overflow='';setTimeout(size,60)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
// ── 입력
const BT_TILT={x:250,y:590,w:96,h:40};
const inR=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
function toW(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left-OX)/S,y:(e.clientY-r.top-OY)/S}}
function upRect(i){return {x:24,y:220+i*92,w:VW-48,h:80}}
let aimX=180;
cab.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();ac();const p=toW(e);
 if(phase==='idle'){start();return}if(phase==='pause'){resume();return}
 if(phase==='up'){for(let i=0;i<3;i++)if(inR(p,upRect(i))){pickUp(i);return}return}
 if(phase!=='play')return;if(run.up.tilt&&inR(p,BT_TILT)){tilt();return}
 aimX=p.x;drop(p.x)});
cab.addEventListener('pointermove',e=>{const p=toW(e);if(p.x>0&&p.x<VW)aimX=p.x});
addEventListener('keydown',e=>{if(!cab.classList.contains('on')&&phase==='idle')return;const k=e.key;
 if(phase==='play'){if(k==='ArrowLeft'){aimX=Math.max(FL,aimX-14)}else if(k==='ArrowRight'){aimX=Math.min(FR,aimX+14)}else if(k===' '||k==='Enter'){e.preventDefault();drop(aimX)}else if(k==='t'||k==='T')tilt()}
 else if(phase==='up'&&k>='1'&&k<='3')pickUp(+k-1);
 else if(phase==='over'&&k==='Enter'&&$('cp-go').style.display!=='none')start();
 else if(phase==='pause'&&(k==='Enter'||k===' '))resume();
 if(k==='Escape'&&phase!=='play')full(false)});
$('cp-go').onclick=()=>{if(phase==='pause')resume();else start()};
$('cp-x').onclick=()=>{pause();full(false)};
const muIc=()=>{$('cp-mu').textContent=MUTE?'🔇':'🔊'};muIc();
$('cp-mu').onclick=()=>{MUTE=!MUTE;muIc();try{localStorage.setItem('nr_cp_mute',MUTE?'1':'0')}catch(e){}};
$('cp-sh').onclick=()=>{const r=lastRun||{sc:0,floor:0};shareText('5락실 동전탑 '+KST.slice(5)+'\n🪙 '+r.sc+'점, '+r.floor+'층까지! 이겨 볼래?\n'+challengeUrl(r.sc))};
$('cp-rk').onclick=()=>{full(false);const r=$('rankbox');if(r)setTimeout(()=>r.scrollIntoView({behavior:'smooth'}),120)};
addEventListener('resize',()=>setTimeout(size,50));
addEventListener('bonus-look',()=>{if(phase==='idle'||phase==='over')look()});
// ── 그리기 도우미
const X=x=>OX+x*S,Y=y=>OY+y*S;
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
function lg(y0,y1,a,b){const g=cx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g}
function txt(s,x,y,sz,c,f,al){cx.font=Math.round(sz)+'px '+(f||FK);cx.fillStyle=c;cx.textAlign=al||'center';cx.fillText(s,x,y)}
function glowSpr(col){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,col+'ff');r.addColorStop(0.35,col+'66');r.addColorStop(1,col+'00');g.fillStyle=r;g.fillRect(0,0,64,64);return c}
const GL={y:glowSpr('#ffd23f'),c:glowSpr('#22d3ee'),p:glowSpr('#ff4d8a'),v:glowSpr('#b06bff')};
function glow(sp,x,y,r,a){cx.save();cx.globalCompositeOperation='lighter';cx.globalAlpha=a;cx.drawImage(sp,x-r,y-r,r*2,r*2);cx.restore()}
// 동전 그림: 스프라이트 미리 그림(종류×스킨)
const SPR={};
function spr(k){const key=k+'|'+CN;if(SPR[key])return SPR[key];const r=KIND[k].r,z=4,c=document.createElement('canvas');c.width=c.height=(r*2+6)*z;const g=c.getContext('2d');g.scale(z,z);g.translate(r+3,r+3);
 const face=(a,b,rim)=>{g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.arc(1.5,2.5,r,0,7);g.fill();const gr=g.createRadialGradient(-r*0.4,-r*0.4,1,0,0,r);gr.addColorStop(0,a);gr.addColorStop(1,b);g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,7);g.fill();g.strokeStyle=rim;g.lineWidth=1.6;g.stroke();g.beginPath();g.arc(0,0,r*0.74,0,7);g.stroke()};
 if(k==='coin'||k==='bomb'||k==='gold'){const gold=k==='gold';let a='#fff1a0',b='#e0a800',rim='#a87400';
  if(!gold&&CN==='jade'){a='#c8ffd8';b='#2fae6a';rim='#1a7a44'}else if(!gold&&CN==='heart'){a='#ffd0e4';b='#ff5fa8';rim='#c42a72'}else if(!gold&&CN==='star'){a='#d8e6ff';b='#5a7dff';rim='#2a44c8'}else if(gold){a='#ffffff';b='#ffc400';rim='#ff8a00'}
  if(k==='bomb'){a='#8a8aa8';b='#2a2a40';rim='#ff4d6d'}face(a,b,rim);g.fillStyle=k==='bomb'?'#ff4d6d':rim;
  if(k==='bomb'){g.font='bold '+(r*1.1)+'px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',0,1)}
  else if(CN==='heart'&&!gold){g.beginPath();const s=r*0.36;g.moveTo(0,s);g.bezierCurveTo(-s*2,-s*0.4,-s,-s*1.8,0,-s*0.6);g.bezierCurveTo(s,-s*1.8,s*2,-s*0.4,0,s);g.fill()}
  else if(CN==='star'&&!gold){g.beginPath();for(let i=0;i<10;i++){const a2=-Math.PI/2+i*Math.PI/5,rr2=i%2?r*0.22:r*0.5;g.lineTo(Math.cos(a2)*rr2,Math.sin(a2)*rr2)}g.closePath();g.fill()}
  else{// 동전이 발자국
   g.beginPath();g.ellipse(0,r*0.15,r*0.24,r*0.2,0,0,7);g.fill();for(let i=0;i<4;i++){const a2=-Math.PI*0.85+i*Math.PI*0.23;g.beginPath();g.arc(Math.cos(a2)*r*0.42,Math.sin(a2)*r*0.42+r*0.08,r*0.1,0,7);g.fill()}}
  if(gold){g.fillStyle='#fff';g.globalAlpha=0.8;g.beginPath();g.ellipse(-r*0.35,-r*0.4,r*0.18,r*0.08,-0.6,0,7);g.fill()}}
 else if(k==='gem'){g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(1.5,3,r*0.9,r*0.5,0,0,7);g.fill();const gr=g.createLinearGradient(0,-r,0,r);gr.addColorStop(0,'#bdfcff');gr.addColorStop(1,'#1a9ad8');g.fillStyle=gr;
  g.beginPath();g.moveTo(-r,-r*0.25);g.lineTo(-r*0.5,-r*0.8);g.lineTo(r*0.5,-r*0.8);g.lineTo(r,-r*0.25);g.lineTo(0,r);g.closePath();g.fill();g.strokeStyle='#0a5a8a';g.lineWidth=1.2;g.stroke();
  g.strokeStyle='#ffffffaa';g.beginPath();g.moveTo(-r,-r*0.25);g.lineTo(r,-r*0.25);g.moveTo(-r*0.5,-r*0.8);g.lineTo(-r*0.2,-r*0.25);g.lineTo(0,r);g.moveTo(r*0.5,-r*0.8);g.lineTo(r*0.2,-r*0.25);g.stroke()}
 else if(k==='chest'){g.fillStyle='rgba(0,0,0,.4)';g.fillRect(-r+2,-r*0.6+3,r*2,r*1.5);g.fillStyle='#8a4a1a';g.fillRect(-r,-r*0.6,r*2,r*1.5);g.fillStyle='#b8682a';g.beginPath();g.moveTo(-r,-r*0.2);g.quadraticCurveTo(0,-r*1.2,r,-r*0.2);g.closePath();g.fill();
  g.strokeStyle='#ffd23f';g.lineWidth=2.4;g.strokeRect(-r,-r*0.6+0.5,r*2,r*1.5-1);g.beginPath();g.moveTo(-r*0.5,-r*0.85);g.lineTo(-r*0.5,r*0.9);g.moveTo(r*0.5,-r*0.85);g.lineTo(r*0.5,r*0.9);g.stroke();
  g.fillStyle='#ffd23f';g.fillRect(-r*0.18,-r*0.3,r*0.36,r*0.45);g.fillStyle='#2a1400';g.fillRect(-r*0.06,-r*0.15,r*0.12,r*0.2)}
 SPR[key]=c;return c}
function drawB(b,x,y,sc){const c=spr(b.k),r=KIND[b.k].r,s=(r*2+6)*S*(sc||1);cx.drawImage(c,X(x)-s/2,Y(y)-s/2,s,s);
 if(b.k==='bomb'&&b.fuse>0&&Math.sin(T*(30-b.fuse*10))>0)glow(GL.p,X(x),Y(y),20*S,0.6)}
// ── 배경: 밤 오락실(그라데이션 + 네온 간판 2겹 + 빛 망울)
const BOKEH=[];for(let i=0;i<24;i++)BOKEH.push({x:Math.random(),y:Math.random(),r:8+Math.random()*24,v:0.006+Math.random()*0.014,c:['p','c','y','v'][i%4],p:Math.random()*6.28});
const SIGN=[];{let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;for(let L=0;L<2;L++){const row=[];for(let i=0;i<14;i++)row.push({w:30+r()*50,h:10+r()*26,c:['#ff4d8a','#22d3ee','#ffd23f','#b06bff','#7ddc6a'][Math.floor(r()*5)]});SIGN.push(row)}}
function drawBg(){cx.fillStyle=lg(0,H,'#1a0830','#06142a');cx.fillRect(0,0,W,H);
 for(let L=0;L<2;L++){const sc=(L?1:0.7)*S,base=H*(L?0.7:0.3),dx=-(T*(L?10:5)*S)%(900*sc);cx.globalAlpha=L?0.3:0.18;let x=dx-900*sc;
  while(x<W){for(const b of SIGN[L]){if(x>W)break;cx.strokeStyle=b.c;cx.lineWidth=2*sc;cx.strokeRect(x,base-b.h*sc,b.w*sc,b.h*sc);cx.fillStyle=b.c+'33';cx.fillRect(x,base-b.h*sc,b.w*sc,b.h*sc);x+=b.w*sc+18*sc}}}
 cx.globalAlpha=1;for(const b of BOKEH){const yy=((b.y-T*b.v)%1+1)%1*H,xx=b.x*W+Math.sin(T*0.5+b.p)*14;glow(GL[b.c],xx,yy,b.r*S,0.14+0.06*Math.sin(T+b.p))}}
// ── 기계
function drawMachine(){const gut=run&&run.up.wall?GUT1:GUT0;
 // 몸통
 cx.fillStyle=lg(Y(56),Y(600),'#3a1f7a','#140a30');rr(X(6),Y(56),(VW-12)*S,(576)*S,18*S);cx.fill();cx.strokeStyle='#ff4d8a';cx.lineWidth=2.5*S;cx.globalAlpha=0.6+0.25*Math.sin(T*2);cx.stroke();cx.globalAlpha=1;
 // 판(바닥)
 const g=cx.createLinearGradient(0,Y(BACK),0,Y(EDGE));g.addColorStop(0,'#1d2a4a');g.addColorStop(1,'#2f4570');cx.fillStyle=g;cx.fillRect(X(FL),Y(BACK),(FR-FL)*S,(EDGE-BACK)*S);
 cx.strokeStyle='#ffffff10';cx.lineWidth=1;cx.beginPath();for(let y=BACK;y<EDGE;y+=24){cx.moveTo(X(FL),Y(y));cx.lineTo(X(FR),Y(y))}cx.stroke();
 // 옆벽(유리)·옆 홈
 for(const sx of [FL-10,FR]){cx.fillStyle='#9fd8ff33';cx.fillRect(X(sx),Y(BACK-6),10*S,(gut-BACK+6)*S);cx.fillStyle='#9fd8ff88';cx.fillRect(X(sx+(sx<180?8:0)),Y(BACK-6),2*S,(gut-BACK+6)*S);
  cx.fillStyle='#05020f';cx.fillRect(X(sx),Y(gut),10*S,(EDGE-gut+40)*S);txt('홈',X(sx+5),Y(gut+16),8*S,'#ff6d8a',FK)}
 // 앞 턱
 cx.fillStyle=lg(Y(EDGE),Y(EDGE+10),'#ffd23f','#b8860b');cx.fillRect(X(FL-10),Y(EDGE),(FR-FL+20)*S,6*S);
 // 받는 통
 cx.fillStyle=lg(Y(EDGE+8),Y(584),'#2a1450','#0b0620');rr(X(FL-10),Y(EDGE+8),(FR-FL+20)*S,72*S,12*S);cx.fill();txt('받는 통',X(VW/2),Y(574),9*S,'#ffffff44',FK)}
function drawPusher(){const py=pushY(pT);if(superOn())glow(GL.p,X(VW/2),Y(py),150*S,0.35+0.15*Math.sin(T*10));// 뒤 벽
 cx.fillStyle=lg(Y(BACK-30),Y(py),'#8a94b8','#5a6488');cx.fillRect(X(FL),Y(BACK-6),(FR-FL)*S,(py-BACK+6)*S);
 cx.fillStyle='#ffffff22';for(let x=FL+10;x<FR;x+=26)cx.fillRect(X(x),Y(BACK-6),2*S,(py-BACK+6)*S);
 cx.fillStyle=lg(Y(py-10),Y(py),'#c8d0ec','#7a84a8');cx.fillRect(X(FL),Y(py-10),(FR-FL)*S,10*S);cx.fillStyle='#ffd23f';cx.fillRect(X(FL),Y(py-2),(FR-FL)*S,2*S);
 // 동전이 얼굴(미는 판 가운데)
 const fx=X(VW/2),fy=Y(py-24),z=S;cx.fillStyle='#f4c27a';cx.beginPath();cx.ellipse(fx,fy,22*z,17*z,0,0,7);cx.fill();cx.fillStyle='#c8864a';cx.beginPath();cx.ellipse(fx-20*z,fy-8*z,8*z,13*z,-0.5,0,7);cx.ellipse(fx+20*z,fy-8*z,8*z,13*z,0.5,0,7);cx.fill();
 cx.fillStyle='#2a1400';cx.beginPath();cx.arc(fx-8*z,fy-3*z,2.6*z,0,7);cx.arc(fx+8*z,fy-3*z,2.6*z,0,7);cx.fill();cx.beginPath();cx.ellipse(fx,fy+4*z,4*z,3*z,0,0,7);cx.fill();
 cx.fillStyle='#ff6d8a';cx.beginPath();cx.ellipse(fx,fy+10*z,3*z,3.6*z+Math.max(0,Math.sin(T*6))*1.5*z,0,0,7);cx.fill()}
function drawRail(){const cw=cupW(),c=cupX(T);cx.fillStyle='#0b0620cc';rr(X(FL-6),Y(RAIL-12),(FR-FL+12)*S,24*S,10*S);cx.fill();cx.strokeStyle='#ffd23f55';cx.lineWidth=1.5*S;cx.stroke();
 const sup=superOn();glow(GL.p,X(c),Y(RAIL),cw*0.9*S,0.45+0.2*Math.sin(T*8));cx.fillStyle=lg(Y(RAIL-10),Y(RAIL+10),'#ff8ab8','#c42a72');rr(X(c-cw/2),Y(RAIL-10),cw*S,20*S,7*S);cx.fill();cx.strokeStyle='#fff';cx.lineWidth=1.5*S;cx.stroke();
 txt('P',X(c),Y(RAIL+5),11*S,'#fff',FN);
 // 파워 칸 3개
 for(let i=0;i<3;i++){const on=sup||i<run.charge;cx.fillStyle=on?'#ff4d8a':'#ffffff22';rr(X(FR-58+i*20),Y(RAIL-32),16*S,8*S,3*S);cx.fill()}txt(sup?'큰 밀기 중!':'POWER',X(FR-58),Y(RAIL-36),sup?10*S:6*S,'#ff8ab8',sup?FK:FN,'left');
 if(phase==='play'){cx.strokeStyle='#ffffff44';cx.setLineDash([4*S,5*S]);cx.lineWidth=1.5*S;cx.beginPath();const ax=Math.max(FL+CR,Math.min(FR-CR,aimX));cx.moveTo(X(ax),Y(40));cx.lineTo(X(ax),Y(pushY(pT)+CR));cx.stroke();cx.setLineDash([])}}
function drawField(){for(const b of B){const y=b.drop>0?b.y-b.drop*40:b.y,sc=b.drop>0?1+b.drop*1.2:1;drawB(b,b.x,y,sc)}
 for(const b of B)if(b.k==='gem')glow(GL.c,X(b.x),Y(b.y),18*S,0.25+0.1*Math.sin(T*3+b.x));else if(b.k==='chest')glow(GL.v,X(b.x),Y(b.y),30*S,0.25+0.1*Math.sin(T*2))}
function drawDrops(){for(const d of drops){if(d.t<0)continue;const k=Math.min(1,d.t/0.32);drawB({k:d.k,fuse:0},d.x,40+(RAIL-40)*k,1.15-0.15*k)}
 for(const f of fall){const k=f.t/0.5,b=f.b;cx.globalAlpha=Math.max(0,1-k);if(f.lost)drawB(b,b.x+f.lost*k*20,b.y+k*30,1-k*0.5);else drawB(b,b.x,EDGE+k*40,1-k*0.3);cx.globalAlpha=1}
 }
function drawHud(){txt('FLOOR '+(run.floor+1)+'/'+FLOORS,X(14),Y(26),9*S,'#22d3ee',FN,'left');txt('SCORE '+run.score,X(VW-14),Y(26),9*S,'#b9a8ff',FN,'right');
 const tg=TARGET[run.floor],pct=Math.max(0,Math.min(1,run.fpts/tg));cx.fillStyle='#ffffff18';rr(X(70),Y(36),(VW-140)*S,8*S,4*S);cx.fill();cx.fillStyle='#ffd23f';rr(X(70),Y(36),(VW-140)*pct*S,8*S,4*S);cx.fill();
 txt(run.fpts+' / '+tg,X(VW/2),Y(60),11*S,'#fff',FN);
 // 넣을 동전
 cx.fillStyle='#0b0620cc';rr(X(12),Y(588),130*S,44*S,12*S);cx.fill();cx.strokeStyle='#ffd23f';cx.lineWidth=2*S;cx.stroke();drawB({k:'coin'},34,610,0.9);txt('×'+run.coins,X(54),Y(617),16*S,run.coins>5?'#ffd23f':'#ff6d8a',FN,'left');
 if(run.bombs)txt('폭탄 동전 '+run.bombs,X(150),Y(604),10*S,'#ff6d8a',FK,'left');
 if(run.up.tilt){const on=run.tilts>0;cx.fillStyle=on?'#22d3ee':'#2a1d5c';rr(X(BT_TILT.x),Y(BT_TILT.y),BT_TILT.w*S,BT_TILT.h*S,11*S);cx.fill();cx.strokeStyle='#22d3ee';cx.lineWidth=2*S;cx.stroke();txt('흔들기 '+run.tilts,X(BT_TILT.x+BT_TILT.w/2),Y(BT_TILT.y+26),14*S,on?'#1a0f00':'#22d3ee',FK)}
 const ups=Object.keys(run.up);if(ups.length){cx.font=Math.round(8.5*S)+'px '+FK;let x=X(12);for(const id of ups){const n=UPS.find(u=>u.id===id).n,tw=cx.measureText(n).width+8*S;cx.fillStyle='#b06bff33';rr(x,Y(70),tw,13*S,5*S);cx.fill();cx.fillStyle='#d9c2ff';cx.textAlign='left';cx.fillText(n,x+4*S,Y(80));x+=tw+4*S}}
 if(T<runT0+4&&run.floor===0&&run.st.drops<2){cx.globalAlpha=Math.min(1,runT0+4-T);txt(COARSE?'원하는 곳을 눌러 동전 넣기':'클릭 또는 ←→ + 스페이스로 동전 넣기',X(VW/2),Y(330),14*S,'#fff',FK);txt('분홍 파워 컵에 3번 넣으면 큰 밀기!',X(VW/2),Y(352),12*S,'#ff9db5',FK);cx.globalAlpha=1}}
function drawFx(){for(const p of parts){const a=1-p.t/p.l;if(a<=0)continue;cx.globalAlpha=a;const x=X(p.x),y=Y(p.y),s=S;
  if(p.f==='confetti'){cx.fillStyle=['#ff4d8a','#22d3ee','#ffd23f','#7ddc6a'][Math.floor(p.x)%4];cx.save();cx.translate(x,y);cx.rotate(p.t*9+p.x);cx.fillRect(-4*s,-2*s,8*s,4*s);cx.restore()}
  else if(p.f==='spark'){glow(GL.y,x,y,7*s,a)}
  else{cx.fillStyle=p.c;cx.fillRect(x-2*s,y-2*s,4*s,4*s)}}cx.globalAlpha=1;
 for(const p of pops){const a=1-p.t;if(a<=0)continue;cx.globalAlpha=a;txt(p.s,X(p.x),Y(p.y-p.t*36),(p.big?18:13)*S,p.c,FK);cx.globalAlpha=1}
 if(banner&&banner.t<1.5){const a=banner.t<0.15?banner.t/0.15:banner.t>1.1?(1.5-banner.t)/0.4:1;cx.globalAlpha=a;const sc=1+Math.max(0,0.25-banner.t)*2;cx.save();cx.translate(X(VW/2),Y(165));cx.scale(sc,sc);
  cx.fillStyle='#0b0620dd';rr(-140*S,-36*S,280*S,64*S,14*S);cx.fill();cx.strokeStyle=banner.c||'#ffd23f';cx.lineWidth=2.5*S;cx.stroke();txt(banner.s,0,-4*S,24*S,'#fff',FK);txt(banner.s2,0,18*S,12*S,banner.c||'#ffd23f',FK);cx.restore();cx.globalAlpha=1}}
function panel(y,h){cx.fillStyle='#0b0620f2';rr(X(16),Y(y),(VW-32)*S,h*S,16*S);cx.fill();cx.strokeStyle='#b06bff';cx.lineWidth=2*S;cx.stroke()}
function drawUp(){cx.fillStyle='#050214cc';cx.fillRect(0,0,W,H);txt((run.floor+1)+'층 통과!',X(VW/2),Y(170),26*S,'#ffd23f',FK);txt('기계 개조 하나 고르기 · 끝까지 효과가 남아요',X(VW/2),Y(198),11.5*S,'#ffffffaa',FK);
 for(let i=0;i<offer.ids.length;i++){const u=UPS.find(x=>x.id===offer.ids[i]),r=upRect(i),k=Math.min(1,Math.max(0,(offer.t-i*0.08)/0.25));cx.globalAlpha=k;const x=X(r.x+(1-k)*50),y=Y(r.y);
  cx.fillStyle=lg(y,y+r.h*S,'#3a1f7a','#1e0f48');rr(x,y,r.w*S,r.h*S,14*S);cx.fill();cx.strokeStyle='#ffd23f';cx.lineWidth=2*S;cx.stroke();
  glow(GL.y,x+36*S,y+40*S,26*S,0.5);txt('⚙',x+36*S,y+50*S,26*S,'#ffd23f',FK);txt(u.n,x+70*S,y+34*S,17*S,'#fff',FK,'left');txt(u.d,x+70*S,y+58*S,11.5*S,'#d9c2ff',FK,'left');txt(String(i+1),x+r.w*S-14*S,y+20*S,8*S,'#ffffff66',FN,'right');cx.globalAlpha=1}}
function drawOver(){const r=lastRun||{sc:0,floor:0,drops:0,cup:0,sup:0,got:0,lost:0,maxChain:0};cx.fillStyle='#050214c4';cx.fillRect(0,0,W,H);panel(110,310);
 txt(r.clear?'5층 정복!':'동전이 바닥났어요',X(VW/2),Y(152),22*S,'#fff',FK);txt(String(r.sc),X(VW/2),Y(204),30*S,'#ffd23f',FN);txt(newBest?'NEW BEST!':'오늘 최고 '+best,X(VW/2),Y(232),10*S,newBest?'#3ddc84':'#ffffff99',FN);
 const st=[['올라간 층',r.floor+'층'],['최대 우르르',(r.maxChain||0)+'연쇄'],['큰 밀기',(r.sup||0)+'번']];for(let i=0;i<3;i++){const x=X(36+i*100);cx.fillStyle='#ffffff10';rr(x,Y(256),92*S,62*S,10*S);cx.fill();txt(st[i][0],x+46*S,Y(278),11*S,'#ffffffaa',FK);txt(st[i][1],x+46*S,Y(306),15*S,'#fff',FK)}
 txt('앞으로 '+r.got+'개 · 옆 홈으로 '+r.lost+'개',X(VW/2),Y(346),12*S,'#ffd23fcc',FK);txt('넣은 동전 '+r.drops+'개 · 파워 컵 '+r.cup+'번',X(VW/2),Y(368),11*S,'#ff9db5',FK);
 txt('PC는 Enter로 다시 시작',X(VW/2),Y(400),10*S,'#ffffff66',FK)}
function drawIdle(){cx.fillStyle='#0b0620aa';rr(X(30),Y(130),(VW-60)*S,250*S,18*S);cx.fill();txt('동전탑',X(VW/2),Y(196),46*S,'#fff',FK);txt('동전이의 동전 밀어내기, 5층까지!',X(VW/2),Y(228),14*S,'#ffd23f',FK);
 const ks=['coin','gold','gem','chest','coin'];for(let i=0;i<5;i++)drawB({k:ks[i],fuse:0},100+i*40,280+Math.sin(T*3+i)*6,1.4);if(best)txt('오늘 내 최고 '+best+'점',X(VW/2),Y(350),13*S,'#3ddc84',FK)}
function drawPause(){cx.fillStyle='#0b0620';cx.fillRect(0,0,W,H);txt('잠깐 멈춤',X(VW/2),Y(300),26*S,'#fff',FK);txt('누르면 이어서 해요',X(VW/2),Y(330),13*S,'#ffffffaa',FK)}
// ── 루프
let last=performance.now();
function step(dt){T+=dt;if(cool>0)cool-=dt;for(const p of parts){p.t+=dt;p.vy+=240*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}parts=parts.filter(p=>p.t<p.l);pops.forEach(p=>p.t+=dt);pops=pops.filter(p=>p.t<1);
 fall.forEach(f=>f.t+=dt);fall=fall.filter(f=>f.t<0.5);if(banner)banner.t+=dt;if(shake>0)shake=Math.max(0,shake-dt);if(offer)offer.t+=dt;
 if(phase!=='play')return;
 for(let i=drops.length-1;i>=0;i--){const d=drops[i];d.t+=dt;if(d.t>=0.32){drops.splice(i,1);if(d.gift){const y=pushY(pT)+KIND[d.k].r+2,b=body(d.k,d.x,y);b.vy=40;b.drop=0.2;B.push(b)}else land(d)}}
 acc+=dt;while(acc>=HS&&phase==='play'){acc-=HS;physics()}
 // 끝: 동전 0개이고 판이 멈췄을 때
 const moving=drops.length||B.some(b=>Math.abs(b.vx)+Math.abs(b.vy)>4||b.fuse>0);if(run.coins<=0&&!moving)idleT+=dt;else idleT=0;
 if(run.coins<=0&&idleT>3.5&&phase==='play'){run.st.fl.push(run.fpts);over()}}
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;if(DEBUG&&DBG.bot&&phase==='play')botStep(dt);else if(DEBUG&&DBG.bot&&phase==='up'&&offer&&offer.t>0.4)pickUp(DBG.pick||0);
 const k=DEBUG&&DBG.fast?DBG.fast:1;for(let i=0;i<k;i++){step(dt);if(DEBUG&&DBG.bot&&DBG.fast&&phase==='play'&&i<k-1)botStep(dt)}
 if(!W)size();cx.setTransform(dpr,0,0,dpr,0,0);
 if(phase==='pause'){drawPause();requestAnimationFrame(frame);return}
 if(shake>0){const m=shake*12*S;cx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m)}
 drawBg();
 if(phase==='idle')drawIdle();
 else if(run){drawMachine();drawPusher();drawField();drawRail();drawDrops();drawHud();drawFx();if(phase==='up'&&offer)drawUp();if(phase==='over')drawOver()}
 requestAnimationFrame(frame)}
// ── 디버그: 봇(보물·보석 뒤쪽 가운데를 노리고, 가끔 파워 컵을 노림)
const DBG={bot:false,fast:0,cupAim:0.2,pick:0,t:0};
function botStep(dt){DBG.t+=dt;if(DBG.t<0.5||cool>0)return;DBG.t=0;
 if(run.up.tilt&&run.tilts>0&&run.coins<5){tilt();return}
 if(Math.random()<DBG.cupAim){drop(cupX(T+0.32));return}
 let bx=180,bv=-1;for(let x=60;x<=300;x+=20){let v=0;for(const b of B){if(Math.abs(b.x-x)<30)v+=(b.k==='chest'?6:b.k==='gem'?3:b.k==='gold'?2:0.4)*(b.y/EDGE)}v-=Math.abs(x-180)*0.01;if(v>bv){bv=v;bx=x}}drop(bx)}
if(DEBUG)window.__cp={dbg:DBG,start,bot(on){DBG.bot=!!on},seed(s){seedOverride=s},drop,tilt,
 state:()=>({pT,T,phase,floor:run?run.floor:0,score:run?run.score:0,fpts:run?run.fpts:0,coins:run?run.coins:0,n:B.length,last:lastRun}),setLook(c,f){CN=c||'';FXS=f||''},cupX:()=>cupX(T)};
look();bestLoad();size();requestAnimationFrame(frame);
})();
