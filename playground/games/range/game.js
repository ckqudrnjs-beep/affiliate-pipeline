(function(){
const $=id=>document.getElementById(id);let game=null,loading=false;
const SRC='/js/range.js';
function pre(){if(document.querySelector('link[data-rg]'))return;const l=document.createElement('link');l.rel='modulepreload';l.href=SRC;l.dataset.rg='1';document.head.appendChild(l)}
if('requestIdleCallback' in window)requestIdleCallback(pre,{timeout:3000});else setTimeout(pre,1500);
function webgl(){try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return false}}
const IOS=/iP(hone|od)/.test(navigator.userAgent),COARSE=matchMedia('(pointer: coarse)').matches;
if(IOS){[['apple-mobile-web-app-capable','yes'],['mobile-web-app-capable','yes'],['apple-mobile-web-app-status-bar-style','black-translucent'],['apple-mobile-web-app-title','5락실 사격장']].forEach(([n,c])=>{const m=document.createElement('meta');m.name=n;m.content=c;document.head.appendChild(m)})}
function full(){if(!COARSE)return;const el=document.documentElement;try{if(el.requestFullscreen&&!document.fullscreenElement)el.requestFullscreen({navigationUI:'hide'}).then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}).catch(()=>{});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen()}catch(e){}}
async function go(){
 full();
 if(game){game.open();return}
 if(loading)return;
 if(!webgl()){$('rg-msg').textContent='이 브라우저는 3D 그래픽(WebGL)을 지원하지 않아요. 크롬·사파리 최신 버전에서 열어 주세요.';return}
 loading=true;$('rg-go').textContent='불러오는 중…';
 try{const m=await import(SRC);
  game=m.boot({ios:IOS&&!navigator.standalone,rngFactory:n=>seeded('range'+KST+'#'+n),
   submit:s=>{if(window.submitScore)submitScore(s)},
   share:(s,r)=>shareText('5락실 네온 사격장 '+KST.slice(5)+'\n🎯 STAGE '+r.stage+' · '+s.toLocaleString()+'점 (명중률 '+r.acc+'%) 이겨 볼래?\n'+challengeUrl(s)),
   onExit:r=>{$('rg-go').textContent=r?'▶ 다시 도전':'▶ 사격 시작';if(r)$('rg-msg').textContent='방금 기록: STAGE '+r.stage+' · '+r.score.toLocaleString()+'점 · 명중률 '+r.acc+'%';const b=document.getElementById('rankbox');if(r&&b)b.scrollIntoView({behavior:'smooth',block:'center'})}});
 }catch(e){$('rg-msg').textContent='게임을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.'}
 loading=false;$('rg-go').textContent='▶ 사격 시작'}
$('rg-go').onclick=go;
})();
