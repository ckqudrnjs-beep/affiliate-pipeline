(function(){
// 통통 네온런: 5락실 창작 리듬 점프 러너. 그림·음악·코스 모두 코드로 생성(외부 파일 없음).
const $=id=>document.getElementById(id);
const cab=$('tt-cab'),cv=$('tt-c'),cx=cv.getContext('2d');
const COARSE=matchMedia('(pointer: coarse)').matches,IOS=/iP(hone|od|ad)/.test(navigator.userAgent);
const DEBUG=location.hash.indexOf('ttdebug')>=0;
// ── 물리(타일 단위, 박자 기준 정규화 시간). 1타일 = 16분음표, 4타일 = 1박.
const VX=8,G=62,J=17,PJ=24,STEP=1/120,R=0.38,DX=VX*STEP,SEC=128;
const bpmAt=x=>100+6*Math.min(Math.max(0,Math.floor(x/SEC)),12);
const kAt=x=>bpmAt(x)/120;
// ── 코스: 칸(타일)별 버킷에 물체 등록
const B=[];let genX=0,frontier=null,RNG=null,chunkN=0;
// 이어 달리기(🪙3, 한 판에 1번) 부활 지점: 조각마다 끝에서 '살아서 착지 가능'이 검증된 상태
const CPS=[{i:0,y:0,vy:0,g:true}];let SAFE=[];
function put(o){const a=Math.floor(o.x),b=Math.ceil(o.x+(o.w||1));for(let t=a;t<b;t++)(B[t]||(B[t]=[])).push(o)}
const solid=(x,y,w,h)=>({k:0,x,y,w,h});
function sim(s,jump,m){
 if(s.g&&jump){s.vy=J;s.g=false}
 const py=s.y;s.vy-=G*STEP;if(s.vy<-40)s.vy=-40;s.i++;s.y+=s.vy*STEP;s.g=false;
 const x=s.i*DX,L=x-R,Rr=x+R,t0=Math.floor(L-1),t1=Math.floor(Rr+1);
 let hitPad=false;
 for(let t=t0;t<=t1;t++){const bk=B[t];if(!bk)continue;
  for(const o of bk){if(o.k!==0)continue;const top=o.y+o.h;
   if(s.vy<=0&&py>=top-0.02&&s.y<top&&Rr>o.x+m+0.02&&L<o.x+o.w-m-0.02){s.y=top;s.vy=0;s.g=true}}}
 for(let t=t0;t<=t1;t++){const bk=B[t];if(!bk)continue;
  for(const o of bk){
   if(o.k===0){const top=o.y+o.h;if(Rr>o.x-m&&L<o.x+o.w+m&&s.y<top-0.001&&s.y+2*R>o.y)return false}
   else if(o.k===1){if(x+0.28>o.x+0.3-m&&x-0.28<o.x+0.7+m&&s.y+0.1<o.y+0.6+m&&s.y+0.66>o.y)return false}
   else if(o.k===2){if(Rr>o.x+0.1&&L<o.x+0.9&&s.y<o.y+1&&s.y>=o.y-0.05&&s.vy<PJ*0.8)hitPad=true}}}
 if(hitPad){s.vy=PJ;s.g=false;s.pad=1}
 return s.y>-4;
}
const clone=s=>({i:s.i,y:s.y,vy:s.vy,g:s.g});
// 깊이 우선 탐색: 땅에 선 상태에서 '지금 점프'/'기다리기' 두 갈래. endX까지 살아서 착지하는 상태 목록을 돌려준다.
function solve(starts,endX,m,all){
 const seen=new Set(),out=[],st=starts.map(clone);
 while(st.length){const s=st.pop();const key=s.i*64+Math.round(s.y*4);if(seen.has(key))continue;seen.add(key);
  if(s.i*DX>=endX){out.push(s);if(!all)return out;continue}
  for(const jp of [false,true]){const n=clone(s);let ok=sim(n,jp,m);let c=0;while(ok&&!n.g&&c++<400)ok=sim(n,false,m);if(ok&&n.g)st.push(n)}}
 return out;
}
// 조각(장애물 묶음) 만들기. c=시작 칸, 반환=끝 칸. holes=구덩이(땅 없음) 구간.
const PIECES=[
 {d:0,w:4,f:(c,o)=>{o.push({k:1,x:c,y:0});return c+1}},                                  // 가시 1
 {d:0,w:3,f:(c,o,r)=>{const w=2+Math.floor(r()*2);o.push(solid(c,0,w,1));return c+w}},     // 낮은 블록
 {d:1,w:3,f:(c,o)=>{o.push({k:1,x:c,y:0},{k:1,x:c+1,y:0});return c+2}},                 // 가시 2
 {d:1,w:2,f:(c,o,r,h)=>{h.push([c,c+2]);return c+2}},                                      // 구덩이 2
 {d:2,w:2,f:(c,o)=>{o.push(solid(c,0,3,1),solid(c+3,0,3,2));return c+6}},                 // 계단
 {d:2,w:2,f:(c,o)=>{o.push({k:2,x:c,y:0},solid(c+3,0,2,3));return c+5}},                  // 발판 + 큰 벽
 {d:2,w:2,f:(c,o)=>{o.push(solid(c,0,3,1),{k:1,x:c+3,y:0},{k:1,x:c+4,y:0},solid(c+5,0,3,1));return c+8}}, // 블록 사이 가시
 {d:3,w:2,f:(c,o)=>{o.push({k:1,x:c,y:0},{k:1,x:c+1,y:0},{k:1,x:c+2,y:0});return c+3}}, // 가시 3
 {d:3,w:2,f:(c,o,r,h)=>{h.push([c,c+3]);return c+3}},                                      // 구덩이 3
 {d:3,w:2,f:(c,o)=>{o.push(solid(c,0,6,1),{k:1,x:c+3,y:1});return c+6}},                  // 블록 위 가시
 {d:4,w:2,f:(c,o,r,h)=>{h.push([c,c+7]);o.push(solid(c+3,0.5,2,0.5));return c+7}},        // 공중 발판
 {d:4,w:1,f:(c,o)=>{o.push(solid(c,0,3,1),solid(c+4,0,3,2),{k:1,x:c+3,y:0});return c+7}},
 {d:5,w:1,f:(c,o,r,h)=>{o.push({k:2,x:c,y:0});h.push([c+2,c+6]);o.push(solid(c+6,0,2,2));return c+8}},
];
function groundFill(a,b,holes){let x=a;holes.sort((p,q)=>p[0]-q[0]);for(const [h0,h1] of holes){if(h0>x)put(solid(x,-6,h0-x,6));x=Math.max(x,h1)}if(b>x)put(solid(x,-6,b-x,6))}
function genChunk(){
 if(!RNG)RNG=seeded('tongtong'+KST);
 if(chunkN===0){groundFill(-20,24,[]);genX=24;frontier=[{i:0,y:0,vy:0,g:true}];chunkN=1;return}
 const d=Math.min(8,Math.floor(Math.floor(genX/SEC)*2/3));
 const pool=PIECES.filter(p=>p.d<=d),tw=pool.reduce((a,p)=>a+p.w,0);
 for(let tries=0;tries<30;tries++){
  const objs=[],holes=[];let c=genX+(d<=1?4:2);const n=d<2?2:d<4?3:4;
  for(let k=0;k<n;k++){let r=RNG()*tw,p=pool[0];for(const q of pool){if((r-=q.w)<0){p=q;break}}
   c=p.f(c,objs,RNG,holes);const gap=(d<=1?5:d<=3?4:3)+Math.floor(RNG()*3);c+=gap;if(c%2)c++}
  const end=c;
  // 시험 등록 → 검사 → 실패면 되돌림
  const before=B.length,snap=[];for(let t=genX-2;t<end+2;t++)snap[t]=B[t]?B[t].slice():undefined;
  objs.forEach(put);groundFill(genX,end,holes);
  const arr=solve(frontier,end-1,0.1,true);
  if(arr.length){frontier=arr.filter((s,i)=>i%Math.ceil(arr.length/24)===0);CPS.push(clone(frontier[0]));genX=end;chunkN++;return}
  for(let t=genX-2;t<end+2;t++)B[t]=snap[t];B.length=Math.max(before,0);
 }
 const end=genX+8;put({k:1,x:genX+4,y:0});groundFill(genX,end,[]);const arr=solve(frontier,end-1,0,true);if(arr.length){frontier=arr.slice(0,24);CPS.push(clone(frontier[0]))}genX=end;chunkN++;
}
function ensure(x){let n=0;while(genX<x&&n++<6)genChunk()}
// ── 오디오(웹오디오로 직접 합성)
let AC=null,master=null,noise=null,muted=false,lastN=-1;try{muted=localStorage.getItem('tt_mute')==='1'}catch(e){}
const SR=seeded('tongtong-song'+KST),SCALE=[0,2,3,5,7,8,10];
const ROOT=45+Math.floor(SR()*7),PROGS=[[0,5,2,6],[0,3,5,4],[0,6,5,4],[0,2,6,3],[0,5,3,4]],PROG=PROGS[Math.floor(SR()*PROGS.length)];
const ARP=[];for(let i=0;i<16;i++)ARP.push(SR()<0.78?Math.floor(SR()*5):-1);
const BASS=[];for(let i=0;i<8;i++)BASS.push([0,0,0,12,7,0,12,-5][Math.floor(SR()*8)]);BASS[0]=0;
const sc=n=>SCALE[((n%7)+7)%7]+12*Math.floor(n/7);
const mf=m=>440*Math.pow(2,(m-69)/12);
function audio(){if(AC){if(AC.state==='suspended')AC.resume();return}
 try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 const comp=AC.createDynamicsCompressor();master=AC.createGain();master.gain.value=muted?0:0.5;master.connect(comp);comp.connect(AC.destination);
 noise=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 const o=AC.createOscillator(),g=AC.createGain();g.gain.value=0;o.connect(g);g.connect(master);o.start();o.stop(AC.currentTime+0.05)}
function env(g,t,a,dur){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(a,t+0.005);g.gain.exponentialRampToValueAtTime(0.0001,t+dur)}
function tone(type,f,t,a,dur,f2,filt){if(CHIP){type=type==='sine'&&f<200?'triangle':'square';a*=0.5;filt=0}const o=AC.createOscillator(),g=AC.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*0.6);
 let n=o;if(filt){const q=AC.createBiquadFilter();q.type='lowpass';q.frequency.value=filt;q.Q.value=3;o.connect(q);n=q}n.connect(g);g.connect(master);env(g,t,a,dur);o.start(t);o.stop(t+dur+0.02)}
function hiss(t,a,dur,type,f){const s=AC.createBufferSource(),q=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noise;q.type=type;q.frequency.value=f;s.connect(q);q.connect(g);g.connect(master);env(g,t,a,dur);s.start(t,Math.random()*0.5);s.stop(t+dur+0.02)}
function note(n,t,spb){const sec=Math.floor(n/SEC),st=n%16,bar=Math.floor(n/16),deg=PROG[bar%4],root=ROOT+sc(deg);
 if(n%4===0)tone('sine',150,t,0.9,0.22,42);
 if(n%4===2)hiss(t,0.18,0.04,'highpass',7000);else if(sec>=2&&n%2===1)hiss(t,0.06,0.03,'highpass',9000);
 if(sec>=1&&(st===4||st===12))hiss(t,0.35,0.14,'bandpass',1600);
 if(n%2===0)tone('sawtooth',mf(root-12+BASS[(n/2)%8]),t,0.22,spb*0.45,0,520+sec*60);
 if(sec>=1&&ARP[st]>=0){const tn=[0,2,4,7,9][ARP[st]];tone('square',mf(ROOT+12+sc(deg+tn)),t,sec>=3?0.07:0.05,spb*0.22)}
 if(sec>=3&&st===0)[0,2,4].forEach(o=>tone('triangle',mf(ROOT+12+sc(deg+o)),t,0.035,spb*3.6));
 if(n>0&&n%SEC===0)hiss(t,0.3,0.9,'highpass',3000)}
function music(x){if(!AC||muted)return;const spb=0.5/kAt(x),bp=x/4;let n=Math.max(lastN+1,Math.floor(x));if(x<0)return;
 for(;(n/4-bp)*spb<0.12;n++){note(n,AC.currentTime+Math.max(0,(n/4-bp)*spb),spb);lastN=n}}
const sfx={jump(){if(AC&&!muted)tone('sine',420,AC.currentTime,0.12,0.09,760)},pad(){if(AC&&!muted)tone('triangle',300,AC.currentTime,0.22,0.25,1200)},
 die(){if(!AC||muted)return;const t=AC.currentTime;hiss(t,0.5,0.45,'lowpass',1200);tone('sawtooth',220,t,0.25,0.4,40)}};
// ── 화면
let W=0,H=0,DPR=1,T=40;
function size(){const r=cab.getBoundingClientRect();W=Math.max(1,r.width);H=Math.max(1,r.height);DPR=Math.min(window.devicePixelRatio||1,2);
 if(W*H*DPR*DPR>2.6e6)DPR=Math.sqrt(2.6e6/(W*H));cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);cx.setTransform(DPR,0,0,DPR,0,0);T=Math.min(H/8,W/14);if(state!=='run')draw()}
const HUES=[188,300,48,140,265,20,330,100];
// 꼬리 효과(코인 상점): 반짝이·하트·별가루·무지개. 별빛 요격대와 같은 모양
function trailFx(c,X,Y,a,k,r,kind){const t=performance.now()/1000;c.save();c.globalAlpha=a*0.85;c.textAlign='center';c.textBaseline='middle';
 if(kind==='spark'){const z=r*(0.25+a*0.35)*(0.7+0.3*Math.sin(t*12+k*2));c.fillStyle=k%2?'#fff':'#ffe98a';c.beginPath();c.moveTo(X,Y-z*1.6);c.lineTo(X+z*0.4,Y);c.lineTo(X,Y+z*1.6);c.lineTo(X-z*0.4,Y);c.closePath();c.moveTo(X-z*1.6,Y);c.lineTo(X,Y-z*0.4);c.lineTo(X+z*1.6,Y);c.lineTo(X,Y+z*0.4);c.closePath();c.fill()}
 else if(kind==='heart'){c.fillStyle=k%2?'#ff5fa8':'#ff9ec4';c.font=`900 ${Math.round(r*(0.6+a*0.7))}px sans-serif`;c.fillText('♥',X,Y+Math.sin(t*4+k)*r*0.2)}
 else if(kind==='star'){c.fillStyle=k%3?'#ffd23f':'#fff6c8';c.font=`900 ${Math.round(r*(0.5+a*0.7))}px sans-serif`;c.fillText('★',X+Math.sin(k*1.7)*r*0.3,Y+Math.cos(k*2.3)*r*0.3)}
 else{c.fillStyle=`hsl(${(k*36+t*120)%360},95%,62%)`;c.beginPath();c.arc(X,Y,r*(0.3+a*0.5),0,7);c.fill()}
 c.restore()}
const hash=n=>{n=Math.imul(n^0x9e3779b9,0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);return((n^n>>>16)>>>0)/4294967296};
let state='title',P={i:0,y:0,vy:0,g:true},held=false,buf=0,acc=0,camY=0,squash=0,trail=[],parts=[],deadT=0,readyT=0,pauseUsed=false,contUsed=false,lastDist=0,newBest=false,attempts=0,best=0,shownBest=0,lastSub=0,subBest=0,flash=0,beatPulse=0;
try{best=+localStorage.getItem('tt_best_'+KST)||0}catch(e){}subBest=best;shownBest=best;
function px(){return P.i*DX}
function draw(){
 const x=px(),sec=Math.max(0,Math.floor(x/SEC)),now=performance.now()/1000;let hue=HUES[sec%HUES.length],hue2=(hue+60)%360;
 if(TH==='sunset'){hue=[345,10,330][sec%3];hue2=38}else if(TH==='jungle'){hue=[135,155,120][sec%3];hue2=[80,170,55][sec%3]}else if(TH==='snow'){hue=[220,232,208][sec%3];hue2=195}
 const camX=x-(W*0.28)/T,gy=H*0.74,sy=y=>gy-(y-camY)*T,sx=xx=>(xx-camX)*T;
 const bp=x/4,pulse=Math.pow(1-(bp-Math.floor(bp)),3)*(state==='run'?1:0.3);
 // 하늘
 const gr=cx.createLinearGradient(0,0,0,H);if(TH==='sunset'){gr.addColorStop(0,'#2a0b3d');gr.addColorStop(0.55,`hsl(${hue},75%,38%)`);gr.addColorStop(1,'#ff9a3c')}else{gr.addColorStop(0,`hsl(${hue+20},70%,${TH==='snow'?9:6}%)`);gr.addColorStop(1,`hsl(${hue},80%,${TH==='snow'?22:16}%)`)}cx.fillStyle=gr;cx.fillRect(0,0,W,H);
 if(TH==='snow'){cx.fillStyle='#ffffffcc';for(let i=0;i<70;i++){const sp=0.4+hash(i*3)*0.8,yy=((i*53+now*40*sp)%(gy+20))-10,xx=((i*137.5-x*T*0.05+Math.sin(now*sp+i)*14)%W+W)%W,r=1+hash(i*7)*1.8;cx.beginPath();cx.arc(xx,yy,r,0,7);cx.fill()}}
 else{cx.fillStyle=TH==='sunset'?'#ffffff33':'#ffffff66';for(let i=0;i<(TH==='sunset'?18:40);i++){const s=((i*137.5-x*T*0.03)%W+W)%W;cx.fillRect(s,(i*71)%Math.max(1,gy*(TH==='sunset'?0.35:0.7)),1.5,1.5)}}
 // 해(둥근 원 + 줄무늬)
 const sunR=Math.min(W,H)*(TH==='sunset'?0.22:TH==='snow'?0.1:0.16),sunX=W*0.7,sunY=(TH==='snow'?H*0.2:gy-sunR*(TH==='sunset'?0.7:1.25))+camY*T*0.05;
 if(TH==='snow'){cx.save();cx.shadowColor='#dff3ff';cx.shadowBlur=30;cx.fillStyle='#eef7ff';cx.beginPath();cx.arc(sunX,sunY,sunR,0,7);cx.fill();cx.restore();cx.fillStyle=`hsl(${hue},40%,12%)`;cx.beginPath();cx.arc(sunX+sunR*0.38,sunY-sunR*0.15,sunR*0.92,0,7);cx.fill()}
 else{cx.save();cx.beginPath();cx.arc(sunX,sunY,sunR,0,7);cx.clip();
 const sg=cx.createLinearGradient(0,sunY-sunR,0,sunY+sunR);sg.addColorStop(0,TH==='sunset'?'#fff1a8':`hsl(${hue2},100%,65%)`);sg.addColorStop(1,TH==='sunset'?'#ff4f6e':`hsl(${hue},100%,45%)`);cx.fillStyle=sg;cx.fillRect(sunX-sunR,sunY-sunR,sunR*2,sunR*2);
 cx.fillStyle=TH==='sunset'?'#ff9a3c':`hsl(${hue+20},70%,8%)`;for(let k=0;k<6;k++)cx.fillRect(sunX-sunR,sunY+k*sunR*0.17,sunR*2,2+k*1.6);cx.restore()}
 // 빌딩 두 겹(시차)
 for(const [par,col,hmul,wb] of [[0.15,`hsl(${hue},60%,11%)`,0.38,1.6],[0.4,`hsl(${hue},55%,7%)`,0.42,1.1]]){
  const off=x*par,u=T*wb;let i=Math.floor((off-2)/wb);cx.fillStyle=col;
  for(let n=0;n<W/u+3;n++,i++){if(hash(i*5+(par>0.2?9:1))<0.28)continue;const h=(0.12+hash(i*7+(par>0.2?3:0))*hmul)*gy;const X=(i*wb-off)*T;cx.fillRect(X-0.5,gy-h+camY*T*par,u+1,h+H);if(TH==='jungle'){cx.beginPath();cx.arc(X+u/2,gy-h+camY*T*par,u*0.75,0,7);cx.fill()}else if(TH==='snow'){cx.fillStyle='#e8f4ff';cx.fillRect(X-1,gy-h+camY*T*par-2,u+2,4);cx.fillStyle=col}
   if(par>0.2){cx.fillStyle=`hsla(${hue2},100%,75%,0.18)`;for(let wy=gy-h+camY*T*par+8;wy<gy-6;wy+=T*0.45)for(let wx=X+5;wx<X+u-8;wx+=T*0.3)if(hash(i*31+Math.floor(wy)*7+Math.floor(wx))>0.72)cx.fillRect(wx,wy,T*0.1,T*0.14);cx.fillStyle=col}if(hash(i*13)>0.5){cx.fillStyle=`hsla(${hue2},100%,70%,${0.25+pulse*0.4})`;cx.fillRect(X,gy-h+camY*T*par,u-2,2);cx.fillStyle=col}}}
 // 바닥 격자
 const g0=sy(0);cx.fillStyle=`hsl(${hue},70%,5%)`;cx.fillRect(0,g0,W,H-g0);
 cx.strokeStyle=`hsla(${hue2},100%,60%,${0.28+pulse*0.35})`;cx.lineWidth=1;cx.beginPath();
 for(let k=1;k<6;k++){const yy=g0+k*k*T*0.12;cx.moveTo(0,yy);cx.lineTo(W,yy)}
 for(let t=Math.floor(camX/2)*2-8;t<camX+W/T+8;t+=2){const a=sx(t);cx.moveTo(a,g0);cx.lineTo(W*0.28+(a-W*0.28)*2.2,H)}cx.stroke();
 // 물체
 const t0=Math.floor(camX)-2,t1=Math.ceil(camX+W/T)+2,drawn=new Set();
 // 구덩이: 땅 조각 사이 빈 곳을 검은 낭떠러지 + 빨간 경고선으로 그린다(바닥 격자에 묻혀 안 보이던 문제)
 {const gs=[];for(let t=t0-8;t<=t1+8;t++){const bk=B[t];if(bk)for(const o of bk)if(o.k===0&&o.y<0&&!gs.includes(o))gs.push(o)}gs.sort((a,b)=>a.x-b.x);
  for(let k=0;k+1<gs.length;k++){const a=gs[k].x+gs[k].w,b=gs[k+1].x;if(b-a<0.5)continue;const X=sx(a),w=(b-a)*T;
   const pg=cx.createLinearGradient(0,g0,0,H);pg.addColorStop(0,'#000');pg.addColorStop(1,'#12000a');cx.fillStyle=pg;cx.fillRect(X,g0,w,H-g0);
   cx.fillStyle=`rgba(255,61,127,${0.55+pulse*0.45})`;cx.fillRect(X-1,g0,3,H-g0);cx.fillRect(X+w-2,g0,3,H-g0);
   cx.fillStyle='rgba(255,61,127,0.35)';cx.fillRect(X-4,g0,9,H-g0);cx.fillRect(X+w-5,g0,9,H-g0);
   cx.fillStyle='#ff3d7f';cx.font=`900 ${Math.round(T*0.42)}px sans-serif`;cx.textAlign='center';for(let yy=g0+T*0.55;yy<H;yy+=T*0.8)cx.fillText('▼',X+w/2,yy)}}
 for(let t=t0;t<=t1;t++){const bk=B[t];if(!bk)continue;for(const o of bk){if(drawn.has(o))continue;drawn.add(o);
  if(o.k===0){const X=sx(o.x),Y=sy(o.y+o.h),w=o.w*T,h=Math.min(o.h*T,H);
   if(o.y<0){cx.fillStyle=`hsla(${hue2},100%,60%,${0.5+pulse*0.5})`;cx.fillRect(X,Y-1,w,3);continue}
   cx.fillStyle=`hsl(${hue},60%,12%)`;cx.fillRect(X,Y,w,h);cx.strokeStyle=`hsla(${hue2},100%,65%,0.25)`;cx.lineWidth=6;cx.strokeRect(X+2,Y+2,w-4,h-4);
   cx.strokeStyle=`hsl(${hue2},100%,70%)`;cx.lineWidth=2;cx.strokeRect(X+2,Y+2,w-4,h-4);
   cx.strokeStyle=`hsla(${hue2},100%,70%,0.35)`;cx.lineWidth=1;cx.beginPath();for(let k=1;k<o.w;k++){cx.moveTo(X+k*T,Y+4);cx.lineTo(X+k*T,Y+h-4)}for(let k=1;k<o.h;k++){cx.moveTo(X+4,Y+k*T);cx.lineTo(X+w-4,Y+k*T)}cx.stroke()}
  else if(o.k===1){const X=sx(o.x),Y=sy(o.y);cx.beginPath();cx.moveTo(X+T*0.12,Y);cx.lineTo(X+T*0.5,Y-T*0.82);cx.lineTo(X+T*0.88,Y);cx.closePath();
   cx.fillStyle='#2a0414';cx.fill();cx.strokeStyle='rgba(255,61,127,0.3)';cx.lineWidth=6;cx.stroke();cx.strokeStyle='#ff3d7f';cx.lineWidth=2;cx.stroke();
   cx.fillStyle='#ffd1e0';cx.fillRect(X+T*0.47,Y-T*0.55,T*0.06,T*0.2)}
  else if(o.k===2){const X=sx(o.x),Y=sy(o.y);const bg=cx.createLinearGradient(0,Y,0,Y-T);bg.addColorStop(0,'rgba(255,210,63,0.35)');bg.addColorStop(1,'rgba(255,210,63,0)');cx.fillStyle=bg;cx.fillRect(X+T*0.1,Y-T,T*0.8,T);cx.fillStyle='#ffd23f';cx.fillRect(X+T*0.1,Y-T*0.18,T*0.8,T*0.18);cx.strokeStyle='#ffd23f';cx.lineWidth=3;
   for(let k=0;k<2;k++){const yy=Y-T*(0.35+k*0.3)-pulse*T*0.08;cx.globalAlpha=0.9-k*0.35;cx.beginPath();cx.moveTo(X+T*0.25,yy+T*0.12);cx.lineTo(X+T*0.5,yy-T*0.05);cx.lineTo(X+T*0.75,yy+T*0.12);cx.stroke()}cx.globalAlpha=1}}}
 // 최고 기록 깃발
 if(best>8&&sx(best)>-T&&sx(best)<W+T){const X=sx(best),Y=sy(0);cx.strokeStyle='#fff';cx.lineWidth=2;cx.beginPath();cx.moveTo(X,Y);cx.lineTo(X,Y-T*2.6);cx.stroke();cx.fillStyle='#fff';cx.beginPath();cx.moveTo(X,Y-T*2.6);cx.lineTo(X+T*0.8,Y-T*2.35);cx.lineTo(X,Y-T*2.1);cx.fill();
  cx.font=`700 ${Math.round(T*0.28)}px sans-serif`;cx.textAlign='left';cx.fillText('BEST',X+4,Y-T*2.7)}
 // 꼬리 + 통통이
 if(state!=='dead'&&state!=='over'){for(let k=0;k<trail.length;k++){const p=trail[k],a=(k+1)/trail.length;if(DES==='whale'){const X0=sx(p[0]),Y0=sy(p[1]+R);cx.fillStyle=`hsla(${(200+k*14+performance.now()/20)%360},95%,72%,${a*0.6})`;cx.beginPath();cx.arc(X0,Y0,R*T*(0.25+a*0.45),0,7);cx.fill();if(k%2===0){cx.fillStyle=`rgba(255,255,255,${a*0.9})`;cx.fillRect(X0-2+Math.sin(k+performance.now()/200)*R*T*0.5,Y0-R*T*0.6,3,3)}continue}if(TRL){trailFx(cx,sx(p[0]),sy(p[1]+R),a,k,R*T,TRL);continue}cx.fillStyle=`hsla(${hue2},100%,70%,${a*0.35})`;cx.beginPath();cx.arc(sx(p[0]),sy(p[1]+R),R*T*(0.3+a*0.5),0,7);cx.fill()}
  const X=sx(x),Y=sy(P.y+R),sq=squash>0?squash:0,st=P.g?0:Math.min(0.18,Math.abs(P.vy)/120);
  cx.save();cx.translate(X,Y+R*T*sq*0.25);cx.scale(1+sq*0.25-st*0.5,1-sq*0.25+st);
  cx.fillStyle=SKC[1]+'40';cx.beginPath();cx.arc(0,0,R*T*1.35,0,7);cx.fill();
  if(DES==='whale'){const r=R*T,w=Math.sin(performance.now()/160)*0.12;cx.fillStyle='#4b3df0';cx.strokeStyle='#e9fdff';cx.lineWidth=2;cx.beginPath();cx.moveTo(-0.85*r,0.1*r);cx.quadraticCurveTo(-1.35*r,-0.2*r,-1.6*r,(-0.75+w)*r);cx.quadraticCurveTo(-1.35*r,-0.15*r,-1.75*r,(0.15-w)*r);cx.quadraticCurveTo(-1.3*r,0.25*r,-0.85*r,0.4*r);cx.closePath();cx.fill();cx.stroke();
   if(!P.g){const t=performance.now()/1000;for(let k=0;k<5;k++){const a=-Math.PI/2+(k-2)*0.38,d=(1.5+((t*2+k*0.37)%1)*0.9)*r;cx.save();cx.translate(Math.cos(a)*d*0.8+0.2*r,-0.5*r+Math.sin(a)*d);cx.rotate(t*3+k);cx.fillStyle=k%2?'#ffd23f':'#aef7ff';cx.beginPath();for(let q=0;q<10;q++){const rr=(q%2?0.09:0.22)*r,aa=q*Math.PI/5;cx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr)}cx.fill();cx.restore()}}}
  const og=cx.createRadialGradient(-R*T*0.3,-R*T*0.35,R*T*0.1,0,0,R*T);og.addColorStop(0,SKC[0]);og.addColorStop(0.45,SKC[1]);og.addColorStop(1,SKC[2]);cx.fillStyle=og;cx.beginPath();cx.arc(0,0,R*T,0,7);cx.fill();
  cx.strokeStyle='#ffffffcc';cx.lineWidth=2;cx.stroke();
  const r=R*T,blink=(Math.floor(performance.now()/1800)%3===0&&performance.now()%1800<120)?0.15:1;
  if(DES==='whale'){cx.fillStyle='rgba(214,200,255,0.35)';cx.beginPath();cx.ellipse(0.1*r,0.45*r,0.72*r,0.3*r,0,0,Math.PI);cx.fill();const tw=0.6+0.4*Math.sin(performance.now()/250),pts=[[-0.55,-0.35],[-0.25,-0.62],[0.05,-0.5],[-0.12,-0.2],[-0.48,-0.05]];cx.strokeStyle='rgba(255,255,255,0.6)';cx.lineWidth=1.2;cx.beginPath();pts.forEach((q,i)=>i?cx.lineTo(q[0]*r,q[1]*r):cx.moveTo(q[0]*r,q[1]*r));cx.stroke();cx.fillStyle=`rgba(255,255,255,${tw})`;for(const q of pts){cx.beginPath();cx.arc(q[0]*r,q[1]*r,0.07*r,0,7);cx.fill()}}
  else if(DES==='cat'){for(const e0 of [-0.6,0.12]){cx.fillStyle=SKC[1];cx.beginPath();cx.moveTo(e0*r,-0.72*r);cx.lineTo((e0+0.2)*r,-1.38*r);cx.lineTo((e0+0.52)*r,-0.86*r);cx.closePath();cx.fill();cx.strokeStyle='#ffffffcc';cx.lineWidth=2;cx.stroke();
    cx.fillStyle='#ff9ec4';cx.beginPath();cx.moveTo((e0+0.1)*r,-0.82*r);cx.lineTo((e0+0.21)*r,-1.18*r);cx.lineTo((e0+0.4)*r,-0.88*r);cx.closePath();cx.fill()}
   cx.strokeStyle='#ffffffcc';cx.lineWidth=1.5;cx.beginPath();cx.moveTo(0.72*r,0.05*r);cx.lineTo(1.3*r,-0.08*r);cx.moveTo(0.72*r,0.18*r);cx.lineTo(1.3*r,0.26*r);cx.stroke()}
  else if(DES==='frog'){for(const ex of [-0.05,0.55]){cx.fillStyle=SKC[1];cx.beginPath();cx.arc(ex*r,-0.82*r,0.32*r,0,7);cx.fill();cx.strokeStyle='#ffffffcc';cx.lineWidth=2;cx.stroke();
    cx.fillStyle='#fff';cx.beginPath();cx.arc(ex*r,-0.84*r,0.22*r,0,7);cx.fill();cx.fillStyle='#0b1026';cx.beginPath();cx.ellipse((ex+0.06)*r,-0.84*r,0.11*r,0.13*r*blink,0,0,7);cx.fill()}
   cx.strokeStyle='#0b1026';cx.lineWidth=2.5;cx.beginPath();cx.arc(0.35*r,-0.05*r,0.42*r,0.35,Math.PI-0.35);cx.stroke()}
  else if(DES==='astro'){cx.fillStyle='rgba(200,240,255,0.13)';cx.beginPath();cx.arc(0,-0.05*r,1.28*r,0,7);cx.fill();cx.strokeStyle='#e9fdff';cx.lineWidth=3;cx.stroke();
   cx.strokeStyle='#ffffffaa';cx.lineWidth=2.5;cx.beginPath();cx.arc(0,-0.05*r,1.05*r,3.6,4.5);cx.stroke();
   cx.strokeStyle='#e9fdff';cx.lineWidth=2;cx.beginPath();cx.moveTo(0,-1.33*r);cx.lineTo(0,-1.7*r);cx.stroke();cx.fillStyle='#ff3d7f';cx.beginPath();cx.arc(0,-1.75*r,0.15*r,0,7);cx.fill()}
  else{cx.strokeStyle=SKC[0];cx.lineWidth=2;cx.beginPath();cx.moveTo(-R*T*0.2,-R*T*0.9);cx.quadraticCurveTo(-R*T*0.1,-R*T*1.5,R*T*0.25,-R*T*1.45);cx.stroke();cx.fillStyle='#ff3d7f';cx.beginPath();cx.arc(R*T*0.25,-R*T*1.45,R*T*0.16,0,7);cx.fill()}
  if(DES!=='frog'){cx.fillStyle='#0b1026';
  for(const ex of [0.12,0.52]){cx.beginPath();cx.ellipse(R*T*ex,-R*T*0.12,R*T*0.13,R*T*0.22*blink,0,0,7);cx.fill()}
  cx.fillStyle='#fff';for(const ex of [0.16,0.56]){cx.beginPath();cx.arc(R*T*ex,-R*T*0.2,R*T*0.05,0,7);cx.fill()}}
  cx.fillStyle='#ff9ec4aa';cx.beginPath();cx.ellipse(R*T*0.7,R*T*0.2,R*T*0.12,R*T*0.07,0,0,7);cx.fill();
  cx.restore()}
 for(const p of parts){cx.fillStyle=p.c;cx.globalAlpha=Math.max(0,Math.min(1,p.l));const X=sx(p.x),Y=sy(p.y);if(!p.sh)cx.fillRect(X-p.s/2,Y-p.s/2,p.s,p.s);else fxDraw(p,X,Y)}cx.globalAlpha=1;
 if(flash>0){cx.fillStyle=`rgba(255,255,255,${flash*0.5})`;cx.fillRect(0,0,W,H)}
 // HUD
 if(state!=='title'&&state!=='over'){const fs=Math.round(Math.max(14,Math.min(30,H*0.06)));cx.textAlign='center';cx.font=`800 ${fs}px sans-serif`;cx.fillStyle='#fff';cx.shadowColor='#000';cx.shadowBlur=6;
  cx.fillText(Math.floor(Math.max(0,x))+'m',W/2,fs+12);cx.font=`600 ${Math.round(fs*0.55)}px sans-serif`;cx.fillStyle='#cfefff';
  cx.fillText(`시도 ${attempts} · 오늘 최고 ${shownBest}m · ${bpmAt(x)} BPM`,W/2,fs*1.75+12);
  const pr=(x%SEC)/SEC,bw=Math.min(W*0.5,360);cx.fillStyle='#ffffff22';cx.fillRect(W/2-bw/2,fs*2.2+12,bw,4);cx.fillStyle=`hsl(${hue2},100%,65%)`;cx.fillRect(W/2-bw/2,fs*2.2+12,bw*pr,4);cx.shadowBlur=0;
  if(H>W*1.1&&x<60&&state!=='dead'){cx.font=`700 ${Math.round(fs*0.6)}px sans-serif`;cx.fillStyle='#ffd23f';cx.fillText('📱 가로로 돌리면 더 넓게 보여요',W/2,H*0.3)}
  if(state==='ready'){cx.font=`900 ${fs*1.6}px sans-serif`;cx.fillStyle='#ffd23f';cx.fillText('READY',W/2,H*0.45)}
  if(x>2&&x<SEC*0.12&&attempts<=2&&state==='run'){cx.font=`700 ${Math.round(fs*0.7)}px sans-serif`;cx.fillStyle='#fff';cx.fillText(COARSE?'화면을 누르면 점프!':'스페이스바·클릭으로 점프!',W/2,H*0.42)}
  if(x>=SEC&&x%SEC<10&&state==='run'){cx.font=`900 ${Math.round(fs*1.1)}px sans-serif`;cx.fillStyle=`hsl(${hue2},100%,70%)`;cx.fillText('SECTION '+(sec+1)+' · SPEED UP',W/2,H*0.4)}}
 else if(state==='title'){const fs=Math.round(Math.max(18,Math.min(44,H*0.1)));cx.textAlign='center';cx.font=`900 ${fs}px sans-serif`;cx.fillStyle='#fff';cx.shadowColor='#22d3ee';cx.shadowBlur=18;cx.fillText('통통 네온런',W/2,H*0.26);cx.shadowBlur=0;
  cx.font=`600 ${Math.round(fs*0.4)}px sans-serif`;cx.fillStyle='#cfefff';cx.fillText(best?`오늘 최고 ${best}m · 오늘의 코스 ${KST.slice(5)}`:`오늘의 코스 ${KST.slice(5)} · 박자에 맞춰 점프!`,W/2,H*0.26+fs*0.8)}
 if(state==='paused'){cx.fillStyle='#07031a';cx.fillRect(0,0,W,H);const fs=Math.round(Math.max(18,Math.min(40,H*0.08)));cx.textAlign='center';cx.fillStyle='#fff';cx.font=`900 ${fs}px sans-serif`;cx.fillText('일시정지',W/2,H*0.3);
  cx.font=`600 ${Math.round(fs*0.5)}px sans-serif`;cx.fillStyle='#cfefff';cx.fillText(`${Math.floor(Math.max(0,x))}m · 이번 판 남은 일시정지 ${pauseUsed?0:1}번 · 이어 달리면 3초 뒤 출발`,W/2,H*0.3+fs*0.9)}
 if(state==='count'){const n=Math.ceil(readyT),fs=Math.round(Math.max(40,Math.min(120,H*0.25)));cx.fillStyle='rgba(7,3,26,0.45)';cx.fillRect(0,0,W,H);cx.textAlign='center';cx.font=`900 ${fs}px sans-serif`;cx.fillStyle='#ffd23f';cx.fillText(String(n),W/2,H*0.5)}
 if(state==='over'){cx.fillStyle='rgba(7,3,26,0.78)';cx.fillRect(0,0,W,H);const fs=Math.round(Math.max(36,Math.min(96,H*0.16)));cx.textAlign='center';
  cx.font=`700 ${Math.round(fs*0.3)}px sans-serif`;cx.fillStyle='#ff3d7f';cx.fillText(newBest?'★ 오늘 최고 기록! ★':'꽈당! 여기까지 달렸어요',W/2,H*0.17);
  cx.font=`900 ${fs}px sans-serif`;cx.fillStyle=newBest?'#ffd23f':'#fff';cx.shadowColor=newBest?'#ffd23f':'#22d3ee';cx.shadowBlur=18;cx.fillText(lastDist+'m',W/2,H*0.17+fs*1.05);cx.shadowBlur=0;
  cx.font=`600 ${Math.round(fs*0.24)}px sans-serif`;cx.fillStyle='#cfefff';cx.fillText(`오늘 최고 ${best}m · 시도 ${attempts}번`,W/2,H*0.17+fs*1.5)}
}
// 디자인 스킨별 점프·착지 효과(겉모습만, 판정·속도 동일)
function fxDraw(p,X,Y){const r=p.s*T/26;
 if(p.sh==='paw'){cx.beginPath();cx.ellipse(X,Y+r*0.15,r*0.5,r*0.42,0,0,7);cx.fill();for(const [a,b] of [[-0.5,-0.35],[-0.18,-0.62],[0.18,-0.62],[0.5,-0.35]]){cx.beginPath();cx.arc(X+a*r,Y+b*r,r*0.17,0,7);cx.fill()}}
 else if(p.sh==='ring'){const k=1+(1-p.l)*2.6;cx.strokeStyle=p.c;cx.lineWidth=2;cx.beginPath();cx.ellipse(X,Y,r*k,r*k*0.32,0,0,7);cx.stroke()}
 else if(p.sh==='puff'){const k=1+(1-p.l)*1.5;cx.beginPath();cx.arc(X,Y,r*k*0.5,0,7);cx.fill()}
 else if(p.sh==='star'){cx.save();cx.translate(X,Y);cx.rotate(p.l*6);cx.beginPath();for(let q=0;q<10;q++){const rr=(q%2?0.2:0.5)*r,aa=q*Math.PI/5;cx.lineTo(Math.cos(aa)*rr,Math.sin(aa)*rr)}cx.fill();cx.restore()}
 else if(p.sh==='heart'){const h=r*0.5;cx.beginPath();cx.moveTo(X,Y+h);cx.bezierCurveTo(X-h*1.6,Y-h*0.2,X-h*0.6,Y-h*1.2,X,Y-h*0.4);cx.bezierCurveTo(X+h*0.6,Y-h*1.2,X+h*1.6,Y-h*0.2,X,Y+h);cx.fill()}}
function skinFx(k){const x=px(),y=P.y,add=o=>parts.push(Object.assign({x,y,vx:0,vy:0,l:1,s:6,c:SKC[1]},o)),rnd=Math.random;
 if(DES==='cat'){if(k==='land'){add({sh:'paw',x:x-0.25,s:14,c:'#ff9ec4',g:0,l:0.9});add({sh:'paw',x:x+0.25,s:14,c:'#ff9ec4',g:0,l:0.9})}else for(let i=0;i<3;i++)add({sh:'heart',x:x-0.2+i*0.2,y:y+R,vx:-1+i,vy:4+rnd()*2,s:12,c:'#ff5fa2',g:0.3});return}
 if(DES==='frog'){if(k==='land'){add({sh:'ring',s:14,c:'#7fd4ff',g:0});add({sh:'ring',s:8,c:'#bff0ff',g:0,l:0.8})}for(let i=0;i<6;i++)add({x:x+(rnd()-0.5)*0.6,y:y+0.1,vx:(rnd()-0.5)*5,vy:3+rnd()*4,s:5,c:i%2?'#7fd4ff':'#3ddc84'});return}
 if(DES==='astro'){if(k==='jump'){for(let i=0;i<6;i++)add({sh:'puff',x:x-0.2+(rnd()-0.5)*0.4,y:y+0.15,vx:-2-rnd()*3,vy:(rnd()-0.3)*1.5,s:12,c:'rgba(230,240,255,0.75)',g:0});for(let i=0;i<8;i++)add({x:x-0.1,y:y+0.2,vx:-3-rnd()*4,vy:rnd()*2,s:6,c:i%2?'#ff8a3d':'#ffd23f',g:0.2})}else for(let i=0;i<4;i++)add({sh:'puff',x:x+(i-1.5)*0.3,vx:(i-1.5)*1.2,vy:0.5,s:10,c:'rgba(200,210,230,0.55)',g:0});return}
 if(DES==='whale'){const n=k==='jump'?7:5;for(let i=0;i<n;i++)add({sh:'star',y:y+R*(k==='jump'?2:0.3),vx:(i-(n-1)/2)*(k==='jump'?1.6:2.6),vy:k==='jump'?7+rnd()*2:2+rnd()*2,s:12,c:i%2?'#ffd23f':'#aef7ff',g:0.6});return}
 if(k==='land')for(let i=0;i<5;i++)add({vx:(rnd()-0.5)*6,vy:1+rnd()*2,s:4,c:SKC[0],l:0.6})}
// ── 진행
let SKC=['#e9fdff','#22d3ee','#0e7490'],DES='base',TH='base',TRL='',CHIP=false;// 2단계: 배경 테마·꼬리 효과·8비트 사운드 팩(모두 겉모습·소리만)
// 출석 보너스 '내 네온 색'·디자인 스킨(겉모습만, 판정 동일)
function reset(){try{if(window.Bonus){SKC=Bonus.skin().c;DES=Bonus.design('tongtong');TH=Bonus.theme('tongtong');TRL=Bonus.trail();CHIP=Bonus.sound()==='chip';if(DES==='whale')SKC=['#9fd8ff','#4b5dff','#6a2bd8']}}catch(e){}P={i:0,y:0,vy:0,g:true};SAFE=[];acc=0;trail=[];squash=0;camY=0;lastN=-1;buf=0}
function tick(){
 const wasG=P.g,jump=P.g&&(held||buf>0)||(DEBUG&&window.__ttBot&&bot());buf-=STEP;
 const ok=sim(P,jump,0);if(jump)sfx.jump();if(P.pad){P.pad=0;sfx.pad()}
 if(!wasG&&P.g){squash=1;skinFx('land')}if(jump&&wasG)skinFx('jump');
 if(!ok){die();return}
 const x=px();if(P.i%3===0){trail.push([x,P.y]);if(trail.length>10)trail.shift()}
 if(P.g&&P.i%6===0){SAFE.push(clone(P));if(SAFE.length>80)SAFE.shift()}
 ensure(x+90);
}
function bot(){if(!P.g)return false;const w=clone(P);let ok=sim(w,false,0),c=0;while(ok&&!w.g&&c++<400)ok=sim(w,false,0);return !(ok&&solve([w],px()+30,0,false).length)}
function die(){state='dead';deadT=0.75;flash=1;sfx.die();const x=px(),dist=Math.floor(x);if(dist>=500&&!DEBUG&&window.Bonus)Bonus.ach('tt500');
 for(let k=0;k<26;k++){const a=Math.random()*7,v=2+Math.random()*7;parts.push({x,y:P.y+R,vx:Math.cos(a)*v,vy:Math.sin(a)*v+3,l:1,s:3+Math.random()*6,c:k%3?SKC[1]:'#ff3d7f'})}
 lastDist=dist;newBest=dist>best&&dist>0;if(dist>best){best=dist;try{localStorage.setItem('tt_best_'+KST,best)}catch(e){}}
 held=false;if(!DEBUG&&window.Bonus)Bonus.played('tongtong');submit()}
// 죽으면 멈추고 결과 화면: 거리·오늘 최고·다시 시작(가운데)·공유·순위. 버튼을 눌러야 새 판 시작.
function over(){state='over';$('tt-go').hidden=false;$('tt-go').textContent='↻ 다시 시작';$('tt-ov').style.display='flex';
 const co=$('tt-co');co.hidden=contUsed||DEBUG||!window.Bonus;if(!co.hidden)co.textContent='🪙3 이어 달리기 (보유 '+Bonus.coins()+')';draw()}
// 이어 달리기: 코인 3개로 죽은 곳 바로 앞 안전한 지점에서 다시(한 판에 1번). 거리는 이어서 셈.
function cont(){if(state!=='over'||contUsed)return;if(!Bonus.spend(3)){Bonus.toast('🪙 코인이 모자라요. 출석·미션으로 모아요!');return}contUsed=true;
 // 실제로 밟고 지나온 땅 중 죽은 곳에서 2칸 이상 앞 + 거기서 살아 나갈 길이 있는(검사기 통과) 지점. 없으면 조각 시작점
 let cp=null;for(let k=SAFE.length-1;k>=0&&!cp;k--){const c=SAFE[k];if(c.i*DX<lastDist-2&&solve([c],c.i*DX+16,0.05,false).length)cp=c}
 if(!cp){cp=CPS[0];for(const c of CPS)if(c.i*DX<lastDist-1)cp=c}P=clone(cp);acc=0;trail=[];squash=0;held=false;lastN=Math.floor(px());
 $('tt-go').hidden=true;$('tt-ov').style.display='none';state='count';readyT=3;padUI()}
function shareBest(){shareText('5락실 통통 네온런 '+KST.slice(5)+'\n🎵 오늘 코스 '+best+'m 달렸어요. 이겨 볼래?\n'+challengeUrl(best))}
function submit(){if(DEBUG||best<=subBest||!window.submitScore)return;subBest=best;lastSub=performance.now();submitScore(best)}
function restart(){reset();attempts++;shownBest=best;pauseUsed=false;contUsed=false;padUI();state='run'}
// 일시정지: 한 번 달릴 때(시도마다) 직접 멈춤 1회. 탭 전환·전화 같은 자동 멈춤은 횟수에 안 셈. 멈춘 동안 코스를 가리고, 이어 달릴 때 3-2-1.
function pause(auto){if(state!=='run'&&state!=='ready'&&state!=='count')return;if(!auto){if(pauseUsed||state!=='run')return;pauseUsed=true}state='paused';held=false;$('tt-go').hidden=false;$('tt-go').textContent='▶ 이어 달리기';padUI();draw()}
function padUI(){const b=$('tt-pa');if(!b)return;b.disabled=pauseUsed;b.style.opacity=pauseUsed?0.35:1;b.title=pauseUsed?'이번 판 일시정지를 이미 썼어요':'일시정지(한 판에 1번)'}
let last=0,raf=0;
function frame(now){raf=requestAnimationFrame(frame);const rdt=Math.min(0.05,(now-last)/1000||0);last=now;
 if(state==='run'){acc+=rdt*kAt(px());let n=0;while(acc>=STEP&&n++<40){acc-=STEP;tick();if(state!=='run')break}music(px())}
 else if(state==='dead'){deadT-=rdt;if(deadT<=0)over()}
 else if(state==='ready'){readyT-=rdt;if(readyT<=0)state='run'}
 else if(state==='count'){readyT-=rdt;if(readyT<=0)state='run'}
 squash=Math.max(0,squash-rdt*6);flash=Math.max(0,flash-rdt*3);
 for(const p of parts){p.vy-=20*(p.g===undefined?1:p.g)*rdt;p.x+=p.vx*rdt;p.y+=p.vy*rdt;p.l-=rdt*1.4}parts=parts.filter(p=>p.l>0);
 const ty=Math.max(0,P.y-2.2);camY+=(ty-camY)*Math.min(1,rdt*5);
 draw()}
// ── 시작·종료·전체 화면
function full(){if(!COARSE)return;const el=document.documentElement;try{if(el.requestFullscreen&&!document.fullscreenElement)el.requestFullscreen({navigationUI:'hide'}).then(()=>{try{screen.orientation.lock('landscape').catch(()=>{})}catch(e){}}).catch(()=>{});else if(el.webkitRequestFullscreen)el.webkitRequestFullscreen()}catch(e){}}
function go(){audio();full();cab.classList.add('on');document.documentElement.style.overflow='hidden';$('tt-go').hidden=true;$('tt-ov').style.display='none';
 if(IOS&&!navigator.standalone){$('tt-ios').style.display='block';setTimeout(()=>$('tt-ios').style.display='none',4500)}
 ensure(200);size();
 if(state==='title'){reset();attempts++;pauseUsed=false;contUsed=false;state='ready';readyT=0.7}else if(state==='paused'){state='count';readyT=3}else if(state==='over'){restart();state='ready';readyT=0.5}
 padUI()
 cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(frame)}
function exit(){cancelAnimationFrame(raf);submit();state='title';$('tt-ov').style.display='none';reset();cab.classList.remove('on');document.documentElement.style.overflow='';$('tt-go').hidden=false;$('tt-go').textContent='▶ 다시 달리기';
 try{if(document.fullscreenElement)document.exitFullscreen()}catch(e){}
 $('tt-msg').textContent=best?`오늘 최고 ${best}m (시도 ${attempts}번) `:'';if(best){const b=document.createElement('button');b.className='share';b.type='button';b.textContent='결과 공유';
  b.onclick=()=>shareText('5락실 통통 네온런 '+KST.slice(5)+'\n🎵 오늘 코스 '+best+'m 달렸어요. 이겨 볼래?\n'+challengeUrl(best));$('tt-msg').appendChild(b)}
 setTimeout(()=>{size();const rb=document.getElementById('rankbox');if(rb&&best)rb.scrollIntoView({behavior:'smooth',block:'center'})},60)}
$('tt-go').onclick=e=>{e.stopPropagation();go()};
$('tt-x').onclick=e=>{e.stopPropagation();exit()};
$('tt-sh').onclick=e=>{e.stopPropagation();shareBest()};
$('tt-co').onclick=e=>{e.stopPropagation();cont()};
$('tt-rk').onclick=e=>{e.stopPropagation();exit()};
function muteUI(){$('tt-mu').textContent=muted?'🔇':'🔊'}muteUI();
$('tt-mu').onclick=e=>{e.stopPropagation();muted=!muted;try{localStorage.setItem('tt_mute',muted?'1':'0')}catch(x){}if(master)master.gain.value=muted?0:0.5;muteUI()};
const press=()=>{if(state==='run'||state==='ready'){held=true;buf=0.12}};
cab.addEventListener('pointerdown',e=>{if(e.target.tagName==='BUTTON')return;if(!cab.classList.contains('on'))return;e.preventDefault();press()});
addEventListener('pointerup',()=>held=false);addEventListener('pointercancel',()=>held=false);
addEventListener('keydown',e=>{if(!cab.classList.contains('on'))return;if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW'){e.preventDefault();if(!e.repeat)press();held=true}else if(e.code==='Enter'&&state==='over'){e.preventDefault();go()}else if(e.code==='KeyP')pause(false);else if(e.code==='Escape')exit()});
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowUp'||e.code==='KeyW')held=false});
cab.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause(true);submit()}});
addEventListener('blur',()=>{if(cab.classList.contains('on'))pause(true)});
$('tt-pa').onclick=e=>{e.stopPropagation();pause(false)};
addEventListener('pagehide',submit);
document.addEventListener('fullscreenchange',()=>setTimeout(size,50));
if(window.ResizeObserver)new ResizeObserver(()=>size()).observe(cab);else addEventListener('resize',size);
// 첫 화면: 코스 앞부분을 미리 만들어 둔다(시작할 때 끊김 방지)
const warm=()=>{ensure(260);size()};if('requestIdleCallback' in window)requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,300);
size();
if(DEBUG)window.__tt={go,exit,get state(){return state},get x(){return px()},set bot(v){window.__ttBot=v},jumpTo(x){ensure(x+120);P={i:Math.round(x/DX),y:0,vy:0,g:true};lastN=Math.floor(x)},B,ensure,solve,simStep:(st,j)=>sim(st,j,0),fast(n){for(let k=0;k<n&&state==='run';k++)tick();return [state,Math.round(px())]}};
})();
