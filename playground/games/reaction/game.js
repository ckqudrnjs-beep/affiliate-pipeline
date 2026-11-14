const pad=document.getElementById('pad'),log=document.getElementById('log'),sh=document.getElementById('sh');let st='idle',t0=0,tm=0,rs=[];
const set=(bg,txt)=>{pad.style.background=bg;pad.style.color=bg?'#fff':'';pad.textContent=txt};
function arm(){st='wait';set('#e5484d','초록색이 되면 누르세요…');tm=setTimeout(()=>{st='go';t0=performance.now();set('#30a46c','지금!')},1200+Math.random()*2500)}
pad.onpointerdown=()=>{if(st==='idle'||st==='done'){if(st==='done')rs=[];arm();return}
if(st==='wait'){clearTimeout(tm);st='idle';set('','너무 빨라요! 다시 누르세요');return}
if(st==='go'){const ms=Math.round(performance.now()-t0);rs.push(ms);log.textContent=rs.map((x,i)=>(i+1)+'회 '+x+'ms').join(' · ');
if(rs.length>=5){const avg=Math.round(rs.reduce((a,b)=>a+b)/5);st='done';if(window.Bonus)Bonus.played('reaction');set('','평균 '+avg+'ms · 최고 '+Math.min(...rs)+'ms (다시 하려면 누르기)');sh.hidden=false;sh.dataset.r=avg}else{st='idle';set('',ms+'ms! 눌러서 다음')}}};
sh.onclick=()=>{const t='5락실 반응속도 평균 '+sh.dataset.r+'ms, 너는 몇 ms?\n'+location.href;shareText(t)};
