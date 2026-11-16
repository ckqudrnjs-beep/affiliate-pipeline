// 일괄 분해(BK 11/16): 가방에서 장비를 여러 개 골라 한 번에 분해한다.
// SALV: null(꺼짐) 또는 고른 물건 uid 의 Set. SALVC: 확인창을 띄운 상태.
// 잠근 장비(it.lk)·재료·물약은 고를 수 없고, 입은 장비는 가방에 없으니 자연히 빠진다.
let SALV = null, SALVC = 0;
function salvOk(it) { return !!(it && !it.g && !it.lk && salvageOf(it)); }
// 빠른 선택에서 빼는 것: 감정 안 된 것(좋은 것일 수 있음)·강화한 것. 직접 누르면 고를 수 있다.
function salvQuick(it) { return salvOk(it) && it.id && !it.en; }
function salvPicked() { return G.P.inv.filter(it => SALV && SALV.has(it.uid) && salvOk(it)); }
function salvGain(list) { const g = {}; for (const it of list) { const s = salvageOf(it); g[s[0]] = (g[s[0]] || 0) + s[1] * (it.n || 1); } return g; }
function salvGainTxt(g) { const t = Object.keys(g).map(k => GOODS[k].n + ' ' + g[k] + '개'); return t.length ? t.join(' · ') : '-'; }
function salvToggle(i) { const it = G.P.inv[i]; if (!it) return;
  if (it.g) { toast('재료·물약은 분해할 수 없어요'); return; }
  if (it.lk) { toast('잠근 장비예요 · 잠금을 풀면 고를 수 있어요'); return; }
  if (!salvOk(it)) return;
  SALVC = 0; if (SALV.has(it.uid)) SALV.delete(it.uid); else SALV.add(it.uid); }
// 빠른 선택 묶음: [이름, 거르는 함수]
function salvGroups(P) { const G2 = RAR.map((r, i) => [r.n + ' 전부', it => it.r === i]);
  G2.push(['못 끼는 장비', it => !!canWear(P, it)]);
  return G2.map(([n, f], i) => { const L = P.inv.filter(it => salvQuick(it) && f(it)); return { n, i, L, all: L.length && L.every(it => SALV.has(it.uid)) }; }).filter(x => x.L.length); }
function salvPick(gi) { const g = salvGroups(G.P).find(x => x.i === gi); if (!g) return; SALVC = 0; for (const it of g.L) g.all ? SALV.delete(it.uid) : SALV.add(it.uid); }
function salvHtml() { const P = G.P, L = salvPicked(), gain = salvGain(L);
  if (SALVC && L.length) { const warn = L.filter(it => it.r >= 2 || it.en || !it.id), show = L.slice(0, 10);
    return `<h4>정말 분해할까요?</h4><p style="font-size:12.5px;margin:2px 0 6px">${L.length}개를 부숴서 <b>${salvGainTxt(gain)}</b>로 바꿔요. <b style="color:#c84a3a">되돌릴 수 없어요.</b></p>`
      + `<div style="font-size:12px;line-height:1.55;background:#fffaf0;border:1px solid #e0cfae;border-radius:8px;padding:4px 8px;max-height:132px;overflow:auto">${show.map(it => `<div style="color:${shade(itemColor(it))}">${esc(itemName(it))}${it.n > 1 ? ' ×' + it.n : ''}</div>`).join('')}${L.length > show.length ? `<div class="m">외 ${L.length - show.length}개</div>` : ''}</div>`
      + (warn.length ? `<p style="color:#c84a3a;font-size:12px;font-weight:700;margin:4px 0">이름난 등급 이상·강화한 것·감정 안 된 것이 ${warn.length}개 들어 있어요</p>` : '')
      + `<div class="sk-acts"><button class="sk-b p" data-a="svgo">${L.length}개 분해하기</button><button class="sk-b" data-a="svback">다시 고르기</button></div>`; }
  const gs = salvGroups(P);
  return `<h4>여러 개 분해 <small style="color:#8a7458">${L.length}개 고름</small></h4><p class="m" style="font-size:11.5px;margin:0 0 4px">가방에서 분해할 장비를 눌러 고르세요. 다시 누르면 빠져요. 입은 장비·잠근 장비는 빠져요.</p>`
    + (gs.length ? `<div class="sk-acts">${gs.map(g => `<button class="sk-b${g.all ? ' g' : ''}" data-a="svq" data-i="${g.i}">${g.all ? '✓ ' : ''}${esc(g.n)} ${g.L.length}</button>`).join('')}</div><p class="m" style="font-size:11px;margin:2px 0 4px">빠른 선택은 감정 안 된 것·강화한 것을 빼요. 그런 건 직접 눌러 고르세요.</p>` : '')
    + `<p style="font-size:12.5px;margin:4px 0">받을 재료: <b>${salvGainTxt(gain)}</b></p>`
    + `<div class="sk-acts"><button class="sk-b p" data-a="svok" ${L.length ? '' : 'disabled'}>분해하기</button>${L.length ? '<button class="sk-b" data-a="svnone">모두 빼기</button>' : ''}<button class="sk-b" data-a="svoff">그만하기</button></div>`; }
function salvDo() { const P = G.P, L = salvPicked(); if (!L.length) return; const gain = salvGain(L);
  P.inv = P.inv.filter(it => !L.includes(it)); for (const k in gain) addInv(goods(k, gain[k]));
  SALV = null; SALVC = 0; SEL = null; sfx('ench'); save(); return L.length + '개 분해 → ' + salvGainTxt(gain); }
// 패널 클릭 처리: 처리했으면 true
function salvAct(a, t) { if (!SALV) return false;
  if (a === 'svq') salvPick(+t.dataset.i); else if (a === 'svnone') { SALV.clear(); SALVC = 0; } else if (a === 'svok') SALVC = 1; else if (a === 'svback') SALVC = 0;
  else if (a === 'svoff') { SALV = null; SALVC = 0; } else if (a === 'svgo') { const m = salvDo(); render(); if (m) toast(m); return true; } else return false;
  render(); return true; }
