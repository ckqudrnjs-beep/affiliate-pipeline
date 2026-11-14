(function(){
// 오늘의 숫자 퍼즐(2026-11-14): 숫자 4개를 모두 한 번씩 써서 목표 수 만들기, 하루 5판.
// 문제는 seeded('numpuzzle'+KST)로 매일 자동 생성하고, 모든 경우를 계산해 풀 수 있는 목표만 고른다(사람이 할 일 없음).
const DBG=location.hash==='#npdebug',G='numpuzzle',$=id=>document.getElementById(id),root=$('np');if(!root)return;
function ops(a,b){const hi=Math.max(a,b),lo=Math.min(a,b),o=[['+',hi+lo],['×',hi*lo]];if(hi>lo)o.push(['−',hi-lo]);if(lo>1&&hi%lo===0)o.push(['÷',hi/lo]);return o.map(([op,r])=>[hi,op,lo,r])}
function calc(a,op,b){const hi=Math.max(a,b),lo=Math.min(a,b);if(op==='+')return hi+lo;if(op==='×')return hi*lo;if(op==='−')return hi>lo?hi-lo:0;if(op==='÷')return lo>0&&hi%lo===0?hi/lo:0;return 0}
// 남은 숫자로 만들 수 있는 모든 결과 → {n: 풀이 경우 수, path: 풀이 하나}
function solveAll(nums){const M=new Map();(function rec(L,P){if(L.length===1){let e=M.get(L[0]);if(!e)M.set(L[0],e={n:0,path:P});e.n++;return}
 for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const rest=L.filter((_,k)=>k!==i&&k!==j);for(const st of ops(L[i],L[j]))rec(rest.concat(st[3]),P.concat([st]))}})(nums,[]);return M}
const ri=(R,a,b)=>a+Math.floor(R()*(b-a+1)),pk=(R,a)=>a[Math.floor(R()*a.length)];
// 단계별 난이도: 숫자 범위·목표 범위·풀이 경우 수(적을수록 어려움)
const RC=[{p:R=>[0,0,0,0].map(()=>ri(R,1,9)),t:[10,30],c:[8,1e9]},
 {p:R=>[0,0,0,0].map(()=>ri(R,1,9)),t:[20,60],c:[3,24]},
 {p:R=>[0,0,0,0].map(()=>ri(R,2,13)),t:[40,150],c:[2,12]},
 {p:R=>[0,0,0].map(()=>ri(R,2,12)).concat(pk(R,[10,12,15,20,25])),t:[80,300],c:[1,8]},
 {p:R=>[0,0].map(()=>ri(R,2,10)).concat(pk(R,[15,20,25]),pk(R,[50,75,100])),t:[120,600],c:[1,6]}];
function gen(seed){const R=seeded(seed);return RC.map((c,ri_)=>{for(let k=0;k<600;k++){const nums=c.p(R),M=solveAll(nums),rl=k>400?3:1,sum=nums.reduce((a,b)=>a+b,0);
 const cand=[...M.entries()].filter(([t,e])=>t>=c.t[0]&&t<=c.t[1]&&e.n>=c.c[0]&&e.n<=c.c[1]*rl&&!nums.includes(t)&&(ri_<2||t!==sum));
 if(cand.length){const [t,e]=pk(R,cand);return {nums,t,path:e.path}}}
 const nums=c.p(R),M=solveAll(nums),[t,e]=[...M.entries()].sort((a,b)=>b[0]-a[0])[0];return {nums,t,path:e.path}})}
const LV=['쉬움','보통','조금 어려움','어려움','최고 난도'];
const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const fmtK=s=>(s>=60?Math.floor(s/60)+'분 ':'')+Math.floor(s%60)+'초';
const ld=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}},sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const yday=()=>new Date(Date.parse(KST+'T00:00:00Z')-864e5).toISOString().slice(0,10);
// 매일 상태(같은 날 새로 고침해도 이어서): el=쓴 시간(ms), r=지금 단계, res=[{s:'g'|'y'|'r',t:초}]
const DK='np_d_'+KST;let D=ld(DK)||{el:0,r:0,res:[],on:0};
let P=null; // 연습 모드 상태(순위·연속 기록 없음)
let PZ=gen('numpuzzle'+KST),cur,tiles,hist,log,sel=-1,op='',hintR=false,giveArm=0,since=0,busy=false;
const S=()=>P||D;
function el(){const s=S();return s.el+(since?Date.now()-since:0)}
function pause(){if(since){S().el+=Date.now()-since;since=0;save()}}
function run(){if(!since&&S().on&&!S().done&&!document.hidden)since=Date.now()}
function save(){if(!P)sv(DK,D)}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else run()});addEventListener('pagehide',pause);
setInterval(()=>{const s=S();if(s.on&&!s.done){$('np-time').textContent='⏱ '+fmt(el()/1000);if(since&&!P){const t=el();if(t-D.el>3000){D.el=t;since=Date.now();save()}}}},250);
// 연속 기록: 오늘 퍼즐을 끝까지 마친 날이 이어지면 +1
function streak(){const s=ld('np_st')||{n:0,best:0};if(s.last!==KST&&s.last!==yday())s.n=0;return s}
function bumpStreak(){const s=ld('np_st')||{n:0,best:0};if(s.last===KST)return s;s.n=s.last===yday()?s.n+1:1;s.best=Math.max(s.best||0,s.n);s.last=KST;sv('np_st',s);return s}
function dots(){$('np-dots').innerHTML=[0,1,2,3,4].map(i=>{const r=S().res[i];return '<i class="'+(r?r.s:i===S().r?'cur':'')+'"></i>'}).join('')}
function msg(t){$('np-msg').textContent=t||''}
function startRound(){const s=S();cur=(P?P.pz:PZ)[s.r];tiles=cur.nums.map(v=>({v}));hist=[];log=[];sel=-1;op='';hintR=false;giveArm=0;s.r0=s.r0!=null&&s.rr===s.r?s.r0:el();s.rr=s.r;save();
 $('np-stage').textContent=(P?'연습 · ':'')+(s.r+1)+'단계 '+LV[s.r];$('np-target').textContent=cur.t;dots();draw();msg('')}
function draw(pop){$('np-tiles').innerHTML=tiles.map((t,i)=>'<button type="button" class="np-tile'+(t.gone?' gone':'')+(i===sel?' sel':'')+(i===pop?' pop':'')+'" data-i="'+i+'">'+(t.gone?'':t.v)+'</button>').join('');
 document.querySelectorAll('.np-op').forEach(b=>b.classList.toggle('sel',b.dataset.op===op));$('np-log').innerHTML=log.map(x=>'<li>'+x+'</li>').join('')}
function live(){return tiles.map((t,i)=>t.gone?-1:i).filter(i=>i>=0)}
function tapTile(i){if(busy||!tiles[i]||tiles[i].gone)return;clearHint();
 if(sel<0||sel===i||!op){sel=sel===i?-1:i;draw();return}
 const a=tiles[sel].v,b=tiles[i].v,r=calc(a,op,b);
 if(!r){const tl=document.querySelector('.np-tile[data-i="'+i+'"]');if(tl){tl.classList.remove('bad');void tl.offsetWidth;tl.classList.add('bad')}msg(op==='÷'?'나누어떨어지지 않아요. 다른 숫자로 해 보세요':'결과가 0이 되면 안 돼요(1 이상만)');return}
 hist.push({t:tiles.map(x=>Object.assign({},x)),l:log.slice()});
 tiles[sel]={v:0,gone:1};tiles[i]={v:r};log.push(Math.max(a,b)+' '+op+' '+Math.min(a,b)+' = '+r);sel=-1;op='';msg('');draw(i);
 if(live().length===1){if(r===cur.t)solved();else{msg('아쉬워요! '+r+' 은(는) 목표 '+cur.t+'와 달라요. ↶ 되돌리기로 고쳐 보세요');$('np-tg').classList.remove('ok')}}}
function clearHint(){document.querySelectorAll('.hint').forEach(e=>e.classList.remove('hint'))}
function undo(){if(busy||!hist.length)return;const h=hist.pop();tiles=h.t;log=h.l;sel=-1;op='';msg('');draw()}
function reset(){if(busy)return;if(hist.length){hist=[hist[0]];undo()}}
function hint(){if(busy)return;clearHint();let nums=live().map(i=>tiles[i].v),M=solveAll(nums),e=M.get(cur.t);
 if(!e||live().length<2){reset();nums=live().map(i=>tiles[i].v);e=solveAll(nums).get(cur.t)}if(!e)return;
 const [a,o,b]=e.path[0],L=live(),ia=L.find(i=>tiles[i].v===a),ib=L.find(i=>i!==ia&&tiles[i].v===b);
 hintR=true;sel=-1;op='';draw();[ia,ib].forEach(i=>{const t=document.querySelector('.np-tile[data-i="'+i+'"]');if(t)t.classList.add('hint')});
 const ob=document.querySelector('.np-op[data-op="'+o+'"]');if(ob)ob.classList.add('hint');msg('💡 '+a+' '+o+' '+b+' 부터 해 보세요 (이 판은 🟨)')}
function give(){if(busy)return;const b=$('np-give');if(!giveArm){giveArm=1;b.textContent='정말 포기?';b.classList.add('warn');setTimeout(()=>{giveArm=0;b.textContent='🏳 포기';b.classList.remove('warn')},3000);return}
 giveArm=0;b.textContent='🏳 포기';b.classList.remove('warn');const e=solveAll(cur.nums).get(cur.t);log=(e?e.path:cur.path).map(([a,o,c,r])=>a+' '+o+' '+c+' = '+r);sel=-1;op='';draw();msg('풀이를 확인하고 다음 판으로 넘어가요');endRound('r',2600)}
function solved(){$('np-tg').classList.remove('ok');void $('np-tg').offsetWidth;$('np-tg').classList.add('ok');msg(hintR?'정답! (힌트 사용 🟨)':'정답! 🎉');endRound(hintR?'y':'g',900)}
function endRound(s,wait){busy=true;const st=S();st.res[st.r]={s,t:Math.round((el()-(st.r0||0))/1000)};st.r++;st.r0=el();st.rr=st.r;save();dots();
 setTimeout(()=>{busy=false;if(st.r>=5)finish();else startRound()},wait)}
function score(s){const sec=s.el/1000,base=s.res.reduce((a,r)=>a+(r.s==='g'?1000:r.s==='y'?600:0),0);return base?base+Math.max(0,Math.round((600-sec)*3)):0}
function grid(s){return [s.res.map(r=>r.s==='g'?'🟩':r.s==='y'?'🟨':'🟥').join(''),s.res.map(r=>r.s==='r'?'➖':r.t<=30?'⚡':r.t<=90?'🙂':'🐢').join('')]}
function finish(){pause();const s=S();s.done=1;s.score=score(s);save();
 if(!P&&!DBG){const st=bumpStreak();s.st=st.n;save();if(s.score>0&&window.submitScore)submitScore(s.score);else if(window.Bonus)Bonus.played(G);if(window.Bonus&&s.res.every(r=>r.s==='g'))Bonus.ach('np5')}
 result()}
function nextIn(){const n=new Date(Date.parse(KST+'T00:00:00Z')+864e5-9*3600e3)-Date.now();const h=Math.floor(n/36e5),m=Math.floor(n%36e5/6e4);return h+'시간 '+m+'분'}
function result(){const s=S(),[g1,g2]=grid(s),st=streak(),sc=s.score;$('np-board').hidden=true;$('np-msg').textContent='';const r=$('np-res');r.hidden=false;
 $('np-stage').textContent=P?'연습 결과':'오늘의 결과';$('np-time').textContent='⏱ '+fmt(s.el/1000);dots();
 r.innerHTML='<h3>'+(P?'🧩 연습 문제 완료':'🔢 '+KST.slice(5).replace('-','/')+' 숫자 퍼즐 완료')+'</h3><div class="np-grid">'+g1+'<br>'+g2+'</div>'
  +'<p><b>⏱ '+fmtK(s.el/1000)+'</b> · <b>'+sc.toLocaleString()+'점</b>'+(P?' <small>(순위 없음)</small>':'')+'</p>'
  +(P?'':'<p>🔥 '+(st.n||0)+'일 연속 · 최고 '+(st.best||0)+'일</p><p class="np-sol">다음 퍼즐까지 '+nextIn()+'</p>')
  +'<div class="row">'+(P?'<button type="button" class="y" id="np-more">🧩 한 문제 더</button><button type="button" id="np-back">오늘 결과로</button>'
  :'<button type="button" class="y" id="np-sh">💬 결과 공유</button><button type="button" id="np-rk">🏆 순위 보기</button><button type="button" id="np-pr">🧩 연습 문제 (순위 없음)</button>')+'</div>';
 if(P){$('np-more').onclick=practice;$('np-back').onclick=()=>{P=null;result()};return}
 $('np-sh').onclick=()=>shareText('5락실 오늘의 숫자 퍼즐 '+KST.slice(5).replace('-','/')+'\n'+g1+'\n'+g2+'\n⏱ '+fmtK(s.el/1000)+' · '+sc.toLocaleString()+'점'+((st.n||0)>1?' · 🔥'+st.n+'일 연속':'')+'\n나보다 빨리 풀 수 있어? '+(sc>0?challengeUrl(sc):location.origin+location.pathname));
 $('np-rk').onclick=()=>{const b=$('rankbox');if(b)b.scrollIntoView({behavior:'smooth'})};$('np-pr').onclick=practice}
function practice(){P={el:0,r:0,res:[],on:1,pz:gen('numpuzzle-p'+Date.now()+Math.random())};$('np-res').hidden=true;$('np-board').hidden=false;$('np-start').hidden=true;since=0;run();startRound()}
function begin(){D.on=1;save();$('np-start').hidden=true;run();startRound()}
// 조작
$('np-tiles').addEventListener('click',e=>{const b=e.target.closest('.np-tile');if(b)tapTile(+b.dataset.i)});
document.querySelectorAll('.np-op').forEach(b=>b.onclick=()=>{if(busy)return;clearHint();op=op===b.dataset.op?'':b.dataset.op;if(sel<0)msg('먼저 숫자 하나를 누르세요');draw()});
$('np-undo').onclick=undo;$('np-reset').onclick=reset;$('np-hint').onclick=hint;$('np-give').onclick=give;$('np-go').onclick=begin;
addEventListener('keydown',e=>{if(!S().on||S().done||$('np-play').hidden||/INPUT|TEXTAREA/.test((e.target||{}).tagName||''))return;const k={'+':'+','-':'−','*':'×','x':'×','/':'÷'}[e.key];
 if(k){op=k;draw();e.preventDefault()}else if(e.key==='Backspace'){undo();e.preventDefault()}else if(/^[1-4]$/.test(e.key)){const L=live(),i=L[+e.key-1];if(i!=null)tapTile(i)}});
// 미니 상점: 이 게임 타일 테마. 코인은 5락실 전체 공통(Bonus), 꾸미기만(점수·난이도 영향 없음)
const TH=(typeof THEMES!=='undefined'?THEMES:[]).filter(t=>t.g===G);
function applyTheme(){const id=window.Bonus?Bonus.theme(G):'base';root.className='np'+(id!=='base'?' np-t-'+id:'')}
let ask='';
function shop(){const sh=$('np-shop');if(!window.Bonus){sh.innerHTML='<p class="muted">상점을 불러오지 못했어요.</p>';return}const st=Bonus.state(),cu=Bonus.theme(G);$('np-coin').textContent='🪙'+st.coins;
 const pv=()=>'<span class="pv"><span>7</span><span>×</span><span>3</span></span>';
 const it=(id,ic,nm,p)=>{const own=p<=0||!!(st.own||{})['h:'+G+':'+id],now=cu===id;
  return '<div class="it'+(now?' sel':'')+'"><div class="np'+(id!=='base'?' np-t-'+id:'')+'" style="margin:0;padding:0;border:0;box-shadow:none;background:none">'+pv(id)+'</div><div><b>'+ic+' '+nm+'</b><br><small>'+(own?'가지고 있어요':'🪙 '+p)+'</small></div>'
  +'<button type="button" data-id="'+id+'" class="'+(now?'now':ask===id?'ask':own?'use':'')+'">'+(now?'사용 중':own?'쓰기':ask===id?'🪙'+p+' 사기 확인':'🪙 '+p)+'</button></div>'};
 sh.innerHTML='<p style="margin:0 0 8px"><b>🎨 숫자 퍼즐 타일 테마</b> · 내 코인 <b style="color:#ffd23f">🪙 '+st.coins+'</b></p><p class="muted" style="margin:0 0 10px;font-size:13px">보는 모양만 바뀌고 문제·점수는 같아요. 코인은 5락실 모든 게임 공통이고 출석·미션으로 모여요(<a href="/bonus">출석·미션 →</a>).</p>'
  +it('base','🌃','기본 네온',0)+TH.map(t=>it(t.id,t.icon,t.name,t.p)).join('');
 sh.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>{const id=b.dataset.id,t=TH.find(x=>x.id===id),own=id==='base'||!!(Bonus.state().own||{})['h:'+G+':'+id];
  if(Bonus.theme(G)===id)return;if(!own&&ask!==id){ask=id;shop();setTimeout(()=>{if(ask===id){ask='';shop()}},4000);return}ask='';
  if(Bonus.setTheme(G,id)){applyTheme();if(window.Bonus.toast&&own)Bonus.toast('타일 테마를 바꿨어요!')}shop()})}
document.querySelectorAll('.np-tabs button').forEach(b=>b.onclick=()=>{const s=b.dataset.tab==='shop';document.querySelectorAll('.np-tabs button').forEach(x=>x.classList.toggle('on',x===b));$('np-play').hidden=s;$('np-shop').hidden=!s;if(s){pause();shop()}else run()});
applyTheme();try{$('np-coin').textContent=window.Bonus?'🪙'+Bonus.coins():''}catch(e){}
// 시작 화면/이어 하기
const st0=streak();$('np-sday').innerHTML='<b>'+KST.slice(5).replace('-','월 ')+'일 숫자 퍼즐</b>';$('np-streak').textContent=st0.n?'🔥 '+st0.n+'일 연속 중 · 오늘도 이어 가요!':'매일 풀면 🔥 연속 기록이 쌓여요';
if(D.done){$('np-start').hidden=true;result()}else if(D.on){$('np-start').hidden=true;if(D.r>=5)finish();else{run();startRound()}}else{dots();$('np-target').textContent='?';$('np-tiles').innerHTML='<button class="np-tile" type="button">?</button>'.repeat(4)}
// 테스트용: 주소 끝 #npdebug → window.__np (순위 제출 안 함)
if(DBG)window.__np={gen,solveAll,pz:()=>PZ,state:()=>S(),tap:tapTile,op:o=>{op=o;draw()},practice};
})();
