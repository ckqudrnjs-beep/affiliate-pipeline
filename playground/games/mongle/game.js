(function(){
const $=id=>document.getElementById(id);let game=null,loading=null;
const js=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)});
function load(){if(window.MongleGame)return Promise.resolve();if(loading)return loading;loading=js('/js/mongle-art.js').then(()=>js('/js/mongle.js')).catch(e=>{loading=null;throw e});return loading}
function boot(){if(game)return game;game=MongleGame.boot({bonus:window.Bonus,onExit:r=>{$('mg-go').textContent='▶ 아지트 다시 열기';if(window.Bonus)Bonus.render();if(r)$('mg-msg').textContent='몽글이 Lv.'+r.lv+' '+r.stage+(r.walk?' · 지금 산책 중':'')}});return game}
async function go(){
 if(!game){$('mg-go').textContent='불러오는 중…';try{await load()}catch(e){$('mg-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.';$('mg-go').textContent='▶ 아지트 열기';return}boot()}game.open()}
$('mg-cab').onclick=go;
})();
