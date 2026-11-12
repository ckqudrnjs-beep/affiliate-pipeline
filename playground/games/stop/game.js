(function(){
const $=id=>document.getElementById(id);let R,lv,score,pos,dir,speed,zw,zx,run=false,over=true,last;
function setZone(){zw=Math.max(5,26-lv*1.6);zx=5+R()*(90-zw);$('st-zone').style.left=zx+'%';$('st-zone').style.width=zw+'%';speed=38+lv*7;$('st-lv').textContent=(lv+1)+'단계'}
function start(){R=seeded('stop'+KST);lv=0;score=0;pos=0;dir=1;over=false;setZone();run=true;last=performance.now();$('st-txt').textContent='초록 칸에서 누르세요!';$('st-score').textContent='0점';requestAnimationFrame(loop)}
function loop(now){if(!run)return;const dt=(now-last)/1000;last=now;pos+=dir*speed*dt;if(pos>99){pos=99;dir=-1}if(pos<0){pos=0;dir=1}$('st-bar').style.left='calc('+pos+'% - 3px)';requestAnimationFrame(loop)}
function hit(){if(over){start();return}const c=zx+zw/2;if(pos>=zx&&pos<=zx+zw){const p=Math.round(100-Math.abs(pos-c)/(zw/2)*60);score+=p;lv++;$('st-score').textContent=score+'점';$('st-txt').textContent=(p>=90?'완벽! ':'성공 ')+'+'+p;setZone()}
 else{run=false;over=true;$('st-txt').innerHTML='아쉽다! '+score+'점 · 다시 하려면 누르기';const b=document.createElement('button');b.className='share';b.type='button';b.textContent='결과 공유';b.onclick=e=>{e.stopPropagation();shareText('5락실 딱 멈춰! '+KST.slice(5)+'\n🎯 '+lv+'단계 '+score+'점. 이겨 볼래?\n'+challengeUrl(score))};$('st-lv').textContent='';$('st-lv').appendChild(b);if(window.submitScore)submitScore(score)}}
$('st').addEventListener('pointerdown',hit);addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();hit()}});
})();
