/* 별똥별 피하기 v2 — 5락실 오리지널 (2026-11-14 디자인 개편)
   규칙·점수는 1판과 같다: 별똥별에 닿으면 끝, 0.1초마다 1점, 노란 별 +50점, 매일 같은 판(seeded('dodge'+KST)).
   바뀐 것은 겉모습: 전체 화면, 고정 폭 경기장(기기마다 같은 넓이), 미리 그린 스프라이트, 불꽃 꼬리·입자·흔들림, 효과음·배경음, 결과 화면.
   그림·소리·음악 모두 코드로 생성. 특정 기존 게임의 이름·캐릭터·그림·음악을 쓰지 않는다. */
(function () {
'use strict';
const DEBUG = /dgdebug/.test(location.hash);
const STEP = 1 / 60, FW = 400, PR = 11; // 경기장 폭(논리 단위), 주인공 판정 반지름
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const FONT_N = '"Press Start 2P",monospace', FONT_K = '"Black Han Sans",system-ui,sans-serif';
const C = { cy: '#22d3ee', pk: '#ff3d9a', ye: '#ffd23f', gr: '#3ddc84', pu: '#b06bff', or: '#ff8a3d', rd: '#ff4d4d' };

/* ---------- 소리(웹오디오 합성) ---------- */
const A = { ctx: null, master: null, mus: null, muted: false, next: 0, step: 0, last: {} };
try { A.muted = localStorage.getItem('dg_mute') === '1'; } catch (e) {}
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { A.ctx = new AC(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .45; A.master.connect(A.ctx.destination); A.mus = A.ctx.createGain(); A.mus.gain.value = .3; A.mus.connect(A.master); } catch (e) { A.ctx = null; }
}
function tone(type, f, t, a, dur, f2, dest) {
  if (!A.ctx) return; const o = A.ctx.createOscillator(), g = A.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * .8);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(dest || A.master); o.start(t); o.stop(t + dur + .02);
}
function noise(t, a, dur, hp) {
  if (!A.ctx) return; const n = Math.floor(A.ctx.sampleRate * dur), b = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = A.ctx.createBufferSource(), f = A.ctx.createBiquadFilter(), g = A.ctx.createGain(); s.buffer = b; f.type = hp ? 'highpass' : 'lowpass'; f.frequency.value = hp || 900; g.gain.value = a;
  s.connect(f); f.connect(g); g.connect(A.master); s.start(t);
}
function sfx(k) {
  if (!A.ctx || A.muted) return; const t = A.ctx.currentTime; if (A.last[k] && t - A.last[k] < .05) return; A.last[k] = t;
  if (k === 'star') [988, 1319, 1760].forEach((f, i) => tone('sine', f, t + i * .05, .14, .18));
  else if (k === 'near') noise(t, .12, .16, 2400);
  else if (k === 'lvl') [523, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * .06, .12, .16));
  else if (k === 'boom') { noise(t, .5, .9); tone('sawtooth', 220, t, .22, .8, 35); }
  else if (k === 'go') [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, t + i * .06, .12, .18));
  else if (k === 'best') [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, t + i * .08, .15, .28));
}
// 배경음: 마이너 신스 베이스 + 아르페지오. 속도 단계가 오를수록 빨라진다(연출만).
const PROG = [[45, 57, 60, 64], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]];
function music(lv) {
  if (!A.ctx || A.muted) return; const bpm = 112 + Math.min(36, (lv - 1) * 4), st = 60 / bpm / 4, now = A.ctx.currentTime;
  if (A.next < now) A.next = now + .05;
  while (A.next < now + .2) {
    const s = A.step % 16, ch = PROG[Math.floor(A.step / 16) % 4], t = A.next, mf = n => 440 * Math.pow(2, (n - 69) / 12);
    if (s % 4 === 0) tone('sine', mf(ch[0] - 12), t, .5, .28, null, A.mus);
    if (s % 2 === 0) tone('triangle', mf(ch[1 + (s >> 1) % 3] + 12), t, .08, .12, null, A.mus);
    if (lv >= 3 && s % 2 === 1) tone('square', mf(ch[1 + ((s >> 1) + 1) % 3] + 24), t, .025, .07, null, A.mus);
    if (s === 0 || s === 8 || (lv >= 5 && s === 12)) tone('sine', 130, t, .45, .12, 45, A.mus);
    if (s === 4 || s === 12) noise(t, .05, .06, 5000);
    A.next += st; A.step++;
  }
}

/* ---------- 스프라이트(미리 그림) ---------- */
let SP = null, RES = 2;
function mkc(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function glow(col, r, core) {
  const sz = r * 2 * RES, cv = mkc(sz, sz), c = cv.getContext('2d'), g = c.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
  g.addColorStop(0, '#fff'); g.addColorStop(core || .2, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, sz, sz);
  return { cv, h: r };
}
// 별똥별 모양(꾸미기, 판정 크기는 같음): ''=불꽃 운석, ice=얼음 운석, candy=사탕 별똥별
const RKS = {
  '': { tail: ['#fff4c0', '#ffb347', '#ff5a1f', 'rgba(255,40,80,0)'], glow: '#ff7a2f', ember: ['#ffd27a', '#ff8a3d', '#ff5a3d'] },
  ice: { tail: ['#ffffff', '#bff0ff', '#4fb8ff', 'rgba(60,120,255,0)'], glow: '#7fd8ff', ember: ['#ffffff', '#bff0ff', '#7fd8ff'] },
  candy: { tail: ['#ffffff', '#ffb3e6', '#ff5fc8', 'rgba(176,107,255,0)'], glow: '#ff7ad9', ember: ['#ffd23f', '#7fffd4', '#ff9ee8', '#b06bff'] },
};
const R0 = 24; // 스프라이트 기준 반지름
function lumpy(c, r, seed, n, amp) {
  c.beginPath();
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832, k = 1 - amp + amp * (.5 + .5 * Math.sin(seed * 7.1 + i * 2.3) * Math.cos(seed * 3.7 + i * 1.3)); c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); }
  c.closePath();
}
function rockSprite(kind, v) {
  const sz = (R0 * 2 + 6) * RES, cv = mkc(sz, sz), c = cv.getContext('2d'); c.translate(sz / 2, sz / 2); c.scale(RES, RES);
  const r = R0;
  if (kind === 'ice') {
    // 각진 얼음 결정
    c.beginPath(); const n = 7; for (let i = 0; i < n; i++) { const a = i / n * 6.2832 + v, k = i % 2 ? .82 : 1; c.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); } c.closePath();
    const g = c.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#f2fdff'); g.addColorStop(.45, '#8fdcff'); g.addColorStop(1, '#2058a8'); c.fillStyle = g; c.fill();
    c.strokeStyle = '#ffffffcc'; c.lineWidth = 1.6; c.stroke();
    c.strokeStyle = '#ffffff66'; c.lineWidth = 1.2; for (let i = 0; i < n; i += 2) { const a = i / n * 6.2832 + v; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
    c.fillStyle = '#ffffffdd'; c.beginPath(); c.ellipse(-r * .35, -r * .35, r * .22, r * .1, -.8, 0, 7); c.fill();
  } else if (kind === 'candy') {
    // 줄무늬 사탕
    c.beginPath(); c.arc(0, 0, r, 0, 7); const g = c.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r); g.addColorStop(0, '#ffd6f3'); g.addColorStop(.6, '#ff6ccf'); g.addColorStop(1, '#b0208a'); c.fillStyle = g; c.fill();
    c.save(); c.clip(); c.strokeStyle = '#ffffffd0'; c.lineWidth = r * .22;
    for (let k = 0; k < 3; k++) { c.beginPath(); for (let a = 0; a < 9; a += .2) { const rr = a / 9 * r * 1.05; c.lineTo(Math.cos(a + k * 2.094 + v) * rr, Math.sin(a + k * 2.094 + v) * rr); } c.stroke(); }
    c.restore(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r - 1, 0, 7); c.stroke();
    c.fillStyle = '#ffffffcc'; c.beginPath(); c.ellipse(-r * .38, -r * .42, r * .25, r * .12, -.7, 0, 7); c.fill();
  } else {
    // 불타는 운석: 울퉁불퉁한 바위 + 앞쪽(아래)이 달아오름
    lumpy(c, r, v + 1, 14, .22);
    const g = c.createRadialGradient(0, r * .35, r * .1, 0, 0, r * 1.15);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(.22, '#ffb347'); g.addColorStop(.5, '#e2531a'); g.addColorStop(.78, '#6b2412'); g.addColorStop(1, '#2a0d06'); c.fillStyle = g; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 5; i++) { const a = v * 3 + i * 1.9, d = r * (.25 + .45 * ((i * 37 + v * 11) % 10) / 10), cr = r * (.12 + .06 * (i % 3)); const cx = Math.cos(a) * d, cy = Math.sin(a) * d - r * .15;
      c.fillStyle = '#00000055'; c.beginPath(); c.arc(cx, cy, cr, 0, 7); c.fill(); c.fillStyle = '#ffcf9a33'; c.beginPath(); c.arc(cx + cr * .25, cy + cr * .3, cr * .7, 0, 3.14); c.fill(); }
    c.restore();
    c.strokeStyle = '#ffd9a066'; c.lineWidth = 1.4; lumpy(c, r, v + 1, 14, .22); c.stroke();
  }
  return { cv, h: sz / 2 / RES };
}
function tailSprite(kind) {
  const w = R0 * 2, h = R0 * 8, cv = mkc(w * RES, h * RES), c = cv.getContext('2d'); c.scale(RES, RES);
  const col = RKS[kind].tail, g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, col[0]); g.addColorStop(.12, col[1]); g.addColorStop(.4, col[2]); g.addColorStop(1, col[3]);
  c.fillStyle = g; c.beginPath(); c.moveTo(w * .08, h - R0); c.quadraticCurveTo(w * .2, h * .4, w * .5, 0); c.quadraticCurveTo(w * .8, h * .4, w * .92, h - R0); c.arc(w / 2, h - R0, w * .42, 0, Math.PI); c.fill();
  // 가운데 밝은 심지
  const g2 = c.createLinearGradient(0, h, 0, h * .35); g2.addColorStop(0, '#ffffffcc'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2;
  c.beginPath(); c.moveTo(w * .35, h - R0); c.quadraticCurveTo(w * .45, h * .55, w * .5, h * .35); c.quadraticCurveTo(w * .55, h * .55, w * .65, h - R0); c.fill();
  return { cv, w, h };
}
function starSprite() {
  const r = 14, sz = (r * 2 + 16) * RES, cv = mkc(sz, sz), c = cv.getContext('2d'); c.translate(sz / 2, sz / 2); c.scale(RES, RES);
  c.shadowColor = C.ye; c.shadowBlur = 12;
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * .6283, rr = i % 2 ? r * .45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
  const g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#fff7c2'); g.addColorStop(.5, '#ffd23f'); g.addColorStop(1, '#ff9f1a'); c.fillStyle = g; c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#fff8'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = '#5a3a00'; c.beginPath(); c.arc(-r * .2, -r * .05, 1.6, 0, 7); c.arc(r * .2, -r * .05, 1.6, 0, 7); c.fill();
  c.strokeStyle = '#5a3a00'; c.lineWidth = 1.3; c.beginPath(); c.arc(0, r * .08, r * .14, .3, 2.84); c.stroke();
  return { cv, h: sz / 2 / RES };
}
function buildSprites() {
  const s = { rock: {}, tail: {}, glow: {} };
  for (const k in RKS) { s.rock[k] = [0, 1, 2].map(v => rockSprite(k, v * 2.1 + .4)); s.tail[k] = tailSprite(k); s.glow[k] = glow(RKS[k].glow, 40, .08); }
  s.star = starSprite(); s.starGlow = glow(C.ye, 34, .1); s.spark = glow('#ffffff', 8, .25); s.eng = glow('#5ad8ff', 18, .2); s.engF = glow('#ff9a3d', 18, .2);
  return s;
}

/* ---------- 화면·DOM ---------- */
let ov, cv, x, hudBtns, panel, opts, G = null, raf = 0, paused = false, last = 0, acc = 0, BG = null;
let lay = { s: 1, dpr: 1, cw: 0, ch: 0, S: 1, ox: 0, oy: 0 }, FH = 640;
let CH = '', RK = '';
function css() {
  const st = document.createElement('style');
  st.textContent = '.dg-ov{position:fixed;inset:0;z-index:9999;background:#060318;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}.dg-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.dg-btns{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;gap:6px;z-index:2}.dg-btns button{width:38px;height:38px;border-radius:10px;border:1px solid #ffffff44;background:#0c0620cc;color:#fff;font-size:16px;cursor:pointer}'
    + '.dg-pn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:#03010acc;overflow:auto;padding:12px}.dg-pn>div{width:min(340px,92vw);margin:auto;text-align:center;color:#fff;background:#0c0620;border:2px solid #ff8a3d;border-radius:16px;padding:16px 14px;box-shadow:0 0 30px #ff8a3d55}'
    + '.dg-pn h3{font-family:' + FONT_K + ';font-weight:400;font-size:22px;color:#ffd23f;margin:2px 0 10px;text-shadow:0 0 12px #ffd23f}.dg-pn .sc{font-family:' + FONT_N + ';font-size:22px;color:#22d3ee;margin:6px 0;text-shadow:0 0 10px #22d3ee}.dg-pn .nb{display:inline-block;font-family:' + FONT_N + ';font-size:10px;color:#1a0f00;background:#ffd23f;border-radius:6px;padding:4px 7px;margin:2px 0 4px;box-shadow:0 0 14px #ffd23f}.dg-pn p{margin:6px 0;font-size:14px;color:#cfc8ff;line-height:1.5}'
    + '.dg-pn .st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0}.dg-pn .st span{background:#ffffff0f;border-radius:10px;padding:7px 4px;font-size:12px;color:#a99fd6}.dg-pn .st b{display:block;font-family:' + FONT_N + ';font-size:12px;color:#fff;margin-top:4px}'
    + '.dg-pn button{display:block;width:100%;margin:8px 0 0;padding:12px;border-radius:12px;border:0;font:inherit;font-size:16px;font-weight:800;cursor:pointer}.dg-pn .p1{background:#ffd23f;color:#1a0f00;box-shadow:0 4px 0 #b8860b}.dg-pn .p2{background:#ff3d9a;color:#fff}.dg-pn .p3{background:#ffffff1a;color:#fff}'
    + '.dg-pn .k{display:none}@media (pointer:fine){.dg-pn .k{display:inline;color:#7d74b0;font-size:11px;margin-left:4px}}';
  document.head.appendChild(st);
}
function mkDom() {
  css();
  ov = document.createElement('div'); ov.className = 'dg-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  hudBtns = document.createElement('div'); hudBtns.className = 'dg-btns';
  hudBtns.innerHTML = '<button type="button" data-k="m" aria-label="소리"></button><button type="button" data-k="p" aria-label="일시정지">Ⅱ</button><button type="button" data-k="x" aria-label="나가기">✕</button>';
  ov.appendChild(hudBtns);
  panel = document.createElement('div'); panel.className = 'dg-pn'; panel.hidden = true; ov.appendChild(panel);
  document.body.appendChild(ov);
  const mb = hudBtns.querySelector('[data-k=m]'); mb.textContent = A.muted ? '🔇' : '🔊';
  hudBtns.addEventListener('pointerdown', e => e.stopPropagation());
  hudBtns.onclick = e => {
    const k = e.target.dataset.k;
    if (k === 'm') { A.muted = !A.muted; mb.textContent = A.muted ? '🔇' : '🔊'; try { localStorage.setItem('dg_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .45; }
    if (k === 'p') pause(!paused);
    if (k === 'x') close();
  };
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play' && !paused) pause(true, true); });
  addEventListener('blur', () => { if (!ov.hidden && G && G.mode === 'play' && !paused && !DEBUG) pause(true, true); });
  input();
}
// 경기장 폭은 어느 기기든 400(논리 단위)으로 같다. 높이는 화면 비율에 맞춰 560~820(별똥별 속도는 높이에 비례해서 떨어지는 시간은 같음).
function layout(newH) {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (cw * ch));
  if (newH) FH = Math.round(clamp(FW * ch / cw, 560, 820));
  const s = Math.min(cw / FW, ch / FH), S = s * dpr;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  lay = { s, dpr, cw, ch, S, ox: (cv.width - FW * S) / 2, oy: (cv.height - FH * S) / 2 };
  const r = clamp(Math.ceil(S), 1, 3); if (r !== RES || !SP) { RES = r; SP = buildSprites(); }
  buildBg(); stars();
}
function buildBg() {
  const W = cv.width, H = cv.height, S = lay.S; BG = mkc(W, H); const c = BG.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05021a'); g.addColorStop(.55, '#12063a'); g.addColorStop(1, '#2a0b45'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  // 성운(부드러운 빛 덩어리)
  const blob = (bx, by, r, col, a) => { const gg = c.createRadialGradient(bx, by, 0, bx, by, r); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = gg; c.fillRect(bx - r, by - r, r * 2, r * 2); };
  c.globalCompositeOperation = 'lighter';
  blob(W * .2, H * .25, 260 * S, '#ff3d9a', .22); blob(W * .85, H * .15, 220 * S, '#22d3ee', .18); blob(W * .6, H * .5, 300 * S, '#6b2bff', .2); blob(W * .1, H * .7, 200 * S, '#22d3ee', .1);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  // 먼 은하 띠
  c.save(); c.translate(W * .5, H * .35); c.rotate(-.5); const gb = c.createLinearGradient(0, -60 * S, 0, 60 * S); gb.addColorStop(0, 'rgba(255,255,255,0)'); gb.addColorStop(.5, 'rgba(200,180,255,.08)'); gb.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gb; c.fillRect(-W, -60 * S, W * 2, 120 * S); c.restore();
  // 아래쪽 행성 지평선(경기장 바닥 아래)
  const by = lay.oy + (FH - 6) * S, R = Math.max(W, FW * S) * 1.4, cx = W / 2, cy = by + R;
  const pg = c.createRadialGradient(cx, cy - R * .2, R * .6, cx, cy, R); pg.addColorStop(0, '#12052a'); pg.addColorStop(.92, '#2b0c52'); pg.addColorStop(1, '#5b1f8a'); c.fillStyle = pg; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.strokeStyle = '#ff3d9a'; c.globalAlpha = .18; c.lineWidth = Math.max(1, S);
  for (let i = 1; i < 6; i++) { c.beginPath(); c.arc(cx, cy, R - i * i * 6 * S, 3.6, 5.8); c.stroke(); }
  for (let i = -8; i <= 8; i++) { c.beginPath(); c.moveTo(cx + i * 22 * S, by); c.lineTo(cx + i * 140 * S, by + 160 * S); c.stroke(); }
  c.restore(); c.globalAlpha = 1;
  c.shadowColor = '#ff7ad9'; c.shadowBlur = 24 * S; c.strokeStyle = '#ff9ee8'; c.lineWidth = 2.5 * S; c.beginPath(); c.arc(cx, cy, R, 3.4, 6.0); c.stroke(); c.shadowBlur = 0;
  // 가로 화면 양옆: 고리 행성과 달(연출만)
  if (lay.ox > 120 * S) {
    const ring = (px, py, r, c1, c2, rc) => {
      c.save(); c.translate(px, py); c.rotate(-.35);
      c.strokeStyle = rc; c.lineWidth = r * .12; c.globalAlpha = .55; c.beginPath(); c.ellipse(0, 0, r * 1.9, r * .45, 0, Math.PI, 0); c.stroke(); c.globalAlpha = 1;
      const pg2 = c.createRadialGradient(-r * .4, -r * .4, r * .1, 0, 0, r); pg2.addColorStop(0, c1); pg2.addColorStop(1, c2); c.fillStyle = pg2; c.shadowColor = c1; c.shadowBlur = r * .5; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.shadowBlur = 0;
      c.save(); c.beginPath(); c.arc(0, 0, r, 0, 7); c.clip(); c.globalAlpha = .18; c.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) c.fillRect(-r, i * r * .26, r * 2, r * .08); c.restore(); c.globalAlpha = 1;
      c.strokeStyle = rc; c.lineWidth = r * .12; c.globalAlpha = .8; c.beginPath(); c.ellipse(0, 0, r * 1.9, r * .45, 0, 0, Math.PI); c.stroke(); c.globalAlpha = 1; c.restore();
    };
    const sw = lay.ox, r1 = Math.min(sw * .32, H * .16);
    ring(sw * .48, H * .3, r1, '#ffb3e6', '#5b1f8a', '#ffd23f');
    const mx = lay.ox + FW * S + sw * .5, my = H * .62, r2 = Math.min(sw * .2, H * .1);
    const mg = c.createRadialGradient(mx - r2 * .4, my - r2 * .4, r2 * .1, mx, my, r2); mg.addColorStop(0, '#e9fdff'); mg.addColorStop(1, '#1d5a8a'); c.fillStyle = mg; c.shadowColor = '#22d3ee'; c.shadowBlur = r2 * .6; c.beginPath(); c.arc(mx, my, r2, 0, 7); c.fill(); c.shadowBlur = 0;
    c.fillStyle = '#0b2a4a55'; [[.3, -.2, .22], [-.35, .25, .16], [.1, .45, .12]].forEach(q => { c.beginPath(); c.arc(mx + q[0] * r2, my + q[1] * r2, q[2] * r2, 0, 7); c.fill(); });
  }
  // 경기장 바깥(가로 화면): 살짝 어둡게 + 네온 테두리
  if (lay.ox > 4) {
    c.fillStyle = '#00000066'; c.fillRect(0, 0, lay.ox, H); c.fillRect(lay.ox + FW * S, 0, lay.ox + 2, H);
    c.shadowColor = C.cy; c.shadowBlur = 14 * S; c.strokeStyle = '#22d3ee88'; c.lineWidth = 2 * S;
    c.beginPath(); c.moveTo(lay.ox, 0); c.lineTo(lay.ox, H); c.moveTo(lay.ox + FW * S, 0); c.lineTo(lay.ox + FW * S, H); c.stroke(); c.shadowBlur = 0;
  }
}
// 별 3겹(가까울수록 빠르고 크게). 화면 기준, 연출만.
let SKY = [];
function stars() { SKY = []; for (let i = 0; i < 140; i++) { const z = i < 80 ? 0 : i < 120 ? 1 : 2; SKY.push({ x: Math.random(), y: Math.random(), z, tw: Math.random() * 6.28 }); } }

/* ---------- 입력: PC ← → (A/D), 모바일·마우스는 누른 채 좌우로 끌면 손가락 위치로 이동(1판과 같음) ---------- */
const keys = {};
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; const k = e.key;
    if (/^Arrow|^[adAD ]$/.test(k)) e.preventDefault();
    if (G && G.mode === 'over' && (k === 'Enter' || k === ' ')) { const b = panel.querySelector('[data-k=r]'); if (b) b.click(); return; }
    if (k === 'Escape' || k === 'p' || k === 'P') { if (G && G.mode === 'play') pause(!paused); return; }
    if (paused && G && G.mode === 'play') { pause(false); return; }
    keys[k.length === 1 ? k.toLowerCase() : k] = 1;
  });
  addEventListener('keyup', e => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = 0; });
  const fx = e => (e.clientX * lay.dpr - lay.ox) / lay.S;
  ov.addEventListener('pointerdown', e => {
    if (paused) { pause(false); return; }
    audioInit(); if (!G) return; G.drag = fx(e); G.pid = e.pointerId; try { ov.setPointerCapture(e.pointerId); } catch (er) {}
  });
  ov.addEventListener('pointermove', e => { if (G && G.drag !== null && G.pid === e.pointerId) G.drag = fx(e); });
  const up = e => { if (G && G.pid === e.pointerId) G.drag = null; };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('contextmenu', e => e.preventDefault());
}

/* ---------- 게임 ---------- */
function newGame() {
  layout(true);
  let best = 0; try { best = +localStorage.getItem('dg_best_' + opts.day) || 0; } catch (e) {}
  G = {
    mode: 'play', t: 0, px: FW / 2, py: FH - 48, vx: 0, tilt: 0, drag: null, pid: null, R: opts.rng(), rocks: [], bon: [], fx: [], texts: [], rings: [],
    score: 0, stars: 0, near: 0, spawn: 0, bspawn: 3, lv: 1, pauseLeft: 1, cnt: 0, autoP: false, shake: 0, flash: 0, dead: 0, best, debug: DEBUG, scroll: 0,
  };
}
function speed() { return FH * (.45 + G.t / 40); }
function update(dt) {
  G.t += dt; const sp = speed(), R = G.R, ox = G.px;
  if (keys.ArrowLeft || keys.a) G.px -= FW * 1.1 * dt; if (keys.ArrowRight || keys.d) G.px += FW * 1.1 * dt;
  if (G.bot) G.drag = botX();
  if (G.drag !== null) G.px += (G.drag - G.px) * Math.min(1, dt * 14);
  G.px = clamp(G.px, 14, FW - 14); G.vx += ((G.px - ox) / dt - G.vx) * .25; G.tilt = clamp(G.vx / 900, -.35, .35);
  // 생성 순서·간격은 1판과 같다(같은 판 공정성)
  G.spawn -= dt; if (G.spawn <= 0) { G.spawn = Math.max(.18, .7 - G.t / 60); G.rocks.push({ x: R() * FW, y: -20, r: 6 + R() * 10, v: sp * (.8 + R() * .6), rot: Math.random() * 6.28, vr: (Math.random() - .5) * 3, k: (Math.random() * 3) | 0 }); }
  G.bspawn -= dt; if (G.bspawn <= 0) { G.bspawn = 4 + R() * 3; G.bon.push({ x: 20 + R() * (FW - 40), y: -20, v: sp * .7, a: Math.random() * 6 }); }
  const py = G.py;
  for (const r of G.rocks) {
    const y0 = r.y; r.y += r.v * dt; r.rot += r.vr * dt;
    if (Math.random() < dt * 30) ember(r);
    if (Math.hypot(r.x - G.px, r.y - py) < r.r + PR && !G.god) { die(r); return; }
    // 아슬아슬하게 비켜 간 별똥별: 반짝임만(점수 없음)
    if (y0 < py && r.y >= py && Math.abs(r.x - G.px) < r.r + PR + 16) { G.near++; for (let i = 0; i < 6; i++) G.fx.push({ x: G.px + Math.sign(r.x - G.px) * 14, y: py, vx: Math.sign(r.x - G.px) * (40 + Math.random() * 80), vy: (Math.random() - .5) * 120, t: 0, life: .35, col: '#bff6ff', s: 2 }); sfx('near'); }
  }
  G.rocks = G.rocks.filter(r => r.y < FH + 30);
  G.bon = G.bon.filter(b => {
    b.y += b.v * dt; b.a += dt * 3;
    if (Math.hypot(b.x - G.px, b.y - py) < 22) { G.score += 50; G.stars++; sfx('star'); G.rings.push({ x: b.x, y: b.y, t: 0, col: C.ye }); G.texts.push({ x: b.x, y: b.y - 10, s: '+50', t: 0, col: C.ye }); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28; G.fx.push({ x: b.x, y: b.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, t: 0, life: .5, col: i % 2 ? '#fff6c8' : C.ye, s: 3 }); } return false; }
    return b.y < FH + 20;
  });
  G.score += dt * 10;
  const lv = Math.floor(G.t / 10) + 1; if (lv > G.lv) { G.lv = lv; sfx('lvl'); G.texts.push({ ui: 1, s: 'SPEED UP!  Lv.' + lv, t: 0, col: C.cy }); }
  stepFx(dt);
}
function ember(r) {
  const col = RKS[RK].ember, a = Math.random() * 6.28, d = Math.random() * r.r * .8;
  G.fx.push({ x: r.x + Math.cos(a) * d, y: r.y - r.r * .4 + Math.sin(a) * d * .5, vx: (Math.random() - .5) * 30, vy: -r.v * (.05 + Math.random() * .12), t: 0, life: .25 + Math.random() * .35, col: col[(Math.random() * col.length) | 0], s: 1.5 + Math.random() * 2, add: 1 });
}
function stepFx(dt) {
  for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .97; f.vy *= .97; }
  G.fx = G.fx.filter(f => f.t < f.life); if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500);
  for (const t of G.texts) t.t += dt; G.texts = G.texts.filter(t => t.t < (t.ui ? 1.6 : .8));
  for (const r of G.rings) r.t += dt; G.rings = G.rings.filter(r => r.t < .5);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.6); if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 2.5);
}
function die(r) {
  G.mode = 'dying'; G.dead = 1.3; G.shake = .8; G.flash = .7; sfx('boom'); G.hit = r;
  const cols = ['#ffffff', '#ffd23f', '#ff8a3d', C.cy, C.pk];
  for (let i = 0; i < 46; i++) { const a = Math.random() * 6.28, v = 60 + Math.random() * 260; G.fx.push({ x: G.px, y: G.py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: .6 + Math.random() * .7, col: cols[i % cols.length], s: 2 + Math.random() * 3, add: 1 }); }
  G.rings.push({ x: G.px, y: G.py, t: 0, col: '#fff', big: 1 });
}
function finish() {
  G.mode = 'over'; const s = Math.floor(G.score), mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
  const nb = s > G.best; G.result = { score: s, time: G.t, stars: G.stars };
  if (!G.debug) opts.submit(s);
  if (nb) { G.best = s; try { localStorage.setItem('dg_best_' + opts.day, s); } catch (e) {} sfx('best'); }
  if (G.bot) return;
  panel.innerHTML = '<div><h3>' + (nb ? '🎉 오늘 최고 기록!' : '💥 쾅! 부딪혔어요') + '</h3>' + (nb ? '<span class="nb">NEW BEST</span>' : '') + '<div class="sc">' + s.toLocaleString() + '</div>'
    + '<div class="st"><span>버틴 시간<b>' + mm + ':' + String(ss).padStart(2, '0') + '</b></span><span>모은 별<b>⭐' + G.stars + '</b></span><span>아슬아슬<b>' + G.near + '</b></span></div>'
    + '<p>오늘 내 최고 ' + G.best.toLocaleString() + '점</p>'
    + '<button type="button" class="p1" data-k="r">▶ 다시 도전<span class="k">Enter</span></button><button type="button" class="p2" data-k="s">결과 공유</button><button type="button" class="p3" data-k="shop">🛍️ 이 게임 상점 (캐릭터·별똥별)</button><button type="button" class="p3" data-k="x">나가기</button></div>';
  panel.hidden = false;
  panel.onclick = e => { const k = e.target.closest('button') && e.target.closest('button').dataset.k; if (k === 'r') { panel.hidden = true; audioInit(); applySkin(); newGame(); sfx('go'); last = performance.now(); } else if (k === 's') opts.share(s, G.result); else if (k === 'shop') close('shop'); else if (k === 'x') close(); };
}
// 멈춤: 손으로 멈추는 건 한 판에 1번(다른 게임과 같은 규칙). 자동 멈춤은 횟수에 안 셈. 다시 시작은 3초 카운트다운, 멈춘 동안 화면 가림.
function pause(p, auto) {
  if (!G || G.mode !== 'play') return;
  if (p) {
    if (paused || G.cnt > 0) return;
    if (!auto) { if (G.pauseLeft <= 0) { G.texts.push({ ui: 1, s: '멈춤은 한 판에 1번!', t: 0, col: C.rd }); return; } G.pauseLeft--; }
    paused = true; G.autoP = !!auto; if (A.ctx) A.ctx.suspend();
  } else { if (!paused) return; paused = false; G.cnt = 3; if (A.ctx) A.ctx.resume(); }
  G.drag = null; last = performance.now();
}
// 봇(밸런스·화면 시험용, #dgdebug 에서만): 앞으로 0.7초 안에 내려올 별똥별과 가장 먼 자리로
function botX() {
  // 후보 지점마다 그쪽으로 최고 속도로 움직인다고 보고 0.9초 동안 부딪히는지 시험
  const sp = FW * 1.1, cand = []; for (let cx = 14; cx <= FW - 14; cx += 8) cand.push(cx);
  let bx = G.px, bc = 1e9;
  for (const cx of cand) {
    let hit = 0, px = G.px, minD = 1e9;
    for (let t = 0; t <= .9; t += 1 / 30) {
      const dx = cx - px; px += Math.sign(dx) * Math.min(Math.abs(dx), sp / 30);
      for (const r of G.rocks) { const ry = r.y + r.v * t, d = Math.hypot(r.x - px, ry - G.py) - r.r - PR; if (d < minD) minD = d; if (d < 3) { hit = 1 + (.9 - t); break; } }
      if (hit) break;
    }
    let c = hit * 100 + Math.abs(cx - G.px) * .01 - Math.min(minD, 40) * .05 + Math.abs(cx - FW / 2) * .004;
    for (const b of G.bon) { const ty = (G.py - b.y) / b.v; if (ty > 0 && ty < .9 && Math.abs(b.x - cx) < 20) c -= 1; }
    if (c < bc) { bc = c; bx = cx; }
  }
  return bx;
}

/* ---------- 그리기 ---------- */
function applySkin() { try { const B = opts.bonus; if (B) { CH = B.gitem('dodge', 'ch'); RK = B.gitem('dodge', 'rk'); } } catch (e) {} if (!RKS[RK]) RK = ''; }
const WX = wx => lay.ox + wx * lay.S, WY = wy => lay.oy + wy * lay.S;
function drawSky(dt) {
  const W = cv.width, H = cv.height, S = lay.S, T = performance.now() / 1000, v = G ? speed() / FH : .5;
  for (const s of SKY) {
    const sp = [.02, .06, .16][s.z] * v * (G && G.mode === 'dying' ? .2 : 1);
    if (!paused) s.y += sp * dt; if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
    const a = s.z === 0 ? .35 + .25 * Math.sin(T * 2 + s.tw) : s.z === 1 ? .6 : .85, sz = [1, 1.6, 2.2][s.z] * S;
    x.globalAlpha = a; x.fillStyle = s.z === 2 ? '#d8f6ff' : '#ffffff';
    if (s.z === 2 && v > 1) { x.fillRect(s.x * W, s.y * H, sz * .6, sz * (2 + v * 3)); } else x.fillRect(s.x * W, s.y * H, sz, sz);
  }
  x.globalAlpha = 1;
}
function drawRocks() {
  const S = lay.S, sk = RK, tl = SP.tail[sk], gl = SP.glow[sk];
  x.globalCompositeOperation = 'lighter';
  for (const r of G.rocks) { const k = r.r / R0, X = WX(r.x), Y = WY(r.y), tw = tl.w * k * S, th = tl.h * k * S * (.75 + Math.min(.8, r.v / FH * .35)); x.globalAlpha = .9; x.drawImage(tl.cv, X - tw / 2, Y + R0 * k * S - th, tw, th); }
  for (const f of G.fx) if (f.add) { const a = 1 - f.t / f.life; x.globalAlpha = a; x.fillStyle = f.col; const z = f.s * S * (.5 + a * .5); x.fillRect(WX(f.x) - z / 2, WY(f.y) - z / 2, z, z); }
  for (const r of G.rocks) { const h = gl.h * r.r / 16 * S; x.globalAlpha = .55; x.drawImage(gl.cv, WX(r.x) - h, WY(r.y) - h * .8, h * 2, h * 2); }
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  for (const r of G.rocks) { const s = SP.rock[sk][r.k], h = s.h * r.r / R0 * S; x.save(); x.translate(WX(r.x), WY(r.y)); x.rotate(r.rot); x.drawImage(s.cv, -h, -h, h * 2, h * 2); x.restore(); }
}
function drawStars() {
  const S = lay.S;
  for (const b of G.bon) {
    const X = WX(b.x), Y = WY(b.y), p = 1 + Math.sin(b.a * 2) * .12, gh = SP.starGlow.h * S * p, h = SP.star.h * S * p;
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55; x.drawImage(SP.starGlow.cv, X - gh, Y - gh, gh * 2, gh * 2); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.save(); x.translate(X, Y); x.rotate(Math.sin(b.a) * .35); x.drawImage(SP.star.cv, -h, -h, h * 2, h * 2); x.restore();
    if (Math.sin(b.a * 3) > .7) { const sh = SP.spark.h * S; x.globalCompositeOperation = 'lighter'; x.drawImage(SP.spark.cv, X + 10 * S - sh, Y - 10 * S - sh, sh * 2, sh * 2); x.globalCompositeOperation = 'source-over'; }
  }
}
function drawRail() {
  const S = lay.S, y = WY(G.py + 20), x0 = lay.ox, x1 = lay.ox + FW * S, T = performance.now() / 1000;
  const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(.5, 'rgba(34,211,238,.55)'); g.addColorStop(1, 'rgba(34,211,238,0)');
  x.fillStyle = g; x.fillRect(x0, y, FW * S, 1.5 * S);
  x.fillStyle = '#22d3ee55'; for (let i = 0; i < 20; i++) { const xx = ((i * 20 + T * 60) % FW); x.fillRect(WX(xx), y + 4 * S, 6 * S, 1 * S); }
}
// 주인공: 기본 우주선 / 미니 UFO / 우주 고양이 / 꼬마 우주인 (모두 코드로 그림, 판정 반지름 11 동일)
function drawHero() {
  const S = lay.S, X = WX(G.px), Y = WY(G.py), T = performance.now() / 1000, u = S;
  // 바닥 빛
  x.globalCompositeOperation = 'lighter'; const eh = SP.eng.h * S * 1.4; x.globalAlpha = .35; x.drawImage(SP.eng.cv, X - eh, Y + 20 * S - eh * .5, eh * 2, eh); x.globalAlpha = 1;
  // 엔진 불꽃(우주선·우주인)
  if (CH !== 'ufo') { const fl = 1 + Math.sin(T * 40) * .15 + Math.abs(G.vx) / 1200, fh = SP.engF.h * S; x.globalAlpha = .9; x.drawImage(SP.engF.cv, X - fh * .45, Y + 6 * S, fh * .9, fh * 1.6 * fl); x.drawImage(SP.eng.cv, X - fh * .3, Y + 6 * S, fh * .6, fh * 1.1 * fl); x.globalAlpha = 1; }
  x.globalCompositeOperation = 'source-over';
  x.save(); x.translate(X, Y); x.rotate(G.tilt); x.scale(1.25, 1.25);
  if (CH === 'ufo') {
    const g = x.createLinearGradient(0, -4 * u, 0, 8 * u); g.addColorStop(0, '#e8e4ff'); g.addColorStop(.5, '#9a8cd8'); g.addColorStop(1, '#3b2a7a');
    x.globalCompositeOperation = 'lighter'; x.globalAlpha = .25 + .1 * Math.sin(T * 6); const bg = x.createLinearGradient(0, 4 * u, 0, 34 * u); bg.addColorStop(0, '#7fffd4'); bg.addColorStop(1, 'rgba(127,255,212,0)'); x.fillStyle = bg; x.beginPath(); x.moveTo(-6 * u, 4 * u); x.lineTo(6 * u, 4 * u); x.lineTo(14 * u, 34 * u); x.lineTo(-14 * u, 34 * u); x.fill(); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgba(127,240,255,.85)'; x.beginPath(); x.ellipse(0, -3 * u, 8 * u, 8 * u, 0, Math.PI, 0); x.fill(); x.fillStyle = '#ffffffaa'; x.beginPath(); x.ellipse(-3 * u, -7 * u, 2.5 * u, 1.4 * u, -.5, 0, 7); x.fill();
    x.fillStyle = '#7dff8a'; x.beginPath(); x.arc(0, -4 * u, 3 * u, 0, 7); x.fill(); x.fillStyle = '#0b0620'; x.beginPath(); x.arc(-1.1 * u, -4.5 * u, .8 * u, 0, 7); x.arc(1.1 * u, -4.5 * u, .8 * u, 0, 7); x.fill();
    x.shadowColor = '#b06bff'; x.shadowBlur = 12 * u; x.fillStyle = g; x.beginPath(); x.ellipse(0, 1 * u, 17 * u, 5.5 * u, 0, 0, 7); x.fill(); x.shadowBlur = 0;
    x.fillStyle = '#2a1b5c'; x.beginPath(); x.ellipse(0, 3 * u, 11 * u, 2.4 * u, 0, 0, 7); x.fill();
    for (let i = 0; i < 5; i++) { x.fillStyle = `hsl(${(i * 72 + T * 240) % 360},100%,65%)`; x.beginPath(); x.arc((i - 2) * 6.5 * u, 1.2 * u, 1.5 * u, 0, 7); x.fill(); }
  } else if (CH === 'cat' || CH === 'astro') {
    // 작은 몸통 + 등에 제트팩
    x.fillStyle = '#c9c4e8'; x.fillRect(-5 * u, 4 * u, 10 * u, 8 * u); x.fillStyle = '#7d74b0'; x.fillRect(-7.5 * u, 3 * u, 3 * u, 7 * u); x.fillRect(4.5 * u, 3 * u, 3 * u, 7 * u);
    x.fillStyle = CH === 'astro' ? '#ff8a3d' : '#22d3ee'; x.fillRect(-3 * u, 6 * u, 6 * u, 2 * u);
    if (CH === 'cat') {
      // 유리 헬멧 안 고양이
      x.fillStyle = '#ffb35a'; for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(sd * 3 * u, -9 * u); x.lineTo(sd * 8.5 * u, -14 * u); x.lineTo(sd * 8.8 * u, -5 * u); x.fill(); }
      const fg = x.createRadialGradient(-2 * u, -6 * u, 1 * u, 0, -3 * u, 9 * u); fg.addColorStop(0, '#ffd59a'); fg.addColorStop(1, '#ff9a3d'); x.fillStyle = fg; x.beginPath(); x.arc(0, -3 * u, 8 * u, 0, 7); x.fill();
      x.fillStyle = '#e07a1f'; x.fillRect(-1 * u, -11 * u, 2 * u, 4 * u);
      x.fillStyle = '#0b0620'; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * 3 * u, -4 * u, 1.4 * u, 2 * u, 0, 0, 7); x.fill(); }
      x.fillStyle = '#ff6fa8'; x.beginPath(); x.moveTo(-1 * u, -1 * u); x.lineTo(1 * u, -1 * u); x.lineTo(0, 0); x.fill();
      x.strokeStyle = '#5a3a1a'; x.lineWidth = .7 * u; for (const sd of [-1, 1]) for (const dy of [-.5, 1]) { x.beginPath(); x.moveTo(sd * 4 * u, dy * u); x.lineTo(sd * 10 * u, (dy - .5 + (dy > 0 ? 1.2 : 0)) * u); x.stroke(); }
      x.strokeStyle = '#bff6ffcc'; x.lineWidth = 1.4 * u; x.fillStyle = 'rgba(160,230,255,.14)'; x.beginPath(); x.arc(0, -4 * u, 11 * u, 0, 7); x.fill(); x.stroke();
      x.fillStyle = '#ffffffaa'; x.beginPath(); x.ellipse(-5 * u, -10 * u, 3 * u, 1.4 * u, -.7, 0, 7); x.fill();
    } else {
      const hg = x.createRadialGradient(-3 * u, -8 * u, 1 * u, 0, -4 * u, 10 * u); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#bdb6e0'); x.fillStyle = hg; x.beginPath(); x.arc(0, -4 * u, 9.5 * u, 0, 7); x.fill();
      const vg = x.createLinearGradient(-6 * u, -9 * u, 6 * u, 0); vg.addColorStop(0, '#ffe08a'); vg.addColorStop(.5, '#ff9a3d'); vg.addColorStop(1, '#7a2a8a'); x.fillStyle = vg;
      x.beginPath(); x.ellipse(0, -4 * u, 7 * u, 5 * u, 0, 0, 7); x.fill(); x.fillStyle = '#ffffffcc'; x.beginPath(); x.ellipse(-3 * u, -6.5 * u, 2.2 * u, 1 * u, -.5, 0, 7); x.fill();
      x.fillStyle = '#ff3d9a'; x.beginPath(); x.arc(0, -13.5 * u, 1.6 * u, 0, 7); x.fill(); x.strokeStyle = '#bdb6e0'; x.lineWidth = 1 * u; x.beginPath(); x.moveTo(0, -13 * u); x.lineTo(0, -12 * u); x.stroke();
    }
  } else {
    // 기본: 네온 요격기 '노바'
    x.shadowColor = C.cy; x.shadowBlur = 14 * u;
    const g = x.createLinearGradient(0, -16 * u, 0, 12 * u); g.addColorStop(0, '#e9fdff'); g.addColorStop(.45, '#22d3ee'); g.addColorStop(1, '#0e4f8a'); x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -17 * u); x.lineTo(5 * u, -6 * u); x.lineTo(15 * u, 7 * u); x.lineTo(14 * u, 11 * u); x.lineTo(5 * u, 8 * u); x.lineTo(0, 12 * u); x.lineTo(-5 * u, 8 * u); x.lineTo(-14 * u, 11 * u); x.lineTo(-15 * u, 7 * u); x.lineTo(-5 * u, -6 * u); x.closePath(); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = '#ffffffaa'; x.lineWidth = 1 * u; x.stroke();
    x.fillStyle = '#0b2a4a'; x.beginPath(); x.moveTo(-6 * u, 5 * u); x.lineTo(-13 * u, 9 * u); x.lineTo(-6 * u, 7 * u); x.fill(); x.beginPath(); x.moveTo(6 * u, 5 * u); x.lineTo(13 * u, 9 * u); x.lineTo(6 * u, 7 * u); x.fill();
    const cg = x.createLinearGradient(0, -10 * u, 0, 2 * u); cg.addColorStop(0, '#ffd6f0'); cg.addColorStop(1, '#ff3d9a'); x.fillStyle = cg; x.beginPath(); x.ellipse(0, -4 * u, 2.8 * u, 6 * u, 0, 0, 7); x.fill();
    x.fillStyle = '#ffffffcc'; x.beginPath(); x.ellipse(-.9 * u, -6.5 * u, .9 * u, 2 * u, 0, 0, 7); x.fill();
    const bl = Math.floor(T * 4) % 2; x.fillStyle = bl ? '#ff3d4d' : '#ffd23f'; x.beginPath(); x.arc(-14 * u, 9 * u, 1.5 * u, 0, 7); x.fill(); x.fillStyle = bl ? '#3ddc84' : '#22d3ee'; x.beginPath(); x.arc(14 * u, 9 * u, 1.5 * u, 0, 7); x.fill();
  }
  x.restore();
}
function hud() {
  if (G.nohud) return;
  const W = cv.width, d = lay.dpr, sp = speed() / FH, lvp = (G.t % 10) / 10;
  const top = 10 * d, L = Math.max(10 * d, lay.ox + 10 * d);
  x.textBaseline = 'top'; x.textAlign = 'left';
  x.font = `${16 * d}px ${FONT_N}`; x.fillStyle = C.ye; x.shadowColor = C.ye; x.shadowBlur = 10 * d; x.fillText(Math.floor(G.score).toLocaleString(), L, top); x.shadowBlur = 0;
  x.font = `${9 * d}px ${FONT_N}`; x.fillStyle = '#a99fd6'; x.fillText('BEST ' + Math.max(G.best, Math.floor(G.score)).toLocaleString(), L, top + 24 * d);
  { const h = 8 * d; x.drawImage(SP.star.cv, L - 2 * d, top + 37 * d, h * 2.2, h * 2.2); } x.font = `${11 * d}px ${FONT_N}`; x.fillStyle = '#ffd23f'; x.fillText(String(G.stars), L + 18 * d, top + 41 * d);
  // 속도 단계 막대(가운데)
  const mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60), cx = W / 2;
  x.textAlign = 'center'; x.font = `${14 * d}px ${FONT_N}`; x.fillStyle = '#fff'; x.fillText(mm + ':' + String(ss).padStart(2, '0'), cx, top);
  const bw = 90 * d; x.fillStyle = '#ffffff1f'; x.fillRect(cx - bw / 2, top + 22 * d, bw, 5 * d);
  const col = sp > 1.6 ? C.rd : sp > 1.1 ? C.or : C.cy; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 8 * d; x.fillRect(cx - bw / 2, top + 22 * d, bw * lvp, 5 * d); x.shadowBlur = 0;
  x.font = `${8 * d}px ${FONT_N}`; x.fillStyle = col; x.fillText('SPEED Lv.' + G.lv, cx, top + 32 * d);
}
function draw(dt) {
  const S = lay.S;
  x.save();
  if (G.shake > 0) x.translate((Math.random() - .5) * 14 * G.shake * lay.dpr, (Math.random() - .5) * 14 * G.shake * lay.dpr);
  x.drawImage(BG, 0, 0); drawSky(dt);
  x.save(); x.beginPath(); x.rect(lay.ox, 0, FW * S, cv.height); x.clip();
  drawRail(); drawStars(); drawRocks();
  for (const f of G.fx) if (!f.add) { const a = 1 - f.t / f.life; x.globalAlpha = a; x.fillStyle = f.col; const z = f.s * S; x.fillRect(WX(f.x) - z / 2, WY(f.y) - z / 2, z, z); }
  x.globalAlpha = 1;
  if (G.mode === 'play' || (G.mode === 'dying' && G.dead > 1.15) || G.mode === 'poster') drawHero();
  for (const r of G.rings) { const a = 1 - r.t / .5, rr = (r.big ? 120 : 30) * (r.t / .5) * S; x.globalAlpha = Math.max(0, a); x.strokeStyle = r.col; x.lineWidth = (r.big ? 5 : 3) * S; x.shadowColor = r.col; x.shadowBlur = 14 * S; x.beginPath(); x.arc(WX(r.x), WY(r.y), rr, 0, 7); x.stroke(); x.shadowBlur = 0; }
  x.globalAlpha = 1;
  for (const t of G.texts) if (!t.ui) { x.globalAlpha = Math.max(0, 1 - t.t / .8); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${12 * S}px ${FONT_N}`; x.fillStyle = t.col; x.shadowColor = t.col; x.shadowBlur = 8 * S; x.fillText(t.s, WX(t.x), WY(t.y - t.t * 40)); x.shadowBlur = 0; }
  x.globalAlpha = 1;
  x.restore(); x.restore();
  if (G.flash > 0) { x.fillStyle = `rgba(255,240,220,${G.flash})`; x.fillRect(0, 0, cv.width, cv.height); }
  for (const t of G.texts) if (t.ui) { x.globalAlpha = Math.max(0, Math.min(1, (1.6 - t.t) * 2)); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${18 * lay.dpr}px ${FONT_K}`; x.fillStyle = t.col; x.shadowColor = t.col; x.shadowBlur = 14 * lay.dpr; x.fillText(t.s, cv.width / 2, cv.height * .3 - t.t * 12 * lay.dpr); x.shadowBlur = 0; }
  x.globalAlpha = 1;
  hud();
  const d = lay.dpr;
  if (paused) {
    x.fillStyle = '#060318'; x.globalAlpha = .97; x.fillRect(0, 0, cv.width, cv.height); x.globalAlpha = 1; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = C.ye; x.font = `${20 * d}px ${FONT_N}`; x.fillText('PAUSE', cv.width / 2, cv.height * .42);
    x.fillStyle = '#cfc8ff'; x.font = `${14 * d}px ${FONT_K}`; x.fillText(G.autoP ? '자동 멈춤은 횟수에 들어가지 않아요' : '남은 멈춤 ' + G.pauseLeft + '회 (한 판에 1번)', cv.width / 2, cv.height * .42 + 40 * d);
    x.fillText('화면을 누르거나 아무 키나 누르면 계속', cv.width / 2, cv.height * .42 + 66 * d);
  } else if (G.cnt > 0) { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = C.ye; x.font = `${42 * d}px ${FONT_N}`; x.shadowColor = C.ye; x.shadowBlur = 20 * d; x.fillText(String(Math.ceil(G.cnt)), cv.width / 2, cv.height * .4); x.shadowBlur = 0; }
  else if (G.t < 3.5 && G.mode === 'play') {
    x.globalAlpha = Math.min(1, 3.5 - G.t); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = `${15 * d}px ${FONT_K}`; x.shadowColor = '#000'; x.shadowBlur = 6 * d;
    x.fillText(matchMedia('(pointer:coarse)').matches ? '화면을 누른 채 좌우로 끌어서 피하기' : '← → 키(또는 마우스 끌기)로 피하기', cv.width / 2, cv.height * .62);
    x.fillStyle = C.ye; x.fillText('★ 노란 별은 +50점', cv.width / 2, cv.height * .62 + 26 * d); x.shadowBlur = 0; x.globalAlpha = 1;
  }
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!G || G.mode === 'poster') return;
  const sp = G.fast || 1;
  if (!paused && G.cnt > 0) { G.cnt -= dt; if (G.cnt <= 0) G.cnt = 0; }
  else if (!paused && G.mode === 'play') {
    acc += dt * sp; let n = 0; const maxN = 6 * sp;
    while (acc >= STEP && n < maxN) { update(STEP); acc -= STEP; n++; if (G.mode !== 'play') { acc = 0; break; } }
    if (n >= maxN) acc = 0;
    if (A.ctx) music(G.lv);
  } else if (G.mode === 'dying') {
    // 슬로모션으로 별똥별이 계속 흘러가는 동안 폭발
    G.dead -= dt; for (const r of G.rocks) { r.y += r.v * dt * .15; r.rot += r.vr * dt * .15; } for (const b of G.bon) b.y += b.v * dt * .15; stepFx(dt);
    if (G.dead <= 0) finish();
  } else { acc = 0; if (G.mode === 'over') stepFx(dt); }
  draw(dt);
}
function fs() {
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return;
  try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {}
}
function open() {
  ov.hidden = false; document.documentElement.style.overflow = 'hidden';
  applySkin(); if (!DEBUG) fs(); audioInit(); paused = false; panel.hidden = true; newGame(); sfx('go');
  last = performance.now(); acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function close(why) {
  cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true;
  if (A.ctx) A.ctx.suspend();
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} }
  const r = G && G.result; opts.onExit(r || null, why); G = null; paused = false;
}
function warm() { RES = 2; SP = buildSprites(); try { document.fonts && document.fonts.load('10px "Press Start 2P"'); document.fonts && document.fonts.load('16px "Black Han Sans"', '별똥별'); } catch (e) {} }
window.DodgeGame = {
  boot(o) {
    opts = o; if (!ov) { mkDom(); warm(); }
    const api = { open };
    if (DEBUG) window.__dg = { open, close, G: () => G, pause, layout, bot(b) { G.bot = b; }, fast(n) { G.fast = n; }, god(b) { G.god = b; }, skin(ch, rk) { CH = ch || ''; RK = RKS[rk] ? rk : ''; },
      poster() { hudBtns.hidden = true; G.nohud = 1; G.texts = []; G.rings = []; G.fx = []; G.px = FW * .5; G.tilt = -.12; G.vx = -300; G.rocks = [[50, 250, 14], [140, 400, 9], [330, 300, 16], [370, 470, 8], [250, 520, 11], [80, 520, 7]].map((q, i) => ({ x: q[0], y: q[1] * FH / 560, r: q[2], v: FH * 1.3, rot: i * 1.3, vr: 0, k: i % 3 })); G.bon = [{ x: 300, y: FH * .62, v: 1, a: 0 }]; for (const r of G.rocks) for (let i = 0; i < 10; i++) { ember(r); const f = G.fx[G.fx.length - 1]; f.t = Math.random() * f.life * .8; f.y -= Math.random() * r.r * 3; } G.mode = 'poster'; draw(0); const W = cv.width, H = cv.height, d = lay.dpr; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `${64 * d}px ${FONT_K}`; x.lineWidth = 10 * d; x.strokeStyle = '#1a0630'; x.strokeText('별똥별 피하기', W / 2, H * .2); x.shadowColor = '#ff8a3d'; x.shadowBlur = 30 * d; const tg = x.createLinearGradient(0, H * .12, 0, H * .28); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(.5, '#ffd23f'); tg.addColorStop(1, '#ff8a3d'); x.fillStyle = tg; x.fillText('별똥별 피하기', W / 2, H * .2); x.shadowBlur = 0; x.font = `${14 * d}px ${FONT_N}`; x.fillStyle = '#22d3ee'; x.shadowColor = '#22d3ee'; x.shadowBlur = 12 * d; x.fillText('METEOR DODGE', W / 2, H * .31); x.shadowBlur = 0; },
      step(n) { for (let i = 0; i < n && G && G.mode === 'play'; i++) update(STEP); }, draw: () => draw(0) };
    return api;
  },
};
})();
