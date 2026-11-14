/* 네온 생존자 — 5락실 오리지널 생존 로그라이트 (2026-11-14)
   자동 공격 + 레벨업 때 카드 3장 중 1장 선택, 3분 버티면 클리어(이후 무한 모드).
   그림·소리·음악 모두 코드로 생성. 특정 기존 게임의 이름·캐릭터·그림·음악을 쓰지 않는다. */
(function () {
'use strict';
const DEBUG = /svdebug/.test(location.hash);
const CLEAR_T = 180, STEP = 1 / 60;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const FONT_N = '"Press Start 2P",monospace', FONT_K = '"Black Han Sans",system-ui,sans-serif';
const C = { cy: '#22d3ee', pk: '#ff3d9a', ye: '#ffd23f', gr: '#3ddc84', pu: '#b06bff', or: '#ff8a3d', rd: '#ff4d4d', wh: '#ffffff', bl: '#5ab8ff' };

/* ---------- 무기·강화 카드 ---------- */
// 무기 4칸 + 강화 4칸. 모두 최대 5레벨.
const WEAP = {
  pulse: { name: '펄스 샷', icon: '🔹', col: C.cy, d: ['가장 가까운 적에게 빛 탄환 발사', '피해 +25%', '탄환 +1', '연사 빨라짐', '탄환 +1, 관통 +1'] },
  orbit: { name: '오비트 구슬', icon: '🔮', col: C.pu, d: ['내 주위를 도는 구슬 1개', '구슬 +1', '피해 +30%, 반경 넓게', '구슬 +1', '구슬 +1, 회전 빠르게'] },
  chain: { name: '체인 번개', icon: '⚡', col: C.ye, d: ['적 사이를 튀는 번개(3마리)', '튀는 수 +2', '피해 +30%', '더 자주', '튀는 수 +3, 번개 2줄기'] },
  nova: { name: '네온 파동', icon: '💠', col: C.gr, d: ['퍼지는 고리로 주변 적을 밀어냄', '범위 넓게', '피해 +35%', '더 자주', '고리 2번 연속'] },
  disc: { name: '부메랑 디스크', icon: '🥏', col: C.or, d: ['움직이는 쪽으로 날아갔다 돌아옴', '디스크 +1', '피해 +30%, 크게', '디스크 +1', '더 자주, 더 멀리'] },
  laser: { name: '프리즘 레이저', icon: '🔆', col: C.pk, d: ['적을 꿰뚫는 레이저 기둥', '굵기·길이 +', '피해 +35%', '더 자주', '레이저 3갈래'] },
};
const PASS = {
  speed: { name: '질주 부츠', icon: '👟', d: '이동 속도 +8%' },
  heart: { name: '강화 코어', icon: '❤️', d: '최대 체력 +20, 즉시 20 회복' },
  magnet: { name: '자석 장갑', icon: '🧲', d: '경험치 줍는 범위 +35%' },
  clock: { name: '오버클럭', icon: '⏱️', d: '모든 무기 대기 시간 -8%' },
  power: { name: '증폭 렌즈', icon: '💥', d: '모든 무기 피해 +12%' },
  regen: { name: '재생 회로', icon: '💚', d: '1초마다 체력 0.5 회복' },
  armor: { name: '장갑판', icon: '🛡️', d: '받는 피해 -8%' },
};
const MAXLV = 5, SLOTS = 4;

/* ---------- 적 ---------- */
const ET = {
  drone: { hp: 12, spd: 72, r: 11, dmg: 7, pts: 10, gem: 1, col: C.cy, sh: 'tri' },
  dart: { hp: 8, spd: 150, r: 9, dmg: 6, pts: 15, gem: 1, col: C.pk, sh: 'dart' },
  tank: { hp: 70, spd: 44, r: 19, dmg: 13, pts: 45, gem: 3, col: C.gr, sh: 'hex' },
  shoot: { hp: 24, spd: 58, r: 12, dmg: 7, pts: 30, gem: 2, col: C.or, sh: 'sq' },
  bat: { hp: 16, spd: 105, r: 10, dmg: 7, pts: 18, gem: 1, col: C.pu, sh: 'bat' },
  elite: { hp: 700, spd: 62, r: 28, dmg: 18, pts: 600, gem: 10, col: C.ye, sh: 'star' },
  boss: { hp: 5200, spd: 52, r: 46, dmg: 24, pts: 4000, gem: 20, col: C.rd, sh: 'boss' },
};

/* ---------- 소리(웹오디오 합성) ---------- */
const A = { ctx: null, master: null, muted: false, next: 0, step: 0, last: {} };
try { A.muted = localStorage.getItem('sv_mute') === '1'; } catch (e) {}
let CHIP = false;
function audioInit() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try { A.ctx = new AC(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .45; A.master.connect(A.ctx.destination); A.mus = A.ctx.createGain(); A.mus.gain.value = .32; A.mus.connect(A.master); } catch (e) { A.ctx = null; }
}
function tone(type, f, t, a, dur, f2, dest) {
  if (!A.ctx) return; if (CHIP) { type = type === 'sine' && f < 200 ? 'triangle' : 'square'; a *= .5; }
  const o = A.ctx.createOscillator(), g = A.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * .8);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g); g.connect(dest || A.master); o.start(t); o.stop(t + dur + .02);
}
function sfx(k, gap) { // 같은 소리는 gap 초 안에 한 번만
  if (!A.ctx || A.muted) return; const t = A.ctx.currentTime; if (A.last[k] && t - A.last[k] < (gap || .045)) return; A.last[k] = t;
  if (k === 'shot') tone('triangle', 880, t, .05, .06, 620);
  else if (k === 'hit') tone('square', 220, t, .04, .05, 120);
  else if (k === 'gem') { const n = (A.gemN = ((A.gemN || 0) + 1) % 12); tone('sine', 660 * Math.pow(2, n / 24), t, .07, .08); }
  else if (k === 'zap') tone('sawtooth', 1400, t, .06, .12, 300);
  else if (k === 'nova') tone('sine', 180, t, .18, .35, 60);
  else if (k === 'laser') tone('sawtooth', 300, t, .08, .25, 1200);
  else if (k === 'hurt') tone('square', 160, t, .16, .2, 70);
  else if (k === 'lvl') [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * .07, .13, .18));
  else if (k === 'pick') [784, 1175].forEach((f, i) => tone('sine', f, t + i * .06, .15, .16));
  else if (k === 'boss') [110, 104, 98].forEach((f, i) => tone('sawtooth', f, t + i * .25, .2, .4));
  else if (k === 'clear') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone('triangle', f, t + i * .09, .16, .3));
  else if (k === 'die') tone('sawtooth', 400, t, .2, .9, 40);
  else if (k === 'chest') [659, 880, 1109, 1319].forEach((f, i) => tone('sine', f, t + i * .05, .14, .25));
  else if (k === 'heal') tone('sine', 520, t, .14, .3, 1040);
}
// 배경음: 128BPM 마이너 베이스 + 아르페지오, 시간이 갈수록 박자가 촘촘해짐
const PROG = [[45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 55, 59]];
function music(intense) {
  if (!A.ctx || A.muted) return; const st = 60 / 128 / 4; const now = A.ctx.currentTime;
  if (A.next < now) A.next = now + .05;
  while (A.next < now + .2) {
    const s = A.step % 16, ch = PROG[Math.floor(A.step / 16) % 4], t = A.next, mf = n => 440 * Math.pow(2, (n - 69) / 12);
    if (s % 4 === 0) tone('sine', mf(ch[0] - 12), t, .5, .3, null, A.mus);
    if (s % 4 === 2 && intense > 0) tone('triangle', mf(ch[0]), t, .2, .15, null, A.mus);
    if (s % 2 === 0 || intense > 1) tone(intense > 1 ? 'square' : 'triangle', mf(ch[1 + (s >> 1) % 3] + 12), t, intense > 1 ? .07 : .09, .12, null, A.mus);
    if (s === 0 || s === 8) tone('sine', 120, t, .5, .12, 45, A.mus);
    A.next += st; A.step++;
  }
}

/* ---------- 스프라이트 ---------- */
let SP = null, RES = 2;
function mkc(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function shape(c, sh, r) {
  c.beginPath();
  if (sh === 'tri') { for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2.094; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (sh === 'dart') { c.moveTo(r, 0); c.lineTo(-r * .8, r * .7); c.lineTo(-r * .4, 0); c.lineTo(-r * .8, -r * .7); }
  else if (sh === 'hex') { for (let i = 0; i < 6; i++) { const a = i * 1.047; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (sh === 'sq') { c.rect(-r * .8, -r * .8, r * 1.6, r * 1.6); }
  else if (sh === 'bat') { c.moveTo(0, -r * .5); c.lineTo(r, -r * .7); c.lineTo(r * .7, r * .2); c.lineTo(r * .3, 0); c.lineTo(0, r * .6); c.lineTo(-r * .3, 0); c.lineTo(-r * .7, r * .2); c.lineTo(-r, -r * .7); }
  else if (sh === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * .628, rr = i % 2 ? r * .5 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
  else if (sh === 'boss') { for (let i = 0; i < 16; i++) { const a = i * .3927, rr = i % 2 ? r * .78 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } }
  c.closePath();
}
function enemySprite(t, flash) {
  const e = ET[t], pad = 14, sz = (e.r * 2 + pad * 2) * RES, cv = mkc(sz, sz), c = cv.getContext('2d');
  c.translate(sz / 2, sz / 2); c.scale(RES, RES);
  c.shadowColor = e.col; c.shadowBlur = 12; c.lineWidth = 2.5; c.strokeStyle = flash ? '#fff' : e.col; c.fillStyle = flash ? '#ffffff' : '#0b0620';
  shape(c, e.sh, e.r); c.fill(); c.stroke(); c.shadowBlur = 0;
  c.fillStyle = flash ? '#fff' : e.col; c.globalAlpha = .9;
  if (t === 'boss') { shape(c, 'hex', e.r * .45); c.fill(); c.fillStyle = '#0b0620'; c.beginPath(); c.arc(0, 0, e.r * .2, 0, 7); c.fill(); }
  else if (t === 'elite') { c.beginPath(); c.arc(0, 0, e.r * .28, 0, 7); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, e.r * .26, 0, 7); c.fill(); }
  return { cv, h: sz / 2 / RES };
}
function glow(col, r, core) {
  const sz = r * 2 * RES, cv = mkc(sz, sz), c = cv.getContext('2d'), g = c.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
  g.addColorStop(0, '#fff'); g.addColorStop(core || .25, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, sz, sz);
  return { cv, h: r };
}
function gemSprite(col) {
  const r = 7, sz = (r * 2 + 8) * RES, cv = mkc(sz, sz), c = cv.getContext('2d'); c.translate(sz / 2, sz / 2); c.scale(RES, RES);
  c.shadowColor = col; c.shadowBlur = 8; c.fillStyle = col; c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .7, 0); c.lineTo(0, r); c.lineTo(-r * .7, 0); c.closePath(); c.fill();
  c.shadowBlur = 0; c.fillStyle = '#ffffffcc'; c.beginPath(); c.moveTo(0, -r * .6); c.lineTo(r * .3, 0); c.lineTo(0, -r * .1); c.closePath(); c.fill();
  return { cv, h: sz / 2 / RES };
}
function buildSprites() {
  const s = { en: {}, enF: {} };
  for (const t in ET) { s.en[t] = enemySprite(t, false); s.enF[t] = enemySprite(t, true); }
  s.gem = [gemSprite(C.bl), gemSprite(C.gr), gemSprite(C.rd)];
  s.bul = glow(C.cy, 9, .3); s.eb = glow(C.or, 9, .35); s.orb = glow(C.pu, 15, .35); s.spark = glow(C.ye, 8, .2);
  s.disc = (() => { const r = 13, sz = (r * 2 + 10) * RES, cv = mkc(sz, sz), c = cv.getContext('2d'); c.translate(sz / 2, sz / 2); c.scale(RES, RES); c.shadowColor = C.or; c.shadowBlur = 10; c.strokeStyle = C.or; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); c.fillStyle = '#ffd9a0'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(Math.cos(i * 2.094) * r * .5, Math.sin(i * 2.094) * r * .5, 3, 0, 7); c.fill(); } return { cv, h: sz / 2 / RES }; })();
  return s;
}

/* ---------- 배경 테마(꾸미기) ---------- */
const THEME = {
  base: { bg: '#07031a', g1: '#22d3ee', g2: '#ff3d9a', p: null },
  desert: { bg: '#170904', g1: '#ff8a3d', g2: '#ffd23f', p: 'sand' },
  deep: { bg: '#010b1a', g1: '#16e0c8', g2: '#3a7bff', p: 'bubble' },
  sakura: { bg: '#14041a', g1: '#ff8ac4', g2: '#c08bff', p: 'petal' },
};
let TH = THEME.base, THK = 'base', parts = [];

/* ---------- 화면·DOM ---------- */
let ov, cv, x, hudBtns, panel, opts, G = null, raf = 0, paused = false, last = 0, acc = 0;
let lay = { s: 1, dpr: 1, cw: 0, ch: 0, vw: 0, vh: 0 };
let SKC = ['#e9fdff', '#22d3ee', '#0e7490'], DES = 'base', TRL = '';
function css() {
  const st = document.createElement('style');
  st.textContent = '.sv-ov{position:fixed;inset:0;z-index:9999;background:#07031a;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden}.sv-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sv-btns{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));display:flex;gap:6px;z-index:2}.sv-btns button{width:38px;height:38px;border-radius:10px;border:1px solid #ffffff44;background:#0c0620cc;color:#fff;font-size:16px;cursor:pointer}'
    + '.sv-pn{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:3;background:#03010acc;overflow:auto;padding:12px}.sv-pn>div{width:min(340px,92vw);margin:auto;text-align:center;color:#fff;background:#0c0620;border:2px solid #22d3ee;border-radius:16px;padding:16px 14px;box-shadow:0 0 30px #22d3ee55}'
    + '.sv-pn h3{font-family:' + FONT_K + ';font-weight:400;font-size:22px;color:#ffd23f;margin:2px 0 10px;text-shadow:0 0 12px #ffd23f}.sv-pn .sc{font-family:' + FONT_N + ';font-size:20px;color:#22d3ee;margin:6px 0;text-shadow:0 0 10px #22d3ee}.sv-pn p{margin:6px 0;font-size:14px;color:#cfc8ff;line-height:1.5}'
    + '.sv-pn button{display:block;width:100%;margin:8px 0 0;padding:12px;border-radius:12px;border:0;font:inherit;font-size:16px;font-weight:800;cursor:pointer}.sv-pn .p1{background:#ffd23f;color:#1a0f00;box-shadow:0 4px 0 #b8860b}.sv-pn .p2{background:#ff3d9a;color:#fff}.sv-pn .p3{background:#ffffff1a;color:#fff}.sv-pn .p4{background:#3ddc84;color:#04220f;box-shadow:0 4px 0 #15803d}.sv-pn .p5{font-size:12px;color:#a99fd6}'
    + '.sv-cards{display:grid;gap:8px;margin:8px 0}.sv-pn .sv-card{display:grid;grid-template-columns:44px 1fr;gap:2px 10px;align-items:center;text-align:left;margin:0;padding:10px 12px;background:#150c33;color:#fff;border:2px solid var(--c);box-shadow:0 0 14px color-mix(in srgb,var(--c) 40%,transparent);font-weight:400}'
    + '.sv-card .ic{grid-row:span 2;font-size:30px;text-align:center}.sv-card b{font-size:15px}.sv-card b i{font-style:normal;font-size:11px;color:#1a0f00;background:var(--c);border-radius:6px;padding:1px 6px;margin-left:4px;vertical-align:2px}.sv-card small{color:#cfc8ff;font-size:12.5px;line-height:1.35}'
    + '.sv-pn .k{display:none}@media (pointer:fine){.sv-pn .k{display:inline;color:#7d74b0;font-size:11px;margin-left:4px}}.sv-pn .rr{background:#ffffff14;color:#cfc8ff;font-size:13px;padding:8px}'
    + '.sv-own{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;margin:4px 0 0;font-size:12px;color:#a99fd6}.sv-own span{background:#ffffff10;border-radius:8px;padding:2px 6px}';
  document.head.appendChild(st);
}
function mkDom() {
  css();
  ov = document.createElement('div'); ov.className = 'sv-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  hudBtns = document.createElement('div'); hudBtns.className = 'sv-btns';
  hudBtns.innerHTML = '<button type="button" data-k="m" aria-label="소리"></button><button type="button" data-k="p" aria-label="일시정지">Ⅱ</button><button type="button" data-k="x" aria-label="나가기">✕</button>';
  ov.appendChild(hudBtns);
  panel = document.createElement('div'); panel.className = 'sv-pn'; panel.hidden = true; ov.appendChild(panel);
  document.body.appendChild(ov);
  const mb = hudBtns.querySelector('[data-k=m]'); mb.textContent = A.muted ? '🔇' : '🔊';
  hudBtns.addEventListener('pointerdown', e => e.stopPropagation());
  hudBtns.onclick = e => {
    const k = e.target.dataset.k;
    if (k === 'm') { A.muted = !A.muted; mb.textContent = A.muted ? '🔇' : '🔊'; try { localStorage.setItem('sv_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .45; }
    if (k === 'p') pause(!paused);
    if (k === 'x') close();
  };
  panel.addEventListener('pointerdown', e => e.stopPropagation());
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && G.mode === 'play' && !paused) pause(true, true); });
  addEventListener('blur', () => { if (!ov.hidden && G && G.mode === 'play' && !paused && !DEBUG) pause(true, true); });
  input();
}
// 보이는 넓이를 기기와 상관없이 거의 같게(세로폰·가로 PC 모두 약 700×700 넓이)
function layout() {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.6e6) dpr = Math.sqrt(3.6e6 / (cw * ch));
  let s = Math.sqrt(cw * ch / (700 * 700)); s = Math.min(s, Math.min(cw, ch) / 430);
  lay = { s, dpr, cw, ch, vw: cw / s, vh: ch / s };
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const r = clamp(Math.ceil(s * dpr), 1, 3); if (r !== RES || !SP) { RES = r; SP = buildSprites(); }
}

/* ---------- 입력: PC 방향키·WASD(또는 마우스 누른 채 끌기), 모바일 아무 곳이나 대고 끄는 조이스틱 ---------- */
const keys = {}; let stick = null;
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; const k = e.key;
    if (/^Arrow|^[wasdWASD ]$/.test(k)) e.preventDefault();
    if (G && G.mode === 'lvl' && /^[123]$/.test(k)) { const b = panel.querySelectorAll('.sv-card')[+k - 1]; if (b) b.click(); return; }
    if (G && G.mode === 'lvl' && (k === 'r' || k === 'R')) { const b = panel.querySelector('.rr'); if (b) b.click(); return; }
    if (k === 'Escape' || k === 'p' || k === 'P') { if (G && G.mode === 'play') pause(!paused); return; }
    if (paused && G && G.mode === 'play') { pause(false); return; }
    keys[k.length === 1 ? k.toLowerCase() : k] = 1;
  });
  addEventListener('keyup', e => { const k = e.key; keys[k.length === 1 ? k.toLowerCase() : k] = 0; });
  ov.addEventListener('pointerdown', e => {
    if (paused) { pause(false); return; }
    audioInit(); if (stick && !stick.mouse && e.pointerType !== 'mouse') return;
    stick = { id: e.pointerId, mouse: e.pointerType === 'mouse', sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY };
    try { ov.setPointerCapture(e.pointerId); } catch (er) {}
  });
  ov.addEventListener('pointermove', e => { if (stick && stick.id === e.pointerId) { stick.x = e.clientX; stick.y = e.clientY; } });
  const up = e => { if (stick && stick.id === e.pointerId) stick = null; };
  ov.addEventListener('pointerup', up); ov.addEventListener('pointercancel', up);
  ov.addEventListener('contextmenu', e => e.preventDefault());
}
function moveDir() {
  let dx = 0, dy = 0;
  if (keys.ArrowLeft || keys.a) dx -= 1; if (keys.ArrowRight || keys.d) dx += 1; if (keys.ArrowUp || keys.w) dy -= 1; if (keys.ArrowDown || keys.s) dy += 1;
  if (stick) { const sx = stick.x - stick.sx, sy = stick.y - stick.sy, l = Math.hypot(sx, sy), dz = 6, full = 46; if (l > dz) { const m = Math.min(1, (l - dz) / (full - dz)); dx = sx / l * m; dy = sy / l * m; } }
  if (G && G.bot) { const b = botDir(); dx = b[0]; dy = b[1]; }
  const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
  return [dx, dy];
}

/* ---------- 게임 상태 ---------- */
function stat(k) { return G.p[k] || 0; }
function cdMul() { return 1 - .08 * stat('clock'); }
function dmgMul() { return 1 + .12 * stat('power'); }
function newGame() {
  const rngS = opts.rng('spawn'), rngD = opts.rng('drop');
  G = {
    mode: 'play', t: 0, px: 0, py: 0, hx: 0, hy: 1, hp: 100, maxHp: 100, inv: 0, lv: 1, xp: 0, need: 5, kills: 0, score: 0, pts: 0,
    en: [], bul: [], eb: [], gems: [], items: [], fx: [], texts: [], bolts: [], rings: [], beams: [], trail: [],
    w: { pulse: 1 }, p: {}, cd: { pulse: .3 }, orbA: 0, rngS, rngD, spawnAcc: 0, ev: {}, pauseLeft: 1, cnt: 0, autoP: false,
    cont: 0, endless: false, clearT: 0, reroll: 1, pend: 0, chest: 0, boss: null, bossN: 0, debug: DEBUG, shake: 0, flash: 0, dead: 0, regenAcc: 0, best: 0, hurtT: 0, gemN: 0,
  };
  try { G.best = +localStorage.getItem('sv_best_' + opts.day) || 0; } catch (e) {}
  for (const k in keys) keys[k] = 0; stick = null; parts = [];
}
function need(lv) { return Math.round(3 + lv * 2.2 + Math.max(0, lv - 12) * 3.5 + Math.max(0, lv - 30) * 10); }

/* 적 등장: 시간표(0~3분) + 무한 모드. 매일 같은 시드라 모두 같은 순서로 나온다 */
function diff() { return G.t; }
function hpMul() { const t = G.t; return 1 + t / 110 + Math.max(0, t - 120) / 140 + Math.max(0, t - CLEAR_T) / 40 + Math.pow(Math.max(0, t - CLEAR_T) / 60, 2) * .6; }
// 적이 주는 피해: 시간이 갈수록 조금씩, 무한 모드에선 빠르게
function dmgIn() { const t = G.t; return 1 + t / 200 + Math.max(0, t - CLEAR_T) / 70; }
function spawnRate() { const t = G.t; return Math.min(12, 1.1 + t * .03 + Math.max(0, t - 100) * .02) + Math.max(0, t - CLEAR_T) * .04; }
function pickType(r) {
  const t = G.t, w = { drone: 10 };
  if (t > 20) w.bat = 3 + Math.min(4, t / 40);
  if (t > 40) w.dart = 4;
  if (t > 65) w.tank = 2 + Math.min(3, (t - 65) / 40);
  if (t > 95) w.shoot = 2.5 + Math.max(0, t - CLEAR_T) / 30;
  let sum = 0; for (const k in w) sum += w[k]; let v = r * sum;
  for (const k in w) { v -= w[k]; if (v <= 0) return k; } return 'drone';
}
function spawnAt(type, x, y, extra) {
  const e = ET[type], m = hpMul() * (type === 'boss' ? 1 + G.bossN * .6 : 1);
  const o = { type, x, y, hp: e.hp * m, max: e.hp * m, r: e.r, spd: e.spd * (1 + Math.min(.3, G.t / 600) + Math.min(.9, Math.max(0, G.t - CLEAR_T) / 300)), vx: 0, vy: 0, hitT: 0, kb: 0, kx: 0, ky: 0, cd: 1 + G.rngS() * 2, ph: G.rngS() * 6.28, oh: {} };
  if (extra) Object.assign(o, extra);
  G.en.push(o); return o;
}
function ringPos(a, extra) { const R = Math.hypot(lay.vw, lay.vh) / 2 + 40 + (extra || 0); return [G.px + Math.cos(a) * R, G.py + Math.sin(a) * R]; }
function spawner(dt) {
  const t = G.t, r = G.rngS;
  // 시간표 이벤트
  const ev = (k, at, f) => { if (!G.ev[k] && t >= at) { G.ev[k] = 1; f(); } };
  ev('ring1', 45, () => circle('drone', 22)); ev('elite1', 60, () => elite()); ev('ring2', 90, () => circle('bat', 26));
  ev('elite2', 120, () => { elite(); elite(); }); ev('swarm', 135, () => circle('dart', 30));
  ev('boss1', 150, () => boss()); ev('ring3', 165, () => circle('tank', 14));
  if (t > CLEAR_T) { // 무한 모드: 40초마다 고리, 60초마다 보스
    const k = Math.floor((t - CLEAR_T) / 40); ev('er' + k, CLEAR_T + k * 40 + 20, () => circle(k % 2 ? 'tank' : 'bat', 26 + k * 2));
    const b = Math.floor((t - CLEAR_T) / 60); ev('eb' + b, CLEAR_T + b * 60 + 45, () => boss());
  }
  // 상시 등장
  if (G.en.length < (G.t > CLEAR_T ? 340 : 280)) {
    G.spawnAcc += spawnRate() * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1; const type = pickType(r()), a = r() * 6.283;
      if (type === 'dart' || (type === 'bat' && r() < .5)) { // 무리 지어 오는 적
        const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const p = ringPos(a + (i - n / 2) * .06, i * 6); spawnAt(type, p[0], p[1]); }
      } else { const p = ringPos(a); spawnAt(type, p[0], p[1]); }
    }
  } else { G.spawnAcc = 0; r(); }
}
function circle(type, n) { const a0 = G.rngS() * 6.28; for (let i = 0; i < n; i++) { const p = ringPos(a0 + i / n * 6.283, -20); spawnAt(type, p[0], p[1], { ring: 1 }); } text(0, -80, '포위 경보!', C.or, 1); }
function elite() { const p = ringPos(G.rngS() * 6.283); spawnAt('elite', p[0], p[1]); text(0, -80, '⭐ 엘리트 등장', C.ye, 1); }
function boss() { const p = ringPos(G.rngS() * 6.283); G.boss = spawnAt('boss', p[0], p[1]); G.bossN++; text(0, -90, '오버로드 ' + (G.bossN > 1 ? 'Mk.' + G.bossN : '') + ' 출현!', C.rd, 1); sfx('boss'); G.shake = .5; }
function text(dx, dy, s, col, big) { G.texts.push({ x: G.px + dx, y: G.py + dy, s, col, big: !!big, t: 0, ui: !!big }); }

/* ---------- 공간 격자(충돌 빠르게) ---------- */
const CELL = 64; let grid = new Map();
function gkey(cx, cy) { return (cx + 4096) * 8192 + (cy + 4096); }
function buildGrid() {
  grid = new Map();
  for (const e of G.en) { if (e.dead) continue; const k = gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e); }
}
function near(x0, y0, r, f) {
  const c0 = Math.floor((x0 - r) / CELL), c1 = Math.floor((x0 + r) / CELL), r0 = Math.floor((y0 - r) / CELL), r1 = Math.floor((y0 + r) / CELL);
  for (let cx = c0; cx <= c1; cx++) for (let cy = r0; cy <= r1; cy++) { const a = grid.get(gkey(cx, cy)); if (a) for (const e of a) if (!e.dead && f(e) === false) return; }
}
function nearest(x0, y0, maxR, skip) {
  let best = null, bd = maxR * maxR;
  for (const e of G.en) { if (e.dead || (skip && skip.has(e))) continue; const d = (e.x - x0) ** 2 + (e.y - y0) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
}

/* ---------- 피해 ---------- */
function hurtEnemy(e, d, kx, ky, kb) {
  if (e.dead) return; e.hp -= d; e.hitT = .08;
  if (kb && e.type !== 'boss') { const l = Math.hypot(kx, ky) || 1; e.kx = kx / l * kb; e.ky = ky / l * kb; e.kb = .12 * (e.type === 'elite' ? .3 : 1); }
  if (e.hp <= 0) kill(e); else sfx('hit', .06);
}
function kill(e) {
  e.dead = true; G.kills++; const T = ET[e.type], mul = G.endless ? 1.5 : 1;
  G.pts += Math.round(T.pts * mul);
  const gv = T.gem; dropGem(e.x, e.y, gv);
  if (e.type === 'elite' || e.type === 'boss') { G.items.push({ k: 'chest', x: e.x, y: e.y, t: 0 }); G.shake = .3; for (let i = 0; i < 18; i++) burst(e.x, e.y, T.col, 1); }
  if (e.type === 'boss') { if (G.boss === e) G.boss = null; G.pts += Math.round(3000 * mul); text(0, -90, '오버로드 격파! +' + Math.round(3000 * mul).toLocaleString(), C.ye, 1); sfx('clear'); }
  else { const r = G.rngD(); if (r < .012) G.items.push({ k: 'heal', x: e.x, y: e.y, t: 0 }); else if (r < .016) G.items.push({ k: 'mag', x: e.x, y: e.y, t: 0 }); else if (r < .019) G.items.push({ k: 'bomb', x: e.x, y: e.y, t: 0 }); }
  burst(e.x, e.y, T.col, 0);
}
function dropGem(x0, y0, v) {
  if (G.gems.length > 360) { // 너무 많으면 가장 먼 보석에 합침
    let far = G.gems[0], fd = 0; for (const g of G.gems) { const d = (g.x - G.px) ** 2 + (g.y - G.py) ** 2; if (d > fd) { fd = d; far = g; } } far.v += v; far.k = far.v >= 10 ? 2 : far.v >= 3 ? 1 : 0; return;
  }
  G.gems.push({ x: x0, y: y0, v, k: v >= 10 ? 2 : v >= 3 ? 1 : 0, pull: 0 });
}
function burst(x0, y0, col, big) { const n = big ? 3 : 4; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 60 + Math.random() * (big ? 260 : 120); G.fx.push({ x: x0, y: y0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: .35 + Math.random() * .25, col }); } if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500); }
function hurtPlayer(d) {
  if (G.inv > 0 || G.god || G.mode !== 'play') return;
  d *= 1 - .08 * stat('armor'); G.hp -= d; G.inv = .55; G.hurtT = .25; G.shake = Math.max(G.shake, .18); sfx('hurt', .1);
  if (G.hp <= 0) { G.hp = 0; die(); }
}

/* ---------- 무기 ---------- */
function fireWeapons(dt) {
  const w = G.w, cm = cdMul(), dm = dmgMul();
  for (const k in w) { G.cd[k] = (G.cd[k] || 0) - dt; }
  // 펄스 샷
  if (w.pulse && G.cd.pulse <= 0) {
    const L = w.pulse, n = 1 + (L >= 3) + (L >= 5), t = nearest(G.px, G.py, 520);
    if (t) {
      const a0 = Math.atan2(t.y - G.py, t.x - G.px), d = 13 * (L >= 2 ? 1.25 : 1) * dm;
      for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * .16; G.bul.push({ k: 'pulse', x: G.px, y: G.py, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, d, life: 1.1, pierce: L >= 5 ? 1 : 0, r: 6, hit: null }); }
      sfx('shot', .08);
    }
    G.cd.pulse = (L >= 4 ? .36 : .5) * cm;
  }
  // 체인 번개
  if (w.chain && G.cd.chain <= 0) {
    const L = w.chain, hops = 3 + (L >= 2) * 2 + (L >= 5) * 3, d = 18 * (L >= 3 ? 1.3 : 1) * dm, ways = L >= 5 ? 2 : 1;
    let any = false;
    for (let wv = 0; wv < ways; wv++) {
      const seen = new Set(); let cx = G.px, cy = G.py, pts = [[cx, cy]];
      let t = nearest(cx, cy, 380); if (wv && t) { seen.add(t); t = nearest(cx, cy, 380, seen); seen.clear(); }
      for (let i = 0; i < hops && t; i++) { seen.add(t); pts.push([t.x, t.y]); hurtEnemy(t, d); cx = t.x; cy = t.y; t = nearest(cx, cy, 170, seen); }
      if (pts.length > 1) { G.bolts.push({ pts, t: 0 }); any = true; }
    }
    if (any) sfx('zap', .1);
    G.cd.chain = (L >= 4 ? 1.55 : 2.1) * cm;
  }
  // 네온 파동
  if (w.nova && G.cd.nova <= 0) {
    const L = w.nova, R = 120 * (L >= 2 ? 1.3 : 1), d = 18 * (L >= 3 ? 1.35 : 1) * dm;
    G.rings.push({ x: G.px, y: G.py, R, d, t: 0, hit: new Set() }); if (L >= 5) G.rings.push({ x: G.px, y: G.py, R: R * 1.25, d, t: -.25, hit: new Set() });
    sfx('nova', .3); G.cd.nova = (L >= 4 ? 2.1 : 2.9) * cm;
  }
  // 부메랑 디스크
  if (w.disc && G.cd.disc <= 0) {
    const L = w.disc, n = 1 + (L >= 2) + (L >= 4), d = 13 * (L >= 3 ? 1.3 : 1) * dm, a0 = Math.atan2(G.hy, G.hx), rng = L >= 5 ? 300 : 230;
    for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * .5; G.bul.push({ k: 'disc', x: G.px, y: G.py, a, sp: 420, t: 0, out: rng / 420, d, r: L >= 3 ? 16 : 13, hitT: new Map(), life: 3 }); }
    G.cd.disc = (L >= 5 ? 1.25 : 1.75) * cm;
  }
  // 프리즘 레이저
  if (w.laser && G.cd.laser <= 0) {
    const L = w.laser, t = nearest(G.px, G.py, 600) ; const a0 = t ? Math.atan2(t.y - G.py, t.x - G.px) : Math.atan2(G.hy, G.hx);
    const len = L >= 2 ? 520 : 400, wd = L >= 2 ? 16 : 11, d = 24 * (L >= 3 ? 1.35 : 1) * dm, n = L >= 5 ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i - (n - 1) / 2) * .45, ux = Math.cos(a), uy = Math.sin(a);
      G.beams.push({ x: G.px, y: G.py, ux, uy, len, wd, t: 0 });
      near(G.px + ux * len / 2, G.py + uy * len / 2, len / 2 + 30, e => { const rx = e.x - G.px, ry = e.y - G.py, along = rx * ux + ry * uy; if (along < 0 || along > len) return; const perp = Math.abs(rx * uy - ry * ux); if (perp < wd / 2 + e.r) hurtEnemy(e, d, ux, uy, 80); });
    }
    sfx('laser', .2); G.cd.laser = (L >= 4 ? 1.7 : 2.4) * cm;
  }
}
function orbitStep(dt) {
  const L = G.w.orbit; if (!L) return;
  const n = 1 + (L >= 2) + (L >= 4) + (L >= 5), R = L >= 3 ? 82 : 66, d = 12 * (L >= 3 ? 1.3 : 1) * dmgMul(), sp = L >= 5 ? 4.2 : 3.2;
  G.orbA += sp * dt; G.orbs = [];
  for (let i = 0; i < n; i++) {
    const a = G.orbA + i / n * 6.283, ox = G.px + Math.cos(a) * R, oy = G.py + Math.sin(a) * R; G.orbs.push([ox, oy]);
    near(ox, oy, 30, e => { if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (e.r + 12) ** 2) { const k = 'o' + i, t = e.oh[k] || 0; if (G.t - t > .45) { e.oh[k] = G.t; hurtEnemy(e, d, e.x - G.px, e.y - G.py, 120); } } });
  }
}
function bulletsStep(dt) {
  for (const b of G.bul) {
    if (b.dead) continue; b.life -= dt; if (b.life <= 0) { b.dead = true; continue; }
    if (b.k === 'pulse') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      near(b.x, b.y, 30, e => { if (b.dead) return false; if (b.hit && b.hit.has(e)) return; if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) { hurtEnemy(e, b.d, b.vx, b.vy, 60); if (b.pierce > 0) { b.pierce--; (b.hit = b.hit || new Set()).add(e); } else { b.dead = true; return false; } } });
    } else if (b.k === 'disc') {
      b.t += dt; let vx, vy;
      if (b.t < b.out) { vx = Math.cos(b.a) * b.sp; vy = Math.sin(b.a) * b.sp; } else { const dx = G.px - b.x, dy = G.py - b.y, l = Math.hypot(dx, dy) || 1; if (l < 20) { b.dead = true; continue; } vx = dx / l * b.sp * 1.15; vy = dy / l * b.sp * 1.15; }
      b.x += vx * dt; b.y += vy * dt; b.rot = (b.rot || 0) + dt * 14;
      near(b.x, b.y, 40, e => { if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < (e.r + b.r) ** 2) { const t = b.hitT.get(e) || -9; if (G.t - t > .35) { b.hitT.set(e, G.t); hurtEnemy(e, b.d, vx, vy, 90); } } });
    }
  }
  G.bul = G.bul.filter(b => !b.dead);
  for (const r of G.rings) {
    r.t += dt; if (r.t < 0) continue; const rr = r.R * Math.min(1, r.t / .35);
    near(r.x, r.y, rr + 20, e => { if (r.hit.has(e)) return; const d = Math.hypot(e.x - r.x, e.y - r.y); if (d < rr + e.r) { r.hit.add(e); hurtEnemy(e, r.d, e.x - r.x, e.y - r.y, 220); } });
  }
  G.rings = G.rings.filter(r => r.t < .5);
  for (const b of G.bolts) b.t += dt; G.bolts = G.bolts.filter(b => b.t < .18);
  for (const b of G.beams) b.t += dt; G.beams = G.beams.filter(b => b.t < .22);
}

/* ---------- 업데이트 ---------- */
function update(dt) {
  if (G.mode !== 'play') return;
  G.t += dt; G.inv = Math.max(0, G.inv - dt); G.hurtT = Math.max(0, G.hurtT - dt); G.shake = Math.max(0, G.shake - dt); G.flash = Math.max(0, G.flash - dt);
  // 이동
  const [mx, my] = moveDir(), spd = 165 * (1 + .08 * stat('speed'));
  G.px += mx * spd * dt; G.py += my * spd * dt; if (mx || my) { const l = Math.hypot(mx, my); G.hx = mx / l; G.hy = my / l; }
  if (TRL || DES === 'phoenix') { G.trailT = (G.trailT || 0) + dt; if (G.trailT > .05) { G.trailT = 0; G.trail.push([G.px, G.py]); if (G.trail.length > 12) G.trail.shift(); } }
  // 재생
  if (stat('regen')) { G.hp = Math.min(G.maxHp, G.hp + .5 * stat('regen') * dt); }
  spawner(dt); buildGrid();
  // 적 이동·공격
  for (const e of G.en) {
    if (e.dead) continue; e.hitT = Math.max(0, e.hitT - dt);
    const dx = G.px - e.x, dy = G.py - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > 1400) { const p = ringPos(Math.atan2(-dy, -dx) + Math.PI + (G.rngD() - .5)); e.x = p[0]; e.y = p[1]; continue; } // 너무 멀어진 적은 앞쪽으로 다시
    let vx = dx / d * e.spd, vy = dy / d * e.spd;
    if (e.type === 'dart') { if (!e.dash) { e.dash = 1; e.dx = dx / d; e.dy = dy / d; } vx = e.dx * e.spd; vy = e.dy * e.spd; if (d > 900) e.dash = 0; }
    else if (e.type === 'bat') { e.ph += dt * 5; vx += -dy / d * Math.sin(e.ph) * 60; vy += dx / d * Math.sin(e.ph) * 60; }
    else if (e.type === 'shoot') {
      if (d < 230) { vx = -vx * .6; vy = -vy * .6; } else if (d < 300) { vx = -dy / d * e.spd * .7; vy = dx / d * e.spd * .7; }
      e.cd -= dt; if (e.cd <= 0 && d < 520) { e.cd = 2.6; G.eb.push({ x: e.x, y: e.y, vx: dx / d * 150, vy: dy / d * 150, life: 4, d: 8 }); }
    } else if (e.type === 'boss') {
      e.cd -= dt; if (e.cd <= 0) {
        e.cd = Math.max(1.4, 2.8 - G.bossN * .25); e.pat = ((e.pat || 0) + 1) % 3;
        if (e.pat === 0) { const n = 16 + G.bossN * 4, a0 = G.t; for (let i = 0; i < n; i++) { const a = a0 + i / n * 6.283; G.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 6, d: 10 }); } }
        else if (e.pat === 1) { for (let i = -2; i <= 2; i++) { const a = Math.atan2(dy, dx) + i * .14; G.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 5, d: 10 }); } }
        else if (G.en.length < 380) { for (let i = 0; i < 6 + G.bossN * 2; i++) { const a = G.rngD() * 6.283; spawnAt('drone', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60); } }
      }
    }
    if (e.kb > 0) { e.kb -= dt; vx = e.kx; vy = e.ky; }
    // 서로 밀어내기(같은 칸 안에서만, 가볍게)
    const a = grid.get(gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL)));
    if (a && a.length > 1) { let c = 0; for (const o of a) { if (o === e || o.dead) continue; const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, rr = (e.r + o.r) * .9; if (dd < rr * rr && dd > .01) { const l = Math.sqrt(dd), push = (rr - l) / l * 40; vx += ox * push; vy += oy * push; } if (++c > 8) break; } }
    e.x += vx * dt; e.y += vy * dt;
    if (d < e.r + 11) hurtPlayer(ET[e.type].dmg * dmgIn());
  }
  fireWeapons(dt); orbitStep(dt); bulletsStep(dt);
  G.en = G.en.filter(e => !e.dead);
  // 적 총알
  for (const b of G.eb) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; if ((b.x - G.px) ** 2 + (b.y - G.py) ** 2 < 15 * 15) { b.life = 0; hurtPlayer(b.d * dmgIn()); } }
  G.eb = G.eb.filter(b => b.life > 0);
  // 보석·아이템 줍기
  const mag = 85 * (1 + .35 * stat('magnet'));
  for (const g of G.gems) {
    const dx = G.px - g.x, dy = G.py - g.y, d = Math.hypot(dx, dy);
    if (g.pull || d < mag) { g.pull = Math.min(900, (g.pull || 200) + 1400 * dt); g.x += dx / (d || 1) * g.pull * dt; g.y += dy / (d || 1) * g.pull * dt; }
    if (d < 16) { g.got = 1; G.xp += g.v; sfx('gem', .03); }
  }
  G.gems = G.gems.filter(g => !g.got);
  for (const it of G.items) {
    it.t += dt; const d = Math.hypot(G.px - it.x, G.py - it.y);
    if (d < 26) {
      it.got = 1;
      if (it.k === 'heal') { G.hp = Math.min(G.maxHp, G.hp + 30); text(0, -30, '+30 ❤', C.gr); sfx('heal'); }
      else if (it.k === 'mag') { for (const g of G.gems) g.pull = 300; text(0, -30, '자석!', C.bl); sfx('pick'); }
      else if (it.k === 'bomb') { G.flash = .35; for (const e of G.en) if (e.type !== 'boss' && e.type !== 'elite' && Math.hypot(e.x - G.px, e.y - G.py) < 420) hurtEnemy(e, 9999); G.en = G.en.filter(e => !e.dead); sfx('nova'); }
      else if (it.k === 'chest') { G.chest++; sfx('chest'); }
    }
  }
  G.items = G.items.filter(i => !i.got);
  // 효과
  for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .92; f.vy *= .92; }
  G.fx = G.fx.filter(f => f.t < f.life);
  for (const t of G.texts) t.t += dt; G.texts = G.texts.filter(t => t.t < (t.big ? 2.2 : .9));
  // 점수 = 처치 점수 + 버틴 시간(초당 10점) + 클리어 보너스
  G.score = Math.floor(G.pts + G.t * 10 + (G.t >= CLEAR_T ? 5000 : 0));
  // 레벨업 / 보물상자 / 3분 클리어
  if (G.xp >= G.need) { G.xp -= G.need; G.lv++; G.need = need(G.lv); levelUp(false); return; }
  if (G.chest > 0) { G.chest--; levelUp(true); return; }
  if (!G.endless && G.t >= CLEAR_T) { clear(); return; }
}

/* ---------- 카드 고르기 ---------- */
function offers(n, rng) {
  const pool = [];
  const nw = Object.keys(G.w).length, np = Object.keys(G.p).length;
  for (const k in WEAP) { const l = G.w[k] || 0; if (l >= MAXLV) continue; if (!l && nw >= SLOTS) continue; pool.push({ t: 'w', k, l, wt: l ? 3 : 2.2 }); }
  for (const k in PASS) { const l = G.p[k] || 0; if (l >= MAXLV) continue; if (!l && np >= SLOTS) continue; pool.push({ t: 'p', k, l, wt: l ? 1.6 : 1.3 }); }
  const out = [];
  while (out.length < n && pool.length) { let s = 0; for (const p of pool) s += p.wt; let v = rng() * s, i = 0; for (; i < pool.length - 1; i++) { v -= pool[i].wt; if (v <= 0) break; } out.push(pool.splice(i, 1)[0]); }
  if (!out.length) out.push({ t: 'x', k: 'heal' }, { t: 'x', k: 'pts' });
  return out;
}
function cardHtml(o, i) {
  if (o.t === 'x') return o.k === 'heal' ? `<button type="button" class="sv-card" data-i="${i}" style="--c:${C.gr}"><span class="ic">🍀</span><b>회복<span class="k">[${i + 1}]</span></b><small>체력 40 회복</small></button>` : `<button type="button" class="sv-card" data-i="${i}" style="--c:${C.ye}"><span class="ic">💰</span><b>보너스 점수<span class="k">[${i + 1}]</span></b><small>점수 +1,000</small></button>`;
  const D = o.t === 'w' ? WEAP[o.k] : PASS[o.k], nl = o.l + 1, col = o.t === 'w' ? D.col : '#a99fd6';
  const desc = o.t === 'w' ? D.d[o.l] : D.d;
  return `<button type="button" class="sv-card" data-i="${i}" style="--c:${col}"><span class="ic">${D.icon}</span><b>${D.name} <i>${o.l ? 'Lv.' + nl : 'NEW'}</i><span class="k">[${i + 1}]</span></b><small>${desc}${nl === MAXLV ? ' · 최대' : ''}</small></button>`;
}
function ownedHtml() {
  const a = Object.keys(G.w).map(k => `<span>${WEAP[k].icon}${G.w[k]}</span>`).concat(Object.keys(G.p).map(k => `<span>${PASS[k].icon}${G.p[k]}</span>`));
  return `<div class="sv-own">${a.join('')}</div>`;
}
function levelUp(chest) {
  G.mode = 'lvl'; sfx(chest ? 'chest' : 'lvl');
  const rng = opts.rng('c' + G.lv + (chest ? 'x' + G.ev.chestN : '') + 'r' + (1 - G.reroll)); if (chest) G.ev.chestN = (G.ev.chestN || 0) + 1;
  const list = offers(3, rng);
  if (G.bot) { pick(list[0]); return; }
  panel.innerHTML = `<div><h3>${chest ? '🎁 보물상자!' : 'LEVEL UP! Lv.' + G.lv}</h3><p>카드 1장을 골라요</p><div class="sv-cards">${list.map(cardHtml).join('')}</div>`
    + (G.reroll > 0 && list[0].t !== 'x' ? '<button type="button" class="rr" data-k="rr">🎲 다시 뽑기 (한 판 1번)<span class="k"> [R]</span></button>' : '') + ownedHtml() + '</div>';
  panel.hidden = false;
  panel.onclick = e => {
    const c = e.target.closest('.sv-card'), r = e.target.closest('[data-k=rr]');
    if (r && G.reroll > 0) { G.reroll--; G.mode = 'play'; panel.hidden = true; G.lv--; levelUpRe(chest); return; }
    if (!c) return; pick(list[+c.dataset.i]);
  };
}
function levelUpRe(chest) { G.lv++; if (chest) G.ev.chestN--; levelUp(chest); }
function pick(o) {
  if (o.t === 'w') G.w[o.k] = (G.w[o.k] || 0) + 1, G.cd[o.k] = G.cd[o.k] || .2;
  else if (o.t === 'p') { G.p[o.k] = (G.p[o.k] || 0) + 1; if (o.k === 'heart') { G.maxHp += 20; G.hp = Math.min(G.maxHp, G.hp + 20); } }
  else if (o.k === 'heal') G.hp = Math.min(G.maxHp, G.hp + 40); else G.pts += 1000;
  panel.hidden = true; panel.onclick = null; G.mode = 'play'; G.inv = Math.max(G.inv, .6); last = performance.now();
}

/* ---------- 클리어·게임오버 ---------- */
function clear() {
  G.mode = 'clear'; G.clearT = G.t; sfx('clear');
  if (!G.debug && opts.bonus && opts.bonus.ach) opts.bonus.ach('sv3');
  G.score = Math.floor(G.pts + G.t * 10 + 5000);
  if (G.bot) { G.endless = true; G.mode = 'play'; return; }
  panel.innerHTML = '<div><h3>🎉 3분 생존 성공!</h3><div class="sc">' + G.score.toLocaleString() + '</div><p>생존 보너스 +5,000점 포함 · Lv.' + G.lv + ' · 처치 ' + G.kills.toLocaleString() + '</p>'
    + '<p>계속 버티면 <b>무한 모드</b>: 적이 점점 세지고, 처치 점수가 1.5배예요. 1분마다 오버로드가 다시 나와요.</p>'
    + '<button type="button" class="p4" data-k="go">▶ 계속 버티기 (무한 모드)</button><button type="button" class="p1" data-k="end">여기서 끝내고 기록 올리기</button></div>';
  panel.hidden = false;
  panel.onclick = e => { const k = e.target.dataset.k; if (k === 'go') { G.endless = true; G.mode = 'play'; G.inv = 1.5; panel.hidden = true; panel.onclick = null; last = performance.now(); } else if (k === 'end') finish(true); };
}
function die() { G.mode = 'dying'; G.dead = 1.1; sfx('die'); G.shake = .6; for (let i = 0; i < 30; i++) burst(G.px, G.py, SKC[1], 1); }
function finish(cleared) {
  G.mode = 'over'; const s = G.score, mm = Math.floor(G.t / 60), ss = Math.floor(G.t % 60);
  const res = { score: s, time: G.t, lv: G.lv, kills: G.kills, clear: G.t >= CLEAR_T }; G.result = res;
  if (!G.debug && s > 0) opts.submit(s);
  if (s > G.best) { G.best = s; try { localStorage.setItem('sv_best_' + opts.day, s); } catch (e) {} }
  if (G.bot) return;
  panel.innerHTML = '<div><h3>' + (res.clear ? (cleared ? '🎉 생존 성공!' : '🏁 무한 모드 종료') : 'GAME OVER') + '</h3><div class="sc">' + s.toLocaleString() + '</div><p>버틴 시간 ' + mm + ':' + String(ss).padStart(2, '0') + ' · Lv.' + G.lv + ' · 처치 ' + G.kills.toLocaleString() + '</p><p>오늘 내 최고 ' + G.best.toLocaleString() + '점</p>'
    + ownedHtml() + contBtn()
    + '<button type="button" class="p1" data-k="r">▶ 다시 도전</button><button type="button" class="p2" data-k="s">결과 공유</button><button type="button" class="p3" data-k="shop">🛍️ 미니 상점 (스킨·배경)</button><button type="button" class="p3" data-k="x">나가기</button></div>';
  panel.hidden = false;
  panel.onclick = e => { const k = e.target.dataset.k; if (k === 'c') { if (cont()) return; } if (k === 'r') { panel.hidden = true; audioInit(); applySkin(); newGame(); } else if (k === 's') opts.share(s, res); else if (k === 'shop') close('shop'); else if (k === 'x') close(); };
}
/* 출석 코인 이어하기: 한 판에 한 번, 코인 1개 → 체력 절반으로 그 자리에서 계속(점수·레벨 유지). 코인 없어도 게임은 끝까지 무료 */
function contBtn() {
  const B = opts.bonus; if (!B || G.cont || G.result.clear) return '';
  const n = B.coins();
  return n > 0 ? '<button type="button" class="p4" data-k="c">🪙 코인 1개로 이어하기 (보유 ' + n + ')</button>'
    : '<p class="p5">🪙 코인이 있으면 여기서 이어할 수 있어요. 코인은 매일 <b>출석체크</b>로 1개씩 무료!</p>';
}
function cont() {
  if (!G || G.mode !== 'over' || G.cont || !opts.bonus || !opts.bonus.spend(1)) return false;
  G.cont = 1; G.mode = 'play'; G.hp = Math.round(G.maxHp / 2); G.inv = 3; G.eb = []; G.result = null;
  for (const e of G.en) if (e.type !== 'boss' && Math.hypot(e.x - G.px, e.y - G.py) < 300) { e.dead = true; burst(e.x, e.y, ET[e.type].col, 0); }
  G.en = G.en.filter(e => !e.dead); G.flash = .3;
  text(0, -60, 'CONTINUE!', C.ye, 1); sfx('heal');
  panel.hidden = true; panel.onclick = null; last = performance.now(); return true;
}
// 멈춤: 손으로 멈추는 건 한 판에 1번(다른 게임과 같은 규칙). 자동 멈춤은 횟수에 안 셈. 다시 시작은 3초 카운트다운.
function pause(p, auto) {
  if (!G || G.mode !== 'play') return;
  if (p) {
    if (paused || G.cnt > 0) return;
    if (!auto) { if (G.pauseLeft <= 0) { text(0, -70, '멈춤은 한 판에 1번!', C.rd, 1); return; } G.pauseLeft--; }
    paused = true; G.autoP = !!auto; if (A.ctx) A.ctx.suspend();
  } else { if (!paused) return; paused = false; G.cnt = 3; if (A.ctx) A.ctx.resume(); }
  stick = null; last = performance.now();
}

/* ---------- 봇(밸런스 시험용, #svdebug 에서만) ---------- */
function botDir() {
  let fx = 0, fy = 0;
  for (const e of G.en) { const dx = G.px - e.x, dy = G.py - e.y, d2 = dx * dx + dy * dy; if (d2 < 220 * 220) { const w = (e.type === 'boss' ? 6 : e.type === 'elite' ? 3 : 1) / Math.max(200, d2); fx += dx * w; fy += dy * w; } }
  for (const b of G.eb) { const dx = G.px - b.x, dy = G.py - b.y, d2 = dx * dx + dy * dy; if (d2 < 120 * 120) { fx += dx * 3 / Math.max(100, d2); fy += dy * 3 / Math.max(100, d2); } }
  { const l = Math.hypot(fx, fy); if (l > 1e-4) { const tx = -fy / l, ty = fx / l; fx += tx * l * .8; fy += ty * l * .8; } }
  const l0 = Math.hypot(fx, fy); let g = null, gd = 1e9; for (const q of G.gems.concat(G.items)) { const d = (q.x - G.px) ** 2 + (q.y - G.py) ** 2; if (d < gd) { gd = d; g = q; } }
  if (g && gd < 320 * 320) { const d = Math.sqrt(gd) || 1, w = l0 < .004 ? .03 : .01; fx += (g.x - G.px) / d * w; fy += (g.y - G.py) / d * w; }
  const l = Math.hypot(fx, fy); return l > 1e-4 ? [fx / l, fy / l] : [Math.cos(G.t * .5), Math.sin(G.t * .5)];
}

/* ---------- 그리기 ---------- */
function applySkin() {
  try { const B = opts.bonus; if (B) { SKC = B.skin().c; DES = B.design('survivor'); THK = B.theme('survivor'); TRL = B.trail(); CHIP = B.sound() === 'chip'; } } catch (e) {}
  if (DES === 'phoenix') SKC = ['#fff4c2', '#ff8a3d', '#c2410c'];
  TH = THEME[THK] || THEME.base; ov.style.background = TH.bg; parts = [];
}
function W2S(wx, wy) { const S = lay.s * lay.dpr; return [(wx - G.cx) * S + cv.width / 2, (wy - G.cy) * S + cv.height / 2]; }
function drawBg(S) {
  x.fillStyle = TH.bg; x.fillRect(0, 0, cv.width, cv.height);
  const step = 80, x0 = G.cx - lay.vw / 2, y0 = G.cy - lay.vh / 2;
  x.lineWidth = Math.max(1, S * .8);
  for (let k = 0; k < 2; k++) {
    x.strokeStyle = k ? TH.g2 : TH.g1; x.globalAlpha = k ? .1 : .14; x.beginPath();
    const st = step * (k ? 4 : 1);
    for (let gx = Math.floor(x0 / st) * st; gx < x0 + lay.vw + st; gx += st) { const sx = (gx - G.cx) * S + cv.width / 2; x.moveTo(sx, 0); x.lineTo(sx, cv.height); }
    for (let gy = Math.floor(y0 / st) * st; gy < y0 + lay.vh + st; gy += st) { const sy = (gy - G.cy) * S + cv.height / 2; x.moveTo(0, sy); x.lineTo(cv.width, sy); }
    x.stroke();
  }
  x.globalAlpha = 1;
  // 테마 입자(화면 기준, 연출만)
  if (TH.p) {
    if (!parts.length) for (let i = 0; i < 46; i++) parts.push({ x: Math.random(), y: Math.random(), s: .5 + Math.random(), p: Math.random() * 6.28 });
    const T = performance.now() / 1000, W = cv.width, H = cv.height;
    for (const p of parts) {
      if (TH.p === 'sand') { p.x += .0006 * p.s; p.y += Math.sin(T + p.p) * .0002; x.fillStyle = '#ffcf8a'; x.globalAlpha = .35; x.fillRect(((p.x % 1) + 1) % 1 * W, p.y * H, 2 * S * p.s, 1.2 * S); }
      else if (TH.p === 'bubble') { p.y -= .0008 * p.s; if (p.y < -.05) p.y = 1.05; x.strokeStyle = '#8ff7ff'; x.globalAlpha = .3; x.lineWidth = S; x.beginPath(); x.arc((p.x + Math.sin(T * .8 + p.p) * .01) * W, p.y * H, 3 * S * p.s, 0, 7); x.stroke(); }
      else { p.y += .0007 * p.s; p.x += Math.sin(T + p.p) * .0005; if (p.y > 1.05) p.y = -.05; x.fillStyle = p.s > 1 ? '#ffb3d6' : '#ff8ac4'; x.globalAlpha = .5; x.save(); x.translate(((p.x % 1) + 1) % 1 * W, p.y * H); x.rotate(T * p.s + p.p); x.beginPath(); x.ellipse(0, 0, 4 * S * p.s, 2.2 * S * p.s, 0, 0, 7); x.fill(); x.restore(); }
    }
    x.globalAlpha = 1;
  }
}
function spr(s, wx, wy, S, scale, rot) {
  const [X, Y] = W2S(wx, wy), h = s.h * S * (scale || 1);
  if (X < -h || Y < -h || X > cv.width + h || Y > cv.height + h) return;
  if (rot) { x.save(); x.translate(X, Y); x.rotate(rot); x.drawImage(s.cv, -h, -h, h * 2, h * 2); x.restore(); }
  else x.drawImage(s.cv, X - h, Y - h, h * 2, h * 2);
}
function trailFx(X, Y, a, k, r, kind) {
  const t = performance.now() / 1000; x.save(); x.globalAlpha = a * .85; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (kind === 'spark') { const z = r * (.25 + a * .35) * (.7 + .3 * Math.sin(t * 12 + k * 2)); x.fillStyle = k % 2 ? '#fff' : '#ffe98a'; x.beginPath(); x.moveTo(X, Y - z * 1.6); x.lineTo(X + z * .4, Y); x.lineTo(X, Y + z * 1.6); x.lineTo(X - z * .4, Y); x.closePath(); x.moveTo(X - z * 1.6, Y); x.lineTo(X, Y - z * .4); x.lineTo(X + z * 1.6, Y); x.lineTo(X, Y + z * .4); x.closePath(); x.fill(); }
  else if (kind === 'heart') { x.fillStyle = k % 2 ? '#ff5fa8' : '#ff9ec4'; x.font = `900 ${Math.round(r * (.6 + a * .7))}px sans-serif`; x.fillText('♥', X, Y + Math.sin(t * 4 + k) * r * .2); }
  else if (kind === 'star') { x.fillStyle = k % 3 ? '#ffd23f' : '#fff6c8'; x.font = `900 ${Math.round(r * (.5 + a * .7))}px sans-serif`; x.fillText('★', X + Math.sin(k * 1.7) * r * .3, Y + Math.cos(k * 2.3) * r * .3); }
  else { x.fillStyle = `hsl(${(k * 36 + t * 120) % 360},95%,62%)`; x.beginPath(); x.arc(X, Y, r * (.3 + a * .5), 0, 7); x.fill(); }
  x.restore();
}
// 주인공 '루미': 빛나는 구슬 + 디자인 스킨(겉모습만, 판정 동일)
function drawHero(S) {
  const [X, Y] = W2S(G.px, G.py), r = 12 * S, T = performance.now() / 1000, c = SKC;
  // 꼬리
  for (let k = 0; k < G.trail.length; k++) {
    const p = G.trail[k], a = (k + 1) / G.trail.length, [tx, ty] = W2S(p[0], p[1]);
    if (DES === 'phoenix') { x.fillStyle = `hsla(${20 + k * 3},100%,${55 + a * 15}%,${a * .55})`; x.beginPath(); x.arc(tx, ty, r * (.3 + a * .6), 0, 7); x.fill(); }
    else if (TRL) trailFx(tx, ty, a, k, r, TRL);
  }
  if (G.inv > 0 && G.mode === 'play' && Math.floor(T * 20) % 2) x.globalAlpha = .45;
  x.save(); x.translate(X, Y);
  const face = G.hx < 0 ? -1 : 1;
  if (DES === 'phoenix') { // 전설: 불사조 날개(날갯짓) + 불꽃 볏
    const fl = Math.sin(T * 10) * .35;
    for (const sd of [-1, 1]) { x.save(); x.scale(sd, 1); x.rotate(fl * sd * 0 + fl); const g = x.createLinearGradient(0, 0, r * 2.6, 0); g.addColorStop(0, '#ffd23f'); g.addColorStop(.6, '#ff8a3d'); g.addColorStop(1, '#ff3d4d00'); x.fillStyle = g; x.beginPath(); x.moveTo(r * .4, -r * .1); x.quadraticCurveTo(r * 1.8, -r * 1.8, r * 2.7, -r * .9); x.quadraticCurveTo(r * 1.9, -r * .5, r * 2.3, r * .1); x.quadraticCurveTo(r * 1.3, 0, r * .4, r * .5); x.fill(); x.restore(); }
    x.fillStyle = '#ffd23f'; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * r * .35 - r * .15, -r * .8); x.quadraticCurveTo(i * r * .45, -r * (1.7 + Math.sin(T * 9 + i) * .2), i * r * .35 + r * .15, -r * .8); x.fill(); }
  }
  if (DES === 'cat') { x.fillStyle = c[1]; for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(sd * r * .25, -r * .8); x.lineTo(sd * r * .85, -r * 1.35); x.lineTo(sd * r * .95, -r * .45); x.fill(); } }
  if (DES === 'robot') { x.strokeStyle = c[0]; x.lineWidth = 2 * S; x.beginPath(); x.moveTo(0, -r); x.lineTo(0, -r * 1.6); x.stroke(); x.fillStyle = Math.floor(T * 3) % 2 ? '#ff3d4d' : '#ffd23f'; x.beginPath(); x.arc(0, -r * 1.7, r * .22, 0, 7); x.fill(); }
  x.shadowColor = c[1]; x.shadowBlur = 16 * S;
  if (DES === 'robot') { x.fillStyle = c[2]; x.strokeStyle = c[1]; x.lineWidth = 2.5 * S; x.beginPath(); x.roundRect ? x.roundRect(-r, -r, r * 2, r * 2, r * .35) : x.rect(-r, -r, r * 2, r * 2); x.fill(); x.stroke(); }
  else if (DES === 'ghost') {
    x.globalAlpha *= .9; const g = x.createLinearGradient(0, -r, 0, r * 1.4); g.addColorStop(0, c[0]); g.addColorStop(1, c[1] + '22'); x.fillStyle = g;
    x.beginPath(); x.arc(0, -r * .1, r, Math.PI, 0); for (let i = 0; i <= 4; i++) { const xx = r - i * r / 2, yy = r * (1 + (i % 2 ? .1 : .35) + Math.sin(T * 6 + i) * .08); x.lineTo(xx, yy); } x.closePath(); x.fill();
  } else { const g = x.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, c[0]); g.addColorStop(.55, c[1]); g.addColorStop(1, c[2]); x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); }
  x.shadowBlur = 0;
  // 눈
  const ex = G.hx * r * .25, ey = G.hy * r * .2;
  if (DES === 'robot') { x.fillStyle = '#0b0620'; x.fillRect(-r * .7, -r * .35, r * 1.4, r * .55); x.fillStyle = c[0]; x.fillRect(-r * .55 + ex, -r * .25, r * .35, r * .3); x.fillRect(r * .2 + ex, -r * .25, r * .35, r * .3); }
  else { x.fillStyle = DES === 'ghost' ? '#2a1a5a' : '#0b0620'; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(sd * r * .35 + ex, -r * .1 + ey, r * .14, r * .22, 0, 0, 7); x.fill(); } }
  if (DES === 'cat') { x.strokeStyle = '#0b0620'; x.lineWidth = 1.2 * S; for (const sd of [-1, 1]) for (const dy of [.15, .32]) { x.beginPath(); x.moveTo(sd * r * .5, r * dy); x.lineTo(sd * r * 1.15, r * (dy - .1 + (dy > .2 ? .2 : 0))); x.stroke(); } }
  x.restore(); x.globalAlpha = 1;
  void face;
}
function hud(S) {
  const W = cv.width, H = cv.height, sc = lay.dpr, top = 8 * sc + (parseFloat(getComputedStyle(hudBtns).top) || 8) * 0;
  // 경험치 막대
  x.fillStyle = '#ffffff18'; x.fillRect(0, 0, W, 7 * sc); x.fillStyle = C.bl; x.shadowColor = C.bl; x.shadowBlur = 8 * sc; x.fillRect(0, 0, W * Math.min(1, G.xp / G.need), 7 * sc); x.shadowBlur = 0;
  x.textBaseline = 'top'; x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = `${11 * sc}px ${FONT_N}`;
  x.fillText('Lv.' + G.lv, 10 * sc, 16 * sc);
  x.fillStyle = C.ye; x.fillText(G.score.toLocaleString(), 10 * sc, 34 * sc);
  // 시간(가운데)
  const left = G.endless ? G.t : Math.max(0, CLEAR_T - G.t), mm = Math.floor(left / 60), ss = Math.floor(left % 60);
  x.textAlign = 'center'; x.font = `${16 * sc}px ${FONT_N}`; x.fillStyle = G.endless ? C.pk : (left < 30 ? C.ye : '#fff'); x.shadowColor = x.fillStyle; x.shadowBlur = 10 * sc;
  x.fillText((G.endless ? '+' : '') + mm + ':' + String(ss).padStart(2, '0'), W / 2, 16 * sc); x.shadowBlur = 0;
  x.font = `${9 * sc}px ${FONT_N}`; x.fillStyle = '#a99fd6'; x.fillText(G.endless ? 'ENDLESS x1.5' : 'SURVIVE', W / 2, 38 * sc);
  // 체력(주인공 아래)
  const [X, Y] = W2S(G.px, G.py), bw = 34 * S, by = Y + 18 * S;
  x.fillStyle = '#00000088'; x.fillRect(X - bw / 2 - 1, by - 1, bw + 2, 5 * S + 2); x.fillStyle = G.hp / G.maxHp < .3 ? C.rd : C.gr; x.fillRect(X - bw / 2, by, bw * G.hp / G.maxHp, 5 * S);
  // 보스 체력
  if (G.boss && !G.boss.dead) { const bw2 = Math.min(W * .7, 420 * sc); x.fillStyle = '#00000099'; x.fillRect(W / 2 - bw2 / 2, 52 * sc, bw2, 9 * sc); x.fillStyle = C.rd; x.shadowColor = C.rd; x.shadowBlur = 8 * sc; x.fillRect(W / 2 - bw2 / 2, 52 * sc, bw2 * Math.max(0, G.boss.hp / G.boss.max), 9 * sc); x.shadowBlur = 0; x.font = `${12 * sc}px ${FONT_K}`; x.fillStyle = '#fff'; x.fillText('오버로드' + (G.bossN > 1 ? ' Mk.' + G.bossN : ''), W / 2, 64 * sc); }
  // 보스 방향 화살표
  if (G.boss && !G.boss.dead) { const [bx, by2] = W2S(G.boss.x, G.boss.y); if (bx < 0 || by2 < 0 || bx > W || by2 > H) { const a = Math.atan2(by2 - H / 2, bx - W / 2), R = Math.min(W, H) / 2 - 30 * sc; x.save(); x.translate(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R); x.rotate(a); x.fillStyle = C.rd; x.beginPath(); x.moveTo(14 * sc, 0); x.lineTo(-8 * sc, -9 * sc); x.lineTo(-8 * sc, 9 * sc); x.fill(); x.restore(); } }
  // 조이스틱
  if (stick && !stick.mouse) { const r = lay.dpr, sx = stick.sx * r, sy = stick.sy * r; x.strokeStyle = '#ffffff44'; x.lineWidth = 2 * r; x.beginPath(); x.arc(sx, sy, 46 * r, 0, 7); x.stroke(); const dx = stick.x - stick.sx, dy = stick.y - stick.sy, l = Math.hypot(dx, dy), m = Math.min(46, l); x.fillStyle = '#ffffff55'; x.beginPath(); x.arc(sx + (l ? dx / l * m : 0) * r, sy + (l ? dy / l * m : 0) * r, 18 * r, 0, 7); x.fill(); }
  void top;
}
function draw() {
  const S = lay.s * lay.dpr; let shx = 0, shy = 0;
  if (G.shake > 0) { shx = (Math.random() - .5) * 10 * G.shake; shy = (Math.random() - .5) * 10 * G.shake; }
  G.cx = G.px + shx; G.cy = G.py + shy;
  drawBg(S);
  // 보석·아이템
  for (const g of G.gems) spr(SP.gem[g.k], g.x, g.y, S, g.k === 2 ? 1.3 : 1);
  const T = performance.now() / 1000;
  for (const it of G.items) {
    const [X, Y] = W2S(it.x, it.y); x.font = `${(it.k === 'chest' ? 24 : 18) * S}px sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = it.k === 'chest' ? C.ye : '#fff'; x.shadowBlur = 14 * S; x.fillText(it.k === 'heal' ? '💚' : it.k === 'mag' ? '🧲' : it.k === 'bomb' ? '💣' : '🎁', X, Y + Math.sin(T * 4) * 3 * S); x.shadowBlur = 0;
  }
  // 파동
  for (const r of G.rings) { if (r.t < 0) continue; const [X, Y] = W2S(r.x, r.y), rr = r.R * Math.min(1, r.t / .35) * S; x.strokeStyle = C.gr; x.globalAlpha = Math.max(0, 1 - r.t / .5); x.lineWidth = 5 * S; x.shadowColor = C.gr; x.shadowBlur = 14 * S; x.beginPath(); x.arc(X, Y, rr, 0, 7); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; }
  // 적
  for (const e of G.en) { const s = e.hitT > 0 ? SP.enF[e.type] : SP.en[e.type]; spr(s, e.x, e.y, S, 1, e.type === 'dart' ? Math.atan2(e.dy || 0, e.dx || 1) : (e.type === 'boss' || e.type === 'elite') ? T * .6 : 0); }
  // 주인공
  if (G.mode !== 'dying' || G.dead > .8) drawHero(S);
  // 오비트
  if (G.orbs) for (const o of G.orbs) spr(SP.orb, o[0], o[1], S);
  // 탄
  for (const b of G.bul) { if (b.k === 'pulse') spr(SP.bul, b.x, b.y, S); else spr(SP.disc, b.x, b.y, S, b.r / 13, b.rot); }
  for (const b of G.eb) spr(SP.eb, b.x, b.y, S);
  // 레이저
  for (const b of G.beams) { const [X, Y] = W2S(b.x, b.y), a = 1 - b.t / .22; x.save(); x.globalAlpha = a; x.strokeStyle = C.pk; x.lineCap = 'round'; x.shadowColor = C.pk; x.shadowBlur = 18 * S; x.lineWidth = b.wd * S; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + b.ux * b.len * S, Y + b.uy * b.len * S); x.stroke(); x.strokeStyle = '#fff'; x.lineWidth = b.wd * .35 * S; x.stroke(); x.restore(); }
  // 번개
  for (const b of G.bolts) { x.strokeStyle = C.ye; x.globalAlpha = 1 - b.t / .18; x.lineWidth = 2.5 * S; x.shadowColor = C.ye; x.shadowBlur = 12 * S; x.beginPath(); b.pts.forEach((p, i) => { const [X, Y] = W2S(p[0] + (i ? (Math.random() - .5) * 8 : 0), p[1] + (i ? (Math.random() - .5) * 8 : 0)); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.stroke(); x.shadowBlur = 0; x.globalAlpha = 1; }
  // 파편
  for (const f of G.fx) { const [X, Y] = W2S(f.x, f.y), a = 1 - f.t / f.life; x.globalAlpha = a; x.fillStyle = f.col; x.fillRect(X - 2 * S, Y - 2 * S, 4 * S, 4 * S); } x.globalAlpha = 1;
  // 글자
  for (const t of G.texts) {
    const a = Math.min(1, (t.big ? 2.2 : .9) - t.t); x.globalAlpha = Math.max(0, a); x.textAlign = 'center'; x.textBaseline = 'middle';
    if (t.ui) { x.font = `${22 * lay.dpr}px ${FONT_K}`; x.fillStyle = t.col; x.shadowColor = t.col; x.shadowBlur = 14 * lay.dpr; x.fillText(t.s, cv.width / 2, cv.height * .28 + (G.texts.indexOf(t) % 3) * 30 * lay.dpr); x.shadowBlur = 0; }
    else { const [X, Y] = W2S(t.x, t.y - t.t * 30); x.font = `${13 * S}px ${FONT_K}`; x.fillStyle = t.col; x.fillText(t.s, X, Y); }
  }
  x.globalAlpha = 1;
  if (G.hurtT > 0) { x.fillStyle = `rgba(255,40,60,${G.hurtT * .8})`; x.fillRect(0, 0, cv.width, cv.height); }
  if (G.flash > 0) { x.fillStyle = `rgba(255,255,255,${G.flash})`; x.fillRect(0, 0, cv.width, cv.height); }
  hud(S);
  if (paused) {
    x.fillStyle = TH.bg; x.globalAlpha = .96; x.fillRect(0, 0, cv.width, cv.height); x.globalAlpha = 1; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = C.ye; x.font = `${20 * lay.dpr}px ${FONT_N}`; x.fillText('PAUSE', cv.width / 2, cv.height * .42);
    x.fillStyle = '#cfc8ff'; x.font = `${14 * lay.dpr}px ${FONT_K}`; x.fillText(G.autoP ? '자동 멈춤은 횟수에 들어가지 않아요' : '남은 멈춤 ' + G.pauseLeft + '회 (한 판에 1번)', cv.width / 2, cv.height * .42 + 40 * lay.dpr);
    x.fillText('화면을 누르거나 아무 키나 누르면 계속', cv.width / 2, cv.height * .42 + 66 * lay.dpr);
  } else if (G.cnt > 0) { x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = C.ye; x.font = `${42 * lay.dpr}px ${FONT_N}`; x.shadowColor = C.ye; x.shadowBlur = 20 * lay.dpr; x.fillText(String(Math.ceil(G.cnt)), cv.width / 2, cv.height * .4); x.shadowBlur = 0; }
  else if (G.t < 4 && G.mode === 'play') {
    x.globalAlpha = Math.min(1, 4 - G.t); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.font = `${15 * lay.dpr}px ${FONT_K}`;
    x.fillText(matchMedia('(pointer:coarse)').matches ? '화면을 대고 끌어서 이동 · 공격은 자동!' : '방향키·WASD로 이동 · 공격은 자동!', cv.width / 2, cv.height * .7);
    x.fillText('3분 버티면 성공', cv.width / 2, cv.height * .7 + 26 * lay.dpr); x.globalAlpha = 1;
  }
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  let dt = Math.min(.1, (now - last) / 1000); last = now;
  if (!G) return;
  const sp = G.fast || 1;
  if (!paused && G.cnt > 0) { G.cnt -= dt; if (G.cnt <= 0) G.cnt = 0; }
  else if (!paused && G.mode === 'play') {
    acc += dt * sp; let n = 0; const maxN = 6 * sp;
    while (acc >= STEP && n < maxN) { update(STEP); acc -= STEP; n++; if (G.mode !== 'play') { acc = 0; break; } }
    if (n >= maxN) acc = 0;
    if (A.ctx) music(G.boss ? 2 : G.t > 90 ? 1 : 0);
  } else if (G.mode === 'dying') { G.dead -= dt; for (const f of G.fx) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; } G.fx = G.fx.filter(f => f.t < f.life); if (G.dead <= 0) finish(false); }
  else acc = 0;
  draw();
}
function fs() {
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return;
  const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return;
  try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {}
}
function open() {
  ov.hidden = false; document.documentElement.style.overflow = 'hidden';
  applySkin(); if (!DEBUG) fs(); layout(); audioInit(); paused = false; panel.hidden = true; newGame();
  last = performance.now(); acc = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function close(why) {
  cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true;
  if (A.ctx) A.ctx.suspend();
  const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} }
  const r = G && G.result; opts.onExit(r || null, why); G = null; paused = false;
}
function warm() { RES = 2; SP = buildSprites(); try { document.fonts && document.fonts.load('10px "Press Start 2P"'); document.fonts && document.fonts.load('16px "Black Han Sans"', '생존'); } catch (e) {} }
window.SurvivorGame = {
  boot(o) {
    opts = o; if (!ov) { mkDom(); warm(); }
    const api = { open };
    if (DEBUG) window.__sv = { open, close, G: () => G, pause, draw: () => draw(), bot(b) { G.bot = b; }, fast(n) { G.fast = n; }, god(b) { G.god = b; }, time(t) { G.t = t; }, give(k, n) { for (let i = 0; i < (n || 1); i++) pick(WEAP[k] ? { t: 'w', k, l: G.w[k] || 0 } : { t: 'p', k, l: G.p[k] || 0 }); }, step(n, dt) { for (let i = 0; i < n && G && G.mode !== 'over'; i++) { if (G.mode === 'play') update(dt || STEP); else if (G.mode === 'dying') { G.dead = 0; finish(false); } } }, layout };
    return api;
  },
};
})();
