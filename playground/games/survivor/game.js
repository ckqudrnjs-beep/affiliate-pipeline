(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.SurvivorGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/survivor.js';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=SurvivorGame.boot({day:KST,bonus:window.Bonus,rng:k=>seeded('survivor'+KST+'#'+k),
 submit:s=>{if(window.submitScore)submitScore(s)},
 share:(s,r)=>shareText('5락실 네온 생존자 '+KST.slice(5)+'\n🧿 '+(r.clear?'3분 생존 성공! ':'')+Math.floor(r.time/60)+'분 '+Math.floor(r.time%60)+'초 · Lv.'+r.lv+' · '+s.toLocaleString()+'점 이겨 볼래?\n'+challengeUrl(s)),
 onExit:(r,why)=>{$('sv-go').textContent=r?'▶ 다시 도전':'▶ 생존 시작';if(window.Bonus)Bonus.render();
  if(r){const t=Math.floor(r.time/60)+':'+String(Math.floor(r.time%60)).padStart(2,'0');$('sv-msg').textContent='방금 기록: '+t+' 버팀 · Lv.'+r.lv+' · '+r.score.toLocaleString()+'점'+(r.clear?' · 🎉 3분 생존 성공':'')}
  const gs=$('gshop');if(why==='shop'&&gs)gs.open=true;const b=why==='shop'?(gs||$('sv-shop')):r&&$('rankbox');if(b)b.scrollIntoView({behavior:'smooth',block:'center'})}});return game}
const pre=()=>load().then(boot).catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(pre,{timeout:2500});else setTimeout(pre,1200);
async function go(){if(!game){$('sv-go').textContent='불러오는 중…';try{await load()}catch(e){$('sv-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('sv-go').textContent='▶ 생존 시작';return}boot()}game.open()}
// 화면 어디를 눌러도 시작(작은 아이폰에서 버튼이 가려져도 됨)
$('sv-cab').onclick=go;
})();
