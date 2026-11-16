(function(){
'use strict';
  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const canvas = document.getElementById('editorCanvas');
  const ctx = canvas.getContext('2d');

  // Offscreen canvas for the base image (rotated + cropped)
  const baseCanvas = document.createElement('canvas');
  const baseCtx = baseCanvas.getContext('2d');

  let origImg = null;
  let origFileName = 'don3chon-photo';
  let origFileSize = 0;
  let rotation = 0; // 0, 90, 180, 270
  let aspectMode = 'orig'; // 'orig', '1:1', '4:3'
  let maxWidth = 1200;
  let outFormat = 'image/webp';
  let outQuality = 0.85;

  // Masking state
  let activeTab = 'mosaic';
  let maskType = 'pixel'; // 'pixel', 'blur', 'black'
  let drawShape = 'brush'; // 'brush', 'rect'
  let brushSize = 36;
  let pixelStrength = 16;
  let masks = []; // Array of { type, shape, size, strength, points: [{x,y}], rect: {x1,y1,x2,y2} }
  let currentMask = null;
  let baseVer = 0;  // 사진(회전·자르기·크기) 바뀔 때마다 +1
  let maskVer = 0;  // 가림 목록 바뀔 때마다 +1
  let isDrawing = false;
  let isComparing = false;

  // Stamp state
  let stampOn = true;
  let selectedBadge = '미개봉 새상품';

  // UI Elements
  const btnPickFile = document.getElementById('btnPickFile');
  const btnLoadSample = document.getElementById('btnLoadSample');
  const btnChangePhoto = document.getElementById('btnChangePhoto');
  const btnUndo = document.getElementById('btnUndo');
  const btnClearMasks = document.getElementById('btnClearMasks');
  const btnRotate = document.getElementById('btnRotate');
  const btnCompare = document.getElementById('btnCompare');
  const btnDownload = document.getElementById('btnDownload');
  const btnShareTool = document.getElementById('btnShareTool');

  // Format bytes helper
  function fmtBytes(b) {
    if (!b || b <= 0) return '-';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  // Generate realistic sample image (parcel invoice + product box) on the fly so users can test immediately
  function createSampleImage() {
    const sc = document.createElement('canvas');
    sc.width = 960;
    sc.height = 720;
    const sctx = sc.getContext('2d');

    // Warm desk background
    const grad = sctx.createLinearGradient(0, 0, 960, 720);
    grad.addColorStop(0, '#e8e4dc');
    grad.addColorStop(1, '#d5cfc4');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 960, 720);

    // Product Box
    sctx.fillStyle = '#ffffff';
    sctx.strokeStyle = '#c8c4bc';
    sctx.lineWidth = 3;
    sctx.beginPath();
    sctx.roundRect(90, 70, 440, 480, 18);
    sctx.fill();
    sctx.stroke();

    // Product illustration inside box
    sctx.fillStyle = '#eef2ee';
    sctx.beginPath();
    sctx.roundRect(130, 110, 360, 260, 12);
    sctx.fill();
    sctx.fillStyle = '#1f4d3a';
    sctx.font = 'bold 28px "Noto Sans KR", sans-serif';
    sctx.textAlign = 'center';
    sctx.fillText('☕ 전동 우유 거품기', 310, 225);
    sctx.font = '500 17px "Noto Sans KR", sans-serif';
    sctx.fillStyle = '#555';
    sctx.fillText('5-in-1 Milk Frother · 미개봉 정품', 310, 265);

    sctx.textAlign = 'left';
    sctx.fillStyle = '#1b1c1a';
    sctx.font = 'bold 20px "Noto Sans KR", sans-serif';
    sctx.fillText('구성품: 본체 + 거품 헤드 2종 + 설명서', 130, 420);
    sctx.fillStyle = '#6b6d66';
    sctx.font = '16px "Noto Sans KR", sans-serif';
    sctx.fillText('제조년월: 2026.10 · S/N: D3C-9948-2026', 130, 455);

    // Shipping Invoice Sticker (Target for mosaic!)
    sctx.save();
    sctx.translate(470, 150);
    sctx.rotate(0.03);
    sctx.fillStyle = '#fffdf7';
    sctx.strokeStyle = '#1f4d3a';
    sctx.lineWidth = 2;
    sctx.beginPath();
    sctx.roundRect(0, 0, 400, 340, 10);
    sctx.fill();
    sctx.stroke();

    sctx.fillStyle = '#1f4d3a';
    sctx.fillRect(0, 0, 400, 44);
    sctx.fillStyle = '#fff';
    sctx.font = 'bold 18px "Noto Sans KR", sans-serif';
    sctx.fillText('📦 택배 운송장 (여기를 문질러 가려보세요!)', 18, 29);

    sctx.fillStyle = '#1b1c1a';
    sctx.font = 'bold 17px "Noto Sans KR", sans-serif';
    sctx.fillText('받는 분: 김삼촌 (010-1234-5678)', 22, 84);
    sctx.font = '15.5px "Noto Sans KR", sans-serif';
    sctx.fillText('주소: 서울특별시 마포구 살림로 123, 101동 1204호', 22, 118);
    sctx.fillText('운송장 번호: 6049-8821-3390 (가려야 할 번호)', 22, 152);
    sctx.fillText('결제 계좌: 신한 110-492-883920 (김삼촌)', 22, 186);

    // Fake barcode bars
    sctx.fillStyle = '#111';
    for (let x = 24; x < 370; x += (x % 7 === 0 ? 9 : 6)) {
      const w = (x % 5 === 0) ? 4 : 2;
      sctx.fillRect(x, 215, w, 65);
    }
    sctx.font = '13px monospace';
    sctx.fillText('6 0 4 9   8 8 2 1   3 3 9 0   2 0 2 6', 65, 302);
    sctx.restore();

    const img = new Image();
    img.onload = function() {
      origImg = img;
      origFileName = 'sample-parcel-photo';
      origFileSize = 0; // 샘플은 원본 파일 용량이 없으니 절약률을 보여 주지 않는다
      rotation = 0;
      masks = [
        // Pre-apply 1 demo mosaic over phone number so user sees immediate effect
        {
          type: 'pixel',
          shape: 'rect',
          size: 36,
          strength: 14,
          rect: { x1: 0.60, y1: 0.29, x2: 0.86, y2: 0.35 }
        }
      ];
      document.getElementById('stampTitle').value = '전동 우유 거품기 (미개봉)';
      document.getElementById('stampPrice').value = '22,000원';
      document.getElementById('stampOrigPrice').value = '구매가 33,080원';
      document.getElementById('stampMemo').value = '박스 풀구성 · 반값택배 가능';
      rebuildBaseAndRender();
    };
    img.src = sc.toDataURL('image/jpeg', 0.95);
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    origFileName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    origFileSize = file.size || 0;
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        origImg = img;
        rotation = 0;
        masks = [];
        rebuildBaseAndRender();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function rebuildBaseAndRender() {
    if (!origImg) return;
    dropzone.classList.add('has-img');
    btnCompare.disabled = false;
    btnDownload.disabled = false;

    // 1. Determine rotated dimensions
    const sw = origImg.naturalWidth || origImg.width;
    const sh = origImg.naturalHeight || origImg.height;
    const rotW = (rotation % 180 === 0) ? sw : sh;
    const rotH = (rotation % 180 === 0) ? sh : sw;

    // Temporary rotated canvas
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;
    const rctx = rotCanvas.getContext('2d');
    rctx.save();
    rctx.translate(rotW / 2, rotH / 2);
    rctx.rotate((rotation * Math.PI) / 180);
    rctx.drawImage(origImg, -sw / 2, -sh / 2);
    rctx.restore();

    // 2. Determine aspect crop box from rotCanvas
    let cropX = 0, cropY = 0, cropW = rotW, cropH = rotH;
    if (aspectMode === '1:1') {
      const side = Math.min(rotW, rotH);
      cropX = Math.round((rotW - side) / 2);
      cropY = Math.round((rotH - side) / 2);
      cropW = side;
      cropH = side;
    } else if (aspectMode === '4:3') {
      const targetRatio = 4 / 3;
      const curRatio = rotW / rotH;
      if (curRatio > targetRatio) {
        cropW = Math.round(rotH * targetRatio);
        cropX = Math.round((rotW - cropW) / 2);
      } else {
        cropH = Math.round(rotW / targetRatio);
        cropY = Math.round((rotH - cropH) / 2);
      }
    }

    // 3. Apply maxWidth scaling
    let finalW = cropW;
    let finalH = cropH;
    if (maxWidth > 0 && finalW > maxWidth) {
      finalH = Math.round((cropH * maxWidth) / finalW);
      finalW = maxWidth;
    }

    baseCanvas.width = finalW;
    baseCanvas.height = finalH;
    baseCtx.drawImage(rotCanvas, cropX, cropY, cropW, cropH, 0, 0, finalW, finalH);
    baseVer++;
    maskVer++;

    canvas.width = finalW;
    canvas.height = finalH;

    renderEditor();
    updateReceiptSize();
  }

  // 가리기 효과 원본(사진 전체에 효과를 입힌 것). 블러는 ctx.filter 대신 줄였다 늘리는 방식이라 사파리에서도 똑같이 된다.
  const fxCache = new Map();
  function effectSource(m, w, h, scale) {
    const key = baseVer + ':' + w + 'x' + h + ':' + m.type + ':' + (m.type === 'black' ? 0 : m.strength);
    if (fxCache.has(key)) return fxCache.get(key);
    if (fxCache.size > 6) fxCache.clear();
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (m.type === 'black') {
      g.fillStyle = '#181917';
      g.fillRect(0, 0, w, h);
    } else {
      const f = m.type === 'blur'
        ? Math.max(5, Math.round((m.strength || 16) * 0.9 * scale))
        : Math.max(6, Math.round((m.strength || 16) * scale));
      const sw = Math.max(1, Math.ceil(w / f));
      const sh = Math.max(1, Math.ceil(h / f));
      const tiny = document.createElement('canvas');
      tiny.width = sw; tiny.height = sh;
      const tctx = tiny.getContext('2d');
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = 'high';
      tctx.drawImage(baseCanvas, 0, 0, sw, sh);
      if (m.type === 'blur') {
        // 두 번 줄였다 늘려서 글자 윤곽이 남지 않게 한다
        const mid = document.createElement('canvas');
        mid.width = Math.max(1, Math.ceil(sw * 2)); mid.height = Math.max(1, Math.ceil(sh * 2));
        const mc = mid.getContext('2d');
        mc.imageSmoothingEnabled = true;
        mc.drawImage(tiny, 0, 0, mid.width, mid.height);
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(mid, 0, 0, w, h);
      } else {
        g.imageSmoothingEnabled = false;
        g.drawImage(tiny, 0, 0, sw, sh, 0, 0, w, h);
      }
    }
    fxCache.set(key, c);
    return c;
  }

  // 이미 그린 가림들은 한 장에 모아 두고, 지금 그리는 것만 매번 다시 그린다(휴대폰에서 버벅이지 않게)
  const comCanvas = document.createElement('canvas');
  const comCtx = comCanvas.getContext('2d');
  let comKey = '';
  function committedLayer(w, h) {
    const key = baseVer + ':' + maskVer + ':' + w + 'x' + h;
    if (key !== comKey) {
      comCanvas.width = w; comCanvas.height = h;
      comCtx.clearRect(0, 0, w, h);
      masks.forEach(m => applyMaskRegion(comCtx, m, w, h));
      comKey = key;
    }
    return comCanvas;
  }

  function applyMaskRegion(targetCtx, m, w, h) {
    // Build a mask alpha layer for this stroke/rect
    const maskLayer = document.createElement('canvas');
    maskLayer.width = w;
    maskLayer.height = h;
    const mctx = maskLayer.getContext('2d');
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.fillStyle = '#000';
    mctx.strokeStyle = '#000';

    const scale = w / 900;
    const strokeW = Math.max(10, (m.size || 36) * scale);

    if (m.shape === 'rect' && m.rect) {
      const rx = Math.min(m.rect.x1, m.rect.x2) * w;
      const ry = Math.min(m.rect.y1, m.rect.y2) * h;
      const rw = Math.max(4, Math.abs(m.rect.x2 - m.rect.x1) * w);
      const rh = Math.max(4, Math.abs(m.rect.y2 - m.rect.y1) * h);
      mctx.fillRect(rx, ry, rw, rh);
    } else if (m.points && m.points.length) {
      mctx.lineWidth = strokeW;
      mctx.beginPath();
      m.points.forEach((pt, idx) => {
        const px = pt.x * w;
        const py = pt.y * h;
        if (idx === 0) mctx.moveTo(px, py);
        else mctx.lineTo(px, py);
      });
      if (m.points.length === 1) {
        mctx.arc(m.points[0].x * w, m.points[0].y * h, strokeW / 2, 0, Math.PI * 2);
        mctx.fill();
      } else {
        mctx.stroke();
      }
    }

    // Create the effect layer (효과 원본은 같은 사진·종류·강도면 다시 만들지 않는다)
    const fxLayer = document.createElement('canvas');
    fxLayer.width = w;
    fxLayer.height = h;
    const fctx = fxLayer.getContext('2d');
    fctx.drawImage(effectSource(m, w, h, scale), 0, 0);

    // Clip effect layer to maskLayer
    fctx.globalCompositeOperation = 'destination-in';
    fctx.drawImage(maskLayer, 0, 0);

    targetCtx.drawImage(fxLayer, 0, 0);
  }

  function drawPriceStamp(targetCtx, w, h) {
    if (!stampOn) return;
    const title = document.getElementById('stampTitle').value.trim();
    const price = document.getElementById('stampPrice').value.trim();
    const origPrice = document.getElementById('stampOrigPrice').value.trim();
    const memo = document.getElementById('stampMemo').value.trim();
    const pos = document.getElementById('stampPos').value;
    const theme = document.getElementById('stampTheme').value;

    if (!title && !price && !memo && !selectedBadge) return;

    const s = Math.max(0.65, Math.min(1.5, w / 900));
    const pad = Math.round(20 * s);

    // Colors by theme
    let bgCol = 'rgba(247, 246, 242, 0.95)';
    let inkCol = '#1b1c1a';
    let mutedCol = '#6b6d66';
    let accentCol = '#1f4d3a';
    let badgeBg = '#eef2ee';
    let borderCol = '#1f4d3a';

    if (theme === 'dark') {
      bgCol = 'rgba(20, 21, 19, 0.90)';
      inkCol = '#f7f6f2';
      mutedCol = '#a3a59d';
      accentCol = '#8fc2a6';
      badgeBg = 'rgba(143, 194, 166, 0.18)';
      borderCol = '#8fc2a6';
    } else if (theme === 'carrot') {
      bgCol = 'rgba(255, 252, 248, 0.95)';
      inkCol = '#1b1c1a';
      mutedCol = '#6b6d66';
      accentCol = '#d95b26';
      badgeBg = '#fff0e8';
      borderCol = '#d95b26';
    }

    targetCtx.save();

    if (pos === 'bottom-bar') {
      const barH = Math.round((memo ? 118 : 96) * s);
      const barY = h - barH;
      targetCtx.fillStyle = bgCol;
      targetCtx.fillRect(0, barY, w, barH);
      targetCtx.fillStyle = borderCol;
      targetCtx.fillRect(0, barY, w, Math.max(3, Math.round(4 * s)));

      // Left: Badge + Title + Memo
      let curY = barY + Math.round(28 * s);
      if (selectedBadge) {
        targetCtx.font = `700 ${Math.round(13 * s)}px "Noto Sans KR", sans-serif`;
        const bw = targetCtx.measureText(selectedBadge).width + Math.round(18 * s);
        const bh = Math.round(24 * s);
        targetCtx.fillStyle = badgeBg;
        targetCtx.beginPath();
        targetCtx.roundRect(pad, curY - Math.round(17 * s), bw, bh, 6);
        targetCtx.fill();
        targetCtx.fillStyle = accentCol;
        targetCtx.fillText(selectedBadge, pad + Math.round(9 * s), curY);
      }

      const titleX = selectedBadge
        ? pad + targetCtx.measureText(selectedBadge).width + Math.round(30 * s)
        : pad;
      targetCtx.fillStyle = inkCol;
      targetCtx.font = `600 ${Math.round(22 * s)}px "Noto Serif KR", serif`;
      targetCtx.fillText(title || '실사용 상태 좋은 물건', titleX, curY + Math.round(2 * s));

      if (memo) {
        targetCtx.fillStyle = mutedCol;
        targetCtx.font = `400 ${Math.round(15 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText(memo, pad, barY + Math.round(64 * s));
      }

      // Watermark subtle credit
      targetCtx.fillStyle = mutedCol;
      targetCtx.font = `500 ${Math.round(12 * s)}px "Noto Sans KR", sans-serif`;
      targetCtx.fillText('정리: 돈 줍는 삼촌 (don3chon.com)', pad, barY + barH - Math.round(12 * s));

      // Right: Price + OrigPrice
      targetCtx.textAlign = 'right';
      if (origPrice) {
        targetCtx.fillStyle = mutedCol;
        targetCtx.font = `400 ${Math.round(14 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText(origPrice, w - pad, barY + Math.round(34 * s));
      }
      if (price) {
        targetCtx.fillStyle = accentCol;
        targetCtx.font = `700 ${Math.round(30 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText(price, w - pad, barY + Math.round(72 * s));
      }
    } else {
      // Corner floating receipt card
      const cardW = Math.min(w - pad * 2, Math.round(360 * s));
      const cardH = Math.round((memo ? 136 : 112) * s);
      let cx = pad, cy = h - cardH - pad;
      if (pos === 'bottom-right') cx = w - cardW - pad;
      if (pos === 'top-left') cy = pad;

      targetCtx.fillStyle = bgCol;
      targetCtx.strokeStyle = borderCol;
      targetCtx.lineWidth = Math.max(2, Math.round(2.5 * s));
      targetCtx.beginPath();
      targetCtx.roundRect(cx, cy, cardW, cardH, Math.round(14 * s));
      targetCtx.fill();
      targetCtx.stroke();

      let ty = cy + Math.round(28 * s);
      if (selectedBadge) {
        targetCtx.fillStyle = accentCol;
        targetCtx.font = `700 ${Math.round(13 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText('● ' + selectedBadge, cx + pad, ty);
        ty += Math.round(26 * s);
      }
      targetCtx.fillStyle = inkCol;
      targetCtx.font = `600 ${Math.round(20 * s)}px "Noto Serif KR", serif`;
      targetCtx.fillText(title || '상태 좋은 물건', cx + pad, ty);

      ty += Math.round(30 * s);
      targetCtx.fillStyle = accentCol;
      targetCtx.font = `700 ${Math.round(24 * s)}px "Noto Sans KR", sans-serif`;
      targetCtx.fillText(price || '', cx + pad, ty);

      if (origPrice) {
        const pw = targetCtx.measureText(price ? price + '  ' : '').width;
        targetCtx.fillStyle = mutedCol;
        targetCtx.font = `400 ${Math.round(13.5 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText(origPrice, cx + pad + pw, ty);
      }
      if (memo) {
        ty += Math.round(22 * s);
        targetCtx.fillStyle = mutedCol;
        targetCtx.font = `400 ${Math.round(13.5 * s)}px "Noto Sans KR", sans-serif`;
        targetCtx.fillText(memo, cx + pad, ty);
      }
    }

    targetCtx.restore();
  }

  function renderEditor() {
    if (!origImg) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(baseCanvas, 0, 0);

    if (!isComparing) {
      ctx.drawImage(committedLayer(w, h), 0, 0);
      if (currentMask) applyMaskRegion(ctx, currentMask, w, h);
      drawPriceStamp(ctx, w, h);
    }

    btnUndo.disabled = masks.length === 0;
    btnClearMasks.disabled = masks.length === 0;

    // Update receipt text rows
    document.getElementById('rcpOrig').textContent =
      `${origImg.naturalWidth || origImg.width}×${origImg.naturalHeight || origImg.height}px` +
      (origFileSize ? ` · ${fmtBytes(origFileSize)}` : '');
    document.getElementById('rcpMasks').textContent =
      masks.length > 0 ? `${masks.length}곳 안전하게 가림` : '없음 (드래그해서 가리기)';

    const stTitle = document.getElementById('stampTitle').value.trim();
    const stPrice = document.getElementById('stampPrice').value.trim();
    document.getElementById('rcpStamp').textContent =
      stampOn && (stTitle || stPrice) ? `${stPrice || '가격표'} · ${selectedBadge || '표시 중'}` : '미적용';
  }

  let sizeTimer = null;
  function updateReceiptSize() {
    if (!origImg) return;
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(() => {
      canvas.toBlob(blob => {
        if (!blob) return;
        const afterBytes = blob.size;
        const ext = outFormat === 'image/webp' ? 'WebP' : outFormat === 'image/jpeg' ? 'JPG' : 'PNG';
        document.getElementById('rcpAfter').textContent =
          `${canvas.width}×${canvas.height}px (${ext}) · ${fmtBytes(afterBytes)}`;
        if (origFileSize > 0 && afterBytes < origFileSize) {
          const diff = origFileSize - afterBytes;
          const pct = Math.round((diff / origFileSize) * 100);
          document.getElementById('rcpSaved').textContent = `${fmtBytes(diff)} 절약 (-${pct}%)`;
        } else {
          document.getElementById('rcpSaved').textContent = `최적 용량 ${fmtBytes(afterBytes)}`;
        }
      }, outFormat, outQuality);
    }, 120);
  }

  // Pointer coordinates normalized (0..1)
  function getNormPt(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    };
  }

  function startDraw(e) {
    if (!origImg || isComparing) return;
    e.preventDefault();
    isDrawing = true;
    const pt = getNormPt(e);
    currentMask = {
      type: maskType,
      shape: drawShape,
      size: brushSize,
      strength: pixelStrength,
      points: [pt],
      rect: { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y }
    };
    renderEditor();
  }

  function moveDraw(e) {
    if (!isDrawing || !currentMask) return;
    e.preventDefault();
    const pt = getNormPt(e);
    if (currentMask.shape === 'rect') {
      currentMask.rect.x2 = pt.x;
      currentMask.rect.y2 = pt.y;
    } else {
      currentMask.points.push(pt);
    }
    renderEditor();
  }

  function endDraw() {
    if (!isDrawing || !currentMask) return;
    isDrawing = false;
    masks.push(currentMask);
    maskVer++;
    currentMask = null;
    renderEditor();
    updateReceiptSize();
  }

  canvas.addEventListener('mousedown', startDraw);
  window.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  window.addEventListener('touchend', endDraw);

  // File Pickers & Drag-and-Drop
  btnPickFile.onclick = () => fileInput.click();
  btnChangePhoto.onclick = () => fileInput.click();
  btnLoadSample.onclick = () => createSampleImage();
  fileInput.onchange = e => { if (e.target.files[0]) loadFile(e.target.files[0]); };

  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  // Paste from clipboard
  window.addEventListener('paste', e => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        loadFile(item.getAsFile());
        break;
      }
    }
  });

  // Stage actions
  btnUndo.onclick = () => { masks.pop(); maskVer++; renderEditor(); updateReceiptSize(); };
  btnClearMasks.onclick = () => { masks = []; maskVer++; renderEditor(); updateReceiptSize(); };
  btnRotate.onclick = () => { rotation = (rotation + 90) % 360; rebuildBaseAndRender(); };

  const startCmp = () => { if (!origImg) return; isComparing = true; renderEditor(); };
  const endCmp = () => { if (!isComparing) return; isComparing = false; renderEditor(); };
  btnCompare.addEventListener('mousedown', startCmp);
  btnCompare.addEventListener('touchstart', startCmp);
  window.addEventListener('mouseup', endCmp);
  window.addEventListener('touchend', endCmp);

  // Tabs
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b === btn));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + activeTab));
    };
  });

  // Tab 1 controls
  document.querySelectorAll('#maskTypeSeg button').forEach(btn => {
    btn.onclick = () => {
      maskType = btn.dataset.type;
      document.querySelectorAll('#maskTypeSeg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    };
  });
  document.querySelectorAll('#drawShapeSeg button').forEach(btn => {
    btn.onclick = () => {
      drawShape = btn.dataset.shape;
      document.querySelectorAll('#drawShapeSeg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
    };
  });

  const brushInput = document.getElementById('brushSize');
  const strengthInput = document.getElementById('pixelStrength');
  function updateBrushLabel() {
    brushSize = +brushInput.value;
    pixelStrength = +strengthInput.value;
    document.getElementById('brushSizeVal').textContent = `굵기 ${brushSize}px · 강도 ${pixelStrength}px`;
  }
  brushInput.oninput = updateBrushLabel;
  strengthInput.oninput = updateBrushLabel;

  // Tab 2 controls
  document.querySelectorAll('#stampEnableSeg button').forEach(btn => {
    btn.onclick = () => {
      stampOn = btn.dataset.on === '1';
      document.querySelectorAll('#stampEnableSeg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
      renderEditor();
      updateReceiptSize();
    };
  });

  document.querySelectorAll('#badgeChips button').forEach(btn => {
    btn.onclick = () => {
      const wasOn = btn.classList.contains('on');
      document.querySelectorAll('#badgeChips button').forEach(b => b.classList.remove('on'));
      if (!wasOn) {
        btn.classList.add('on');
        selectedBadge = btn.dataset.badge;
      } else {
        selectedBadge = '';
      }
      renderEditor();
      updateReceiptSize();
    };
  });

  ['stampTitle', 'stampPrice', 'stampOrigPrice', 'stampMemo', 'stampPos', 'stampTheme'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { renderEditor(); updateReceiptSize(); });
    el.addEventListener('change', () => { renderEditor(); updateReceiptSize(); });
  });

  // Tab 3 controls
  document.querySelectorAll('#formatSeg button').forEach(btn => {
    btn.onclick = () => {
      outFormat = btn.dataset.fmt;
      document.querySelectorAll('#formatSeg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
      updateReceiptSize();
    };
  });
  document.querySelectorAll('#aspectSeg button').forEach(btn => {
    btn.onclick = () => {
      aspectMode = btn.dataset.asp;
      document.querySelectorAll('#aspectSeg button').forEach(b => b.setAttribute('aria-pressed', b === btn));
      rebuildBaseAndRender();
    };
  });
  document.getElementById('maxWidthSel').onchange = e => {
    maxWidth = +e.target.value;
    rebuildBaseAndRender();
  };
  document.getElementById('qualityRange').oninput = e => {
    outQuality = +e.target.value / 100;
    document.getElementById('qualityVal').textContent = `${e.target.value}% (${e.target.value >= 80 ? '화질·용량 균형 추천' : '최대 용량 절약'})`;
    updateReceiptSize();
  };

  // Download & Share
  btnDownload.onclick = () => {
    if (!origImg) return;
    const ext = outFormat === 'image/webp' ? 'webp' : outFormat === 'image/jpeg' ? 'jpg' : 'png';
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${origFileName}-don3chon.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      document.getElementById('rcpStatus').textContent = '✅ 저장 완료!';
    }, outFormat, outQuality);
  };

  btnShareTool.onclick = () => {
    const text = '택배 송장 모자이크·중고거래 가격표·사진 용량 줄이기를 서버 전송 없이 1초 만에! - 돈 줍는 삼촌\nhttps://don3chon.com/calc/photo-studio';
    if (navigator.share) {
      navigator.share({ title: '삼촌의 살림·중고거래 사진 정리기', text, url: 'https://don3chon.com/calc/photo-studio' }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        btnShareTool.textContent = '✅ 복사됨';
        setTimeout(() => { btnShareTool.textContent = '📤 공유'; }, 2000);
      });
    }
  };

  // Auto-load sample on first visit so the user sees an interactive preview right away
  createSampleImage();
})();
