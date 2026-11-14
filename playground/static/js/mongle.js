// 몽글숲 아지트 — 5락실 육성 RPG (BK 11/14 정식 릴리즈)
// 숲 정령 몽글이를 돌보고, 산책 보내고, 요리하고, 아지트를 꾸미는 느긋한 육성 게임. 전투 없음.
// 그림은 모두 /js/mongle-art.js 에서 코드로 그림. 저장은 이 기기(localStorage 'mg_save_v1').
(function () {
'use strict';
const A = window.MongleArt, TAU = Math.PI * 2;
const W = 390, H = 844;
const DEBUG = /mgdebug/.test(location.hash);
const TRIAL_DIV = 1; // 정식(11/14): 실제 시간 30분 · 2시간 · 6시간
const KDAY = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const KHOUR = () => new Date(Date.now() + 9 * 3600e3).getUTCHours();
const EX_MAX = 5, EX_ACORN = 100, COOK_COST = 10, FEED_COST = 5, WALK_MAX = 3, PAT_MAX = 10;
const STAGE_LV = [1, 2, 5, 12]; // 씨앗 · 새싹 · 꼬마 · 어른
const STAGE_N = ['씨앗', '새싹', '꼬마', '어른'];
const BRANCH = { power: ['든든 도토리', '산책을 많이 다녀서 튼튼해졌어요'], wise: ['반짝 별꽃', '도감을 많이 채워서 똑똑해졌어요'], heart: ['포근 하트', '많이 쓰다듬어 줘서 다정해졌어요'] };

// ── 재료·코스·요리·엽서
const ING = {
  honey: ['꿀', (c, x, y, s) => A.honey(c, x, y, s), '들꽃 언덕'],
  herb: ['허브', (c, x, y, s) => A.herb(c, x, y, s), '들꽃 언덕 · 별빛 호수'],
  berry: ['딸기', (c, x, y, s) => A.berry(c, x, y, s), '버섯 숲 · 들꽃 언덕'],
  mush: ['버섯', (c, x, y, s) => A.mushroom(c, x, y + 4 * s, s, '#ff7d6b'), '버섯 숲'],
  star: ['별열매', (c, x, y, s) => A.starfruit(c, x, y, s), '별빛 호수'],
};
const INGK = Object.keys(ING);
const COURSE = [
  { n: '들꽃 언덕', min: 30, col: '#ffb52e', lv: 2, get: [['honey', 1, 2], ['herb', 1, 2], ['berry', 0, 1]], ac: [10, 20], xp: 15, pin: [180, 276], ic: (c, x, y) => A.honey(c, x, y, 1) },
  { n: '버섯 숲', min: 120, col: '#ff7d6b', lv: 3, get: [['mush', 2, 3], ['berry', 1, 2]], ac: [30, 50], xp: 40, pin: [96, 210], ic: (c, x, y) => A.mushroom(c, x, y + 4, 1.05, '#ff7d6b') },
  { n: '별빛 호수', min: 360, col: '#5aa8e0', lv: 5, get: [['star', 1, 2], ['honey', 0, 1], ['herb', 0, 1]], ac: [60, 90], xp: 90, pin: [286, 176], ic: (c, x, y) => A.starfruit(c, x, y, 1.05) },
];
const CARDS = [
  [['나비 친구', '들꽃 언덕에서 주황 나비를 따라 한참 뛰어다녔어요. 숨이 차서 꽃밭에 벌러덩 누웠대요.'], ['꿀단지 발견', '언덕 꼭대기 그루터기 아래에서 누가 두고 간 꿀단지를 찾았어요. 딱 한 입만 맛봤대요.'], ['분홍 편지', '바람에 날아온 분홍 편지를 주웠어요. "오늘도 좋은 하루!"라고 적혀 있었어요.']],
  [['커다란 버섯', '몽글이보다 큰 빨간 버섯 아래에서 비를 피했어요. 빗소리가 자장가 같았대요.'], ['다람쥐의 비밀', '다람쥐가 도토리를 숨기는 걸 봤어요. 어디인지는 비밀로 해 주기로 했대요.'], ['반딧불 길', '해가 지자 반딧불이 줄지어 길을 밝혀 줬어요. 덕분에 길을 잃지 않았어요.']],
  [['별똥비', '호수 위로 별똥별이 비처럼 쏟아졌어요. 몽글이의 소원은 "내일도 산책!"이었대요.'], ['별열매 나무', '물가에 반짝이는 별열매가 열려 있었어요. 가장 잘 익은 것만 골라 왔대요.'], ['달빛 웅덩이', '달빛이 고인 웅덩이에 발을 담갔더니 발끝이 반짝반짝 빛났대요.']],
];
const RECIPE = [
  { id: 'stew', n: '버섯 딸기 스튜', need: { mush: 1, berry: 1 }, d: { k: 'soup', c: '#f2a07a' }, fx: { bonus: 0.2, mood: 30 }, desc: '다음 산책 보상 +20% · 기분 +30', hint: '숲에서 나는 빨간 것 두 가지' },
  { id: 'mochi', n: '딸기 꿀떡', need: { berry: 1, honey: 1 }, d: { k: 'mochi' }, fx: { mood: 40, full: 20 }, desc: '기분 +40 · 배 +20', hint: '새콤한 것 + 달콤한 것' },
  { id: 'soup', n: '버섯 허브 수프', need: { mush: 2, herb: 1 }, d: { k: 'mush', c: '#d9e8b0' }, fx: { fast: 0.3, full: 40 }, desc: '다음 산책 시간 -30% · 배 +40', hint: '버섯 두 개 + 초록 잎 하나' },
  { id: 'tea', n: '허브 꿀차', need: { herb: 1, honey: 1 }, d: { k: 'tea', c: '#e6c56a' }, fx: { full: 30, mood: 30 }, desc: '배 +30 · 기분 +30', hint: '향긋한 잎 + 달콤한 것' },
  { id: 'jelly', n: '별빛 젤리', need: { star: 1, honey: 1 }, d: { k: 'jelly' }, fx: { xp: 60 }, desc: '경험치 +60', hint: '반짝이는 열매 + 달콤한 것' },
  { id: 'parfait', n: '반짝 파르페', need: { star: 1, berry: 1, honey: 1 }, d: { k: 'parfait' }, fx: { bonus: 0.3, card: 1, xp: 30 }, desc: '다음 산책 보상 +30% · 엽서 꼭 받기 · 경험치 +30', hint: '별·딸기·꿀 셋 다' },
];
const MYSTERY = { id: 'x', n: '수상한 죽', d: { k: 'x' }, fx: { full: 10 }, desc: '배 +10 · 다른 조합을 찾아봐요' };

// ── 꾸미기 (도토리로 사기) / 몽글이 색 (5락실 코인)
const DECO = {
  wall: { n: '벽지', o: [['peach', '살구', 0, { a: '#fbe6cf', b: '#f4cfae', dot: '#e59a8a' }], ['mint', '민트', 60, { a: '#e3f6ea', b: '#c7ead6', dot: '#7cc3a8' }], ['sky', '하늘', 60, { a: '#e4f0ff', b: '#c8dcf6', dot: '#7aa0e0' }], ['lilac', '라일락', 80, { a: '#f1e8ff', b: '#dccdf6', dot: '#b08ae6' }]] },
  curtain: { n: '커튼', o: [['pink', '분홍', 0, ['#ff9eae', '#ffc4cd', '#f2879a', '#c25b6e']], ['mint', '민트', 50, ['#8fdcc0', '#c4f0de', '#6cc4a4', '#3f8a72']], ['butter', '버터', 50, ['#ffd987', '#fff0c2', '#f0c060', '#b08530']], ['lav', '보라', 60, ['#b9a0f0', '#ddd0ff', '#a088e0', '#6a50a8']]] },
  rug: { n: '러그', o: [['mint', '민트', 0, '#9fd3c7'], ['pink', '분홍', 50, '#f5b3c3'], ['butter', '버터', 50, '#f6d98c'], ['lav', '보라', 60, '#c3b3ef']] },
  cushion: { n: '방석', o: [['pink', '분홍', 0, '#ffb3c1'], ['mint', '민트', 40, '#a8e6cf'], ['sky', '하늘', 40, '#a8ccf5'], ['butter', '버터', 40, '#ffd98a']] },
};
const DECOK = Object.keys(DECO);
const EXTRA = [['garland', '전구 줄', 120], ['mobile', '별 모빌', 100], ['frame', '엽서 액자', 80]];
const PALS = [['mint', '민트', 0], ['peach', '복숭아', 3], ['sky', '하늘', 3], ['lilac', '라일락', 3]]; // 가격 = 5락실 코인
const WEAR = [['scarf', '목도리', 80], ['hat', '밀짚모자', 150]]; // 도토리

// ── 저장
let SV;
function fresh() {
  return { v: 1, born: 0, lv: 1, xp: 0, full: 70, mood: 70, ts: Date.now(), acorn: 50, inv: { honey: 1, herb: 1, berry: 1, mush: 0, star: 0 },
    walks: 0, pats: 0, cooks: 0, branch: '', pal: 'mint', palOwn: { mint: 1 }, wear: {}, wearOn: {}, deco: { wall: 'peach', curtain: 'pink', rug: 'mint', cushion: 'pink' }, decoOwn: {}, extra: {},
    dex: { r: {}, c: {} }, walk: null, buff: null, wd: { d: '', n: 0 }, ex: { d: '', n: 0 }, care: { d: '', pat: 0, feed: 0, walk: 0, cook: 0, deco: 0, done: 0 } };
}
function load() { try { SV = JSON.parse(localStorage.getItem('mg_save_v1')); } catch (e) { SV = null; } const f = fresh(); SV = Object.assign(f, SV || {}); for (const k of ['inv', 'dex', 'deco', 'care', 'wd', 'ex']) SV[k] = Object.assign(f[k], SV[k] || {}); }
function save() { try { localStorage.setItem('mg_save_v1', JSON.stringify(SV)); } catch (e) {} }
function care() { if (SV.care.d !== KDAY()) SV.care = { d: KDAY(), pat: 0, feed: 0, walk: 0, cook: 0, deco: 0, done: 0 }; return SV.care; }
const stage = () => SV.lv >= STAGE_LV[3] ? 3 : SV.lv >= STAGE_LV[2] ? 2 : SV.lv >= STAGE_LV[1] ? 1 : 0;
const need = lv => 20 + lv * 12;
const dexN = () => Object.keys(SV.dex.r).length + Object.keys(SV.dex.c).length + INGK.filter(k => SV.dex['i' + k]).length;
const dexMax = RECIPE.length + 9 + INGK.length;
const night = () => { const h = KHOUR(); return h >= 19 || h < 6; };
function decay() { // 시간 지나면 배·기분이 천천히 내려감 (0 아래로는 안 내려감, 벌칙 없음)
  const now = Date.now(), dt = (now - SV.ts) / 60000; if (dt < 1) return;
  SV.full = Math.max(0, SV.full - dt / 12); SV.mood = Math.max(0, SV.mood - dt / 15); SV.ts = now;
}

// ── 화면 상태
let opts, ov, cv, c, dpr = 1, sc = 1, ox = 0, oy = 0, raf = 0, last = 0, T = 0, tab = 'home', modal = null, hits = [], parts = [], bubble = { s: '', t: 0 }, cookSel = [], cookT = -1, cookRes = null, dexTab = 'i', petT = 0, bounce = 0, flash = 0, decoCat = 'wall';
const bgCache = { k: '', cv: null };
const cardCache = {};

// ── 소리 (웹오디오 합성)
const AU = { ctx: null, on: true, bgm: null, step: 0, next: 0 };
function audioInit() {
  try { AU.on = localStorage.getItem('mg_snd') !== '0'; } catch (e) {}
  if (!AU.ctx) { try { AU.ctx = new (window.AudioContext || window.webkitAudioContext)(); AU.mg = AU.ctx.createGain(); AU.mg.gain.value = 0.5; AU.mg.connect(AU.ctx.destination); } catch (e) { return; } }
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
}
function tone(f, d, type, vol, when, slide) {
  if (!AU.ctx || !AU.on) return; const t0 = AU.ctx.currentTime + (when || 0), o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  o.connect(g); g.connect(AU.mg); o.start(t0); o.stop(t0 + d + 0.05);
}
function sfx(k) {
  if (k === 'pat') { tone(660, 0.12, 'sine', 0.18); tone(990, 0.14, 'sine', 0.14, 0.07); }
  else if (k === 'tap') tone(520, 0.06, 'triangle', 0.12);
  else if (k === 'pop') tone(380, 0.12, 'triangle', 0.2, 0, 760);
  else if (k === 'coin') { tone(1320, 0.1, 'square', 0.06); tone(1760, 0.16, 'square', 0.06, 0.07); }
  else if (k === 'bub') { for (let i = 0; i < 5; i++) tone(200 + Math.random() * 220, 0.08, 'sine', 0.12, i * 0.12, 420 + Math.random() * 200); }
  else if (k === 'ok') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.16, i * 0.08));
  else if (k === 'lv') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, i * 0.09));
  else if (k === 'no') tone(220, 0.18, 'square', 0.06, 0, 160);
  else if (k === 'walk') [392, 523, 659].forEach((f, i) => tone(f, 0.18, 'sine', 0.16, i * 0.11));
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
function bgm() { // 오르골 느낌 배경음 (끄기 버튼 · 설정 기억)
  if (!AU.ctx || !AU.on) return; const now = AU.ctx.currentTime; if (AU.next < now) AU.next = now + 0.05;
  const pat = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 6, 7, 5, 4, 2], bass = [-12, -12, -8, -8, -10, -10, -5, -5];
  while (AU.next < now + 0.4) {
    const i = AU.step % 16, n = SCALE[pat[i]] + (night() ? -2 : 0);
    tone(523.25 * Math.pow(2, n / 12), 0.6, 'sine', 0.05, AU.next - now); tone(523.25 * Math.pow(2, (n + 12) / 12), 0.25, 'triangle', 0.012, AU.next - now);
    if (i % 2 === 0) tone(261.6 * Math.pow(2, bass[(i / 2) | 0] / 12), 0.9, 'triangle', 0.04, AU.next - now);
    AU.step++; AU.next += 0.36;
  }
}

// ── 그리기 도우미
function txt(s, x, y, size, col, al, font) { c.font = size + 'px ' + (font || 'Jua') + ', "Black Han Sans", sans-serif'; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'middle'; c.fillText(s, x, y); }
function tw(s, size) { c.font = size + 'px Jua, sans-serif'; return c.measureText(s).width; }
function wrap(s, x, y, w, size, col, lh, al) { c.font = size + 'px Jua, sans-serif'; let line = '', yy = y; for (const wd of s.split(' ')) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w && line) { txt(line, x, yy, size, col, al); line = wd; yy += lh; } else line = t; } if (line) txt(line, x, yy, size, col, al); return yy; }
function pill(x, y, w, h, fill, stroke) { A.rr(c, x, y, w, h, h / 2); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } }
function card(x, y, w, h, fill) { A.rr(c, x, y + 3, w, h, 18); c.fillStyle = 'rgba(150,100,70,0.18)'; c.fill(); A.rr(c, x, y, w, h, 18); c.fillStyle = fill || '#fffaf3'; c.fill(); c.strokeStyle = '#efd3ba'; c.lineWidth = 2; c.stroke(); }
function tag(x, y, s, col) { const w = tw(s, 12) + 14; pill(x, y, w, 20, col); txt(s, x + 7, y + 10.5, 12, '#fff'); return w; }
function hit(x, y, w, h, fn) { hits.push({ x, y, w, h, fn }); }
function btn(x, y, w, h, label, col, fn, size) {
  const off = !fn; col = off ? '#cdbfb3' : col;
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, A.mix(col, '#ffffff', 0.3)); g.addColorStop(1, col);
  A.rr(c, x, y + 4, w, h, h / 2); c.fillStyle = A.mix(col, '#000000', 0.3); c.fill(); A.rr(c, x, y, w, h, h / 2); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; A.rr(c, x + 8, y + 4, w - 16, h * 0.35, h * 0.18); c.fill();
  txt(label, x + w / 2, y + h / 2 + 1, size || 16, '#fff', 'center');
  if (fn) hit(x, y, w, h + 4, fn);
}
function bar(x, y, w, v, col, label) { pill(x, y, w, 12, 'rgba(90,60,50,0.18)'); if (v > 0.02) { A.rr(c, x, y, Math.max(12, w * Math.min(1, v)), 12, 6); const g = c.createLinearGradient(0, y, 0, y + 12); g.addColorStop(0, A.mix(col, '#ffffff', 0.35)); g.addColorStop(1, col); c.fillStyle = g; c.fill(); } if (label) txt(label, x - 6, y + 6.5, 12, '#6a4a40', 'right'); }
function mg(x, y, s, o) { A.mongle(c, x, y, s, Object.assign({ stage: stage(), branch: SV.branch, pal: SV.pal, t: T, scarf: SV.wearOn.scarf ? '#ff8f6b' : null, hat: SV.wearOn.hat ? 'straw' : null }, o || {})); }
function toastAt(x, y, s, col) { parts.push({ k: 'txt', x, y, vx: 0, vy: -38, life: 1.4, max: 1.4, s, col: col || '#c75b3f' }); }
function burst(x, y, kind, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 120; parts.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 0.9 + Math.random() * 0.5, max: 1.4, r: 4 + Math.random() * 5, col: ['#ffd36b', '#ff9eae', '#9be0ff', '#a8ecc8'][i % 4] }); } }
function ring(x, y, col) { parts.push({ k: 'ring', x, y, life: 0.6, max: 0.6, col: col || '#ffd36b' }); }
function heartPath(x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45); c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); }

// ── 진행 로직
function addXp(n, x, y) {
  SV.xp += n; if (x != null) toastAt(x, y, '+' + n + ' 경험치', '#7a5ad0');
  const st0 = stage(); let up = false;
  while (SV.xp >= need(SV.lv)) { SV.xp -= need(SV.lv); SV.lv++; up = true; }
  if (up) {
    sfx('lv'); flash = 0.6; burst(205, 560, 'spark', 26);
    if (stage() > st0) { if (stage() === 3) SV.branch = pickBranch(); modal = { k: 'evolve', st: stage(), t: 0 }; }
    else toastAt(205, 470, 'Lv.' + SV.lv + ' 레벨 업!', '#e07a5f');
  }
  save();
}
function pickBranch() { const p = SV.walks * 3, w = dexN() * 4, h = SV.pats / 2; return p >= w && p >= h ? 'power' : w >= h ? 'wise' : 'heart'; }
function careMark(k) {
  const cr = care(); if (cr[k]) return; cr[k] = 1;
  if (!cr.done && ['pat', 'feed', 'walk', 'cook', 'deco'].every(q => cr[q])) { cr.done = 1; SV.acorn += 50; sfx('ok'); burst(195, 700, 'spark', 20); toastAt(195, 660, '오늘의 돌보기 완료! 도토리 +50', '#2f7d68'); addXp(30); }
  save();
}
function rint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function walkLeft() { return SV.walk ? Math.max(0, SV.walk.e - Date.now()) : 0; }
function fmt(ms) { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); }
function minT(m) { return m >= 60 ? (m / 60) + '시간' : m + '분'; }
function walkDur(i) { return COURSE[i].min * 60000 / TRIAL_DIV; }
function sendWalk(i) {
  const C = COURSE[i];
  if (stage() === 0) { say('싹이 나면 산책 갈 수 있어요!'); sfx('no'); return; }
  if (SV.lv < C.lv) { sfx('no'); return; }
  if (SV.wd.d !== KDAY()) SV.wd = { d: KDAY(), n: 0 };
  if (SV.wd.n >= WALK_MAX || SV.walk) { sfx('no'); return; }
  const b = SV.buff || {}; let dur = walkDur(i); if (b.fast) dur *= 1 - b.fast;
  SV.walk = { c: i, s: Date.now(), e: Date.now() + dur, bonus: (b.bonus || 0), card: b.card || 0, low: SV.full < 30 || SV.mood < 30 ? 1 : 0 };
  SV.buff = null; SV.wd.n++; careMark('walk'); sfx('walk'); save();
  toastAt(195, 300, C.n + '(으)로 출발!', '#2f7d68');
}
function claimWalk() {
  const w = SV.walk; if (!w || Date.now() < w.e) return;
  const C = COURSE[w.c], mul = (1 + w.bonus) * (w.low ? 0.8 : 1), got = {};
  for (const [k, a, b] of C.get) { const n = Math.round(rint(a, b) * mul); if (n > 0) { got[k] = n; SV.inv[k] = (SV.inv[k] || 0) + n; SV.dex['i' + k] = 1; } }
  const ac = Math.round(rint(C.ac[0], C.ac[1]) * mul); SV.acorn += ac;
  let cd = null; if (w.card || Math.random() < 0.4) { const fr = [0, 1, 2].filter(v => !SV.dex.c[w.c + '-' + v]); const v = fr.length ? fr[rint(0, fr.length - 1)] : rint(0, 2); cd = [w.c, v]; SV.dex.c[w.c + '-' + v] = 1; }
  SV.walk = null; SV.walks++;
  modal = { k: 'back', c: w.c, got, ac, cd, xp: C.xp, t: 0 };
  SV.full = Math.max(0, SV.full - 10); save(); sfx('ok');
}
function feed() {
  if (SV.walk) return; if (SV.acorn < FEED_COST) { say('도토리가 모자라요…'); sfx('no'); return; }
  if (SV.full >= 95) { say('배불러요!'); sfx('tap'); return; }
  SV.acorn -= FEED_COST; SV.full = Math.min(100, SV.full + 35); SV.mood = Math.min(100, SV.mood + 5); bounce = 0.5; sfx('pop');
  for (let i = 0; i < 8; i++) parts.push({ k: 'crumb', x: 205 + (Math.random() - 0.5) * 30, y: 560, vx: (Math.random() - 0.5) * 80, vy: -80 - Math.random() * 60, life: 0.8, max: 0.8, r: 3, col: '#f6d98c' });
  say(['냠냠! 맛있어요', '고마워요!', '배가 든든해요'][rint(0, 2)]); careMark('feed'); addXp(5, 205, 520); save();
}
function pat(x, y) {
  if (SV.walk) return; const cr = care(); bounce = 0.4; sfx('pat'); petT = 0.6;
  for (let i = 0; i < 3; i++) parts.push({ k: 'heart', x: x + (Math.random() - 0.5) * 40, y: y - 10, vx: (Math.random() - 0.5) * 40, vy: -60 - Math.random() * 40, life: 1.1, max: 1.1, r: 6 + Math.random() * 4, col: '#ff7f9e' });
  ring(x, y, '#ff9eae');
  SV.mood = Math.min(100, SV.mood + 4);
  if (cr.pat < PAT_MAX) { cr.pat++; SV.pats++; addXp(stage() === 0 ? 4 : 2, x, y - 40); } else if (cr.pat === PAT_MAX) { cr.pat++; say('오늘은 충분히 쓰다듬었어요. 고마워요!'); }
  careMark('pat');
  if (stage() === 0 && Math.random() < 0.5) say(['꼼지락…', '따뜻해요…', '싹이 날 것 같아요!'][rint(0, 2)]);
  save();
}
function matchRecipe(sel) { const m = {}; sel.forEach(k => m[k] = (m[k] || 0) + 1); return RECIPE.find(r => { const ks = Object.keys(r.need); return ks.length === Object.keys(m).length && ks.every(k => r.need[k] === m[k]); }) || null; }
function cook() {
  if (!cookSel.length || cookT >= 0) return; if (SV.acorn < COOK_COST) { say('도토리가 모자라요…'); sfx('no'); return; }
  SV.acorn -= COOK_COST; cookSel.forEach(k => SV.inv[k]--); cookRes = matchRecipe(cookSel) || MYSTERY; cookT = 0; sfx('bub'); save();
}
function cookDone() {
  const r = cookRes, f = r.fx, isNew = r.id !== 'x' && !SV.dex.r[r.id]; if (r.id !== 'x') SV.dex.r[r.id] = 1;
  if (f.full) SV.full = Math.min(100, SV.full + f.full); if (f.mood) SV.mood = Math.min(100, SV.mood + f.mood);
  if (f.bonus || f.fast || f.card) SV.buff = { n: r.n, bonus: f.bonus || 0, fast: f.fast || 0, card: f.card || 0 };
  SV.cooks++; careMark('cook'); modal = { k: 'dish', r, isNew, t: 0 }; cookSel = []; cookT = -1; sfx('ok'); burst(195, 300, 'spark', 22);
  addXp(10 + (f.xp || 0)); save();
}
function exchange() {
  const B = opts.bonus; if (SV.ex.d !== KDAY()) SV.ex = { d: KDAY(), n: 0 };
  if (SV.ex.n >= EX_MAX || !B || !B.spend(1)) { sfx('no'); return; }
  SV.ex.n++; SV.acorn += EX_ACORN; sfx('coin'); toastAt(300, 60, '도토리 +' + EX_ACORN, '#6b4423'); save();
}
function say(s) { bubble = { s, t: 4.5 }; }
function idleLine() {
  if (SV.walk) return ''; if (stage() === 0) return '쓰다듬어 주면 싹이 나요!';
  if (SV.full < 30) return '배고파요…'; if (SV.mood < 30) return '심심해요… 쓰다듬어 주세요';
  if (SV.wd.d !== KDAY() || SV.wd.n < WALK_MAX) return '산책 가고 싶어요!';
  return ['오늘도 고마워요', '아지트가 포근해요', '요리 냄새 좋아요', '내일 또 산책 가요!'][Math.floor(T / 6) % 4];
}

// ── DOM
function mkDom() {
  const st = document.createElement('style');
  st.textContent = '#mg-ov{position:fixed;inset:0;z-index:2147483000;background:#f3d9c0;touch-action:none;user-select:none;-webkit-user-select:none}#mg-ov canvas{position:absolute;inset:0;width:100%;height:100%;display:block}';
  document.head.appendChild(st);
  if (!document.querySelector('link[data-mgfont]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Jua&display=swap'; l.dataset.mgfont = 1; document.head.appendChild(l); }
  ov = document.createElement('div'); ov.id = 'mg-ov'; ov.hidden = true; cv = document.createElement('canvas'); ov.appendChild(cv); document.body.appendChild(ov);
  c = cv.getContext('2d');
  cv.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); const x = (e.clientX - ox) / sc, y = (e.clientY - oy) / sc; for (let i = hits.length - 1; i >= 0; i--) { const h = hits[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { h.fn(x, y); return; } } });
  addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => { if (!AU.ctx || ov.hidden) return; if (document.hidden) AU.ctx.suspend(); else AU.ctx.resume(); });
  addEventListener('keydown', e => { if (ov.hidden) return; if (e.key === 'Escape') { if (modal) modal = null; else close(); } });
}
function layout() {
  if (!cv) return; dpr = Math.min(2, window.devicePixelRatio || 1);
  const vw = innerWidth, vh = innerHeight; let px = vw * dpr * vh * dpr; if (px > 3.6e6) dpr *= Math.sqrt(3.6e6 / px);
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  sc = Math.min(vw / W, vh / H); ox = (vw - W * sc) / 2; oy = (vh - H * sc) / 2; bgCache.k = '';
}

// ── 장면
function drawSides() { // 가로 화면 양옆: 숲 그림자 + 떠다니는 잎
  const vw = cv.width / dpr, vh = cv.height / dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, vh); g.addColorStop(0, night() ? '#2b2a50' : '#cfeedd'); g.addColorStop(1, night() ? '#4a3a5e' : '#f6d9bd'); c.fillStyle = g; c.fillRect(0, 0, vw, vh);
  if (ox < 4) return;
  for (let i = 0; i < 14; i++) { const x = (i * 137 + T * 12 * (1 + i % 3)) % vw, y = (i * 211 + T * 20) % (vh + 40) - 20; c.save(); c.globalAlpha = 0.5; A.leaf(c, x, y, 18, 7, T + i, i % 2 ? '#9be07a' : '#ffc4a8', i % 2 ? '#4f9a47' : '#d0705a', 1); c.restore(); }
  for (let i = 0; i < 6; i++) A.glow(c, (i * 233) % vw, (i * 157) % vh, 60, '#ffffff', 0.25);
}
function roomBg() {
  const D = SV.deco, k = [D.wall, D.curtain, D.rug, night(), SV.extra.garland, SV.extra.frame, Object.keys(SV.dex.c)[0], cv.width, sc].join('|');
  if (bgCache.k === k) return bgCache.cv;
  const o = bgCache.cv || document.createElement('canvas'), s = sc * dpr; o.width = Math.ceil(W * s); o.height = Math.ceil(H * s);
  const g = o.getContext('2d'), keep = c; c = g; c.setTransform(s, 0, 0, s, 0, 0);
  const wp = DECO.wall.o.find(q => q[0] === D.wall)[3], cc = DECO.curtain.o.find(q => q[0] === D.curtain)[3], nt = night();
  A.room(c, W, H, 470, 0, nt, wp);
  A.window(c, 120, 140, 150, 190, 2, nt, cc);
  A.shelf(c, 16, 250, 96, 200, 1);
  if (SV.extra.frame) { // 엽서 액자
    c.save(); c.translate(300, 200); c.rotate(0.04); A.rr(c, -34, -26, 68, 54, 6); c.fillStyle = '#b07a4a'; c.fill(); c.strokeStyle = '#6e4224'; c.lineWidth = 2; c.stroke();
    c.save(); A.rr(c, -28, -20, 56, 42, 3); c.clip(); c.translate(-28, -20); const ck = Object.keys(SV.dex.c)[0] || '0-0'; const [a, b] = ck.split('-').map(Number); A.scene(c, 56, 42, a, b, 0, SV.pal); c.restore(); c.restore();
  }
  A.rug(c, 200, 600, 150, 52, DECO.rug.o.find(q => q[0] === D.rug)[3]);
  if (SV.extra.garland) { c.strokeStyle = '#6e4a3a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 96); c.quadraticCurveTo(W / 2, 150, W, 96); c.stroke(); }
  c = keep; bgCache.k = k; bgCache.cv = o; return o;
}
function drawGarland() { if (!SV.extra.garland) return; for (let i = 0; i < 11; i++) { const x = 18 + i * 32, tt = x / W, y = (1 - tt) * (1 - tt) * 96 + 2 * (1 - tt) * tt * 150 + tt * tt * 96 + 6; const on = Math.sin(T * 2 + i) > -0.3; const col = ['#ffd36b', '#ff9eae', '#9be0ff', '#a8ecc8'][i % 4]; if (on) A.glow(c, x, y, 16, col, night() ? 0.8 : 0.45); c.fillStyle = A.mix(col, '#ffffff', on ? 0.3 : 0); c.beginPath(); c.ellipse(x, y, 4, 5.5, 0, 0, TAU); c.fill(); } }
function drawMobile() { if (!SV.extra.mobile) return; c.save(); c.translate(64, 120); c.strokeStyle = '#a08070'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 0); c.moveTo(-30, 0); c.lineTo(30, 0); c.stroke(); [-30, 0, 30].forEach((x, i) => { const L = 18 + i * 8, sw = Math.sin(T * 1.5 + i) * 0.15; c.save(); c.translate(x, 0); c.rotate(sw); c.beginPath(); c.moveTo(0, 0); c.lineTo(0, L); c.stroke(); if (i === 1) { c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(0, L + 8, 8, 0.6, 5.7); c.arc(4, L + 6, 6, 5.4, 0.9, true); c.fill(); } else A.starfruit(c, 0, L + 9, 0.6); c.restore(); }); c.restore(); }

function hud() {
  const g = c.createLinearGradient(0, 0, 0, 92); g.addColorStop(0, 'rgba(255,248,238,0.97)'); g.addColorStop(1, 'rgba(255,240,226,0.94)');
  A.rr(c, 10, 10, W - 20, 84, 22); c.fillStyle = g; c.fill(); c.strokeStyle = '#e7c4a6'; c.lineWidth = 2; c.stroke();
  c.save(); A.rr(c, 20, 20, 64, 64, 18); c.fillStyle = A.mix(A.PAL[SV.pal].mid, '#ffffff', 0.6); c.fill(); c.clip(); if (SV.walk) { c.globalAlpha = 0.5; } mg(52, stage() === 0 ? 76 : 90, stage() === 3 ? 0.5 : 0.62, { t: 0.3, scarf: null, hat: null }); c.restore();
  A.rr(c, 20, 20, 64, 64, 18); c.strokeStyle = A.PAL[SV.pal].lo; c.lineWidth = 2.5; c.stroke();
  txt('몽글이', 94, 34, 19, '#4a3530'); txt('Lv.' + SV.lv + ' ' + (stage() === 3 ? BRANCH[SV.branch][0] : STAGE_N[stage()]), 158, 34, 13, '#e07a5f');
  bar(118, 52, 96, SV.mood / 100, '#ff8fa3', '기분'); bar(118, 70, 96, SV.full / 100, '#ffc15a', '배');
  pill(224, 22, 116, 28, '#fff', '#f0d2b6'); A.coinAcorn(c, 241, 38, 1); txt(SV.acorn.toLocaleString(), 258, 36.5, 16, '#6b4423'); txt('도토리', 333, 36.5, 10.5, '#a58a7a', 'right');
  const coins = opts.bonus ? opts.bonus.coins() : 0;
  pill(224, 56, 116, 28, '#fff', '#f0d2b6'); A.coin5(c, 241, 70, 0.95); txt(String(coins), 258, 70.5, 16, '#7a5a00'); txt('5락실 코인', 333, 70.5, 10.5, '#a58a7a', 'right');
  // 🔊 · ✕
  const rb = (y, draw, fn) => { c.beginPath(); c.arc(361, y, 14, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#f0d2b6'; c.lineWidth = 2; c.stroke(); c.save(); c.translate(361, y); c.strokeStyle = '#a5735a'; c.fillStyle = '#a5735a'; c.lineWidth = 2.2; c.lineCap = 'round'; draw(); c.restore(); hit(345, y - 16, 32, 32, fn); };
  rb(36, () => { c.beginPath(); c.moveTo(-7, -3); c.lineTo(-3, -3); c.lineTo(2, -7); c.lineTo(2, 7); c.lineTo(-3, 3); c.lineTo(-7, 3); c.closePath(); c.fill(); if (AU.on) { c.beginPath(); c.arc(3, 0, 6, -0.8, 0.8); c.stroke(); } else { c.beginPath(); c.moveTo(5, -4); c.lineTo(10, 4); c.moveTo(10, -4); c.lineTo(5, 4); c.stroke(); } }, () => { AU.on = !AU.on; try { localStorage.setItem('mg_snd', AU.on ? '1' : '0'); } catch (e) {} });
  rb(72, () => { c.beginPath(); c.moveTo(-5, -5); c.lineTo(5, 5); c.moveTo(5, -5); c.lineTo(-5, 5); c.stroke(); }, () => close());
}
const TABS = [['home', '아지트'], ['walk', '산책'], ['cook', '요리'], ['dex', '도감'], ['grow', '성장']];
function icon(k, x, y, on) {
  c.save(); c.translate(x, y); c.lineWidth = 2.4; c.strokeStyle = on ? '#c75b3f' : '#a58a7a'; c.fillStyle = on ? '#ffd9b8' : 'rgba(0,0,0,0)'; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
  if (k === 'home') { c.moveTo(-11, 0); c.lineTo(0, -10); c.lineTo(11, 0); c.lineTo(8, 0); c.lineTo(8, 10); c.lineTo(-8, 10); c.lineTo(-8, 0); c.closePath(); }
  if (k === 'walk') { c.ellipse(-4, 4, 5, 7, -0.3, 0, TAU); c.moveTo(11, -2); c.ellipse(6, -4, 5, 7, 0.3, 0, TAU); }
  if (k === 'cook') { c.moveTo(-11, -3); c.lineTo(11, -3); c.quadraticCurveTo(11, 10, 0, 10); c.quadraticCurveTo(-11, 10, -11, -3); c.moveTo(-14, -3); c.lineTo(14, -3); }
  if (k === 'dex') { c.moveTo(0, -7); c.quadraticCurveTo(-6, -10, -12, -8); c.lineTo(-12, 8); c.quadraticCurveTo(-6, 6, 0, 9); c.quadraticCurveTo(6, 6, 12, 8); c.lineTo(12, -8); c.quadraticCurveTo(6, -10, 0, -7); c.lineTo(0, 9); }
  if (k === 'grow') { c.moveTo(0, -11); c.lineTo(10, 0); c.lineTo(4, 0); c.lineTo(4, 10); c.lineTo(-4, 10); c.lineTo(-4, 0); c.lineTo(-10, 0); c.closePath(); }
  c.fill(); c.stroke(); c.restore();
}
function tabs() {
  A.rr(c, 10, H - 84, W - 20, 74, 26); c.fillStyle = 'rgba(255,250,243,0.97)'; c.fill(); c.strokeStyle = '#e7c4a6'; c.lineWidth = 2; c.stroke();
  TABS.forEach((t, i) => {
    const x = 10 + (W - 20) / 5 * (i + 0.5), on = t[0] === tab;
    if (on) { A.rr(c, x - 34, H - 78, 68, 62, 20); c.fillStyle = '#ffe9d6'; c.fill(); }
    icon(t[0], x, H - 56, on); txt(t[1], x, H - 30, 13, on ? '#c75b3f' : '#a58a7a', 'center');
    // 알림 점
    const dot = (t[0] === 'walk' && SV.walk && walkLeft() === 0) || (t[0] === 'home' && !care().done && stage() > 0 && !SV.walk && care().pat === 0);
    if (dot) { c.beginPath(); c.arc(x + 16, H - 66, 5, 0, TAU); c.fillStyle = '#ff6b6b'; c.fill(); }
    hit(x - 36, H - 82, 72, 70, () => { if (tab !== t[0]) { tab = t[0]; sfx('tap'); } });
  });
}

function sHome() {
  c.drawImage(roomBg(), 0, 0, W, H);
  drawGarland(); drawMobile();
  A.lamp(c, 340, 470, 1, true);
  A.plant(c, 352, 640, 0.9, T);
  A.table(c, 80, 590, 1, T);
  A.cushion(c, 215, 628, 1, DECO.cushion.o.find(q => q[0] === SV.deco.cushion)[3]);
  // 반짝이 먼지
  for (let i = 0; i < 10; i++) { const x = (i * 61 + T * 8) % W, y = 300 + ((i * 137) % 300) + Math.sin(T + i) * 6; A.glow(c, x, y, 6, '#ffe9b0', 0.6); }
  const back = SV.walk && walkLeft() === 0;
  if (!SV.walk || back) {
    const b = Math.max(0, bounce), sy = 1 - Math.sin(b * 12) * b * 0.25;
    c.save(); c.translate(212, 624); c.scale(1 / sy, sy);
    mg(0, 0, stage() === 0 ? 1.4 : 1.15, { mood: petT > 0 || back ? 'happy' : SV.mood < 30 ? 'idle' : (night() && Math.sin(T * 0.2) > 0.6 ? 'sleep' : 'idle'), bag: back, look: Math.sin(T * 0.5) * 0.6, blink: (T % 4) < 0.12 ? 1 : 0 });
    c.restore();
    hit(150, 520, 124, 120, (x, y) => { if (back) { claimWalk(); return; } pat(x, y); });
  } else {
    const C = COURSE[SV.walk.c];
    card(110, 548, 200, 56); txt('몽글이는 ' + C.n + ' 산책 중', 210, 566, 14, '#6a4a40', 'center'); txt('돌아올 때까지 ' + fmt(walkLeft()), 210, 586, 13, '#a58a7a', 'center');
  }
  // 말풍선
  const s = bubble.t > 0 ? bubble.s : back ? '다녀왔어요! 눌러 주세요' : idleLine();
  if (s) { const w = Math.min(260, tw(s, 15) + 30), x = Math.max(16, 120 - w / 2); c.save(); c.globalAlpha = bubble.t > 0 ? Math.min(1, bubble.t * 2) : 1; card(x, 466, w, 44); c.beginPath(); c.moveTo(Math.min(x + w - 20, 160), 508); c.lineTo(Math.min(x + w - 14, 174), 528); c.lineTo(Math.min(x + w - 4, 182), 508); c.fillStyle = '#fffaf3'; c.fill(); txt(s, x + w / 2, 489, 15, '#6a4a40', 'center'); c.restore(); }
  hud();
  // 오늘의 돌보기
  const cr = care(), n = ['pat', 'feed', 'walk', 'cook', 'deco'].filter(k => cr[k]).length;
  card(16, 664, W - 32, 88); txt('오늘의 돌보기', 30, 684, 15, '#6a4a40'); tag(130, 674, n + '/5', cr.done ? '#e0a030' : '#7cc3a8');
  btn(196, 670, 86, 28, '밥 주기', '#f2a96b', SV.walk ? null : feed, 14); A.coinAcorn(c, 205, 690, 0.6);
  btn(290, 670, 76, 28, '꾸미기', '#9b8ae0', () => { modal = { k: 'deco', t: 0 }; sfx('tap'); }, 14);
  [['쓰다듬기', 'pat'], ['밥', 'feed'], ['산책', 'walk'], ['요리', 'cook'], ['꾸미기', 'deco']].forEach((p, i) => { const x = 28 + i * 68, on = cr[p[1]]; pill(x, 712, 62, 28, on ? '#d9f5e6' : '#fff1e4', on ? '#8fd3b4' : '#f0c9a6'); txt(p[0] + (on ? ' ✓' : ''), x + 31, 726.5, 12, on ? '#2f7d68' : '#b0745a', 'center'); });
  if (cr.done) txt('다 했어요! 내일 또 만나요', W / 2, 760, 0.1, '#fff');
}

let mapCache = { k: '', cv: null };
function sWalk() {
  c.fillStyle = '#fff3e6'; c.fillRect(0, 0, W, H);
  const mk = cv.width + '|' + sc;
  if (mapCache.k !== mk) { const o = mapCache.cv || document.createElement('canvas'), s = sc * dpr; o.width = Math.ceil((W - 20) * s); o.height = Math.ceil(330 * s); const g = o.getContext('2d'), keep = c; c = g; c.setTransform(s, 0, 0, s, 0, 0); A.walkMap(c, W - 20, 330, 0); c = keep; mapCache = { k: mk, cv: o }; }
  c.save(); A.rr(c, 10, 104, W - 20, 330, 24); c.clip(); c.drawImage(mapCache.cv, 10, 104, W - 20, 330); c.translate(10, 104);
  COURSE.forEach((C, i) => { const lk = SV.lv < C.lv; c.globalAlpha = lk ? 0.55 : 1; A.pin(c, C.pin[0], C.pin[1] + (SV.walk && SV.walk.c === i ? Math.sin(T * 4) * 3 : 0), 1, C.col, C.n, minT(C.min / TRIAL_DIV)); c.globalAlpha = 1; });
  // 길 위의 몽글이
  let mx = 150, my = 312, wk = SV.walk, lookv = -1;
  if (wk) { const C = COURSE[wk.c], p = Math.min(1, (Date.now() - wk.s) / (wk.e - wk.s)), q = p < 0.5 ? p * 2 : (1 - p) * 2; mx = 150 + (C.pin[0] - 150) * q; my = 312 + (C.pin[1] + 6 - 312) * q - Math.abs(Math.sin(T * 6)) * 4; lookv = p < 0.5 ? Math.sign(C.pin[0] - 150) : -Math.sign(C.pin[0] - 150); if (walkLeft() === 0) { mx = 150; my = 312; } }
  if (stage() > 0) mg(mx, my, 0.5, { bag: true, hat: 'straw', look: lookv, mood: wk ? 'happy' : 'idle' });
  c.restore(); A.rr(c, 10, 104, W - 20, 330, 24); c.strokeStyle = '#efd3ba'; c.lineWidth = 3; c.stroke();
  hud();
  if (SV.wd.d !== KDAY()) SV.wd = { d: KDAY(), n: 0 };
  const left = WALK_MAX - SV.wd.n;
  if (wk) {
    const C = COURSE[wk.c], done = walkLeft() === 0, p = Math.min(1, (Date.now() - wk.s) / (wk.e - wk.s));
    card(16, 446, W - 32, 92); txt(done ? '몽글이가 돌아왔어요!' : C.n + ' 산책 중', 32, 470, 18, '#4a3530');
    if (done) btn(W - 140, 456, 110, 36, '맞이하기', '#7cc3a8', claimWalk);
    else { txt('남은 시간 ' + fmt(walkLeft()), W - 32, 470, 14, '#a58a7a', 'right'); }
    bar(32, 494, W - 64, p, C.col); txt(wk.bonus ? '요리 효과: 보상 +' + Math.round(wk.bonus * 100) + '%' + (wk.card ? ' · 엽서 꼭 받기' : '') : (wk.low ? '배고프거나 심심해서 보상이 조금 줄어요' : '화면을 꺼도 몽글이는 산책을 계속해요'), 32, 522, 12.5, '#9a7a6a');
  } else {
    txt(stage() === 0 ? '싹이 나면 산책을 갈 수 있어요' : '어디로 산책 보낼까요?', 20, 458, 20, '#4a3530');
    txt('오늘 ' + left + '번 남음' + (SV.buff ? ' · ' + SV.buff.n + ' 효과 대기' : ''), 20, 482, 12.5, '#a58a7a');
  }
  const y0 = wk ? 550 : 500, gap = wk ? 70 : 76;
  COURSE.forEach((C, i) => {
    const y = y0 + i * gap, ch = gap - 10; card(16, y, W - 32, ch);
    c.save(); A.rr(c, 26, y + 8, ch - 16, ch - 16, 14); c.fillStyle = A.mix(C.col, '#ffffff', 0.75); c.fill(); c.restore(); C.ic(c, 26 + (ch - 16) / 2, y + ch / 2);
    txt(C.n, 88, y + 21, 17, '#4a3530'); tag(88 + tw(C.n, 17) + 8, y + 11, minT(C.min / TRIAL_DIV), C.col);
    txt('얻는 것: ' + C.get.map(g => ING[g[0]][0]).join(' · ') + ' · 도토리', 88, y + ch - 18, 12, '#9a7a6a');
    if (SV.lv < C.lv) { pill(W - 118, y + ch / 2 - 16, 96, 32, '#efe4da'); txt('Lv.' + C.lv + ' 열림', W - 70, y + ch / 2, 13, '#a58a7a', 'center'); }
    else btn(W - 108, y + ch / 2 - 18, 82, 36, '보내기', ['#7cc3a8', '#f29a6b', '#6aa8e8'][i], !wk && left > 0 && stage() > 0 ? () => sendWalk(i) : null);
  });
}

function sCook() {
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#ffe9d2'); bg.addColorStop(1, '#f6c9a3'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.globalAlpha = 0.25; for (let y = 100; y < 430; y += 26) for (let x = (y / 26 % 2) * 13; x < W; x += 26) { A.rr(c, x + 1, y + 1, 24, 24, 4); c.fillStyle = '#fff'; c.fill(); } c.globalAlpha = 1;
  const ck = cookT >= 0, heat = ck ? 1 + Math.sin(T * 20) * 0.15 : 0.8;
  A.glow(c, 195, 330, 140 * heat, '#ff9a3c', ck ? 0.7 : 0.45);
  A.rr(c, 80, 330, 230, 90, 16); const sg = c.createLinearGradient(0, 330, 0, 420); sg.addColorStop(0, '#c9a58a'); sg.addColorStop(1, '#8a6650'); c.fillStyle = sg; c.fill(); c.strokeStyle = '#5a3e30'; c.lineWidth = 2; c.stroke();
  A.rr(c, 150, 372, 90, 36, 12); c.fillStyle = '#3a2420'; c.fill(); A.glow(c, 195, 392, 50, '#ffb04a', 0.8);
  for (let i = 0; i < 5; i++) { c.fillStyle = ['#ffd36b', '#ff8a3c', '#ffb04a'][i % 3]; c.beginPath(); const fx = 165 + i * 15, fh = 18 + Math.sin(T * 9 + i * 2) * 5 * heat; c.moveTo(fx - 6, 404); c.quadraticCurveTo(fx, 404 - fh * 1.3, fx + 6, 404); c.fill(); }
  const shake = ck ? Math.sin(T * 30) * 2 : 0;
  c.save(); c.translate(195 + shake, 300);
  c.beginPath(); c.moveTo(-70, 0); c.lineTo(-62, 52); c.quadraticCurveTo(0, 66, 62, 52); c.lineTo(70, 0); c.closePath();
  const pg = c.createLinearGradient(-70, 0, 70, 0); pg.addColorStop(0, '#f6a07a'); pg.addColorStop(0.45, '#e2603f'); pg.addColorStop(1, '#9c3424'); c.fillStyle = pg; c.fill(); c.strokeStyle = '#5e1e14'; c.lineWidth = 2.4; c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)'; A.rr(c, -58, 10, 10, 34, 5); c.fill();
  c.beginPath(); c.ellipse(0, 0, 72, 16, 0, 0, TAU); c.fillStyle = ck ? A.mix('#f2c47a', cookRes.id === 'x' ? '#8a8a6a' : '#ff9a7a', Math.min(1, cookT)) : '#f2c47a'; c.fill(); c.strokeStyle = '#5e1e14'; c.stroke();
  const sp = c.createRadialGradient(-20, -4, 2, 0, 0, 70); sp.addColorStop(0, 'rgba(255,255,255,0.55)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = sp; c.fill();
  [-78, 78].forEach(x => { A.rr(c, x - 10, 4, 20, 10, 5); c.fillStyle = '#5e1e14'; c.fill(); });
  cookSel.forEach((k, i) => { const a = T * (ck ? 6 : 1) + i * 2.1, r = ck ? 30 * (1 - Math.min(1, cookT)) : 30; ING[k][1](c, Math.cos(a) * r, -2 + Math.sin(a) * 5, 0.55); });
  if (ck) { c.strokeStyle = '#a5735a'; c.lineWidth = 5; c.lineCap = 'round'; const a = T * 6; c.beginPath(); c.moveTo(Math.cos(a) * 26, Math.sin(a) * 6); c.lineTo(Math.cos(a) * 26 + 34, -60); c.stroke(); }
  c.restore(); A.steam(c, 195, 278, ck ? 2 : 1.4, T);
  if (ck && Math.random() < 0.3) parts.push({ k: 'bub', x: 150 + Math.random() * 90, y: 300, vx: 0, vy: -50, life: 0.6, max: 0.6, r: 3 + Math.random() * 4, col: '#fff' });
  if (stage() > 0 && !SV.walk) mg(330, 430, 0.8, { mood: ck ? 'happy' : 'idle', hat: 'straw', look: -1 });
  hud();
  card(16, 446, W - 32, 152); txt('재료 넣기 (최대 3개)', 32, 468, 15, '#6a4a40'); txt('냄비 속 재료를 누르면 빼요', W - 32, 468, 11.5, '#a58a7a', 'right');
  INGK.forEach((k, i) => {
    const x = 26 + i * 68, n = (SV.inv[k] || 0) - cookSel.filter(q => q === k).length, sel = cookSel.includes(k);
    A.rr(c, x, 484, 62, 102, 16); c.fillStyle = sel ? '#ffe9d6' : '#fff'; c.fill(); c.strokeStyle = sel ? '#f29a6b' : '#efd3ba'; c.lineWidth = sel ? 3 : 2; c.stroke();
    c.globalAlpha = n > 0 ? 1 : 0.35; ING[k][1](c, x + 31, 528, 1); c.globalAlpha = 1;
    txt(ING[k][0], x + 31, 566, 13, '#6a4a40', 'center'); txt('x' + Math.max(0, n), x + 55, 496, 11, '#a58a7a', 'right');
    hit(x, 484, 62, 102, () => { if (ck) return; if (n > 0 && cookSel.length < 3) { cookSel.push(k); sfx('pop'); ring(195, 300, '#ffd36b'); } else sfx('no'); });
  });
  hit(125, 270, 140, 50, () => { if (!ck && cookSel.length) { cookSel.pop(); sfx('tap'); } });
  card(16, 610, W - 32, 100);
  const r = cookSel.length ? matchRecipe(cookSel) : null, known = r && SV.dex.r[r.id];
  if (!cookSel.length) { txt('재료를 골라 냄비에 넣어 보세요', 32, 634, 16, '#4a3530'); txt('찾은 요리 ' + Object.keys(SV.dex.r).length + '/' + RECIPE.length + ' · 힌트는 도감에서', 32, 658, 12.5, '#9a7a6a'); }
  else if (known) { A.dish(c, 58, 650, 0.9, r.d, T); txt(r.n, 100, 634, 17, '#4a3530'); txt(r.desc, 100, 658, 12, '#9a7a6a'); }
  else { c.beginPath(); c.arc(58, 646, 22, 0, TAU); c.fillStyle = '#f3e3d3'; c.fill(); txt('?', 58, 647, 24, '#c7a58a', 'center'); txt('어떤 요리가 될까요?', 100, 634, 17, '#4a3530'); txt('처음 보는 조합이면 새 요리를 찾을지도!', 100, 658, 12, '#9a7a6a'); }
  btn(32, 672, 80, 30, '비우기', '#c9b3a2', cookSel.length && !ck ? () => { cookSel = []; sfx('tap'); } : null, 14);
  btn(122, 672, 236, 30, ck ? '보글보글…' : '요리하기 (도토리 ' + COOK_COST + ')', '#f29a6b', cookSel.length && !ck ? cook : null, 15);
}

function cardThumb(a, b, w, h) {
  const k = a + '-' + b + '-' + w + '-' + h + '-' + sc + '-' + SV.pal; if (cardCache[k]) return cardCache[k];
  const o = document.createElement('canvas'), s = sc * dpr; o.width = Math.ceil(w * s); o.height = Math.ceil(h * s); const g = o.getContext('2d'), keep = c; c = g; c.setTransform(s, 0, 0, s, 0, 0); A.scene(c, w, h, a, b, 1, SV.pal); c = keep; cardCache[k] = o; return o;
}
function sDex() {
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#fff6ec'); bg.addColorStop(1, '#ffe6d2'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  hud();
  txt('몽글 도감', 20, 122, 22, '#4a3530'); txt(dexN() + ' / ' + dexMax, W - 20, 122, 15, '#c75b3f', 'right');
  bar(20, 138, W - 40, dexN() / dexMax, '#9b8ae0');
  [['i', '재료'], ['r', '요리'], ['c', '엽서']].forEach((t, i) => { const x = 20 + i * 118, on = dexTab === t[0]; pill(x, 160, 110, 32, on ? '#f29a6b' : '#fff', on ? null : '#efd3ba'); txt(t[1], x + 55, 176.5, 15, on ? '#fff' : '#a5735a', 'center'); hit(x, 160, 110, 32, () => { dexTab = t[0]; sfx('tap'); }); });
  if (dexTab === 'i') {
    INGK.forEach((k, i) => { const y = 206 + i * 104; card(16, y, W - 32, 94); const ok = SV.dex['i' + k] || SV.inv[k] > 0;
      c.save(); A.rr(c, 28, y + 12, 70, 70, 16); c.fillStyle = '#fff1e4'; c.fill(); c.restore(); if (!ok) c.globalAlpha = 0.25; ING[k][1](c, 63, y + 47, 1.3); c.globalAlpha = 1;
      txt(ok ? ING[k][0] : '???', 112, y + 30, 18, '#4a3530'); txt('갖고 있는 수 ' + (SV.inv[k] || 0), W - 32, y + 30, 13, '#a58a7a', 'right'); txt('나는 곳: ' + ING[k][2], 112, y + 60, 13, '#9a7a6a'); });
  } else if (dexTab === 'r') {
    RECIPE.forEach((r, i) => { const col = i % 2, row = (i / 2) | 0, x = 16 + col * 182, y = 206 + row * 172, ok = SV.dex.r[r.id]; card(x, y, 176, 162);
      if (ok) { A.dish(c, x + 88, y + 56, 1.1, r.d, T); txt(r.n, x + 88, y + 104, 15, '#4a3530', 'center'); wrap(r.desc, x + 88, y + 126, 150, 11, '#9a7a6a', 15, 'center'); }
      else { c.beginPath(); c.arc(x + 88, y + 54, 30, 0, TAU); c.fillStyle = '#f3e3d3'; c.fill(); txt('?', x + 88, y + 56, 30, '#c7a58a', 'center'); txt('아직 몰라요', x + 88, y + 104, 15, '#a58a7a', 'center'); wrap('힌트: ' + r.hint, x + 88, y + 126, 150, 11, '#c7895a', 15, 'center'); } });
  } else {
    for (let a = 0; a < 3; a++) { txt(COURSE[a].n, 24, 216 + a * 174, 15, '#6a4a40'); for (let b = 0; b < 3; b++) { const x = 16 + b * 122, y = 230 + a * 174, ok = SV.dex.c[a + '-' + b];
      A.rr(c, x, y + 3, 114, 142, 12); c.fillStyle = 'rgba(150,100,70,0.18)'; c.fill(); A.rr(c, x, y, 114, 142, 12); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = '#efd3ba'; c.lineWidth = 2; c.stroke();
      if (ok) { c.drawImage(cardThumb(a, b, 102, 100), x + 6, y + 6, 102, 100); txt(CARDS[a][b][0], x + 57, y + 124, 13, '#4a3530', 'center'); hit(x, y, 114, 142, () => { modal = { k: 'card', a, b, t: 0 }; sfx('tap'); }); }
      else { A.rr(c, x + 6, y + 6, 102, 100, 8); c.fillStyle = A.mix(COURSE[a].col, '#ffffff', 0.8); c.fill(); txt('?', x + 57, y + 58, 34, A.mix(COURSE[a].col, '#ffffff', 0.4), 'center'); txt('산책에서 받아요', x + 57, y + 124, 12, '#a58a7a', 'center'); } } }
  }
}

function sGrow() {
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#eaf7ff'); bg.addColorStop(1, '#fff1e4'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) A.glow(c, (i * 83 + T * 5) % W, 110 + (i * 131) % 300, 8, '#ffffff', 0.4);
  hud();
  // 몽글이 + 단의 빛
  A.glow(c, 110, 260, 90, '#fff4c8', 0.6);
  c.beginPath(); c.ellipse(110, 286, 70, 16, 0, 0, TAU); const pg = c.createLinearGradient(0, 270, 0, 300); pg.addColorStop(0, '#d9f0c8'); pg.addColorStop(1, '#9fcf8a'); c.fillStyle = pg; c.fill(); c.strokeStyle = '#6fa860'; c.lineWidth = 2; c.stroke();
  if (!SV.walk) mg(110, 284, stage() === 0 ? 1.3 : 1.05, { mood: 'happy', look: 0.4 }); else { txt('산책 중…', 110, 250, 16, '#a58a7a', 'center'); }
  const st = stage();
  txt('Lv.' + SV.lv, 200, 140, 26, '#4a3530', 'left', 'Black Han Sans'); txt(st === 3 ? BRANCH[SV.branch][0] : STAGE_N[st], 270, 141, 16, '#e07a5f');
  bar(206, 166, 160, SV.xp / need(SV.lv), '#9b8ae0'); txt(SV.xp + ' / ' + need(SV.lv) + ' 경험치', 366, 188, 11.5, '#9a7a6a', 'right');
  txt(st < 3 ? '다음 모습: ' + STAGE_N[st + 1] + ' (Lv.' + STAGE_LV[st + 1] + ')' : BRANCH[SV.branch][1], 200, 212, 12.5, '#6a4a40');
  if (st === 2) txt('가장 많이 한 일로 어른 모습이 정해져요', 200, 232, 11, '#a58a7a');
  const P = SV.walks * 3, Wi = dexN() * 4, He = SV.pats / 2, mx = Math.max(10, P, Wi, He);
  [['힘 · 산책', P, '#f2a96b'], ['지혜 · 도감', Wi, '#6aa8e8'], ['마음 · 돌보기', He, '#ff8fa3']].forEach((q, i) => { txt(q[0], 200, 260 + i * 20, 11.5, '#6a4a40'); bar(276, 254 + i * 20, 90, q[1] / mx, q[2]); });
  // 코인 → 도토리
  if (SV.ex.d !== KDAY()) SV.ex = { d: KDAY(), n: 0 };
  const coins = opts.bonus ? opts.bonus.coins() : 0, exl = EX_MAX - SV.ex.n;
  card(16, 324, W - 32, 76); A.coin5(c, 40, 352, 1.1); txt('→', 60, 352, 16, '#a58a7a'); A.coinAcorn(c, 86, 354, 1.1);
  txt('5락실 코인 1개 → 도토리 ' + EX_ACORN, 104, 348, 15, '#4a3530'); txt('오늘 ' + exl + '번 남음 · 코인은 출석·미션으로 무료', 32, 382, 11.5, '#9a7a6a');
  btn(W - 112, 336, 84, 32, '바꾸기', '#e0a030', exl > 0 && coins > 0 ? exchange : null, 15);
  // 몽글이 색 (5락실 코인)
  card(16, 412, W - 32, 150); txt('몽글이 색', 32, 434, 15, '#6a4a40'); txt('5락실 코인 · 겉모습만 바뀌어요', W - 32, 434, 11.5, '#a58a7a', 'right');
  PALS.forEach((p, i) => { const x = 28 + i * 86, own = SV.palOwn[p[0]], on = SV.pal === p[0];
    A.rr(c, x, 448, 78, 104, 16); c.fillStyle = on ? '#ffe9d6' : '#fff'; c.fill(); c.strokeStyle = on ? '#f29a6b' : '#efd3ba'; c.lineWidth = on ? 3 : 2; c.stroke();
    A.mongle(c, x + 39, 508, 0.5, { stage: Math.max(1, Math.min(2, st)), pal: p[0], t: T + i, mood: on ? 'happy' : 'idle' });
    txt(on ? '사용 중' : own ? p[1] : '', x + 39, 530, 12, on ? '#c75b3f' : '#6a4a40', 'center');
    if (!own) { A.coin5(c, x + 26, 532, 0.7); txt(String(p[2]), x + 38, 532.5, 13, '#7a5a00'); }
    hit(x, 448, 78, 104, () => { if (own) { SV.pal = p[0]; sfx('tap'); save(); bgCache.k = ''; return; } const B = opts.bonus; if (B && B.coins() >= p[2] && B.spend(p[2])) { SV.palOwn[p[0]] = 1; SV.pal = p[0]; sfx('ok'); burst(x + 39, 500, 'spark', 14); save(); } else { sfx('no'); say('5락실 코인이 ' + p[2] + '개 필요해요'); tab = 'home'; } }); });
  // 옷 (도토리)
  card(16, 574, W - 32, 92); txt('몽글이 옷', 32, 596, 15, '#6a4a40'); txt('도토리로 사요 · 눌러서 입기/벗기', W - 32, 596, 11.5, '#a58a7a', 'right');
  WEAR.forEach((w, i) => { const x = 28 + i * 172, own = SV.wear[w[0]], on = SV.wearOn[w[0]];
    A.rr(c, x, 610, 162, 46, 14); c.fillStyle = on ? '#ffe9d6' : '#fff'; c.fill(); c.strokeStyle = on ? '#f29a6b' : '#efd3ba'; c.lineWidth = on ? 3 : 2; c.stroke();
    A.mongle(c, x + 28, 652, 0.36, { stage: 2, pal: SV.pal, t: 0, scarf: w[0] === 'scarf' ? '#ff8f6b' : null, hat: w[0] === 'hat' ? 'straw' : null });
    txt(w[1], x + 56, 626, 14, '#4a3530'); if (own) txt(on ? '입는 중' : '벗음', x + 56, 644, 12, on ? '#c75b3f' : '#a58a7a'); else { A.coinAcorn(c, x + 64, 646, 0.55); txt(String(w[2]), x + 74, 644, 12.5, '#6b4423'); }
    hit(x, 610, 162, 46, () => { if (own) { SV.wearOn[w[0]] = !on; sfx('tap'); save(); return; } if (SV.acorn >= w[2]) { SV.acorn -= w[2]; SV.wear[w[0]] = 1; SV.wearOn[w[0]] = true; careMark('deco'); sfx('ok'); burst(x + 28, 630, 'spark', 12); save(); } else { sfx('no'); } }); });
  txt('기록은 이 기기에만 저장돼요', W / 2, 690, 12, '#b49a8a', 'center');
  txt('현금 결제·뽑기·거래는 없어요', W / 2, 708, 12, '#b49a8a', 'center');
}

// ── 창(모달)
function mBox(h, title) { c.fillStyle = 'rgba(60,35,30,0.45)'; c.fillRect(0, 0, W, H); hit(0, 0, W, H, () => {}); const y = (H - h) / 2, a = Math.min(1, modal.t * 5), s = 0.9 + 0.1 * a; c.save(); c.translate(W / 2, H / 2); c.scale(s, s); c.translate(-W / 2, -H / 2); card(20, y, W - 40, h); if (title) txt(title, W / 2, y + 30, 20, '#4a3530', 'center'); c.restore(); return y; }
function sModal() {
  const m = modal; if (!m) return;
  if (m.k === 'back') {
    const y = mBox(560, '몽글이가 돌아왔어요!');
    if (m.cd) { c.save(); A.rr(c, 40, y + 52, W - 80, 220, 12); c.fillStyle = '#fff'; c.fill(); c.clip(); c.drawImage(cardThumb(m.cd[0], m.cd[1], W - 92, 208), 46, y + 58, W - 92, 208); c.restore(); A.rr(c, 40, y + 52, W - 80, 220, 12); c.strokeStyle = '#e7c4a6'; c.lineWidth = 2; c.stroke(); tag(52, y + 62, '새 엽서', '#e07a5f');
      txt('「' + CARDS[m.cd[0]][m.cd[1]][0] + '」', W / 2, y + 294, 17, '#4a3530', 'center'); wrap(CARDS[m.cd[0]][m.cd[1]][1], W / 2, y + 320, W - 100, 13.5, '#7a5a50', 20, 'center'); }
    else { c.save(); c.translate(W / 2, y + 190); A.glow(c, 0, -40, 110, '#fff4c8', 0.6); c.restore(); mg(W / 2, y + 230, 1.2, { mood: 'happy', bag: true }); txt(COURSE[m.c].n + '에서 즐겁게 놀았대요', W / 2, y + 290, 15, '#7a5a50', 'center'); }
    txt('가져온 것', 44, y + 384, 15, '#6a4a40');
    const items = Object.entries(m.got); let x = 44;
    items.forEach(([k, n]) => { A.rr(c, x, y + 400, 70, 70, 14); c.fillStyle = '#fff1e4'; c.fill(); ING[k][1](c, x + 35, y + 430, 0.95); txt(ING[k][0] + ' ' + n, x + 35, y + 460, 12, '#6a4a40', 'center'); x += 76; });
    A.rr(c, x, y + 400, 70, 70, 14); c.fillStyle = '#fff1e4'; c.fill(); A.coinAcorn(c, x + 35, y + 434, 1.2); txt('+' + m.ac, x + 35, y + 460, 12, '#6b4423', 'center');
    btn(W / 2 - 90, y + 494, 180, 42, '고마워, 몽글아!', '#7cc3a8', () => { modal = null; addXp(m.xp, 195, 300); SV.acorn += 0; save(); bgCache.k = ''; tab = tab === 'walk' ? 'walk' : 'home'; burst(205, 560, 'spark', 16); });
  } else if (m.k === 'dish') {
    const y = mBox(380, m.isNew ? '새 요리를 찾았어요!' : '요리 완성!');
    c.save(); c.translate(W / 2, y + 140); c.rotate(T * 0.5); for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.fillStyle = 'rgba(255,220,140,0.22)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-10, -110); c.lineTo(10, -110); c.fill(); } c.restore();
    A.glow(c, W / 2, y + 140, 80, '#fff2a0', 0.6); A.dish(c, W / 2, y + 150, 2, m.r.d, T);
    txt(m.r.n, W / 2, y + 236, 22, '#4a3530', 'center'); wrap(m.r.desc, W / 2, y + 266, W - 100, 14, '#9a7a6a', 20, 'center');
    btn(W / 2 - 80, y + 312, 160, 42, '냠냠!', '#f29a6b', () => { modal = null; });
  } else if (m.k === 'evolve') {
    const y = mBox(420, '');
    const a = Math.min(1, m.t / 1.2);
    c.save(); c.translate(W / 2, y + 180); c.rotate(T * 0.7); for (let i = 0; i < 14; i++) { c.rotate(TAU / 14); c.fillStyle = 'rgba(255,230,150,' + (0.3 * a) + ')'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-12, -150); c.lineTo(12, -150); c.fill(); } c.restore();
    A.glow(c, W / 2, y + 170, 120, '#fff6c8', 0.8 * a);
    if (m.t < 1) { c.save(); c.globalAlpha = 1 - a; A.mongle(c, W / 2, y + 230, 1.2, { stage: m.st - 1, pal: SV.pal, t: T }); c.restore(); c.save(); c.globalAlpha = a; mg(W / 2, y + 230, 1.2, { mood: 'happy' }); c.restore(); if (Math.random() < 0.5) burst(W / 2, y + 190, 'spark', 1); }
    else mg(W / 2, y + 230, 1.2, { mood: 'happy' });
    txt(m.st === 3 ? BRANCH[SV.branch][0] + '(으)로 자랐어요!' : STAGE_N[m.st] + '(으)로 자랐어요!', W / 2, y + 290, 22, '#4a3530', 'center');
    txt(m.st === 3 ? BRANCH[SV.branch][1] : m.st === 1 ? '이제 산책을 갈 수 있어요' : '더 먼 곳까지 산책할 수 있어요', W / 2, y + 322, 14, '#9a7a6a', 'center');
    if (m.t > 1) btn(W / 2 - 80, y + 350, 160, 42, '와아!', '#9b8ae0', () => { modal = null; });
  } else if (m.k === 'card') {
    const y = mBox(470, CARDS[m.a][m.b][0]);
    c.save(); A.rr(c, 40, y + 54, W - 80, 260, 12); c.clip(); c.drawImage(cardThumb(m.a, m.b, W - 80, 260), 40, y + 54, W - 80, 260); c.restore();
    txt(COURSE[m.a].n + '에서 보낸 엽서', W / 2, y + 336, 13, '#c7895a', 'center'); wrap(CARDS[m.a][m.b][1], W / 2, y + 362, W - 100, 14, '#7a5a50', 21, 'center');
    btn(W / 2 - 70, y + 412, 140, 40, '닫기', '#c9b3a2', () => { modal = null; });
  } else if (m.k === 'intro') {
    const y = mBox(470, '숲에서 씨앗을 주웠어요');
    A.glow(c, W / 2, y + 170, 100, '#fff4c8', 0.7); A.mongle(c, W / 2, y + 220, 1.6, { stage: 0, t: T, pal: SV.pal });
    wrap('따뜻한 아지트에 심고 쓰다듬어 주면 싹이 트고, 몽글이로 자라요. 매일 조금씩 돌보고 산책 보내 주세요.', W / 2, y + 268, W - 100, 14.5, '#7a5a50', 22, 'center');
    btn(W / 2 - 90, y + 384, 180, 44, '아지트에 심기', '#7cc3a8', () => { modal = null; SV.born = Date.now(); save(); sfx('ok'); burst(212, 600, 'spark', 20); say('쓰다듬어 주면 싹이 나요!'); });
  } else if (m.k === 'deco') sDeco();
}
function sDeco() {
  const y = mBox(520, '아지트 꾸미기');
  txt('도토리로 사요 · 산 건 언제든 바꿀 수 있어요', W / 2, y + 54, 12, '#a58a7a', 'center');
  DECOK.forEach((k, i) => { const x = 32 + i * 82, on = decoCat === k; pill(x, y + 70, 76, 30, on ? '#f29a6b' : '#fff', on ? null : '#efd3ba'); txt(DECO[k].n, x + 38, y + 85.5, 14, on ? '#fff' : '#a5735a', 'center'); hit(x, y + 70, 76, 30, () => { decoCat = k; sfx('tap'); }); });
  const D = DECO[decoCat];
  D.o.forEach((o, i) => { const x = 36 + (i % 2) * 162, yy = y + 112 + ((i / 2) | 0) * 104, own = o[2] === 0 || SV.decoOwn[decoCat + ':' + o[0]], on = SV.deco[decoCat] === o[0];
    A.rr(c, x, yy, 154, 96, 16); c.fillStyle = on ? '#ffe9d6' : '#fff'; c.fill(); c.strokeStyle = on ? '#f29a6b' : '#efd3ba'; c.lineWidth = on ? 3 : 2; c.stroke();
    // 견본
    c.save(); c.translate(x + 40, yy + 48);
    if (decoCat === 'wall') { A.rr(c, -26, -30, 52, 60, 8); const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, o[3].a); g.addColorStop(1, o[3].b); c.fillStyle = g; c.fill(); c.fillStyle = o[3].dot; for (let j = 0; j < 4; j++) { c.beginPath(); c.arc(-12 + (j % 2) * 24, -14 + ((j / 2) | 0) * 26, 3, 0, TAU); c.fill(); } c.strokeStyle = '#d9b89a'; c.lineWidth = 1.5; c.stroke(); }
    else if (decoCat === 'curtain') { for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * 4, -30); c.lineTo(sx * 24, -30); c.quadraticCurveTo(sx * 16, 0, sx * 26, 30); c.lineTo(sx * 4, 30); c.closePath(); const g = c.createLinearGradient(-20, 0, 20, 0); g.addColorStop(0, o[3][0]); g.addColorStop(0.5, o[3][1]); g.addColorStop(1, o[3][2]); c.fillStyle = g; c.fill(); c.strokeStyle = o[3][3]; c.lineWidth = 1.5; c.stroke(); } }
    else if (decoCat === 'rug') A.rug(c, 0, 4, 32, 16, o[3]);
    else A.cushion(c, 0, 6, 0.5, o[3]);
    c.restore();
    txt(o[1], x + 84, yy + 36, 15, '#4a3530');
    if (on) txt('사용 중', x + 84, yy + 62, 12.5, '#c75b3f'); else if (own) txt('고르기', x + 84, yy + 62, 12.5, '#7cc3a8'); else { A.coinAcorn(c, x + 92, yy + 66, 0.6); txt(String(o[2]), x + 104, yy + 63, 13, '#6b4423'); }
    hit(x, yy, 154, 96, () => buyDeco(decoCat, o)); });
  txt('소품', 40, y + 330, 15, '#6a4a40');
  EXTRA.forEach((e, i) => { const x = 36 + i * 108, yy = y + 346, own = SV.decoOwn['x:' + e[0]], on = SV.extra[e[0]];
    A.rr(c, x, yy, 100, 70, 14); c.fillStyle = on ? '#ffe9d6' : '#fff'; c.fill(); c.strokeStyle = on ? '#f29a6b' : '#efd3ba'; c.lineWidth = on ? 3 : 2; c.stroke();
    txt(e[1], x + 50, yy + 24, 14, '#4a3530', 'center');
    if (own) txt(on ? '켜짐' : '꺼짐', x + 50, yy + 48, 12.5, on ? '#c75b3f' : '#a58a7a', 'center'); else { A.coinAcorn(c, x + 40, yy + 52, 0.6); txt(String(e[2]), x + 52, yy + 49, 13, '#6b4423'); }
    hit(x, yy, 100, 70, () => { if (own) { SV.extra[e[0]] = !on; sfx('tap'); } else if (SV.acorn >= e[2]) { SV.acorn -= e[2]; SV.decoOwn['x:' + e[0]] = 1; SV.extra[e[0]] = true; sfx('ok'); careMark('deco'); } else { sfx('no'); return; } bgCache.k = ''; save(); }); });
  btn(W / 2 - 70, y + 446, 140, 42, '다 꾸몄어요', '#9b8ae0', () => { modal = null; tab = 'home'; });
}
function buyDeco(cat, o) {
  const key = cat + ':' + o[0], own = o[2] === 0 || SV.decoOwn[key];
  if (!own) { if (SV.acorn < o[2]) { sfx('no'); return; } SV.acorn -= o[2]; SV.decoOwn[key] = 1; sfx('ok'); } else sfx('tap');
  if (SV.deco[cat] !== o[0]) careMark('deco');
  SV.deco[cat] = o[0]; bgCache.k = ''; save();
}

// ── 입자
function drawParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    const a = Math.min(1, p.life / p.max * 1.5);
    if (p.k === 'ring') { const r = (1 - p.life / p.max) * 60; c.strokeStyle = A.rgba(p.col, a * 0.8); c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, r, 0, TAU); c.stroke(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 'spark' || p.k === 'crumb') p.vy += 200 * dt;
    c.save(); c.globalAlpha = a;
    if (p.k === 'txt') { c.font = '16px Jua, sans-serif'; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#fff'; c.strokeText(p.s, p.x, p.y); c.fillStyle = p.col; c.fillText(p.s, p.x, p.y); }
    else if (p.k === 'heart') { heartPath(p.x, p.y, p.r); const g = c.createLinearGradient(p.x, p.y - p.r, p.x, p.y + p.r); g.addColorStop(0, '#ffc0d0'); g.addColorStop(1, p.col); c.fillStyle = g; c.fill(); c.strokeStyle = '#d04a6a'; c.lineWidth = 1.2; c.stroke(); }
    else if (p.k === 'spark') { c.translate(p.x, p.y); c.rotate(p.life * 6); c.fillStyle = p.col; c.beginPath(); for (let j = 0; j < 8; j++) { const r = j % 2 ? p.r * 0.35 : p.r; c.lineTo(Math.cos(j * Math.PI / 4) * r, Math.sin(j * Math.PI / 4) * r); } c.fill(); }
    else if (p.k === 'bub') { c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke(); }
    else { c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }
    c.restore();
  }
}

// ── 루프
let tickAcc = 0;
function frame(dt) {
  T += dt; if (bubble.t > 0) bubble.t -= dt; if (bounce > 0) bounce -= dt; if (petT > 0) petT -= dt; if (flash > 0) flash -= dt; if (modal) modal.t += dt;
  tickAcc += dt; if (tickAcc > 1) { tickAcc = 0; decay(); }
  if (cookT >= 0) { cookT += dt; if (cookT > 1.8) cookDone(); }
  hits = [];
  drawSides();
  c.setTransform(dpr * sc, 0, 0, dpr * sc, ox * dpr, oy * dpr);
  c.save(); c.beginPath(); c.rect(0, 0, W, H); c.clip();
  if (tab === 'home') sHome(); else if (tab === 'walk') sWalk(); else if (tab === 'cook') sCook(); else if (tab === 'dex') sDex(); else sGrow();
  if (tab !== 'home' && tab !== 'cook' && !SV.walk) { /* 다른 탭에서는 캐릭터를 따로 그림 */ }
  tabs();
  drawParts(dt);
  sModal();
  if (flash > 0) { c.fillStyle = 'rgba(255,250,220,' + flash * 0.6 + ')'; c.fillRect(0, 0, W, H); }
  c.restore();
}
function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; bgm(); frame(dt); }
function fs() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return; const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return; try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(layout).catch(() => {}); } catch (e) {} }
function open() {
  load(); decay(); care(); ov.hidden = false; document.documentElement.style.overflow = 'hidden'; layout(); audioInit(); if (!DEBUG) fs();
  tab = 'home'; modal = SV.born ? null : { k: 'intro', t: 0 }; parts = []; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  if (A.on3d) A.on3d(() => { bgCache.k = ''; mapCache.k = ''; for (const k in cardCache) delete cardCache[k]; }); // 3D 몸 그림이 늦게 오면 캐시 다시 그리기
  if (document.fonts && document.fonts.load) document.fonts.load('16px Jua').then(() => { bgCache.k = ''; mapCache.k = ''; for (const k in cardCache) delete cardCache[k]; }).catch(() => {});
}
function close() { cancelAnimationFrame(raf); save(); ov.hidden = true; document.documentElement.style.overflow = ''; if (AU.ctx) AU.ctx.suspend(); const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} } if (opts.onExit) opts.onExit({ lv: SV.lv, stage: STAGE_N[stage()], walk: !!SV.walk }); }

window.MongleGame = {
  boot(o) {
    opts = o || {}; if (!ov) mkDom();
    if (DEBUG) window.__mg = { open, close, SV: () => SV, set(f) { Object.assign(SV, f); save(); bgCache.k = ''; }, tab(t) { tab = t; }, modal(m) { modal = m; if (m) m.t = 5; }, fast() { if (SV.walk) SV.walk.e = Date.now(); }, give(n) { SV.acorn += n || 500; INGK.forEach(k => SV.inv[k] = (SV.inv[k] || 0) + 5); save(); }, xp: addXp, frame: () => frame(0.016), T: v => { T = v; }, pat, feed, sendWalk, claimWalk, cook: sel => { cookSel = sel; cook(); }, cookDone, layout, reset() { localStorage.removeItem('mg_save_v1'); load(); } };
    return { open };
  },
};
})();
