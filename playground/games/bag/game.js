(function(){
// 봉투 꽉!: 5락실 창작 장바구니 담기 퍼즐 로그라이트. 물건·봉투·배경·소리 모두 코드로 생성(외부 파일 없음).
// 봉투(격자)에 장 본 물건을 담는다. 냉동끼리 붙이기, 무거운 건 바닥, 깨지는 건 위, 레시피 세트, 꽉 채우기로 점수.
// 봉투마다 목표 점수를 넘기면 쿠폰(영구 효과)을 하나 고르고 다음 봉투로. 5봉투까지, 오늘은 모두 같은 물건 순서.
// 봉투를 열 때 '덤 뽑기'(그림 3칸): 같은 그림 2개면 값 2배 덤 물건, 3개면 황금(3배). 다시 뽑기 티켓은 게임 안에서만 얻어요(현금·코인 없음).
const $=id=>document.getElementById(id);
const cab=$('bg-cab'),cv=$('bg-c'),cx=cv.getContext('2d');
const COARSE=matchMedia('(pointer: coarse)').matches,IOS=/iP(hone|od|ad)/.test(navigator.userAgent);
const DEBUG=location.hash.indexOf('bgdebug')>=0;
const FN='"Press Start 2P",monospace',FK='"Black Han Sans","Noto Sans KR",sans-serif',FB='"Noto Sans KR",system-ui,sans-serif';
try{document.fonts&&document.fonts.load('10px "Press Start 2P"');document.fonts&&document.fonts.load('16px "Black Han Sans"','봉투')}catch(e){}
// ── 월드: 360×640 세로 화면 기준, 가로 화면은 가운데 + 양옆 배경
const VW=360,VH=640,C=46,COLS=6,BY=124,TRY=470,TRH=96;
let W=0,H=0,dpr=1,S=1,OX=0,OY=0;
function size(){const r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);
 if(W*H*dpr*dpr>3.6e6)dpr=Math.max(1,Math.sqrt(3.6e6/(W*H)));cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);S=Math.min(W/VW,H/VH);OX=(W-VW*S)/2;OY=(H-VH*S)/2}
// ── 물건: w×h 칸, 기본 점수, 성질(냉동·냉장·깨짐·무거움·종류)
const IT={
 milk:{n:'우유',w:1,h:2,p:30,t:['cold']}, eggs:{n:'계란',w:2,h:1,p:40,t:['fragile']}, tofu:{n:'두부',w:1,h:1,p:25,t:['fragile','cold']},
 ramen:{n:'라면',w:2,h:1,p:30,t:['snack']}, melon:{n:'수박',w:2,h:2,p:60,t:['heavy','fruit']}, water:{n:'생수',w:1,h:2,p:35,t:['heavy']},
 onion:{n:'대파',w:1,h:3,p:30,t:['veg']}, apple:{n:'사과',w:1,h:1,p:20,t:['fruit']}, dump:{n:'냉동만두',w:2,h:1,p:35,t:['frozen']},
 icecr:{n:'아이스크림',w:1,h:1,p:25,t:['frozen']}, chips:{n:'과자',w:1,h:2,p:30,t:['snack','fragile']}, tissue:{n:'휴지',w:2,h:2,p:30,t:['home']},
 soap:{n:'세제',w:1,h:2,p:35,t:['heavy','home']}, meat:{n:'고기',w:2,h:1,p:45,t:['cold']}, carrot:{n:'당근',w:1,h:1,p:20,t:['veg']}};
const POOL=['milk','eggs','tofu','ramen','melon','water','onion','apple','dump','icecr','chips','tissue','soap','meat','carrot','milk','ramen','apple','icecr','dump','carrot','eggs','onion'];
const KIND=['snack','fruit','veg','home'];
const RECIPES=[{id:'ramen',n:'라면 세트',k:['ramen','eggs','onion'],p:80},{id:'stew',n:'찌개 세트',k:['tofu','meat','onion'],p:80},{id:'summer',n:'여름 간식',k:['melon','icecr'],p:50},{id:'curry',n:'카레 세트',k:['meat','carrot','onion'],p:80}];
const TARGET=[320,420,520,620,720],QLEN=[17,18,19,20,21],BAGS=5;
const CPS=[
 {id:'frz',n:'냉동 콤보 2배',d:'냉동끼리 붙이면 +40'},{id:'ins',n:'깨짐 보험',d:'봉투마다 첫 깨짐 1번은 무효'},
 {id:'full',n:'꽉 채움 2배',d:'90% 넘게 채우면 +120'},{id:'rec',n:'레시피 장인',d:'세트 보너스 1.5배'},
 {id:'same',n:'정리 달인',d:'같은 종류끼리 붙이면 +20'},{id:'big',n:'큰 봉투',d:'봉투가 한 줄 더 깊어져요'},
 {id:'tray',n:'카트 한 칸 더',d:'계산대 물건이 4개씩'},{id:'floor',n:'튼튼한 바닥',d:'무거운 것 바닥에 +30'}];
const has=(k,t)=>IT[k].t.indexOf(t)>=0;
const SLOT=['melon','meat','icecr','eggs'],SLOT_STOP=[0.55,0.9,1.25];
// ── 꾸미기(겉모습만): 봉투 디자인 bag, 담을 때 효과 fx
let BAGSK='',FXSK='';
function look(){const B=window.Bonus;try{BAGSK=B&&B.gitem?B.gitem('bag','bag')||'':'';FXSK=B&&B.gitem?B.gitem('bag','fx')||'':''}catch(e){BAGSK=FXSK=''}}
// ── 소리(웹오디오 합성) + 배경음
let AC=null,MUTE=false;try{MUTE=localStorage.getItem('nr_bg_mute')==='1'}catch(e){}
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(type,f,a,dur,f2,delay){if(MUTE||!AC)return;const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();
 o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.02)}
function noise(a,dur,hp){if(MUTE||!AC)return;const n=Math.floor(AC.sampleRate*dur),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
 const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=b;f.type='highpass';f.frequency.value=hp||1200;g.gain.value=a;s.connect(f);f.connect(g);g.connect(AC.destination);s.start()}
const sPick=()=>tone('sine',660,0.12,0.07,880);
const sPlace=heavy=>{if(heavy){tone('triangle',150,0.32,0.18,70);noise(0.08,0.08,400)}else{tone('triangle',420,0.2,0.1,300);tone('sine',840,0.06,0.08,0,0.02)}};
const sBad=()=>{tone('square',140,0.08,0.12);tone('square',110,0.08,0.12,0,0.08)};
const sBreak=()=>{noise(0.32,0.25,1800);tone('sawtooth',300,0.07,0.2,90)};
const sSet=()=>{[523,659,784,1047].forEach((f,i)=>tone('triangle',f,0.16,0.18,0,i*0.07))};
const sTick=()=>tone('square',1200,0.04,0.03);
const sPass=()=>{[523,659,784,1047,1319].forEach((f,i)=>tone('triangle',f,0.18,0.22,0,i*0.08));tone('sine',262,0.12,0.6)};
const sFail=()=>{tone('triangle',392,0.22,0.3,330);tone('triangle',330,0.22,0.5,196,0.25)};
const sRot=()=>tone('sine',520,0.08,0.06,700);
const sLever=()=>{tone('sawtooth',90,0.12,0.18,60);noise(0.1,0.12,600)};
const sStop=()=>{tone('square',260,0.1,0.06);noise(0.12,0.05,2400)};
const sJack=()=>{[784,988,1175,1568,1175,1568].forEach((f,i)=>tone('square',f,0.08,0.12,0,i*0.07));tone('sine',392,0.12,0.8)};
const sMiss=()=>{tone('triangle',330,0.12,0.15,300);tone('triangle',262,0.12,0.25,220,0.14)};
let bgmT=null,bgmI=0;const MEL=[659,0,784,659,587,0,523,0,587,659,0,523,440,0,392,0],BAS=[131,131,175,175,196,196,131,131];
function bgm(on){if(bgmT){clearInterval(bgmT);bgmT=null}if(!on)return;bgmT=setInterval(()=>{if(MUTE||!AC||phase==='idle'||phase==='pause')return;const m=MEL[bgmI%16];if(m)tone('sine',m,0.035,0.22);if(bgmI%2===0)tone('triangle',BAS[(bgmI>>1)%8],0.05,0.3);bgmI++},250)}
// ── 상태
let phase='idle',slot=null,R,run,grid,rows,placed,tray,queue,sel=-1,drag=null,ghost=null,parts=[],pops=[],rings=[],shake=0,T=0,tal=null,offer=null,best=0,newBest=false,lastRun=null,ev=null,banner=null;
function bestLoad(){try{best=+localStorage.getItem('nr_best_bag_'+KST)||0}catch(e){}}
function genRun(seed){R=seeded(seed);const qs=[],offs=[];
 for(let b=0;b<BAGS;b++){const q=[];for(let i=0;i<QLEN[b];i++){const k=POOL[Math.floor(R()*POOL.length)];const rr_=R();q.push({k,rot:rr_<0.3&&IT[k].w!==IT[k].h?1:0})}qs.push(q)}
 for(let b=0;b<BAGS-1;b++){const p=CPS.map(c=>c.id);for(let i=p.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[p[i],p[j]]=[p[j],p[i]]}offs.push(p)}
 return {bag:0,total:0,cp:{},qs,offs,sr:seeded(seed+'#덤'),tix:1,stats:{items:0,sets:0,broken:0,best:0,bs:[],gold:0,pair:0,miss:0,spins:0}}}
const pw=pc=>pc.rot?IT[pc.k].h:IT[pc.k].w, ph=pc=>pc.rot?IT[pc.k].w:IT[pc.k].h;
const BX=()=> (VW-COLS*C)/2;
function newBag(){rows=run.cp.big?7:6;grid=[];for(let y=0;y<rows;y++)grid.push(new Array(COLS).fill(-1));placed=[];queue=run.qs[run.bag].slice();
 tray=[];sel=-1;drag=null;ev=evaluate();phase='slot';slot={t:0,st:-1,res:null,first:true}}
// ── 덤 뽑기: 같은 그림 2개 → 그 물건 값 2배짜리 덤, 3개 → 황금(3배). 뽑기 결과는 오늘의 판마다 같은 순서(공정).
function slotKind(r){if(r[0]===r[1]&&r[1]===r[2])return {m:3,k:r[0]};const k=r[0]===r[1]||r[0]===r[2]?r[0]:r[1]===r[2]?r[1]:null;return k?{m:2,k}:{m:0,k:null}}
function spin(){if(phase!=='slot'||!slot)return;if(slot.st>=0&&slot.st<3)return;if(!slot.first){if(run.tix<=0){sBad();return}run.tix--}
 slot.first=false;slot.st=0;slot.t=0;slot.stopT=[];slot.res=[0,1,2].map(()=>SLOT[Math.floor(run.sr()*SLOT.length)]);slot.out=slotKind(slot.res);run.stats.spins++;sLever()}
function slotDone(){return slot&&slot.st>=3}
function takeSlot(){if(phase!=='slot'||!slot)return;if(slot.st<0){spin();return}if(!slotDone())return;const o=slot.out;
 if(o.m){queue.unshift({k:o.k,rot:0,m:o.m});run.stats[o.m===3?'gold':'pair']++}else run.stats.miss++;
 const n=run.cp.tray?4:3;tray=[];for(let i=0;i<n;i++)tray.push(queue.shift()||null);slot=null;phase='play';
 banner={t:0,s:(run.bag+1)+'번째 봉투',s2:'목표 '+TARGET[run.bag]+'점'+(o.m?' · '+(o.m===3?'황금 ':'덤 ')+IT[o.k].n+' ×'+o.m:'')}}
function fits(pc,gx,gy){const w=pw(pc),h=ph(pc);if(gx<0||gy<0||gx+w>COLS||gy+h>rows)return false;for(let y=gy;y<gy+h;y++)for(let x=gx;x<gx+w;x++)if(grid[y][x]>=0)return false;return true}
function anyFit(pc){for(let r=0;r<2;r++){const q={k:pc.k,rot:r};for(let y=0;y<rows;y++)for(let x=0;x<COLS;x++)if(fits(q,x,y))return true}return false}
// ── 점수 계산(봉투 전체를 매번 다시 계산 → 화면 숫자 = 계산 결과)
function evaluate(){const cp=run.cp,L={},add=(n,v)=>{if(!v)return;(L[n]=L[n]||{n,c:0,v:0});L[n].c++;L[n].v+=v};
 const broken=new Set();let ins=!!cp.ins;
 for(let i=0;i<placed.length;i++){const a=placed[i];if(!has(a.k,'fragile'))continue;let br=false;
  for(let x=a.x;x<a.x+a.w&&!br;x++)for(let y=a.y;y<a.y+a.h&&!br;y++){if(y===0)continue;const j=grid[y-1][x];if(j>=0&&j!==i&&has(placed[j].k,'heavy'))br=true}
  if(br){if(ins){ins=false;add('깨짐 보험',0)}else broken.add(i)}}
 let sc=0;for(let i=0;i<placed.length;i++){if(broken.has(i)){add('깨짐',-20);sc-=20}else{sc+=IT[placed[i].k].p*(placed[i].m||1)}}
 add('물건 값',0);if(L['물건 값'])L['물건 값'].v=sc+20*broken.size,L['물건 값'].c=placed.length-broken.size;
 // 이웃(서로 닿은 물건 쌍)
 const adj=placed.map(()=>new Set());for(let y=0;y<rows;y++)for(let x=0;x<COLS;x++){const i=grid[y][x];if(i<0)continue;if(x+1<COLS){const j=grid[y][x+1];if(j>=0&&j!==i){adj[i].add(j);adj[j].add(i)}}if(y+1<rows){const j=grid[y+1][x];if(j>=0&&j!==i){adj[i].add(j);adj[j].add(i)}}}
 for(let i=0;i<placed.length;i++)for(const j of adj[i]){if(j<=i)continue;const a=placed[i].k,b=placed[j].k;
  if(has(a,'frozen')&&has(b,'frozen')){const v=cp.frz?40:20;add('냉기 유지',v);sc+=v}
  else if((has(a,'frozen')&&has(b,'cold'))||(has(a,'cold')&&has(b,'frozen'))){add('냉기 나눔',10);sc+=10}
  if(KIND.some(t=>has(a,t)&&has(b,t))){const v=cp.same?20:10;add('같은 종류끼리',v);sc+=v}}
 for(let i=0;i<placed.length;i++){const a=placed[i];if(has(a.k,'heavy')&&a.y+a.h===rows){const v=cp.floor?30:15;add('무거운 건 바닥',v);sc+=v}}
 // 레시피: 재료가 서로 이어 닿아 있으면
 const done=[];for(const r of RECIPES){const cand=r.k.map(k=>placed.map((p,i)=>i).filter(i=>placed[i].k===k&&!broken.has(i)));if(cand.some(c=>!c.length))continue;
  let ok=false;const pick=(d,ch)=>{if(ok)return;if(d===cand.length){const seen=new Set([ch[0]]),st=[ch[0]];while(st.length){const u=st.pop();for(const v of ch)if(!seen.has(v)&&adj[u].has(v)){seen.add(v);st.push(v)}}if(seen.size===ch.length)ok=true;return}for(const i of cand[d])if(ch.indexOf(i)<0)pick(d+1,ch.concat(i))};pick(0,[]);
  if(ok){const v=Math.round(r.p*(cp.rec?1.5:1));add(r.n,v);sc+=v;done.push(r.id)}}
 let fill=0;for(let y=0;y<rows;y++)for(let x=0;x<COLS;x++)if(grid[y][x]>=0)fill++;const fr=fill/(rows*COLS);
 if(fr>=0.9){const v=cp.full?120:60;add('꽉 찼다!',v);sc+=v}else if(fr>=0.75){add('넉넉히 채움',25);sc+=25}
 return {sc,L,broken,done,fr}}
// ── 놓기
function place(si,gx,gy){const pc=tray[si];if(!pc||!fits(pc,gx,gy)){sBad();shake=0.15;return false}
 const before=ev,w=pw(pc),h=ph(pc),idx=placed.length;placed.push({k:pc.k,rot:pc.rot,x:gx,y:gy,w,h,t:0,m:pc.m||0});for(let y=gy;y<gy+h;y++)for(let x=gx;x<gx+w;x++)grid[y][x]=idx;
 tray[si]=queue.shift()||null;sel=-1;run.stats.items++;ev=evaluate();
 const d=ev.sc-before.sc,X=BX()+(gx+w/2)*C,Y=BY+(gy+h/2)*C;
 pops.push({x:X,y:Y-10,t:0,s:(d>=0?'+':'')+d,c:d>=0?'#ffd23f':'#ff4d6d'});rings.push({x:X,y:Y,w:w*C,h:h*C,t:0});burst(X,Y,pc.k,10);sPlace(has(pc.k,'heavy'));
 const nb=[...ev.broken].filter(i=>!before.broken.has(i));if(nb.length){sBreak();shake=0.35;for(const i of nb){const p=placed[i];pops.push({x:BX()+(p.x+p.w/2)*C,y:BY+(p.y+p.h/2)*C+14,t:0,s:'깨짐!',c:'#ff4d6d',big:1});crumbs(BX()+(p.x+p.w/2)*C,BY+(p.y+p.h/2)*C)}}
 const ns=ev.done.filter(id=>before.done.indexOf(id)<0);if(ns.length){sSet();const r=RECIPES.find(r=>r.id===ns[0]);banner={t:0,s:r.n+' 완성!',s2:'+'+Math.round(r.p*(run.cp.rec?1.5:1))+'점'}}
 if(ev.fr>=0.9&&before.fr<0.9){banner={t:0,s:'봉투 꽉!',s2:'+'+(run.cp.full?120:60)+'점'};sSet()}
 if(!tray.some(t=>t)){const b0=run.bag,r0=run;setTimeout(()=>{if(phase==='play'&&run===r0&&run.bag===b0)finishBag()},650)}
 return true}
function rotate(si){const pc=tray[si];if(!pc)return;const w=IT[pc.k].w,h=IT[pc.k].h;if(w===h)return;pc.rot=pc.rot?0:1;sRot()}
function finishBag(){if(phase!=='play')return;phase='tally';sel=-1;drag=null;const lines=Object.values(ev.L).filter(l=>l.v||l.n==='깨짐 보험');
 lines.sort((a,b)=>(a.n==='물건 값'?-1:b.n==='물건 값'?1:b.v-a.v));const pass=ev.sc>=TARGET[run.bag];
 run.stats.sets+=ev.done.length;run.stats.broken+=ev.broken.size;run.stats.best=Math.max(run.stats.best,ev.sc);run.stats.bs.push(ev.sc);
 if(ev.fr>=0.9)run.tix++;
 run.total+=Math.max(0,ev.sc);tal={t:0,lines,sc:ev.sc,pass,shown:0,done:false}}
function afterTally(){if(!tal||!tal.done)return;if(tal.pass&&run.bag<BAGS-1){phase='coupon';const p=run.offs[run.bag].filter(id=>!run.cp[id]).slice(0,3);offer={t:0,ids:p}}
 else{if(tal.pass){run.total+=300;run.clear=1}over()}}
function pickCoupon(i){if(phase!=='coupon'||!offer||!offer.ids[i])return;run.cp[offer.ids[i]]=1;sPass();run.bag++;offer=null;tal=null;newBag()}
function over(){phase='over';tal=null;bgm(false);newBest=false;const sc=run.total;
 if(sc>best){newBest=sc>0;best=sc;try{localStorage.setItem('nr_best_bag_'+KST,sc)}catch(e){}}
 lastRun={bs:run.stats.bs,sc,bags:run.bag+(run.clear?1:0),items:run.stats.items,sets:run.stats.sets,broken:run.stats.broken,gold:run.stats.gold,pair:run.stats.pair,miss:run.stats.miss,spins:run.stats.spins};
 if(!DEBUG){if(window.Bonus)Bonus.played('bag');if(sc>0&&window.submitScore)submitScore(sc)}
 if(run.clear)sPass();else sFail();
 setTimeout(()=>{if(phase==='over'){$('bg-go').textContent='↻ 다시 장보기';$('bg-go').style.display='';$('bg-ov').style.display='flex'}},900);
 $('bg-msg').textContent='이번 판 '+sc+'점 · 봉투 '+lastRun.bags+'개 통과'+(newBest?' · 오늘 최고 기록!':'')}
// ── 효과
const COL={milk:'#e8f4ff',eggs:'#ffe2b8',tofu:'#fffaf0',ramen:'#ff5a3d',melon:'#2fa84f',water:'#7fd0ff',onion:'#7ddc6a',apple:'#ff3d5a',dump:'#9fd8ff',icecr:'#ffb3d9',chips:'#ffd23f',tissue:'#f4f0ff',soap:'#5a7dff',meat:'#ff7a8a',carrot:'#ff8a2a'};
function burst(x,y,k,n){for(let i=0;i<n;i++){const a=Math.random()*6.28,v=60+Math.random()*120;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,t:0,l:0.6+Math.random()*0.4,c:COL[k],f:FXSK||'base',r:Math.random()*6})}}
function crumbs(x,y){for(let i=0;i<14;i++){const a=Math.random()*6.28,v=40+Math.random()*90;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,t:0,l:0.7,c:'#fff3d6',f:'crumb',r:0})}}
// ── 시작·전체화면
function full(on){if(on){cab.classList.add('on');document.body.style.overflow='hidden';
  if(!IOS&&cab.requestFullscreen&&!document.fullscreenElement){cab.requestFullscreen({navigationUI:'hide'}).then(()=>{try{COARSE&&screen.orientation&&screen.orientation.lock&&screen.orientation.lock('portrait').catch(()=>{})}catch(e){}}).catch(()=>{})}
  if(IOS&&!navigator.standalone){const p=$('bg-ios');p.style.display='block';setTimeout(()=>p.style.display='none',4000)}}
 else{cab.classList.remove('on');document.body.style.overflow='';if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
 setTimeout(size,60);size()}
let prevPhase='play',seedOverride=null;
function start(){ac();look();bestLoad();full(true);run=genRun(seedOverride||('bag'+KST));newBag();parts=[];pops=[];rings=[];tal=null;offer=null;
 runT0=T;$('bg-go').style.display='none';$('bg-ov').style.display='none';$('bg-msg').textContent='물건을 끌어서 봉투에 담으세요. 한 번 더 누르면 돌아가요.';bgm(true)}
function pause(){if(phase==='play'||phase==='tally'||phase==='coupon'||phase==='slot'){prevPhase=phase;phase='pause';$('bg-go').textContent='▶ 이어 하기';$('bg-go').style.display=''}}
function resume(){if(phase!=='pause')return;phase=prevPhase;$('bg-go').style.display='none'}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&cab.classList.contains('on')&&!IOS){pause();cab.classList.remove('on');document.body.style.overflow='';setTimeout(size,60)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
// ── 입력
const BTN_ROT={x:20,y:582,w:150,h:44},BTN_FIN={x:190,y:582,w:150,h:44},BTN_SPIN={x:70,y:440,w:220,h:52},BTN_RE={x:30,y:440,w:144,h:52},BTN_TAKE={x:186,y:440,w:144,h:52};
const inR=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
function toW(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left-OX)/S,y:(e.clientY-r.top-OY)/S}}
function slotRect(i){const n=tray.length,sw=(VW-24)/n;return {x:12+i*sw+3,y:TRY,w:sw-6,h:TRH}}
function hitSlot(p){for(let i=0;i<tray.length;i++)if(inR(p,slotRect(i)))return i;return -1}
const LIFT=()=>COARSE?56:0;
function cellFor(pc,x,y){return {gx:Math.round((x-BX())/C-pw(pc)/2),gy:Math.round((y-BY)/C-ph(pc)/2)}}
function inBag(p){return p.x>=BX()-C*0.6&&p.x<=BX()+COLS*C+C*0.6&&p.y>=BY-C*0.8&&p.y<=BY+rows*C+C*0.6}
function cardRect(i){return {x:24,y:230+i*92,w:VW-48,h:80}}
cab.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();ac();const p=toW(e);
 if(phase==='idle'){start();return}
 if(phase==='pause'){resume();return}
 if(phase==='tally'){if(tal&&!tal.done){tal.shown=tal.lines.length;tal.t=99}else afterTally();return}
 if(phase==='slot'){if(!slot)return;if(slot.st<0){spin();return}if(!slotDone())return;if(inR(p,BTN_RE)&&run.tix>0&&slot.out.m<3){spin();return}if(inR(p,BTN_TAKE)||!(run.tix>0&&slot.out.m<3)&&inR(p,BTN_SPIN)){takeSlot();return}return}
 if(phase==='coupon'){if(!offer||offer.t<0.4)return;for(let i=0;i<offer.ids.length;i++)if(inR(p,cardRect(i))){pickCoupon(i);return}return}
 if(phase!=='play')return;
 if(inR(p,BTN_ROT)){if(sel>=0)rotate(sel);else sBad();return}
 if(inR(p,BTN_FIN)){finishBag();return}
 const s=hitSlot(p);if(s>=0&&tray[s]){const was=sel===s;sel=s;drag={s,x0:p.x,y0:p.y,moved:false,was};ghost={x:p.x,y:p.y-LIFT()};if(!was)sPick();try{cv.setPointerCapture(e.pointerId)}catch(_){}return}
 if(sel>=0&&inBag(p)&&tray[sel]){const c=cellFor(tray[sel],p.x,p.y);place(sel,c.gx,c.gy);return}
 sel=-1});
cab.addEventListener('pointermove',e=>{if(!drag)return;const p=toW(e);ghost={x:p.x,y:p.y-LIFT()};if(Math.hypot(p.x-drag.x0,p.y-drag.y0)>8)drag.moved=true});
function up(e){if(!drag)return;const d=drag;drag=null;if(d.moved){if(ghost&&inBag(ghost)&&tray[d.s]){const c=cellFor(tray[d.s],ghost.x,ghost.y);if(!place(d.s,c.gx,c.gy))sel=d.s}}else if(d.was)rotate(d.s);ghost=null}
cab.addEventListener('pointerup',up);cab.addEventListener('pointercancel',()=>{drag=null;ghost=null});
addEventListener('keydown',e=>{if(!cab.classList.contains('on')&&phase==='idle')return;const k=e.key;
 if(phase==='play'){if(k==='r'||k==='R'){if(sel>=0)rotate(sel)}else if(k>='1'&&k<='4'){const i=+k-1;if(tray[i]){sel=i;sPick()}}else if(k==='Enter'){finishBag()}}
 else if(phase==='tally'&&(k==='Enter'||k===' ')){e.preventDefault();if(tal&&!tal.done){tal.shown=tal.lines.length;tal.t=99}else afterTally()}
 else if(phase==='coupon'&&k>='1'&&k<='3')pickCoupon(+k-1);
 else if(phase==='slot'&&slot){if(k===' '||k==='Enter'){e.preventDefault();if(slot.st<0)spin();else takeSlot()}else if((k==='r'||k==='R')&&slotDone()&&slot.out.m<3)spin()}
 else if(phase==='over'&&k==='Enter'&&$('bg-go').style.display!=='none')start();
 else if(phase==='pause'&&(k===' '||k==='Enter'))resume();
 if(k==='Escape'&&phase!=='play')full(false)});
$('bg-go').onclick=()=>{if(phase==='pause')resume();else start()};
$('bg-x').onclick=()=>{pause();full(false)};
const muIc=()=>{$('bg-mu').textContent=MUTE?'🔇':'🔊'};muIc();
$('bg-mu').onclick=()=>{MUTE=!MUTE;muIc();try{localStorage.setItem('nr_bg_mute',MUTE?'1':'0')}catch(e){}};
$('bg-sh').onclick=()=>{const r=lastRun||{sc:0,bags:0};shareText('5락실 봉투 꽉! '+KST.slice(5)+'\n🛍️ 오늘 장보기 '+r.sc+'점, 봉투 '+r.bags+'개 통과! 이겨 볼래?\n'+challengeUrl(r.sc))};
$('bg-rk').onclick=()=>{full(false);const r=$('rankbox');if(r)setTimeout(()=>r.scrollIntoView({behavior:'smooth'}),120)};
addEventListener('resize',()=>setTimeout(size,50));
addEventListener('bonus-look',()=>{if(phase==='idle'||phase==='over')look()});
// ── 그리기 도우미
const X=x=>OX+x*S,Y=y=>OY+y*S;
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
function lg(y0,y1,a,b){const g=cx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g}
function txt(s,x,y,sz,c,f,al){cx.font=sz+'px '+(f||FK);cx.fillStyle=c;cx.textAlign=al||'center';cx.fillText(s,x,y)}
// 빛 스프라이트(미리 그림, lighter 합성)
const GLOW=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,.9)');r.addColorStop(0.35,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return c})();
function glow(x,y,r,col,a){cx.save();cx.globalCompositeOperation='lighter';cx.globalAlpha=a;cx.drawImage(GLOW,x-r,y-r,r*2,r*2);if(col){cx.globalCompositeOperation='source-atop'}cx.restore()}
// ── 물건 그림(자연 방향 기준 x,y,w,h 픽셀)
function drawItem(k,x,y,w,h,br){const p=Math.max(2,w*0.05);x+=p;y+=p;w-=p*2;h-=p*2;cx.save();cx.lineJoin='round';
 const ol=()=>{cx.strokeStyle='#0008';cx.lineWidth=Math.max(1,w*0.03);cx.stroke()};
 const hi=(hx,hy,hw,hh)=>{cx.fillStyle='rgba(255,255,255,.35)';rr(hx,hy,hw,hh,hw/2);cx.fill()};
 const label=(s,ly,c,bg)=>{const fs=Math.max(8,Math.min(w,h)*0.2);cx.font=fs+'px '+FK;const tw=cx.measureText(s).width+fs*0.6;if(bg){cx.fillStyle=bg;rr(x+w/2-tw/2,ly-fs*0.75,tw,fs*1.1,fs*0.3);cx.fill()}cx.fillStyle=c;cx.textAlign='center';cx.fillText(s,x+w/2,ly+fs*0.25)};
 if(k==='milk'){cx.fillStyle=lg(y,y+h,'#ffffff','#cfe6ff');cx.beginPath();cx.moveTo(x,y+h*0.18);cx.lineTo(x+w/2,y);cx.lineTo(x+w,y+h*0.18);cx.lineTo(x+w,y+h);cx.lineTo(x,y+h);cx.closePath();cx.fill();ol();
  cx.fillStyle='#2f6bff';cx.fillRect(x,y+h*0.42,w,h*0.2);label('우유',y+h*0.52,'#fff');cx.fillStyle='#2f6bff';cx.beginPath();cx.arc(x+w*0.3,y+h*0.78,w*0.1,0,7);cx.arc(x+w*0.7,y+h*0.85,w*0.08,0,7);cx.fill();hi(x+w*0.1,y+h*0.22,w*0.12,h*0.18)}
 else if(k==='eggs'){cx.fillStyle=lg(y,y+h,'#d9b48a','#a8794a');rr(x,y+h*0.2,w,h*0.8,h*0.15);cx.fill();ol();for(let i=0;i<4;i++){const ex=x+w*(0.14+i*0.24),ey=y+h*0.48;cx.fillStyle=lg(ey-h*0.3,ey+h*0.3,'#fffaf0','#ffd9a8');cx.beginPath();cx.ellipse(ex,ey,w*0.1,h*0.32,0,0,7);cx.fill();cx.fillStyle='#fff9';cx.beginPath();cx.ellipse(ex-w*0.03,ey-h*0.1,w*0.03,h*0.09,0,0,7);cx.fill()}}
 else if(k==='tofu'){cx.fillStyle='#d6ecff88';rr(x,y,w,h,w*0.12);cx.fill();ol();cx.fillStyle=lg(y,y+h,'#ffffff','#f1ead6');rr(x+w*0.12,y+h*0.18,w*0.76,h*0.66,w*0.08);cx.fill();cx.fillStyle='#1e5bd8';rr(x+w*0.2,y+h*0.38,w*0.6,h*0.26,4);cx.fill();label('두부',y+h*0.51,'#fff')}
 else if(k==='ramen'){cx.fillStyle=lg(y,y+h,'#ff6b4a','#c81e1e');rr(x,y,w,h,h*0.18);cx.fill();ol();cx.fillStyle='#ffd23f';cx.beginPath();cx.arc(x+w*0.26,y+h/2,h*0.3,0,7);cx.fill();cx.strokeStyle='#e0a800';cx.lineWidth=1.5;cx.beginPath();for(let i=0;i<3;i++){cx.moveTo(x+w*0.15,y+h*(0.38+i*0.12));cx.quadraticCurveTo(x+w*0.26,y+h*(0.3+i*0.12),x+w*0.37,y+h*(0.38+i*0.12))}cx.stroke();
  cx.font=Math.max(9,h*0.34)+'px '+FK;cx.fillStyle='#fff';cx.textAlign='center';cx.fillText('라면',x+w*0.68,y+h*0.62);hi(x+w*0.05,y+h*0.1,w*0.5,h*0.12)}
 else if(k==='melon'){const r=Math.min(w,h)/2;cx.fillStyle=lg(y,y+h,'#45c86a','#1f7a3a');cx.beginPath();cx.arc(x+w/2,y+h/2,r,0,7);cx.fill();ol();cx.save();cx.beginPath();cx.arc(x+w/2,y+h/2,r,0,7);cx.clip();cx.strokeStyle='#0f4d22';cx.lineWidth=r*0.12;
  for(let i=-2;i<=2;i++){cx.beginPath();for(let s=0;s<=10;s++){const yy=y+h/2-r+s*r*0.2,xx=x+w/2+i*r*0.42+(s%2?r*0.07:-r*0.07);s?cx.lineTo(xx,yy):cx.moveTo(xx,yy)}cx.stroke()}cx.restore();hi(x+w/2-r*0.6,y+h/2-r*0.7,r*0.4,r*0.3);cx.strokeStyle='#5a3a1a';cx.lineWidth=2;cx.beginPath();cx.moveTo(x+w/2,y+h/2-r);cx.lineTo(x+w/2+3,y+h/2-r-5);cx.stroke()}
 else if(k==='water'){cx.fillStyle=lg(y,y+h,'#c9f0ffcc','#5ab8f0cc');rr(x+w*0.12,y+h*0.12,w*0.76,h*0.88,w*0.2);cx.fill();ol();cx.fillStyle='#1e5bd8';rr(x+w*0.3,y,w*0.4,h*0.12,3);cx.fill();cx.fillStyle='#fff';rr(x+w*0.12,y+h*0.45,w*0.76,h*0.2,2);cx.fill();label('생수',y+h*0.55,'#1e5bd8');hi(x+w*0.2,y+h*0.18,w*0.12,h*0.22)}
 else if(k==='onion'){cx.fillStyle='#3fae3a';cx.beginPath();cx.moveTo(x+w*0.35,y+h*0.62);cx.lineTo(x+w*0.1,y);cx.lineTo(x+w*0.45,y+h*0.05);cx.lineTo(x+w*0.55,y+h*0.62);cx.fill();cx.fillStyle='#5fd04a';cx.beginPath();cx.moveTo(x+w*0.45,y+h*0.62);cx.lineTo(x+w*0.9,y+h*0.02);cx.lineTo(x+w*0.65,y+h*0.62);cx.fill();
  cx.fillStyle=lg(y+h*0.55,y+h,'#e8ffd8','#ffffff');rr(x+w*0.3,y+h*0.55,w*0.4,h*0.4,w*0.15);cx.fill();ol();cx.strokeStyle='#d8c8a8';cx.lineWidth=1.2;cx.beginPath();for(let i=0;i<4;i++){cx.moveTo(x+w*0.5,y+h*0.95);cx.lineTo(x+w*(0.3+i*0.13),y+h)}cx.stroke()}
 else if(k==='apple'){const r=Math.min(w,h)*0.42;cx.fillStyle=lg(y,y+h,'#ff6a7a','#c4102a');cx.beginPath();cx.arc(x+w/2-r*0.3,y+h*0.56,r*0.8,0,7);cx.arc(x+w/2+r*0.3,y+h*0.56,r*0.8,0,7);cx.fill();cx.strokeStyle='#5a3a1a';cx.lineWidth=2;cx.beginPath();cx.moveTo(x+w/2,y+h*0.3);cx.lineTo(x+w/2+2,y+h*0.12);cx.stroke();
  cx.fillStyle='#3fae3a';cx.beginPath();cx.ellipse(x+w/2+r*0.4,y+h*0.18,r*0.3,r*0.14,-0.5,0,7);cx.fill();hi(x+w/2-r*0.6,y+h*0.4,r*0.3,r*0.4)}
 else if(k==='dump'){cx.fillStyle=lg(y,y+h,'#bfe6ff','#3c8ad8');rr(x,y,w,h,h*0.12);cx.fill();ol();cx.fillStyle='#fff8e8';cx.beginPath();cx.arc(x+w*0.25,y+h*0.62,h*0.3,Math.PI,0);cx.closePath();cx.fill();cx.strokeStyle='#d8c8a8';cx.lineWidth=1;cx.beginPath();for(let i=0;i<4;i++){cx.moveTo(x+w*(0.14+i*0.07),y+h*0.4);cx.lineTo(x+w*(0.15+i*0.07),y+h*0.5)}cx.stroke();
  cx.font=Math.max(9,h*0.3)+'px '+FK;cx.fillStyle='#fff';cx.textAlign='center';cx.fillText('만두',x+w*0.68,y+h*0.6);cx.fillStyle='#ffffffaa';for(let i=0;i<5;i++)cx.fillRect(x+w*(0.5+i*0.09),y+h*0.12,2,2)}
 else if(k==='icecr'){cx.fillStyle='#d9a066';rr(x+w*0.44,y+h*0.62,w*0.12,h*0.36,3);cx.fill();cx.fillStyle=lg(y,y+h*0.7,'#ffd1ea','#ff6fb5');cx.beginPath();cx.moveTo(x+w*0.2,y+h*0.7);cx.lineTo(x+w*0.2,y+h*0.25);cx.arc(x+w*0.5,y+h*0.25,w*0.3,Math.PI,0);cx.lineTo(x+w*0.8,y+h*0.7);cx.closePath();cx.fill();ol();
  cx.fillStyle='#7a3a1a';cx.beginPath();cx.moveTo(x+w*0.2,y+h*0.3);cx.arc(x+w*0.5,y+h*0.25,w*0.3,Math.PI,0);cx.lineTo(x+w*0.8,y+h*0.35);cx.quadraticCurveTo(x+w*0.5,y+h*0.45,x+w*0.2,y+h*0.35);cx.fill();hi(x+w*0.26,y+h*0.4,w*0.1,h*0.2)}
 else if(k==='chips'){cx.fillStyle=lg(y,y+h,'#ffe066','#ff9d00');cx.beginPath();cx.moveTo(x,y+h*0.06);for(let i=0;i<=6;i++)cx.lineTo(x+w*i/6,y+(i%2?0:h*0.06));cx.quadraticCurveTo(x+w*1.04,y+h/2,x+w,y+h*0.94);for(let i=6;i>=0;i--)cx.lineTo(x+w*i/6,y+h-(i%2?0:h*0.06));cx.quadraticCurveTo(x-w*0.04,y+h/2,x,y+h*0.06);cx.fill();ol();
  cx.fillStyle='#e8202a';cx.beginPath();cx.arc(x+w/2,y+h*0.42,w*0.3,0,7);cx.fill();cx.font=Math.max(8,w*0.26)+'px '+FK;cx.fillStyle='#fff';cx.textAlign='center';cx.fillText('과자',x+w/2,y+h*0.46);cx.fillStyle='#f7c948';cx.beginPath();cx.ellipse(x+w/2,y+h*0.74,w*0.22,h*0.06,0.3,0,7);cx.fill();hi(x+w*0.12,y+h*0.1,w*0.14,h*0.3)}
 else if(k==='tissue'){cx.fillStyle='#e9e4ff99';rr(x,y,w,h,w*0.08);cx.fill();ol();for(let i=0;i<2;i++)for(let j=0;j<2;j++){const ex=x+w*(0.27+i*0.46),ey=y+h*(0.27+j*0.46),r=Math.min(w,h)*0.21;cx.fillStyle=lg(ey-r,ey+r,'#ffffff','#e2dcf5');cx.beginPath();cx.arc(ex,ey,r,0,7);cx.fill();cx.fillStyle='#c9bfe8';cx.beginPath();cx.arc(ex,ey,r*0.3,0,7);cx.fill()}
  cx.fillStyle='#b06bff';rr(x+w*0.3,y+h*0.44,w*0.4,h*0.12,3);cx.fill();hi(x+w*0.06,y+h*0.06,w*0.5,h*0.06)}
 else if(k==='soap'){cx.fillStyle=lg(y,y+h,'#8aa8ff','#2a44c8');rr(x+w*0.08,y+h*0.16,w*0.84,h*0.84,w*0.18);cx.fill();ol();cx.strokeStyle='#2a44c8';cx.lineWidth=w*0.1;cx.beginPath();cx.arc(x+w*0.62,y+h*0.2,w*0.18,Math.PI,0);cx.stroke();cx.fillStyle='#ff4d8a';rr(x+w*0.2,y+h*0.05,w*0.25,h*0.13,3);cx.fill();
  cx.fillStyle='#fff';rr(x+w*0.16,y+h*0.48,w*0.68,h*0.24,4);cx.fill();label('세제',y+h*0.6,'#2a44c8');for(let i=0;i<3;i++){cx.strokeStyle='#ffffffaa';cx.lineWidth=1;cx.beginPath();cx.arc(x+w*(0.3+i*0.2),y+h*(0.85-i*0.03),w*0.06,0,7);cx.stroke()}}
 else if(k==='meat'){cx.fillStyle='#f4f4f4';rr(x,y+h*0.1,w,h*0.9,h*0.16);cx.fill();ol();cx.fillStyle=lg(y,y+h,'#ff7a8a','#c42a42');rr(x+w*0.06,y+h*0.2,w*0.88,h*0.66,h*0.2);cx.fill();cx.strokeStyle='#ffe0e6';cx.lineWidth=1.6;cx.beginPath();cx.moveTo(x+w*0.15,y+h*0.4);cx.quadraticCurveTo(x+w*0.4,y+h*0.6,x+w*0.6,y+h*0.35);cx.moveTo(x+w*0.5,y+h*0.72);cx.quadraticCurveTo(x+w*0.7,y+h*0.5,x+w*0.88,y+h*0.62);cx.stroke();
  cx.fillStyle='#ffd23f';rr(x+w*0.66,y+h*0.12,w*0.26,h*0.3,3);cx.fill();cx.fillStyle='#ffffff55';cx.fillRect(x+w*0.08,y+h*0.22,w*0.84,h*0.08)}
 else if(k==='carrot'){cx.fillStyle=lg(y,y+h,'#ffb04a','#e85a0a');cx.beginPath();cx.moveTo(x+w*0.22,y+h*0.3);cx.quadraticCurveTo(x+w*0.5,y+h*0.22,x+w*0.78,y+h*0.3);cx.lineTo(x+w*0.52,y+h*0.98);cx.closePath();cx.fill();ol();cx.fillStyle='#3fae3a';cx.beginPath();cx.ellipse(x+w*0.42,y+h*0.16,w*0.09,h*0.16,-0.4,0,7);cx.ellipse(x+w*0.58,y+h*0.16,w*0.09,h*0.16,0.4,0,7);cx.fill();
  cx.strokeStyle='#b8480a';cx.lineWidth=1;cx.beginPath();for(let i=0;i<3;i++){cx.moveTo(x+w*(0.35+i*0.05),y+h*(0.45+i*0.15));cx.lineTo(x+w*(0.5+i*0.03),y+h*(0.47+i*0.15))}cx.stroke()}
 if(br){cx.strokeStyle='#2a0a10';cx.lineWidth=Math.max(1.5,w*0.05);cx.beginPath();cx.moveTo(x+w*0.15,y+h*0.2);cx.lineTo(x+w*0.4,y+h*0.45);cx.lineTo(x+w*0.3,y+h*0.6);cx.lineTo(x+w*0.6,y+h*0.85);cx.moveTo(x+w*0.4,y+h*0.45);cx.lineTo(x+w*0.75,y+h*0.35);cx.stroke();cx.fillStyle='rgba(255,40,70,.18)';cx.fillRect(x,y,w,h)}
 cx.restore()}
// 회전 반영해 그리기(px = 화면 좌표)
function drawPiece(k,rot,x,y,cw,ch,br){const it=IT[k];if(!rot){drawItem(k,x,y,it.w*cw,it.h*ch,br);return}cx.save();cx.translate(x+it.h*cw/2,y+it.w*ch/2);cx.rotate(Math.PI/2);drawItem(k,-it.w*cw/2,-it.h*ch/2,it.w*cw,it.h*ch,br);cx.restore()}
// 덤(×2)·황금(×3) 표시
function mark(m,x,y,w,h){if(!m)return;const g=m===3;cx.save();cx.strokeStyle=g?'#ffd23f':'#7dffb0';cx.lineWidth=2.5*S;cx.globalAlpha=0.75+0.25*Math.sin(T*5);rr(x+1,y+1,w-2,h-2,7*S);cx.stroke();cx.globalAlpha=1;
 if(g){cx.globalCompositeOperation='source-atop'}cx.restore();if(g)glow(x+w/2,y+h/2,Math.max(w,h)*0.6,null,0.18+0.08*Math.sin(T*4));
 const fs=Math.round(9*S),s=(g?'황금 ':'덤 ')+'×'+m;cx.font=fs+'px '+FK;const tw=cx.measureText(s).width+fs*0.7;cx.fillStyle=g?'#ffd23f':'#3ddc84';rr(x+w-tw-2*S,y+2*S,tw,fs+4*S,4*S);cx.fill();cx.fillStyle='#1a0f00';cx.textAlign='left';cx.fillText(s,x+w-tw-2*S+fs*0.35,y+2*S+fs*0.95)}
// 성질 배지
const TAGC={frozen:['냉동','#22d3ee'],cold:['냉장','#7fb2ff'],fragile:['깨짐','#ff4d8a'],heavy:['무거움','#ffd23f']};
function badges(k,x,y,s){let i=0;for(const t of ['frozen','cold','fragile','heavy']){if(!has(k,t))continue;const [n,c]=TAGC[t],fs=9*s;cx.font=fs+'px '+FK;const tw=cx.measureText(n).width+fs*0.8;cx.fillStyle='#0b0620dd';rr(x,y+i*(fs+5),tw,fs+3,4*s);cx.fill();cx.strokeStyle=c;cx.lineWidth=1;cx.stroke();cx.fillStyle=c;cx.textAlign='left';cx.fillText(n,x+fs*0.4,y+i*(fs+5)+fs*0.95);i++}}
// ── 배경: 밤의 동네 마트(그라데이션 + 진열대 2겹 + 빛 망울)
const SHELF=[];{let s=1;const r=()=>(s=(s*16807)%2147483647)/2147483647;for(let L=0;L<2;L++){const row=[];for(let i=0;i<40;i++)row.push({w:10+r()*18,h:12+r()*22,c:['#ff5a7a','#22d3ee','#ffd23f','#7ddc6a','#b06bff','#ff9d3d'][Math.floor(r()*6)]});SHELF.push(row)}}
const BOKEH=[];for(let i=0;i<26;i++)BOKEH.push({x:Math.random(),y:Math.random(),r:6+Math.random()*22,v:0.01+Math.random()*0.02,c:['#ff3d7f','#22d3ee','#ffd23f','#b06bff'][i%4],p:Math.random()*6.28});
function drawBg(){cx.fillStyle=lg(0,H,'#1a0b3d','#0a1830');cx.fillRect(0,0,W,H);
 for(let L=0;L<2;L++){const sc=(L?1:0.7)*S,sh=SHELF[L],base=H*(L?0.62:0.38),dx=-(T*(L?8:4)*S)%(600*sc);cx.globalAlpha=L?0.32:0.2;
  for(let row=0;row<3;row++){const yy=base-row*48*sc;cx.fillStyle='#2a1a5a';cx.fillRect(0,yy,W,4*sc);let x=dx-600*sc;for(let rep=0;x<W;rep++){for(const b of sh){if(x>W)break;cx.fillStyle=b.c;cx.fillRect(x,yy-b.h*sc,b.w*sc,b.h*sc);x+=b.w*sc+3*sc}}}}
 cx.globalAlpha=1;cx.save();cx.globalCompositeOperation='lighter';for(const b of BOKEH){const yy=((b.y-T*b.v)%1+1)%1*H,xx=b.x*W+Math.sin(T*0.5+b.p)*14;cx.globalAlpha=0.16+0.08*Math.sin(T+b.p);cx.drawImage(GLOW,xx-b.r*S,yy-b.r*S,b.r*2*S,b.r*2*S)}cx.restore();cx.globalAlpha=1;
}
// ── 봉투(스킨별)
function drawBag(front){const bx=X(BX()),by=Y(BY),bw=COLS*C*S,bh=rows*C*S,pad=10*S;
 const sk=BAGSK;
 if(!front){// 손잡이
  cx.lineWidth=7*S;cx.strokeStyle=sk==='eco'?'#c9a46a':sk==='ice'?'#9aa8b8':sk==='gold'?'#e0a800':'#ffffffaa';
  cx.beginPath();cx.ellipse(bx+bw*0.28,by-2*S,bw*0.13,30*S,0,Math.PI,0);cx.stroke();cx.beginPath();cx.ellipse(bx+bw*0.72,by-2*S,bw*0.13,30*S,0,Math.PI,0);cx.stroke();
  let g;if(sk==='eco')g=lg(by,by+bh,'#f2e3c4','#d8c09a');else if(sk==='ice')g=lg(by,by+bh,'#e8eef6','#9aa8bc');else if(sk==='gold')g=lg(by,by+bh,'#ffe58a','#c88a10');else g=lg(by,by+bh,'#ffffffee','#dfe8ffcc');
  cx.fillStyle=g;rr(bx-pad,by-pad*0.4,bw+pad*2,bh+pad*1.4,14*S);cx.fill();
  if(sk==='eco'){cx.setLineDash([5*S,4*S]);cx.strokeStyle='#8a6a3a';cx.lineWidth=1.5*S;rr(bx-pad+5*S,by,bw+pad*2-10*S,bh+pad*0.8,10*S);cx.stroke();cx.setLineDash([])}
  else if(sk==='ice'){cx.strokeStyle='#ffffff66';cx.lineWidth=1*S;cx.beginPath();for(let i=-8;i<16;i++){cx.moveTo(bx-pad+i*24*S,by);cx.lineTo(bx-pad+i*24*S+bh,by+bh);cx.moveTo(bx-pad+i*24*S+bh,by);cx.lineTo(bx-pad+i*24*S,by+bh)}cx.save();rr(bx-pad,by-pad*0.4,bw+pad*2,bh+pad*1.4,14*S);cx.clip();cx.stroke();cx.restore();cx.fillStyle='#22a3ee';cx.fillRect(bx-pad,by+bh+pad*0.6,bw+pad*2,4*S)}
  else if(sk==='gold'){cx.save();rr(bx-pad,by-pad*0.4,bw+pad*2,bh+pad*1.4,14*S);cx.clip();cx.strokeStyle='#a8700a88';cx.lineWidth=2*S;for(let yy=by;yy<by+bh+pad;yy+=12*S){cx.beginPath();cx.moveTo(bx-pad,yy);cx.lineTo(bx+bw+pad,yy);cx.stroke()}for(let i=0;i<5;i++){const tw=Math.sin(T*3+i*1.7);if(tw>0.4){const sx=bx+((i*97)%100)/100*bw,sy=by+((i*53)%100)/100*bh;cx.fillStyle='#fff';cx.beginPath();cx.moveTo(sx,sy-6*S);cx.lineTo(sx+2*S,sy);cx.lineTo(sx,sy+6*S);cx.lineTo(sx-2*S,sy);cx.fill()}}cx.restore()}
  else{cx.strokeStyle='#c8d4ff88';cx.lineWidth=1.2*S;cx.beginPath();cx.moveTo(bx-pad+8*S,by+bh*0.3);cx.quadraticCurveTo(bx-pad+16*S,by+bh*0.5,bx-pad+6*S,by+bh*0.8);cx.moveTo(bx+bw+pad-8*S,by+bh*0.2);cx.quadraticCurveTo(bx+bw+pad-18*S,by+bh*0.45,bx+bw+pad-6*S,by+bh*0.7);cx.stroke()}
  // 안쪽 격자
  cx.fillStyle='#0b0620cc';rr(bx-2*S,by-2*S,bw+4*S,bh+4*S,8*S);cx.fill();cx.strokeStyle='#ffffff14';cx.lineWidth=1;cx.beginPath();for(let i=1;i<COLS;i++){cx.moveTo(bx+i*C*S,by);cx.lineTo(bx+i*C*S,by+bh)}for(let j=1;j<rows;j++){cx.moveTo(bx,by+j*C*S);cx.lineTo(bx+bw,by+j*C*S)}cx.stroke();
  cx.fillStyle='#ffd23f22';cx.fillRect(bx,by+bh-3*S,bw,3*S)}
 else{cx.strokeStyle=sk==='gold'?'#fff2a8':sk==='ice'?'#ffffff':'#22d3ee';cx.lineWidth=2*S;cx.globalAlpha=0.6+0.2*Math.sin(T*2);rr(bx-pad,by-pad*0.4,bw+pad*2,bh+pad*1.4,14*S);cx.stroke();cx.globalAlpha=1}}
function drawBagItems(){const bx=X(BX()),by=Y(BY),c=C*S;for(let i=0;i<placed.length;i++){const p=placed[i],k=Math.min(1,p.t/0.18),sc=k<1?0.7+0.3*k+Math.sin(k*3.14)*0.15:1;
  const x0=bx+p.x*c,y0=by+p.y*c,w=p.w*c,h=p.h*c;cx.save();cx.translate(x0+w/2,y0+h/2);cx.scale(sc,sc);cx.translate(-x0-w/2,-y0-h/2);drawPiece(p.k,p.rot,x0,y0,c,c,ev&&ev.broken.has(i));cx.restore();if(p.m&&!(ev&&ev.broken.has(i)))mark(p.m,x0,y0,w,h)}}
function drawGhost(){if(phase!=='play')return;let pc=null,gx,gy,ok=false;
 if(drag&&drag.moved&&ghost&&tray[drag.s]){pc=tray[drag.s];const c=cellFor(pc,ghost.x,ghost.y);gx=c.gx;gy=c.gy;ok=inBag(ghost)&&fits(pc,gx,gy);
  if(inBag(ghost)){const bx=X(BX()),by=Y(BY),c2=C*S;cx.fillStyle=ok?'#3ddc8444':'#ff4d6d44';cx.strokeStyle=ok?'#3ddc84':'#ff4d6d';cx.lineWidth=2*S;
   for(let y=Math.max(0,gy);y<Math.min(rows,gy+ph(pc));y++)for(let x=Math.max(0,gx);x<Math.min(COLS,gx+pw(pc));x++){cx.fillRect(bx+x*c2+1,by+y*c2+1,c2-2,c2-2)}
   rr(bx+gx*c2,by+gy*c2,pw(pc)*c2,ph(pc)*c2,6*S);cx.stroke()}
  cx.globalAlpha=0.9;const w=pw(pc)*C*S,h=ph(pc)*C*S;drawPiece(pc.k,pc.rot,X(ghost.x)-w/2,Y(ghost.y)-h/2,C*S,C*S,false);cx.globalAlpha=1}}
function drawTray(){const n=tray.length;
 cx.fillStyle=lg(Y(TRY-14),Y(TRY+TRH+8),'#2a1d5c','#160d38');rr(X(6),Y(TRY-14),VW*S-12*S,(TRH+24)*S,14*S);cx.fill();cx.strokeStyle='#ffd23f55';cx.lineWidth=2*S;cx.stroke();
 txt('계산대 · 남은 물건 '+queue.length+'개',X(VW/2),Y(TRY-1),Math.round(11*S),'#ffd23fcc',FK);
 for(let i=0;i<n;i++){const r=slotRect(i),pc=tray[i];const on=sel===i;
  cx.fillStyle=on?'#ffd23f22':'#0b062099';rr(X(r.x),Y(r.y+6),r.w*S,(r.h-8)*S,10*S);cx.fill();cx.strokeStyle=on?'#ffd23f':'#ffffff22';cx.lineWidth=(on?2.5:1)*S;cx.stroke();
  txt(String(i+1),X(r.x+8),Y(r.y+20),Math.round(8*S),'#ffffff55',FN,'left');
  if(!pc||(drag&&drag.moved&&drag.s===i))continue;const w=pw(pc),h=ph(pc),cs=Math.min((r.w-16)/w,(r.h-28)/h,40),pw_=w*cs,ph_=h*cs;
  const ix=r.x+(r.w-pw_)/2,iy=r.y+10+(r.h-14-ph_)/2;if(on){glow(X(ix+pw_/2),Y(iy+ph_/2),Math.max(pw_,ph_)*S*0.9,null,0.25)}drawPiece(pc.k,pc.rot,X(ix),Y(iy),cs*S,cs*S,false);if(pc.m)mark(pc.m,X(r.x+2),Y(r.y+8),(r.w-4)*S,(r.h-12)*S);
  txt(IT[pc.k].n+' '+IT[pc.k].p*(pc.m||1),X(r.x+r.w/2),Y(r.y+r.h-1),Math.round(10*S),'#fff',FK);badges(pc.k,X(r.x+r.w-2)-34*S,Y(r.y+10),S*0.85)}
 // 버튼
 const btn=(b,s,c,on)=>{cx.fillStyle=on?c:'#2a1d5c';rr(X(b.x),Y(b.y),b.w*S,b.h*S,12*S);cx.fill();cx.strokeStyle=c;cx.lineWidth=2*S;cx.stroke();txt(s,X(b.x+b.w/2),Y(b.y+b.h/2+6),Math.round(16*S),on?'#1a0f00':c,FK)};
 btn(BTN_ROT,'↻ 돌리기','#22d3ee',sel>=0);btn(BTN_FIN,'계산하기 ▶','#ffd23f',true)}
function drawHud(){const tg=TARGET[run.bag],sc=ev?ev.sc:0,pct=Math.max(0,Math.min(1,sc/tg));
 txt('BAG '+(run.bag+1)+'/'+BAGS,X(14),Y(26),Math.round(10*S),'#22d3ee',FN,'left');txt('TOTAL '+run.total,X(VW-14),Y(26),Math.round(9*S),'#b9a8ff',FN,'right');txt('🎟️ '+run.tix,X(VW-14),Y(44),Math.round(11*S),'#ffd23f',FK,'right');
 txt(String(sc),X(VW/2),Y(58),Math.round(24*S),pct>=1?'#3ddc84':'#ffd23f',FN);
 cx.fillStyle='#ffffff18';rr(X(60),Y(68),(VW-120)*S,9*S,5*S);cx.fill();cx.fillStyle=pct>=1?'#3ddc84':'#ffd23f';rr(X(60),Y(68),(VW-120)*pct*S,9*S,5*S);cx.fill();
 txt('목표 '+tg+(pct>=1?' 통과!':''),X(VW/2),Y(92),Math.round(12*S),pct>=1?'#3ddc84':'#ffffffaa',FK);
 const cps=Object.keys(run.cp);if(cps.length){cx.font=Math.round(9*S)+'px '+FK;let x=X(10);for(const id of cps){const n=CPS.find(c=>c.id===id).n,tw=cx.measureText(n).width+8*S;cx.fillStyle='#b06bff33';rr(x,Y(100),tw,14*S,5*S);cx.fill();cx.fillStyle='#d9c2ff';cx.textAlign='left';cx.fillText(n,x+4*S,Y(110.5));x+=tw+4*S}}
 if(T<runT0+4&&run.bag===0&&placed.length===0){cx.globalAlpha=Math.min(1,(runT0+4-T));txt(COARSE?'물건을 끌어서 봉투에 놓기 · 한 번 더 누르면 회전':'끌어서 놓기 · R 회전 · Enter 계산',X(VW/2),Y(BY+rows*C/2),Math.round(13*S),'#fff',FK);cx.globalAlpha=1}}
let runT0=0;
function drawFx(){for(const r of rings){const a=1-r.t/0.45;if(a<=0)continue;cx.strokeStyle=`rgba(255,210,63,${a})`;cx.lineWidth=2.5*S;const e=r.t*30;rr(X(r.x-r.w/2-e),Y(r.y-r.h/2-e),(r.w+2*e)*S,(r.h+2*e)*S,8*S);cx.stroke()}
 for(const p of parts){const a=1-p.t/p.l;if(a<=0)continue;cx.globalAlpha=a;const x=X(p.x),y=Y(p.y),s=S;
  if(p.f==='coin'){cx.fillStyle='#ffd23f';cx.beginPath();cx.ellipse(x,y,5*s*Math.abs(Math.cos(p.t*10+p.r)),5*s,0,0,7);cx.fill();cx.strokeStyle='#b8860b';cx.lineWidth=1;cx.stroke()}
  else if(p.f==='heart'){cx.fillStyle='#ff5fa8';cx.beginPath();const z=4*s;cx.moveTo(x,y+z);cx.bezierCurveTo(x-z*2,y-z*0.5,x-z,y-z*2,x,y-z*0.8);cx.bezierCurveTo(x+z,y-z*2,x+z*2,y-z*0.5,x,y+z);cx.fill()}
  else if(p.f==='crumb'){cx.fillStyle=p.c;cx.fillRect(x-2*s,y-2*s,4*s,3*s)}
  else{cx.fillStyle=p.c;cx.save();cx.translate(x,y);cx.rotate(p.r+p.t*6);cx.fillRect(-3*s,-1.5*s,6*s,3*s);cx.restore()}}cx.globalAlpha=1;
 for(const p of pops){const a=1-p.t/1;if(a<=0)continue;cx.globalAlpha=a;txt(p.s,X(p.x),Y(p.y-p.t*40),Math.round((p.big?20:16)*S),p.c,FK);cx.globalAlpha=1}
 if(banner&&banner.t<1.2){const a=banner.t<0.15?banner.t/0.15:banner.t>0.9?(1.2-banner.t)/0.3:1;cx.globalAlpha=a;const sc=1+Math.max(0,0.25-banner.t)*2;cx.save();cx.translate(X(VW/2),Y(BY+rows*C*0.42));cx.scale(sc,sc);
  cx.fillStyle='#0b0620cc';rr(-130*S,-34*S,260*S,62*S,14*S);cx.fill();cx.strokeStyle='#ffd23f';cx.lineWidth=2*S;cx.stroke();txt(banner.s,0,-4*S,Math.round(24*S),'#fff',FK);txt(banner.s2,0,18*S,Math.round(13*S),'#ffd23f',FK);cx.restore();cx.globalAlpha=1}}
function panel(y,h){cx.fillStyle='#0b0620f2';rr(X(16),Y(y),(VW-32)*S,h*S,16*S);cx.fill();cx.strokeStyle='#b06bff';cx.lineWidth=2*S;cx.stroke()}
function drawTally(){if(!tal)return;cx.fillStyle='#05021488';cx.fillRect(0,0,W,H);panel(120,400);
 txt('영수증 · '+(run.bag+1)+'번째 봉투',X(VW/2),Y(156),Math.round(18*S),'#fff',FK);cx.strokeStyle='#ffffff33';cx.setLineDash([4*S,4*S]);cx.beginPath();cx.moveTo(X(36),Y(170));cx.lineTo(X(VW-36),Y(170));cx.stroke();cx.setLineDash([]);
 const n=Math.min(tal.lines.length,tal.shown);for(let i=0;i<n;i++){const l=tal.lines[i],yy=192+i*26;txt(l.n+(l.c>1&&l.n!=='물건 값'?' ×'+l.c:l.n==='물건 값'?' '+l.c+'개':''),X(40),Y(yy),Math.round(13*S),l.v<0?'#ff6d8a':'#e8e0ff',FK,'left');txt(l.n==='깨짐 보험'?'무효':(l.v>=0?'+':'')+l.v,X(VW-40),Y(yy),Math.round(10*S),l.v<0?'#ff6d8a':'#ffd23f',FN,'right')}
 if(tal.done){const yy=200+Math.min(9,tal.lines.length)*26;txt(tal.sc+' / '+TARGET[run.bag],X(VW/2),Y(yy+24),Math.round(18*S),tal.pass?'#3ddc84':'#ff6d8a',FN);
  txt(tal.pass?(run.bag<BAGS-1?'예산 통과! 쿠폰을 골라요':'5봉투 모두 통과! 장보기 완료 +300'):'목표 점수에 못 미쳤어요',X(VW/2),Y(yy+54),Math.round(15*S),'#fff',FK);
  txt('화면을 누르면 계속',X(VW/2),Y(500),Math.round(11*S),'#ffffff88',FK)}}
function drawCoupon(){if(!offer)return;cx.fillStyle='#050214aa';cx.fillRect(0,0,W,H);txt('쿠폰 하나 고르기',X(VW/2),Y(190),Math.round(24*S),'#fff',FK);txt('이번 판 끝까지 효과가 남아요',X(VW/2),Y(214),Math.round(12*S),'#ffffffaa',FK);
 for(let i=0;i<offer.ids.length;i++){const c=CPS.find(x=>x.id===offer.ids[i]),r=cardRect(i),k=Math.min(1,Math.max(0,(offer.t-i*0.08)/0.25)),dx=(1-k)*60;cx.globalAlpha=k;
  cx.fillStyle=lg(Y(r.y),Y(r.y+r.h),'#3a1f7a','#1e0f48');rr(X(r.x+dx),Y(r.y),r.w*S,r.h*S,14*S);cx.fill();cx.setLineDash([6*S,4*S]);cx.strokeStyle='#ffd23f';cx.lineWidth=2*S;cx.stroke();cx.setLineDash([]);
  cx.fillStyle='#ffd23f';cx.beginPath();cx.arc(X(r.x+dx+34),Y(r.y+r.h/2),20*S,0,7);cx.fill();txt('%',X(r.x+dx+34),Y(r.y+r.h/2+7),Math.round(18*S),'#1a0f00',FN);
  txt(c.n,X(r.x+dx+66),Y(r.y+34),Math.round(17*S),'#fff',FK,'left');txt(c.d,X(r.x+dx+66),Y(r.y+58),Math.round(12*S),'#d9c2ff',FK,'left');txt(String(i+1),X(r.x+dx+r.w-16),Y(r.y+22),Math.round(8*S),'#ffffff66',FN,'right');cx.globalAlpha=1}}
function drawSlot(){if(!slot)return;cx.fillStyle='#050214b0';cx.fillRect(0,0,W,H);panel(150,360);
 txt('덤 뽑기',X(VW/2),Y(190),Math.round(24*S),'#fff',FK);txt('같은 그림 2개 = 값 2배 덤 · 3개 = 황금 3배',X(VW/2),Y(214),Math.round(11.5*S),'#ffd23fcc',FK);
 // 덤 뽑기 그림 3칸 틀
 cx.fillStyle=lg(Y(232),Y(352),'#3a1f7a','#1e0f48');rr(X(36),Y(232),(VW-72)*S,120*S,14*S);cx.fill();cx.strokeStyle='#ffd23f';cx.lineWidth=3*S;cx.stroke();
 for(let i=0;i<3;i++){const rx=48+i*92,ry=244,rw=80,rh=96,stopped=slot.st>i||slot.st>=3;cx.fillStyle='#fff8ec';rr(X(rx),Y(ry),rw*S,rh*S,10*S);cx.fill();
  cx.save();rr(X(rx),Y(ry),rw*S,rh*S,10*S);cx.clip();
  if(slot.st<0){txt('?',X(rx+rw/2),Y(ry+62),Math.round(36*S),'#b06bff',FN)}
  else if(!stopped){const f=T*16+i*1.7,k=SLOT[Math.floor(f)%SLOT.length],off=(f%1)*rh;drawCell(k,rx,ry-rh+off,rw,rh);drawCell(SLOT[(Math.floor(f)+1)%SLOT.length],rx,ry+off,rw,rh)}
  else{const tk=slot.stopT&&slot.stopT[i]!=null?Math.min(1,(slot.t-slot.stopT[i])/0.18):1;drawCell(slot.res[i],rx,ry+(1-tk)*-10,rw,rh)}
  cx.restore();cx.fillStyle='rgba(0,0,0,.18)';cx.fillRect(X(rx),Y(ry),rw*S,10*S);cx.fillRect(X(rx),Y(ry+rh-10),rw*S,10*S)}
 if(slotDone()){const o=slot.out;if(o.m){const g=o.m===3;cx.strokeStyle=g?'#ffd23f':'#3ddc84';cx.lineWidth=3*S;cx.globalAlpha=0.6+0.4*Math.sin(T*8);cx.beginPath();cx.moveTo(X(44),Y(292));cx.lineTo(X(VW-44),Y(292));cx.stroke();cx.globalAlpha=1}
  txt(o.m?(o.m===3?'대박! 황금 '+IT[o.k].n+' (값 '+IT[o.k].p*3+')':'덤 '+IT[o.k].n+' (값 '+IT[o.k].p*2+')'):'꽝! 이번엔 덤이 없어요',X(VW/2),Y(384),Math.round(16*S),o.m===3?'#ffd23f':o.m?'#3ddc84':'#ff8aa0',FK);
  txt('다시 뽑으면 지금 결과는 사라져요',X(VW/2),Y(410),Math.round(10.5*S),'#ffffff88',FK)}
 const B=(b,s,c,on,sub)=>{cx.fillStyle=on?c:'#2a1d5c';rr(X(b.x),Y(b.y),b.w*S,b.h*S,13*S);cx.fill();cx.strokeStyle=c;cx.lineWidth=2*S;cx.stroke();txt(s,X(b.x+b.w/2),Y(b.y+b.h/2+(sub?0:6)),Math.round(16*S),on?'#1a0f00':c,FK);if(sub)txt(sub,X(b.x+b.w/2),Y(b.y+b.h/2+16),Math.round(9.5*S),on?'#1a0f00aa':c,FK)};
 if(slot.st<0)B(BTN_SPIN,'🎰 뽑기!','#ffd23f',true,'봉투마다 1번 공짜');
 else if(slotDone()){if(run.tix>0&&slot.out.m<3){B(BTN_RE,'다시 뽑기','#22d3ee',false,'🎟️ 티켓 '+run.tix+'장');B(BTN_TAKE,'받기 ▶','#ffd23f',true)}else B(BTN_SPIN,slot.out.m?'받고 시작 ▶':'그냥 시작 ▶','#ffd23f',true,slot.out.m<3&&!run.tix?'티켓은 봉투를 90% 채우면 +1':'')}
 txt('🎟️ 다시 뽑기 티켓 '+run.tix+'장',X(VW/2),Y(526),Math.round(11*S),'#ffffffaa',FK)}
function drawCell(k,rx,ry,rw,rh){const it=IT[k],cs=Math.min((rw-16)/it.w,(rh-16)/it.h,34);drawPiece(k,0,X(rx+(rw-it.w*cs)/2),Y(ry+(rh-it.h*cs)/2),cs*S,cs*S,false)}
function drawOver(){const r=lastRun||{sc:0,bags:0,items:0,sets:0,broken:0};cx.fillStyle='#050214bb';cx.fillRect(0,0,W,H);panel(110,300);
 txt(run&&run.clear?'장보기 완료!':'오늘의 장보기 끝',X(VW/2),Y(152),Math.round(22*S),'#fff',FK);txt(String(r.sc),X(VW/2),Y(206),Math.round(32*S),'#ffd23f',FN);
 txt(newBest?'NEW BEST!':'오늘 최고 '+best,X(VW/2),Y(236),Math.round(11*S),newBest?'#3ddc84':'#ffffff99',FN);
 const st=[['통과 봉투',r.bags+'/'+BAGS],['담은 물건',r.items+'개'],['세트 완성',r.sets+'번']];for(let i=0;i<3;i++){const x=X(36+i*100);cx.fillStyle='#ffffff10';rr(x,Y(258),92*S,62*S,10*S);cx.fill();txt(st[i][0],x+46*S,Y(280),Math.round(11*S),'#ffffffaa',FK);txt(st[i][1],x+46*S,Y(308),Math.round(15*S),'#fff',FK)}
 txt('덤 뽑기 '+(r.spins||0)+'번 · 황금 '+(r.gold||0)+' · 덤 '+(r.pair||0)+' · 꽝 '+(r.miss||0),X(VW/2),Y(336),Math.round(11*S),'#ffd23fcc',FK);
 txt(r.broken?'깨진 물건 '+r.broken+'개 · 무거운 건 아래로!':'하나도 안 깨뜨렸어요!',X(VW/2),Y(358),Math.round(12*S),r.broken?'#ff8aa0':'#3ddc84',FK);
 txt('PC는 Enter로 다시 시작',X(VW/2),Y(386),Math.round(10*S),'#ffffff66',FK)}
function drawIdle(){const by=Y(150);cx.fillStyle='#0b0620aa';rr(X(30),by-40*S,(VW-60)*S,250*S,18*S);cx.fill();
 txt('봉투 꽉!',X(VW/2),by+20*S,Math.round(44*S),'#fff',FK);txt('장 본 물건을 봉투에 착착 담는 퍼즐',X(VW/2),by+52*S,Math.round(14*S),'#ffd23f',FK);
 const ks=['melon','milk','eggs','icecr','onion'];let x=X(VW/2-120);for(const k of ks){const it=IT[k],cs=20*S;drawPiece(k,0,x,by+72*S+(3-it.h)*cs/2,cs,cs,false);x+=(it.w*20+10)*S}
 if(best)txt('오늘 내 최고 '+best+'점',X(VW/2),by+170*S,Math.round(13*S),'#3ddc84',FK)}
function drawPause(){cx.fillStyle='#0b0620';cx.fillRect(0,0,W,H);txt('잠깐 멈춤',X(VW/2),Y(300),Math.round(26*S),'#fff',FK);txt('누르면 이어서 담아요',X(VW/2),Y(330),Math.round(13*S),'#ffffffaa',FK)}
// ── 루프
let last=performance.now();
function step(dt){T+=dt;for(const p of parts){p.t+=dt;p.vy+=260*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}parts=parts.filter(p=>p.t<p.l);rings.forEach(r=>r.t+=dt);rings=rings.filter(r=>r.t<0.45);pops.forEach(p=>p.t+=dt);pops=pops.filter(p=>p.t<1);
 if(slot&&slot.st>=0&&slot.st<3){slot.t+=dt;slot.stopT=slot.stopT||[];if(slot.t>=SLOT_STOP[slot.st]){slot.stopT[slot.st]=slot.t;slot.st++;sStop();if(slot.st===3){const m=slot.out.m;if(m===3){sJack();shake=0.3}else if(m)sSet();else sMiss()}}}
 if(placed)for(const p of placed)p.t+=dt;if(banner)banner.t+=dt;if(shake>0)shake=Math.max(0,shake-dt);if(offer)offer.t+=dt;
 if(tal&&!tal.done){tal.t+=dt;const want=Math.floor(tal.t/0.28);if(want>tal.shown&&tal.shown<tal.lines.length){tal.shown++;sTick()}if(tal.shown>=tal.lines.length&&tal.t>tal.lines.length*0.28+0.3){tal.done=true;tal.pass?sPass():sFail()}}}
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;
 if(DEBUG&&DBG.bot&&phase!=='idle')botStep();
 const k=DEBUG&&DBG.fast?DBG.fast:1;for(let i=0;i<k;i++)step(dt);
 if(!W)size();cx.setTransform(dpr,0,0,dpr,0,0);
 if(phase==='pause'){drawPause();requestAnimationFrame(frame);return}
 if(shake>0){const m=shake*14*S;cx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m)}
 drawBg();
 if(phase==='idle'){drawIdle()}
 else if(run){drawHud();drawBag(false);drawBagItems();drawBag(true);if(phase==='play'||phase==='tally'||phase==='coupon')drawTray();drawGhost();drawFx();if(phase==='tally')drawTally();if(phase==='coupon')drawCoupon();if(phase==='slot')drawSlot();if(phase==='over')drawOver()}
 requestAnimationFrame(frame)}
// ── 디버그(포스터·쇼츠·점수 확인용): 욕심쟁이 봇
const DBG={bot:false,fast:0,acc:0,reroll:true};
function bestMove(){let bm=null;const base=ev.sc;for(let s=0;s<tray.length;s++){const pc=tray[s];if(!pc)continue;for(let r=0;r<2;r++){const q={k:pc.k,rot:r};if(r&&IT[pc.k].w===IT[pc.k].h)continue;
  for(let y=0;y<rows;y++)for(let x=0;x<COLS;x++){if(!fits(q,x,y))continue;const idx=placed.length;placed.push({k:q.k,rot:r,x,y,w:pw(q),h:ph(q),t:1});for(let yy=y;yy<y+ph(q);yy++)for(let xx=x;xx<x+pw(q);xx++)grid[yy][xx]=idx;
   const v=evaluate().sc-base+(y+ph(q))*0.5;placed.pop();for(let yy=y;yy<y+ph(q);yy++)for(let xx=x;xx<x+pw(q);xx++)grid[yy][xx]=-1;if(!bm||v>bm.v)bm={s,r,x,y,v}}}}return bm}
function botStep(){DBG.acc++;if(DBG.acc%(DBG.fast?1:8))return;
 if(phase==='play'){const m=bestMove();if(m&&m.v>-5){tray[m.s].rot=m.r;place(m.s,m.x,m.y)}else finishBag()}
 else if(phase==='tally'){if(!tal.done){tal.shown=tal.lines.length;tal.t=99}else afterTally()}
 else if(phase==='coupon'&&offer&&offer.t>0.4)pickCoupon(0);
 else if(phase==='slot'&&slot){if(slot.st<0)spin();else if(slotDone()){if(!slot.out.m&&run.tix>0&&DBG.reroll)spin();else takeSlot()}}}
if(DEBUG)window.__bg={dbg:DBG,start,bot(on){DBG.bot=!!on},seed(s){seedOverride=s},
 state:()=>({slot:slot?{st:slot.st,res:slot.res,out:slot.out}:null,tix:run?run.tix:0,phase,bag:run?run.bag:0,score:ev?ev.sc:0,total:run?run.total:0,last:lastRun}),
 auto(n){for(let i=0;i<n&&phase==='play';i++){const m=bestMove();if(!m)break;tray[m.s].rot=m.r;place(m.s,m.x,m.y)}},
 setLook(b,f){BAGSK=b||'';FXSK=f||''},sel(i){sel=i},spin,take:takeSlot};
look();bestLoad();size();requestAnimationFrame(frame);
})();
