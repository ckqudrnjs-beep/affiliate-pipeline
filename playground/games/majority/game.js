// 투표 수는 na/nb 에 둔다(예전엔 선택지 글자 a/b 를 숫자로 덮어써서 버튼에 숫자가 보였음, 2026-11-14 수정)
const $=id=>document.getElementById(id);let qs=[],i=0,score=0,busy=false;
// 2026-11-14 디자인 개편: 분홍·하늘 카드 대결, 비율 막대 차오름·왕관·효과음. 문제·채점 규칙은 그대로.
let A=null;const ac=()=>{if(!A){const C=window.AudioContext||window.webkitAudioContext;if(C)try{A=new C()}catch(e){}}if(A&&A.state==='suspended')A.resume()};
const tone=(f,d,a,t,dl)=>{if(!A)return;const s=A.currentTime+(dl||0),o=A.createOscillator(),g=A.createGain();o.type=t||'triangle';o.frequency.value=f;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(a,s+.005);g.gain.exponentialRampToValueAtTime(.0005,s+d);o.connect(g);g.connect(A.destination);o.start(s);o.stop(s+d+.02)};
const card=(el,txt)=>{el.className=el.className.replace(/ (win|pick|dim)/g,'');el.innerHTML='<span class="fill"></span><span class="cr">👑</span><span style="position:relative">'+txt.replace(/[<>&]/g,'')+'</span><span class="pc"></span>'};
async function init(){let c={};try{c=await (await fetch('/api/vote?ids='+POOL.map(q=>q.id).join(','))).json()}catch(e){}
qs=POOL.filter(q=>c[q.id]&&(c[q.id].a+c[q.id].b)>=20).map(q=>Object.assign({},q,{na:c[q.id].a,nb:c[q.id].b})).slice(0,10);
if(!qs.length){$('prog').textContent='아직 표가 충분히 모인 질문이 없어요. 오늘의 질문에 먼저 투표해 주세요!';$('ba').parentNode.hidden=true;document.querySelector('.mj-q').hidden=true;return}show()}
function show(){busy=false;if(i>=qs.length){if(window.Bonus)Bonus.played('majority');$('box').hidden=true;$('end').hidden=false;$('res').textContent=score+' / '+qs.length+' 정답';$('big').textContent=score+' / '+qs.length;
 const r=score/qs.length;$('tier').textContent=r>=.9?'🏆 민심 읽는 달인':r>=.7?'눈치 백단':r>=.5?'반반 무난':'나만의 길을 가는 편';if(r>=.7)[523,659,784,1047].forEach((f,k)=>tone(f,.22,.12,'triangle',k*.08));return}
 const q=qs[i];$('prog').textContent=(i+1)+' / '+qs.length;$('scr').textContent='정답 '+score;card($('ba'),q.a);card($('bb'),q.b);$('msg').textContent='';$('msg').className='mj-msg'}
function pick(o){if(busy)return;busy=true;ac();const q=qs[i],t=q.na+q.nb,pa=Math.round(q.na/t*100);const win=q.na===q.nb?o:(q.na>q.nb?'a':'b');const ok=o===win;if(ok)score++;
 const A_=$('ba'),B_=$('bb');(o==='a'?A_:B_).classList.add('pick');(win==='a'?A_:B_).classList.add('win');(win==='a'?B_:A_).classList.add('dim');
 [[A_,pa],[B_,100-pa]].forEach(([el,v])=>{el.querySelector('.fill').style.height=v+'%';const pc=el.querySelector('.pc');pc.style.opacity=1;let n=0;const st=setInterval(()=>{n=Math.min(v,n+Math.ceil(v/12));pc.textContent=n+'%';if(n>=v)clearInterval(st)},40)});
 $('msg').textContent=ok?'정답! 사람들 마음을 읽었어요':'땡! 사람들은 반대쪽';$('msg').className='mj-msg '+(ok?'ok':'no');$('scr').textContent='정답 '+score;
 if(ok)[784,1047].forEach((f,k)=>tone(f,.18,.12,'triangle',k*.07));else tone(196,.3,.12,'sawtooth');i++;setTimeout(show,1700)}
$('ba').onclick=()=>pick('a');$('bb').onclick=()=>pick('b');
$('sh').onclick=()=>{const t='5락실 다수결 맞히기 '+$('res').textContent+'\n'+location.href;shareText(t)};init();
