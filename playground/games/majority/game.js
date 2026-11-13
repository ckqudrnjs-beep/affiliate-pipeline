const $=id=>document.getElementById(id);let qs=[],i=0,score=0;
async function init(){let c={};try{c=await (await fetch('/api/vote?ids='+POOL.map(q=>q.id).join(','))).json()}catch(e){}
qs=POOL.filter(q=>c[q.id]&&(c[q.id].a+c[q.id].b)>=20).map(q=>Object.assign({},q,c[q.id])).slice(0,10);
if(!qs.length){$('prog').textContent='아직 표가 충분히 모인 질문이 없어요. 오늘의 질문에 먼저 투표해 주세요!';$('ba').parentNode.hidden=true;return}show()}
function show(){if(i>=qs.length){$('box').hidden=true;$('end').hidden=false;$('res').textContent=score+' / '+qs.length+' 정답';return}const q=qs[i];$('prog').textContent=(i+1)+' / '+qs.length;$('ba').textContent=q.a;$('bb').textContent=q.b}
function pick(o){const q=qs[i],t=q.a+q.b,pa=Math.round(q.a/t*100);const win=q.a===q.b?o:(q.a>q.b?'a':'b');const ok=o===win;if(ok)score++;
$('msg').textContent=(ok?'정답! ':'땡! ')+'('+pa+'% : '+(100-pa)+'%)';i++;setTimeout(show,900)}
$('ba').onclick=()=>pick('a');$('bb').onclick=()=>pick('b');
$('sh').onclick=()=>{const t='5락실 다수결 맞히기 '+$('res').textContent+'\n'+location.href;shareText(t)};init();
