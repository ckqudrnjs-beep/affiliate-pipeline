(function(){
const R=seeded('spot'+KST);const ri=(a,b)=>a+Math.floor(R()*(b-a+1));const pick=a=>a[Math.floor(R()*a.length)];
const COL=['#e5484d','#f76b15','#ffc53d','#46a758','#0090ff','#8e4ec6','#d6409f','#12a594','#ffffff','#3e2a1e'];
const W=400,H=300;const objs=[];
const sky=pick(['#bfe3ff','#ffd8b1','#d9e8ff','#c7f0e0']);const ground=pick(['#8fd18b','#b9df8a','#e8d39a']);
objs.push({t:'sun',x:ri(40,360),y:ri(30,60),r:ri(18,26),c:'#ffd23f'});
for(let i=0;i<3;i++)objs.push({t:'cloud',x:ri(30,370),y:ri(25,90),r:ri(12,18),c:'#ffffff'});
for(let i=0;i<2;i++)objs.push({t:'bird',x:ri(40,360),y:ri(40,110),r:ri(6,9),c:'#333333'});
const hx=ri(120,230);objs.push({t:'house',x:hx,y:170,r:70,c:pick(COL.slice(0,8))});
objs.push({t:'roof',x:hx,y:170,r:70,c:pick(['#7a3b2e','#3b5b7a','#5b3b7a','#2e7a4d'])});
objs.push({t:'door',x:hx+ri(-15,15),y:208,r:12,c:pick(['#7a4a2e','#2e4a7a','#7a2e4a'])});
objs.push({t:'win',x:hx-22,y:185,r:10,c:'#bfe3ff'});objs.push({t:'win',x:hx+22,y:185,r:10,c:'#bfe3ff'});
for(let i=0;i<3;i++)objs.push({t:'tree',x:pick([ri(20,hx-60),ri(hx+60,380)]),y:ri(205,230),r:ri(18,26),c:pick(['#2f9e44','#37b24d','#2b8a3e'])});
for(let i=0;i<6;i++)objs.push({t:'flower',x:ri(15,385),y:ri(250,290),r:ri(5,7),c:pick(COL.slice(0,8))});
objs.push({t:'ball',x:ri(30,370),y:ri(255,285),r:ri(8,11),c:pick(COL.slice(0,8))});
function draw(o){const {x,y,r,c}=o;switch(o.t){
case 'sun':return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
case 'cloud':return `<g fill="${c}"><circle cx="${x}" cy="${y}" r="${r}"/><circle cx="${x+r}" cy="${y+3}" r="${r*.8}"/><circle cx="${x-r}" cy="${y+3}" r="${r*.8}"/></g>`;
case 'bird':return `<path d="M${x-r} ${y} q${r/2} ${-r/1.5} ${r} 0 q${r/2} ${-r/1.5} ${r} 0" stroke="${c}" stroke-width="2" fill="none"/>`;
case 'house':return `<rect x="${x-r*.7}" y="${y}" width="${r*1.4}" height="${r*.7}" fill="${c}" stroke="#333"/>`;
case 'roof':return `<polygon points="${x-r*.85},${y} ${x},${y-r*.6} ${x+r*.85},${y}" fill="${c}" stroke="#333"/>`;
case 'door':return `<rect x="${x-r*.6}" y="${y}" width="${r*1.2}" height="${r*1.8}" fill="${c}" stroke="#333"/>`;
case 'win':return `<rect x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" fill="${c}" stroke="#333"/><path d="M${x} ${y-r}v${r*2}M${x-r} ${y}h${r*2}" stroke="#333"/>`;
case 'tree':return `<rect x="${x-3}" y="${y}" width="6" height="${r}" fill="#7a4a2e"/><circle cx="${x}" cy="${y-r*.3}" r="${r}" fill="${c}"/>`;
case 'flower':return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y+10}" stroke="#2b8a3e" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r/2.5}" fill="#ffd23f"/>`;
case 'ball':return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#333"/>`;}return ''}
const changeable=objs.map((o,i)=>i).filter(i=>!['house','roof'].includes(objs[i].t));
const diffs=[];while(diffs.length<5){const i=pick(changeable);if(!diffs.includes(i)&&diffs.every(j=>Math.hypot(objs[i].x-objs[j].x,objs[i].y-objs[j].y)>30))diffs.push(i)}
const b=objs.map(o=>Object.assign({},o));
diffs.forEach(i=>{const o=b[i];const m=(o.t==='sun'||o.t==='win'||o.t==='door')?pick(['color','size']):pick(['color','gone','size','move']);o.m=m;
 if(m==='color'){let c;do{c=pick(COL.slice(0,8))}while(c===o.c);o.c=c}else if(m==='gone')o.gone=1;else if(m==='size')o.r=Math.round(o.r*(R()<.5?.6:1.45));else{o.x+=R()<.5?-26:26}});
const svg=list=>`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block;border-radius:12px;touch-action:manipulation"><rect width="${W}" height="${H*.62}" fill="${sky}"/><rect y="${H*.62}" width="${W}" height="${H*.38}" fill="${ground}"/>${list.map(o=>o.gone?'':draw(o)).join('')}<g class="marks"></g></svg>`;
const $=id=>document.getElementById(id);$('sp-a').innerHTML=svg(objs);$('sp-b').innerHTML=svg(b);$('sp-day').textContent=KST.slice(5).replace('-','월 ')+'일 그림 · 다른 곳 5개를 찾아 아래 그림을 눌러 주세요.';
const found=new Set();let t0=Date.now(),pen=0,done=false;const tick=setInterval(()=>{if(!done)$('sp-time').textContent=Math.floor((Date.now()-t0)/1000+pen)+'초'},250);
function mark(i,cls){const o=objs[i];document.querySelectorAll('.marks').forEach(g=>g.insertAdjacentHTML('beforeend',`<circle class="${cls}" cx="${o.x}" cy="${o.y}" r="${Math.max(18,o.r+10)}" fill="none" stroke="#e5484d" stroke-width="4"/>`))}
$('sp-b').addEventListener('click',e=>{if(done)return;const s=$('sp-b').querySelector('svg');const p=s.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(s.getScreenCTM().inverse());
 const hit=diffs.find(i=>!found.has(i)&&[objs[i],b[i]].some(o=>Math.hypot(q.x-o.x,q.y-o.y)<Math.max(22,o.r+12)));
 if(hit!==undefined){found.add(hit);mark(hit,'ok');$('sp-found').textContent='찾은 개수 '+found.size+' / 5';if(found.size===5)finish()}else{pen+=3;$('sp-msg').textContent='틀린 곳이 아니에요 (+3초)'}});
$('sp-hint').onclick=()=>{if(done)return;const i=diffs.find(i=>!found.has(i));pen+=30;const o=objs[i];document.querySelectorAll('.marks').forEach(g=>g.insertAdjacentHTML('beforeend',`<circle cx="${o.x}" cy="${o.y}" r="30" fill="#ffd23f" opacity=".5"><animate attributeName="opacity" values=".6;0;.6" dur="1s" repeatCount="3"/></circle>`))};
function finish(){done=true;clearInterval(tick);const sec=Math.floor((Date.now()-t0)/1000+pen);$('sp-time').textContent=sec+'초';const score=Math.max(1,3000-sec*10);
 $('sp-msg').textContent='다 찾았어요! '+sec+'초 · '+score+'점';$('sp-share').hidden=false;$('sp-share').onclick=()=>shareText('노리터 오늘의 틀린그림찾기 '+KST.slice(5)+'\n🔍 5개 모두 '+sec+'초 ('+score+'점)\n너는 몇 초? '+location.href);if(window.submitScore)submitScore(score)}
})();
