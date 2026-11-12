(function(){
const c=document.getElementById('dg'),x=c.getContext('2d'),$=id=>document.getElementById(id);let W,H,dpr;
function size(){dpr=window.devicePixelRatio||1;W=c.clientWidth;H=Math.min(480,Math.round(W*1.2));c.width=W*dpr;c.height=H*dpr;c.style.height=H+'px';x.setTransform(dpr,0,0,dpr,0,0)}size();
let run=false,px,keys={},drag=null,rocks,bon,R,t,score,last,spawn,bspawn;
function reset(){R=seeded('dodge'+KST);px=W/2;rocks=[];bon=[];t=0;score=0;spawn=0;bspawn=3;}
function frame(now){if(!run)return;const dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
 const sp=H*(.45+t/40);if(keys.ArrowLeft)px-=W*1.1*dt;if(keys.ArrowRight)px+=W*1.1*dt;if(drag!==null)px+=(drag-px)*Math.min(1,dt*14);px=Math.max(14,Math.min(W-14,px));
 spawn-=dt;if(spawn<=0){spawn=Math.max(.18,.7-t/60);rocks.push({x:R()*W,y:-20,r:6+R()*10,v:sp*(.8+R()*.6)})}
 bspawn-=dt;if(bspawn<=0){bspawn=4+R()*3;bon.push({x:20+R()*(W-40),y:-20,v:sp*.7})}
 const py=H-30;x.clearRect(0,0,W,H);x.fillStyle='#ffffff55';for(let i=0;i<30;i++){const sx=(i*97)%W,sy=(i*53+t*20)%H;x.fillRect(sx,sy,1.5,1.5)}
 rocks.forEach(r=>r.y+=r.v*dt);
 rocks=rocks.filter(r=>r.y<H+30);bon.forEach(b=>b.y+=b.v*dt);
 for(const r of rocks){x.fillStyle='#ff8a65';x.beginPath();x.arc(r.x,r.y,r.r,0,7);x.fill();x.fillStyle='#ff8a6544';x.beginPath();x.arc(r.x,r.y-r.r*1.6,r.r*.7,0,7);x.fill();if(Math.hypot(r.x-px,r.y-py)<r.r+11){end();return}}
 bon=bon.filter(b=>{if(Math.hypot(b.x-px,b.y-py)<22){score+=50;return false}x.fillStyle='#ffd23f';x.font='20px sans-serif';x.textAlign='center';x.fillText('★',b.x,b.y+7);return b.y<H+20});
 x.fillStyle='#7fd1ff';x.beginPath();x.arc(px,py,11,0,7);x.fill();x.fillStyle='#fff';x.beginPath();x.arc(px,py-3,4,0,7);x.fill();
 score+=dt*10;$('dg-score').textContent=Math.floor(score)+'점';requestAnimationFrame(frame)}
function start(){size();reset();run=true;last=performance.now();$('dg-start').hidden=true;$('dg-msg').textContent='';requestAnimationFrame(frame)}
function end(){run=false;const s=Math.floor(score);$('dg-start').hidden=false;$('dg-start').textContent='다시 하기';$('dg-msg').innerHTML='끝! '+s+'점 · <button class="share" type="button" id="dg-sh">결과 공유</button>';
 $('dg-sh').onclick=()=>shareText('노리터 별똥별 피하기 '+KST.slice(5)+'\n🌠 '+s+'점 버텼어요. 너는?\n'+location.href);if(window.submitScore)submitScore(s)}
$('dg-start').onclick=start;addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')&&run)e.preventDefault();keys[e.key]=1});addEventListener('keyup',e=>keys[e.key]=0);
const pos=e=>{const b=c.getBoundingClientRect();return e.clientX-b.left};c.addEventListener('pointerdown',e=>{drag=pos(e);c.setPointerCapture(e.pointerId)});c.addEventListener('pointermove',e=>{if(drag!==null)drag=pos(e)});c.addEventListener('pointerup',()=>drag=null);
reset();x.fillStyle='#fff';x.font='16px sans-serif';x.textAlign='center';x.fillText('시작 버튼을 누르세요',W/2,H/2);
})();
