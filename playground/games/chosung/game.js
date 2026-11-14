const CH='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';const cho=w=>[...w].map(c=>{const k=c.charCodeAt(0)-44032;return k>=0&&k<11172?CH[Math.floor(k/588)]:c}).join('');
const now=new Date(Date.now()+9*3600e3);const key=now.toISOString().slice(0,10);let seed=+key.replace(/-/g,'');
const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const cats=Object.keys(WORDS);const set=[];const used=new Set();while(set.length<5){const c=cats[Math.floor(rnd()*cats.length)];const w=WORDS[c][Math.floor(rnd()*WORDS[c].length)];if(!used.has(w)){used.add(w);set.push([c,w])}}
const $=id=>document.getElementById(id);$('day').textContent=key.slice(5).replace('-','월 ')+'일 문제 · 모두 같은 문제를 풀어요';
// 2026-11-14 디자인 개편: 초성 타일·정답 공개 뒤집기·꽃가루·효과음(웹오디오). 문제·채점 규칙은 그대로.
let A=null;const ac=()=>{if(!A){const C=window.AudioContext||window.webkitAudioContext;if(C)try{A=new C()}catch(e){}}if(A&&A.state==='suspended')A.resume()};
const tone=(f,d,a,t,dl)=>{if(!A)return;const s=A.currentTime+(dl||0),o=A.createOscillator(),g=A.createGain();o.type=t||'triangle';o.frequency.value=f;g.gain.setValueAtTime(0,s);g.gain.linearRampToValueAtTime(a,s+.005);g.gain.exponentialRampToValueAtTime(.0005,s+d);o.connect(g);g.connect(A.destination);o.start(s);o.stop(s+d+.02)};
let i=0,res=[],busy=false;const SK='bn_cho_'+key;try{const s=JSON.parse(localStorage.getItem(SK)||'null');if(s){res=s;i=5}}catch(e){}
function dots(){[...$('dots').children].forEach((d,k)=>d.className=k<res.length?(res[k]?'ok':'no'):k===i?'on':'')}
function tiles(str,cls){$('cho').innerHTML=[...str].filter(c=>c!==' ').map((c,k)=>'<span class="qz-t '+(cls||'')+'" style="animation-delay:'+k*.07+'s">'+c+'</span>').join('')}
function show(){busy=false;if(i>=5){finish();return}dots();$('prog').textContent=(i+1)+' / 5';$('hint').textContent='주제 · '+set[i][0];tiles(cho(set[i][1]));$('ans').value='';$('msg').textContent='';$('msg').className='qz-msg';try{$('ans').focus({preventScroll:true})}catch(e){}}
function confetti(){const q=$('qz'),C=['#ffd23f','#3ddc84','#22d3ee','#ff3d9a','#b06bff'];for(let k=0;k<26;k++){const e=document.createElement('i');e.className='qz-cf';e.style.background=C[k%5];e.style.setProperty('--dx',(Math.random()*320-160)+'px');e.style.setProperty('--dy',(Math.random()*-180-20)+'px');e.style.setProperty('--r',(Math.random()*720-360)+'deg');q.appendChild(e);setTimeout(()=>e.remove(),1000)}}
function answer(skip){if(busy||i>=5)return;ac();busy=true;const v=$('ans').value.replace(/\s/g,'');const ok=!skip&&v===set[i][1];res.push(ok?1:0);
 tiles(set[i][1],(ok?'ok':'no')+' flip');$('msg').textContent=(ok?'정답! ':'아쉬워요. 정답은 ')+(ok?'🎉':set[i][1]);$('msg').className='qz-msg '+(ok?'ok':'no');
 if(ok){[659,784,1047].forEach((f,k)=>tone(f,.18,.12,'triangle',k*.07));confetti()}else{tone(196,.3,.12,'sawtooth');$('qz').classList.remove('shake');void $('qz').offsetWidth;$('qz').classList.add('shake')}
 i++;dots();try{if(i>=5)localStorage.setItem(SK,JSON.stringify(res))}catch(e){};setTimeout(show,1300)}
function finish(){if(window.Bonus)Bonus.played('chosung');$('end').hidden=false;$('qz').hidden=true;const n=res.reduce((a,b)=>a+b,0);
 $('res').textContent=res.map(x=>x?'🟩':'🟥').join('')+' '+n+'/5';$('em').innerHTML=res.map((x,k)=>'<span style="animation-delay:'+k*.12+'s">'+(x?'🟩':'🟥')+'</span>').join('');
 $('sc').textContent=n+' / 5';$('tier').textContent=['다음엔 꼭! 내일 다시 도전','몸풀기 완료','절반은 넘겼다','초성 고수','거의 다 맞혔어요','🏆 오늘의 초성 왕'][n];if(n>=4&&A){[523,659,784,1047,1319].forEach((f,k)=>tone(f,.25,.12,'triangle',k*.08))}}
$('ok').onclick=()=>answer(false);$('skip').onclick=()=>answer(true);$('ans').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)answer(false)};
$('sh').onclick=()=>{const t='5락실 초성 퀴즈 '+key.slice(5)+'\n'+$('res').textContent+'\n'+location.href;shareText(t)};show();
