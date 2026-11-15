/* ---------- 베타 의견: 메뉴 「의견 보내기」 + 장 끝·보스·첫 쓰러짐·레벨 10마다 살짝 묻기 ---------- */
// 보낼 때 지금 장·섬·레벨·직업·난이도·플레이 시간·폰/PC를 같이 붙인다. 프로필이 있으면 게시판에도 올릴 수 있다.
const FBT = [['bug', '🐞 버그'], ['hard', '😵 너무 어려움'], ['easy', '😴 너무 쉬움'], ['dull', '🥱 지루함'], ['good', '😍 좋아요'], ['idea', '💡 제안']];
const FB = { star: 0, tags: [], why: 'menu', busy: 0, chip: null, last: 0 };
function fbCtx() { const P = G.P, Wd = G.Wd, k = Wd.isl[Wd.id(Math.floor(P.x), Math.floor(P.y))], s = k >= 0 && Wd.islands[k];
  return { ch: Wd.ch, isle: (s && s.name) || '', lv: P.lv, cls: P.cls, diff: P.diff || 0, play: Math.round(P.play || 0), dev: matchMedia('(pointer: coarse)').matches ? 'phone' : 'pc', why: FB.why, v: '__ASSETV__'.slice(0, 8) }; }
function fbOpen(why) { FB.why = why || 'menu'; FB.star = 0; FB.tags = []; fbChipOff(); openPanel('fb'); }
const FBWHY = { end: '이 장', boss: '방금 보스 싸움', die: '방금 쓰러진 싸움', lv: '지금까지', menu: '' };
function fbHtml(X) { const c = fbCtx(), code = pcode();
  return `<div class="sk-bx" style="max-width:440px">${X}<h3>💬 베타 의견 보내기</h3><p class="m" style="font-size:12.5px;margin:0 0 8px">${FBWHY[FB.why] ? '<b>' + FBWHY[FB.why] + '</b>, 어땠나요? ' : ''}한 줄이라도 큰 도움이 돼요!</p>
  <div style="font-size:30px;letter-spacing:4px;text-align:center;margin:4px 0">${[1, 2, 3, 4, 5].map(i => `<span data-a="fbs" data-i="${i}" style="cursor:pointer;color:${i <= FB.star ? '#ffb020' : '#cbbfa8'}">★</span>`).join('')}</div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:6px 0">${FBT.map(([k, n]) => `<button class="sk-b${FB.tags.includes(k) ? ' g' : ''}" data-a="fbt" data-k="${k}" style="margin:0;padding:6px 10px;font-size:13px">${n}</button>`).join('')}</div>
  <textarea id="sk-fbtx" maxlength="500" rows="3" placeholder="예) 2장 사슬 다리 찾기가 헷갈려요 / 보스 줄 공격이 너무 아파요" style="width:100%;box-sizing:border-box;border-radius:10px;border:2px solid #d8c8a8;padding:8px;font:inherit;font-size:14px;resize:vertical">${FB.text || ''}</textarea>
  <label style="display:block;font-size:12.5px;margin:6px 0;color:${code ? '#5a3e22' : '#a89878'}"><input type="checkbox" id="sk-fbbd" ${code ? '' : 'disabled'}> 5락실 게시판에도 올리기${code ? '' : ' (프로필이 있으면 가능)'}</label>
  <p class="m" style="font-size:11px;color:#8a7458;margin:2px 0 8px">같이 보내는 정보: ${c.ch === 8 ? '떠도는 섬' : c.ch + '장'} ${c.isle} · ${c.lv}레벨 · ${CLASSES[c.cls].name} · ${c.dev === 'pc' ? 'PC' : '폰'}. 욕설·링크·개인정보는 보낼 수 없어요.</p>
  <button class="sk-b p" data-a="fbsend" ${FB.busy ? 'disabled' : ''}>보내기</button> <button class="sk-b" data-a="x">다음에</button>${TOAST}</div>`; }
function fbAct(a, t) { const ta = panel.querySelector('#sk-fbtx'); if (ta) FB.text = ta.value;
  if (a === 'fbs') { FB.star = +t.dataset.i; render(); return true; }
  if (a === 'fbt') { const k = t.dataset.k, i = FB.tags.indexOf(k); if (i >= 0) FB.tags.splice(i, 1); else FB.tags.push(k); render(); return true; }
  if (a === 'fb') { fbOpen(t.dataset.w); return true; }
  if (a === 'fbsend') { if (FB.busy) return true; const text = (FB.text || '').trim(); if (!FB.star) { toast('별점을 먼저 골라 주세요'); return true; } if (!text && !FB.tags.length) { toast('태그를 고르거나 한 줄 써 주세요'); return true; }
    const bd = panel.querySelector('#sk-fbbd'); FB.busy = 1; render();
    fetch('/api/skyfb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: 'send', code: pcode(), star: FB.star, tags: FB.tags, text, ctx: fbCtx(), board: !!(bd && bd.checked) }) })
      .then(r => r.json().catch(() => ({}))).then(j => { FB.busy = 0; if (j.ok) { FB.text = ''; G.P.flags.fbN = (G.P.flags.fbN || 0) + 1; save(); closePanel(); say(j.board ? '고마워요! 의견을 보냈고 게시판에도 올렸어요.' : j.board === 0 ? '고마워요! 의견을 보냈어요(게시판은 오늘 글 수를 다 써서 못 올렸어요).' : '고마워요! 의견을 잘 받았어요.', '#9fe4ff'); } else { render(); toast(j.msg || '지금은 보낼 수 없어요. 잠시 뒤 다시 해 주세요'); } })
      .catch(() => { FB.busy = 0; render(); toast('인터넷 연결을 확인해 주세요'); });
    return true; }
  return false; }
// 살짝 묻기: 화면 오른쪽 아래에 작은 단추가 20초 동안. 같은 이유는 한 번만, 10분에 한 번까지.
function fbNudge(why, key) { const P = G.P; if (!G || DEBUG && !P.flags.fbTest) return; const f = 'fb_' + (key || why); if (P.flags[f] || Date.now() - FB.last < 6e5) return; P.flags[f] = 1; FB.last = Date.now();
  fbChipOff(); const b = document.createElement('button'); b.className = 'sk-fbchip'; b.textContent = '💬 ' + (FBWHY[why] || '의견') + ' 어땠어요?'; b.style.cssText = 'position:absolute;right:12px;bottom:84px;z-index:5;border:0;border-radius:999px;padding:9px 14px;background:#ffd166;color:#3a2a10;font:800 13px system-ui;box-shadow:0 3px 0 #b8860b;cursor:pointer';
  b.onclick = e => { e.stopPropagation(); fbOpen(why); }; ov.appendChild(b); FB.chip = b; setTimeout(() => { if (FB.chip === b) fbChipOff(); }, 20000); }
function fbChipOff() { if (FB.chip) { FB.chip.remove(); FB.chip = null; } }
