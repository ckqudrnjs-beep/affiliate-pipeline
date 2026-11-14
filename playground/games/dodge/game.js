(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.DodgeGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/dodge.js';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=DodgeGame.boot({day:KST,bonus:window.Bonus,rng:()=>seeded('dodge'+KST),
 submit:s=>{if(window.submitScore)submitScore(s)},
 share:(s,r)=>shareText('5락실 별똥별 피하기 '+KST.slice(5)+'\n🌠 '+s+'점 버텼어요'+(r&&r.stars?' (★'+r.stars+')':'')+'. 이겨 볼래?\n'+challengeUrl(s)),
 onExit:(r,why)=>{$('dg-go').textContent=r?'▶ 다시 도전':'▶ 피하기 시작';if(window.Bonus)Bonus.render();
  if(r){const t=Math.floor(r.time/60)+':'+String(Math.floor(r.time%60)).padStart(2,'0');$('dg-msg').textContent='방금 기록: '+r.score.toLocaleString()+'점 · '+t+' 버팀 · 별 '+r.stars+'개'}
  const gs=$('gshop');if(why==='shop'&&gs)gs.open=true;const b=why==='shop'?gs:r&&$('rankbox');if(b)b.scrollIntoView({behavior:'smooth',block:'center'})}});return game}
const pre=()=>load().then(boot).catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(pre,{timeout:2500});else setTimeout(pre,1200);
async function go(){if(!game){$('dg-go').textContent='불러오는 중…';try{await load()}catch(e){$('dg-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('dg-go').textContent='▶ 피하기 시작';return}boot()}game.open()}
$('dg-cab').onclick=go;
})();
