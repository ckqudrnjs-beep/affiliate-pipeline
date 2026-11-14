// 5락실 "네온 사격장" — 브라우저 3D 사격 게임(three.js). 오리지널 이름·무기·맵.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { materials, buildRifle, buildSniper } from './weapons.js';
import { buildWorld, makeEnv, targetKit, canvasTex } from './world.js';
import { Sfx } from './audio.js';

const BASE = { plate: 100, slider: 150, drone: 200, far: 500, gold: 100, zombie: 250 };
const CSS = `
.rg3{position:fixed;inset:0;z-index:2147483000;background:#05030c;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overflow:hidden;color:#fff;font-family:"Black Han Sans","Noto Sans KR",sans-serif;cursor:crosshair}
.rg3 canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.rg3 button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rg3 .px{font-family:"Press Start 2P",monospace}
.rg3 .hud{position:absolute;inset:0;pointer-events:none}
.rg3 .tl{position:absolute;left:max(14px,env(safe-area-inset-left));top:12px;text-shadow:0 0 10px #ff2e88}
.rg3 .tl b{display:block;font-size:22px;font-family:"Press Start 2P",monospace;color:#fff}
.rg3 .tl span{font-size:15px;color:#ffd23f;text-shadow:0 0 8px #ffb000}
.rg3 .tc{position:absolute;left:50%;top:10px;transform:translateX(-50%);font-family:"Press Start 2P",monospace;font-size:20px;padding:8px 12px;border:2px solid #22e5ff;border-radius:10px;background:#05030c99;box-shadow:0 0 14px #22e5ff88,inset 0 0 10px #22e5ff44}
.rg3 .goal{position:absolute;left:50%;top:62px;transform:translateX(-50%);font-size:15px;white-space:nowrap;text-shadow:0 0 8px #000,0 1px 0 #000}.rg3 .goal b{color:#ffd23f}.rg3 .goal.ok b{color:#3ddc84}
.rg3 .dmg{position:absolute;inset:0;background:radial-gradient(circle,transparent 45%,#ff1f4fcc);opacity:0;transition:opacity .4s}
.rg3 .cnt small{display:block;font-size:20px;color:#22e5ff;text-shadow:0 0 10px #22e5ff;margin-bottom:14px}.rg3 .cnt em{display:block;font-style:normal;font-family:'Black Han Sans',sans-serif;font-size:20px;color:#fff;margin-top:14px}
.rg3 .tc.low{border-color:#ff2e88;color:#ff6fae;box-shadow:0 0 16px #ff2e88}
.rg3 .tr{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:14px;text-align:right}
.rg3 .tr .wn{display:block;font-size:14px;color:#cfc6ff;letter-spacing:1px}
.rg3 .tr b{font-family:"Press Start 2P",monospace;font-size:30px;text-shadow:0 0 12px var(--ac,#22e5ff)}
.rg3 .tr small{font-family:"Press Start 2P",monospace;font-size:12px;color:#a99fc9}
.rg3 .tr .rb{height:5px;background:#ffffff22;border-radius:3px;margin-top:6px;overflow:hidden;width:150px;margin-left:auto}.rg3 .tr .rb i{display:block;height:100%;width:0;background:var(--ac,#22e5ff);box-shadow:0 0 8px var(--ac)}
.rg3 .xh{position:absolute;left:50%;top:50%;width:0;height:0;transition:opacity .1s}
.rg3 .xh i{position:absolute;background:#fff;box-shadow:0 0 4px #000,0 0 6px #22e5ff}
.rg3 .xh i:nth-child(1),.rg3 .xh i:nth-child(2){width:2px;height:10px;left:-1px}.rg3 .xh i:nth-child(3),.rg3 .xh i:nth-child(4){height:2px;width:10px;top:-1px}
.rg3 .xh b{position:absolute;width:3px;height:3px;left:-1.5px;top:-1.5px;background:#ff2e88;border-radius:50%}
.rg3.xh-gold .xh i{background:#ffd23f;box-shadow:0 0 4px #000,0 0 8px #ffd23f}.rg3.xh-gold .xh b{background:#fff}
.rg3.xh-ring .xh i{opacity:.0}.rg3.xh-ring .xh b{width:22px;height:22px;left:-11px;top:-11px;background:none;border:2px solid #3ddc84;box-shadow:0 0 6px #3ddc84,inset 0 0 4px #3ddc84}.rg3.xh-ring .xh b::after{content:'';position:absolute;left:8px;top:8px;width:2px;height:2px;border-radius:50%;background:#3ddc84}
.rg3.xh-heart .xh i{background:#ff7ad9;box-shadow:0 0 4px #000,0 0 8px #ff7ad9}.rg3.xh-heart .xh b{width:auto;height:auto;left:-6px;top:-8px;background:none;color:#ff3d9a;font-size:12px;line-height:1}.rg3.xh-heart .xh b::after{content:'♥'}
.rg3 .hm{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;opacity:0;transform:rotate(45deg)}
.rg3 .hm:before,.rg3 .hm:after{content:"";position:absolute;background:#fff;box-shadow:0 0 6px #fff}.rg3 .hm:before{left:12px;top:0;width:2px;height:26px}.rg3 .hm:after{top:12px;left:0;height:2px;width:26px}
.rg3 .hm.bull:before,.rg3 .hm.bull:after{background:#ff2e88;box-shadow:0 0 8px #ff2e88}
.rg3 .scope{position:absolute;inset:0;display:none}
.rg3 .scope .ring{position:absolute;left:50%;top:50%;width:84vmin;height:84vmin;margin:-42vmin 0 0 -42vmin;border-radius:50%;box-shadow:0 0 0 200vmax #000,inset 0 0 6vmin 2vmin #000,inset 0 0 0 .6vmin #120a1c}
.rg3 .scope svg{position:absolute;left:50%;top:50%;width:84vmin;height:84vmin;margin:-42vmin 0 0 -42vmin}
.rg3 .scope .rng{position:absolute;left:50%;top:calc(50% + 24vmin);transform:translateX(-50%);font-family:"Press Start 2P",monospace;font-size:13px;color:#ff6fae;text-shadow:0 0 6px #ff2e88}
.rg3 .scope .br{position:absolute;left:50%;top:calc(50% + 29vmin);transform:translateX(-50%);width:16vmin;height:4px;background:#ffffff22;border-radius:2px}.rg3 .scope .br i{display:block;height:100%;background:#22e5ff;width:100%}
.rg3 .msg{position:absolute;left:0;right:0;top:24%;text-align:center;font-size:26px;text-shadow:0 0 12px #ff2e88,0 2px 0 #000;opacity:0;transition:opacity .25s}
.rg3 .cnt{position:absolute;left:0;right:0;top:40%;text-align:center;font-family:"Press Start 2P",monospace;font-size:54px;color:#ffd23f;text-shadow:0 0 18px #ff9f1c}
.rg3 .pop{position:absolute;transform:translate(-50%,-50%);font-family:"Press Start 2P",monospace;font-size:14px;white-space:nowrap;text-shadow:0 0 8px currentColor,0 2px 0 #000;animation:rgpop .9s ease-out forwards}
.rg3 .pop small{display:block;font-family:"Black Han Sans",sans-serif;font-size:15px;text-align:center}
@keyframes rgpop{0%{opacity:0;margin-top:6px;scale:.6}15%{opacity:1;scale:1.15}30%{scale:1}100%{opacity:0;margin-top:-46px}}
.rg3 .arw{position:absolute;left:0;top:0;will-change:transform;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid #ff2e88;filter:drop-shadow(0 0 6px #ff2e88);display:none}
.rg3 .touch{position:absolute;inset:0;display:none}
.rg3.tch.playing .touch{display:block}
.rg3 .touch button{position:absolute;border-radius:50%;border:2px solid #ffffff55;background:#ffffff14;color:#fff;backdrop-filter:blur(2px);touch-action:none}
.rg3 .touch .f{right:calc(max(18px,env(safe-area-inset-right)) + 4px);bottom:96px;width:96px;height:96px;font-size:18px;border-color:#ff2e88;background:#ff2e8833;box-shadow:0 0 18px #ff2e8866}
.rg3 .touch .f.on{background:#ff2e8899}
.rg3 .touch .a{left:calc(max(18px,env(safe-area-inset-left)) + 6px);bottom:40px;width:84px;height:84px;font-size:16px;border-color:#22e5ff;background:#22e5ff22}
.rg3 .touch .a.on{background:#22e5ff88}
.rg3 .touch .r{right:calc(max(18px,env(safe-area-inset-right)) + 114px);bottom:60px;width:56px;height:56px;font-size:13px}
.rg3 .touch .s{left:calc(max(18px,env(safe-area-inset-left)) + 18px);bottom:140px;width:60px;height:60px;font-size:20px}
.rg3 .pz{position:absolute;right:max(12px,env(safe-area-inset-right));top:12px;width:40px;height:40px;border-radius:10px;border:1px solid #ffffff44;background:#ffffff14;color:#fff;font-size:14px;pointer-events:auto}
.rg3 .tr{bottom:16px}.rg3.tch .tr{bottom:auto;top:62px}
.rg3 .panel{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:flex-end;padding:16px max(16px,env(safe-area-inset-right)) 22px max(16px,env(safe-area-inset-left));background:linear-gradient(180deg,#05030c00 30%,#05030ccc 62%,#05030c 100%);overflow:auto}
.rg3 .panel.on{display:flex}
.rg3 .panel .box{width:100%;max-width:520px;text-align:center}
.rg3 .k{font-family:"Press Start 2P",monospace;font-size:10px;color:#22e5ff;letter-spacing:2px;margin:0 0 6px}
.rg3 h2{margin:0 0 10px;font-size:40px;font-weight:400;color:#fff;text-shadow:0 0 14px #ff2e88,0 0 30px #ff2e8888;line-height:1.1}
.rg3 .wsel{display:flex;align-items:center;gap:10px;background:#140b2bcc;border:1px solid #3a2b6e;border-radius:16px;padding:10px;margin:0 0 12px}
.rg3 .wsel>button{width:44px;height:44px;border-radius:12px;border:1px solid #3a2b6e;background:#22164a;color:#fff;font-size:18px;flex:none}
.rg3 .wsel>div{flex:1;text-align:left}.rg3 .wsel b{font-size:22px;font-weight:400}.rg3 .wsel small{color:#a99fc9;margin-left:6px;font-size:14px}
.rg3 .st{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;align-items:center;margin-top:6px;font-size:13px;color:#cfc6ff}
.rg3 .st i{height:7px;border-radius:4px;background:#ffffff18;overflow:hidden;position:relative}.rg3 .st i:after{content:"";position:absolute;inset:0;width:var(--v);background:var(--ac);box-shadow:0 0 8px var(--ac)}
.rg3 .go{display:block;width:100%;padding:16px;border-radius:14px;border:0;background:#ffd23f;color:#1a0f00;font-size:22px;box-shadow:0 5px 0 #b8860b,0 0 24px #ffd23f66;margin-bottom:10px}
.rg3 .row{display:flex;gap:8px}.rg3 .row button{flex:1;padding:12px;border-radius:12px;border:1px solid #3a2b6e;background:#22164a;color:#fff;font-size:16px}
.rg3 .tip{font-size:12.5px;color:#a99fc9;line-height:1.6;margin:10px 0 0;font-family:"Noto Sans KR",sans-serif}
.rg3 .sens{display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px;color:#cfc6ff;margin-top:8px}.rg3 .sens input{width:150px;accent-color:#ff2e88}
.rg3 .grade{font-family:"Press Start 2P",monospace;font-size:64px;color:#ffd23f;text-shadow:0 0 22px #ff9f1c;margin:0}
.rg3 .big{font-family:"Press Start 2P",monospace;font-size:28px;margin:8px 0 12px}
.rg3 .res{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 14px;font-size:15px}.rg3 .res div{background:#140b2bcc;border:1px solid #3a2b6e;border-radius:10px;padding:8px}.rg3 .res b{display:block;font-family:"Press Start 2P",monospace;font-size:13px;margin-top:4px;color:#22e5ff}
.rg3 .load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Press Start 2P",monospace;font-size:12px;color:#22e5ff}
.rg3 .res{}@media (max-width:560px){.rg3 .res{grid-template-columns:1fr 1fr}}
.rg3 .rot{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:12px;color:#a99fc9;font-family:"Noto Sans KR",sans-serif;display:none;white-space:nowrap}
@media (max-height:520px){.rg3 h2{font-size:26px;margin-bottom:4px}.rg3 .k{display:none}.rg3 .st{display:none}.rg3 .sens{margin-top:4px}.rg3 .tip{display:none}.rg3 .grade{font-size:40px}.rg3 .big{font-size:20px;margin:4px 0 8px}.rg3 .wsel{padding:6px;margin-bottom:8px}.rg3 .go{padding:12px;font-size:18px}.rg3 .res{grid-template-columns:repeat(4,1fr)}.rg3 .result.hc .res div:nth-child(n+5){display:none}.rg3 .go.cont{padding:9px;font-size:15px;margin-bottom:6px}}
`;

const SCOPE_SVG = `<svg viewBox="-100 -100 200 200"><g stroke="#000" stroke-width=".55" fill="none"><line x1="-100" y1="0" x2="-6" y2="0"/><line x1="6" y1="0" x2="100" y2="0"/><line x1="0" y1="-100" x2="0" y2="-6"/><line x1="0" y1="6" x2="0" y2="100"/>
<line x1="-100" y1="0" x2="-55" y2="0" stroke-width="2.4"/><line x1="55" y1="0" x2="100" y2="0" stroke-width="2.4"/><line x1="0" y1="55" x2="0" y2="100" stroke-width="2.4"/></g>
<g fill="#000">${[-40, -30, -20, -10, 10, 20, 30, 40].map((v) => `<circle cx="${v}" cy="0" r="1"/><circle cx="0" cy="${v}" r="1"/>`).join('')}</g>
<circle cx="0" cy="0" r=".9" fill="#ff2e88"/><circle cx="0" cy="0" r="3.2" fill="none" stroke="#ff2e88" stroke-width=".35"/></svg>`;

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

// 스테이지 n의 난이도: 표적이 더 빨리 사라지고, 작아지고, 멀어지고, 빨라진다.
// 끝없는 스테이지(순위 상한 없음). 10단계까지 빠르게, 그 뒤로는 천천히 계속 어려워진다.
export function stageCfg(n) {
  // 1~3단계는 넉넉하게(BK 11/13 피드백), 4단계부터 점점, 12단계 이후엔 천천히 계속 어려워진다.
  const k = n - 1, m = Math.min(k, 11), x = Math.max(0, n - 12);
  return { n, dur: n <= 3 ? 32 : 28, quota: Math.min(4 + 2 * n, 26) + x,
    life: Math.max(0.42, 1.2 - 0.065 * m - 0.012 * x), scale: Math.max(0.5, 1.1 - 0.04 * m - 0.01 * x),
    speed: Math.min(2.8, 0.8 + 0.11 * m + 0.05 * x), push: Math.min(40, Math.max(0, k - 2) * 2.5), gap: Math.max(0.42, 1.0 - 0.045 * m - 0.012 * x), mult: 1 + 0.2 * k,
    zombie: n >= 4 ? Math.min(0.5, 0.18 + 0.035 * (n - 4)) : 0 };
}
function makeSchedule(R, n) {
  const c = stageCfg(n);
  const ev = [];
  let t = 0.4;
  while (t < c.dur + 6) {
    const r = R();
    let type;
    if (n === 1) type = r < 0.75 ? 'plate' : 'slider';
    else if (n === 2) type = r < 0.45 ? 'plate' : r < 0.75 ? 'slider' : 'drone';
    else type = r < 0.3 ? 'plate' : r < 0.55 ? 'slider' : r < 0.8 ? 'drone' : 'far';
    if (n >= 4 && R() < c.zombie) type = 'zombie';
    ev.push({ t, type });
    t += c.gap * (0.7 + R() * 0.6);
  }
  ev.push({ t: 6 + R() * 12, type: 'gold' });
  if (n >= 2) ev.push({ t: 8 + R() * 4, type: 'far' });
  ev.sort((a, b) => a.t - b.t);
  const placed = [];
  for (const e of ev) {
    e.life = { plate: 3.4, slider: 4.4, drone: 5.4, far: 7, gold: 2.8, zombie: 99 }[e.type] * (e.type === 'far' ? Math.max(0.7, c.life) : c.life);
    e.scale = c.scale; e.mult = c.mult;
    for (let tries = 0; tries < 8; tries++) {
      const x = (R() * 2 - 1) * (e.type === 'far' ? 11 : e.type === 'zombie' ? 9 : 11.5);
      const z = e.type === 'far' ? -(80 + R() * 60) : e.type === 'zombie' ? -(34 + c.push + R() * 18) : -(c.push + (e.type === 'drone' ? 22 + R() * 34 : e.type === 'slider' ? 16 + R() * 26 : e.type === 'gold' ? 14 + R() * 24 : 9 + R() * 30));
      const clash = placed.some((p) => p.t + p.life > e.t && Math.abs(p.x - x) < 2.6 && Math.abs(p.z - z) < 12);
      e.x = x; e.z = z;
      if (!clash) break;
    }
    e.y = 2.6 + R() * 4;
    e.amp = 2 + R() * 4; e.spd = (0.7 + R() * 0.9) * c.speed; e.ph = R() * 6.28;
    if (e.type === 'zombie') e.spd = (1.7 + R() * 0.8) * c.speed;
    placed.push(e);
  }
  return ev;
}

export function boot(opts = {}) {
  const R = opts.rng || Math.random;
  const touch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  const Q = { low: touch || (navigator.hardwareConcurrency || 8) <= 4 };
  if (!document.getElementById('rg3css')) { const st = document.createElement('style'); st.id = 'rg3css'; st.textContent = CSS; document.head.appendChild(st); }

  const root = el(`<div class="rg3${touch ? ' tch' : ''}"><canvas></canvas>
<div class="hud" style="display:none">
 <div class="tl"><b class="sc">0</b><span class="cb"></span></div>
 <div class="tc">25.0</div><div class="goal"></div><div class="dmg"></div>
 <div class="tr"><span class="wn"></span><b class="am">30</b><small class="am2">/30</small><div class="rb"><i></i></div></div>
 <div class="xh"><i></i><i></i><i></i><i></i><b></b></div><div class="hm"></div>
 <div class="scope"><div class="ring"></div>${SCOPE_SVG}<span class="rng">---M</span><div class="br"><i></i></div></div>
 <div class="msg"></div><div class="cnt"></div><div class="pops"></div>
 <div class="arws">${'<i class="arw"></i>'.repeat(6)}</div>
 <button class="pz" type="button" data-a="pause">II</button>
</div>
<div class="touch"><button class="f px" type="button" data-a="fire">FIRE</button><button class="a" type="button" data-a="ads">조준</button><button class="r px" type="button" data-a="reload">R</button><button class="s" type="button" data-a="swap">⇄</button></div>
<div class="panel menu"><div class="box"><p class="k">5RAKSIL · 3D SHOOTING</p><h2>네온 사격장</h2>
 <div class="wsel"><button type="button" data-w="-1">◀</button><div><b class="wname"></b><small class="wkind"></small><div class="st"></div></div><button type="button" data-w="1">▶</button></div>
 <button class="go" type="button">▶ 사격 시작 (무한 스테이지)</button><div class="row"><button type="button" class="ex">나가기</button><button type="button" class="snd">🔊 소리 켬</button></div>
 <div class="sens">조준 감도 <input type="range" min="0.4" max="2" step="0.1" value="1"></div>
 <p class="tip">${touch ? '화면을 끌어 조준 · FIRE 누르면 사격(누른 채 끌어도 조준) · 조준 버튼으로 조준경 · ⇄ 무기 교체. 가로 화면 추천!' : '마우스로 조준 · 클릭 사격 · 우클릭(누르는 동안) 조준경 · R 장전 · 1/2 또는 Q 무기 교체 · Shift 숨 참기 · Esc 일시정지'}</p></div></div>
<div class="panel pause"><div class="box"><h2>일시정지</h2><button class="go" type="button" data-p="resume">▶ 계속하기</button><div class="row"><button type="button" data-p="restart">처음부터</button><button type="button" data-p="exit">나가기</button></div></div></div>
<div class="panel result"><div class="box"><p class="k">RESULT · 오늘의 판</p><p class="grade">S</p><p class="big">0</p><div class="res"></div>
 <button class="go cont" type="button" data-r="cont" style="display:none;background:#3ddc84;box-shadow:0 5px 0 #15803d">🪙 이어하기</button><p class="ctip" style="display:none;font-size:12px;color:#ffd23f;margin:0 0 8px">🪙 코인이 있으면 이 스테이지를 한 번 더 도전할 수 있어요. 코인은 매일 출석체크로 1개씩 무료!</p><button class="go" type="button" data-r="again">↻ 다시 하기</button><div class="row"><button type="button" data-r="share">📤 결과 공유</button><button type="button" data-r="exit">나가기</button></div></div></div>
<div class="load">LOADING…</div><div class="rot">📱 가로로 돌리면 더 넓게 보여요</div></div>`);
  document.body.appendChild(root);
  const qc = {};
  const $ = (s) => qc[s] || (qc[s] = root.querySelector(s));
  // 같은 값이면 DOM을 건드리지 않는다(매 프레임 레이아웃·페인트 줄이기)
  const setTxt = (e, v) => { if (e._t !== v) { e._t = v; e.textContent = v; } };
  const setHtml = (e, v) => { if (e._h !== v) { e._h = v; e.innerHTML = v; } };
  const setSt = (e, k, v) => { const kk = '_' + k; if (e[kk] !== v) { e[kk] = v; e.style[k] = v; } };
  const canvas = $('canvas');
  const hud = $('.hud');

  // ---------- 렌더러 ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !Q.low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 화질 단계: 해상도(픽셀 수 상한)와 블룸을 프레임 시간에 맞춰 자동 조절. 그림자는 시작 때만 정한다(바꾸면 셰이더 재컴파일로 끊김).
  const TIERS = [{ px: 2.4e6, bloom: true }, { px: 1.6e6, bloom: true }, { px: 1.1e6, bloom: true }, { px: 0.8e6, bloom: false }, { px: 0.5e6, bloom: false }];
  const lockTier = /rghq/.test(location.hash);
  let tier = Q.low && !lockTier ? 2 : 0, ftAcc = 0, ftN = 0, goodWin = 0;
  const fpsBox = /fps/.test(location.hash) ? document.createElement('div') : null;
  if (fpsBox) { fpsBox.style.cssText = 'position:absolute;left:8px;bottom:8px;font:12px monospace;color:#3ddc84;z-index:5;pointer-events:none'; root.appendChild(fpsBox); }

  // 브라우저가 그래픽카드를 안 쓰고 소프트웨어로 그리는 경우(하드웨어 가속 꺼짐) 안내
  let gpuName = '';
  try { const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpuName = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) { /* 없음 */ }
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpuName)) {
    Q.low = true; if (!lockTier) tier = 3; renderer.shadowMap.enabled = false;
    const w = document.createElement('p'); w.className = 'tip'; w.style.color = '#ffd23f';
    w.textContent = '⚠️ 지금 브라우저가 그래픽카드를 쓰지 않고 있어 끊길 수 있어요. 크롬 설정 > 시스템 > "가능한 경우 그래픽 가속 사용"을 켜고 브라우저를 다시 시작해 주세요.';
    root.querySelector('.menu .box').appendChild(w);
  }
  if (fpsBox) fpsBox.title = gpuName;
  if (opts.ios) {
    const w = document.createElement('p'); w.className = 'tip'; w.style.color = '#22e5ff';
    w.textContent = '📱 아이폰은 사파리 공유 버튼 → "홈 화면에 추가"로 열면 주소창 없이 전체 화면으로 할 수 있어요.';
    root.querySelector('.menu .box').appendChild(w);
  }

  const scene = new THREE.Scene();
  const vmScene = new THREE.Scene();
  const env = makeEnv(renderer);
  scene.environment = env; scene.environmentIntensity = 0.35;
  vmScene.environment = env; vmScene.environmentIntensity = 1.0;
  const world = buildWorld(scene, Q);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
  camera.rotation.order = 'YXZ';
  camera.position.set(0, 1.62, 0);
  scene.add(camera);
  const vmCam = new THREE.PerspectiveCamera(55, 1, 0.01, 20);

  // 1인칭 무기 조명(카메라 기준 고정)
  vmScene.add(new THREE.HemisphereLight(0x9a8cff, 0x1a0f22, 0.9));
  const key = new THREE.DirectionalLight(0xfff2e6, 3.2); key.position.set(1.2, 2.2, 1.4); vmScene.add(key);
  const rimP = new THREE.DirectionalLight(0xff2e88, 2.4); rimP.position.set(-2, 0.6, -1.5); vmScene.add(rimP);
  const rimC = new THREE.DirectionalLight(0x22e5ff, 2.0); rimC.position.set(2.5, -0.5, -1); vmScene.add(rimC);
  const vmFlash = new THREE.PointLight(0xffa04a, 0, 2, 2); vmScene.add(vmFlash);
  const worldFlash = new THREE.PointLight(0xffa04a, 0, 9, 2); worldFlash.position.set(0.2, -0.2, -1); camera.add(worldFlash);

  const M = materials();
  const guns = [buildRifle(M), buildSniper(M)];
  const vmRoot = new THREE.Group(); vmScene.add(vmRoot);
  const showPivot = new THREE.Group(); vmScene.add(showPivot);
  for (const g of guns) { g.root.visible = false; vmRoot.add(g.root); g.ammo = g.mag; }

  let composer = null, bloom = null;
  function makeComposer() {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: Q.low ? 0 : 2 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    const vp = new RenderPass(vmScene, vmCam); vp.clear = false; vp.clearDepth = true; composer.addPass(vp);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.85);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  makeComposer();

  // ---------- 표적 ----------
  const kit = targetKit();
  const pools = { plate: [], slider: [], far: [], gold: [], drone: [], zombie: [] };
  let active = [], hittables = [];
  function getObj(type) {
    const p = pools[type];
    const o = p.pop() || (type === 'drone' ? kit.drone() : type === 'zombie' ? kit.zombie() : kit.plate(type));
    o.type = type; scene.add(o.pivot); o.pivot.visible = true;
    return o;
  }
  function freeObj(o) { scene.remove(o.pivot); pools[o.type].push(o); }
  function refreshHit() { hittables = []; for (const t of active) if (t.state === 'up') for (const m of t.o.hit) { m.userData.t = t; hittables.push(m); } }

  // ---------- 효과 ----------
  const sparkN = 320;
  const sparkPos = new Float32Array(sparkN * 3), sparkCol = new Float32Array(sparkN * 3), sparkVel = new Float32Array(sparkN * 3), sparkLife = new Float32Array(sparkN);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  sparks.frustumCulled = false; scene.add(sparks);
  for (let i = 0; i < sparkN; i++) sparkPos[i * 3 + 1] = -999;
  let sparkI = 0;
  function burst(p, n, col, speed, size = 1) {
    for (let k = 0; k < n; k++) {
      const i = sparkI = (sparkI + 1) % sparkN;
      sparkPos.set([p.x, p.y, p.z], i * 3);
      const a = Math.random() * 6.28, e = Math.random() * 2 - 1, s = speed * (0.3 + Math.random()) * size;
      sparkVel.set([Math.cos(a) * Math.sqrt(1 - e * e) * s, Math.abs(e) * s * 0.8 + s * 0.3, Math.sin(a) * Math.sqrt(1 - e * e) * s], i * 3);
      sparkCol.set([col.r * 3, col.g * 3, col.b * 3], i * 3);
      sparkLife[i] = 0.35 + Math.random() * 0.4;
    }
  }
  const glowTex = canvasTex(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,200,120,.7)'); g.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
  const glows = [];
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })); s.visible = false; s.userData.life = 0; scene.add(s); glows.push(s); }
  let glowI = 0;
  function glow(p, size, color) { const s = glows[glowI = (glowI + 1) % glows.length]; s.position.copy(p); s.scale.setScalar(size); s.material.color.set(color); s.userData.life = 0.14; s.userData.size = size; s.visible = true; }
  const tracers = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.visible = false; scene.add(m); tracers.push(m); }
  let trI = 0;
  function tracer(a, b, w) { const m = tracers[trI = (trI + 1) % tracers.length]; const len = a.distanceTo(b); m.position.copy(a).lerp(b, 0.5); m.lookAt(b); m.scale.set(w, w, len); m.material.opacity = 1; m.userData.life = 0.07; m.visible = true; }
  const shells = [];
  const shellGeo = new THREE.CylinderGeometry(0.0055, 0.0055, 0.03, 10); shellGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(shellGeo, M.brass); m.visible = false; m.userData.v = new THREE.Vector3(); vmScene.add(m); shells.push(m); }
  let shI = 0;
  function eject(g, big) {
    const m = shells[shI = (shI + 1) % shells.length];
    g.eject.getWorldPosition(m.position); m.scale.setScalar(big ? 1.5 : 1);
    m.userData.v.set(0.9 + Math.random() * 0.5, 1.1 + Math.random() * 0.4, 0.2 + Math.random() * 0.3); m.userData.life = 0.7; m.userData.spin = 15 + Math.random() * 10; m.visible = true;
  }

  // ---------- 소리 · 화면 문구 ----------
  const sfx = new Sfx();
  try { sfx.on = localStorage.getItem('rg3_snd') !== '0'; } catch (e) { /* 없음 */ }
  let sens = 1; try { sens = +localStorage.getItem('rg3_sens') || 1; } catch (e) { /* 없음 */ }
  $('.sens input').value = sens;
  $('.sens input').oninput = (e) => { sens = +e.target.value; try { localStorage.setItem('rg3_sens', sens); } catch (er) { /* 없음 */ } };
  const sndBtn = $('.snd');
  const sndLabel = () => { sndBtn.textContent = sfx.on ? '🔊 소리 켬' : '🔇 소리 끔'; };
  sndLabel();
  sndBtn.onclick = () => { sfx.on = !sfx.on; sndLabel(); try { localStorage.setItem('rg3_snd', sfx.on ? '1' : '0'); } catch (e) { /* 없음 */ } };
  let msgT = 0;
  function msg(t, dur = 1.6) { const m = $('.msg'); m.textContent = t; m.style.opacity = 1; msgT = dur; }
  const v3 = new THREE.Vector3();
  function toScreen(p) { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, z: v3.z }; }
  function pop(p, text, sub, color) {
    const s = toScreen(p); if (s.z > 1) return;
    const d = document.createElement('div'); d.className = 'pop'; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; d.style.color = color;
    d.textContent = text; if (sub) { const sm = document.createElement('small'); sm.textContent = sub; d.appendChild(sm); }
    $('.pops').appendChild(d); setTimeout(() => d.remove(), 950);
  }
  let hmT = 0;
  function hitMark(bull) { const h = $('.hm'); h.className = 'hm' + (bull ? ' bull' : ''); h.style.opacity = 1; hmT = 0.16; }

  // ---------- 상태 ----------
  let W = 1, H = 1, state = 'menu', cur = 0, sel = 0;
  let yaw = 0, pitch = 0.02, kickP = 0, kickY = 0, bloomS = 0, adsP = 0, adsWant = false, adsToggle = false, fireHeld = false, firedOnce = false;
  let reloadT = 0, reloadDur = 0, swapT = 0, boltT = 0, nextShot = 0, breath = 1, holdBreath = false;
  let gameT = 0, bonusT = 0, countT = 0, score = 0, combo = 0, maxCombo = 0, shots = 0, hits = 0, bulls = 0, kills = { plate: 0, slider: 0, drone: 0, far: 0, gold: 0 };
  let sched = [], schedI = 0, farMsg = 0, goldMsg = 0, zomMsg = 0, lastBeep = 0, stage = 1, cfg = stageCfg(1), stageKills = 0, interT = 0, heads = 0, cleared = 0;
  const vm = { kz: 0, kr: 0, lagX: 0, lagY: 0, vkz: 0, vkr: 0 };
  let lookDX = 0, lookDY = 0, now = 0;

  function resize() {
    W = root.clientWidth; H = root.clientHeight;
    const T = TIERS[tier];
    const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(T.px / Math.max(1, W * H))));
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    if (bloom) bloom.setSize(Math.round(W * dpr / 2), Math.round(H * dpr / 2));
    root._menuTop = null;
    const asp = W / H;
    camera.aspect = vmCam.aspect = asp;
    vmCam.fov = asp >= 1.2 ? 55 : Math.min(85, 2 * Math.atan(Math.tan(25 * Math.PI / 180) / asp) * 180 / Math.PI);
    vmCam.updateProjectionMatrix();
    $('.rot').style.display = touch && asp < 1 && state !== 'play' ? 'block' : 'none';
  }
  function baseFov() { const asp = W / H; return asp >= 1.2 ? 70 : Math.min(100, 2 * Math.atan(Math.tan(36 * Math.PI / 180) / asp) * 180 / Math.PI); }
  addEventListener('resize', () => { if (root.isConnected) resize(); });

  const G = () => guns[cur];
  function showGun(i) {
    guns.forEach((g, k) => { g.root.visible = k === i; });
    const g = guns[i];
    root.style.setProperty('--ac', g.accent);
    $('.wn').textContent = g.name; updAmmo();
  }
  function updAmmo() { const g = G(); $('.am').textContent = g.ammo; $('.am2').textContent = '/' + g.mag; $('.am').style.color = g.ammo <= Math.ceil(g.mag * 0.2) ? '#ff6fae' : '#fff'; }

  // 메뉴(무기 진열)
  function menuGun() {
    const g = guns[sel];
    $('.wname').textContent = g.name; $('.wkind').textContent = g.kind;
    $('.st').innerHTML = Object.entries(g.stats).map(([k, v]) => `<span>${k}</span><i style="--v:${v * 20}%;--ac:${g.accent}"></i>`).join('');
    guns.forEach((x, k) => { x.root.visible = k === sel; });
    showPivot.add(g.root); g.root.position.set(0, 0.03, g.center); g.root.rotation.set(0, 0, 0);
  }
  root.querySelectorAll('[data-w]').forEach((b) => { b.onclick = () => { sel = (sel + +b.dataset.w + 2) % 2; sfx.init(); sfx.click(); menuGun(); }; });
  function setPanel(name) { root.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.classList.contains(name))); }

  function toMenu() {
    state = 'menu'; root.classList.remove('playing'); hud.style.display = 'none'; setPanel('menu'); clearTargets(); menuGun(); resize();
  }
  function clearTargets() { for (const t of active) freeObj(t.o); active = []; refreshHit(); }

  function lockPointer() { if (!touch && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 미지원 */ } } }
  function startGame() {
    sfx.init(); if (touch) goFull();
    for (const g of guns) { vmRoot.add(g.root); g.ammo = g.mag; g.root.rotation.set(0, 0, 0); }
    cur = sel; showGun(cur);
    clearTargets();
    yaw = 0; pitch = 0.02; kickP = kickY = bloomS = adsP = 0; adsWant = adsToggle = fireHeld = false;
    reloadT = swapT = boltT = 0; nextShot = 0; breath = 1;
    contUsed = false; lastAccBonus = 0;
    score = combo = maxCombo = shots = hits = bulls = heads = cleared = 0; kills = { plate: 0, slider: 0, drone: 0, far: 0, gold: 0, zombie: 0 };
    farMsg = goldMsg = zomMsg = 0;
    beginStage(1); root.classList.add('playing'); hud.style.display = ''; setPanel('none'); $('.cb').textContent = ''; $('.sc').textContent = '0';
    $('.touch .a').classList.remove('on');
    resize(); lockPointer();
  }
  function beginStage(n) {
    if (n >= 4 && opts.bonus && opts.bonus.ach && !/rgdebug/.test(location.hash)) opts.bonus.ach('rg4'); // 업적 보너스 코인(1번만)
    stage = n; cfg = stageCfg(n);
    sched = makeSchedule(opts.rngFactory ? opts.rngFactory(n) : R, n); schedI = 0;
    gameT = 0; bonusT = 0; stageKills = 0; countT = 3; lastBeep = 4; state = 'count';
    for (const g of guns) g.ammo = g.mag; reloadT = 0; updAmmo();
    updGoal();
  }
  function updGoal() { const gl = $('.goal'); gl.innerHTML = `STAGE ${stage} · 🎯 <b>${stageKills}/${cfg.quota}</b>`; gl.classList.toggle('ok', stageKills >= cfg.quota); }
  $('.menu .go').onclick = startGame;
  $('.menu .ex').onclick = () => exit();
  function pause() { if (state !== 'play' && state !== 'count' && state !== 'inter') return; state = 'pause:' + state; fireHeld = false; setPanel('pause'); if (document.pointerLockElement) document.exitPointerLock(); }
  function resume() { if (!state.startsWith('pause')) return; state = state.slice(6); setPanel('none'); lockPointer(); }
  root.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { const p = b.dataset.p; if (p === 'resume') resume(); else if (p === 'restart') startGame(); else exit(); }; });
  root.querySelectorAll('[data-r]').forEach((b) => {
    b.onclick = () => { const r = b.dataset.r; if (r === 'cont') contGame(); else if (r === 'again') startGame(); else if (r === 'share') { if (opts.share) opts.share(Math.floor(score), result); } else exit(); };
  });
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && (state === 'play' || state === 'count' || state === 'inter') && !touch) pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  // ---------- 입력 ----------
  const look = (dx, dy, k) => { const f = camera.fov / baseFov(); yaw -= dx * k * sens * f; pitch -= dy * k * sens * f; lookDX += dx; lookDY += dy; };
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement === canvas && state === 'play') look(e.movementX, e.movementY, 0.0022); });
  canvas.addEventListener('mousedown', (e) => {
    if (touch) return;
    if (state === 'play' && document.pointerLockElement !== canvas) { lockPointer(); return; }
    if (e.button === 0) { fireHeld = true; firedOnce = false; }
    if (e.button === 2) adsWant = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) fireHeld = false; if (e.button === 2) adsWant = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  root.addEventListener('contextmenu', (e) => e.preventDefault());
  addEventListener('wheel', (e) => { if (state === 'play' && root.isConnected) swap(); }, { passive: true });
  addEventListener('keydown', (e) => {
    if (!root.isConnected || root.style.display === 'none') return;
    const k = e.key.toLowerCase();
    if (state === 'play') {
      if (k === 'r') reload();
      else if (k === '1' && cur !== 0) swap(0);
      else if (k === '2' && cur !== 1) swap(1);
      else if (k === 'q') swap();
      else if (k === 'shift') holdBreath = true;
      else if (k === 'f' || k === ' ') { fireHeld = true; firedOnce = false; e.preventDefault(); }
    } else if (state.startsWith('pause') && (k === 'enter' || k === ' ')) resume();
  });
  addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (k === 'shift') holdBreath = false; if (k === 'f' || k === ' ') fireHeld = false; });
  // 터치: 버튼 밖을 끌면 조준, FIRE를 누른 채 끌어도 조준
  const ptrs = new Map();
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const a = e.target.closest && e.target.closest('[data-a]');
    if (state !== 'play' && state !== 'count') return;
    e.preventDefault();
    sfx.init();
    if (a) {
      const act = a.dataset.a;
      if (act === 'fire') { fireHeld = true; firedOnce = false; a.classList.add('on'); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, fire: true, el: a }); }
      else if (act === 'ads') { adsToggle = !adsToggle; a.classList.toggle('on', adsToggle); }
      else if (act === 'reload') reload();
      else if (act === 'swap') swap();
      else if (act === 'pause') pause();
      return;
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }, { passive: false });
  root.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (state === 'play') look(e.clientX - p.x, e.clientY - p.y, 0.0046);
    p.x = e.clientX; p.y = e.clientY;
  });
  const up = (e) => { const p = ptrs.get(e.pointerId); if (!p) return; if (p.fire) { fireHeld = false; p.el.classList.remove('on'); } ptrs.delete(e.pointerId); };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  $('.pz').addEventListener('click', (e) => { if (e.pointerType !== 'touch') pause(); });

  // ---------- 무기 동작 ----------
  function reload() {
    const g = G();
    if (reloadT > 0 || swapT > 0 || g.ammo === g.mag) return;
    reloadT = reloadDur = g.reloadTime; sfx.reload(g.reloadTime);
    if (g.id === 'sniper') { adsToggle = false; $('.touch .a').classList.remove('on'); }
  }
  function swap(to) {
    if (swapT > 0) return;
    const n = to === undefined ? 1 - cur : to; if (n === cur) return;
    swapT = 0.55; reloadT = 0; boltT = 0; adsToggle = false; $('.touch .a').classList.remove('on');
    setTimeout(() => { cur = n; showGun(cur); }, 230);
    sfx.click();
  }
  const ray = new THREE.Raycaster();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), dir = new THREE.Vector3();
  const COL_SPARK = new THREE.Color(1, 0.75, 0.35), COL_PINK = new THREE.Color(1, 0.25, 0.6), COL_CYAN = new THREE.Color(0.2, 0.9, 1), COL_GOLD = new THREE.Color(1, 0.85, 0.2), COL_GREEN = new THREE.Color(0.25, 1, 0.4);
  function fire() {
    const g = G();
    if (now < nextShot || reloadT > 0 || swapT > 0 || boltT > 0) return;
    if (g.ammo <= 0) { sfx.click(); reload(); return; }
    g.ammo--; nextShot = now + g.rate; shots++;
    const spread = g.spreadHip + (g.spreadAds - g.spreadHip) * adsP + bloomS;
    const r = spread * Math.sqrt(Math.random()), th = Math.random() * 6.28;
    dir.set(Math.tan(r) * Math.cos(th), Math.tan(r) * Math.sin(th), -1).normalize().applyQuaternion(camera.quaternion);
    ray.set(camera.position, dir); ray.far = 600;
    const hitsArr = ray.intersectObjects(hittables.concat(world.colliders), false);
    const h = hitsArr[0];
    const scoped = g.id === 'sniper' && adsP > 0.85;
    // 총구(월드 근사)
    tmpA.set(scoped ? 0 : g.hip.x * 0.8 * (1 - adsP), scoped ? -0.08 : -0.1 + 0.05 * adsP, -0.7).applyMatrix4(camera.matrixWorld);
    const end = h ? h.point : tmpB.copy(camera.position).addScaledVector(dir, 400);
    if (g.id === 'sniper' || shots % 2 === 0) tracer(tmpA, end, g.id === 'sniper' ? 0.03 : 0.016);
    if (h && h.object.userData.t && h.object.userData.t.state === 'up') onHit(h.object.userData.t, h);
    else {
      if (h) { burst(h.point, 8, COL_SPARK, 2.5); glow(h.point, 0.5 + h.distance * 0.012, 0xffb060); }
      if (combo >= 3) pop(end, 'MISS', '콤보 끊김', '#a99fc9');
      combo = 0; $('.cb').textContent = '';
    }
    bloomS = Math.min(g.bloomMax, bloomS + g.bloomAdd);
    kickP += g.kick * (1 - 0.45 * adsP); kickY += (Math.random() - 0.5) * g.kick * 0.6;
    if (g.id === 'sniper') { vm.vkz += 3.2; vm.vkr += 9; boltT = g.rate; sfx.bolt(); setTimeout(() => eject(g, true), 420); }
    else { vm.vkz += 1.4; vm.vkr += 2.6; eject(g, false); }
    g.flash.visible = true; g.flash.rotation.z = Math.random() * 6.28; g.flash.scale.setScalar(0.8 + Math.random() * 0.5); g.flashT = 0.045;
    vmFlash.intensity = g.id === 'sniper' ? 6 : 3; g.muzzle.getWorldPosition(vmFlash.position); worldFlash.intensity = g.id === 'sniper' ? 30 : 14;
    sfx.shot(g.id);
    if (touch && navigator.vibrate) { try { navigator.vibrate(g.id === 'sniper' ? 35 : 12); } catch (e) { /* 없음 */ } }
    updAmmo();
    if (g.ammo === 0) setTimeout(() => { if (G() === g && g.ammo === 0) reload(); }, g.id === 'sniper' ? g.rate * 1000 : 150);
  }

  function onHit(t, h) {
    const type = t.type, g = G();
    let ring = 1, label = '';
    const dist = h.distance;
    if (type === 'zombie') {
      if (h.object.userData.part === 'head') { ring = 2; label = '헤드샷!'; heads++; }
      else {
        t.hp -= g.damage;
        if (t.hp > 0) {
          hits++; combo++; maxCombo = Math.max(maxCombo, combo);
          t.stagger = 0.25; t.flash = 0.08;
          burst(h.point, 8, COL_GREEN, 2.5); hitMark(false); sfx.ding(dist / 340, false);
          pop(h.point, '-' + g.damage, '', '#3ddc84');
          $('.cb').textContent = combo >= 2 ? `COMBO ${combo}` : '';
          return;
        }
      }
    } else if (type === 'drone') { if (h.object === t.o.core) { ring = 2; label = '코어 명중!'; } }
    else {
      const lp = t.o.disc.worldToLocal(h.point.clone());
      const rr = Math.hypot(lp.x, lp.y) / t.o.disc.userData.R;
      if (rr < 0.2) { ring = 2; label = '정중앙!'; } else if (rr < 0.55) { ring = 1.5; label = ''; }
    }
    combo++; maxCombo = Math.max(maxCombo, combo); hits++; if (ring === 2 && type !== 'zombie') bulls++;
    kills[type]++; stageKills++; updGoal();
    if (stageKills === cfg.quota) { msg('✅ 목표 달성! 남은 시간도 점수 벌기'); sfx.coin(); }
    const mult = 1 + Math.min(20, combo - 1) * 0.1;
    const pts = Math.round(BASE[type] * ring * mult * cfg.mult);
    score += pts;
    $('.sc').textContent = Math.floor(score).toLocaleString();
    $('.cb').textContent = combo >= 2 ? `COMBO ${combo} · x${mult.toFixed(1)}` : '';
    const col = type === 'gold' ? '#ffd23f' : type === 'zombie' ? '#3ddc84' : ring === 2 ? '#ff2e88' : type === 'far' ? '#ff6fae' : '#22e5ff';
    let sub = label;
    if (type === 'gold') { bonusT += 3; sub = '+3초!'; sfx.coin(); }
    if (type === 'far' && !label) sub = Math.round(dist) + 'm 원거리';
    else if (type === 'far') sub = Math.round(dist) + 'm ' + label;
    pop(h.point, '+' + pts, sub, col);
    hitMark(ring === 2);
    burst(h.point, type === 'drone' || type === 'zombie' ? 30 : 16, type === 'gold' ? COL_GOLD : type === 'zombie' ? COL_GREEN : ring === 2 ? COL_PINK : COL_CYAN, type === 'drone' ? 4 : 3, 1 + dist / 60);
    glow(h.point, 0.8 + dist * 0.02, type === 'drone' ? 0xff7a3a : type === 'zombie' ? 0x3ddc84 : 0xffffff);
    if (type === 'drone') sfx.boom(dist / 340); else sfx.ding(dist / 340, ring === 2);
    t.state = 'hit'; t.hitT = 0; t.spin = (Math.random() - 0.5) * 8;
    refreshHit();
  }

  // ---------- 표적 진행 ----------
  function spawn(e) {
    const o = getObj(e.type);
    const t = { type: e.type, o, e, age: 0, state: 'up', hitT: 0, hp: 3, stagger: 0, flash: 0 };
    o.pivot.position.set(e.x, e.type === 'drone' ? e.y : 0, e.z);
    o.pivot.rotation.set(e.type === 'drone' || e.type === 'zombie' ? 0 : -Math.PI / 2, 0, 0);
    o.pivot.scale.setScalar(e.type === 'zombie' ? 1 : e.scale || 1);
    if (e.type === 'zombie') { o.pivot.position.y = -2; o.body.rotation.set(0, 0, 0); o.mats[0].emissiveIntensity = 1; if (zomMsg < 1) { zomMsg++; msg('🧟 좀비 출현! 머리를 노리면 한 방'); } }
    active.push(t); refreshHit();
    if (e.type === 'far' && farMsg < 2) { farMsg++; msg('🎯 원거리 표적! 저격총(' + (touch ? '⇄' : '2') + ')으로'); }
    if (e.type === 'gold' && goldMsg < 1) { goldMsg++; msg('⭐ 황금 표적 = +3초'); }
  }
  function updTargets(dt) {
    let changed = false;
    for (const t of active) {
      t.age += dt; const o = t.o, e = t.e, p = o.pivot;
      if (t.state === 'up' && t.age > e.life) { t.state = 'gone'; changed = true; }
      if (t.type === 'zombie') {
        if (t.state === 'up') {
          const ang = Math.atan2(-p.position.x * 0.7, -p.position.z);
          p.rotation.y = ang;
          if (t.age < 0.9) p.position.y = -2 + Math.min(1, t.age / 0.9) * 2;
          else {
            const sp = t.stagger > 0 ? -1.2 : e.spd;
            t.stagger -= dt;
            p.position.x += Math.sin(ang) * sp * dt; p.position.z += Math.cos(ang) * sp * dt;
          }
          const w = t.age * e.spd * 3.2;
          o.legs[0].rotation.x = Math.sin(w) * 0.55; o.legs[1].rotation.x = -Math.sin(w) * 0.55;
          o.arms[0].rotation.x = -0.15 + Math.sin(w * 0.5) * 0.12; o.arms[1].rotation.x = -0.15 - Math.sin(w * 0.5) * 0.12;
          o.body.rotation.z = Math.sin(w) * 0.08; o.neck.rotation.z = Math.sin(t.age * 2.3) * 0.25;
          o.body.position.y = 0.95 + Math.abs(Math.cos(w)) * 0.05;
          if (t.flash > 0) { t.flash -= dt; o.mats[0].emissiveIntensity = t.flash > 0 ? 12 : 1; }
          if (p.position.z > -3.2) {
            t.state = 'gone'; changed = true;
            score = Math.max(0, score - 300); combo = 0; bonusT -= 2;
            $('.sc').textContent = Math.floor(score).toLocaleString(); $('.cb').textContent = '';
            const dm = $('.dmg'); dm.style.transition = 'none'; dm.style.opacity = 1; requestAnimationFrame(() => { dm.style.transition = 'opacity .6s'; dm.style.opacity = 0; });
            msg('🧟 좀비에게 잡혔어요! -300점 · -2초'); sfx.boom(0); kickP += 0.04;
            if (touch && navigator.vibrate) { try { navigator.vibrate(120); } catch (er) { /* 없음 */ } }
          }
        } else if (t.state === 'hit') {
          t.hitT += dt; p.rotation.x = Math.max(-Math.PI / 2, p.rotation.x - dt * 5);
          o.mats[0].emissiveIntensity = 6 * Math.max(0, 1 - t.hitT * 2);
          if (t.hitT > 0.55) { tmpA.copy(p.position); tmpA.y += 0.4; burst(tmpA, 40, COL_GREEN, 4); glow(tmpA, 2.5, 0x3ddc84); t.state = 'done'; }
        } else if (t.state === 'gone') { p.position.y -= dt * 3; if (p.position.y < -2.2) t.state = 'done'; }
      } else if (t.type === 'drone') {
        for (const r of o.rotors) r.rotation.z += dt * 30;
        if (t.state === 'up') {
          p.position.set(e.x + Math.sin(t.age * e.spd + e.ph) * e.amp * 0.8, e.y + Math.sin(t.age * e.spd * 1.7) * 0.5, e.z);
          p.rotation.z = -Math.cos(t.age * e.spd + e.ph) * 0.25; p.rotation.y = Math.sin(t.age) * 0.15;
          if (t.age < 0.5) p.position.y += (1 - t.age / 0.5) * 6;
        } else if (t.state === 'hit') {
          t.hitT += dt; t.vy = (t.vy || 0) - 14 * dt; p.position.y += t.vy * dt; p.rotation.z += t.spin * dt; p.rotation.x += dt * 3;
          if (Math.random() < 0.5) burst(p.position, 1, COL_SPARK, 1);
          if (p.position.y < 0.3) { burst(p.position, 30, COL_SPARK, 5); glow(p.position, 3, 0xff7a3a); t.state = 'done'; }
        } else if (t.state === 'gone') { p.position.y += dt * 8; if (p.position.y > 16) t.state = 'done'; }
      } else {
        if (t.type === 'slider' && t.state === 'up') p.position.x = clamp(e.x + Math.sin(t.age * e.spd * 1.3 + e.ph) * e.amp, -13, 13);
        if (o.pivot.userData.beacon) o.pivot.userData.beacon.material.opacity = 0.6 + 0.4 * Math.sin(t.age * 8);
        if (t.state === 'up') p.rotation.x = damp(p.rotation.x, 0, 9, dt) + (t.age < 0.4 ? Math.sin(t.age * 25) * 0.02 : 0);
        else if (t.state === 'hit') { t.hitT += dt; p.rotation.x = Math.max(-Math.PI / 2, p.rotation.x - dt * 9); p.rotation.y += t.spin * dt * 0.1; if (t.hitT > 0.5) t.state = 'done'; }
        else if (t.state === 'gone') { p.rotation.x -= dt * 5; if (p.rotation.x < -Math.PI / 2) t.state = 'done'; }
      }
    }
    if (active.some((t) => t.state === 'done')) { for (const t of active) if (t.state === 'done') freeObj(t.o); active = active.filter((t) => t.state !== 'done'); changed = true; }
    if (changed) refreshHit();
  }

  // ---------- 끝 ----------
  let result = null;
  function stageEnd() {
    fireHeld = false;
    for (const t of active) if (t.state === 'up') t.state = 'gone';
    refreshHit();
    if (stageKills < cfg.quota) { endGame(false); return; }
    cleared = stage;
    const bonus = 500 * stage;
    score += bonus; $('.sc').textContent = Math.floor(score).toLocaleString();
    sfx.coin();
    state = 'inter'; interT = 2.6;
    $('.cnt').innerHTML = `<small>STAGE ${stage} CLEAR!</small>+${bonus.toLocaleString()}<em>다음: 더 빠르고 작은 표적${stage + 1 >= 4 ? ' + 좀비' : ''}</em>`;
  }
  function endGame(all) {
    state = 'end'; fireHeld = false; adsWant = adsToggle = false;
    if (document.pointerLockElement) document.exitPointerLock();
    const acc = shots ? hits / shots : 0;
    const accBonus = Math.round(acc * 1000);
    score += accBonus; lastAccBonus = accBonus;
    const s = Math.floor(score);
    const grade = cleared >= 15 ? 'S' : cleared >= 10 ? 'A' : cleared >= 6 ? 'B' : cleared >= 3 ? 'C' : 'D';
    result = { score: s, grade, stage, cleared, all: !!all, acc: Math.round(acc * 100), hits, shots, bulls, heads, maxCombo };
    $('.cnt').innerHTML = '';
    $('.result .k').textContent = `GAME OVER · STAGE ${stage}에서 탈락`;
    $('.grade').textContent = grade; $('.big').textContent = s.toLocaleString() + '점';
    $('.res').innerHTML = [['통과 스테이지', cleared + '단계'], ['명중률', result.acc + '%'], ['최고 콤보', maxCombo], ['좀비', kills.zombie + '마리'], ['헤드샷', heads + '발'], ['정중앙', bulls + '발'], ['원거리·드론', (kills.far + kills.drone) + '개'], ['명중률 보너스', '+' + accBonus]]
      .map(([a, b]) => `<div>${a}<b>${b}</b></div>`).join('');
    showCont();
    setPanel('result'); hud.style.display = 'none'; root.classList.remove('playing');
    toMenuPose();
    if (opts.submit && s > 0 && !/rgdebug/.test(location.hash)) opts.submit(s, result); // 테스트·녹화 판은 순위에 안 올림
  }
  // 출석 코인 이어하기: 한 판에 한 번, 코인 1개로 탈락한 스테이지를 같은 판으로 다시(점수 유지, 명중률 보너스는 끝날 때 다시 계산). 코인 없어도 게임은 끝까지 무료.
  let contUsed = false, lastAccBonus = 0;
  function showCont() {
    const B = opts.bonus, btn = $('.result .cont'), tip = $('.result .ctip');
    const can = !!B && !contUsed && !result.all, n = can ? B.coins() : 0;
    btn.style.display = can && n > 0 ? '' : 'none'; $('.panel.result').classList.toggle('hc', can); btn.textContent = `🪙 코인 1개로 STAGE ${stage} 다시 도전 (보유 ${n})`;
    tip.style.display = can && n <= 0 ? '' : 'none';
  }
  function contGame() {
    if (state !== 'end' || contUsed || !opts.bonus || !opts.bonus.spend()) return;
    contUsed = true; score -= lastAccBonus; lastAccBonus = 0; menuGunPose = false;
    $('.sc').textContent = Math.floor(score).toLocaleString();
    sfx.init(); if (touch) goFull();
    clearTargets(); fireHeld = adsWant = adsToggle = false;
    for (const g of guns) g.root.rotation.set(0, 0, 0); showGun(cur);
    beginStage(stage); root.classList.add('playing'); hud.style.display = ''; setPanel('none');
    resize(); lockPointer();
  }
  function toMenuPose() { menuGunPose = true; }
  let menuGunPose = false;

  function exit() {
    state = 'off'; if (document.pointerLockElement) document.exitPointerLock();
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    root.style.display = 'none'; document.documentElement.style.overflow = '';
    if (opts.onExit) opts.onExit(result);
  }
  // 미니 상점 꾸미기(겉모습만): 조준점 모양, 총알 궤적·총구 불꽃 색
  const FXC = { plasma: [new THREE.Color(1, 2.2, 3.2), 0x66ccff], laser: [new THREE.Color(3.2, 0.9, 2.2), 0xff6ad5], gold: [new THREE.Color(3.2, 2.6, 0.8), 0xffe066] };
  function applyLook() {
    const L = (opts.look && opts.look()) || {};
    root.classList.remove('xh-gold', 'xh-ring', 'xh-heart'); if (L.xh) root.classList.add('xh-' + L.xh);
    const f = FXC[L.fx]; for (const m of tracers) m.material.color.copy(f ? f[0] : new THREE.Color(3, 2.2, 1.2));
    for (const g of guns) g.flash.traverse((o) => { if (o.material) o.material.color.set(f ? f[1] : 0xffffff); });
  }
  function open() {
    applyLook();
    if (touch) goFull();
    root.style.display = ''; document.documentElement.style.overflow = 'hidden';
    sel = cur; toMenu(); if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
  }

  // 모바일 전체 화면 + 가로 고정(되는 기기만: 안드로이드 크롬 등). 아이폰 사파리는 웹페이지 전체 화면을 지원하지 않는다.
  function goFull() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen({ navigationUI: 'hide' }).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* 미지원 */ } setTimeout(resize, 300); }).catch(() => {});
    } else if (el.webkitRequestFullscreen && !document.webkitFullscreenElement) { try { el.webkitRequestFullscreen(); } catch (e) { /* 미지원 */ } }
  }
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 200));
  addEventListener('orientationchange', () => setTimeout(resize, 300));

  // ---------- 매 프레임 ----------
  let last = performance.now(), running = false, rangeT = 0;
  const camQ = new THREE.Quaternion();
  function loop(t) {
    if (state === 'off') { running = false; return; }
    requestAnimationFrame(loop);
    const dt = Math.min(window.__rgDtMax || 0.05, (t - last) / 1000); last = t; now += dt;
    // 1초마다 평균 프레임 시간을 보고 화질 단계 조절(느리면 즉시 낮추고, 아주 여유 있으면 천천히 올림)
    ftAcc += Math.min(0.2, (t - (loop.prev || t)) / 1000); loop.prev = t; ftN++;
    if (ftAcc >= 1) {
      const avg = ftAcc / ftN;
      if (fpsBox) fpsBox.textContent = Math.round(1 / avg) + 'fps · Q' + tier;
      if (lockTier) { /* 녹화용 고정 */ } else if (avg > 1 / 50 && tier < TIERS.length - 1) { tier++; goodWin = 0; resize(); }
      else if (avg < 1 / 90 && tier > 0 && ++goodWin >= 4) { tier--; goodWin = 0; resize(); }
      else if (avg >= 1 / 90) goodWin = 0;
      ftAcc = ftN = 0;
    }
    world.update(now);
    const g = G();
    const playing = state === 'play';
    if (state === 'count') {
      countT -= dt; const n = Math.ceil(countT);
      setHtml($('.cnt'), `<small>STAGE ${stage}</small>${n > 0 ? n : 'GO!'}<em>표적 ${cfg.quota}개 맞히면 통과${stage >= 4 ? ' · 좀비 주의' : ''}</em>`);
      if (n !== lastBeep && n >= 0) { lastBeep = n; sfx.beep(n === 0); }
      if (countT <= -0.4) { state = 'play'; setHtml($('.cnt'), ''); }
    }
    if (playing) {
      gameT += dt;
      while (schedI < sched.length && sched[schedI].t <= gameT) spawn(sched[schedI++]);
      const left = cfg.dur + bonusT - gameT;
      const tc = $('.tc'); setTxt(tc, Math.max(0, left).toFixed(1)); const low = left < 6 && stageKills < cfg.quota; if (tc._low !== low) { tc._low = low; tc.classList.toggle('low', low); }
      if (left < 5.5 && Math.ceil(left) !== lastBeep) { lastBeep = Math.ceil(left); sfx.beep(false); }
      if (left <= 0) stageEnd();
    }
    if (state === 'inter') {
      interT -= dt;
      if (interT <= 0) beginStage(stage + 1);
    }
    if (state === 'play' || state === 'count' || state === 'end' || state === 'inter') updTargets(dt);

    // 무기 상태
    if (playing || state === 'count' || state === 'inter') {
      if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { g.ammo = g.mag; updAmmo(); } }
      if (swapT > 0) swapT -= dt;
      if (boltT > 0) boltT -= dt;
      const wantAds = (adsWant || adsToggle) && reloadT <= 0 && swapT <= 0.2;
      adsP = damp(adsP, wantAds ? 1 : 0, g.id === 'sniper' ? 11 : 14, dt);
      if (playing && fireHeld && (g.auto || !firedOnce)) { const before = g.ammo; fire(); if (g.ammo !== before) firedOnce = true; }
      bloomS = Math.max(0, bloomS - dt * (fireHeld ? 0.02 : 0.09));
      setSt($('.rb i'), 'width', Math.round(reloadT > 0 ? (1 - reloadT / reloadDur) * 100 : boltT > 0 ? (1 - boltT / g.rate) * 100 : 0) + '%');
    }
    // 반동 회복
    const rec = Math.min(1, dt * 7);
    pitch += kickP * rec * 1.4; kickP -= kickP * rec * 1.4;
    yaw += kickY * rec; kickY -= kickY * rec;
    if (state !== 'play') { kickP = kickY = 0; }
    if (G().id === 'sniper' && !playing) adsP = damp(adsP, 0, 10, dt);
    pitch = clamp(pitch, -0.42, 0.38); yaw = clamp(yaw, -1.25, 1.25);

    // 조준경 흔들림 + 숨 참기
    const scoped = g.id === 'sniper' && adsP > 0.86 && (playing || state === 'count');
    let sx = 0, sy = 0;
    if (scoped) {
      const steady = holdBreath && breath > 0;
      breath = clamp(breath + (steady ? -dt / 3.2 : dt / 4), 0, 1);
      const amp = (steady ? 0.0006 : 0.0034) * (touch ? 0.55 : 1) * (breath <= 0 && holdBreath ? 2 : 1);
      sx = Math.sin(now * 0.9) * Math.cos(now * 0.53) * amp; sy = Math.sin(now * 1.3 + 1) * amp * 0.8;
      setSt($('.scope .br i'), 'width', Math.round(breath * 100) + '%');
    }
    if (state === 'menu' || state === 'end' || state.startsWith('pause:menu')) {
      camera.position.set(Math.sin(now * 0.12) * 3, 2.3, -4);
      camera.rotation.set(-0.02 + Math.sin(now * 0.2) * 0.02, Math.sin(now * 0.1) * 0.3, 0);
    } else { camera.position.set(0, 1.62, 0); camera.rotation.set(pitch + sy, yaw + sx, 0); }
    const fovT = baseFov() + ((g.id === 'sniper' ? g.adsFov : g.adsFov * baseFov() / 70) - baseFov()) * (scoped ? 1 : g.id === 'sniper' ? adsP * 0.3 : adsP);
    camera.fov = scoped ? g.adsFov : fovT;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();

    // HUD
    if (playing || state === 'count' || state === 'inter') {
      setSt($('.scope'), 'display', scoped ? 'block' : 'none');
      const xh = $('.xh'); setSt(xh, 'opacity', scoped || (g.id === 'rifle' && adsP > 0.6) ? '0' : '1');
      const spread = g.spreadHip + (g.spreadAds - g.spreadHip) * adsP + bloomS;
      const gap = Math.round(5 + spread / (camera.fov * Math.PI / 180) * H);
      const is = xh.children;
      setSt(is[0], 'top', (-gap - 10) + 'px'); setSt(is[1], 'top', gap + 'px'); setSt(is[2], 'left', (-gap - 10) + 'px'); setSt(is[3], 'left', gap + 'px');
      if (scoped && (rangeT -= dt) < 0) {
        rangeT = 0.12; ray.set(camera.position, camera.getWorldDirection(dir)); ray.far = 600;
        const rh = ray.intersectObjects(hittables.concat(world.colliders), false)[0];
        setTxt($('.rng'), rh ? Math.round(rh.distance) + 'M' : '---M');
      }
      // 화면 밖 표적 화살표
      const arws = qc.arws || (qc.arws = [...root.querySelectorAll('.arw')]); let ai = 0;
      for (const tt of active) {
        if (tt.state !== 'up' || ai >= arws.length) continue;
        tt.o.pivot.getWorldPosition(tmpA); tmpA.y += 1.4;
        const s = toScreen(tmpA);
        const inView = s.z < 1 && s.x > 0 && s.x < W && s.y > 0 && s.y < H;
        if (inView || scoped) continue;
        let vx = s.x - W / 2, vy = s.y - H / 2; if (s.z > 1) { vx = -vx; vy = -vy; }
        const ang = Math.atan2(vy, vx), m = Math.min((W / 2 - 30) / Math.abs(Math.cos(ang) || 1e-3), (H / 2 - 30) / Math.abs(Math.sin(ang) || 1e-3));
        const a = arws[ai++]; setSt(a, 'display', 'block');
        a.style.transform = `translate(${Math.round(W / 2 + Math.cos(ang) * m - 9)}px,${Math.round(H / 2 + Math.sin(ang) * m - 8)}px) rotate(${ang + Math.PI / 2}rad)`;
        setSt(a, 'borderBottomColor', tt.type === 'far' ? '#ff2e88' : tt.type === 'gold' ? '#ffd23f' : tt.type === 'zombie' ? '#3ddc84' : '#22e5ff');
      }
      for (; ai < arws.length; ai++) setSt(arws[ai], 'display', 'none');
    }
    if (msgT > 0 && (msgT -= dt) <= 0) $('.msg').style.opacity = 0;
    if (hmT > 0 && (hmT -= dt) <= 0) $('.hm').style.opacity = 0;

    // 1인칭 무기 자세
    const inGame = state === 'play' || state === 'count' || state === 'inter' || state.startsWith('pause:inter') || state.startsWith('pause:play') || state.startsWith('pause:count');
    if (inGame) {
      const asp = W / H, hx = clamp(asp / 1.6, 0.5, 1);
      vm.vkz -= vm.kz * 260 * dt; vm.vkz *= Math.exp(-22 * dt); vm.kz += vm.vkz * dt;
      vm.vkr -= vm.kr * 260 * dt; vm.vkr *= Math.exp(-20 * dt); vm.kr += vm.vkr * dt;
      vm.lagX = damp(vm.lagX, clamp(-lookDX * 0.0018, -0.08, 0.08), 10, dt); vm.lagY = damp(vm.lagY, clamp(-lookDY * 0.0018, -0.08, 0.08), 10, dt); lookDX = lookDY = 0;
      for (const gg of guns) {
        if (gg !== g) continue;
        const r = gg.root; const a = adsP;
        const bob = Math.sin(now * 1.6) * 0.004 * (1 - a), bobx = Math.cos(now * 0.8) * 0.003 * (1 - a);
        let px = gg.hip.x * hx * (1 - a) + gg.ads.x * a + bobx, py = gg.hip.y * (1 - a) + gg.ads.y * a + bob, pz = gg.hip.z * (1 - a) + gg.ads.z * a + vm.kz * 0.05;
        let rx = vm.kr * 0.05 + vm.lagY * (1 - a * 0.7), ry = vm.lagX * (1 - a * 0.7) + 0.035 * (1 - a), rz = 0;
        if (reloadT > 0) { const k = Math.sin(Math.PI * (1 - reloadT / reloadDur)); py -= k * 0.09; rz += k * 0.55; rx += k * 0.25; }
        if (swapT > 0) { const k = Math.sin(Math.PI * (1 - swapT / 0.55)); py -= k * 0.3; rx -= k * 0.6; }
        if (gg.bolt) {
          const b = boltT > 0 ? 1 - boltT / gg.rate : 1;
          const ph = b < 0.15 ? 0 : b < 0.35 ? (b - 0.15) / 0.2 : b < 0.6 ? 1 + (b - 0.35) / 0.25 : b < 0.8 ? 2 - (b - 0.6) / 0.2 : b < 0.95 ? 1 - (b - 0.8) / 0.15 : 0;
          gg.bolt.rotation.z = Math.min(1, ph) * 1.1; gg.bolt.position.z = 0.02 + Math.max(0, ph - 1) * 0.09;
          if (boltT > 0 && b > 0.1 && b < 0.9 && a < 0.95) { rz += 0.12 * Math.sin(Math.PI * b); }
        }
        r.position.set(px, py, pz); r.rotation.set(rx, ry, rz);
        r.visible = !scoped;
      }
    } else {
      // 진열(메뉴·결과)
      const g2 = guns[sel];
      showPivot.visible = state !== 'end';
      if (g2.root.parent !== showPivot) menuGun();
      // 메뉴 상자 위 빈 공간에 총이 들어가도록 거리 계산
      if (root._menuTop == null || root._menuFor !== state) {
        const box = root.querySelector('.panel.on .box');
        root._menuTop = box ? Math.max(H * 0.22, box.getBoundingClientRect().top - root.getBoundingClientRect().top - 8) : H * 0.4; root._menuFor = state;
      }
      const top = root._menuTop;
      const tf = Math.tan(vmCam.fov * Math.PI / 360);
      const fitW = g2.length / (0.86 * 2 * tf * (W / H)), fitH = (g2.length * 0.3) / (0.86 * 2 * tf * (top / H));
      const d = Math.max(0.6, fitW, fitH);
      showPivot.position.set(0, (1 - top / H) * tf * d, -d);
      showPivot.rotation.set(0.08 + Math.sin(now * 0.4) * 0.04, -Math.PI / 2 + Math.sin(now * 0.5) * 0.32, 0.03);
      for (const gg of guns) if (gg.bolt) { gg.bolt.rotation.z = 0; gg.bolt.position.z = 0.02; }
    }
    // 효과
    for (const gg of guns) if (gg.flashT > 0 && (gg.flashT -= dt) <= 0) gg.flash.visible = false;
    vmFlash.intensity *= Math.exp(-dt * 30); worldFlash.intensity *= Math.exp(-dt * 30);
    for (let i = 0; i < sparkN; i++) {
      if (sparkLife[i] <= 0) continue;
      sparkLife[i] -= dt; const j = i * 3;
      if (sparkLife[i] <= 0) { sparkPos[j + 1] = -999; continue; }
      sparkVel[j + 1] -= 9 * dt;
      sparkPos[j] += sparkVel[j] * dt; sparkPos[j + 1] += sparkVel[j + 1] * dt; sparkPos[j + 2] += sparkVel[j + 2] * dt;
      sparkCol[j] *= 0.95; sparkCol[j + 1] *= 0.93; sparkCol[j + 2] *= 0.9;
    }
    sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.color.needsUpdate = true;
    for (const s of glows) if (s.visible) { s.userData.life -= dt; s.material.opacity = Math.max(0, s.userData.life / 0.14); s.scale.setScalar(s.userData.size * (1.4 - s.material.opacity * 0.4)); if (s.userData.life <= 0) s.visible = false; }
    for (const m of tracers) if (m.visible) { m.userData.life -= dt; m.material.opacity = Math.max(0, m.userData.life / 0.07); if (m.userData.life <= 0) m.visible = false; }
    for (const m of shells) if (m.visible) { const v = m.userData.v; v.y -= 7 * dt; m.position.addScaledVector(v, dt); m.rotation.x += m.userData.spin * dt; m.rotation.y += dt * 9; if ((m.userData.life -= dt) <= 0) m.visible = false; }

    if (TIERS[tier].bloom) composer.render(dt);
    else {
      renderer.autoClear = false; renderer.setRenderTarget(null); renderer.clear();
      renderer.render(scene, camera); renderer.clearDepth(); renderer.render(vmScene, vmCam);
    }
  }

  // 처음 한 번: 모든 표적·효과를 미리 만들고 셰이더를 컴파일해 둔다(첫 등장 때 끊김 방지)
  function prewarm() {
    const tmp = [];
    for (const [type, n] of [['plate', 6], ['slider', 4], ['far', 2], ['gold', 2], ['drone', 4], ['zombie', 6]]) {
      for (let i = 0; i < n; i++) { const o = getObj(type); o.pivot.position.set(i * 2 - 6, type === 'drone' ? 3 : 0, -12 - tmp.length); tmp.push(o); }
    }
    const vis = [...guns.map((g) => g.root), ...guns.map((g) => g.flash), ...glows, ...tracers, ...shells];
    const was = vis.map((o) => o.visible);
    vis.forEach((o) => { o.visible = true; });
    for (const s2 of glows) s2.position.set(0, 1.5, -10);
    for (const m of tracers) { m.position.set(0, 1.5, -10); m.scale.set(0.02, 0.02, 1); }
    burst(new THREE.Vector3(0, 1.5, -10), 4, COL_SPARK, 1);
    vmFlash.intensity = 1; worldFlash.intensity = 1;
    $('.scope').style.display = 'block'; $('.hud').style.display = '';
    camera.lookAt(0, 1, -12); camera.updateMatrixWorld();
    try {
      renderer.compile(scene, camera); renderer.compile(vmScene, vmCam);
      composer.render(0.016);
      renderer.autoClear = false; renderer.setRenderTarget(null); renderer.clear(); renderer.render(scene, camera); renderer.clearDepth(); renderer.render(vmScene, vmCam);
    } catch (e) { /* 미지원이어도 게임은 진행 */ }
    tmp.forEach(freeObj);
    vis.forEach((o, i) => { o.visible = was[i]; });
    vmFlash.intensity = 0; worldFlash.intensity = 0;
    $('.scope').style.display = 'none'; $('.hud').style.display = 'none';
  }

  // 시작
  resize();
  prewarm();
  $('.load').remove();
  const api = { open, exit, startGame, get state() { return state; }, get score() { return score; }, debug: { camera, get active() { return active; }, aim: (y, p) => { yaw = y; pitch = p; }, fire: () => fire(), setAds: (v) => { adsToggle = v; }, swap, guns, sched: () => sched, stage: (n) => beginStage(n) } };
  if (/rgdebug/.test(location.hash)) window.__rg = api;
  open();
  return api;
}
