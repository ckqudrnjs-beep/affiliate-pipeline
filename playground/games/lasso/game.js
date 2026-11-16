// 네온 올가미 (BK가 안티그래비티로 만든 오리지널 게임을 5락실 틀에 맞춰 옮김, 2026-11-16)
// 오늘의 판 = 시작 배치를 KST 날짜로 고정 + 순위(submitScore). 연습 = 순위 없음. 코인은 Bonus.played 만.
(function(){
  const G = 'lasso';
  const canvas = document.getElementById('nlCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Synthesized Retro Arcade Sound Engine (Web Audio API - 100% procedural, zero external files)
  let muted = false;
  let actx = null;
  function sfx(type) {
    if (muted) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const now = actx.currentTime;

      if (type === 'catch') {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(380, now);
        o.frequency.exponentialRampToValueAtTime(880, now + 0.14);
        g.gain.setValueAtTime(0.11, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        o.connect(g); g.connect(actx.destination);
        o.start(now); o.stop(now + 0.15);
      } else if (type === 'super') {
        [523.25, 659.25, 783.99, 1046.5].forEach((fr, idx) => {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = 'square';
          o.frequency.setValueAtTime(fr, now + idx * 0.045);
          g.gain.setValueAtTime(0.07, now + idx * 0.045);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.16);
          o.connect(g); g.connect(actx.destination);
          o.start(now + idx * 0.045); o.stop(now + idx * 0.045 + 0.16);
        });
      } else if (type === 'mine') {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(190, now);
        o.frequency.linearRampToValueAtTime(65, now + 0.25);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        o.connect(g); g.connect(actx.destination);
        o.start(now); o.stop(now + 0.26);
      } else if (type === 'boss') {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(240, now);
        o.frequency.exponentialRampToValueAtTime(960, now + 0.3);
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        o.connect(g); g.connect(actx.destination);
        o.start(now); o.stop(now + 0.32);
      }
    } catch(e) {}
  }

  // Seeded PRNG for Daily Mode
  function createRng(seedStr) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
    }
    return function() {
      h += 0x6D2B79F5;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getKstDay() {
    return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  }

  const BEST_KEY = 'nr_best_lasso';
  let bestScore = 0;
  try { bestScore = +localStorage.getItem(BEST_KEY) || 0; } catch(e) {}
  document.getElementById('hudBest').textContent = bestScore.toLocaleString();

  // 휴대폰 세로 화면은 640×750, 그 밖은 800×600 (넓이는 둘 다 48만 픽셀로 같게)
  const PORTRAIT = matchMedia('(max-width:560px)').matches;
  const W = PORTRAIT ? 640 : 800, H = PORTRAIT ? 750 : 600;
  canvas.width = W; canvas.height = H;
  let isDaily = true;
  let rng = createRng('daily-' + getKstDay());

  // Game State
  let running = false;
  let score = 0;
  let timeLeft = 90.0;
  let elapsed = 0;
  let combo = 0;
  let comboTimer = 0;
  let maxCombo = 0;
  let maxCatchOneLoop = 0;
  let pureLoopCount = 0;
  let bossKillCount = 0;
  let magnetTimer = 0;
  let screenShake = 0;
  let bossSpawnedAt60 = false;
  let bossSpawnedAt120 = false;

  // Entities
  let orbs = [];
  let mines = [];
  let particles = [];
  let floatTexts = [];
  let shockwaves = [];

  // Lasso Trail State
  const MAX_TRAIL = 72;
  let trail = []; // [{x, y}]
  let isDrawing = false;

  // Keyboard Cursor State
  let kbCursor = { x: W / 2, y: H / 2, active: false };
  let keys = {};

  const ORB_TYPES = [
    { id: 'cyan', col: '#22d3ee', glow: '#22d3ee88', basePts: 100, r: 15 },
    { id: 'pink', col: '#ff3d7f', glow: '#ff3d7f88', basePts: 100, r: 15 },
    { id: 'gold', col: '#ffd23f', glow: '#ffd23f99', basePts: 250, r: 17 }
  ];

  function spawnOrb(forcedKind) {
    const roll = rng();
    let kind = forcedKind;
    if (!kind) {
      if (roll < 0.42) kind = 'cyan';
      else if (roll < 0.84) kind = 'pink';
      else if (roll < 0.94) kind = 'gold';
      else if (roll < 0.97) kind = 'clock';
      else kind = 'magnet';
    }

    const margin = 52;
    const x = margin + rng() * (W - margin * 2);
    const y = margin + rng() * (H - margin * 2);
    const spdBase = 55 + Math.min(85, elapsed * 0.55);
    const ang = rng() * Math.PI * 2;

    if (kind === 'boss') {
      orbs.push({
        kind: 'boss', col: '#b06bff', r: 34, hp: 3, maxHp: 3, basePts: 1000,
        x: W / 2, y: 90, vx: Math.cos(ang) * 75, vy: Math.sin(ang) * 75, pulse: 0
      });
      addFloatText(W / 2, 130, '⚠️ 보스 출현! 고리로 3번 감싸세요!', '#b06bff', 22);
      return;
    }

    if (kind === 'clock') {
      orbs.push({
        kind: 'clock', col: '#3ddc84', r: 17, hp: 1, basePts: 200,
        x, y, vx: Math.cos(ang) * spdBase, vy: Math.sin(ang) * spdBase, pulse: rng() * 6
      });
      return;
    }

    if (kind === 'magnet') {
      orbs.push({
        kind: 'magnet', col: '#ffffff', r: 17, hp: 1, basePts: 200,
        x, y, vx: Math.cos(ang) * spdBase, vy: Math.sin(ang) * spdBase, pulse: rng() * 6
      });
      return;
    }

    const meta = ORB_TYPES.find(t => t.id === kind) || ORB_TYPES[0];
    orbs.push({
      kind: meta.id, col: meta.col, r: meta.r, hp: 1, basePts: meta.basePts,
      x, y, vx: Math.cos(ang) * spdBase, vy: Math.sin(ang) * spdBase, pulse: rng() * 6
    });
  }

  function spawnMine() {
    const margin = 70;
    const x = margin + rng() * (W - margin * 2);
    const y = margin + rng() * (H - margin * 2);
    const ang = rng() * Math.PI * 2;
    const spd = 42 + Math.min(50, elapsed * 0.35);
    mines.push({
      x, y, r: 16, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, rot: 0
    });
  }

  function addParticles(x, y, col, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 210;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        r: 2.5 + Math.random() * 4, col, life: 0.45 + Math.random() * 0.35, maxLife: 0.8
      });
    }
  }

  function addFloatText(x, y, text, col, size) {
    floatTexts.push({
      x: Math.max(90, Math.min(W - 90, x)),
      y: Math.max(50, Math.min(H - 40, y)),
      text, col: col || '#ffd23f', size: size || 20, life: 1.15
    });
  }

  function startGame() {
    const seed = isDaily ? ('nl-daily-' + getKstDay()) : ('nl-free-' + Date.now() + '-' + Math.random());
    rng = createRng(seed);

    running = true;
    score = 0;
    timeLeft = 90.0;
    elapsed = 0;
    combo = 0;
    comboTimer = 0;
    maxCombo = 0;
    maxCatchOneLoop = 0;
    pureLoopCount = 0;
    bossKillCount = 0;
    magnetTimer = 0;
    screenShake = 0;
    bossSpawnedAt60 = false;
    bossSpawnedAt120 = false;

    orbs = [];
    mines = [];
    particles = [];
    floatTexts = [];
    shockwaves = [];
    trail = [];
    isDrawing = false;

    for (let i = 0; i < 11; i++) spawnOrb();
    for (let i = 0; i < 2; i++) spawnMine();

    document.getElementById('startOverlay').hidden = true;
    document.getElementById('overOverlay').hidden = true;
    updateHud();
  }

  function endGame() {
    running = false;
    isDrawing = false;
    trail = [];

    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch(e) {}
      document.getElementById('hudBest').textContent = bestScore.toLocaleString();
    }

    // 오늘의 판만 순위에 올림(submitScore 가 첫 플레이 코인·미션도 처리). 연습은 미션·첫 플레이만.
    if (isDaily && !window.__nlDebug && typeof window.submitScore === 'function') { try { window.submitScore(score); } catch(e) {} }
    else if (window.Bonus && typeof window.Bonus.played === 'function') { try { window.Bonus.played(G); } catch(e) {} }

    document.getElementById('overBadge').textContent = isDaily ? `오늘의 공식 판 (${getKstDay()})` : '무한 랜덤 연습 판';
    document.getElementById('overTitle').textContent = score >= 50000 ? '👑 SUPERNOVA MASTER!' : score >= 25000 ? '⚡ NEON LASSO ACE!' : 'TIME OVER!';
    document.getElementById('overScore').textContent = score.toLocaleString() + ' PTS';
    document.getElementById('overMaxCombo').textContent = maxCombo + '콤보';
    document.getElementById('overMaxCatch').textContent = maxCatchOneLoop + '개';
    document.getElementById('overPureCount').textContent = pureLoopCount + '회';
    document.getElementById('overBossCount').textContent = bossKillCount + '회';

    let msg = '한 번에 5마리 이상 묶는 슈퍼노바(시간 +3초)를 노리면 기록이 수직 상승합니다!';
    if (score >= 60000) msg = '경이로운 올가미 컨트롤입니다! 오늘의 순위표 최상위권 실력이에요!';
    else if (pureLoopCount >= 5) msg = '같은 색만 골라 묶는 순수 공명(x2.0) 활용이 아주 날카로웠습니다!';
    document.getElementById('overComment').textContent = msg;
    document.getElementById('overOverlay').hidden = false;
  }

  // Geometry Helpers: Segment Intersection & Point-in-Polygon (Ray-Casting)
  function ccw(A, B, C) {
    return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  }
  function segmentsIntersect(A, B, C, D) {
    return (ccw(A, C, D) !== ccw(B, C, D)) && (ccw(A, B, C) !== ccw(A, B, D));
  }
  function pointInPolygon(px, py, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-7) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function distToSegment(px, py, A, B) {
    const dx = B.x - A.x, dy = B.y - A.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - A.x, py - A.y);
    let t = ((px - A.x) * dx + (py - A.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (A.x + t * dx), py - (A.y + t * dy));
  }

  function addTrailPoint(x, y) {
    if (!running) return;
    x = Math.max(8, Math.min(W - 8, x));
    y = Math.max(8, Math.min(H - 8, y));

    if (trail.length > 0) {
      const last = trail[trail.length - 1];
      if (Math.hypot(x - last.x, y - last.y) < 7) return;
    }

    trail.push({ x, y });
    if (trail.length > MAX_TRAIL) trail.shift();

    // Check if the new segment intersects any earlier segment to form a closed loop!
    const n = trail.length;
    if (n >= 8) {
      const p1 = trail[n - 2];
      const p2 = trail[n - 1];
      for (let i = 0; i <= n - 5; i++) {
        const q1 = trail[i];
        const q2 = trail[i + 1];
        const closeStart = (i === 0 && Math.hypot(p2.x - q1.x, p2.y - q1.y) < 26);
        if (closeStart || segmentsIntersect(p1, p2, q1, q2)) {
          const loopPoly = trail.slice(i, n);
          resolveLoop(loopPoly);
          trail = [];
          break;
        }
      }
    }
  }

  function resolveLoop(poly) {
    // Compute loop centroid
    let cx = 0, cy = 0;
    poly.forEach(p => { cx += p.x; cy += p.y; });
    cx /= poly.length;
    cy /= poly.length;

    // 1. Check if any mine is trapped inside the loop
    let trappedMines = [];
    for (let i = mines.length - 1; i >= 0; i--) {
      if (pointInPolygon(mines[i].x, mines[i].y, poly)) {
        trappedMines.push(mines[i]);
        mines.splice(i, 1);
      }
    }

    if (trappedMines.length > 0) {
      sfx('mine');
      screenShake = 0.35;
      combo = 0;
      comboTimer = 0;
      timeLeft = Math.max(0, timeLeft - 4.0);
      trappedMines.forEach(m => addParticles(m.x, m.y, '#ff3d7f', 24));
      addFloatText(cx, cy, '💣 기뢰 포획! 시간 -4초 · 콤보 초기화!', '#ff3d7f', 21);
      spawnMine();
      updateHud();
      return;
    }

    // 2. Check trapped orbs
    let caught = [];
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (pointInPolygon(o.x, o.y, poly)) {
        caught.push({ orb: o, idx: i });
      }
    }

    if (caught.length === 0) return;

    const count = caught.length;
    maxCatchOneLoop = Math.max(maxCatchOneLoop, count);

    // Check Pure Color Resonance (2+ orbs of the exact same basic color)
    const colorSet = new Set(caught.map(c => c.orb.kind).filter(k => k === 'cyan' || k === 'pink' || k === 'gold'));
    const hasOnlyOneColor = colorSet.size === 1 && caught.every(c => c.orb.kind === [...colorSet][0]);
    const isPure = count >= 2 && hasOnlyOneColor;
    if (isPure) pureLoopCount++;

    combo += count;
    comboTimer = 3.6;
    maxCombo = Math.max(maxCombo, combo);
    const comboMult = Math.min(4.0, 1 + Math.floor(combo / 3) * 0.25);

    let baseSum = 0;
    caught.forEach(({ orb, idx }) => {
      baseSum += orb.basePts;
      addParticles(orb.x, orb.y, orb.col, 16);

      if (orb.kind === 'clock') {
        timeLeft += 4.0;
        addFloatText(orb.x, orb.y - 18, '⏳ 시간 +4.0초!', '#3ddc84', 20);
      } else if (orb.kind === 'magnet') {
        magnetTimer = 3.8;
        addFloatText(orb.x, orb.y - 18, '🧲 자석 프리즘 발동! 전체 흡입!', '#22d3ee', 21);
      }

      if (orb.kind === 'boss') {
        orb.hp--;
        sfx('boss');
        if (orb.hp <= 0) {
          bossKillCount++;
          score += 3000;
          timeLeft += 5.0;
          addParticles(orb.x, orb.y, '#ffd23f', 45);
          addFloatText(orb.x, orb.y, '👑 보스 격파! +3,000점 & +5초!', '#ffd23f', 24);
          orbs.splice(idx, 1);
        } else {
          addFloatText(orb.x, orb.y, `👾 보스 타격! (남은 보호막 ${orb.hp})`, '#b06bff', 19);
        }
      } else {
        orbs.splice(idx, 1);
      }
    });

    // Score Formula: BaseSum * Count * ComboMult * PureMult
    const pureMult = isPure ? 2.0 : 1.0;
    const loopPts = Math.round(baseSum * count * comboMult * pureMult);
    score += loopPts;

    // Supernova bonus for 5+ orbs in a single loop
    if (count >= 5) {
      sfx('super');
      timeLeft += 3.0;
      screenShake = 0.28;
      shockwaves.push({ x: cx, y: cy, r: 10, maxR: 340, col: '#ffd23f', life: 0.55 });
      addFloatText(cx, cy - 26, `🌟 SUPERNOVA (${count}마리)! +${loopPts.toLocaleString()}점 & +3초!`, '#ffd23f', 23);
    } else {
      sfx('catch');
      shockwaves.push({ x: cx, y: cy, r: 10, maxR: 160, col: isPure ? '#3ddc84' : '#22d3ee', life: 0.4 });
      const tag = isPure ? `✨순수 공명(x2)! +${loopPts.toLocaleString()}점` : `${count}마리 포획! +${loopPts.toLocaleString()}점`;
      addFloatText(cx, cy, tag, isPure ? '#3ddc84' : '#ffffff', count >= 3 ? 21 : 18);
    }

    // Respawn orbs to keep arena lively
    while (orbs.length < 11 + Math.min(5, Math.floor(elapsed / 25))) {
      spawnOrb();
    }
    updateHud();
  }

  function updateHud() {
    document.getElementById('hudScore').textContent = score.toLocaleString();
    document.getElementById('hudTime').textContent = Math.max(0, timeLeft).toFixed(1) + 's';
    const mult = Math.min(4.0, 1 + Math.floor(combo / 3) * 0.25).toFixed(2);
    document.getElementById('hudCombo').textContent = `x${mult} (${combo})`;
  }

  let lastTs = performance.now();
  function gameLoop(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    if (running) {
      elapsed += dt;
      timeLeft -= dt;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateHud();
        endGame();
      } else {
        // Combo decay
        if (combo > 0) {
          comboTimer -= dt;
          if (comboTimer <= 0) {
            combo = 0;
          }
        }
        if (magnetTimer > 0) magnetTimer -= dt;
        if (screenShake > 0) screenShake = Math.max(0, screenShake - dt);

        // Timed Boss & Mine Scaling
        if (elapsed >= 45 && !bossSpawnedAt60) {
          bossSpawnedAt60 = true;
          spawnOrb('boss');
          if (mines.length < 4) spawnMine();
        }
        if (elapsed >= 95 && !bossSpawnedAt120) {
          bossSpawnedAt120 = true;
          spawnOrb('boss');
          if (mines.length < 5) spawnMine();
        }

        // Keyboard movement support
        const kbSpd = (keys[' '] || keys['Shift']) ? 540 : 370;
        let kx = 0, ky = 0;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) kx -= 1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) kx += 1;
        if (keys['ArrowUp'] || keys['w'] || keys['W']) ky -= 1;
        if (keys['ArrowDown'] || keys['s'] || keys['S']) ky += 1;
        if (kx !== 0 || ky !== 0) {
          kbCursor.active = true;
          const len = Math.hypot(kx, ky);
          kbCursor.x = Math.max(14, Math.min(W - 14, kbCursor.x + (kx / len) * kbSpd * dt));
          kbCursor.y = Math.max(14, Math.min(H - 14, kbCursor.y + (ky / len) * kbSpd * dt));
          addTrailPoint(kbCursor.x, kbCursor.y);
        }

        // Update Orbs
        orbs.forEach(o => {
          o.pulse += dt * 4;
          if (magnetTimer > 0 && o.kind !== 'boss') {
            const dx = W / 2 - o.x, dy = H / 2 - o.y;
            o.x += dx * 2.4 * dt;
            o.y += dy * 2.4 * dt;
          } else {
            o.x += o.vx * dt;
            o.y += o.vy * dt;
          }
          if (o.x < o.r + 12) { o.x = o.r + 12; o.vx = Math.abs(o.vx); }
          if (o.x > W - o.r - 12) { o.x = W - o.r - 12; o.vx = -Math.abs(o.vx); }
          if (o.y < o.r + 12) { o.y = o.r + 12; o.vy = Math.abs(o.vy); }
          if (o.y > H - o.r - 12) { o.y = H - o.r - 12; o.vy = -Math.abs(o.vy); }
        });

        // Update Mines & Check collision with active Lasso Line
        for (let i = 0; i < mines.length; i++) {
          const m = mines[i];
          m.rot += dt * 2.5;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.x < m.r + 12) { m.x = m.r + 12; m.vx = Math.abs(m.vx); }
          if (m.x > W - m.r - 12) { m.x = W - m.r - 12; m.vx = -Math.abs(m.vx); }
          if (m.y < m.r + 12) { m.y = m.r + 12; m.vy = Math.abs(m.vy); }
          if (m.y > H - m.r - 12) { m.y = H - m.r - 12; m.vy = -Math.abs(m.vy); }

          // If player's active trail touches a mine, snap the line!
          if (trail.length >= 2) {
            for (let j = 0; j < trail.length - 1; j++) {
              if (distToSegment(m.x, m.y, trail[j], trail[j + 1]) < m.r + 3) {
                sfx('mine');
                trail = [];
                isDrawing = false;
                screenShake = 0.22;
                combo = 0;
                timeLeft = Math.max(0, timeLeft - 2.0);
                addParticles(m.x, m.y, '#ff3d7f', 18);
                addFloatText(m.x, m.y, '⚡ 기뢰 접촉! 올가미 끊김 (-2초)', '#ff3d7f', 18);
                break;
              }
            }
          }
        }

        updateHud();
      }
    }

    // Update Particles, Shockwaves, FloatTexts
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.r += (sw.maxR - sw.r) * 8 * dt;
      sw.life -= dt;
      if (sw.life <= 0) shockwaves.splice(i, 1);
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const ft = floatTexts[i];
      ft.y -= 32 * dt;
      ft.life -= dt;
      if (ft.life <= 0) floatTexts.splice(i, 1);
    }

    drawArena();
    requestAnimationFrame(gameLoop);
  }

  function drawArena() {
    ctx.save();
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * 14;
      const sy = (Math.random() - 0.5) * 14;
      ctx.translate(sx, sy);
    }

    // Background & Cyber Grid
    ctx.fillStyle = '#070314';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = magnetTimer > 0 ? '#22d3ee28' : '#3a2b6e33';
    ctx.lineWidth = 1;
    for (let x = 40; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 40; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Shockwaves
    shockwaves.forEach(sw => {
      ctx.strokeStyle = sw.col;
      ctx.globalAlpha = Math.max(0, sw.life * 2);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw Orbs
    orbs.forEach(o => {
      const r = o.r + Math.sin(o.pulse) * 1.8;
      ctx.save();
      ctx.translate(o.x, o.y);

      // Outer Neon Glow
      const grad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.7);
      grad.addColorStop(0, o.col);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2);
      ctx.fill();

      // Core Body
      ctx.fillStyle = o.col;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.28, -r * 0.28, r * 0.28, 0, Math.PI * 2);
      ctx.fill();

      if (o.kind === 'clock' || o.kind === 'magnet' || o.kind === 'boss') {
        ctx.font = o.kind === 'boss' ? '24px sans-serif' : '15px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icon = o.kind === 'clock' ? '⏳' : o.kind === 'magnet' ? '🧲' : `👾${o.hp}`;
        ctx.fillText(icon, 0, 1);
      }
      ctx.restore();
    });

    // Draw Spiky Mines
    mines.forEach(m => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.rot);
      ctx.strokeStyle = '#ff3d7f';
      ctx.fillStyle = '#2a081e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const spikes = 8;
      for (let i = 0; i < spikes * 2; i++) {
        const rad = (i % 2 === 0) ? m.r + 5 : m.r - 4;
        const a = (i * Math.PI) / spikes;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff3d7f';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Lasso Trail
    if (trail.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 5;
      ctx.beginPath();
      trail.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Start Anchor Ring so player sees where to close the loop
      const first = trail[0];
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(first.x, first.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Draw Particles
    particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw Floating Score Texts
    floatTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life * 1.4);
      ctx.font = `800 ${ft.size}px "Noto Sans KR", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#070314';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.col;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    ctx.restore();
  }

  // Pointer & Touch Events
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H
    };
  }

  canvas.addEventListener('mousedown', e => {
    if (!running) return;
    isDrawing = true;
    trail = [];
    const pt = getCanvasCoords(e);
    addTrailPoint(pt.x, pt.y);
  });
  window.addEventListener('mousemove', e => {
    if (!running || !isDrawing) return;
    const pt = getCanvasCoords(e);
    addTrailPoint(pt.x, pt.y);
  });
  window.addEventListener('mouseup', () => {
    isDrawing = false;
    trail = [];
  });

  canvas.addEventListener('touchstart', e => {
    if (!running) return;
    e.preventDefault();
    isDrawing = true;
    trail = [];
    const pt = getCanvasCoords(e);
    addTrailPoint(pt.x, pt.y);
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    if (!running || !isDrawing) return;
    e.preventDefault();
    const pt = getCanvasCoords(e);
    addTrailPoint(pt.x, pt.y);
  }, { passive: false });

  window.addEventListener('touchend', () => {
    isDrawing = false;
    trail = [];
  });

  window.addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key) && running) {
      e.preventDefault();
    }
    keys[e.key] = true;
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // UI Buttons
  document.getElementById('btnStartGame').onclick = startGame;
  document.getElementById('btnRetry').onclick = startGame;

  document.getElementById('btnDailySeed').onclick = function() {
    isDaily = true;
    this.classList.add('on');
    document.getElementById('btnFreeSeed').classList.remove('on');
    if (running) startGame();
  };
  document.getElementById('btnFreeSeed').onclick = function() {
    isDaily = false;
    this.classList.add('on');
    document.getElementById('btnDailySeed').classList.remove('on');
    if (running) startGame();
  };
  document.getElementById('btnMute').onclick = function() {
    muted = !muted;
    this.setAttribute('aria-pressed', muted);
    this.textContent = muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
  };

  document.getElementById('btnShareResult').onclick = function() {
    const modeLabel = isDaily ? `오늘의 판(${getKstDay()})` : '무한 랜덤 판';
    const url = (isDaily && typeof window.challengeUrl === 'function') ? challengeUrl(score) : location.origin + location.pathname;
    const text = `🧲 5락실 네온 올가미 ${modeLabel}: ${score.toLocaleString()}점 (최대 ${maxCombo}콤보 · 한 번에 ${maxCatchOneLoop}개)\n이겨 볼래? ${url}`;
    if (typeof window.shareLink === 'function') {
      window.shareLink('5락실 네온 올가미', url, text);
    } else if (navigator.share) {
      navigator.share({ title: '5락실 네온 올가미', text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.textContent = '✅ 기록 복사됨!';
        setTimeout(() => { this.textContent = '📤 내 기록 공유하기'; }, 2000);
      });
    }
  };

  // 테스트용: 주소 끝 #nldebug → window.__nl (디버그 판은 순위에 안 올림)
  if (location.hash === '#nldebug') {
    window.__nlDebug = true;
    window.__nl = { start: startGame, loop: pts => resolveLoop(pts), orbs: () => orbs, mines: () => mines, state: () => ({ score, timeLeft, combo, running }), end: () => { timeLeft = 0; } };
  }

  // Seed some background preview orbs before game starts
  for (let i = 0; i < 9; i++) spawnOrb();
  requestAnimationFrame(gameLoop);
})();
