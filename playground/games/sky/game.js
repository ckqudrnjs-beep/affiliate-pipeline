(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
function load(){if(window.SkyGame)return Promise.resolve();if(loading)return loading;loading=new Promise((ok,no)=>{const s=document.createElement('script');s.src='/js/sky.js?v=1';s.onload=ok;s.onerror=()=>{loading=null;no()};document.head.appendChild(s)});return loading}
function boot(){if(game)return game;game=SkyGame.boot({bonus:window.Bonus,onExit:r=>{$('sk-go').textContent='▶ 이어하기';if(window.Bonus)Bonus.render();if(r)$('sk-msg').textContent='저장됨: '+(r.cls==='warden'?'방패지기':'바람술사')+' '+r.lv+'레벨'}});return game}
// 테스터 전용 맛보기판(BK 11/14): 공통 /js/tester.js
function tl(){if(window.nrTester)return Promise.resolve();return new Promise(ok=>{const s=document.createElement('script');s.src='/js/tester.js';s.onload=ok;s.onerror=ok;document.head.appendChild(s)})}
async function isTester(){await tl();return window.nrTester?window.nrTester():false}
async function go(){if(!(await isTester())){$('sk-msg').innerHTML=window.nrTesterMsg;return}
 if(!game){$('sk-go').textContent='불러오는 중…';try{await load()}catch(e){$('sk-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('sk-go').textContent='▶ 게임 시작';return}boot()}game.open()}
$('sk-cab').onclick=go;
})();
