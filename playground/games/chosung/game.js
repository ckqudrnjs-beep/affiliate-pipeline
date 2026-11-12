const CH='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';const cho=w=>[...w].map(c=>{const k=c.charCodeAt(0)-44032;return k>=0&&k<11172?CH[Math.floor(k/588)]:c}).join('');
const now=new Date(Date.now()+9*3600e3);const key=now.toISOString().slice(0,10);let seed=+key.replace(/-/g,'');
const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
const cats=Object.keys(WORDS);const set=[];const used=new Set();while(set.length<5){const c=cats[Math.floor(rnd()*cats.length)];const w=WORDS[c][Math.floor(rnd()*WORDS[c].length)];if(!used.has(w)){used.add(w);set.push([c,w])}}
const $=id=>document.getElementById(id);$('day').textContent=key.slice(5).replace('-','월 ')+'일 문제 · 모두 같은 문제를 풀어요';
let i=0,res=[];const SK='bn_cho_'+key;try{const s=JSON.parse(localStorage.getItem(SK)||'null');if(s){res=s;i=5}}catch(e){}
function show(){if(i>=5){finish();return}$('prog').textContent=(i+1)+' / 5';$('hint').textContent='주제: '+set[i][0];$('cho').textContent=cho(set[i][1]);$('ans').value='';$('ans').focus()}
function answer(skip){const v=$('ans').value.replace(/\s/g,'');const ok=!skip&&v===set[i][1];res.push(ok?1:0);$('msg').textContent=(ok?'정답! ':'아쉬워요. ')+'정답은 '+set[i][1];i++;try{if(i>=5)localStorage.setItem(SK,JSON.stringify(res))}catch(e){};show()}
function finish(){$('end').hidden=false;document.querySelector('.card').hidden=true;$('res').textContent=res.map(x=>x?'🟩':'🟥').join('')+' '+res.reduce((a,b)=>a+b,0)+'/5'}
$('ok').onclick=()=>answer(false);$('skip').onclick=()=>answer(true);$('ans').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing)answer(false)};
$('sh').onclick=()=>{const t='5락실 초성 퀴즈 '+key.slice(5)+'\n'+$('res').textContent+'\n'+location.href;if(navigator.share)navigator.share({text:t}).catch(()=>{});else{navigator.clipboard&&navigator.clipboard.writeText(t);$('sh').textContent='복사됨'}};show();
