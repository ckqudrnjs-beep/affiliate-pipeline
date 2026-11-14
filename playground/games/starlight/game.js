(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.StarlightGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/starlight.js';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=StarlightGame.boot({day:KST,bonus:window.Bonus,skin:()=>window.Bonus&&Bonus.skin(),design:()=>window.Bonus&&Bonus.design('starlight'),theme:()=>window.Bonus&&Bonus.theme('starlight'),trail:()=>window.Bonus&&Bonus.trail(),sound:()=>window.Bonus&&Bonus.sound(),rng:n=>seeded('starlight'+KST+'#'+n),
 submit:s=>{if(window.submitScore)submitScore(s)},
 share:(s,r)=>shareText('5락실 별빛 요격대 '+KST.slice(5)+'\n🚀 STAGE '+r.stage+' · '+s.toLocaleString()+'점 (명중률 '+r.acc+'%) 이겨 볼래?\n'+challengeUrl(s)),
 onExit:r=>{$('sl-go').textContent=r?'▶ 다시 출격':'▶ 출격하기';if(r){$('sl-msg').textContent='방금 기록: STAGE '+r.stage+' · '+r.score.toLocaleString()+'점 · 명중률 '+r.acc+'%';if(window.Bonus)Bonus.render();const b=$('rankbox');if(b)b.scrollIntoView({behavior:'smooth',block:'center'})}}});return game}
// 미리 불러와서 스프라이트까지 준비해 둔다(누르는 순간 바로 시작)
const pre=()=>load().then(boot).catch(()=>{});if('requestIdleCallback' in window)requestIdleCallback(pre,{timeout:2500});else setTimeout(pre,1200);
$('sl-go').onclick=async()=>{if(!game){$('sl-go').textContent='불러오는 중…';try{await load()}catch(e){$('sl-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('sl-go').textContent='▶ 출격하기';return}boot()}game.open()};
})();
