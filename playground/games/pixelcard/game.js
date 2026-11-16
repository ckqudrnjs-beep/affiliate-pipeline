// 게이머 면허증·도트 프사 (BK가 다른 노트북에서 만든 도구를 5락실 틀에 맞춰 옮김, 2026-11-16)
// 사진은 캔버스 안에서만 처리하고 어디로도 보내지 않는다. 코인·아이템은 사이트 공통 Bonus 함수로만 바꾼다(nr_bonus 직접 쓰기 금지).
(function(){
  'use strict';
  const G = 'pixelcard';
  const canvas = document.getElementById('cardCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const B = () => window.Bonus;
  const toast = msg => { if (B() && B().toast) B().toast(msg); };
  const days = () => { const s = B() ? B().state() : null; return Math.max(1, (s && s.days) || 1); };

  // 테두리: 기본 2종 무료, 나머지는 build.py GAME_ITEMS(pixelcard, fr) 로 코인 구매(own 키 g:pixelcard:fr:<id>)
  const FRAMES = [
    { id: '', name: '네온 시안 (기본)', c1: '#22d3ee', c2: '#ff3d7f', bg1: '#170c36', bg2: '#0b051d' },
    { id: 'pink', name: '체리 핑크', c1: '#ff3d7f', c2: '#ffd23f', bg1: '#2e0b2b', bg2: '#120517', free: 1 },
    { id: 'aurora', name: '오로라 그린', c1: '#3ddc84', c2: '#22d3ee', bg1: '#0a2924', bg2: '#061214' },
    { id: 'gold', name: '👑 황금 홀로그램', c1: '#ffd23f', c2: '#ff8a3d', bg1: '#2c1e08', bg2: '#120b04' }
  ];
  const price = id => { const d = (typeof GITEMS !== 'undefined' ? GITEMS : []).find(x => x.g === G && x.k === 'fr' && x.id === id); return d ? d.p : 0; };
  const owns = id => { if (!id) return true; const f = FRAMES.find(x => x.id === id); if (f && f.free) return true; const s = B() ? B().state() : null; return !!(s && s.own && s.own['g:' + G + ':fr:' + id]); };
  let freePick = '';  // 무료 테두리 선택(기기 안에서만)

  const AV_LIST = ['👾','🐱','🐉','🛸','🧑‍🚀','👑','🔥','🤖','🎮','🦊','🐼','🐯','🦄','🥷','⚡','💎'];
  let curTpl = 'license';
  let curAvatar = '👾';
  let uploadedImg = null;
  let usePhoto = false;
  let pixelGrid = 48;
  let paletteMode = 'cyber';
  let curFrame = FRAMES[0];
  let stats = { spd: 92, acc: 88, brn: 90, lck: 85, grt: 96 };
  let measuredMs = null;
  const licenseSerial = '5RK-' + new Date(Date.now() + 9 * 3600e3).toISOString().slice(2,10).replace(/-/g,'') + '-' + Math.floor(1000 + Math.random() * 9000);

  function pickFrame() {
    const paid = B() && B().gitem ? B().gitem(G, 'fr') : '';
    curFrame = FRAMES.find(f => f.id === (paid || freePick)) || FRAMES[0];
  }

  // 프로필(복구 코드로 만든 별명 "아바타 이름")이 있으면 그 아바타·이름으로 시작. 자동 별명은 쓰지 않는다.
  try {
    const n = window.Profile && Profile.nick();
    if (n && n.indexOf(' ') > 0) {
      curAvatar = n.slice(0, n.indexOf(' '));
      if (AV_LIST.indexOf(curAvatar) < 0) AV_LIST.unshift(curAvatar);
      document.getElementById('nickInput').value = n.slice(n.indexOf(' ') + 1).slice(0, 14);
    }
  } catch (e) {}
  // 상점에서 산 칭호(t:<id>)를 칭호 목록 맨 위에
  try {
    const s = B() ? B().state() : null, sel = document.getElementById('titleSel');
    if (s && typeof TITLES !== 'undefined') {
      const cur = B().title && B().title();
      TITLES.filter(t => (s.own && s.own['t:' + t.id]) || ((t.days || t.av) && B().hasTitle && B().hasTitle(t))).reverse().forEach(t => {
        const o = document.createElement('option'); o.value = t.name; o.textContent = '「' + t.name + '」 (내 칭호)'; sel.insertBefore(o, sel.firstChild);
      });
      if (cur) sel.value = cur.name; else sel.selectedIndex = 0;
    }
  } catch (e) {}

  const avStrip = document.getElementById('avStrip');
  function renderAvStrip() {
    avStrip.innerHTML = AV_LIST.map(a =>
      `<button type="button" class="${!usePhoto && curAvatar === a ? 'sel' : ''}" data-av="${a}">${a}</button>`
    ).join('');
    avStrip.querySelectorAll('button').forEach(b => {
      b.onclick = () => { usePhoto = false; curAvatar = b.dataset.av; renderAvStrip(); renderCard(); };
    });
  }
  renderAvStrip();

  const frameGrid = document.getElementById('frameGrid');
  function renderFrameGrid() {
    pickFrame();
    frameGrid.innerHTML = FRAMES.map(f => {
      const ok = owns(f.id), sel = curFrame === f, p = price(f.id);
      return `<button type="button" class="frame-btn ${sel ? 'sel' : ''}${ok ? '' : ' lock'}" data-fid="${f.id}">
        <span><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${f.c1};margin-right:6px"></i>${f.name}</span>
        <span class="cost">${sel ? '사용 중' : ok ? '고르기' : '🪙 ' + p}</span></button>`;
    }).join('');
    frameGrid.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const f = FRAMES.find(x => x.id === b.dataset.fid);
        if (!f || !B()) return;
        if (!f.id || f.free) { B().setGitem(G, 'fr', ''); freePick = f.id; }
        else if (!B().setGitem(G, 'fr', f.id)) return;  // 코인 모자라면 Bonus 가 안내
        renderFrameGrid(); renderCard();
      };
    });
  }
  renderFrameGrid();
  addEventListener('bonus-save', () => { renderFrameGrid(); renderCard(); });  // 미니 상점에서 사도 바로 반영

  // 저장·공유가 실제로 끝났을 때만: 첫 플레이 🪙1(한 번) + 오늘의 미션 '게임 2가지'
  function made() { if (B() && B().played) B().played(G); }

  // Palette color mapping for 8-bit pixelation
  const PALETTES = {
    cyber: [[12,6,32],[26,16,56],[58,43,110],[255,61,127],[34,211,238],[255,210,63],[61,220,132],[244,240,255]],
    gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
    sunset: [[20,10,45],[85,20,90],[180,40,110],[255,90,95],[255,165,60],[255,230,120]],
    gold: [[18,12,4],[56,38,10],[120,82,18],[195,140,35],[255,210,63],[255,248,215]]
  };

  function nearestColor(r, g, b, pal) {
    let best = pal[0], minDist = 1e9;
    for (let i = 0; i < pal.length; i++) {
      const p = pal[i];
      const d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
      if (d < minDist) { minDist = d; best = p; }
    }
    return best;
  }

  // Create pixelated portrait canvas (square)
  function buildPixelPortrait(size) {
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const octx = out.getContext('2d');

    if (usePhoto && uploadedImg) {
      const g = pixelGrid;
      const tiny = document.createElement('canvas');
      tiny.width = g;
      tiny.height = g;
      const tctx = tiny.getContext('2d');

      // Center crop uploaded image
      const sw = uploadedImg.naturalWidth || uploadedImg.width;
      const sh = uploadedImg.naturalHeight || uploadedImg.height;
      const side = Math.min(sw, sh);
      const sx = (sw - side) / 2;
      const sy = (sh - side) / 2;
      tctx.drawImage(uploadedImg, sx, sy, side, side, 0, 0, g, g);

      if (paletteMode !== 'orig' && PALETTES[paletteMode]) {
        const imgData = tctx.getImageData(0, 0, g, g);
        const d = imgData.data;
        const pal = PALETTES[paletteMode];
        for (let i = 0; i < d.length; i += 4) {
          // Slight Bayer matrix dither feel
          const pxIdx = (i / 4);
          const x = pxIdx % g, y = Math.floor(pxIdx / g);
          const shift = ((x + y) % 2 === 0) ? 10 : -10;
          const c = nearestColor(
            Math.max(0, Math.min(255, d[i] + shift)),
            Math.max(0, Math.min(255, d[i+1] + shift)),
            Math.max(0, Math.min(255, d[i+2] + shift)),
            pal
          );
          d[i] = c[0]; d[i+1] = c[1]; d[i+2] = c[2];
        }
        tctx.putImageData(imgData, 0, 0);
      }

      octx.imageSmoothingEnabled = false;
      octx.drawImage(tiny, 0, 0, g, g, 0, 0, size, size);
    } else {
      // Render 5raksil Avatar on retro pixel grid background
      const grad = octx.createRadialGradient(size/2, size/2, size*0.1, size/2, size/2, size*0.65);
      grad.addColorStop(0, curFrame.c1 + '55');
      grad.addColorStop(1, '#080417');
      octx.fillStyle = grad;
      octx.fillRect(0, 0, size, size);

      // Pixel grid lines
      octx.strokeStyle = curFrame.c1 + '22';
      octx.lineWidth = 1;
      const step = Math.round(size / 12);
      for (let p = step; p < size; p += step) {
        octx.beginPath(); octx.moveTo(p, 0); octx.lineTo(p, size); octx.stroke();
        octx.beginPath(); octx.moveTo(0, p); octx.lineTo(size, p); octx.stroke();
      }

      octx.font = `${Math.round(size * 0.56)}px sans-serif`;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(curAvatar, size / 2, size / 2 + size * 0.04);
    }

    // Subtle CRT scanlines over portrait
    octx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < size; y += 4) {
      octx.fillRect(0, y, size, 1.5);
    }
    return out;
  }

  function calcCombatPower() {
    const sum = stats.spd + stats.acc + stats.brn + stats.lck + stats.grt;
    const avg = sum / 5;
    const cp = Math.round((sum * 215) + (stats.spd * stats.grt * 1.8));
    let tier = 'A';
    if (avg >= 93) tier = 'SSS+';
    else if (avg >= 88) tier = 'SS';
    else if (avg >= 82) tier = 'S';
    return { cp, tier, avg: avg.toFixed(1) };
  }

  function drawScanlinesAndStars(w, h) {
    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, curFrame.bg1);
    bgGrad.addColorStop(1, curFrame.bg2);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Perspective cyber grid at bottom
    ctx.strokeStyle = curFrame.c1 + '22';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Outer neon border
    ctx.strokeStyle = curFrame.c1;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = curFrame.c2;
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, w - 36, h - 36);
  }

  function renderLicenseCard() {
    const w = 800, h = 500;
    canvas.width = w;
    canvas.height = h;
    drawScanlinesAndStars(w, h);

    const nick = document.getElementById('nickInput').value.trim() || '네온전설';
    const title = document.getElementById('titleSel').value;
    const pClass = document.getElementById('classSel').value;
    const favGame = document.getElementById('favGameSel').value;
    const quote = document.getElementById('quoteInput').value.trim();
    const { cp, tier } = calcCombatPower();

    // Top Header Bar
    ctx.fillStyle = curFrame.c1 + '26';
    ctx.fillRect(20, 20, w - 40, 62);
    ctx.fillStyle = curFrame.c1;
    ctx.fillRect(20, 80, w - 40, 2);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '14px "Press Start 2P", monospace';
    ctx.fillText('5RAKSIL OFFICIAL GAMER LICENSE', 38, 48);
    ctx.fillStyle = '#dcd3ff';
    ctx.font = '700 13px "Noto Sans KR", sans-serif';
    ctx.fillText(`NO. ${licenseSerial}  ·  출석 ${days()}일차  ·  5RAKSIL.COM`, 38, 70);

    // Tier Badge top-right
    ctx.textAlign = 'right';
    ctx.fillStyle = curFrame.c2;
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillText(`RANK ${tier}`, w - 38, 62);

    // Left: 8-bit Portrait Frame
    const pSize = 210;
    const px = 42, py = 108;
    const portrait = buildPixelPortrait(pSize);
    ctx.drawImage(portrait, px, py);
    ctx.strokeStyle = curFrame.c1;
    ctx.lineWidth = 4;
    ctx.strokeRect(px, py, pSize, pSize);

    // Verified Reflex Badge if measured
    if (measuredMs) {
      ctx.fillStyle = '#3ddc84';
      ctx.fillRect(px, py + pSize - 30, pSize, 30);
      ctx.fillStyle = '#07140d';
      ctx.textAlign = 'center';
      ctx.font = '800 14px "Noto Sans KR", sans-serif';
      ctx.fillText(`⚡ 실측 순발력 ${measuredMs}ms 인증`, px + pSize / 2, py + pSize - 10);
    }

    // Combat Power Box under Portrait
    ctx.fillStyle = '#090418';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.fillRect(px, py + pSize + 14, pSize, 74);
    ctx.strokeRect(px, py + pSize + 14, pSize, 74);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a99fc9';
    ctx.font = '700 12px "Noto Sans KR", sans-serif';
    ctx.fillText('종합 오락실 전투력 (CP)', px + pSize / 2, py + pSize + 36);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillText(cp.toLocaleString(), px + pSize / 2, py + pSize + 70);

    // Right: Player Details & Stat Bars
    const rx = 282;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 15px "Noto Sans KR", sans-serif';
    ctx.fillText(`🏷️ 칭호: 「${title}」`, rx, 128);

    ctx.fillStyle = '#ffffff';
    ctx.font = '36px "Black Han Sans", "Noto Sans KR", sans-serif';
    ctx.fillText(nick, rx, 170);

    ctx.fillStyle = '#dcd3ff';
    ctx.font = '600 15px "Noto Sans KR", sans-serif';
    ctx.fillText(`${pClass}  |  주 종목: ${favGame}`, rx, 200);

    // 5 Stat Bars
    const statList = [
      ['⚡ 순발력 (SPD)', stats.spd, '#22d3ee'],
      ['🎯 정확도 (ACC)', stats.acc, '#ff3d7f'],
      ['🧠 두뇌력 (BRN)', stats.brn, '#ffd23f'],
      ['🍀 운빨 (LCK)', stats.lck, '#3ddc84'],
      ['🔥 승부욕 (GRT)', stats.grt, '#b06bff']
    ];
    let sy = 226;
    statList.forEach(([label, val, col]) => {
      ctx.fillStyle = '#dcd3ff';
      ctx.font = '700 13.5px "Noto Sans KR", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, rx, sy + 14);

      const barX = rx + 125;
      const barW = 295;
      const barH = 16;
      ctx.fillStyle = '#090418';
      ctx.fillRect(barX, sy, barW, barH);
      ctx.strokeStyle = '#3a2b6e';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX, sy, barW, barH);

      const fillW = Math.round((val / 100) * barW);
      ctx.fillStyle = col;
      ctx.fillRect(barX + 2, sy + 2, Math.max(4, fillW - 4), barH - 4);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd23f';
      ctx.font = '11px "Press Start 2P", monospace';
      ctx.fillText(String(val), rx + 474, sy + 14);
      sy += 30;
    });

    // Quote Box
    ctx.fillStyle = '#090418cc';
    ctx.strokeStyle = curFrame.c2;
    ctx.lineWidth = 2;
    ctx.fillRect(rx, 386, 476, 44);
    ctx.strokeRect(rx, 386, 476, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15.5px "Noto Sans KR", sans-serif';
    ctx.fillText(`💬 "${quote}"`, rx + 14, 414);

    // Bottom Barcode & Footer
    ctx.fillStyle = '#a99fc9';
    ctx.font = '600 12.5px "Noto Sans KR", sans-serif';
    ctx.fillText('가입 없이 바로 노는 무료 네온 오락실 · 5RAKSIL.COM', 42, 464);

    // Barcode stripes on bottom right
    ctx.fillStyle = curFrame.c1;
    for (let bx = 590; bx < 755; bx += (bx % 6 === 0 ? 7 : 5)) {
      ctx.fillRect(bx, 444, (bx % 4 === 0 ? 3 : 1.5), 26);
    }
  }

  function renderReceiptCard() {
    const w = 600, h = 820;
    canvas.width = w;
    canvas.height = h;
    drawScanlinesAndStars(w, h);

    const nick = document.getElementById('nickInput').value.trim() || '네온전설';
    const title = document.getElementById('titleSel').value;
    const pClass = document.getElementById('classSel').value;
    const favGame = document.getElementById('favGameSel').value;
    const quote = document.getElementById('quoteInput').value.trim();
    const { cp, tier } = calcCombatPower();

    // Receipt Paper Container
    const rx = 44, ry = 40, rw = w - 88, rh = h - 80;
    ctx.fillStyle = '#120a2aee';
    ctx.strokeStyle = curFrame.c1;
    ctx.lineWidth = 3;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '18px "Press Start 2P", monospace';
    ctx.fillText('5RAKSIL ARCADE RECEIPT', w / 2, ry + 48);

    ctx.fillStyle = '#a99fc9';
    ctx.font = '600 13.5px "Noto Sans KR", sans-serif';
    ctx.fillText(`발급번호 ${licenseSerial} · ${new Date().toISOString().slice(0,10)}`, w / 2, ry + 76);

    // Portrait centered
    const pSize = 148;
    const portrait = buildPixelPortrait(pSize);
    ctx.drawImage(portrait, (w - pSize) / 2, ry + 94);
    ctx.strokeStyle = curFrame.c2;
    ctx.lineWidth = 3;
    ctx.strokeRect((w - pSize) / 2, ry + 94, pSize, pSize);

    ctx.fillStyle = '#ffffff';
    ctx.font = '30px "Black Han Sans", sans-serif';
    ctx.fillText(`${nick} (${tier}급)`, w / 2, ry + 280);

    ctx.fillStyle = curFrame.c1;
    ctx.font = '700 15px "Noto Sans KR", sans-serif';
    ctx.fillText(`「${title}」 · ${pClass}`, w / 2, ry + 306);

    // Dashed divider
    function drawDash(y) {
      ctx.strokeStyle = '#3a2b6e';
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(rx + 28, y); ctx.lineTo(rx + rw - 28, y); ctx.stroke();
      ctx.setLineDash([]);
    }
    drawDash(ry + 326);

    // Receipt Line Items
    const items = [
      ['주력 종목 (' + favGame + ')', 'MASTER'],
      ['⚡ 순발력 스탯 (' + (measuredMs ? measuredMs + 'ms 실측' : 'LV.' + stats.spd) + ')', (stats.spd * 320000).toLocaleString() + ' P'],
      ['🎯 정확도 & 피지컬 (LV.' + stats.acc + ')', (stats.acc * 280000).toLocaleString() + ' P'],
      ['🧠 두뇌 풀가동 연산력 (LV.' + stats.brn + ')', (stats.brn * 290000).toLocaleString() + ' P'],
      ['🍀 결정적 한 방 운빨 (LV.' + stats.lck + ')', (stats.lck * 250000).toLocaleString() + ' P'],
      ['🔥 꺾이지 않는 승부욕 (LV.' + stats.grt + ')', (stats.grt * 360000).toLocaleString() + ' P']
    ];

    let iy = ry + 362;
    ctx.font = '600 15px "Noto Sans KR", sans-serif';
    items.forEach(([k, v]) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#dcd3ff';
      ctx.fillText(k, rx + 32, iy);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(v, rx + rw - 32, iy);
      iy += 36;
    });

    drawDash(iy - 10);

    // Total Value
    const totalWon = cp * 890;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 20px "Noto Sans KR", sans-serif';
    ctx.fillText('총 환산 게이머 가치', rx + 32, iy + 28);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#3ddc84';
    ctx.font = '800 22px "Noto Sans KR", sans-serif';
    ctx.fillText(totalWon.toLocaleString() + ' P', rx + rw - 32, iy + 28);

    // Challenge quote
    ctx.fillStyle = '#090418';
    ctx.strokeStyle = curFrame.c2;
    ctx.lineWidth = 2;
    ctx.fillRect(rx + 32, iy + 50, rw - 64, 52);
    ctx.strokeRect(rx + 32, iy + 50, rw - 64, 52);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '700 16px "Noto Sans KR", sans-serif';
    ctx.fillText(`"${quote}"`, w / 2, iy + 82);

    // Barcode & URL
    ctx.fillStyle = curFrame.c1;
    for (let bx = w / 2 - 130; bx < w / 2 + 130; bx += (bx % 7 === 0 ? 8 : 5)) {
      ctx.fillRect(bx, rh + ry - 72, (bx % 3 === 0 ? 3 : 1.5), 30);
    }
    ctx.fillStyle = '#a99fc9';
    ctx.font = '700 13px "Noto Sans KR", sans-serif';
    ctx.fillText('도전장 수락하기 ▶ 5RAKSIL.COM', w / 2, rh + ry - 20);
  }

  function renderAvatarCard() {
    const w = 640, h = 640;
    canvas.width = w;
    canvas.height = h;
    drawScanlinesAndStars(w, h);

    const nick = document.getElementById('nickInput').value.trim() || '네온전설';
    const title = document.getElementById('titleSel').value;
    const quote = document.getElementById('quoteInput').value.trim();
    const { tier, cp } = calcCombatPower();

    // Large 8-bit Portrait
    const pSize = 420;
    const px = (w - pSize) / 2, py = 46;
    const portrait = buildPixelPortrait(pSize);
    ctx.drawImage(portrait, px, py);
    ctx.strokeStyle = curFrame.c1;
    ctx.lineWidth = 6;
    ctx.strokeRect(px, py, pSize, pSize);

    // Top Speech Bubble Stamp
    if (quote) {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.fillRect(60, 26, w - 120, 48);
      ctx.strokeRect(60, 26, w - 120, 48);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#1a0f00';
      ctx.font = '800 19px "Noto Sans KR", sans-serif';
      ctx.fillText(quote, w / 2, 57);
    }

    // Bottom Arcade Nameplate
    ctx.fillStyle = '#0a0518f2';
    ctx.strokeStyle = curFrame.c2;
    ctx.lineWidth = 3;
    ctx.fillRect(48, 486, w - 96, 118);
    ctx.strokeRect(48, 486, w - 96, 118);

    ctx.textAlign = 'center';
    ctx.fillStyle = curFrame.c1;
    ctx.font = '700 15px "Noto Sans KR", sans-serif';
    ctx.fillText(`「${title}」 · RANK ${tier} · CP ${cp.toLocaleString()}`, w / 2, 518);

    ctx.fillStyle = '#ffffff';
    ctx.font = '38px "Black Han Sans", sans-serif';
    ctx.fillText(nick, w / 2, 564);

    ctx.fillStyle = '#a99fc9';
    ctx.font = '11px "Press Start 2P", monospace';
    ctx.fillText('5RAKSIL.COM', w / 2, 592);
  }

  function renderCard() {
    const { cp, tier } = calcCombatPower();
    document.getElementById('cpPreview').textContent = `RANK ${tier} · 전투력 ${cp.toLocaleString()} CP`;
    if (curTpl === 'license') renderLicenseCard();
    else if (curTpl === 'receipt') renderReceiptCard();
    else renderAvatarCard();
  }

  // Event Listeners
  document.querySelectorAll('.tpl-tabs button').forEach(btn => {
    btn.onclick = () => {
      curTpl = btn.dataset.tpl;
      document.querySelectorAll('.tpl-tabs button').forEach(b => b.classList.toggle('active', b === btn));
      renderCard();
    };
  });

  const photoInput = document.getElementById('photoInput');
  document.getElementById('btnUploadPhoto').onclick = () => photoInput.click();
  document.getElementById('btnUseAvatar').onclick = () => {
    usePhoto = false;
    renderAvStrip();
    renderCard();
  };
  photoInput.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        uploadedImg = img;
        usePhoto = true;
        renderAvStrip();
        renderCard();
        toast('✨ 사진을 8비트 도트로 바꿨어요!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  document.getElementById('pixelRes').oninput = e => {
    pixelGrid = +e.target.value;
    document.getElementById('pixelResLabel').textContent = `${pixelGrid}×${pixelGrid} BIT`;
    renderCard();
  };
  document.getElementById('paletteSel').onchange = e => {
    paletteMode = e.target.value;
    renderCard();
  };

  ['nickInput', 'titleSel', 'classSel', 'favGameSel', 'quoteInput'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', renderCard);
    el.addEventListener('change', renderCard);
  });

  document.querySelectorAll('#quotePresets button').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('quoteInput').value = btn.dataset.q;
      renderCard();
    };
  });

  document.querySelectorAll('[data-stat]').forEach(rng => {
    rng.oninput = () => {
      const k = rng.dataset.stat;
      stats[k] = +rng.value;
      document.getElementById('val-' + k).textContent = rng.value;
      renderCard();
    };
  });

  // Mini 3-second Reflex Measurement
  const reflexPad = document.getElementById('reflexPad');
  let reflexState = 'idle'; // 'idle', 'wait', 'go'
  let reflexTimer = null;
  let reflexStart = 0;

  reflexPad.onclick = () => {
    if (reflexState === 'idle') {
      reflexState = 'wait';
      reflexPad.className = 'reflex-pad wait';
      reflexPad.textContent = '🔴 초록불(⚡지금!)로 바뀔 때까지 기다리세요...';
      reflexTimer = setTimeout(() => {
        reflexState = 'go';
        reflexStart = performance.now();
        reflexPad.className = 'reflex-pad go';
        reflexPad.textContent = '⚡ 지금 바로 터치하세요!! CLICK!!';
      }, 1200 + Math.random() * 1800);
    } else if (reflexState === 'wait') {
      clearTimeout(reflexTimer);
      reflexState = 'idle';
      reflexPad.className = 'reflex-pad';
      reflexPad.textContent = '😅 너무 빨리 눌렀어요! 다시 눌러 측정하기';
    } else if (reflexState === 'go') {
      const ms = Math.max(95, Math.round(performance.now() - reflexStart));
      measuredMs = ms;
      reflexState = 'idle';
      reflexPad.className = 'reflex-pad';
      // Convert ms to speed stat (150ms -> 99, 350ms -> 65)
      const calcSpd = Math.max(55, Math.min(99, Math.round(118 - ms / 8)));
      stats.spd = calcSpd;
      const spdSlider = document.querySelector('[data-stat="spd"]');
      spdSlider.value = calcSpd;
      document.getElementById('val-spd').textContent = calcSpd;
      reflexPad.textContent = `✅ 실측 ${ms}ms 기록 완료! 면허증에 [실측 인증] 배지가 찍혔어요 (다시 재려면 클릭)`;
      renderCard();
    }
  };

  // 저장
  document.getElementById('btnDownload').onclick = () => {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `5raksil-${curTpl}-${Date.now().toString().slice(-4)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      made();
    }, 'image/png');
  };

  // 공유: 그림 파일 공유가 되면 그림, 아니면 링크. 취소하면 보너스 없음.
  document.getElementById('btnShare').onclick = () => {
    const { cp, tier } = calcCombatPower();
    const nick = document.getElementById('nickInput').value.trim() || '플레이어';
    const link = location.origin + '/games/' + G;
    const text = `🪪 [5락실 게이머 면허증] ${nick} · RANK ${tier} (전투력 ${cp.toLocaleString()} CP)\n나도 도트 프사·면허증 만들기 ▶ ${link}`;
    canvas.toBlob(async blob => {
      try {
        if (blob && navigator.canShare) {
          const file = new File([blob], '5raksil-card.png', { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ title: '5락실 게이머 면허증', text, files: [file] });
            made(); return;
          }
        }
        if (navigator.share) { await navigator.share({ title: '5락실 게이머 면허증', text, url: link }); made(); return; }
        await navigator.clipboard.writeText(text);
        toast('📋 공유 문구와 주소를 복사했어요. 단톡방에 붙여 넣어 보세요!');
        made();
      } catch (e) {}
    }, 'image/png');
  };

  renderCard();
})();
