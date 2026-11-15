(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.SkyGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/sky.js';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=SkyGame.boot({bonus:window.Bonus,onExit:r=>{$('sk-go').textContent='▶ 이어하기';if(window.Bonus)Bonus.render();if(r)$('sk-msg').textContent='저장됨: '+({warden:'방패지기',drifter:'떠돌이 검객',windcaller:'바람술사',trapper:'덫사냥꾼',ringer:'종지기'}[r.cls]||'')+' '+r.lv+'레벨'}});return game}
// 2026-11-15 BK: 테스터 잠금 풀고 베타 공개(게임 안 「의견 보내기」로 피드백)
async function go(){
 if(!game){$('sk-go').textContent='불러오는 중…';try{await load()}catch(e){$('sk-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('sk-go').textContent='▶ 게임 시작';return}boot()}game.open()}
$('sk-cab').onclick=go;
})();
