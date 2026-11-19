(function(){
// 한 상 콤보: 5락실 창작 한식 주문 맞추기 카드 요리 게임. 재료 카드·요리·손님·배경·소리 모두 코드로 생성(외부 파일 없음).
// 손에 든 재료 카드를 골라 요리를 만들고, 기다리는 손님 주문과 맞으면 연속 서빙 보너스. 5일 장사, 손님을 3번 놓치면 끝.
const $=id=>document.getElementById(id);
const cab=$('hs-cab'),cv=$('hs-c'),cx=cv.getContext('2d');
const COARSE=matchMedia('(pointer: coarse)').matches,IOS=/iP(hone|od|ad)/.test(navigator.userAgent);
const DEBUG=location.hash.indexOf('hsdebug')>=0;
const FN='"Press Start 2P",monospace',FK='"Black Han Sans","Noto Sans KR",sans-serif';
try{document.fonts&&document.fonts.load('10px "Press Start 2P"');document.fonts&&document.fonts.load('16px "Black Han Sans"','한상')}catch(e){}
const VW=360,VH=640;
let W=0,H=0,dpr=1,S=1,OX=0,OY=0;
function size(){const r=cv.getBoundingClientRect();dpr=Math.min(2,window.devicePixelRatio||1);W=Math.max(1,r.width);H=Math.max(1,r.height);
 if(W*H*dpr*dpr>3.6e6)dpr=Math.max(1,Math.sqrt(3.6e6/(W*H)));cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);S=Math.min(W/VW,H/VH);OX=(W-VW*S)/2;OY=(H-VH*S)/2}
// ── 재료·요리
const ING={rice:'밥',egg:'계란',onion:'파',kimchi:'김치',tofu:'두부',meat:'고기',veg:'시금치',tteok:'떡',gim:'김',noodle:'당면',flour:'밀가루',doen:'된장',gochu:'고추장',soy:'간장'};
const RC=[
 {id:'eggroll',n:'계란말이',need:{egg:2,onion:1},p:30},{id:'kfried',n:'김치볶음밥',need:{rice:1,kimchi:1,egg:1},p:40},
 {id:'pajeon',n:'파전',need:{flour:1,onion:1,egg:1},p:40},{id:'tteok',n:'떡볶이',need:{tteok:1,gochu:1,onion:1},p:45},
 {id:'dstew',n:'된장찌개',need:{doen:1,tofu:1,veg:1},p:45},{id:'kstew',n:'김치찌개',need:{kimchi:1,tofu:1,meat:1},p:55},
 {id:'bulgo',n:'불고기',need:{meat:1,soy:1,onion:1},p:55},{id:'bibim',n:'비빔밥',need:{rice:1,veg:1,egg:1,gochu:1},p:65},
 {id:'gimbap',n:'김밥',need:{rice:1,gim:1,veg:1,egg:1},p:65},{id:'japchae',n:'잡채',need:{noodle:1,veg:1,meat:1,soy:1},p:75}];
const RCI={};RC.forEach(r=>RCI[r.id]=r);
const DECK0={rice:4,egg:5,onion:5,kimchi:3,tofu:3,meat:3,veg:3,tteok:2,gim:1,noodle:1,flour:2,doen:2,gochu:3,soy:2};
const DAYS=5,TURNS=10,SEATS=3;
const UPS=[
 {id:'meat',n:'고기·간장 꾸러미',d:'덱에 고기 2장 + 간장 1장',add:{meat:2,soy:1}},{id:'egg',n:'계란 한 판',d:'덱에 계란 3장',add:{egg:3}},
 {id:'rice',n:'햅쌀 한 포대',d:'덱에 밥 2장 + 김 1장',add:{rice:2,gim:1}},{id:'spice',n:'양념 선반',d:'고추장·간장·된장 1장씩',add:{gochu:1,soy:1,doen:1}},
 {id:'veg',n:'아침 장보기',d:'시금치 2장 + 두부 1장',add:{veg:2,tofu:1}},{id:'hand',n:'넓은 도마',d:'손에 드는 재료 8 → 9장'},
 {id:'disc',n:'부지런한 손',d:'하루 버리기 4 → 6번'},{id:'pat',n:'보리차 서비스',d:'손님이 1턴 더 기다려요'},
 {id:'combo',n:'단골 장부',d:'연속 서빙 보너스 20% → 30%'},{id:'sauce',n:'비법 소스',d:'모든 요리 값 +10'}];
// 하루 마감 '재료 룰렛'(8칸): 하루 1번 공짜, 다시 돌리기는 가게 매출(게임 점수)로 30원 → 60원 → 90원. 현금·코인은 안 써요.
const WH=[{n:'고기 2장',add:{meat:2},c:'#ff7a8a'},{n:'꽝',c:'#5a4a7a'},{n:'계란 2장',add:{egg:2},c:'#ffd86a'},{n:'팁 +50원',cash:50,c:'#3ddc84'},
 {n:'김·당면',add:{gim:1,noodle:1},c:'#7ddc6a'},{n:'꽝',c:'#5a4a7a'},{n:'시금치 2장',add:{veg:2},c:'#22d3ee'},{n:'연속 +2',streak:2,c:'#ff9db5'}];
const WCOST=30;
// ── 꾸미기(겉모습만): 상차림 tb, 요리 완성 효과 fx
let TB='',FX='';
function look(){const B=window.Bonus;try{TB=B&&B.gitem?B.gitem('hansang','tb')||'':'';FX=B&&B.gitem?B.gitem('hansang','fx')||'':''}catch(e){TB=FX=''}}
// ── 소리
let AC=null,MUTE=false;try{MUTE=localStorage.getItem('nr_hs_mute')==='1'}catch(e){}
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(type,f,a,dur,f2,delay){if(MUTE||!AC)return;const t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur);
 g.gain.setValueAtTime(a,t);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+dur+0.02)}
function noise(a,dur,ft,fq){if(MUTE||!AC)return;const n=Math.floor(AC.sampleRate*dur),b=AC.createBuffer(1,n,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.min(1,(n-i)/(n*0.3));
 const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=b;f.type=ft||'highpass';f.frequency.value=fq||1500;g.gain.value=a;s.connect(f);f.connect(g);g.connect(AC.destination);s.start()}
const sTap=()=>tone('triangle',880,0.08,0.05,1100),sUn=()=>tone('triangle',600,0.06,0.05,500);
const sCook=()=>{noise(0.18,0.5,'bandpass',3000);tone('sine',180,0.08,0.3,120)};
const sServe=n=>{const b=[523,587,659,784,880,1047];for(let i=0;i<3;i++)tone('triangle',b[Math.min(5,i+Math.min(3,n))],0.15,0.16,0,i*0.07);tone('sine',1568,0.06,0.25,0,0.2)};
const sTake=()=>{tone('triangle',440,0.12,0.12);tone('triangle',392,0.1,0.14,0,0.08)};
const sAngry=()=>{tone('sawtooth',160,0.1,0.3,90);noise(0.06,0.2,'lowpass',500)};
const sBad=()=>{tone('square',150,0.07,0.1);tone('square',120,0.07,0.1,0,0.07)};
const sDay=()=>{[392,440,523,587,659,784].forEach((f,i)=>tone('triangle',f,0.14,0.2,0,i*0.08))};
const sTickW=()=>tone('square',1400,0.035,0.02),sWin=()=>{[659,784,988,1319].forEach((f,i)=>tone('square',f,0.07,0.12,0,i*0.07))},sMissW=()=>{tone('triangle',330,0.12,0.15,300);tone('triangle',262,0.12,0.25,220,0.14)};
const sOver=()=>{tone('triangle',392,0.2,0.4,294);tone('triangle',294,0.2,0.6,196,0.3)};
const PENT=[392,440,523,587,659,784,880];let bgmT=null,bgmI=0;
function bgm(on){if(bgmT){clearInterval(bgmT);bgmT=null}if(!on)return;bgmT=setInterval(()=>{if(MUTE||!AC||phase==='idle'||phase==='pause')return;const k=(bgmI*5+(bgmI>>2)*3)%7;if(bgmI%4!==3)tone('triangle',PENT[k],0.04,0.35);if(bgmI%8===0)tone('sine',196,0.05,0.8);bgmI++},300)}
// ── 상태
let phase='idle',wheel=null,run,hand=[],sel=new Set(),draw=[],disc=[],seats=[],cq=[],R,RC2,parts=[],pops=[],flies=[],shake=0,T=0,best=0,newBest=false,lastRun=null,book=false,banner=null,offer=null,daySum=null,prevPhase='play',seedOverride=null;
function bestLoad(){try{best=+localStorage.getItem('nr_best_hansang_'+KST)||0}catch(e){}}
function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function genRun(seed){R=seeded(seed);RC2=seeded(seed+'#손님');const offs=[];for(let d=0;d<DAYS-1;d++)offs.push(shuffle(UPS.map(u=>u.id),R));
 const deck=[];for(const k in DECK0)for(let i=0;i<DECK0[k];i++)deck.push(k);
 return {day:0,cash:0,hearts:3,streak:0,maxStreak:0,served:0,lost:0,take:0,up:{},offs,deck,wr:seeded(seed+'#룰렛'),ws:{spins:0,paid:0,miss:0,hit:0}}}
const handN=()=>run.up.hand?9:8,discN=()=>run.up.disc?6:4,patN=()=>Math.max(4,7-Math.floor(run.day*0.75))+(run.up.pat?1:0);
function newCust(){const pool=Math.min(RC.length,5+run.day*1.5|0),r=RC[Math.floor(RC2()*pool)],c=Math.floor(RC2()*6);return {o:r.id,pat:patN(),max:patN(),c,t:0,leave:0,mood:0}}
function newDay(){if(run.day>0)run.hearts=Math.min(3,run.hearts+1);draw=shuffle(run.deck.slice(),R);disc=[];hand=[];sel=new Set();run.turn=0;run.dleft=discN();run.dayCash=0;run.dayServed=0;run.dayLost=0;
 seats=[];for(let i=0;i<SEATS;i++)seats.push(newCust());refill();banner={t:0,s:(run.day+1)+'일째 장사',s2:'요리 '+TURNS+'번 · 손님 3명 놓치면 끝'}}
function drawOne(){if(!draw.length){if(!disc.length)return null;draw=shuffle(disc,R);disc=[]}return draw.pop()}
function refill(){while(hand.length<handN()){const c=drawOne();if(!c)break;hand.push({k:c,t:0})}}
function counts(idx){const m={};for(const i of idx){const k=hand[i].k;m[k]=(m[k]||0)+1}return m}
function recipeOf(idx){const m=counts(idx);let bestR=null;for(const r of RC){let ok=true;for(const k in r.need)if((m[k]||0)<r.need[k]){ok=false;break}if(ok&&(!bestR||r.p>bestR.p))bestR=r}return bestR}
const nNeed=r=>Object.values(r.need).reduce((a,b)=>a+b,0);
const val=r=>r.p+(run.up.sauce?10:0);
function preview(){if(!sel.size)return null;const r=recipeOf([...sel]);if(!r)return {fail:true};const extra=sel.size-nNeed(r),match=seats.reduce((m,s,i)=>s&&!s.leave&&s.o===r.id&&(m<0||s.pat<seats[m].pat)?i:m,-1);
 const mult=1+(run.up.combo?0.3:0.2)*Math.min(run.streak,10);const pay=match>=0?Math.round(val(r)*mult)+(seats[match].pat>=3?10:0)+extra*5:Math.round(val(r)*0.5)+extra*5;return {r,extra,match,pay}}
// ── 요리하기
function cook(){if(phase!=='play')return;const pv=preview();if(!pv||pv.fail){sBad();shake=0.12;return}
 const idx=[...sel].sort((a,b)=>b-a);for(const i of idx){disc.push(hand[i].k);hand.splice(i,1)}sel=new Set();sCook();
 const {r,match,pay}=pv;let tx=VW/2,ty=150;
 if(match>=0){const s=seats[match];tx=60+match*120;run.streak++;run.maxStreak=Math.max(run.maxStreak,run.streak);run.served++;run.dayServed++;s.leave=1;s.happy=1;s.t=0;sServe(run.streak);
  pops.push({x:tx,y:96,t:0,s:'+'+pay,c:'#ffd23f',big:1});if(run.streak>=2)pops.push({x:tx,y:70,t:0,s:run.streak+'연속!',c:'#ff9db5'});burst(tx,120,14)}
 else{run.streak=0;run.take++;sTake();pops.push({x:VW/2,y:300,t:0,s:'포장 +'+pay,c:'#9fd8ff'})}
 flies.push({id:r.id,x0:110,y0:290,x1:tx,y1:ty,t:0});run.cash+=pay;run.dayCash+=pay;run.turn++;
 // 한 턴 지남: 남은 손님 인내 -1
 for(let i=0;i<SEATS;i++){const s=seats[i];if(!s||s.leave)continue;s.pat--;if(s.pat<=0&&run.hearts>0){s.leave=1;s.happy=0;s.t=0;run.hearts--;run.lost++;run.dayLost++;run.streak=0;sAngry();shake=0.3;pops.push({x:60+i*120,y:110,t:0,s:'손님이 갔어요',c:'#ff6d8a'})}}
 refill();
 if(run.hearts<=0){setTimeout(over,700);phase='wait';return}
 if(run.turn>=TURNS){phase='wait';setTimeout(endDay,800)}}
function discard(){if(phase!=='play'||!sel.size){sBad();return}const free=run.dleft>0;
 const idx=[...sel].sort((a,b)=>b-a);for(const i of idx){disc.push(hand[i].k);hand.splice(i,1)}sel=new Set();refill();tone('triangle',300,0.1,0.1,200);
 if(free){run.dleft--;return}
 // 버리기를 다 쓰면 한 턴을 써서 버린다
 run.turn++;run.streak=0;for(let i=0;i<SEATS;i++){const s=seats[i];if(!s||s.leave)continue;s.pat--;if(s.pat<=0&&run.hearts>0){s.leave=1;s.happy=0;s.t=0;run.hearts--;run.lost++;run.dayLost++;sAngry();shake=0.3}}
 if(run.hearts<=0){phase='wait';setTimeout(over,700);return}if(run.turn>=TURNS){phase='wait';setTimeout(endDay,800)}}
function pickFor(i){const s=seats[i];if(phase!=='play'||!s||s.leave)return;const need=RCI[s.o].need,ns=new Set(),used=new Set();
 for(const k in need){let c=need[k];for(let j=0;j<hand.length&&c>0;j++)if(!used.has(j)&&hand[j].k===k){used.add(j);ns.add(j);c--}if(c>0){sBad();pops.push({x:60+i*120,y:200,t:0,s:'재료 부족',c:'#ffffffcc'});s.shake=0.3;return}}
 sel=ns;sTap()}
function endDay(){if(!run||run.hearts<=0)return;sDay();daySum={t:0,day:run.day,cash:run.dayCash,served:run.dayServed,lost:run.dayLost};
 if(run.day>=DAYS-1){phase='daysum';return}phase='daysum'}
function afterDay(){if(phase!=='daysum'||!daySum||daySum.t<0.6)return;daySum=null;if(run.day>=DAYS-1){run.clear=1;run.cash+=run.hearts*100;over();return}
 phase='wheel';wheel={t:0,ang:-Math.PI/2-Math.PI/8,a0:0,a1:0,dur:0,res:-1,spinning:false,first:true,n:0,last:-1}}
function wCost(){return WCOST*wheel.n}
function wSpin(){if(phase!=='wheel'||!wheel||wheel.spinning)return;if(!wheel.first){const c=wCost();if(run.cash<c){sBad();return}run.cash-=c;run.ws.paid+=c;pops.push({x:VW/2,y:130,t:0,s:'-'+c+'원',c:'#ff9db5'})}
 wheel.first=false;wheel.n++;run.ws.spins++;const i=Math.floor(run.wr()*WH.length),seg=Math.PI*2/WH.length;
 // 포인터(위쪽, -90°)에 i번째 칸 가운데가 오도록: ang + (i+0.5)*seg = -90° (mod 360)
 let tgt=-Math.PI/2-(i+0.5)*seg;const base=wheel.ang;while(tgt<base+Math.PI*2*3)tgt+=Math.PI*2;tgt+=(run.wr()-0.5)*seg*0.6;
 wheel.a0=base;wheel.a1=tgt;wheel.t=0;wheel.dur=2.1;wheel.spinning=true;wheel.res=-1;wheel.pend=i;wheel.last=-1;sTap()}
function wTake(){if(phase!=='wheel'||!wheel)return;if(wheel.first){wSpin();return}if(wheel.spinning)return;const w=WH[wheel.res];
 if(w.add)for(const k in w.add)for(let j=0;j<w.add[k];j++)run.deck.push(k);if(w.cash){run.cash+=w.cash}if(w.streak){run.streak+=w.streak;run.maxStreak=Math.max(run.maxStreak,run.streak)}
 if(w.add||w.cash||w.streak)run.ws.hit++;else run.ws.miss++;wheel=null;
 phase='up';offer={t:0,ids:run.offs[run.day].filter(id=>!run.up[id]||UPS.find(u=>u.id===id).add).slice(0,3)}}
function pickUp(i){if(phase!=='up'||!offer||offer.t<0.35||!offer.ids[i])return;const u=UPS.find(x=>x.id===offer.ids[i]);run.up[u.id]=(run.up[u.id]||0)+1;
 if(u.add)for(const k in u.add)for(let j=0;j<u.add[k];j++)run.deck.push(k);sServe(3);offer=null;run.day++;phase='play';newDay()}
function over(){if(phase==='over')return;phase='over';bgm(false);newBest=false;const sc=run.cash;
 if(sc>best){newBest=sc>0;best=sc;try{localStorage.setItem('nr_best_hansang_'+KST,sc)}catch(e){}}
 lastRun={sc,day:run.day+1,served:run.served,streak:run.maxStreak,lost:run.lost,take:run.take,clear:!!run.clear,ws:Object.assign({},run.ws)};
 if(!DEBUG){if(window.Bonus)Bonus.played('hansang');if(sc>0&&window.submitScore)submitScore(sc)}
 run.clear?sDay():sOver();
 setTimeout(()=>{if(phase==='over'){$('hs-go').textContent='↻ 다시 장사하기';$('hs-go').style.display='';$('hs-ov').style.display='flex'}},900);
 $('hs-msg').textContent='이번 장사 매출 '+sc+'원 · 서빙 '+run.served+'그릇'+(newBest?' · 오늘 최고 기록!':'')}
function burst(x,y,n){for(let i=0;i<n;i++){const a=Math.random()*6.28,v=50+Math.random()*110;parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50,t:0,l:0.8,f:FX||'base',c:['#ffd23f','#ff9d3d','#ff6d8a','#fff3c8'][i%4],r:Math.random()*6})}}
// ── 시작·전체화면
function full(on){if(on){cab.classList.add('on');document.body.style.overflow='hidden';
  if(!IOS&&cab.requestFullscreen&&!document.fullscreenElement){cab.requestFullscreen({navigationUI:'hide'}).then(()=>{try{COARSE&&screen.orientation&&screen.orientation.lock&&screen.orientation.lock('portrait').catch(()=>{})}catch(e){}}).catch(()=>{})}
  if(IOS&&!navigator.standalone){const p=$('hs-ios');p.style.display='block';setTimeout(()=>p.style.display='none',4000)}}
 else{cab.classList.remove('on');document.body.style.overflow='';if(document.fullscreenElement&&document.exitFullscreen)document.exitFullscreen().catch(()=>{})}
 setTimeout(size,60);size()}
let runT0=0;
function start(){ac();look();bestLoad();full(true);run=genRun(seedOverride||('hansang'+KST));newDay();phase='play';parts=[];pops=[];flies=[];book=false;offer=null;daySum=null;runT0=T;
 $('hs-go').style.display='none';$('hs-ov').style.display='none';$('hs-msg').textContent='재료 카드를 골라 요리하고, 손님 주문과 맞춰 내 주세요.';bgm(true)}
function pause(){if(['play','up','daysum','wheel'].indexOf(phase)>=0){prevPhase=phase;phase='pause';$('hs-go').textContent='▶ 이어 하기';$('hs-go').style.display=''}}
function resume(){if(phase!=='pause')return;phase=prevPhase;$('hs-go').style.display='none'}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&cab.classList.contains('on')&&!IOS){pause();cab.classList.remove('on');document.body.style.overflow='';setTimeout(size,60)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
// ── 배치
const BT_COOK={x:236,y:246,w:112,h:44},BT_DISC={x:236,y:296,w:112,h:40},BT_BOOK={x:12,y:582,w:336,h:42};
function cardRect(i){const n=hand.length,per=Math.max(1,Math.ceil(n/2)),row=i<per?0:1,inRow=row?n-per:Math.min(per,n),col=row?i-per:i,gap=4,cw=Math.min(80,(336-gap*(per-1))/per),ch=98,tw=inRow*cw+(inRow-1)*gap;
 const lift=sel.has(i)?-10:0;return {x:(VW-tw)/2+col*(cw+gap),y:356+row*(ch+8)+lift,w:cw,h:ch}}
const BW_SPIN={x:70,y:470,w:220,h:52},BW_RE={x:30,y:470,w:144,h:52},BW_TAKE={x:186,y:470,w:144,h:52};
function upRect(i){return {x:24,y:220+i*92,w:VW-48,h:80}}
const inR=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
function toW(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left-OX)/S,y:(e.clientY-r.top-OY)/S}}
function toggle(i){if(!hand[i])return;if(sel.has(i)){sel.delete(i);sUn()}else{sel.add(i);sTap()}}
cab.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;e.preventDefault();ac();const p=toW(e);
 if(phase==='idle'){start();return}if(phase==='pause'){resume();return}
 if(book){book=false;return}
 if(phase==='daysum'){afterDay();return}
 if(phase==='wheel'&&wheel){if(wheel.first){wSpin();return}if(wheel.spinning)return;if(inR(p,BW_RE)){wSpin();return}if(inR(p,BW_TAKE)){wTake();return}return}
 if(phase==='up'){for(let i=0;i<3;i++)if(inR(p,upRect(i))){pickUp(i);return}return}
 if(phase!=='play')return;
 if(inR(p,BT_COOK)){cook();return}if(inR(p,BT_DISC)){discard();return}if(inR(p,BT_BOOK)){book=true;sTap();return}
 for(let i=hand.length-1;i>=0;i--)if(inR(p,cardRect(i))){toggle(i);return}
 for(let i=0;i<SEATS;i++)if(inR(p,{x:4+i*120,y:60,w:112,h:160})){pickFor(i);return}
 if(sel.size){sel=new Set();sUn()}});
addEventListener('keydown',e=>{if(!cab.classList.contains('on')&&phase==='idle')return;const k=e.key;
 if(book){book=false;return}
 if(phase==='play'){if(k>='1'&&k<='8')toggle(+k-1);else if(k==='Enter'||k===' '){e.preventDefault();cook()}else if(k==='d'||k==='D')discard();else if(k==='q'||k==='Q')pickFor(0);else if(k==='w'||k==='W')pickFor(1);else if(k==='e'||k==='E')pickFor(2);else if(k==='b'||k==='B')book=true}
 else if(phase==='daysum'&&(k==='Enter'||k===' ')){e.preventDefault();afterDay()}
 else if(phase==='up'&&k>='1'&&k<='3')pickUp(+k-1);
 else if(phase==='wheel'&&wheel){if(k==='Enter'||k===' '){e.preventDefault();wTake()}else if(k==='r'||k==='R')wSpin()}
 else if(phase==='over'&&k==='Enter'&&$('hs-go').style.display!=='none')start();
 else if(phase==='pause'&&(k==='Enter'||k===' '))resume();
 if(k==='Escape'&&phase!=='play')full(false)});
$('hs-go').onclick=()=>{if(phase==='pause')resume();else start()};
$('hs-x').onclick=()=>{pause();full(false)};
const muIc=()=>{$('hs-mu').textContent=MUTE?'🔇':'🔊'};muIc();
$('hs-mu').onclick=()=>{MUTE=!MUTE;muIc();try{localStorage.setItem('nr_hs_mute',MUTE?'1':'0')}catch(e){}};
$('hs-sh').onclick=()=>{const r=lastRun||{sc:0,served:0};shareText('5락실 한 상 콤보 '+KST.slice(5)+'\n🍲 오늘 장사 매출 '+r.sc+'원, '+r.served+'그릇 서빙! 이겨 볼래?\n'+challengeUrl(r.sc))};
$('hs-rk').onclick=()=>{full(false);const r=$('rankbox');if(r)setTimeout(()=>r.scrollIntoView({behavior:'smooth'}),120)};
addEventListener('resize',()=>setTimeout(size,50));
addEventListener('bonus-look',()=>{if(phase==='idle'||phase==='over')look()});
// ── 그리기 도우미
const X=x=>OX+x*S,Y=y=>OY+y*S;
function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath()}
function lg(y0,y1,a,b){const g=cx.createLinearGradient(0,y0,0,y1);g.addColorStop(0,a);g.addColorStop(1,b);return g}
function txt(s,x,y,sz,c,f,al){cx.font=Math.round(sz)+'px '+(f||FK);cx.fillStyle=c;cx.textAlign=al||'center';cx.fillText(s,x,y)}
function glowSpr(col){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,col+'ff');r.addColorStop(0.35,col+'66');r.addColorStop(1,col+'00');g.fillStyle=r;g.fillRect(0,0,64,64);return c}
const GL={o:glowSpr('#ffa040'),y:glowSpr('#ffd86a'),w:glowSpr('#ffffff'),r:glowSpr('#ff5a5a')};
function glow(sp,x,y,r,a){cx.save();cx.globalCompositeOperation='lighter';cx.globalAlpha=a;cx.drawImage(sp,x-r,y-r,r*2,r*2);cx.restore()}
// ── 재료 그림(가운데 x,y, 크기 s)
function ing(k,x,y,s){cx.save();cx.translate(x,y);cx.lineJoin='round';const o=()=>{cx.strokeStyle='#0007';cx.lineWidth=Math.max(1,s*0.05);cx.stroke()};
 if(k==='rice'){cx.fillStyle=lg(-s*0.1,s*0.5,'#f2e6d0','#c9a77a');cx.beginPath();cx.moveTo(-s*0.5,0);cx.quadraticCurveTo(-s*0.45,s*0.45,0,s*0.45);cx.quadraticCurveTo(s*0.45,s*0.45,s*0.5,0);cx.closePath();cx.fill();o();
  cx.fillStyle='#fffdf6';cx.beginPath();cx.ellipse(0,-s*0.02,s*0.48,s*0.32,0,Math.PI,0);cx.fill();cx.fillStyle='#fff';for(let i=0;i<7;i++){cx.beginPath();cx.ellipse(-s*0.3+i*s*0.1,-s*0.12-(i%2)*s*0.08,s*0.03,s*0.05,0.4,0,7);cx.fill()}cx.fillStyle='#3a6ab0';cx.fillRect(-s*0.4,s*0.18,s*0.8,s*0.05)}
 else if(k==='egg'){cx.fillStyle=lg(-s*0.45,s*0.45,'#fff8ec','#f0cf9a');cx.beginPath();cx.ellipse(0,s*0.04,s*0.32,s*0.42,0,0,7);cx.fill();o();cx.fillStyle='#ffffffcc';cx.beginPath();cx.ellipse(-s*0.11,-s*0.14,s*0.07,s*0.13,-0.3,0,7);cx.fill()}
 else if(k==='onion'){cx.fillStyle='#4cbf4a';cx.beginPath();cx.moveTo(-s*0.08,0);cx.lineTo(-s*0.3,-s*0.5);cx.lineTo(-s*0.02,-s*0.45);cx.lineTo(s*0.04,0);cx.fill();cx.fillStyle='#6fdc5c';cx.beginPath();cx.moveTo(0,0);cx.lineTo(s*0.32,-s*0.48);cx.lineTo(s*0.1,0);cx.fill();
  cx.fillStyle=lg(0,s*0.5,'#e8ffd8','#ffffff');rr(-s*0.1,-s*0.05,s*0.2,s*0.5,s*0.08);cx.fill();o();cx.strokeStyle='#d6c4a0';cx.lineWidth=1;cx.beginPath();for(let i=-2;i<=2;i++){cx.moveTo(0,s*0.45);cx.lineTo(i*s*0.06,s*0.52)}cx.stroke()}
 else if(k==='kimchi'){cx.fillStyle=lg(-s*0.4,s*0.4,'#ff6a3d','#c4241a');cx.beginPath();cx.moveTo(-s*0.42,s*0.3);cx.quadraticCurveTo(-s*0.5,-s*0.3,0,-s*0.42);cx.quadraticCurveTo(s*0.5,-s*0.3,s*0.42,s*0.3);cx.quadraticCurveTo(0,s*0.45,-s*0.42,s*0.3);cx.fill();o();
  cx.fillStyle='#fff3e0';cx.beginPath();cx.ellipse(0,s*0.12,s*0.12,s*0.26,0,0,7);cx.fill();cx.fillStyle='#ffb08a';for(let i=0;i<5;i++)cx.fillRect(-s*0.3+i*s*0.14,-s*0.1+(i%2)*s*0.1,s*0.04,s*0.04)}
 else if(k==='tofu'){cx.fillStyle='#f4efe2';cx.beginPath();cx.moveTo(-s*0.35,-s*0.15);cx.lineTo(0,-s*0.35);cx.lineTo(s*0.38,-s*0.15);cx.lineTo(s*0.38,s*0.25);cx.lineTo(0,s*0.42);cx.lineTo(-s*0.35,s*0.25);cx.closePath();cx.fill();o();
  cx.fillStyle='#ffffff';cx.beginPath();cx.moveTo(-s*0.35,-s*0.15);cx.lineTo(0,-s*0.35);cx.lineTo(s*0.38,-s*0.15);cx.lineTo(0,s*0.04);cx.closePath();cx.fill();cx.fillStyle='#e2d8c0';cx.beginPath();cx.moveTo(0,s*0.04);cx.lineTo(s*0.38,-s*0.15);cx.lineTo(s*0.38,s*0.25);cx.lineTo(0,s*0.42);cx.closePath();cx.fill()}
 else if(k==='meat'){cx.fillStyle=lg(-s*0.3,s*0.3,'#ff7a86','#b8243a');cx.beginPath();cx.moveTo(-s*0.45,-s*0.05);cx.quadraticCurveTo(-s*0.3,-s*0.38,s*0.15,-s*0.3);cx.quadraticCurveTo(s*0.5,-s*0.2,s*0.42,s*0.15);cx.quadraticCurveTo(s*0.2,s*0.38,-s*0.25,s*0.3);cx.quadraticCurveTo(-s*0.5,s*0.18,-s*0.45,-s*0.05);cx.fill();o();
  cx.strokeStyle='#ffe2e8';cx.lineWidth=Math.max(1,s*0.05);cx.beginPath();cx.moveTo(-s*0.3,-s*0.05);cx.quadraticCurveTo(0,s*0.08,s*0.25,-s*0.15);cx.moveTo(-s*0.15,s*0.18);cx.quadraticCurveTo(s*0.1,s*0.05,s*0.3,s*0.12);cx.stroke()}
 else if(k==='veg'){for(let i=0;i<5;i++){const a=-1.2+i*0.6;cx.save();cx.rotate(a);cx.fillStyle=i%2?'#3fa83a':'#56c24a';cx.beginPath();cx.ellipse(0,-s*0.22,s*0.12,s*0.25,0,0,7);cx.fill();cx.strokeStyle='#2a7a2a';cx.lineWidth=1;cx.beginPath();cx.moveTo(0,0);cx.lineTo(0,-s*0.42);cx.stroke();cx.restore()}
  cx.fillStyle='#d65a8a';rr(-s*0.06,0,s*0.12,s*0.4,s*0.04);cx.fill()}
 else if(k==='tteok'){for(let i=0;i<3;i++){const yy=-s*0.25+i*s*0.22;cx.fillStyle=lg(yy-s*0.08,yy+s*0.08,'#ffffff','#e8e0d0');rr(-s*0.42,yy-s*0.08,s*0.84,s*0.17,s*0.08);cx.fill();o();cx.fillStyle='#ffffffaa';cx.fillRect(-s*0.36,yy-s*0.05,s*0.5,s*0.03)}}
 else if(k==='gim'){cx.fillStyle=lg(-s*0.4,s*0.4,'#2a4a2a','#0e1e12');rr(-s*0.38,-s*0.38,s*0.76,s*0.76,s*0.05);cx.fill();o();cx.strokeStyle='#4a7a4a55';cx.lineWidth=1;cx.beginPath();for(let i=-3;i<=3;i++){cx.moveTo(-s*0.38,i*s*0.1);cx.lineTo(s*0.38,i*s*0.1+s*0.05)}cx.stroke();cx.fillStyle='#ffffff22';cx.fillRect(-s*0.3,-s*0.32,s*0.6,s*0.06)}
 else if(k==='noodle'){cx.strokeStyle='#d9cdb8';cx.lineWidth=Math.max(1,s*0.04);for(let i=0;i<6;i++){cx.beginPath();cx.moveTo(-s*0.4,-s*0.3+i*s*0.12);for(let j=1;j<=8;j++)cx.lineTo(-s*0.4+j*s*0.1,-s*0.3+i*s*0.12+Math.sin(j*1.3+i)*s*0.06);cx.stroke()}cx.fillStyle='#b06bff';rr(-s*0.08,-s*0.4,s*0.16,s*0.8,3);cx.fill()}
 else if(k==='flour'){cx.fillStyle=lg(-s*0.45,s*0.45,'#fff4dc','#e2cc9a');cx.beginPath();cx.moveTo(-s*0.3,-s*0.38);cx.lineTo(s*0.3,-s*0.38);cx.lineTo(s*0.38,s*0.42);cx.lineTo(-s*0.38,s*0.42);cx.closePath();cx.fill();o();cx.fillStyle='#d6a640';cx.beginPath();cx.arc(0,s*0.05,s*0.18,0,7);cx.fill();txt('밀',0,s*0.12,s*0.22,'#fff',FK);cx.fillStyle='#c9b080';cx.fillRect(-s*0.3,-s*0.38,s*0.6,s*0.08)}
 else if(k==='doen'||k==='gochu'){const c=k==='doen'?['#b07a3a','#6a4018']:['#e8372a','#9a1410'];cx.fillStyle=lg(-s*0.3,s*0.45,c[0],c[1]);cx.beginPath();cx.moveTo(-s*0.32,-s*0.22);cx.quadraticCurveTo(-s*0.45,s*0.4,0,s*0.44);cx.quadraticCurveTo(s*0.45,s*0.4,s*0.32,-s*0.22);cx.closePath();cx.fill();o();
  cx.fillStyle='#5a3a1a';rr(-s*0.3,-s*0.36,s*0.6,s*0.14,s*0.05);cx.fill();cx.fillStyle='#fff3d8';rr(-s*0.2,0,s*0.4,s*0.2,3);cx.fill();txt(k==='doen'?'된장':'고추',0,s*0.15,s*0.13,c[1],FK);cx.fillStyle='#ffffff44';cx.beginPath();cx.ellipse(-s*0.18,-s*0.05,s*0.05,s*0.12,0.2,0,7);cx.fill()}
 else if(k==='soy'){cx.fillStyle=lg(-s*0.45,s*0.45,'#5a3020','#1a0a06');cx.beginPath();cx.moveTo(-s*0.08,-s*0.45);cx.lineTo(s*0.08,-s*0.45);cx.lineTo(s*0.08,-s*0.25);cx.quadraticCurveTo(s*0.28,-s*0.15,s*0.25,s*0.42);cx.lineTo(-s*0.25,s*0.42);cx.quadraticCurveTo(-s*0.28,-s*0.15,-s*0.08,-s*0.25);cx.closePath();cx.fill();o();
  cx.fillStyle='#e8372a';cx.fillRect(-s*0.1,-s*0.5,s*0.2,s*0.08);cx.fillStyle='#ffe9b0';rr(-s*0.2,0,s*0.4,s*0.22,3);cx.fill();txt('간장',0,s*0.16,s*0.13,'#3a1a0a',FK)}
 cx.restore()}
// ── 요리 그림
const DCOL={eggroll:['#ffd84a','#f0b020'],kfried:['#ff7a3d','#d84a1a'],pajeon:['#e8b858','#b8802a'],tteok:['#ff4a2a','#c42010'],dstew:['#b8803a','#7a4a18'],kstew:['#ff5a30','#b82a10'],bulgo:['#9a4a2a','#5a2a10'],bibim:['#ff7a3d','#3fa83a'],gimbap:['#1a2a1a','#ffd84a'],japchae:['#b8906a','#6a4a2a']};
function dish(id,x,y,s){cx.save();cx.translate(x,y);const c=DCOL[id];const stew=id==='dstew'||id==='kstew';
 if(stew){cx.fillStyle='#2a2a2a';cx.beginPath();cx.ellipse(0,s*0.1,s*0.5,s*0.32,0,0,7);cx.fill();cx.fillStyle='#444';cx.fillRect(-s*0.62,-s*0.02,s*0.14,s*0.08);cx.fillRect(s*0.48,-s*0.02,s*0.14,s*0.08);
  cx.fillStyle=lg(-s*0.2,s*0.2,c[0],c[1]);cx.beginPath();cx.ellipse(0,0,s*0.44,s*0.24,0,0,7);cx.fill();cx.fillStyle='#fff6e0';for(let i=0;i<3;i++)cx.fillRect(-s*0.25+i*s*0.18,-s*0.08+(i%2)*s*0.06,s*0.12,s*0.1);cx.fillStyle='#4cbf4a';cx.fillRect(s*0.1,-s*0.14,s*0.12,s*0.04);
  cx.fillStyle='#ffffff55';for(let i=0;i<3;i++){cx.beginPath();cx.arc(-s*0.2+i*s*0.2,s*0.05,s*0.03+Math.sin(T*6+i)*s*0.01,0,7);cx.fill()}}
 else if(id==='gimbap'||id==='eggroll'){cx.fillStyle='#f4f4f4';cx.beginPath();cx.ellipse(0,s*0.15,s*0.56,s*0.24,0,0,7);cx.fill();cx.strokeStyle='#0004';cx.stroke();
  for(let i=0;i<4;i++){const xx=-s*0.36+i*s*0.24;if(id==='gimbap'){cx.fillStyle='#14201a';cx.beginPath();cx.arc(xx,0,s*0.13,0,7);cx.fill();cx.fillStyle='#fffdf4';cx.beginPath();cx.arc(xx,0,s*0.1,0,7);cx.fill();cx.fillStyle='#ffd84a';cx.fillRect(xx-s*0.04,-s*0.04,s*0.04,s*0.04);cx.fillStyle='#3fa83a';cx.fillRect(xx,-s*0.02,s*0.04,s*0.05);cx.fillStyle='#ff7a3d';cx.fillRect(xx-s*0.02,s*0.02,s*0.04,s*0.03)}
   else{cx.fillStyle=lg(-s*0.12,s*0.12,'#ffe27a','#f0b020');rr(xx-s*0.1,-s*0.12,s*0.2,s*0.24,s*0.06);cx.fill();cx.strokeStyle='#d8901a';cx.lineWidth=1;cx.beginPath();cx.arc(xx,0,s*0.06,0,5);cx.stroke();cx.fillStyle='#4cbf4a';cx.fillRect(xx-s*0.03,-s*0.04,s*0.03,s*0.03)}}}
 else if(id==='pajeon'){cx.fillStyle='#f4f4f4';cx.beginPath();cx.ellipse(0,s*0.12,s*0.56,s*0.28,0,0,7);cx.fill();cx.fillStyle=lg(-s*0.2,s*0.2,c[0],c[1]);cx.beginPath();cx.ellipse(0,s*0.04,s*0.44,s*0.22,0,0,7);cx.fill();cx.strokeStyle='#3fa83a';cx.lineWidth=Math.max(1,s*0.05);cx.beginPath();for(let i=0;i<4;i++){cx.moveTo(-s*0.3+i*s*0.05,-s*0.1+i*s*0.06);cx.lineTo(s*0.3-i*s*0.03,-s*0.05+i*s*0.06)}cx.stroke()}
 else{cx.fillStyle=lg(0,s*0.45,'#fff8ec','#d8c8a8');cx.beginPath();cx.moveTo(-s*0.5,-s*0.05);cx.quadraticCurveTo(-s*0.45,s*0.42,0,s*0.42);cx.quadraticCurveTo(s*0.45,s*0.42,s*0.5,-s*0.05);cx.closePath();cx.fill();cx.strokeStyle='#0005';cx.lineWidth=1;cx.stroke();cx.fillStyle='#2a6ab0';cx.fillRect(-s*0.42,s*0.16,s*0.84,s*0.04);
  cx.fillStyle=lg(-s*0.25,0,c[0],c[1]);cx.beginPath();cx.ellipse(0,-s*0.06,s*0.46,s*0.2,0,0,7);cx.fill();
  if(id==='bibim'){const cs=['#ffd84a','#3fa83a','#ff7a3d','#8a5a2a','#ffffff'];for(let i=0;i<5;i++){cx.fillStyle=cs[i];cx.beginPath();cx.moveTo(0,-s*0.06);cx.arc(0,-s*0.06,s*0.36,i*1.256,i*1.256+1.1);cx.fill()}cx.fillStyle='#fff';cx.beginPath();cx.arc(0,-s*0.08,s*0.1,0,7);cx.fill();cx.fillStyle='#ffc020';cx.beginPath();cx.arc(0,-s*0.08,s*0.05,0,7);cx.fill()}
  else if(id==='tteok'){cx.fillStyle='#fff0e6';for(let i=0;i<5;i++){cx.save();cx.translate(-s*0.25+i*s*0.12,-s*0.08+(i%2)*s*0.06);cx.rotate(0.3*i);rr(-s*0.1,-s*0.035,s*0.2,s*0.07,s*0.03);cx.fill();cx.restore()}}
  else if(id==='kfried'){cx.fillStyle='#fff';cx.beginPath();cx.arc(s*0.05,-s*0.12,s*0.12,0,7);cx.fill();cx.fillStyle='#ffc020';cx.beginPath();cx.arc(s*0.05,-s*0.12,s*0.06,0,7);cx.fill()}
  else if(id==='bulgo'){cx.strokeStyle='#c87a4a';cx.lineWidth=Math.max(1,s*0.05);cx.beginPath();for(let i=0;i<5;i++){cx.moveTo(-s*0.3+i*s*0.12,-s*0.15);cx.quadraticCurveTo(-s*0.25+i*s*0.12,-s*0.02,-s*0.32+i*s*0.13,s*0.05)}cx.stroke();cx.fillStyle='#4cbf4a';cx.fillRect(-s*0.05,-s*0.18,s*0.1,s*0.03)}
  else if(id==='japchae'){cx.strokeStyle='#e8d0a8';cx.lineWidth=1;cx.beginPath();for(let i=0;i<7;i++){cx.moveTo(-s*0.35,-s*0.12+i*s*0.03);cx.bezierCurveTo(-s*0.1,-s*0.25+i*s*0.04,s*0.1,s*0.05,s*0.35,-s*0.1+i*s*0.02)}cx.stroke();cx.fillStyle='#3fa83a';cx.fillRect(-s*0.2,-s*0.1,s*0.08,s*0.03);cx.fillStyle='#ff7a3d';cx.fillRect(s*0.1,-s*0.06,s*0.08,s*0.03)}}
 cx.restore()}
// ── 손님
const SKIN=['#ffd9b8','#f2c49a','#e0a878','#ffe2cc','#c88a5a','#f5cfa8'],HAIR=['#2a1a10','#5a3a1a','#1a1a2a','#8a5a2a','#b0b0b0','#3a2a4a'],SHIRT=['#ff6d8a','#22d3ee','#ffd23f','#7ddc6a','#b06bff','#ff9d3d'];
function customer(s,i){const bx=60+i*120;let dy=0,al=1;if(s.leave){dy=-Math.min(1,s.t/0.6)*30*(s.happy?0.3:0);al=1-Math.min(1,s.t/0.6)}if(al<=0)return;
 const sh=s.shake>0?Math.sin(T*60)*3:0;cx.save();cx.globalAlpha=al;const x=X(bx+sh),y=Y(160+dy),r=26*S,pr=s.pat/s.max,mood=s.leave?(s.happy?2:-1):pr>0.6?1:pr>0.3?0:-1;
 // 몸·머리
 cx.fillStyle=SHIRT[s.c];rr(x-30*S,y+18*S,60*S,40*S,18*S);cx.fill();cx.fillStyle=SKIN[s.c];cx.beginPath();cx.arc(x,y,r,0,7);cx.fill();cx.strokeStyle='#0005';cx.lineWidth=1.5*S;cx.stroke();
 cx.fillStyle=HAIR[s.c];cx.beginPath();cx.arc(x,y-4*S,r*1.02,Math.PI*1.05,Math.PI*1.95);cx.fill();if(s.c%3===0){cx.beginPath();cx.arc(x+r*0.8,y-r*0.6,r*0.32,0,7);cx.fill()}
 cx.fillStyle='#2a1a10';const ey=y+2*S;if(mood===2){cx.lineWidth=2*S;cx.strokeStyle='#2a1a10';cx.beginPath();cx.arc(x-9*S,ey,4*S,Math.PI,0);cx.arc(x+9*S,ey,4*S,Math.PI,0);cx.stroke()}else{cx.beginPath();cx.arc(x-9*S,ey,2.6*S,0,7);cx.arc(x+9*S,ey,2.6*S,0,7);cx.fill()}
 cx.strokeStyle='#7a2a1a';cx.lineWidth=2*S;cx.beginPath();if(mood>=1)cx.arc(x,y+9*S,7*S,0.2,Math.PI-0.2);else if(mood===0){cx.moveTo(x-5*S,y+13*S);cx.lineTo(x+5*S,y+13*S)}else cx.arc(x,y+17*S,6*S,Math.PI+0.3,-0.3);cx.stroke();
 cx.fillStyle='#ff8a8a66';cx.beginPath();cx.arc(x-16*S,y+8*S,4*S,0,7);cx.arc(x+16*S,y+8*S,4*S,0,7);cx.fill();
 if(mood<0&&!s.leave){cx.fillStyle='#ff4d4d';txt('!',x+r,y-r*0.6,16*S,'#ff4d4d',FK)}
 // 주문 말풍선
 if(!s.leave){const bw=104*S,bh=56*S,bx2=x-bw/2,by2=Y(66);cx.fillStyle='#fffaf0';rr(bx2,by2,bw,bh,12*S);cx.fill();cx.beginPath();cx.moveTo(x-6*S,by2+bh);cx.lineTo(x,by2+bh+8*S);cx.lineTo(x+6*S,by2+bh);cx.fill();
  const m=sel.size&&previewCache&&previewCache.r&&previewCache.r.id===s.o;if(m){cx.strokeStyle='#3ddc84';cx.lineWidth=3*S;rr(bx2,by2,bw,bh,12*S);cx.stroke()}
  dish(s.o,bx2+24*S,by2+26*S,30*S);txt(RCI[s.o].n,bx2+bw*0.64,by2+24*S,(RCI[s.o].n.length>4?10:12)*S,'#3a1a0a',FK);txt(val(RCI[s.o])+'원',bx2+bw*0.64,by2+42*S,10*S,'#c86a1a',FK);
  // 인내 막대
  cx.fillStyle='#0008';rr(x-40*S,Y(222),80*S,8*S,4*S);cx.fill();cx.fillStyle=pr>0.6?'#3ddc84':pr>0.3?'#ffd23f':'#ff4d6d';rr(x-40*S,Y(222),80*S*pr,8*S,4*S);cx.fill();
  for(let k=1;k<s.max;k++){cx.fillStyle='#0006';cx.fillRect(x-40*S+80*S*k/s.max-0.5,Y(222),1,8*S)}}
 cx.restore()}
let previewCache=null;
// ── 배경: 밤의 포장마차
const LAMPS=[];for(let i=0;i<9;i++)LAMPS.push({x:i/8,p:Math.random()*6.28,c:i%3});
const STEAM=[];for(let i=0;i<14;i++)STEAM.push({x:Math.random(),y:Math.random(),s:0.6+Math.random(),v:0.02+Math.random()*0.03});
const CITY=[];{let x=0,s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;while(x<1.2){const w=0.03+r()*0.06;CITY.push({x,w,h:0.06+r()*0.16});x+=w+0.005}}
function drawBg(){cx.fillStyle=lg(0,H,'#0e0a2a','#2a1430');cx.fillRect(0,0,W,H);
 // 먼 도시
 cx.fillStyle='#1a1240';for(const b of CITY){cx.fillRect(b.x*W,H*0.42-b.h*H,b.w*W,b.h*H+H*0.1)}cx.fillStyle='#ffd86a33';for(const b of CITY)for(let k=0;k<3;k++)if(((b.x*997+k*13)|0)%3===0)cx.fillRect(b.x*W+b.w*W*0.3,H*0.42-b.h*H*(0.3+k*0.25),3,4);
 // 천막
 const ty=Y(0);cx.fillStyle='#c4241a';cx.fillRect(0,0,W,ty+44*S);cx.fillStyle='#ff6a3d';for(let x=0;x<W;x+=40*S){cx.beginPath();cx.moveTo(x,ty+44*S);cx.quadraticCurveTo(x+20*S,ty+60*S,x+40*S,ty+44*S);cx.fill()}
 cx.fillStyle='#ffffff22';for(let x=0;x<W;x+=40*S)cx.fillRect(x,0,20*S,ty+44*S);
 // 등불 줄
 cx.strokeStyle='#2a1a10';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(0,ty+58*S);for(let i=0;i<=20;i++){cx.lineTo(i/20*W,ty+58*S+Math.sin(i/20*Math.PI)*6*S)}cx.stroke();
 for(const l of LAMPS){const lx=l.x*W,ly=ty+60*S+Math.sin(l.x*Math.PI)*6*S+Math.sin(T*1.5+l.p)*1.5*S;glow(l.c===1?GL.y:GL.o,lx,ly+6*S,26*S,0.55+0.15*Math.sin(T*2+l.p));cx.fillStyle=l.c===2?'#ff5a3d':'#ffb040';cx.beginPath();cx.ellipse(lx,ly+6*S,6*S,8*S,0,0,7);cx.fill();cx.fillStyle='#2a1a10';cx.fillRect(lx-3*S,ly-2*S,6*S,3*S)}
 // 김(연기)
 cx.save();cx.globalCompositeOperation='lighter';for(const p of STEAM){const yy=((p.y-T*p.v)%1+1)%1,xx=p.x*W+Math.sin(T+p.x*9)*10;cx.globalAlpha=0.06*(1-Math.abs(yy-0.5)*2);cx.drawImage(GL.w,xx-30*p.s*S,yy*H-30*p.s*S,60*p.s*S,60*p.s*S)}cx.restore();cx.globalAlpha=1}
function drawCounter(){// 상차림(스킨)
 const y=Y(232),h=112*S;let g;
 if(TB==='marble')g=lg(y,y+h,'#f4f1ec','#cfc8be');else if(TB==='bojagi')g=lg(y,y+h,'#ffd1e0','#ff9ab8');else if(TB==='najeon')g=lg(y,y+h,'#1a1418','#0a0608');else g=lg(y,y+h,'#b87a42','#7a4a22');
 cx.fillStyle=g;cx.fillRect(X(0)-OX,y,W,h);
 if(TB==='marble'){cx.strokeStyle='#a8a09666';cx.lineWidth=1;cx.beginPath();for(let i=0;i<6;i++){cx.moveTo(i*W/6,y);cx.bezierCurveTo(i*W/6+30,y+h*0.3,i*W/6-20,y+h*0.6,i*W/6+40,y+h)}cx.stroke()}
 else if(TB==='bojagi'){const c=['#ff5a8a','#ffd23f','#22d3ee','#7ddc6a'];for(let i=0;i*28*S<W;i++)for(let j=0;j<4;j++){cx.fillStyle=c[(i+j)%4]+'66';cx.fillRect(i*28*S,y+j*28*S,28*S,28*S)}cx.strokeStyle='#fff8';cx.lineWidth=1;for(let i=0;i*28*S<W;i++){cx.beginPath();cx.moveTo(i*28*S,y);cx.lineTo(i*28*S,y+h);cx.stroke()}}
 else if(TB==='najeon'){for(let i=0;i<14;i++){const px=((i*137)%100)/100*W,py=y+((i*53)%100)/100*h,hh=(i*40+T*40)%360;cx.fillStyle=`hsla(${hh},80%,75%,.7)`;cx.beginPath();cx.ellipse(px,py,8*S,3*S,i,0,7);cx.fill()}cx.strokeStyle='#d8b060';cx.lineWidth=2*S;cx.strokeRect(-OX+2,y+3,W+OX*2-4,h-6)}
 else{cx.strokeStyle='#5a3a1a55';cx.lineWidth=1;cx.beginPath();for(let i=0;i<8;i++){cx.moveTo(0,y+i*h/8+4);cx.bezierCurveTo(W*0.3,y+i*h/8-3,W*0.6,y+i*h/8+6,W,y+i*h/8)}cx.stroke()}
 cx.fillStyle='#00000055';cx.fillRect(0,y,W,4*S)}
function drawHud(){txt('DAY '+(run.day+1)+'/'+DAYS,X(10),Y(22),9*S,'#ffd86a',FN,'left');txt('₩'+run.cash,X(VW/2),Y(26),15*S,'#fff',FN);
 for(let i=0;i<3;i++){const hx=X(16+i*18),hy=Y(40),z=6*S,on=i<run.hearts;cx.fillStyle=on?'#ff4d6d':'#ffffff33';cx.beginPath();cx.moveTo(hx,hy+z);cx.bezierCurveTo(hx-z*1.6,hy-z*0.2,hx-z*0.8,hy-z*1.4,hx,hy-z*0.5);cx.bezierCurveTo(hx+z*0.8,hy-z*1.4,hx+z*1.6,hy-z*0.2,hx,hy+z);cx.fill()}
 txt('남은 요리 '+(TURNS-run.turn)+' · 버리기 '+run.dleft+(run.streak>=2?' · '+run.streak+'연속 서빙':''),X(VW/2),Y(44),11*S,run.streak>=2?'#ff9db5':'#ffffffcc',FK)}
function drawPot(){const pv=previewCache;const x=X(12),y=Y(246),w=214*S,h=90*S;cx.fillStyle='#0b0620cc';rr(x,y,w,h,12*S);cx.fill();cx.strokeStyle=pv&&!pv.fail?'#ffd86a':'#ffffff33';cx.lineWidth=2*S;cx.stroke();
 if(!pv){txt('재료 카드를 골라요',x+w/2,y+38*S,13*S,'#ffffffaa',FK);txt('손님을 누르면 그 주문 재료가 골라져요',x+w/2,y+60*S,10*S,'#ffffff77',FK);return}
 if(pv.fail){txt('아직 요리가 안 돼요',x+w/2,y+38*S,14*S,'#ff9db5',FK);txt('레시피 수첩을 확인해 보세요',x+w/2,y+60*S,10*S,'#ffffff88',FK);return}
 glow(GL.o,x+46*S,y+h/2,44*S,0.35+0.1*Math.sin(T*4));dish(pv.r.id,x+46*S,y+h/2,52*S);
 txt(pv.r.n,x+92*S,y+30*S,17*S,'#fff',FK,'left');txt(pv.match>=0?(pv.match+1)+'번 손님 주문!':'포장 손님(반값)',x+92*S,y+52*S,11*S,pv.match>=0?'#3ddc84':'#9fd8ff',FK,'left');
 txt('+'+pv.pay+'원'+(pv.extra?' (반찬 '+pv.extra+')':''),x+92*S,y+74*S,13*S,'#ffd23f',FK,'left')}
function btn(b,s,c,on,sub){cx.fillStyle=on?c:'#2a1d4c';rr(X(b.x),Y(b.y),b.w*S,b.h*S,11*S);cx.fill();cx.strokeStyle=c;cx.lineWidth=2*S;cx.stroke();txt(s,X(b.x+b.w/2),Y(b.y+b.h/2+(sub?1:6)),15*S,on?'#1a0f00':c,FK);if(sub)txt(sub,X(b.x+b.w/2),Y(b.y+b.h/2+14),9*S,on?'#1a0f00aa':c+'aa',FK)}
function drawHand(){for(let i=0;i<hand.length;i++){const c=hand[i],r=cardRect(i),on=sel.has(i),k=Math.min(1,c.t/0.25);const x=X(r.x),y=Y(r.y+(1-k)*40),w=r.w*S,h=r.h*S;cx.globalAlpha=k;
  if(on)glow(GL.y,x+w/2,y+h/2,w*0.9,0.35);cx.fillStyle=lg(y,y+h,on?'#fff6d8':'#fffaf0',on?'#ffe08a':'#efe2c8');rr(x,y,w,h,10*S);cx.fill();cx.strokeStyle=on?'#ff9d3d':'#8a6a3a';cx.lineWidth=(on?3:1.5)*S;cx.stroke();
  cx.fillStyle='#00000010';rr(x+5*S,y+5*S,w-10*S,h*0.62,7*S);cx.fill();ing(c.k,x+w/2,y+h*0.36,44*S);txt(ING[c.k],x+w/2,y+h-12*S,(ING[c.k].length>2?12:14)*S,'#3a1a0a',FK);txt(String(i+1),x+8*S,y+14*S,7*S,'#8a6a3a',FN,'left');cx.globalAlpha=1}}
function drawBook(){cx.fillStyle='#050214e6';cx.fillRect(0,0,W,H);txt('레시피 수첩',X(VW/2),Y(56),22*S,'#ffd86a',FK);
 for(let i=0;i<RC.length;i++){const r=RC[i],y=Y(76+i*52);cx.fillStyle='#ffffff0d';rr(X(12),y,(VW-24)*S,46*S,10*S);cx.fill();dish(r.id,X(36),y+23*S,32*S);txt(r.n,X(62),y+20*S,13*S,'#fff',FK,'left');txt(val(r)+'원',X(62),y+38*S,10*S,'#ffd23f',FK,'left');
  let xx=X(140);for(const k in r.need)for(let j=0;j<r.need[k];j++){cx.fillStyle='#fffaf0';rr(xx,y+6*S,34*S,34*S,7*S);cx.fill();ing(k,xx+17*S,y+21*S,22*S);txt(ING[k],xx+17*S,y+38*S,6.5*S,'#3a1a0a',FK);xx+=38*S}}
 txt('아무 곳이나 누르면 닫혀요',X(VW/2),Y(612),11*S,'#ffffff88',FK)}
function drawFx(){for(const f of flies){const k=Math.min(1,f.t/0.45),e=1-(1-k)*(1-k),x=f.x0+(f.x1-f.x0)*e,y=f.y0+(f.y1-f.y0)*e-Math.sin(k*Math.PI)*60;if(k<1){glow(GL.y,X(x),Y(y),30*S,0.4);dish(f.id,X(x),Y(y),40*S)}}
 for(const p of parts){const a=1-p.t/p.l;if(a<=0)continue;cx.globalAlpha=a;const x=X(p.x),y=Y(p.y),s=S;
  if(p.f==='heart'){cx.fillStyle='#ff5fa8';const z=4.5*s;cx.beginPath();cx.moveTo(x,y+z);cx.bezierCurveTo(x-z*2,y-z*0.5,x-z,y-z*2,x,y-z*0.8);cx.bezierCurveTo(x+z,y-z*2,x+z*2,y-z*0.5,x,y+z);cx.fill()}
  else if(p.f==='fire'){cx.save();cx.globalCompositeOperation='lighter';cx.drawImage(p.t<0.3?GL.w:[GL.r,GL.y,GL.o][Math.floor(p.r)%3],x-8*s,y-8*s,16*s,16*s);cx.restore()}
  else{cx.fillStyle=p.c;cx.save();cx.translate(x,y);cx.rotate(p.r+p.t*5);cx.fillRect(-3*s,-1.5*s,6*s,3*s);cx.restore()}}cx.globalAlpha=1;
 for(const p of pops){const a=1-p.t;if(a<=0)continue;cx.globalAlpha=a;txt(p.s,X(p.x),Y(p.y-p.t*36),(p.big?20:13)*S,p.c,FK);cx.globalAlpha=1}
 if(banner&&banner.t<1.3){const a=banner.t<0.15?banner.t/0.15:banner.t>1?(1.3-banner.t)/0.3:1;cx.globalAlpha=a;cx.fillStyle='#0b0620dd';rr(X(40),Y(250),(VW-80)*S,70*S,14*S);cx.fill();cx.strokeStyle='#ffd86a';cx.lineWidth=2*S;cx.stroke();
  txt(banner.s,X(VW/2),Y(282),22*S,'#fff',FK);txt(banner.s2,X(VW/2),Y(306),11*S,'#ffd86a',FK);cx.globalAlpha=1}}
function panel(y,h,c){cx.fillStyle='#120a24f2';rr(X(16),Y(y),(VW-32)*S,h*S,16*S);cx.fill();cx.strokeStyle=c||'#ff9d3d';cx.lineWidth=2*S;cx.stroke()}
function drawDaySum(){const d=daySum;cx.fillStyle='#05021499';cx.fillRect(0,0,W,H);panel(150,260);txt((d.day+1)+'일째 장사 마감',X(VW/2),Y(192),21*S,'#fff',FK);
 const rows=[['오늘 매출',d.cash+'원'],['주문 맞춰 서빙',d.served+'그릇'],['놓친 손님',d.lost+'명'],['남은 하트',run.hearts+'개']];rows.forEach((r,i)=>{txt(r[0],X(44),Y(236+i*34),14*S,'#e8e0ff',FK,'left');txt(r[1],X(VW-44),Y(236+i*34),14*S,i===2&&d.lost?'#ff6d8a':'#ffd23f',FK,'right')});
 txt(d.day>=DAYS-1?'5일 장사 끝! 남은 하트 1개당 +100원':'누르면 내일 장사 준비',X(VW/2),Y(388),12*S,'#ffffff99',FK)}
function drawUp(){cx.fillStyle='#050214bb';cx.fillRect(0,0,W,H);txt('내일 장사 준비',X(VW/2),Y(180),23*S,'#fff',FK);txt('하나 고르면 장사 끝까지 효과가 남아요',X(VW/2),Y(204),11*S,'#ffffffaa',FK);
 for(let i=0;i<offer.ids.length;i++){const u=UPS.find(x=>x.id===offer.ids[i]),r=upRect(i),k=Math.min(1,Math.max(0,(offer.t-i*0.08)/0.25));cx.globalAlpha=k;const x=X(r.x+(1-k)*50),y=Y(r.y);
  cx.fillStyle=lg(y,y+r.h*S,'#4a2a1a','#2a140a');rr(x,y,r.w*S,r.h*S,14*S);cx.fill();cx.strokeStyle='#ffb040';cx.lineWidth=2*S;cx.stroke();
  if(u.add){const ks=Object.keys(u.add);ks.slice(0,2).forEach((k,j)=>ing(k,x+30*S+j*14*S,y+40*S+j*6*S,30*S))}else{glow(GL.o,x+36*S,y+40*S,26*S,0.6);txt('★',x+36*S,y+48*S,22*S,'#ffd86a',FK)}
  txt(u.n,x+72*S,y+34*S,16*S,'#fff',FK,'left');txt(u.d,x+72*S,y+58*S,11.5*S,'#ffd8b0',FK,'left');cx.globalAlpha=1}}
function drawWheel(){const w=wheel;cx.fillStyle='#050214ec';cx.fillRect(0,0,W,H);txt('재료 룰렛',X(VW/2),Y(112),24*S,'#fff',FK);txt('하루 1번 공짜 · 다시 돌리면 매출에서 '+WCOST+'원씩 더',X(VW/2),Y(136),11*S,'#ffd86acc',FK);
 const cxw=X(VW/2),cyw=Y(296),R0=118*S,seg=Math.PI*2/WH.length;glow(GL.o,cxw,cyw,R0*1.35,0.35);
 cx.fillStyle='#2a140a';cx.beginPath();cx.arc(cxw,cyw,R0+10*S,0,7);cx.fill();cx.strokeStyle='#ffb040';cx.lineWidth=3*S;cx.stroke();
 for(let i=0;i<WH.length;i++){const a=w.ang+i*seg,h=WH[i],hit=!w.spinning&&w.res===i;cx.fillStyle=hit?'#fff3c8':i%2?h.c+'cc':h.c;cx.beginPath();cx.moveTo(cxw,cyw);cx.arc(cxw,cyw,R0,a,a+seg);cx.closePath();cx.fill();cx.strokeStyle='#2a140a';cx.lineWidth=2*S;cx.stroke();
  cx.save();cx.translate(cxw,cyw);cx.rotate(a+seg/2);cx.translate(R0*0.64,0);cx.rotate(Math.sin(a+seg/2)>0.15?-Math.PI/2:Math.PI/2);
  if(h.add){const ks=Object.keys(h.add);ing(ks[0],0,-6*S,22*S)}else{txt(h.cash?'₩':h.streak?'🔥':'✕',0,2*S,16*S,'#1a0f00',FK)}
  txt(h.n,0,18*S,9.5*S,'#1a0f00',FK);cx.restore()}
 // 가운데 단추 + 등불
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2,on=((T*6|0)+i)%2===0||!w.spinning;cx.fillStyle=on?'#ffe08a':'#7a4a1a';cx.beginPath();cx.arc(cxw+Math.cos(a)*(R0+5*S),cyw+Math.sin(a)*(R0+5*S),2.6*S,0,7);cx.fill()}
 cx.fillStyle=lg(cyw-22*S,cyw+22*S,'#ffd86a','#c87a10');cx.beginPath();cx.arc(cxw,cyw,22*S,0,7);cx.fill();cx.strokeStyle='#2a140a';cx.lineWidth=2*S;cx.stroke();txt('한 상',cxw,cyw+4*S,11*S,'#2a140a',FK);
 // 포인터
 cx.fillStyle='#ff4d6d';cx.beginPath();cx.moveTo(cxw,cyw-R0+14*S);cx.lineTo(cxw-11*S,cyw-R0-16*S);cx.lineTo(cxw+11*S,cyw-R0-16*S);cx.closePath();cx.fill();cx.strokeStyle='#fff';cx.lineWidth=2*S;cx.stroke();
 if(!w.spinning&&w.res>=0){const h=WH[w.res],miss=!(h.add||h.cash||h.streak);txt(miss?'꽝! 이번엔 아무것도 없어요':h.n+(h.add?' 덱에 추가':h.cash?'':' (지금 바로)'),X(VW/2),Y(442),16*S,miss?'#ff8aa0':'#ffd86a',FK)}
 const B=(b,s,c,on,sub)=>{cx.fillStyle=on?c:'#2a1d4c';rr(X(b.x),Y(b.y),b.w*S,b.h*S,13*S);cx.fill();cx.strokeStyle=c;cx.lineWidth=2*S;cx.stroke();txt(s,X(b.x+b.w/2),Y(b.y+b.h/2+(sub?0:6)),16*S,on?'#1a0f00':c,FK);if(sub)txt(sub,X(b.x+b.w/2),Y(b.y+b.h/2+16),9.5*S,on?'#1a0f00aa':c,FK)};
 if(w.first)B(BW_SPIN,'🎡 돌리기!','#ffd86a',true,'오늘 1번 공짜');
 else if(!w.spinning){const c=wCost();B(BW_RE,'다시 돌리기',run.cash>=c?'#22d3ee':'#6a6a8a',false,'매출 -'+c+'원');B(BW_TAKE,'받기 ▶','#ffd86a',true);txt('다시 돌리면 지금 결과는 사라져요 · 매출 ₩'+run.cash,X(VW/2),Y(546),10.5*S,'#ffffff88',FK)}}
function drawOver(){const r=lastRun||{sc:0,day:1,served:0,streak:0,lost:0};cx.fillStyle='#050214c4';cx.fillRect(0,0,W,H);panel(110,300);
 txt(r.clear?'5일 장사 완주!':'오늘은 여기까지',X(VW/2),Y(150),22*S,'#fff',FK);txt('₩'+r.sc,X(VW/2),Y(204),28*S,'#ffd23f',FN);txt(newBest?'NEW BEST!':'오늘 최고 ₩'+best,X(VW/2),Y(232),10*S,newBest?'#3ddc84':'#ffffff99',FN);
 const st=[['장사한 날',r.day+'일'],['서빙',r.served+'그릇'],['최대 연속',r.streak+'번']];for(let i=0;i<3;i++){const x=X(36+i*100);cx.fillStyle='#ffffff10';rr(x,Y(256),92*S,62*S,10*S);cx.fill();txt(st[i][0],x+46*S,Y(278),11*S,'#ffffffaa',FK);txt(st[i][1],x+46*S,Y(306),15*S,'#fff',FK)}
 if(r.ws&&r.ws.spins)txt('룰렛 '+r.ws.spins+'번 · 당첨 '+r.ws.hit+' · 꽝 '+r.ws.miss+(r.ws.paid?' · 다시 돌리기 '+r.ws.paid+'원':''),X(VW/2),Y(334),10.5*S,'#ffd86acc',FK);
 txt(r.lost?'놓친 손님 '+r.lost+'명 · 급한 손님 먼저!':'손님을 한 명도 안 놓쳤어요!',X(VW/2),Y(356),12*S,r.lost?'#ff8aa0':'#3ddc84',FK);txt('PC는 Enter로 다시 시작',X(VW/2),Y(384),10*S,'#ffffff66',FK)}
function drawIdle(){cx.fillStyle='#120a24cc';rr(X(28),Y(150),(VW-56)*S,250*S,18*S);cx.fill();txt('한 상 콤보',X(VW/2),Y(214),42*S,'#fff',FK);txt('주문 맞춰 한 그릇씩, 포장마차 카드 요리',X(VW/2),Y(244),13*S,'#ffd86a',FK);
 ['bibim','kstew','gimbap','tteok'].forEach((d,i)=>dish(d,X(78+i*68),Y(300),50*S));if(best)txt('오늘 내 최고 ₩'+best,X(VW/2),Y(372),13*S,'#3ddc84',FK)}
function drawPause(){cx.fillStyle='#120a24';cx.fillRect(0,0,W,H);txt('잠깐 쉬는 중',X(VW/2),Y(300),26*S,'#fff',FK);txt('누르면 이어서 장사해요',X(VW/2),Y(330),13*S,'#ffffffaa',FK)}
// ── 루프
let last=performance.now();
function step(dt){T+=dt;for(const p of parts){p.t+=dt;p.vy+=240*dt;p.x+=p.vx*dt;p.y+=p.vy*dt}parts=parts.filter(p=>p.t<p.l);pops.forEach(p=>p.t+=dt);pops=pops.filter(p=>p.t<1);flies.forEach(f=>f.t+=dt);flies=flies.filter(f=>f.t<0.5);
 for(const c of hand)c.t+=dt;if(banner)banner.t+=dt;if(shake>0)shake=Math.max(0,shake-dt);if(offer)offer.t+=dt;if(daySum)daySum.t+=dt;
 if(wheel&&wheel.spinning){wheel.t+=dt;const k=Math.min(1,wheel.t/wheel.dur),e=1-Math.pow(1-k,3);wheel.ang=wheel.a0+(wheel.a1-wheel.a0)*e;const seg=Math.PI*2/WH.length,cur=Math.floor((wheel.ang-wheel.a0)/seg);if(cur!==wheel.last){wheel.last=cur;sTickW()}
  if(k>=1){wheel.spinning=false;wheel.res=wheel.pend;const h=WH[wheel.res];if(h.add||h.cash||h.streak){sWin();burst(VW/2,200,16)}else sMissW()}}
 for(let i=0;i<seats.length;i++){const s=seats[i];if(!s)continue;s.t+=dt;if(s.shake>0)s.shake-=dt;if(s.leave&&s.t>0.7&&phase!=='over'){seats[i]=newCust()}}}
function frame(now){const dt=Math.min(0.05,(now-last)/1000);last=now;if(DEBUG&&DBG.bot&&phase!=='idle')botStep();
 const k=DEBUG&&DBG.fast?DBG.fast:1;for(let i=0;i<k;i++)step(dt);if(!W)size();cx.setTransform(dpr,0,0,dpr,0,0);
 if(phase==='pause'){drawPause();requestAnimationFrame(frame);return}
 if(shake>0){const m=shake*14*S;cx.translate((Math.random()-0.5)*m,(Math.random()-0.5)*m)}
 drawBg();
 if(phase==='idle')drawIdle();
 else if(run){previewCache=phase==='play'?preview():null;drawCounter();for(let i=0;i<seats.length;i++)if(seats[i])customer(seats[i],i);drawHud();drawPot();
  const can=previewCache&&!previewCache.fail;btn(BT_COOK,'요리하기',  '#ffd23f',!!can);btn(BT_DISC,run.dleft>0?'버리기 '+run.dleft:'턴 쓰고 버리기','#22d3ee',sel.size>0);
  drawHand();btn(BT_BOOK,'레시피 수첩 보기','#ff9d3d',false);
  if(T<runT0+4&&run.day===0&&run.turn===0)txt(COARSE?'카드를 눌러 고르고 요리하기 · 손님을 누르면 자동 선택':'1~8 카드 · Q/W/E 손님 주문 · Enter 요리 · D 버리기',X(VW/2),Y(348),10.5*S,'#fff',FK);
  drawFx();if(book)drawBook();if(phase==='daysum'&&daySum)drawDaySum();if(phase==='wheel'&&wheel)drawWheel();if(phase==='up'&&offer)drawUp();if(phase==='over')drawOver()}
 requestAnimationFrame(frame)}
// ── 디버그: 봇(급한 손님 주문 우선, 없으면 가장 비싼 요리, 그래도 없으면 버리기)
const DBG={bot:false,fast:0,acc:0,reroll:1};
function botMove(){const order=seats.map((s,i)=>({s,i})).filter(o=>o.s&&!o.s.leave).sort((a,b)=>a.s.pat-b.s.pat);
 for(const o of order){const need=RCI[o.s.o].need,ns=new Set(),used=new Set();let ok=true;for(const k in need){let c=need[k];for(let j=0;j<hand.length&&c>0;j++)if(!used.has(j)&&hand[j].k===k){used.add(j);ns.add(j);c--}if(c>0){ok=false;break}}if(ok){sel=ns;cook();return}}
 let b=null;const n=hand.length;for(let m=1;m<(1<<n);m++){const idx=[];for(let j=0;j<n;j++)if(m&(1<<j))idx.push(j);if(idx.length>5)continue;const r=recipeOf(idx);if(r&&idx.length===nNeed(r)&&(!b||r.p>b.p))b={p:r.p,idx}}
 if(b&&(run.dleft===0||b.p>=55)){sel=new Set(b.idx);cook();return}
 if(run.dleft>0){const want=new Set();for(const o of order)for(const k in RCI[o.s.o].need)want.add(k);const d=[];hand.forEach((c,j)=>{if(!want.has(c.k))d.push(j)});sel=new Set(d.length?d.slice(0,4):[0,1]);discard();return}
 if(b){sel=new Set(b.idx);cook();return}sel=new Set([0,1,2]);discard()}
function botStep(){DBG.acc++;if(DBG.acc%(DBG.fast?2:10))return;
 if(phase==='play')botMove();else if(phase==='daysum'&&daySum&&daySum.t>0.6)afterDay();else if(phase==='up'&&offer&&offer.t>0.4)pickUp(0);
 else if(phase==='wheel'&&wheel&&!wheel.spinning){if(wheel.first)wSpin();else{const h=WH[wheel.res];if(!(h.add||h.cash||h.streak)&&DBG.reroll&&wheel.n<=DBG.reroll&&run.cash>=wCost())wSpin();else wTake()}}}
if(DEBUG)window.__hs={dbg:DBG,start,bot(on){DBG.bot=!!on},seed(s){seedOverride=s},state:()=>({wheel:wheel?{res:wheel.res,spinning:wheel.spinning,n:wheel.n}:null,phase,day:run?run.day:0,cash:run?run.cash:0,turn:run?run.turn:0,hearts:run?run.hearts:0,last:lastRun}),
 sel(a){sel=new Set(a)},pick:pickFor,move(n){for(let i=0;i<(n||1)&&phase==='play';i++)botMove()},setLook(t,f){TB=t||'';FX=f||''},book(on){book=!!on},spin:wSpin,take:wTake};
look();bestLoad();size();requestAnimationFrame(frame);
})();
