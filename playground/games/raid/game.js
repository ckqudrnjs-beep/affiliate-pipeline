(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.RaidGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/raid.js';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=RaidGame.boot({day:KST,bonus:window.Bonus,
 submit:s=>{if(window.submitScore)submitScore(s)},
 share:(s,r)=>shareText('5락실 네온 레이드 '+KST.slice(5)+'\n⚔️ '+(r.clear?'균열 정리 완료! ':'')+'방 평가 '+(r.ranks||'-')+' · 최대 '+r.combo+'콤보 · '+s.toLocaleString()+'점 이겨 볼래?\n'+challengeUrl(s)),
 onExit:(r,why)=>{$('nr-go').textContent=r?'▶ 다시 출발':'▶ 게임 시작';if(window.Bonus)Bonus.render();
  if(r){const t=Math.floor(r.time/60)+':'+String(Math.floor(r.time%60)).padStart(2,'0');$('nr-msg').textContent='방금 기록: '+(r.clear?'🎉 클리어 · ':'')+t+' · '+r.score.toLocaleString()+'점'}
  const b=r&&$('rankbox');if(b)b.scrollIntoView({behavior:'smooth',block:'center'})}});return game}
const pre=()=>load().catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(pre,{timeout:3000});else setTimeout(pre,1500);
async function go(){
 if(!game){$('nr-go').textContent='불러오는 중…';try{await load()}catch(e){$('nr-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('nr-go').textContent='▶ 게임 시작';return}boot()}game.open()}
$('nr-cab').onclick=go;
})();
