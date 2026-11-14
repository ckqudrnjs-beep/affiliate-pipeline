// 몽글숲 아지트 — 그림 모음. 몽글이 몸은 3D 렌더 아틀라스(/img/mongle/mongle3d.webp), 나머지는 코드로 그림
// 모든 함수는 (ctx, x, y, s, opt) 형태. s = 배율(1 = 기본 크기 약 100px)
(function (W) {
  'use strict';
  const TAU = Math.PI * 2;
  const A = {};

  // 색 도우미
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; }
  function rgba(h, a) { const x = hex(h); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }
  A.mix = mix; A.rgba = rgba;

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  A.rr = rr;
  function glow(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  A.glow = glow;

  // ── 몽글이 색 테마 (성장 갈래·꾸미기 색)
  A.PAL = {
    mint:  { hi: '#f4fff6', mid: '#a8ecc8', lo: '#5fbf98', line: '#2f7d68', belly: '#fffbe9', leaf: '#7fd36a', leafLo: '#3f9a47' },
    peach: { hi: '#fff6ef', mid: '#ffc4a8', lo: '#ee8f78', line: '#a5524a', belly: '#fff6e6', leaf: '#ffb35c', leafLo: '#d1712c' },
    sky:   { hi: '#f4fbff', mid: '#b4dcff', lo: '#6fa6e8', line: '#3b5f9e', belly: '#fffaf0', leaf: '#9be0ff', leafLo: '#4b9fd1' },
    lilac: { hi: '#fbf5ff', mid: '#d9c2ff', lo: '#9f80e6', line: '#5b4596', belly: '#fff8f2', leaf: '#ff9ccf', leafLo: '#c45a92' },
  };

  // ── 몽글이: stage 0 씨앗 · 1 새싹 · 2 꼬마 · 3 어른(갈래 branch: 'power'|'wise'|'heart')
  // opt: {pal, stage, branch, t(시간), blink, look(-1..1), mood('happy'|'idle'|'sleep'), hat, scarf, bag}
  // ── 3D 렌더 몸 아틀라스 (원본 src3d/chars/render.html renderMongle, 칸 400x420, 1단위=3px, 기준점 200,395)
  const M3 = { img: null, ok: false, pals: ['mint', 'peach', 'sky', 'lilac'], cb: [] };
  try { const im = new Image(); im.onload = () => { M3.ok = true; M3.cb.forEach(f => { try { f(); } catch (e) {} }); }; im.src = '/img/mongle/mongle3d.webp?v=1'; M3.img = im; } catch (e) {}
  function draw3d(c, S, pal, st, br) {
    if (!M3.ok) return false; const r = M3.pals.indexOf(pal); if (r < 0 || st < 1) return false;
    const col = st === 1 ? 0 : st === 2 ? 1 : br === 'power' ? 2 : br === 'wise' ? 3 : 4;
    c.drawImage(M3.img, col * 400, r * 420, 400, 420, -200 / 3 * S, -395 / 3 * S, 400 / 3 * S, 420 / 3 * S);
    if (st === 3 && br === 'wise') glow(c, 0, -(st === 3 ? 74 : 66) * S - 18 * S, 22 * S, '#fff0a0', 0.4);
    return true;
  }
  A.ready3d = () => M3.ok;
  A.on3d = f => { if (M3.ok) f(); else M3.cb.push(f); };
  A.mongle = function (c, x, y, s, opt) {
    opt = opt || {};
    const P = A.PAL[opt.pal || 'mint'];
    const st = opt.stage == null ? 2 : opt.stage;
    const t = opt.t || 0;
    const bob = Math.sin(t * 3) * 2.2 * s;
    const sq = 1 + Math.sin(t * 3) * 0.025;
    c.save();
    c.translate(x, y);
    // 그림자
    const sh = c.createRadialGradient(0, 0, 0, 0, 0, 44 * s);
    sh.addColorStop(0, 'rgba(60,30,20,0.28)'); sh.addColorStop(1, 'rgba(60,30,20,0)');
    c.fillStyle = sh; c.save(); c.scale(1, 0.28); c.beginPath(); c.arc(0, 0, 44 * s * (st === 0 ? 0.6 : 1), 0, TAU); c.fill(); c.restore();

    if (st === 0) { drawSeed(c, s, P, t); c.restore(); return; }
    const size = st === 1 ? 0.78 : st === 2 ? 1 : 1.18;
    const S = s * size;
    c.translate(0, bob * 0.4);
    c.scale(1 / sq, sq);
    const H = st === 3 ? 74 : 66, Wd = st === 3 ? 44 : 42;
    // 3D 렌더 몸(발·몸·팔·새싹). 못 불러왔으면 예전 2D 그림.
    if (!draw3d(c, S, opt.pal || 'mint', st, opt.branch)) {
      // 발
      for (const sx of [-1, 1]) {
        c.save(); c.translate(sx * 17 * S, -4 * S);
        const fg = c.createLinearGradient(0, -8 * S, 0, 6 * S); fg.addColorStop(0, P.mid); fg.addColorStop(1, P.lo);
        c.fillStyle = fg; c.strokeStyle = P.line; c.lineWidth = 2.4 * s;
        c.beginPath(); c.ellipse(0, 0, 11 * S, 7 * S, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
      }
      // 몸 (아래가 넓은 찹쌀떡 모양)
      c.beginPath();
      c.moveTo(0, -H * S);
      c.bezierCurveTo(26 * S, -H * S, Wd * S, -46 * S, Wd * S, -22 * S);
      c.bezierCurveTo(Wd * S, -4 * S, 26 * S, 2 * S, 0, 2 * S);
      c.bezierCurveTo(-26 * S, 2 * S, -Wd * S, -4 * S, -Wd * S, -22 * S);
      c.bezierCurveTo(-Wd * S, -46 * S, -26 * S, -H * S, 0, -H * S);
      c.closePath();
      const bg = c.createRadialGradient(-14 * S, -48 * S, 4 * S, 0, -26 * S, 56 * S);
      bg.addColorStop(0, P.hi); bg.addColorStop(0.45, P.mid); bg.addColorStop(1, P.lo);
      c.fillStyle = bg; c.fill();
      c.save(); c.clip();
      // 배 무늬
      const bl = c.createRadialGradient(0, -12 * S, 2 * S, 0, -12 * S, 26 * S);
      bl.addColorStop(0, rgba(P.belly.length === 7 ? P.belly : '#ffffff', 0.95)); bl.addColorStop(1, rgba(P.belly, 0));
      c.fillStyle = bl; c.beginPath(); c.ellipse(0, -10 * S, 26 * S, 20 * S, 0, 0, TAU); c.fill();
      // 오른쪽 아래 그늘 + 테두리 빛(림 라이트)
      const sd = c.createLinearGradient(-Wd * S, 0, Wd * S, 0);
      sd.addColorStop(0.55, 'rgba(0,0,0,0)'); sd.addColorStop(1, rgba(P.line, 0.22));
      c.fillStyle = sd; c.fillRect(-60 * S, -90 * S, 120 * S, 100 * S);
      c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3 * S;
      c.beginPath(); c.arc(-4 * S, -26 * S, 38 * S, -2.6, -1.9); c.stroke();
      c.restore();
      c.strokeStyle = P.line; c.lineWidth = 2.6 * s; c.lineJoin = 'round';
      c.stroke();
      // 팔(작은 손)
      const wave = opt.mood === 'happy' ? Math.sin(t * 8) * 0.35 : 0;
      for (const sx of [-1, 1]) {
        c.save(); c.translate(sx * (Wd - 3) * S, -24 * S); c.rotate(sx * (0.5 + (sx > 0 ? wave : 0)));
        const ag = c.createLinearGradient(0, -6 * S, 0, 8 * S); ag.addColorStop(0, P.mid); ag.addColorStop(1, P.lo);
        c.fillStyle = ag; c.strokeStyle = P.line; c.lineWidth = 2.2 * s;
        c.beginPath(); c.ellipse(sx * 6 * S, 4 * S, 6.5 * S, 9 * S, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
      }
      // 머리 위 잎(단계·갈래별)
      drawSprout(c, 0, -H * S + 2 * S, S, P, st, opt.branch, t);
    }
    // 얼굴
    const lk = (opt.look || 0) * 3 * S;
    const blink = opt.mood === 'sleep' || (opt.blink && opt.blink > 0);
    for (const sx of [-1, 1]) {
      const ex = sx * 14 * S + lk, ey = -34 * S;
      if (blink) {
        c.strokeStyle = '#3a2a2a'; c.lineWidth = 2.6 * s; c.lineCap = 'round';
        c.beginPath(); c.arc(ex, ey - 2 * S, 6 * S, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
      } else {
        const eg = c.createLinearGradient(0, ey - 9 * S, 0, ey + 9 * S);
        eg.addColorStop(0, '#2b1d24'); eg.addColorStop(1, '#5a3a48');
        c.fillStyle = eg; c.beginPath(); c.ellipse(ex, ey, 6.4 * S, 8.6 * S, 0, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 2 * S, ey - 3.4 * S, 2.6 * S, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(ex + 2.4 * S, ey + 3.4 * S, 1.3 * S, 0, TAU); c.fill();
      }
      const ch = c.createRadialGradient(sx * 25 * S, -24 * S, 0, sx * 25 * S, -24 * S, 8 * S);
      ch.addColorStop(0, 'rgba(255,120,140,0.6)'); ch.addColorStop(1, 'rgba(255,120,140,0)');
      c.fillStyle = ch; c.beginPath(); c.ellipse(sx * 25 * S, -24 * S, 8 * S, 5.5 * S, 0, 0, TAU); c.fill();
    }
    // 입
    c.strokeStyle = '#4a2c30'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
    c.beginPath();
    if (opt.mood === 'happy') { c.moveTo(-5 * S + lk, -25 * S); c.quadraticCurveTo(lk, -18 * S, 5 * S + lk, -25 * S); c.fillStyle = '#e8606e'; c.fill(); }
    else { c.moveTo(-4.5 * S + lk, -25 * S); c.quadraticCurveTo(-2.2 * S + lk, -22 * S, lk, -24.5 * S); c.quadraticCurveTo(2.2 * S + lk, -22 * S, 4.5 * S + lk, -25 * S); }
    c.stroke();
    // 꾸미기
    if (opt.scarf) drawScarf(c, S, opt.scarf, Wd);
    if (opt.bag) drawBag(c, S, Wd);
    if (opt.hat) drawHat(c, S, H, opt.hat);
    if (opt.mood === 'sleep') {
      c.fillStyle = 'rgba(90,80,140,0.8)'; c.font = 'bold ' + (12 * S) + 'px Jua, sans-serif';
      c.fillText('z', 30 * S, -70 * S + Math.sin(t * 2) * 3 * S); c.font = 'bold ' + (16 * S) + 'px Jua, sans-serif'; c.fillText('Z', 40 * S, -84 * S + Math.sin(t * 2 + 1) * 3 * S);
    }
    c.restore();
  };

  function leaf(c, x, y, len, wid, ang, col, lo, s) {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(len * 0.3, -wid, len * 0.75, -wid, len, 0);
    c.bezierCurveTo(len * 0.75, wid * 0.8, len * 0.3, wid * 0.8, 0, 0);
    const g = c.createLinearGradient(0, -wid, 0, wid); g.addColorStop(0, col); g.addColorStop(1, lo);
    c.fillStyle = g; c.fill(); c.strokeStyle = mix(lo, '#000000', 0.25); c.lineWidth = 1.8 * s; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.2 * s;
    c.beginPath(); c.moveTo(len * 0.1, 0); c.quadraticCurveTo(len * 0.5, -wid * 0.15, len * 0.85, 0); c.stroke();
    c.restore();
  }
  A.leaf = leaf;

  function drawSprout(c, x, y, S, P, st, br, t) {
    const sw = Math.sin(t * 2.2) * 0.12;
    c.save(); c.translate(x, y); c.rotate(sw);
    c.strokeStyle = P.leafLo; c.lineWidth = 3 * S; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 2 * S); c.quadraticCurveTo(2 * S, -8 * S, 0, -14 * S); c.stroke();
    if (st === 1) { leaf(c, 0, -13 * S, 16 * S, 6 * S, -2.6, P.leaf, P.leafLo, S); leaf(c, 0, -13 * S, 16 * S, 6 * S, -0.5, P.leaf, P.leafLo, S); }
    else if (st === 2) { leaf(c, 0, -13 * S, 22 * S, 8 * S, -2.7, P.leaf, P.leafLo, S); leaf(c, 0, -13 * S, 22 * S, 8 * S, -0.45, P.leaf, P.leafLo, S); leaf(c, 0, -14 * S, 14 * S, 5 * S, -1.6, P.leaf, P.leafLo, S); }
    else {
      leaf(c, 0, -13 * S, 24 * S, 8.5 * S, -2.75, P.leaf, P.leafLo, S); leaf(c, 0, -13 * S, 24 * S, 8.5 * S, -0.4, P.leaf, P.leafLo, S);
      if (br === 'power') { // 도토리 모자 갈래
        c.translate(0, -18 * S);
        acornShape(c, 0, 0, 0.75 * S);
      } else if (br === 'wise') { // 별꽃 갈래
        c.translate(0, -20 * S); flower(c, 0, 0, 9 * S, '#fff6b8', '#ffd24a', 5, t);
        glow(c, 0, 0, 22 * S, '#fff0a0', 0.5);
      } else { // 하트 꽃봉오리 갈래
        c.translate(0, -20 * S); flower(c, 0, 0, 9 * S, '#ffd1e3', '#ff7fae', 6, t);
      }
    }
    c.restore();
  }

  function flower(c, x, y, r, a, b, n, t) {
    c.save(); c.translate(x, y); c.rotate((t || 0) * 0.3);
    for (let i = 0; i < n; i++) {
      c.save(); c.rotate(i / n * TAU);
      const g = c.createLinearGradient(0, 0, 0, -r * 1.4); g.addColorStop(0, b); g.addColorStop(1, a);
      c.fillStyle = g; c.strokeStyle = mix(b, '#000000', 0.3); c.lineWidth = r * 0.12;
      c.beginPath(); c.ellipse(0, -r * 0.75, r * 0.5, r * 0.8, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
    }
    c.fillStyle = '#ffcf4d'; c.beginPath(); c.arc(0, 0, r * 0.38, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(-r * 0.1, -r * 0.12, r * 0.13, 0, TAU); c.fill();
    c.restore();
  }
  A.flower = flower;

  function drawSeed(c, s, P, t) {
    const w = Math.sin(t * 2) * 0.06;
    c.save(); c.rotate(w);
    c.beginPath(); c.moveTo(0, -46 * s);
    c.bezierCurveTo(22 * s, -40 * s, 26 * s, -6 * s, 0, 2 * s);
    c.bezierCurveTo(-26 * s, -6 * s, -22 * s, -40 * s, 0, -46 * s);
    const g = c.createRadialGradient(-8 * s, -30 * s, 2 * s, 0, -20 * s, 34 * s);
    g.addColorStop(0, '#fff3d6'); g.addColorStop(0.5, '#e9b878'); g.addColorStop(1, '#a86c3a');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#6e4224'; c.lineWidth = 2.4 * s; c.stroke();
    c.strokeStyle = 'rgba(110,66,36,0.4)'; c.lineWidth = 1.6 * s;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8 * s, -38 * s); c.quadraticCurveTo(i * 12 * s, -20 * s, i * 6 * s, -4 * s); c.stroke(); }
    // 감은 눈
    c.strokeStyle = '#3a2a2a'; c.lineWidth = 2.2 * s; c.lineCap = 'round';
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * 7 * s, -20 * s, 3.6 * s, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke(); }
    leaf(c, 0, -45 * s, 12 * s, 4.5 * s, -1.2, P.leaf, P.leafLo, s);
    c.restore();
  }

  function acornShape(c, x, y, s) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-12 * s, -2 * s); c.bezierCurveTo(-13 * s, 14 * s, -4 * s, 22 * s, 0, 24 * s); c.bezierCurveTo(4 * s, 22 * s, 13 * s, 14 * s, 12 * s, -2 * s); c.closePath();
    const g = c.createLinearGradient(-12 * s, 0, 12 * s, 0); g.addColorStop(0, '#f2b26b'); g.addColorStop(0.5, '#d27e3c'); g.addColorStop(1, '#9c5525');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#5f3216'; c.lineWidth = 1.8 * s; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(-5 * s, 6 * s, 2.4 * s, 5 * s, 0.2, 0, TAU); c.fill();
    c.beginPath(); c.moveTo(-15 * s, 0); c.bezierCurveTo(-15 * s, -12 * s, 15 * s, -12 * s, 15 * s, 0); c.quadraticCurveTo(0, 5 * s, -15 * s, 0);
    const g2 = c.createLinearGradient(0, -12 * s, 0, 4 * s); g2.addColorStop(0, '#a77a4c'); g2.addColorStop(1, '#6d4524');
    c.fillStyle = g2; c.fill(); c.stroke();
    c.strokeStyle = 'rgba(60,30,10,0.45)'; c.lineWidth = 1 * s;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5 * s - 3 * s, -6 * s); c.lineTo(i * 5 * s + 3 * s, 0); c.stroke(); }
    c.strokeStyle = '#5f3216'; c.lineWidth = 2.4 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -9 * s); c.quadraticCurveTo(2 * s, -14 * s, 5 * s, -15 * s); c.stroke();
    c.restore();
  }
  A.acorn = acornShape;

  function drawScarf(c, S, col, Wd) {
    c.save();
    c.beginPath(); c.moveTo(-Wd * 0.86 * S, -20 * S); c.quadraticCurveTo(0, -8 * S, Wd * 0.86 * S, -20 * S);
    c.lineTo(Wd * 0.9 * S, -13 * S); c.quadraticCurveTo(0, 0, -Wd * 0.9 * S, -13 * S); c.closePath();
    const g = c.createLinearGradient(0, -20 * S, 0, -6 * S); g.addColorStop(0, mix(col, '#ffffff', 0.3)); g.addColorStop(1, mix(col, '#000000', 0.2));
    c.fillStyle = g; c.fill(); c.strokeStyle = mix(col, '#000000', 0.45); c.lineWidth = 2 * S; c.stroke();
    c.beginPath(); c.moveTo(14 * S, -10 * S); c.quadraticCurveTo(20 * S, 4 * S, 16 * S, 10 * S); c.lineTo(24 * S, 8 * S); c.quadraticCurveTo(26 * S, -2 * S, 22 * S, -11 * S); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
  function drawBag(c, S, Wd) {
    c.save(); c.translate(-Wd * 0.85 * S, -18 * S);
    rr(c, -10 * S, -12 * S, 16 * S, 20 * S, 5 * S);
    const g = c.createLinearGradient(-10 * S, 0, 6 * S, 0); g.addColorStop(0, '#f6c27a'); g.addColorStop(1, '#c9813f');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#7a4a22'; c.lineWidth = 2 * S; c.stroke();
    c.fillStyle = '#e39a50'; rr(c, -10 * S, -12 * S, 16 * S, 8 * S, 4 * S); c.fill(); c.stroke();
    c.restore();
  }
  function drawHat(c, S, H, kind) {
    c.save(); c.translate(0, -H * S + 4 * S);
    if (kind === 'straw') {
      c.beginPath(); c.ellipse(0, 2 * S, 34 * S, 8 * S, 0, 0, TAU);
      const g = c.createLinearGradient(0, -6 * S, 0, 10 * S); g.addColorStop(0, '#fbe3a2'); g.addColorStop(1, '#d6a95a');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#8f6a2c'; c.lineWidth = 2 * S; c.stroke();
      c.beginPath(); c.moveTo(-18 * S, 0); c.bezierCurveTo(-18 * S, -22 * S, 18 * S, -22 * S, 18 * S, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ff7f8e'; c.fillRect(-18 * S, -6 * S, 36 * S, 5 * S);
    }
    c.restore();
  }

  // ── 재료·요리 아이콘
  A.mushroom = function (c, x, y, s, col) {
    col = col || '#ff7d6b';
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-6 * s, 0); c.quadraticCurveTo(-7 * s, 14 * s, -4 * s, 16 * s); c.lineTo(4 * s, 16 * s); c.quadraticCurveTo(7 * s, 14 * s, 6 * s, 0); c.closePath();
    const sg = c.createLinearGradient(-6 * s, 0, 6 * s, 0); sg.addColorStop(0, '#fffaf0'); sg.addColorStop(1, '#e3d3bb');
    c.fillStyle = sg; c.fill(); c.strokeStyle = '#8a6b52'; c.lineWidth = 1.6 * s; c.stroke();
    c.beginPath(); c.moveTo(-16 * s, 2 * s); c.bezierCurveTo(-16 * s, -18 * s, 16 * s, -18 * s, 16 * s, 2 * s); c.quadraticCurveTo(0, 6 * s, -16 * s, 2 * s);
    const g = c.createRadialGradient(-5 * s, -8 * s, 1, 0, -4 * s, 18 * s); g.addColorStop(0, mix(col, '#ffffff', 0.45)); g.addColorStop(1, mix(col, '#000000', 0.2));
    c.fillStyle = g; c.fill(); c.strokeStyle = mix(col, '#000000', 0.5); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    [[-7, -5, 3], [4, -9, 2.4], [8, -2, 2]].forEach(p => { c.beginPath(); c.arc(p[0] * s, p[1] * s, p[2] * s, 0, TAU); c.fill(); });
    c.restore();
  };
  A.berry = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    [[-6, 2], [6, 2], [0, -6]].forEach(p => {
      const g = c.createRadialGradient(p[0] * s - 2 * s, p[1] * s - 3 * s, 0.5, p[0] * s, p[1] * s, 8 * s);
      g.addColorStop(0, '#ffb3c8'); g.addColorStop(0.5, '#e8466c'); g.addColorStop(1, '#9c1f45');
      c.fillStyle = g; c.strokeStyle = '#6e1230'; c.lineWidth = 1.4 * s; c.beginPath(); c.arc(p[0] * s, p[1] * s, 7 * s, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(p[0] * s - 2.5 * s, p[1] * s - 2.5 * s, 1.8 * s, 0, TAU); c.fill();
    });
    leaf(c, 0, -12 * s, 10 * s, 3.5 * s, -0.6, '#8fdc6a', '#3f8a3a', s);
    c.restore();
  };
  A.honey = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(-10 * s, -8 * s); c.bezierCurveTo(-16 * s, 0, -14 * s, 14 * s, 0, 15 * s); c.bezierCurveTo(14 * s, 14 * s, 16 * s, 0, 10 * s, -8 * s); c.closePath();
    const g = c.createLinearGradient(-14 * s, 0, 14 * s, 0); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(1, '#c97a10');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#7d4a08'; c.lineWidth = 1.6 * s; c.stroke();
    rr(c, -11 * s, -14 * s, 22 * s, 7 * s, 3 * s); c.fillStyle = '#e46e6e'; c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.ellipse(-6 * s, 2 * s, 2.4 * s, 6 * s, 0.2, 0, TAU); c.fill();
    c.restore();
  };
  A.starfruit = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    c.beginPath();
    for (let i = 0; i < 10; i++) { const r = (i % 2 ? 6 : 14) * s, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath();
    const g = c.createRadialGradient(-3 * s, -4 * s, 1, 0, 0, 15 * s); g.addColorStop(0, '#fffbd0'); g.addColorStop(0.6, '#ffd84a'); g.addColorStop(1, '#e09a12');
    c.fillStyle = g; c.lineJoin = 'round'; c.fill(); c.strokeStyle = '#8a5a06'; c.lineWidth = 1.6 * s; c.stroke();
    glow(c, 0, 0, 22 * s, '#fff2a0', 0.35);
    c.restore();
  };
  A.bowl = function (c, x, y, s, soup) {
    soup = soup || '#f2c47a';
    c.save(); c.translate(x, y);
    c.beginPath(); c.ellipse(0, 0, 24 * s, 8 * s, 0, 0, TAU);
    c.fillStyle = soup; c.fill();
    const sg = c.createRadialGradient(-6 * s, -2 * s, 1, 0, 0, 24 * s); sg.addColorStop(0, 'rgba(255,255,255,0.6)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.fill();
    c.beginPath(); c.moveTo(-24 * s, 0); c.bezierCurveTo(-22 * s, 22 * s, 22 * s, 22 * s, 24 * s, 0); c.ellipse(0, 0, 24 * s, 8 * s, 0, 0, Math.PI);
    const bg = c.createLinearGradient(-24 * s, 0, 24 * s, 0); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#cfe6f2'); bg.addColorStop(1, '#8fb3c8');
    c.fillStyle = bg; c.fill(); c.strokeStyle = '#4f7690'; c.lineWidth = 1.8 * s; c.stroke();
    c.beginPath(); c.ellipse(0, 0, 24 * s, 8 * s, 0, 0, TAU); c.stroke();
    c.strokeStyle = '#7fb0d6'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(-16 * s, 9 * s); c.quadraticCurveTo(0, 15 * s, 16 * s, 9 * s); c.stroke();
    c.restore();
  };
  A.steam = function (c, x, y, s, t) {
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i / 3) % 1;
      c.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - ph)) + ')'; c.lineWidth = 3 * s;
      c.beginPath();
      const bx = x + (i - 1) * 9 * s, by = y - ph * 26 * s;
      c.moveTo(bx, by); c.bezierCurveTo(bx + 6 * s, by - 6 * s, bx - 6 * s, by - 12 * s, bx, by - 18 * s); c.stroke();
    }
    c.restore();
  };
  // 도토리(게임 안 돈) 아이콘
  A.coinAcorn = function (c, x, y, s) { acornShape(c, x, y - 6 * s, 0.62 * s); };
  // 5락실 코인 아이콘(사이트 공통)
  A.coin5 = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(-3 * s, -3 * s, 1, 0, 0, 10 * s); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.6, '#ffcc33'); g.addColorStop(1, '#c98a00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 10 * s, 0, TAU); c.fill(); c.strokeStyle = '#8a5a00'; c.lineWidth = 1.5 * s; c.stroke();
    c.fillStyle = '#8a5a00'; c.font = 'bold ' + (11 * s) + 'px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('5', 0, 1 * s);
    c.restore();
  };

  // ── 가구
  A.plant = function (c, x, y, s, t) {
    c.save(); c.translate(x, y);
    const sw = Math.sin((t || 0) * 1.4) * 0.04;
    c.save(); c.rotate(sw);
    const leaves = [[-2.3, 40], [-1.9, 46], [-1.4, 50], [-1.0, 44], [-0.7, 38], [-2.0, 30], [-1.2, 34]];
    leaves.forEach((l, i) => leaf(c, 0, -26 * s, l[1] * s, 10 * s, l[0], i % 2 ? '#8ed46d' : '#6cc160', '#2f7a3e', s));
    c.restore();
    c.beginPath(); c.moveTo(-18 * s, -28 * s); c.lineTo(18 * s, -28 * s); c.lineTo(13 * s, 0); c.lineTo(-13 * s, 0); c.closePath();
    const g = c.createLinearGradient(-18 * s, 0, 18 * s, 0); g.addColorStop(0, '#f7a97f'); g.addColorStop(0.6, '#d9714f'); g.addColorStop(1, '#a24c35');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#6e2f20'; c.lineWidth = 2 * s; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-18 * s, -28 * s, 36 * s, 5 * s);
    c.restore();
  };
  A.lamp = function (c, x, y, s, on) {
    c.save(); c.translate(x, y);
    c.strokeStyle = '#6b4a3a'; c.lineWidth = 4 * s; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -110 * s); c.stroke();
    c.fillStyle = '#6b4a3a'; c.beginPath(); c.ellipse(0, 0, 18 * s, 5 * s, 0, 0, TAU); c.fill();
    if (on) glow(c, 0, -112 * s, 120 * s, '#ffcf7a', 0.45);
    c.beginPath(); c.moveTo(-14 * s, -128 * s); c.lineTo(14 * s, -128 * s); c.lineTo(24 * s, -102 * s); c.lineTo(-24 * s, -102 * s); c.closePath();
    const g = c.createLinearGradient(0, -128 * s, 0, -102 * s); g.addColorStop(0, '#fff2c2'); g.addColorStop(1, '#ffc46b');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#a6702e'; c.lineWidth = 2 * s; c.stroke();
    c.restore();
  };
  A.shelf = function (c, x, y, w, h, s) {
    c.save(); c.translate(x, y);
    const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#c88a5a'); g.addColorStop(1, '#8f5a36');
    rr(c, 0, 0, w, h, 6 * s); c.fillStyle = g; c.fill(); c.strokeStyle = '#5a3420'; c.lineWidth = 2 * s; c.stroke();
    const rows = 3, rh = (h - 12 * s) / rows;
    const cols = ['#e8726b', '#f5c45a', '#7cc3a8', '#7aa0e0', '#c995e6', '#f19ab8', '#9bd27a'];
    let k = 0;
    for (let r = 0; r < rows; r++) {
      const ry = 6 * s + r * rh;
      c.fillStyle = '#5e3a24'; c.fillRect(6 * s, ry, w - 12 * s, rh - 4 * s);
      c.fillStyle = '#a56b42'; c.fillRect(4 * s, ry + rh - 5 * s, w - 8 * s, 5 * s);
      let bx = 9 * s;
      while (bx < w - 18 * s) {
        const bw = (6 + ((k * 7) % 5)) * s, bh = rh - (10 + (k * 3) % 8) * s;
        if (r === 1 && k % 6 === 3) { // 작은 화분 장식
          A.plant(c, bx + 10 * s, ry + rh - 5 * s, 0.3 * s, 0); bx += 22 * s; k++; continue;
        }
        const col = cols[k % cols.length];
        const bg = c.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, mix(col, '#ffffff', 0.25)); bg.addColorStop(1, mix(col, '#000000', 0.2));
        c.fillStyle = bg; rr(c, bx, ry + rh - 5 * s - bh, bw, bh, 1.5 * s); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(bx + 1 * s, ry + rh - 5 * s - bh + 4 * s, bw - 2 * s, 1.5 * s);
        bx += bw + 1.5 * s; k++;
      }
    }
    c.restore();
  };
  A.cushion = function (c, x, y, s, col) {
    col = col || '#ffb3c1';
    c.save(); c.translate(x, y);
    c.beginPath(); c.ellipse(0, 0, 62 * s, 22 * s, 0, 0, TAU);
    const g = c.createRadialGradient(-14 * s, -8 * s, 4 * s, 0, 0, 64 * s); g.addColorStop(0, mix(col, '#ffffff', 0.55)); g.addColorStop(0.7, col); g.addColorStop(1, mix(col, '#000000', 0.25));
    c.fillStyle = g; c.fill(); c.strokeStyle = mix(col, '#000000', 0.45); c.lineWidth = 2.2 * s; c.stroke();
    c.beginPath(); c.ellipse(0, -2 * s, 44 * s, 13 * s, 0, 0, TAU); c.strokeStyle = rgba('#ffffff', 0.5); c.lineWidth = 2 * s; c.setLineDash([4 * s, 5 * s]); c.stroke(); c.setLineDash([]);
    c.restore();
  };
  A.table = function (c, x, y, s, t) {
    c.save(); c.translate(x, y);
    c.fillStyle = '#7a4b2f'; [-22, 22].forEach(lx => { rr(c, lx * s - 3 * s, -30 * s, 6 * s, 30 * s, 2 * s); c.fill(); });
    c.beginPath(); c.ellipse(0, -32 * s, 36 * s, 10 * s, 0, 0, TAU);
    const g = c.createLinearGradient(0, -42 * s, 0, -22 * s); g.addColorStop(0, '#e2a874'); g.addColorStop(1, '#a5683f');
    c.fillStyle = g; c.fill(); c.strokeStyle = '#5a3420'; c.lineWidth = 2 * s; c.stroke();
    // 찻잔
    c.save(); c.translate(6 * s, -38 * s);
    c.beginPath(); c.moveTo(-8 * s, -10 * s); c.lineTo(8 * s, -10 * s); c.quadraticCurveTo(8 * s, 2 * s, 0, 2 * s); c.quadraticCurveTo(-8 * s, 2 * s, -8 * s, -10 * s);
    c.fillStyle = '#fff8ee'; c.fill(); c.strokeStyle = '#a07a6a'; c.lineWidth = 1.5 * s; c.stroke();
    c.beginPath(); c.arc(9 * s, -5 * s, 3.5 * s, -1.4, 1.4); c.stroke();
    c.fillStyle = '#c98a5a'; c.beginPath(); c.ellipse(0, -10 * s, 8 * s, 2 * s, 0, 0, TAU); c.fill();
    A.steam(c, 0, -12 * s, 0.6 * s, t || 0);
    c.restore();
    A.berry(c, -16 * s, -40 * s, 0.55 * s);
    c.restore();
  };

  // ── 아지트 방 배경 (w×h 영역, 바닥선 floorY)
  A.room = function (c, w, h, floorY, t, night, wp) {
    wp = wp || { a: '#fbe6cf', b: '#f4cfae', dot: '#e59a8a' };
    // 벽
    const wg = c.createLinearGradient(0, 0, 0, floorY);
    wg.addColorStop(0, night ? mix(wp.a, '#3a2f5e', 0.62) : wp.a); wg.addColorStop(1, night ? mix(wp.b, '#3a2f5e', 0.5) : wp.b);
    c.fillStyle = wg; c.fillRect(0, 0, w, floorY);
    // 벽지 무늬(작은 꽃)
    c.save(); c.globalAlpha = night ? 0.12 : 0.22;
    for (let yy = 18; yy < floorY - 80; yy += 34) for (let xx = (yy / 34 % 2) * 17 + 10; xx < w; xx += 34) {
      c.fillStyle = wp.dot; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(xx + Math.cos(i * 1.57) * 3, yy + Math.sin(i * 1.57) * 3, 2.4, 0, TAU); c.fill(); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(xx, yy, 1.4, 0, TAU); c.fill();
    }
    c.restore();
    // 아래 벽 판자
    const wy = floorY - 70;
    const pg = c.createLinearGradient(0, wy, 0, floorY); pg.addColorStop(0, night ? '#6e4c48' : '#d9a27a'); pg.addColorStop(1, night ? '#57393a' : '#b97e57');
    c.fillStyle = pg; c.fillRect(0, wy, w, 70);
    c.fillStyle = night ? '#8a6158' : '#eab894'; c.fillRect(0, wy - 6, w, 8);
    c.strokeStyle = 'rgba(80,40,20,0.25)'; c.lineWidth = 2;
    for (let xx = 24; xx < w; xx += 48) { c.beginPath(); c.moveTo(xx, wy + 4); c.lineTo(xx, floorY); c.stroke(); }
    // 바닥 나무판(원근)
    const fg = c.createLinearGradient(0, floorY, 0, h);
    fg.addColorStop(0, night ? '#7a5446' : '#d79a68'); fg.addColorStop(1, night ? '#4d3330' : '#a8693f');
    c.fillStyle = fg; c.fillRect(0, floorY, w, h - floorY);
    c.strokeStyle = 'rgba(70,35,15,0.28)'; c.lineWidth = 1.6;
    const vx = w / 2, vy = floorY - 420;
    for (let i = -12; i <= 12; i++) { const bx = w / 2 + i * 46; c.beginPath(); c.moveTo(vx + (bx - vx) * ((floorY - vy) / (h - vy)), floorY); c.lineTo(bx, h); c.stroke(); }
    for (let k = 1; k < 8; k++) { const yy = floorY + (h - floorY) * Math.pow(k / 8, 1.5); c.globalAlpha = 0.5; c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); c.globalAlpha = 1; }
    c.fillStyle = 'rgba(60,30,15,0.22)'; c.fillRect(0, floorY, w, 5);
  };
  A.window = function (c, x, y, w, h, t, night, cc) {
    cc = cc || ['#ff9eae', '#ffc4cd', '#f2879a', '#c25b6e'];
    c.save(); c.translate(x, y);
    // 틀
    const R = w / 2;
    const frame = () => { c.beginPath(); c.moveTo(0, h); c.lineTo(0, R); c.arc(R, R, R, Math.PI, 0); c.lineTo(w, h); c.closePath(); };
    c.save(); frame(); c.clip();
    const sk = c.createLinearGradient(0, 0, 0, h);
    if (night) { sk.addColorStop(0, '#1c2350'); sk.addColorStop(1, '#5a4c8a'); } else { sk.addColorStop(0, '#8fd0ff'); sk.addColorStop(0.7, '#ffe0b5'); sk.addColorStop(1, '#ffc49a'); }
    c.fillStyle = sk; c.fillRect(0, 0, w, h);
    if (night) {
      for (let i = 0; i < 26; i++) { const sx = (i * 73) % w, sy = (i * 41) % (h * 0.6); const a = 0.5 + 0.5 * Math.sin(t * 2 + i); c.fillStyle = 'rgba(255,255,230,' + a + ')'; c.beginPath(); c.arc(sx, sy, 1.2 + (i % 3) * 0.5, 0, TAU); c.fill(); }
      glow(c, w * 0.7, h * 0.28, 50, '#fff4c8', 0.5);
      c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(w * 0.7, h * 0.28, 14, 0, TAU); c.fill();
      c.fillStyle = night ? '#1c2350' : '#fff'; c.beginPath(); c.arc(w * 0.7 + 6, h * 0.28 - 4, 12, 0, TAU); c.fill();
    } else {
      glow(c, w * 0.25, h * 0.3, 70, '#fff7d0', 0.55);
      // 구름
      c.fillStyle = 'rgba(255,255,255,0.9)';
      const cx = (t * 6) % (w + 60) - 30;
      [[0, 0, 14], [14, -6, 16], [30, 0, 12]].forEach(p => { c.beginPath(); c.arc(cx + p[0], h * 0.25 + p[1], p[2], 0, TAU); c.fill(); });
    }
    // 먼 숲 언덕
    c.fillStyle = night ? '#2c3a5e' : '#9ad08a';
    c.beginPath(); c.moveTo(0, h); c.lineTo(0, h * 0.72); c.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 0.8, w, h * 0.66); c.lineTo(w, h); c.fill();
    c.fillStyle = night ? '#223050' : '#6fb56d';
    for (let i = 0; i < 6; i++) { const tx = i * w / 5 + 6, ty = h * 0.78 - (i % 2) * 8; c.beginPath(); c.moveTo(tx, ty - 26); c.lineTo(tx + 12, ty + 6); c.lineTo(tx - 12, ty + 6); c.fill(); }
    c.fillStyle = night ? '#1b2644' : '#5aa15e'; c.fillRect(0, h * 0.86, w, h);
    c.restore();
    frame(); c.lineWidth = 9; c.strokeStyle = night ? '#8e6a6a' : '#fff4e6'; c.stroke(); c.lineWidth = 2; c.strokeStyle = '#8a5a3e'; c.stroke();
    c.lineWidth = 5; c.strokeStyle = night ? '#8e6a6a' : '#fff4e6';
    c.beginPath(); c.moveTo(R, 6); c.lineTo(R, h); c.moveTo(0, h * 0.55); c.lineTo(w, h * 0.55); c.stroke();
    // 창틀 아래 받침
    rr(c, -10, h - 2, w + 20, 12, 4); c.fillStyle = night ? '#9a7466' : '#f6dcc0'; c.fill(); c.strokeStyle = '#8a5a3e'; c.lineWidth = 2; c.stroke();
    // 커튼
    for (const side of [0, 1]) {
      c.save(); if (side) { c.translate(w, 0); c.scale(-1, 1); }
      c.beginPath(); c.moveTo(-18, -8); c.lineTo(28, -8); c.bezierCurveTo(30, h * 0.35, 6, h * 0.5, 16, h * 0.62); c.bezierCurveTo(4, h * 0.75, -4, h * 0.95, -14, h + 18); c.lineTo(-18, h + 18); c.closePath();
      const cg = c.createLinearGradient(-18, 0, 28, 0); const nd = v => night ? mix(v, '#3a2f5e', 0.4) : v;
      cg.addColorStop(0, nd(cc[0])); cg.addColorStop(0.5, nd(cc[1])); cg.addColorStop(1, nd(cc[2]));
      c.fillStyle = cg; c.fill(); c.strokeStyle = nd(cc[3]); c.lineWidth = 1.6; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(4, -6); c.quadraticCurveTo(2, h * 0.5, -6, h + 14); c.stroke();
      c.fillStyle = '#ffd36b'; rr(c, 4, h * 0.58, 16, 7, 3); c.fill();
      c.restore();
    }
    c.fillStyle = '#8a5a3e'; rr(c, -26, -14, w + 52, 7, 3); c.fill();
    c.restore();
  };
  A.rug = function (c, x, y, rx, ry, col) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU);
    const g = c.createRadialGradient(0, -ry * 0.3, 4, 0, 0, rx); g.addColorStop(0, mix(col, '#ffffff', 0.35)); g.addColorStop(1, col);
    c.fillStyle = g; c.fill(); c.strokeStyle = mix(col, '#000000', 0.3); c.lineWidth = 2; c.stroke();
    c.beginPath(); c.ellipse(0, 0, rx * 0.82, ry * 0.78, 0, 0, TAU); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3; c.setLineDash([8, 6]); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.ellipse(0, 0, rx * 0.55, ry * 0.5, 0, 0, TAU); c.strokeStyle = mix(col, '#ffffff', 0.5); c.lineWidth = 2; c.stroke();
    c.restore();
  };

  // ── 산책 지도 배경
  A.walkMap = function (c, w, h, t) {
    const sk = c.createLinearGradient(0, 0, 0, h); sk.addColorStop(0, '#aee3ff'); sk.addColorStop(0.45, '#e9f8ff'); sk.addColorStop(0.46, '#c5ecaa'); sk.addColorStop(1, '#8dcf7c');
    c.fillStyle = sk; c.fillRect(0, 0, w, h);
    glow(c, w * 0.82, h * 0.12, 90, '#fff7c2', 0.6);
    c.fillStyle = '#fffbe6'; c.beginPath(); c.arc(w * 0.82, h * 0.12, 18, 0, TAU); c.fill();
    // 먼 산
    const hill = (yy, amp, col, ph) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let xx = 0; xx <= w; xx += 8) c.lineTo(xx, yy + Math.sin(xx / w * 5 + ph) * amp + Math.sin(xx / w * 13 + ph) * amp * 0.3); c.lineTo(w, h); c.fill(); };
    hill(h * 0.4, 14, '#b9d9e8', 0); hill(h * 0.46, 12, '#a6dc94', 1.3); hill(h * 0.56, 16, '#8fcf7f', 2.4); hill(h * 0.7, 18, '#7cc271', 4);
    // 호수
    c.beginPath(); c.ellipse(w * 0.78, h * 0.5, 54, 14, 0, 0, TAU);
    const lg = c.createLinearGradient(0, h * 0.47, 0, h * 0.53); lg.addColorStop(0, '#9fd8ff'); lg.addColorStop(1, '#5aa8e0');
    c.fillStyle = lg; c.fill(); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(w * 0.72, h * 0.5); c.lineTo(w * 0.8, h * 0.5); c.stroke();
    // 나무들
    const tree = (x, y, s, col) => {
      c.fillStyle = '#7a4e2e'; rr(c, x - 3 * s, y - 14 * s, 6 * s, 16 * s, 2 * s); c.fill();
      [[0, -30, 16], [-10, -22, 12], [10, -22, 12], [0, -40, 11]].forEach(p => {
        const g = c.createRadialGradient(x + p[0] * s - 4 * s, y + p[1] * s - 5 * s, 1, x + p[0] * s, y + p[1] * s, p[2] * s);
        g.addColorStop(0, mix(col, '#ffffff', 0.35)); g.addColorStop(1, mix(col, '#000000', 0.15));
        c.fillStyle = g; c.beginPath(); c.arc(x + p[0] * s, y + p[1] * s, p[2] * s, 0, TAU); c.fill();
      });
    };
    for (let i = 0; i < 9; i++) tree(20 + i * 47 + (i % 2) * 10, h * 0.52 + (i % 3) * 6, 0.55, i % 3 ? '#4fa860' : '#3e9455');
    tree(36, h * 0.86, 1.1, '#5ab865'); tree(w - 34, h * 0.9, 1.2, '#4aa45a');
    // 버섯 숲
    for (let i = 0; i < 4; i++) A.mushroom(c, w * 0.18 + i * 14, h * 0.62 + (i % 2) * 6, 0.45 + (i % 2) * 0.15, i % 2 ? '#ff9b6b' : '#ff6b7d');
    // 꽃
    for (let i = 0; i < 18; i++) { const fx = (i * 97) % w, fy = h * 0.72 + ((i * 53) % (h * 0.25)); flower(c, fx, fy, 3.2, i % 2 ? '#fff' : '#ffd1e3', i % 2 ? '#ffd24a' : '#ff7fae', 5, 0); }
    // 길(점선 오솔길)
    c.save(); c.strokeStyle = '#f3dfb4'; c.lineWidth = 16; c.lineCap = 'round';
    c.beginPath(); c.moveTo(w * 0.5, h); c.bezierCurveTo(w * 0.2, h * 0.85, w * 0.15, h * 0.72, w * 0.25, h * 0.64); c.bezierCurveTo(w * 0.45, h * 0.55, w * 0.6, h * 0.62, w * 0.72, h * 0.54);
    c.stroke(); c.strokeStyle = 'rgba(160,120,70,0.35)'; c.lineWidth = 2; c.setLineDash([2, 10]); c.stroke(); c.restore();
  };

  // 지도 핀
  A.pin = function (c, x, y, s, col, label, sub) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-4 * s, -8 * s, -12 * s, -14 * s, -12 * s, -22 * s); c.arc(0, -22 * s, 12 * s, Math.PI, 0); c.bezierCurveTo(12 * s, -14 * s, 4 * s, -8 * s, 0, 0);
    const g = c.createLinearGradient(-12 * s, -34 * s, 12 * s, 0); g.addColorStop(0, mix(col, '#ffffff', 0.4)); g.addColorStop(1, mix(col, '#000000', 0.2));
    c.fillStyle = g; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.4 * s; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -22 * s, 5 * s, 0, TAU); c.fill();
    if (label) {
      c.font = (13 * s) + 'px Jua, sans-serif'; c.textAlign = 'center';
      const tw = c.measureText(label).width + 16 * s;
      rr(c, -tw / 2, -62 * s, tw, 22 * s, 11 * s); c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill(); c.strokeStyle = mix(col, '#000000', 0.2); c.lineWidth = 1.5 * s; c.stroke();
      c.fillStyle = '#4a3a3a'; c.textBaseline = 'middle'; c.fillText(label, 0, -50.5 * s);
      if (sub) { c.font = (10 * s) + 'px Jua, sans-serif'; c.fillStyle = '#fff'; c.lineWidth = 3 * s; c.strokeStyle = 'rgba(70,50,40,0.6)'; c.strokeText(sub, 0, -70 * s); c.fillText(sub, 0, -70 * s); }
    }
    c.restore();
  };

  // ── 허브(들꽃 언덕 재료)
  A.herb = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    c.strokeStyle = '#3f7a3a'; c.lineWidth = 2 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 14 * s); c.quadraticCurveTo(-1 * s, 0, 0, -10 * s); c.stroke();
    [[-2.5, 12, -2], [-0.6, 12, -2], [-2.2, 10, 4], [-0.9, 10, 4], [-1.6, 11, -10]].forEach(l => leaf(c, 0, l[2] * s, l[1] * s, 4.5 * s, l[0], '#9be07a', '#3f8a3a', s));
    c.fillStyle = '#d6a4ff'; [[-6, -14], [5, -12], [0, -18]].forEach(p => { c.beginPath(); c.arc(p[0] * s, p[1] * s, 2.4 * s, 0, TAU); c.fill(); });
    c.restore();
  };
  // ── 요리 그림 (kind: soup|mochi|jelly|tea|parfait|mush)
  A.dish = function (c, x, y, s, d, t) {
    t = t || 0;
    c.save(); c.translate(x, y);
    const plate = () => { c.beginPath(); c.ellipse(0, 6 * s, 26 * s, 8 * s, 0, 0, TAU); const g = c.createLinearGradient(0, 0, 0, 14 * s); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfe0ea'); c.fillStyle = g; c.fill(); c.strokeStyle = '#7d9cb0'; c.lineWidth = 1.6 * s; c.stroke(); };
    if (d.k === 'soup' || d.k === 'mush') { A.bowl(c, 0, 0, s, d.c); if (d.k === 'mush') { A.mushroom(c, -8 * s, -2 * s, 0.35 * s, '#ff7d6b'); A.herb(c, 9 * s, -3 * s, 0.35 * s); } else { A.berry(c, 6 * s, -3 * s, 0.35 * s); A.mushroom(c, -9 * s, -2 * s, 0.32 * s, '#ff9b6b'); } A.steam(c, 0, -8 * s, 0.6 * s, t); }
    else if (d.k === 'mochi') {
      plate();
      [[-9, 0], [9, 0], [0, -8]].forEach((p, i) => { c.beginPath(); c.ellipse(p[0] * s, p[1] * s, 10 * s, 8 * s, 0, 0, TAU); const g = c.createRadialGradient(p[0] * s - 3 * s, p[1] * s - 3 * s, 1, p[0] * s, p[1] * s, 11 * s); g.addColorStop(0, '#fff'); g.addColorStop(1, i === 2 ? '#ffb3c8' : '#ffd9e4'); c.fillStyle = g; c.fill(); c.strokeStyle = '#d0798f'; c.lineWidth = 1.4 * s; c.stroke(); });
      c.fillStyle = '#ffb52e'; c.beginPath(); c.ellipse(0, -13 * s, 6 * s, 2.5 * s, 0, 0, TAU); c.fill();
      A.berry(c, 0, -18 * s, 0.3 * s);
    } else if (d.k === 'jelly') {
      plate(); const w = 1 + Math.sin(t * 6) * 0.04;
      c.save(); c.scale(w, 2 - w);
      c.beginPath(); c.moveTo(-16 * s, 6 * s); c.bezierCurveTo(-18 * s, -20 * s, 18 * s, -20 * s, 16 * s, 6 * s); c.closePath();
      const g = c.createLinearGradient(-16 * s, -18 * s, 16 * s, 6 * s); g.addColorStop(0, 'rgba(200,230,255,0.95)'); g.addColorStop(1, 'rgba(110,150,240,0.95)');
      c.fillStyle = g; c.fill(); c.strokeStyle = '#4b63b0'; c.lineWidth = 1.5 * s; c.stroke(); c.restore();
      A.starfruit(c, 0, -8 * s, 0.45 * s);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.ellipse(-8 * s, -6 * s, 2 * s, 5 * s, 0.3, 0, TAU); c.fill();
    } else if (d.k === 'tea') {
      c.beginPath(); c.ellipse(0, 8 * s, 22 * s, 6 * s, 0, 0, TAU); c.fillStyle = '#e9eef2'; c.fill(); c.strokeStyle = '#8fa3b0'; c.lineWidth = 1.4 * s; c.stroke();
      c.beginPath(); c.moveTo(-14 * s, -10 * s); c.lineTo(14 * s, -10 * s); c.quadraticCurveTo(14 * s, 8 * s, 0, 8 * s); c.quadraticCurveTo(-14 * s, 8 * s, -14 * s, -10 * s);
      const g = c.createLinearGradient(-14 * s, 0, 14 * s, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, '#d8e6c8'); c.fillStyle = g; c.fill(); c.strokeStyle = '#6f8a5a'; c.stroke();
      c.beginPath(); c.arc(16 * s, -3 * s, 5 * s, -1.4, 1.4); c.stroke();
      c.fillStyle = d.c; c.beginPath(); c.ellipse(0, -10 * s, 14 * s, 3.4 * s, 0, 0, TAU); c.fill();
      leaf(c, -4 * s, -11 * s, 9 * s, 3 * s, -0.3, '#9be07a', '#3f8a3a', s);
      A.steam(c, 0, -14 * s, 0.6 * s, t);
    } else if (d.k === 'parfait') {
      c.beginPath(); c.moveTo(-14 * s, -24 * s); c.lineTo(14 * s, -24 * s); c.lineTo(8 * s, 4 * s); c.lineTo(-8 * s, 4 * s); c.closePath();
      c.save(); c.clip();
      [['#fff1d6', -24], ['#ff9fb8', -16], ['#ffe08a', -8], ['#c9b3ff', 0]].forEach(l => { c.fillStyle = l[0]; c.fillRect(-16 * s, l[1] * s, 32 * s, 8 * s); });
      c.restore(); c.strokeStyle = 'rgba(120,140,170,0.9)'; c.lineWidth = 1.6 * s; c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(-11 * s, -22 * s, 3 * s, 22 * s);
      c.fillStyle = '#cfe0ea'; c.fillRect(-2 * s, 4 * s, 4 * s, 8 * s); c.beginPath(); c.ellipse(0, 13 * s, 12 * s, 3.5 * s, 0, 0, TAU); c.fill();
      c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(-6 * s, -26 * s, 7 * s, 0, TAU); c.arc(6 * s, -26 * s, 7 * s, 0, TAU); c.arc(0, -31 * s, 7 * s, 0, TAU); c.fill();
      A.starfruit(c, 4 * s, -38 * s, 0.4 * s); A.berry(c, -7 * s, -34 * s, 0.3 * s);
      glow(c, 0, -30 * s, 26 * s, '#fff2a0', 0.3);
    } else { // 수상한 죽
      A.bowl(c, 0, 0, s, '#a7a08a');
      c.fillStyle = 'rgba(90,80,60,0.5)'; [[-8, -1], [6, 1], [0, -3]].forEach(p => { c.beginPath(); c.arc(p[0] * s, p[1] * s, 2.2 * s, 0, TAU); c.fill(); });
      A.steam(c, 0, -6 * s, 0.6 * s, t);
    }
    c.restore();
  };
  // ── 산책 엽서 그림 (kind 0 들꽃 언덕 · 1 버섯 숲 · 2 별빛 호수), v = 엽서 번호(0..2)
  A.scene = function (c, w, h, kind, v, t, pal) {
    c.save();
    const sk = c.createLinearGradient(0, 0, 0, h);
    if (kind === 0) { sk.addColorStop(0, '#9fdcff'); sk.addColorStop(1, '#fff3d6'); }
    else if (kind === 1) { sk.addColorStop(0, '#5f9a7a'); sk.addColorStop(1, '#d8ecc0'); }
    else { sk.addColorStop(0, '#141a46'); sk.addColorStop(1, '#5a4f9a'); }
    c.fillStyle = sk; c.fillRect(0, 0, w, h);
    if (kind === 2) { for (let i = 0; i < 40; i++) { const a = 0.4 + 0.6 * Math.abs(Math.sin(t + i)); c.fillStyle = 'rgba(255,255,220,' + a + ')'; c.beginPath(); c.arc((i * 71) % w, (i * 37) % (h * 0.55), 0.6 + (i % 3) * 0.5, 0, TAU); c.fill(); } glow(c, w * 0.75, h * 0.22, h * 0.25, '#fff4c8', 0.6); c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(w * 0.75, h * 0.22, h * 0.07, 0, TAU); c.fill(); }
    else glow(c, w * 0.8, h * 0.15, h * 0.4, '#fff7c2', kind === 0 ? 0.6 : 0.3);
    const hill = (yy, col, ph, amp) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, h); for (let xx = 0; xx <= w; xx += 6) c.lineTo(xx, yy + Math.sin(xx / w * 5 + ph) * amp); c.lineTo(w, h); c.fill(); };
    if (kind === 0) { hill(h * 0.55, '#b7e39a', 0, h * 0.04); hill(h * 0.7, '#93d27c', 2, h * 0.05); for (let i = 0; i < 30; i++) flower(c, (i * 53) % w, h * 0.66 + ((i * 29) % (h * 0.32)), h * 0.025, ['#fff', '#ffd1e3', '#fff3a0'][i % 3], ['#ffd24a', '#ff7fae', '#ffb52e'][i % 3], 5, 0); }
    else if (kind === 1) {
      for (let i = 0; i < 7; i++) { const tx = i * w / 6, th = h * (0.6 + (i % 2) * 0.15); c.fillStyle = i % 2 ? '#3d6e52' : '#2f5c45'; rr(c, tx - w * 0.03, h - th, w * 0.06, th, 6); c.fill(); c.fillStyle = i % 2 ? '#4f8a5f' : '#447d55'; c.beginPath(); c.arc(tx, h - th, w * 0.12, 0, TAU); c.fill(); }
      hill(h * 0.78, '#7bb26a', 1, h * 0.03);
      for (let i = 0; i < 6; i++) A.mushroom(c, w * 0.1 + i * w * 0.16, h * 0.84 + (i % 2) * h * 0.04, h * 0.007 * (1 + (i % 3) * 0.3), i % 2 ? '#ff9b6b' : '#ff6b7d');
      for (let i = 0; i < 10; i++) glow(c, (i * 97) % w, h * 0.3 + (i * 41) % (h * 0.4), h * 0.04, '#e8ffb0', 0.5);
    } else {
      hill(h * 0.6, '#2c3a6e', 0, h * 0.03);
      c.beginPath(); c.ellipse(w * 0.5, h * 0.78, w * 0.42, h * 0.12, 0, 0, TAU); const lg = c.createLinearGradient(0, h * 0.66, 0, h * 0.9); lg.addColorStop(0, '#7f8fe0'); lg.addColorStop(1, '#2c3a8a'); c.fillStyle = lg; c.fill();
      for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,255,220,0.7)'; c.fillRect(w * 0.15 + (i * 37) % (w * 0.7), h * 0.72 + (i * 13) % (h * 0.12), 6, 1.5); }
      c.fillStyle = '#1f2a55'; c.fillRect(0, h * 0.9, w, h);
      for (let i = 0; i < 8; i++) glow(c, (i * 83 + 20) % w, h * 0.45 + (i * 29) % (h * 0.3), h * 0.03, '#d6ff8a', 0.7);
    }
    // 엽서마다 다른 소품
    const props = [
      [() => butterfly(c, w * 0.7, h * 0.4, h * 0.012, t), () => A.honey(c, w * 0.72, h * 0.8, h * 0.012), () => { rr(c, w * 0.62, h * 0.52, w * 0.2, h * 0.18, 8); c.fillStyle = '#ffd1e3'; c.fill(); c.strokeStyle = '#c45a92'; c.lineWidth = 2; c.stroke(); }],
      [() => A.mushroom(c, w * 0.72, h * 0.78, h * 0.02, '#ff6b7d'), () => squirrel(c, w * 0.72, h * 0.82, h * 0.011), () => { for (let i = 0; i < 5; i++) glow(c, w * (0.6 + i * 0.06), h * (0.5 + Math.sin(i) * 0.08), h * 0.06, '#e8ffb0', 0.9); }],
      [() => { for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(255,255,220,0.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(w * (0.2 + i * 0.2), h * 0.1); c.lineTo(w * (0.15 + i * 0.2), h * 0.25); c.stroke(); } }, () => A.starfruit(c, w * 0.72, h * 0.62, h * 0.016), () => { c.beginPath(); c.ellipse(w * 0.7, h * 0.78, w * 0.08, h * 0.02, 0, 0, TAU); c.fillStyle = '#ffd36b'; c.fill(); glow(c, w * 0.7, h * 0.75, h * 0.12, '#ffe08a', 0.7); }],
    ];
    props[kind][v % 3]();
    A.mongle(c, w * 0.36, h * 0.9, h * 0.0062, { stage: 2, pal: pal || 'mint', t: t, mood: 'happy', bag: true, look: 1 });
    c.restore();
  };
  function butterfly(c, x, y, s, t) {
    c.save(); c.translate(x, y); const f = Math.abs(Math.sin(t * 8)) * 0.7 + 0.3;
    for (const sx of [-1, 1]) { c.save(); c.scale(sx * f, 1); c.beginPath(); c.ellipse(8 * s, -5 * s, 9 * s, 7 * s, -0.4, 0, TAU); c.ellipse(7 * s, 6 * s, 6 * s, 5 * s, 0.4, 0, TAU); const g = c.createRadialGradient(6 * s, 0, 1, 6 * s, 0, 12 * s); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#ff9a5c'); c.fillStyle = g; c.fill(); c.strokeStyle = '#a0522d'; c.lineWidth = 1 * s; c.stroke(); c.restore(); }
    c.fillStyle = '#5a3a2a'; c.beginPath(); c.ellipse(0, 0, 1.6 * s, 8 * s, 0, 0, TAU); c.fill();
    c.restore();
  }
  function squirrel(c, x, y, s) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(10 * s, 0); c.bezierCurveTo(34 * s, -6 * s, 34 * s, -40 * s, 14 * s, -36 * s); c.bezierCurveTo(26 * s, -28 * s, 22 * s, -10 * s, 8 * s, -8 * s); c.closePath();
    c.fillStyle = '#d98a4a'; c.fill(); c.strokeStyle = '#7a4520'; c.lineWidth = 1.5 * s; c.stroke();
    c.beginPath(); c.ellipse(0, -10 * s, 11 * s, 12 * s, 0, 0, TAU); c.fillStyle = '#e9a060'; c.fill(); c.stroke();
    c.beginPath(); c.arc(-2 * s, -26 * s, 9 * s, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-8 * s, -32 * s); c.lineTo(-6 * s, -40 * s); c.lineTo(-2 * s, -33 * s); c.fill(); c.stroke();
    c.fillStyle = '#2b1d24'; c.beginPath(); c.arc(-5 * s, -27 * s, 1.8 * s, 0, TAU); c.fill();
    c.fillStyle = '#fff3e0'; c.beginPath(); c.ellipse(-2 * s, -8 * s, 6 * s, 7 * s, 0, 0, TAU); c.fill();
    c.restore();
  }
  A.butterfly = butterfly;

  W.MongleArt = A;
})(window);
