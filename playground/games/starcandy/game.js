(function(){
// 별사탕 합치기: 5락실 창작 물리 합치기 퍼즐. 그림·효과음 모두 코드로 생성(외부 파일 없음).
const $=id=>document.getElementById(id);
const cab=$('sc-cab'),cv=$('sc-c'),cx=cv.getContext('2d');
const DEBUG=location.hash.indexOf('scdebug')>=0;
// ── 세계 좌표(단위): 병 안쪽 x 0~JW, 병 입구 y=0, 바닥 y=JH. 화면은 X0~X1, Y0~Y1.
const JW=100,JH=136,LINE0=14,X0=-7,X1=107,Y0=-36,Y1=156,WW=X1-X0,WH=Y1-Y0;
const RAD=[4.4,6,7.8,9.6,11.6,14,16.6,19.4,22.6,26,30];
const NAME=['별가루','꼬마별','레몬별','딸기별','박하별','소다별','포도별','귤별','무지개별','달사탕','은하수 사탕'];
const COL=['#dfe8ff','#7fe7ff','#ffe45c','#ff6fa5','#5cf2a8','#4da3ff','#b07bff','#ff9a3d','#ff5fd2','#fff1b8','#6a4bff'];
const PTS=[0,1,3,6,10,15,21,28,36,45,55],DROPW=[30,28,22,12,8];
// 은하수 단계(BK 11/14 무제한): 은하수 사탕이 사라질 때마다 gal+1 → 점수 배수 +0.1, 넘침선 2씩 내려옴(최대 +10), 큰 별사탕(박하별)도 떨어짐
let gal=0,LINE=LINE0;const mult=()=>1+gal*.1,dropW=()=>gal?[30,28,22,12+gal,8+gal*2,Math.min(12,gal*2)]:DROPW;
const G=640,H=1/240,DAMP=0.998,ITER=4;
// ── 상태
let balls=[],fx=[],R=null,seq=0,cur=0,nxt=0,aim=JW/2,cool=0,score=0,best=0,run=false,over=false,overT=0,combo=0,comboT=0,maxT=0,last=0,acc=0,tm=0,keys={},drag=false,muted=false,uid=1,merges=0,dropped=0;
try{best=+localStorage.getItem('nr_best_starcandy_'+KST)||0;muted=localStorage.getItem('sc_mute')==='1'}catch(e){}
const B=()=>window.Bonus;
const design=()=>B()?B().design('starcandy'):'base',theme=()=>B()?B().theme('starcandy'):'base';
const neon=()=>{const k=B()&&B().skin();return k?k.c:['#f5edff','#b06bff','#6b21a8']};
// ── 소리(웹오디오 합성)
let AC=null;function tone(f,d,v,t){if(muted)return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;
 const chip=B()&&B().sound()==='chip';o.type=chip?'square':(t||'sine');o.frequency.setValueAtTime(f,n);o.frequency.exponentialRampToValueAtTime(f*1.5,n+d);g.gain.setValueAtTime((v||.12)*(chip?.5:1),n);g.gain.exponentialRampToValueAtTime(.001,n+d);o.connect(g);g.connect(AC.destination);o.start(n);o.stop(n+d)}catch(e){}}
const popSnd=t=>{tone(330*Math.pow(1.12,t),.18,.13,'triangle');setTimeout(()=>tone(660*Math.pow(1.12,t),.12,.07),50)};
// ── 화면 크기
let S=4,dpr=1,CW=0,CH=0,spr={},sprKey='',bg=null,bgKey='';
function size(){dpr=Math.min(2,window.devicePixelRatio||1);const maxW=Math.min(cab.parentElement.clientWidth||360,460);
 const maxH=Math.max(360,(window.innerHeight||700)-110);let w=maxW,h=w*WH/WW;if(h>maxH){h=maxH;w=h*WW/WH}
 cab.style.width=Math.round(w)+'px';CW=Math.round(w);CH=Math.round(h);cv.style.height=CH+'px';cv.width=Math.round(CW*dpr);cv.height=Math.round(CH*dpr);S=CW/WW;sprKey='';bgKey=''}
// ── 별사탕 그림(미리 그려 둔 스프라이트). 모양 세트 = 미니 상점 디자인(겉모습만)
function shade(h,a){const n=parseInt(h.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=a<0?0:255,t=Math.abs(a);r=Math.round(r+(f-r)*t);g=Math.round(g+(f-g)*t);b=Math.round(b+(f-b)*t);return 'rgb('+r+','+g+','+b+')'}
function fillFor(c,t,r,k){
 if(t===8){let g;try{g=c.createConicGradient(k||0,0,0)}catch(e){g=null}if(g){['#ff5f6d','#ffd23f','#3ddc84','#22d3ee','#b06bff','#ff5fd2','#ff5f6d'].forEach((q,i)=>g.addColorStop(i/6,q));return g}return COL[8]}
 if(t===10){const g=c.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);g.addColorStop(0,'#c9b8ff');g.addColorStop(.45,'#5a3bd6');g.addColorStop(1,'#1a0b4a');return g}
 const g=c.createRadialGradient(-r*.35,-r*.4,r*.08,0,0,r*1.05);g.addColorStop(0,shade(COL[t],.75));g.addColorStop(.5,COL[t]);g.addColorStop(1,shade(COL[t],-.45));return g}
function bumps(c,r,n,a){c.beginPath();for(let i=0;i<=n*8;i++){const th=i/(n*8)*Math.PI*2,rr=r*(1-a+a*Math.cos(n*th));const x=Math.cos(th)*rr,y=Math.sin(th)*rr;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath()}
function star5(c,r){c.beginPath();for(let i=0;i<10;i++){const th=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;c.lineTo(Math.cos(th)*rr,Math.sin(th)*rr)}c.closePath()}
function dots(c,t,r){if(t!==10)return;const R2=seeded('sc-galaxy');c.fillStyle='#fff';for(let i=0;i<22;i++){const a=R2()*7,d=Math.sqrt(R2())*r*.85;c.globalAlpha=.4+R2()*.6;c.beginPath();c.arc(Math.cos(a)*d,Math.sin(a)*d,r*(.02+R2()*.03),0,7);c.fill()}c.globalAlpha=1}
function drawPiece(c,t,r,d,k){
 c.save();c.shadowColor=t===10?'#9d7bff':COL[t];c.shadowBlur=r*.35;
 if(d==='marble'){ // 구슬 사탕: 매끈한 구슬 + 소용돌이 줄무늬
  c.beginPath();c.arc(0,0,r*.97,0,7);c.fillStyle=fillFor(c,t,r,k);c.fill();c.shadowBlur=0;c.save();c.clip();c.strokeStyle='#ffffff55';c.lineWidth=r*.14;
  for(let i=0;i<3;i++){c.beginPath();c.arc(r*.2,r*.1,r*(.35+i*.28),Math.PI*(.9+i*.2),Math.PI*(1.7+i*.2));c.stroke()}dots(c,t,r);c.restore()}
 else if(d==='planet'){ // 젤리 행성: 줄무늬 행성, 5단계부터 고리
  c.beginPath();c.arc(0,0,r*.97,0,7);c.fillStyle=fillFor(c,t,r,k);c.fill();c.shadowBlur=0;c.save();c.clip();c.fillStyle='#ffffff26';
  for(let i=-2;i<=2;i++)c.fillRect(-r,i*r*.36-r*.07,r*2,r*.14);dots(c,t,r);c.restore();
  if(t>=5){c.strokeStyle=shade(t===8?'#ffd23f':COL[t],.55);c.globalAlpha=.85;c.lineWidth=r*.09;c.beginPath();c.ellipse(0,0,r*1.12,r*.28,-.35,Math.PI*.05,Math.PI*.95);c.stroke();c.globalAlpha=1}}
 else if(d==='gem'){ // 보석 별: 각진 보석
  const n=6+(t%3);c.beginPath();for(let i=0;i<n;i++){const th=-Math.PI/2+i*Math.PI*2/n;c.lineTo(Math.cos(th)*r,Math.sin(th)*r)}c.closePath();c.fillStyle=fillFor(c,t,r,k);c.fill();c.shadowBlur=0;
  for(let i=0;i<n;i++){const a1=-Math.PI/2+i*Math.PI*2/n,a2=a1+Math.PI*2/n;c.fillStyle=i%2?'#ffffff2a':'#00000022';c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a1)*r,Math.sin(a1)*r);c.lineTo(Math.cos(a2)*r,Math.sin(a2)*r);c.closePath();c.fill()}
  c.fillStyle='#ffffff40';c.beginPath();for(let i=0;i<n;i++){const th=-Math.PI/2+i*Math.PI*2/n;c.lineTo(Math.cos(th)*r*.5,Math.sin(th)*r*.5)}c.closePath();c.fill();dots(c,t,r*.9)}
 else{ // 기본 네온 별사탕 / 전설 은하수(무지개 몸 + 별 무늬)
  const leg=d==='galaxy';bumps(c,r,5+Math.min(6,t),.07);if(leg){c.fillStyle=fillFor(c,8,r,k);c.fill();c.shadowBlur=0;bumps(c,r*.84,5+Math.min(6,t),.07)} // 전설: 무지개 테두리 + 단계 색 몸 + 은하 점
  c.fillStyle=fillFor(c,t,leg?r*.84:r,k);c.fill();c.shadowBlur=0;
  if(leg){c.save();c.clip();dots(c,10,r*.8);c.restore()}else dots(c,t,r);
  c.fillStyle='#ffffff33';star5(c,r*.55);c.fill();c.strokeStyle='#ffffff66';c.lineWidth=Math.max(1,r*.05);c.stroke()}
 c.fillStyle='#ffffffb0';c.beginPath();c.ellipse(-r*.38,-r*.42,r*.2,r*.11,-.6,0,7);c.fill();
 c.restore()}
const LEGF=6;
function sprites(){const d=design(),key=d+'|'+S+'|'+dpr;if(key===sprKey)return;sprKey=key;spr={};
 for(let t=0;t<11;t++){const r=RAD[t]*S*dpr,p=Math.ceil(r*1.5),fr=d==='galaxy'?LEGF:1;spr[t]=[];
  for(let f=0;f<fr;f++){const o=document.createElement('canvas');o.width=o.height=p*2;const c=o.getContext('2d');c.translate(p,p);drawPiece(c,t,r,d,f*Math.PI*2/LEGF);spr[t].push(o)}}}
// ── 병 배경 테마(겉모습만)
const THM={base:['#0b1030','#1c0f3f','#ffffff'],berry:['#2a0b22','#6b1f4a','#ffc2dc'],sea:['#021a2e','#0a4f73','#9fe8ff'],snow:['#0c1830','#2b4a78','#ffffff']};
let parts=[];
function background(){const th=theme(),key=th+'|'+CW+'|'+dpr;if(key===bgKey)return;bgKey=key;const T=THM[th]||THM.base;
 bg=document.createElement('canvas');bg.width=cv.width;bg.height=cv.height;const c=bg.getContext('2d');const g=c.createLinearGradient(0,0,0,bg.height);g.addColorStop(0,T[0]);g.addColorStop(1,T[1]);c.fillStyle=g;c.fillRect(0,0,bg.width,bg.height);
 const r=seeded('scbg'+th);c.fillStyle=T[2];for(let i=0;i<70;i++){c.globalAlpha=.15+r()*.5;c.beginPath();c.arc(r()*bg.width,r()*bg.height,(.4+r()*1.2)*dpr,0,7);c.fill()}c.globalAlpha=1;
 if(th==='berry'){c.font=(14*dpr)+'px sans-serif';c.globalAlpha=.12;for(let i=0;i<12;i++)c.fillText('♥',r()*bg.width,r()*bg.height);c.globalAlpha=1}
 parts=[];const n=th==='snow'?40:th==='sea'?18:th==='berry'?10:0;for(let i=0;i<n;i++)parts.push({x:X0+r()*WW,y:Y0+r()*WH,v:4+r()*8,s:.4+r()*.9,p:r()*7})}
// ── 판 시작
function pick(){const W=dropW(),r=R(),tw=W.reduce((a,b)=>a+b,0);let x=r*tw;for(let i=0;i<W.length;i++){if((x-=W[i])<0)return i}return 0}
function reset(){gal=0;LINE=LINE0;R=seeded('starcandy'+KST);balls=[];fx=[];seq=0;cur=pick();nxt=pick();aim=JW/2;cool=0;score=0;over=false;overT=0;combo=0;comboT=0;maxT=0;acc=0;tm=0;merges=0;dropped=0}
function drop(){if(!run||over||cool>0)return;const r=RAD[cur],x=Math.max(r,Math.min(JW-r,aim));balls.push({id:uid++,t:cur,x,y:-r-4,px:x,py:-r-4,a:0,age:0,pop:0});dropped++;
 cur=nxt;nxt=pick();cool=.42;tone(240,.08,.06,'triangle')}
function addFx(x,y,t,txt){const n=8+t*2;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,s=20+RAD[t]*3;fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:.5,c:t===10?'#c9b8ff':COL[t],k:0})}fx.push({x,y,vx:0,vy:-14,l:.9,c:'#fff',k:1,txt})}
// ── 물리: 베를레 적분 + 위치 보정(작은 간격으로 여러 번)
function step(){
 for(const b of balls){let vx=(b.x-b.px)*DAMP,vy=(b.y-b.py)*DAMP;if(vy<-.5)vy=-.5;const m=Math.hypot(vx,vy);if(m>2){vx*=2/m;vy*=2/m}b.px=b.x;b.py=b.y;b.x+=vx;b.y+=vy+G*H*H;b.age+=H}
 const mg=[];
 for(let it=0;it<ITER;it++){
  for(let i=0;i<balls.length;i++){const a=balls[i];
   for(let j=i+1;j<balls.length;j++){const b=balls[j];const dx=b.x-a.x,dy=b.y-a.y,rr=RAD[a.t]+RAD[b.t];if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;
    const d2=dx*dx+dy*dy;if(d2>=rr*rr)continue;const d=Math.sqrt(d2)||.001,nx=dx/d,ny=dy/d,o=(rr-d);
    if(a.t===b.t&&it===0)mg.push([a,b]);
    const ma=RAD[a.t]*RAD[a.t],mb=RAD[b.t]*RAD[b.t],k=Math.min(o,2)*.9/(ma+mb),ax=nx*k*mb,ay=ny*k*mb,bx=nx*k*ma,by=ny*k*ma;a.x-=ax;a.y-=ay;b.x+=bx;b.y+=by;a.px-=ax*.5;a.py-=ay*.5;b.px+=bx*.5;b.py+=by*.5}}
  for(const b of balls){const r=RAD[b.t];if(b.x<r)b.x=r;if(b.x>JW-r)b.x=JW-r;if(b.y>JH-r)b.y=JH-r}}
 for(const b of balls)if(b.y>=JH-RAD[b.t]-.05)b.px=b.x-(b.x-b.px)*.985;
 // 합치기
 for(const [a,b] of mg){if(a.dead||b.dead)continue;a.dead=b.dead=1;const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  if(comboT>0)combo++;else combo=1;comboT=1.1;merges++;
  if(a.t===10){const p=Math.round((100+(combo>1?combo*5:0))*mult());score+=p;gal++;LINE=LINE0+Math.min(10,gal*2);addFx(x,y,10,'+'+p+' 은하수 ×'+gal+'!');popSnd(12);continue}
  const t=a.t+1,p=Math.round((PTS[t]+(combo>1?combo*2:0))*mult());score+=p;
  balls.push({id:uid++,t,x,y,px:x-((a.x-a.px)+(b.x-b.px))/2,py:y-((a.y-a.py)+(b.y-b.py))/2,a:(a.a+b.a)/2,age:1,pop:1});
  if(t>maxT)maxT=t;addFx(x,y,t,combo>1?'+'+p+' 연쇄 '+combo:'+'+p);popSnd(t);
  if(t>=8&&B())B().ach('sc8')}
 if(mg.length)balls=balls.filter(b=>!b.dead);
 for(const b of balls){b.a+=(b.x-b.px)/RAD[b.t]}}
function update(dt){
 tm+=dt;if(cool>0)cool-=dt;if(comboT>0)comboT-=dt;
 const sp=JW*1.1;if(keys.ArrowLeft||keys.a)aim-=sp*dt;if(keys.ArrowRight||keys.d)aim+=sp*dt;aim=Math.max(0,Math.min(JW,aim));
 acc+=dt;let n=0;while(acc>=H*2&&n<16){step();step();acc-=H*2;n++}if(n>=16)acc=0;
 for(const b of balls)if(b.pop>0)b.pop=Math.max(0,b.pop-dt*5);
 // 넘침 검사: 떨어뜨린 지 1.2초 지난 별사탕 윗면이 넘침선 위
 let danger=false;for(const b of balls)if(b.age>1.2&&b.y-RAD[b.t]<LINE){danger=true;break}
 overT=danger?overT+dt:Math.max(0,overT-dt*2);if(overT>2)end();
 for(const f of fx){f.x+=f.vx*dt;f.y+=f.vy*dt;f.l-=dt;if(!f.k){f.vx*=.92;f.vy*=.92}}fx=fx.filter(f=>f.l>0);
 for(const p of parts){const th=theme();if(th==='snow'){p.y+=p.v*dt;p.x+=Math.sin(tm+p.p)*3*dt}else{p.y-=p.v*dt}if(p.y>Y1)p.y=Y0;if(p.y<Y0)p.y=Y1}}
// ── 그리기
const wx=x=>(x-X0)*S*dpr,wy=y=>(y-Y0)*S*dpr;
function draw(){sprites();background();const c=cx,K=S*dpr;c.setTransform(1,0,0,1,0,0);c.drawImage(bg,0,0);
 const th=theme();if(parts.length){c.fillStyle=(THM[th]||THM.base)[2];for(const p of parts){c.globalAlpha=th==='sea'?.35:.7;c.beginPath();if(th==='sea'){c.lineWidth=K*.25;c.strokeStyle=c.fillStyle;c.arc(wx(p.x),wy(p.y),p.s*K*1.2,0,7);c.stroke()}else{c.arc(wx(p.x),wy(p.y),p.s*K*.6,0,7);c.fill()}}c.globalAlpha=1}
 const N=neon();
 // 병
 c.save();c.lineJoin='round';c.lineCap='round';c.fillStyle='#ffffff0a';c.beginPath();c.moveTo(wx(-1.5),wy(-4));c.lineTo(wx(-1.5),wy(JH-6));c.quadraticCurveTo(wx(-1.5),wy(JH+1.5),wx(6),wy(JH+1.5));c.lineTo(wx(JW-6),wy(JH+1.5));c.quadraticCurveTo(wx(JW+1.5),wy(JH+1.5),wx(JW+1.5),wy(JH-6));c.lineTo(wx(JW+1.5),wy(-4));c.fill();
 c.shadowColor=N[1];c.shadowBlur=12*dpr;c.strokeStyle=N[1];c.lineWidth=2.6*dpr;c.stroke();c.shadowBlur=0;c.strokeStyle=N[0];c.lineWidth=1*dpr;c.stroke();
 c.fillStyle=N[1];c.fillRect(wx(-4),wy(-6),3.6*K,2*K);c.fillRect(wx(JW+.4),wy(-6),3.6*K,2*K);c.restore();
 // 넘침선
 const warn=overT>0;c.save();c.setLineDash([6*dpr,6*dpr]);c.strokeStyle=warn?(Math.floor(tm*8)%2?'#ff3d5a':'#ffd23f'):'#ffffff40';c.lineWidth=(warn?2.2:1.2)*dpr;c.beginPath();c.moveTo(wx(0),wy(LINE));c.lineTo(wx(JW),wy(LINE));c.stroke();c.restore();
 // 조준선 + 들고 있는 별사탕
 if(run&&!over){const r=RAD[cur],x=Math.max(r,Math.min(JW-r,aim));c.strokeStyle='#ffffff30';c.lineWidth=1*dpr;c.setLineDash([3*dpr,5*dpr]);c.beginPath();c.moveTo(wx(x),wy(-24+r));c.lineTo(wx(x),wy(JH));c.stroke();c.setLineDash([]);
  c.globalAlpha=cool>0?.45:1;blit(cur,x,-24,Math.sin(tm*2)*.15,0);c.globalAlpha=1}
 for(const b of balls)blit(b.t,b.x,b.y,b.a,b.pop);
 if(design()==='galaxy'){c.fillStyle='#fff';for(const b of balls){const r=RAD[b.t],a=tm*2+b.id;for(let k=0;k<2;k++){const q=a+k*Math.PI;c.globalAlpha=.6+.4*Math.sin(tm*6+k);c.beginPath();c.arc(wx(b.x+Math.cos(q)*r*1.05),wy(b.y+Math.sin(q)*r*.5),Math.max(1,r*.06*K),0,7);c.fill()}}c.globalAlpha=1}
 // 효과
 for(const f of fx){if(f.k){c.globalAlpha=Math.min(1,f.l*2);c.font='800 '+Math.round(5*K)+'px sans-serif';c.textAlign='center';c.lineWidth=3*dpr;c.strokeStyle='#000a';c.strokeText(f.txt,wx(f.x),wy(f.y));c.fillStyle='#fff';c.fillText(f.txt,wx(f.x),wy(f.y))}
  else{c.globalAlpha=Math.max(0,f.l*2);c.fillStyle=f.c;c.beginPath();c.arc(wx(f.x),wy(f.y),1*K,0,7);c.fill()}}c.globalAlpha=1;
 // 위쪽 정보: 점수·최고·다음
 c.textAlign='left';c.fillStyle='#fff';c.font='800 '+Math.round(7*K)+'px sans-serif';c.fillText(score.toLocaleString(),wx(-4),wy(-27));
 c.font=Math.round(3.6*K)+'px sans-serif';c.fillStyle='#ffffffaa';c.fillText('오늘 최고 '+Math.max(best,score).toLocaleString(),wx(-4),wy(-21));if(gal){c.fillStyle='#ffd23f';c.font='800 '+Math.round(3.6*K)+'px sans-serif';c.fillText('🌌 은하수 ×'+gal+' · 점수 ×'+mult().toFixed(1),wx(-4),wy(-15.5))}
 c.textAlign='right';c.fillStyle='#ffffffaa';c.font=Math.round(3.6*K)+'px sans-serif';c.fillText('다음',wx(JW-27),wy(-26));blit(nxt,JW-20,-27.5,0,0,Math.min(1,5.5/RAD[nxt]));
 // 아래: 11단계 사다리
 const y=JH+10;let x=1.5;for(let t=0;t<11;t++){const s=Math.min(1,(1.6+t*.3)/RAD[t]),rr=RAD[t]*s;x+=rr;c.globalAlpha=t<=maxT||t<5?1:.3;blit(t,x,y,0,0,s);x+=rr+1.1}c.globalAlpha=1;
 c.textAlign='center';c.font=Math.round(3*K)+'px sans-serif';c.fillStyle='#ffffff88';c.fillText(maxT>=1?'지금까지: '+NAME[maxT]:'같은 별사탕끼리 합쳐요',wx(JW/2),wy(JH+18.5))}
function blit(t,x,y,a,pop,sc){const set=spr[t];if(!set)return;const im=set.length>1?set[Math.floor(tm*8+t)%set.length]:set[0];const s=(sc||1)*(1+(pop||0)*.25),w=im.width*s;
 cx.save();cx.translate(wx(x),wy(y));if(a)cx.rotate(a);cx.drawImage(im,-w/2,-w/2,w,w);cx.restore()}
// ── 루프
function frame(now){if(!run)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!over)update(dt);else{tm+=dt;for(const f of fx){f.x+=f.vx*dt;f.y+=f.vy*dt;f.l-=dt}fx=fx.filter(f=>f.l>0)}draw();requestAnimationFrame(frame)}
function start(){size();reset();run=true;over=false;last=performance.now();$('sc-go').style.display='none';$('sc-ov').style.display='none';$('sc-msg').textContent='';requestAnimationFrame(frame);try{AC&&AC.resume()}catch(e){}}
function end(){if(over)return;over=true;const s=score;if(s>best){best=s;try{localStorage.setItem('nr_best_starcandy_'+KST,s)}catch(e){}}
 tone(200,.4,.12,'sawtooth');$('sc-go').textContent='↻ 다시 시작';$('sc-go').style.display='block';$('sc-ov').style.display='flex';
 $('sc-msg').innerHTML='끝! <b>'+s.toLocaleString()+'점</b> · 최고 단계 '+NAME[maxT]+' · 합체 '+merges+'번'+(gal?' · 🌌 은하수 '+gal+'개':'');
 if(!DEBUG&&window.submitScore)submitScore(s);else if(B())B().played('starcandy');if(B())B().render()}
$('sc-sh').onclick=()=>shareText('5락실 별사탕 합치기 '+KST.slice(5)+'\n🍬 '+score.toLocaleString()+'점 · '+(gal?'은하수 사탕 '+gal+'개 터뜨렸어요':NAME[maxT]+'까지 만들었어요')+'. 이겨 볼래?\n'+challengeUrl(score));
$('sc-rk').onclick=()=>{const b=$('rankbox');if(b)b.scrollIntoView({behavior:'smooth',block:'center'})};
$('sc-go').onclick=e=>{e.stopPropagation();start()};
$('sc-mu').onclick=e=>{e.stopPropagation();muted=!muted;$('sc-mu').textContent=muted?'🔇':'🔊';try{localStorage.setItem('sc_mute',muted?'1':'0')}catch(e){}};$('sc-mu').textContent=muted?'🔇':'🔊';
// ── 조작: 누른 채 좌우 → 떼면 떨어뜨림 / 마우스는 따라다니고 클릭
const toX=e=>{const b=cv.getBoundingClientRect();return (e.clientX-b.left)/b.width*WW+X0};
cv.addEventListener('pointerdown',e=>{if(!run||over)return;drag=true;aim=toX(e);try{cv.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()});
cv.addEventListener('pointermove',e=>{if(!run||over)return;if(drag||e.pointerType==='mouse')aim=toX(e)});
cv.addEventListener('pointerup',e=>{if(!drag)return;drag=false;aim=toX(e);drop()});
cv.addEventListener('pointercancel',()=>drag=false);
addEventListener('keydown',e=>{if(!run||over){if(e.key==='Enter'&&document.activeElement===document.body&&cab.getBoundingClientRect().top<innerHeight){start();e.preventDefault()}return}
 if(['ArrowLeft','ArrowRight','ArrowDown',' '].includes(e.key))e.preventDefault();keys[e.key]=1;if(e.key===' '||e.key==='ArrowDown'||e.key==='s')drop()});
addEventListener('keyup',e=>keys[e.key]=0);
addEventListener('resize',()=>{if(run){size()}else{size();draw()}});
document.addEventListener('visibilitychange',()=>{last=performance.now();acc=0});
// ── 미니 상점: 이 게임 꾸미기만(모양·병 배경). 코인은 사이트 공통(window.Bonus)
let tab='d';
function shop(){const b=B(),el=$('sc-items');if(!b||!el){$('sc-shop').style.display='none';return}$('sc-coin').textContent=b.coins();
 const L=tab==='d'?[{id:'base',name:'네온 별사탕',icon:'🍬',p:0}].concat(DESIGNS.filter(x=>x.g==='starcandy')):[{id:'base',name:'밤하늘 병',icon:'🌃',p:0}].concat(THEMES.filter(x=>x.g==='starcandy'));
 const cur=tab==='d'?b.design('starcandy'):b.theme('starcandy'),st=b.state(),pre=tab==='d'?'d:starcandy:':'h:starcandy:';
 el.innerHTML=L.map(x=>{const ok=x.p<=0||st.own[pre+x.id];return `<button type="button" data-i="${x.id}" class="${x.id===cur?'sel':''}${x.leg?' leg':''}"><span class="di">${x.icon}</span><b>${x.leg?'<i>전설</i> ':''}${x.name}</b><small>${x.id===cur?'✅ 사용 중':ok?'가지고 있음 · 눌러서 적용':'🪙 '+x.p+' · 눌러서 사기'}</small></button>`}).join('');
 el.querySelectorAll('button').forEach(k=>k.onclick=()=>{const id=k.dataset.i;const ok=tab==='d'?b.setDesign('starcandy',id):b.setTheme('starcandy',id);if(ok){sprKey='';bgKey='';shop();if(!run){size();reset();draw()}}})}
document.querySelectorAll('.sc-tabs button').forEach(k=>k.onclick=()=>{tab=k.dataset.t;document.querySelectorAll('.sc-tabs button').forEach(q=>q.classList.toggle('on',q===k));shop()});
addEventListener('bonus-save',()=>{const c=$('sc-coin');if(c&&B())c.textContent=B().coins()});
// 처음 화면: 미리보기
function idle(){size();reset();const r=seeded('sc-demo');for(let i=0;i<9;i++){const t=Math.floor(r()*6),x=RAD[t]+r()*(JW-2*RAD[t]);balls.push({id:uid++,t,x,y:JH-RAD[t]-r()*40,px:x,py:0,a:r()*6,age:0,pop:0})}
 for(const b of balls)b.py=b.y;for(let i=0;i<600;i++)step();for(const b of balls){b.px=b.x;b.py=b.y}score=0;fx=[];maxT=0;combo=0;draw()}
function init(){idle();shop()}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',init);else setTimeout(init,0);
if(DEBUG)window.__sc={start,drop,state:()=>({gal,line:LINE,score,balls:balls.length,maxT,over,merges,overT:+overT.toFixed(2),ys:balls.map(b=>[b.t,+b.x.toFixed(1),+b.y.toFixed(1),+b.age.toFixed(2)])}),aim:x=>{aim=x},
 bot(n){let k=0;const go=()=>{if(over||k++>=n)return;aim=8+R()*84;cool=0;drop();setTimeout(go,260)};go()},
 fill(ts){for(const t of ts){const r=RAD[t],x=r+Math.random()*(JW-2*r);balls.push({id:uid++,t,x,y:JH-r-Math.random()*60,px:x,py:0,a:0,age:2,pop:0});balls[balls.length-1].py=balls[balls.length-1].y}},
 settle(n){for(let i=0;i<(n||600);i++)step()},draw};
})();
