/* ---------- 엔딩 뒤: 난이도 먹구름·폭풍 + 떠도는 섬(항로 지도로 여는 반복 사냥터) ---------- */
// 난이도: 7장 엔딩 뒤 먹구름, 먹구름에서 첫 이음꾼을 쓰러뜨리면 폭풍. 적이 세지는 만큼 경험치·골드·장비 레벨·좋은 물건 확률이 오른다.
const DIFFT = [
  { n: '보통', hp: 1, dmg: 1, lv: 0, xp: 1, gold: 1, ilv: 0, find: 0, c: '#ece6d6' },
  { n: '먹구름', hp: 2.4, dmg: 1.7, lv: 8, xp: 2, gold: 1.8, ilv: 8, find: 70, c: '#9fb4d8' },
  { n: '폭풍', hp: 5, dmg: 2.6, lv: 16, xp: 3.5, gold: 2.8, ilv: 16, find: 150, c: '#c9a8ff' },
  // 2026-11-15 BK: 6단계로 늘림. 각 난이도에서 엔딩(7장 보스)을 깨면 다음 단계가 열린다.
  { n: '천둥', hp: 9, dmg: 3.6, lv: 24, xp: 5, gold: 3.8, ilv: 24, find: 230, c: '#ffe27a' },
  { n: '회오리', hp: 15, dmg: 4.8, lv: 32, xp: 7, gold: 5, ilv: 32, find: 320, c: '#7ae0c8' },
  { n: '큰바람', hp: 24, dmg: 6.2, lv: 40, xp: 9.5, gold: 6.5, ilv: 40, find: 420, c: '#ff8a6a' } ];
const dT = () => DIFFT[(G && G.P && G.P.diff) || 0];
const endDone = P => P.q.q37 && P.q.q37.s === 3;
// 엔딩을 깬 가장 높은 난이도(-1 = 아직). 예전 저장(엔딩·stormok)도 그대로 인정
const dClr = P => Math.max(P.flags.dclr != null ? P.flags.dclr : -1, endDone(P) ? 0 : -1, P.flags.stormok ? 1 : -1);
const diffOk = (P, i) => i <= dClr(P) + 1 && i < DIFFT.length;
function setDiff(i) { const P = G.P; if (!diffOk(P, i) || (P.diff || 0) === i) return; P.diff = i; const ch = G.Wd.ch; goChapter(ch); G.cut = { s: '난이도 ' + DIFFT[i].n, c: DIFFT[i].c, t: 0 }; say('난이도가 「' + DIFFT[i].n + '」(으)로 바뀌었어요. 밑것들이 새로 깨어났어요.', DIFFT[i].c); }
GOODS.chart = { n: '항로 지도', ic: 'plank', d: '바람개비 표지에서 펼치면 떠도는 섬 하나로 가는 바람길이 열려요. 섬은 갈 때마다 달라요' };
// 떠도는 섬: 4~7장 중 한 곳의 땅·밑것을 빌려 오고, 내 레벨에 맞춰 세지는 섬. 의뢰는 없고 우두머리를 쓰러뜨리면 보물 상자.
function roamSetup(R) { const S = CHX[R.src], L = R.lv;
  CHX[8] = Object.assign({}, S, { src: R.src, n: '떠도는 섬', town: '떠도는 섬 나루터', roam: 1, qid: [], q0: 0,
    isl: S.isl.map(n => '떠도는 ' + n), ci: S.ci.map(n => '떠도는 ' + n), hill: '떠도는 ' + S.hill,
    lv: S.lv.map((_, i) => [L + (i >> 1), L + 1 + (i >> 1)]), hlv: [L + 3, L + 4], blv: L + 5 });
  CHAPS[8] = ['떠도는 섬 · ' + S.n, '', () => false]; }
function roamOpen() { const P = G.P; if (!endDone(P) || !useGood('chart', 1)) return; const src = 4 + Math.floor(Math.random() * 4);
  P.roam = { src, seed: (Math.random() * 1e9) | 0, lv: Math.max(P.lv, CHX[src].lv[0][0]), boss: 0, from: G.Wd.ch === 8 ? (P.roam && P.roam.from) || 7 : G.Wd.ch };
  roamSetup(P.roam); goChapter(8); say('항로 지도를 펼쳤어요. 「' + CHX[src].n + '」을(를) 닮은 떠도는 섬이에요.', '#9fe4ff'); }
function roamBossScale(m) { const R = G.P.roam, C = CHX[R.src]; if (!R || !m.D.chboss) return; const k = 1 + Math.max(0, CHX[8].blv - C.blv) * .06; m.hp = m.mhp = Math.round(m.mhp * k); m.dmg = m.dmg.map(v => v * (1 + Math.max(0, CHX[8].blv - C.blv) * .04)); m.lv = CHX[8].blv; }
function roamKill(m) { const P = G.P, R = P.roam; if (!R || !m.D.chboss || R.boss) return; R.boss = 1; const rb = P.flags.rb = (P.flags.rb || []).concat(); rb[P.diff || 0] = (rb[P.diff || 0] || 0) + 1; P.flags.rb = rb; G.shake = 14; G.flash = .4;
  const put = it => G.drops.push({ x: m.x + rnd(-1, 1), y: m.y + rnd(-1, 1), it, t: 0 }), T = dT(), lv = CHX[8].blv + T.ilv;
  for (let i = 0; i < 3 + (P.diff || 0); i++) put(rollDrop(lv, P.find + 200 + T.find, P.cls)); put(goods('bhone')); put(goods('bglue')); if (Math.random() < .6) put(goods('chart'));
  giveShard({ c: pick(Object.keys(SHARD)), q: 3 }); say('떠도는 섬의 ' + m.D.n + '을(를) 쓰러뜨렸어요! 보물이 쏟아졌어요. 바람개비 표지에서 돌아갈 수 있어요.', '#ffd166'); save(); }
function roamHtml() { const P = G.P; if (!endDone(P)) return ''; const n = count('chart'), cur = P.diff || 0;
  let h = '<h4 style="margin:10px 0 4px">난이도</h4><div class="sk-row" style="gap:4px;flex-wrap:wrap">' + DIFFT.map((d, i) => `<button class="sk-b${i === cur ? ' g' : ''}" data-a="diff" data-i="${i}" ${diffOk(P, i) ? '' : 'disabled'} style="width:calc(33% - 8px);margin:2px">${d.n}${diffOk(P, i) ? '' : ' 🔒'}</button>`).join('') + '</div>';
  h += `<p class="m" style="font-size:11.5px">${cur ? DIFFT[cur].n + ': 적 체력 ×' + DIFFT[cur].hp + ', 피해 ×' + DIFFT[cur].dmg + ' · 경험치 ×' + DIFFT[cur].xp + ', 장비 레벨 +' + DIFFT[cur].ilv : '먹구름·폭풍은 적이 세지는 대신 경험치와 장비가 좋아져요.'}${dClr(P) + 1 < DIFFT.length - 1 ? ' 다음 난이도는 지금 열린 가장 높은 난이도에서 엔딩(7장 보스)을 깨면 열려요.' : ''}</p>`;
  h += `<h4 style="margin:10px 0 4px">떠도는 섬</h4><div class="sk-row"><div class="f"><b>항로 지도 펼치기</b><br><small>가진 지도 ${n}장 · 둥지지기·장 보스·먼 심부름이 가끔 줘요</small></div><button class="sk-b g" data-a="roam" ${n ? '' : 'disabled'}>펼치기</button></div>`;
  if (G.Wd.ch === 8) { const f = (P.roam && P.roam.from) || 7; h += `<div class="sk-row"><div class="f"><b>${CHAPS[f][0]}(으)로 돌아가기</b></div><button class="sk-b p" data-a="chap" data-i="${f}">돌아가기</button></div>`; }
  return h; }
// 엔딩 뒤 항로 지도 얻는 곳: 둥지지기 8%, 장 보스 1장, 먼 심부름 30%
function roamDrops(m, put) { const P = G.P; if (!endDone(P) || G.Wd.ch === 8) return; if (m.D.chboss || m.D.mini && Math.random() < .08) put(goods('chart')); if (m.D.chboss === 7) { const d = P.diff || 0; if (d > dClr(P)) { P.flags.dclr = d; if (d === 1) P.flags.stormok = 1; if (DIFFT[d + 1]) { say(`난이도 「${DIFFT[d + 1].n}」이(가) 열렸어요!`, DIFFT[d + 1].c); } } skyRankEnd(d); } }
// 랭킹용 기록(2026-11-15 BK): 엔딩 난이도·시각, 보통 엔딩까지 걸린 플레이 시간. 순위는 서버가 저장 기록에서 뽑는다(skysave → sky_rank)
function skyRankEnd(d) { const P = G.P; if (d === 0 && P.flags.endT == null) P.flags.endT = Math.round(P.play || 0);
  if (P.flags.dmax == null || d > P.flags.dmax) { P.flags.dmax = d; P.flags.dmaxAt = Date.now(); } }
