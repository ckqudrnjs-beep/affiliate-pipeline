/* ---------- 대장간 연출: 강화·옵션 다시 굴리기 결과를 크게 보여 준다 (2026-11-15 BK "성공과 실패를 극적으로") ---------- */
// 0~0.95초: 망치질(물건이 떨리고 불똥이 튐, 점점 빨라짐) → 결과: 성공(흰 번쩍 + 금빛 햇살 + 불꽃 + 튀어 오름) · 두 단계(무지개)
// 축복이 지킴(푸른 방패가 깨짐) · 실패(붉은 번쩍 + 금 가고 화면 흔들림 + 조각이 떨어짐) · 다시 굴리기(보랏빛 소용돌이). 누르면 바로 닫힘.
const FORGE = { el: null, cv: null, raf: 0 };
function forgeFx(it, kind, text, sub) {
  if (!FORGE.el) { const d = document.createElement('div'); d.className = 'sk-forge'; d.style.cssText = 'position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(10,8,20,.74);cursor:pointer';
    const c = document.createElement('canvas'); c.style.cssText = 'width:min(92vw,520px);height:min(92vw,520px,86vh);max-height:86vh'; d.appendChild(c); d.onclick = forgeEnd; ov.appendChild(d); FORGE.el = d; FORGE.cv = c; }
  cancelAnimationFrame(FORGE.raf); const el = FORGE.el, c = FORGE.cv, dpr = Math.min(2, devicePixelRatio || 1), W = 520; el.style.display = 'flex'; c.width = W * dpr; c.height = W * dpr;
  const g = c.getContext('2d'), t0 = performance.now(), HIT = .95, END = kind === 'fail' ? 3 : 3.2, P = [], col = kind === 'fail' ? '#ff4a3a' : kind === 'keep' ? '#6ab4ff' : kind === 'reroll' ? '#c9a8ff' : kind === 'double' ? '#ffffff' : '#ffd166';
  const big = kind === 'double' || (kind === 'ok' && it.en >= 7), cracks = []; let hit = 0, lastHam = -1;
  for (let i = 0; i < 7; i++) { const a = Math.random() * TAU, L = []; let x2 = 0, y2 = 0; for (let j = 0; j < 5; j++) { x2 += Math.cos(a + rnd(-.6, .6)) * rnd(14, 26); y2 += Math.sin(a + rnd(-.6, .6)) * rnd(14, 26); L.push([x2, y2]); } cracks.push(L); }
  const burst = (n, sp, cs, grav, sz) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * .3, sp); P.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? 120 : 0), g: grav, t: 0, life: rnd(.6, 1.4), c: pick(cs), s: rnd(sz * .5, sz) }); } };
  const frame = now => { const t = (now - t0) / 1000; if (t > END) { forgeEnd(); return; } FORGE.raf = requestAnimationFrame(frame);
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W); const cx = W / 2, cy = W / 2 - 20;
    // 망치질 박자: 점점 빨라지는 쾅쾅 + 불똥
    if (t < HIT) { const beat = Math.floor(Math.pow(t / HIT, .6) * 5); if (beat !== lastHam) { lastHam = beat; sfx('slam'); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + rnd(-1.2, 1.2), v = rnd(160, 380); P.push({ x: 0, y: 40, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, t: 0, life: rnd(.3, .6), c: pick(['#ffd166', '#ff9a3a', '#fff4c0']), s: rnd(2, 4) }); } } }
    if (t >= HIT && !hit) { hit = 1; if (kind === 'fail') { sfx('fail'); burst(26, 260, ['#5a4a40', '#8a7a6a', '#3a2a20'], 1, 9); } else if (kind === 'keep') { sfx('gust'); burst(30, 300, ['#6ab4ff', '#bfe8ff', '#ffffff'], 0, 6); } else { sfx('lvl'); sfx('ench'); burst(big ? 70 : 44, big ? 460 : 340, kind === 'double' ? ['#ff6a6a', '#ffd23a', '#6aff8a', '#6ab4ff', '#c96aff'] : kind === 'reroll' ? ['#c9a8ff', '#ffffff', '#9fe4ff'] : ['#ffd166', '#fff4c0', '#ffffff', '#ffb03a'], 0, big ? 8 : 6); } }
    const k = t < HIT ? 0 : (t - HIT);
    // 배경 빛
    if (hit && kind !== 'fail') { g.save(); g.translate(cx, cy); g.rotate(t * (kind === 'reroll' ? 2.2 : .6)); const rays = kind === 'reroll' ? 6 : 14, R = 300 * Math.min(1, k * 3);
      for (let i = 0; i < rays; i++) { g.rotate(TAU / rays); const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, kind === 'double' ? `hsla(${(i * 50 + t * 200) % 360},100%,70%,.55)` : col + '99'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * .12); g.lineTo(R, R * .12); g.closePath(); g.fill(); } g.restore(); }
    { const pu = t < HIT ? .3 + t / HIT * .4 + Math.sin(t * 30) * .08 : kind === 'fail' ? Math.max(0, .5 - k) : .9, gr = g.createRadialGradient(cx, cy, 10, cx, cy, 170); gr.addColorStop(0, t < HIT ? '#ffb03a' : col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = pu; g.fillStyle = gr; g.fillRect(0, 0, W, W); g.globalAlpha = 1; }
    if (kind === 'keep' && hit && k < .7) { g.strokeStyle = '#bfe8ff'; g.lineWidth = 6 * (1 - k); g.globalAlpha = 1 - k / .7; g.beginPath(); g.arc(cx, cy, 120 + k * 160, 0, TAU); g.stroke(); g.globalAlpha = 1; }
    // 물건: 망치질 동안 떨림, 결과 때 튀어 오름(성공) / 가라앉고 흑백(실패)
    const sh = t < HIT ? (2 + t / HIT * 9) : kind === 'fail' && k < .5 ? 14 * (1 - k * 2) : 0, sc = t < HIT ? 1 + Math.sin(t * 40) * .02 : kind === 'fail' ? 1 - Math.min(.12, k * .3) : 1 + Math.max(0, .35 - k) * (big ? 1.4 : .9) + Math.sin(k * 12) * .04 * Math.max(0, 1 - k);
    const s = 210 * sc; g.save(); g.translate(cx + rnd(-sh, sh), cy + rnd(-sh, sh) + (kind === 'fail' && hit ? Math.min(18, k * 40) : 0)); if (kind === 'fail' && hit) g.filter = `grayscale(${Math.min(1, k * 2)}) brightness(${1 - Math.min(.35, k * .6)})`;
    drawIcon(it, -s / 2, -s / 2, s, g); g.filter = 'none';
    if (kind === 'fail' && hit) { g.strokeStyle = '#1a0a08'; g.lineWidth = 4; g.lineCap = 'round'; const f = Math.min(1, k * 4); for (const L of cracks) { g.beginPath(); g.moveTo(0, 0); for (let j = 0; j < Math.ceil(L.length * f); j++) g.lineTo(L[j][0] * s / 210, L[j][1] * s / 210); g.stroke(); } g.strokeStyle = '#ff6a4a'; g.lineWidth = 1.5; g.stroke(); }
    g.restore();
    // 망치(망치질 동안만)
    if (t < HIT) { const ph = (Math.pow(t / HIT, .6) * 5) % 1, ang = -1.1 + Math.min(1, ph * 3) * 1.25 - Math.max(0, ph - .35) * 1.6; g.save(); g.translate(cx + 150, cy - 40); g.rotate(ang); g.fillStyle = '#6a4428'; g.fillRect(-6, 0, 12, 120); g.fillStyle = '#8a8f9a'; g.fillRect(-34, -6, 68, 34); g.strokeStyle = '#24180f'; g.lineWidth = 3; g.strokeRect(-34, -6, 68, 34); g.strokeRect(-6, 0, 12, 120); g.restore(); }
    // 불똥·조각
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.t += 1 / 60; if (p.t > p.life) { P.splice(i, 1); continue; } p.x += p.vx / 60; p.y += p.vy / 60; if (p.g) p.vy += 900 / 60; p.vx *= .985; p.vy *= p.g ? 1 : .985;
      g.globalAlpha = 1 - p.t / p.life; g.fillStyle = p.c; if (p.g && kind === 'fail' && hit) { g.save(); g.translate(cx + p.x, cy + p.y); g.rotate(p.t * 8); g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .7); g.restore(); } else { g.beginPath(); g.arc(cx + p.x, cy + p.y, p.s, 0, TAU); g.fill(); } } g.globalAlpha = 1;
    // 번쩍
    if (hit && k < .25) { g.globalAlpha = (1 - k / .25) * (kind === 'fail' ? .55 : .85); g.fillStyle = kind === 'fail' ? '#ff2a1a' : '#ffffff'; g.fillRect(0, 0, W, W); g.globalAlpha = 1; }
    // 글씨
    if (hit) { const pop = Math.min(1, k * 5), bounce = 1 + Math.max(0, 1 - k * 4) * .35; g.save(); g.translate(cx, W - 78); g.scale(pop * bounce, pop * bounce); g.textAlign = 'center'; g.font = `900 ${big ? 50 : 44}px system-ui`; g.lineWidth = 9; g.strokeStyle = 'rgba(20,12,8,.9)'; g.strokeText(text, 0, 0);
      if (kind === 'double') { const gr = g.createLinearGradient(-160, 0, 160, 0); for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, `hsl(${(i * 60 + t * 240) % 360},100%,65%)`); g.fillStyle = gr; } else g.fillStyle = col; g.fillText(text, 0, 0);
      if (sub) { g.font = '800 20px system-ui'; g.lineWidth = 6; g.strokeText(sub, 0, 34); g.fillStyle = '#fff'; g.fillText(sub, 0, 34); } g.restore(); }
    else { g.textAlign = 'center'; g.font = '800 22px system-ui'; g.fillStyle = '#fff4c0'; g.globalAlpha = .6 + Math.sin(t * 14) * .4; g.fillText('두근두근…', cx, W - 70); g.globalAlpha = 1; }
    if (kind === 'fail' && hit && k < .5) ov.style.transform = `translate(${rnd(-8, 8) * (1 - k * 2)}px,${rnd(-6, 6) * (1 - k * 2)}px)`; else ov.style.transform = '';
  };
  FORGE.frame = frame; FORGE.t0 = t0; FORGE.raf = requestAnimationFrame(frame);
}
function forgeEnd() { cancelAnimationFrame(FORGE.raf); if (FORGE.el) FORGE.el.style.display = 'none'; if (ov) ov.style.transform = ''; }
// 강화 결과(enchant 의 r) → 연출 종류
function forgeEnch(it, r) { if (r.ok === 1) forgeFx(it, r.up > 1 ? 'double' : 'ok', '+' + it.en + ' 강화 성공!', r.up > 1 ? '두 단계나 올랐어요!' : it.en >= 7 ? '빛이 깃들었어요' : '');
  else if (r.ok === 2) forgeFx(it, 'keep', '실패… 하지만 지켰어요', r.msg.includes('축복이 대신') ? '축복이 대신 사라졌어요' : '축복 덕분에 그대로예요');
  else if (r.ok === 3) forgeFx(it, 'fail', '강화 실패…', '+' + it.en + '(으)로 내려갔어요'); }
