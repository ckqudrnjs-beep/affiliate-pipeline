/* ---------- 10레벨 두 번째 갈래 + 매일 장치(순풍 알림 · 오늘의 섬 · 하루 의뢰) ---------- */
// 스킬 점수 10이 되면 고르는 두 번째 갈래(모든 스킬 공통 두 방향)
const FORK2 = [['세찬 바람', '피해 +40%, 다시 쓰기 시간 +15%.'], ['가벼운 바람', '다시 쓰기 시간 -35%, 바람 소모 -25%.']];
const FORK2B = [['북돋는 바람', '쓸 때마다 생명력 15%와 바람 10을 채워요.'], FORK2[1]]; // 피해가 없는 스킬
const fork2Of = s => s.m ? FORK2 : FORK2B;
const f2Of = (P, id) => (P.sk[id] || 0) >= 10 && P.fork2 ? P.fork2[id] : null;

// 하루 기준: 한국 시간 자정
const dayKey = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const dayNum = k => Math.floor(Date.parse(k + 'T00:00:00Z') / 864e5);
const DAILY_LV = 3, ISLE_N = 15;
function isleName(k) { const D = G.P.daily; if (D && k === D.isle && D.ich && D.ich !== G.Wd.ch) return tr(D.iname) + '(' + D.ich + '장)'; const s = G.Wd.islands[k]; return s && s.name || '섬'; }
// 갈 수 있는 사냥 섬 중 내 레벨에 맞는 곳 몇 개에서 날마다 하나
function isleCands(P) { const Wd = G.Wd, L = (Wd.ch >= 3 ? [...Wd.fi, ...(P.flags['c' + Wd.ch + 'bridge'] ? Wd.ci : [])] : Wd.ch === 3 ? [...Wd.fi, ...(P.flags.c3bridge ? Wd.ci : [])] : Wd.ch === 2 ? [...Wd.fi, ...(P.flags.c2bridge ? Wd.ci : [])] : [...Wd.fi, ...(P.flags.bridge ? [Wd.hill] : []), ...(P.flags.bridge2 ? Wd.mi : [])]).map(k => [k, Wd.islands[k].lv[1]]);
  const fit = L.filter(([, lv]) => lv >= P.lv - 4 && lv <= P.lv + 3); return (fit.length ? fit : L.sort((a, b) => b[1] - a[1]).slice(0, 2)).map(a => a[0]); }
const DTASK = {
  kill: (t, n) => ['밑것 ' + n + '마리 쓰러뜨리기', n],
  elite: (t, n) => ['정예 ' + n + '마리 쓰러뜨리기', n],
  fell: (t, n) => ['섬 밖으로 ' + n + '마리 떨어뜨리기', n],
  nest: (t, n) => ['둥지지기 ' + n + '마리 쓰러뜨리기', n],
  isle: (t, n) => ['오늘의 섬 상자 열기', 1],
  mob: (t, n) => [MOBDEF[t].n + ' ' + n + '마리', n],
};
function newDaily(P, d) {
  const R = srand(dayNum(d) * 7919 + P.seed % 997), pk = a => a[Math.floor(R() * a.length)], C = isleCands(P);
  const mobs = CXM(G.Wd.ch) ? [CXM(G.Wd.ch).a, CXM(G.Wd.ch).b, CXM(G.Wd.ch).d] : G.Wd.ch === 3 ? ['saltfluff', 'barnpod', 'crab'] : G.Wd.ch === 2 ? ['rustfluff', 'boltpod', 'scarecrow'] : P.flags.bridge2 ? ['mudfluff', 'bogpod', 'heronling'] : ['fluff', 'seed', 'bird'];
  const pool = [['mob', pk(mobs), 15], ['kill', '', 40], ['elite', '', 3], ['fell', '', 6], ['nest', '', 2]];
  const tasks = [['isle', '', 1]]; while (tasks.length < 3) { const t = pool.splice(Math.floor(R() * pool.length), 1)[0]; tasks.push(t); }
  const isle = C[Math.floor(R() * C.length)]; P.daily = { d, isle, ich: G.Wd.ch, iname: G.Wd.islands[isle].name, isleN: 0, chest: 0, all: 0, tasks: tasks.map(([k, t, n]) => ({ k, t, n, c: 0, got: 0 })) };
}
function dailyCheck(quiet) { const P = G.P; if (P.lv < DAILY_LV) return; const d = dayKey(); if (P.daily && P.daily.d === d) return;
  const first = !P.daily; newDaily(P, d); G.today = P.daily.isle; G.chest = null; for (const pk of G.packs) if (pk.isl === G.today && !pk.boss && !pk.elite) pk.elite = ri(1, ELITE.length);
  if (!quiet) { G.cut = { s: first ? '마을 게시판에 하루 의뢰가 붙었어요' : '새 하루가 밝았어요', c: '#ffd166', t: 0 }; say('오늘의 섬은 「' + isleName(P.daily.isle) + '」이에요. 마을 게시판에서 하루 의뢰 3개를 확인해요.', '#ffd166'); } }
function dTask(k, t, n) { const D = G.P.daily; if (!D) return; for (const q of D.tasks) if (q.k === k && (!t || q.t === t) && q.c < q.n) { q.c = Math.min(q.n, q.c + (n || 1)); if (q.c >= q.n) { say('하루 의뢰 「' + DTASK[q.k](q.t, q.n)[0] + '」 끝! 마을 게시판에서 보상을 받아요.', '#ffd166'); sfx('lvl'); } } }
function dailyKill(m, fell) { const P = G.P, D = P.daily; if (!D || P.lv < DAILY_LV) return;
  dTask('kill'); dTask('mob', m.t); if (m.elite) dTask('elite'); if (fell) dTask('fell'); if (m.D.mini) dTask('nest');
  if (m.pk && G.today != null && m.pk.isl === G.today && !D.chest && !G.chest) { D.isleN = Math.min(ISLE_N, D.isleN + 1); if (D.isleN >= ISLE_N) { spawnChest(); G.cut = { s: '오늘의 섬 상자가 나타났어요!', c: '#ffd166', t: 0 }; sfx('lvl'); } } }
function spawnChest() { const s = G.Wd.islands[G.P.daily.isle]; let x = s.cx + .5, y = s.cy + .5; for (let i = 0; i < 30 && !walk(G.Wd, x, y); i++) { x = s.cx + rnd(-2.5, 2.5); y = s.cy + rnd(-2.5, 2.5); }
  G.chest = { x, y, t: 0 }; G.fx.push({ k: 'ring', x, y, r: 2, t: 0, life: .6, c: '#ffd166' }); }
function dailyStart() { const P = G.P, D = P.daily;
  if (D && D.d === dayKey() && (D.ich || 1) !== G.Wd.ch && !D.isleN && !D.chest && P.lv >= DAILY_LV) { const C = isleCands(P); D.isle = C[Math.floor(Math.random() * C.length)]; D.ich = G.Wd.ch; D.iname = G.Wd.islands[D.isle].name; }
  G.today = D && D.d === dayKey() && (D.ich || 1) === G.Wd.ch ? D.isle : null; dailyCheck(); if (P.daily && G.today != null && P.daily.isleN >= ISLE_N && !P.daily.chest) spawnChest(); if (P.daily && P.daily.isleN >= ISLE_N && !P.daily.chest) spawnChest(); }
function openChest() { const P = G.P, D = P.daily, C = G.chest; if (!C || !D) return; G.chest = null; D.chest = 1; dTask('isle');
  const lv = Math.max(P.lv, (G.Wd.islands[D.isle].lv || [8, 8])[1]), put = it => G.drops.push({ x: C.x + rnd(-.8, .8), y: C.y + rnd(-.8, .8), it, t: 0 });
  G.drops.push({ x: C.x, y: C.y + .5, gold: lv * 40, t: 0 }); put(rollDrop(lv + 2, P.find + 220, P.cls)); put(rollDrop(lv + 1, P.find + 150, P.cls)); put(goods(Math.random() < .5 ? 'bhone' : 'bglue')); put(goods('pot', 2));
  if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: Math.random() < .35 ? 2 : 1 });
  for (let i = 0; i < 14; i++) G.fx.push({ k: 'pop', x: C.x + rnd(-1, 1), y: C.y + rnd(-1, 1), t: -Math.random() * .4, life: .5, c: '#ffd166' }); G.shake = 4; sfx('ench'); say('오늘의 섬 상자를 열었어요!', '#ffd166'); save(); }
function dReward(P) { return { gold: 20 + P.lv * 25, xp: Math.round(xpNeed(P.lv) * .12) }; }
function claimTask(i) { const P = G.P, D = P.daily, q = D && D.tasks[i]; if (!q || q.c < q.n || q.got) return; q.got = 1; const r = dReward(P); P.gold += r.gold; gainXp(r.xp); addInv(goods(i === 0 ? 'pot' : 'wpot', 2));
  if (!D.all && D.tasks.every(t => t.got)) { D.all = 1; P.gold += 50 + P.lv * 30; addInv(goods('bhone')); if (P.lv >= BOARD_LV) giveShard({ c: pick(Object.keys(SHARD)), q: 2 }); toast('하루 의뢰 셋을 다 했어요! 덤으로 축복 숫돌을 받았어요'); } else toast(r.gold + 'G · 경험치 ' + r.xp + ' 받았어요'); sfx('coin'); save(); }
function dailyHtml(X) { const P = G.P, D = P.daily;
  if (!D) return `<div class="sk-bx" style="max-width:440px">${X}<h3>마을 게시판</h3><p class="m">${DAILY_LV}레벨이 되면 날마다 하루 의뢰 3개와 오늘의 섬이 붙어요.</p></div>`;
  const r = dReward(P); let h = `<div class="sk-bx" style="max-width:460px">${X}<h3>마을 게시판 <small style="font-size:12px;color:#8a7458">${D.d.slice(5).replace('-', '월 ')}일 · 자정에 바뀌어요</small></h3>`;
  h += `<div class="sk-card" style="border-color:#e8b05a;background:#fff6e4"><b style="color:#b0702a">오늘의 섬 · ${isleName(D.isle)}</b><br><small>정예가 더 나오고 금화를 1.5배 떨궈요. 밑것 ${ISLE_N}마리를 쓰러뜨리면 상자가 나타나요.</small><br><small>${D.chest ? '상자를 열었어요 ✓' : G.chest ? '상자가 나와 있어요!' : '진행 ' + D.isleN + '/' + ISLE_N}</small></div>`;
  h += '<h4 style="margin:8px 0 4px">하루 의뢰</h4>' + D.tasks.map((q, i) => { const [n, need] = DTASK[q.k](q.t, q.n); return `<div class="sk-row"><div class="f"><b>${n}</b><br><small>${Math.min(q.c, need)}/${need} · 보상 ${r.gold}G, 경험치 ${r.xp}, ${i === 0 ? '민들레 차' : '바람 사탕'} 2</small></div><button class="sk-b ${q.got ? '' : 'g'}" data-a="dclaim" data-i="${i}" ${q.c >= q.n && !q.got ? '' : 'disabled'}>${q.got ? '받음' : q.c >= q.n ? '받기' : '진행 중'}</button></div>`; }).join('');
  h += `${errandHtml()}<p class="m" style="font-size:11.5px">셋을 다 하면 덤으로 축복 숫돌을 줘요. 못 한 날도 손해는 없어요.${P.rested > 1 ? ' · 지금 순풍: 경험치 2배 ' + Math.round(P.rested) + ' 남음' : ''}</p>` + TOAST + '</div>'; return h; }
function dailyTrack() { const P = G.P, D = P.daily; if (!D) return null; const left = D.tasks.filter(q => !q.got).length; if (!left) return null; const ready = D.tasks.filter(q => q.c >= q.n && !q.got).length;
  const q = D.tasks.find(q => q.c < q.n);
  return ['하루 의뢰 ' + (3 - left) + '/3', ready ? '마을 게시판에서 보상 받기' : G.chest ? '오늘의 섬 상자 열기' : !D.chest ? '오늘의 섬 ' + isleName(D.isle) + ' ' + D.isleN + '/' + ISLE_N : q ? DTASK[q.k](q.t, q.n)[0] + ' ' + q.c + '/' + q.n : '마을 게시판']; }
// 순풍 알림: 오래 쉬다 오면 한 번 알려 줌
function restNote(S) { const away = Math.max(0, Date.now() - (S.t || Date.now())) / 36e5; if (away >= 1 && G.P.rested > 1) setTimeout(() => { if (G) say('쉬는 동안 순풍이 불었어요. 다음 경험치 ' + Math.round(G.P.rested) + '만큼은 2배로 받아요.', '#9fe4ff'); }, 1200); }
// 상자 그림(나무 상자 + 빛)
function drawChest(c, sx, sy) { const t = G.t; x.save(); x.globalAlpha = .35 + .2 * Math.sin(t * 3); x.fillStyle = '#ffe08a'; x.beginPath(); x.ellipse(sx, sy, 26, 12, 0, 0, TAU); x.fill(); x.globalAlpha = 1;
  x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(sx, sy + 2, 18, 7, 0, 0, TAU); x.fill(); const b = Math.sin(t * 2.4) * 1.5;
  x.fillStyle = '#8a5a2a'; x.fillRect(sx - 15, sy - 20 + b, 30, 18); x.fillStyle = '#a8703a'; x.beginPath(); x.moveTo(sx - 16, sy - 20 + b); x.quadraticCurveTo(sx, sy - 34 + b, sx + 16, sy - 20 + b); x.closePath(); x.fill();
  x.strokeStyle = '#5a3a1a'; x.lineWidth = 2; x.strokeRect(sx - 15, sy - 20 + b, 30, 18); x.fillStyle = '#ffd166'; x.fillRect(sx - 16, sy - 15 + b, 32, 3); x.fillRect(sx - 3, sy - 18 + b, 6, 8); x.restore(); }
