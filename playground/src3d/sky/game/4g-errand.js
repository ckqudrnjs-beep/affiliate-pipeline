/* ---------- 4-3 매일 오는 재미: 날마다 바뀌는 떠돌이 상인 · 비행선 심부름 · 대장간 분해 ---------- */
const hashS = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// 떠돌이 상인: 같은 날(KST)에는 같은 물건, 자정에 바뀜. 산 물건은 그날 다시 안 나옴. 골드로만 사요.
function makeShop() {
  const P = G.P, d = dayKey(); if (!P.shopD || P.shopD.d !== d) P.shopD = { d, got: [] };
  const R = srand(hashS(d) ^ P.seed ^ (G.Wd.ch * 7919)), keep = Math.random; Math.random = R;
  const L = [goods('pot'), goods('wpot'), goods('pure'), goods('look')], lv = Math.max(2, P.lv);
  try {
    const roll = (l, f) => { let it; for (let k = 0; k < 6; k++) { it = rollDrop(l, f, P.cls); if (!it.u && !it.set) break; } delete it.u; delete it.set; return it; };
    for (let i = 0; i < 8; i++) { const it = roll(lv, 30); it.id = true; if (it.r > 1) it.r = 1; if (it.st === -1) it.st = 0; it.sk = 'n' + i; L.push(it); }
    // 오늘의 귀한 물건 1개(파란 테 이상, 감정된 채로) · 오늘의 재료 1개
    let sp = roll(lv + 2, 260); for (let k = 0; k < 30 && sp.r !== 2; k++) sp = roll(lv + 2, 260); sp.id = true; if (sp.st === -1) sp.st = 0; sp.sk = 'sp'; sp.today = 1; L.push(sp);
    const m = goods(R() < .5 ? 'bhone' : 'bglue'); m.pr = 300 + lv * 25; m.sk = 'mat'; m.today = 1; L.push(m);
  } finally { Math.random = keep; }
  return L.filter(it => !it.sk || !P.shopD.got.includes(it.sk)); }
function shopBought(it) { const P = G.P; if (it.sk && P.shopD) P.shopD.got.push(it.sk); }
function shopFresh() { return G.shop && G.shopDay === dayKey() ? G.shop : (G.shopDay = dayKey(), G.shop = makeShop()); }
// 비행선 심부름: 보내 두면 접속을 안 해도 시간이 흘러 재료를 가져와요. 하루 횟수 제한 없음.
const ERRAND_LV = 5;
const ERRANDS = [
  { k: 'near', n: '가까운 섬 장보기', m: 30, d: '차·사탕과 숫돌·아교 조금' },
  { k: 'mid', n: '이웃 군도 짐 나르기', m: 120, d: '골드, 숫돌·아교, 가끔 장비 하나' },
  { k: 'far', n: '먼 하늘 건너 물건 찾기', m: 480, d: '골드 듬뿍, 장비 하나, 축복 숫돌·아교 반반' },
];
const errandLeft = E => Math.max(0, E.t0 + E.m * 6e4 - Date.now());
function errandSend(i) { const P = G.P, E = ERRANDS[i]; if (!E || P.errand || P.lv < ERRAND_LV) return; P.errand = { k: E.k, n: E.n, m: E.m, t0: Date.now(), lv: P.lv }; sfx('gust'); say('비행선이 「' + E.n + '」 심부름을 떠났어요', '#9fe4ff'); save(); }
function errandClaim() { const P = G.P, E = P.errand; if (!E || errandLeft(E) > 0) return; const lv = E.lv, got = [];
  const add = it => { if (!addInv(it)) G.drops.push({ x: P.x + rnd(-.6, .6), y: P.y + rnd(-.6, .6), it, t: 0 }); got.push(it.g ? GOODS[it.g].n + (it.n > 1 ? ' ' + it.n : '') : itemName(it)); };
  const gold = Math.round(lv * (E.k === 'far' ? 160 : E.k === 'mid' ? 55 : 18)); P.gold += gold;
  if (E.k === 'near') { add(goods('pot', 2)); add(goods('wpot', 2)); add(goods(Math.random() < .5 ? 'hone' : 'glue')); }
  if (E.k === 'mid') { add(goods('hone', 2)); add(goods('glue', 2)); if (Math.random() < .5) add(rollDrop(lv, P.find + 80, P.cls)); }
  if (E.k === 'far') { add(goods('hone', 3)); add(goods('glue', 3)); add(goods(Math.random() < .5 ? 'bhone' : 'bglue')); add(rollDrop(lv + 1, P.find + 180, P.cls)); if (endDone(P) && Math.random() < .3) add(goods('chart')); if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: Math.random() < .3 ? 2 : 1 }); }
  P.errand = null; sfx('coin'); toast('비행선이 돌아왔어요! ' + gold + 'G · ' + got.join(', ')); save(); }
const fmtLeft = ms => { const m = Math.ceil(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + '시간 ' + (m % 60 ? m % 60 + '분' : '') : m + '분'; };
function errandHtml() { const P = G.P, E = P.errand; let h = '<h4 style="margin:10px 0 4px">비행선 심부름</h4>';
  if (P.lv < ERRAND_LV) return h + `<p class="m" style="font-size:12px">${ERRAND_LV}레벨이 되면 마을 비행선을 심부름 보낼 수 있어요.</p>`;
  if (E) { const left = errandLeft(E); return h + `<div class="sk-row"><div class="f"><b>${tr(E.n)}</b><br><small>${left > 0 ? fmtLeft(left) + ' 뒤에 돌아와요 · 게임을 꺼 둬도 시간은 흘러요' : '돌아왔어요!'}</small></div><button class="sk-b ${left > 0 ? '' : 'g'}" data-a="errc" ${left > 0 ? 'disabled' : ''}>${left > 0 ? '다녀오는 중' : '짐 받기'}</button></div>`; }
  return h + ERRANDS.map((e, i) => `<div class="sk-row"><div class="f"><b>${e.n}</b> <small>${e.m >= 60 ? e.m / 60 + '시간' : e.m + '분'}</small><br><small>${e.d}</small></div><button class="sk-b p" data-a="errs" data-i="${i}">보내기</button></div>`).join('') + '<p class="m" style="font-size:11.5px">한 번에 하나씩 보낼 수 있어요. 횟수 제한은 없어요.</p>'; }
function errandTrack() { const E = G.P.errand; if (!E) return null; const left = errandLeft(E); return ['비행선 심부름', left > 0 ? tr(E.n) + ' · ' + fmtLeft(left) + ' 남음' : '돌아왔어요! 마을 게시판에서 짐 받기']; }
// 대장간 분해: 안 쓰는 장비를 숫돌·아교로 바꿔요(무기 → 숫돌, 나머지 → 아교)
function salvageOf(it) { const b = BASE[it.b]; if (!b || it.g) return null; const n = [1, 1, 2, 3, 3][it.r] + (b.lv >= 18 ? 1 : 0) + (it.en >= 4 ? 1 : 0); return [b.s === 'weapon' ? 'hone' : 'glue', n]; }
function salvage(i) { const P = G.P, it = P.inv[i], s = salvageOf(it); if (!s) return; P.inv.splice(i, 1); addInv(goods(s[0], s[1])); sfx('ench'); toast(itemName(it) + ' → ' + GOODS[s[0]].n + ' ' + s[1] + '개'); save(); }
// 마을 건물 쓰임: 내 집 = 창고(60칸) · 우물 = 마시면 생명·바람 가득 + 2분 동안 맑은 물(생명 천천히 회복)
const STASH_N = 60;
function stashMove(c) { const P = G.P; P.stash = P.stash || [];
  if (c[0] === 'i') { const it = P.inv[+c.slice(1)]; if (!it) return; { const k = stackKey(it), h = it.g ? P.stash.find(x2 => x2.g === it.g) : k && P.stash.find(x2 => !x2.g && stackKey(x2) === k); if (h) { h.n = (h.n || 1) + (it.n || 1); P.inv.splice(P.inv.indexOf(it), 1); sfx('pick'); return; } } if (P.stash.length >= STASH_N) { toast('창고가 가득 찼어요'); return; } P.inv.splice(P.inv.indexOf(it), 1); P.stash.push(it); sfx('pick'); }
  else if (c[0] === 's') { const it = P.stash[+c.slice(1)]; if (!it) return; if (!addInv(it)) { toast('가방이 꽉 차거나 너무 무거워요'); return; } P.stash.splice(P.stash.indexOf(it), 1); sfx('pick'); } }
function stashHtml(X) { const P = G.P, S = P.stash || [];
  return `<div class="sk-bx">${X}<h3>내 집 창고 <small style="font-size:12px;color:#8a7458">누르면 옮겨요 · 장마다 같은 창고</small></h3><div class="sk-two"><div><h4>가방 ${P.inv.length}칸 · 무게 ${bagWeight(P)}/${bagCap(P)}</h4><div class="sk-grid">${[...Array(Math.max(INV_N, P.inv.length))].map((_, i) => cell(P.inv[i], 'i' + i)).join('')}</div></div><div><h4>창고 ${S.length}/${STASH_N}</h4><div class="sk-grid">${[...Array(STASH_N)].map((_, i) => cell(S[i], 's' + i)).join('')}</div></div></div>${TOAST}</div>`; }
function drinkWell() { const P = G.P; P.hp = P.mhp; P.wind = P.mwind; P.buf.well = 120; G.fx.push({ k: 'aura', x: P.x, y: P.y, t: 0, life: .6, c: '#9fe4ff' }, { k: 'ring', x: P.x, y: P.y, r: 1.4, t: 0, life: .4, c: '#bfe8ff' }); sfx('lvl'); say('시원한 우물물! 생명·바람이 가득 차고, 2분 동안 생명이 천천히 차올라요', '#9fe4ff', 1); }
function townNear(P, Wd) { if (Wd.stashAt && hyp(P.x - Wd.stashAt[0], P.y - Wd.stashAt[1]) < 1.6) return { k: 'stash', label: '내 집 창고 열기' }; if (Wd.wellAt && hyp(P.x - Wd.wellAt[0], P.y - Wd.wellAt[1]) < 1.5) return { k: 'well', label: '우물물 마시기' }; return null; }
