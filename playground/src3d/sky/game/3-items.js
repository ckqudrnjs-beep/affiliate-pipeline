
/* =================== 장비·물건 =================== */
let UID = 1;
const TAME_N = 150; // 길들이기: 끼고 쓰러뜨린 수
const ADJ = { dmgp: '날 선', ac: '단단한', aspd: '가벼운', hp: '질긴', wind: '바람 먹은', wreg: '맑은', crit: '날카로운', move: '날랜', thorn: '따끔한', kb: '묵직한', str: '굳센', agi: '재빠른', vit: '끈질긴', spi: '숨 깊은', res: '든든한', lifek: '기운 나는', windk: '바람 머금은', blk: '야무진', xp: '배우는', find: '눈 밝은', sk0: '갈래 품은', sk1: '갈래 품은', sk2: '갈래 품은', mind: '고른' };
const encKind = b => b.s === 'weapon' ? 'weapon' : (b.noench ? null : 'armor');
const afxSlot = b => b.s === 'weapon' ? 'W' : ['amulet', 'ear', 'ring'].includes(b.s) ? 'J' : 'A';
function goods(g, n) { return { uid: UID++, g, n: n || 1 }; }
function rollAfx(b, ilv, n, have) {
  const out = [], ws = afxSlot(b), used = new Set((have || []).map(a => a[0]));
  const pool = AFX.filter(a => (a.w === 'a' || a.w.includes(ws)) && !used.has(a.k));
  for (let i = 0; i < n && pool.length; i++) {
    let a; do { a = pool[Math.floor(Math.random() * pool.length)]; } while (a.rare && Math.random() < .7 && pool.length > 3);
    pool.splice(pool.indexOf(a), 1);
    const f = clamp(.35 + ilv / 14, .35, 1.2), v = Math.max(1, Math.round(rnd(a.v[0], a.v[1]) * (a.v[0] === a.v[1] ? 1 : f)));
    out.push([a.k, v]);
  }
  return out;
}
function makeItem(bid, rar, ilv, o) {
  o = o || {}; const b = BASE[bid], it = { uid: UID++, b: bid, r: rar, ilv, en: 0, st: 0, id: rar < 2, af: [], tame: 0 };
  if (rar === 1 || rar === 2) { const [a, c] = RAR[rar].k; it.af = rollAfx(b, ilv, ri(a, c)); it.hid = rollAfx(b, ilv, 1, it.af)[0] || null; }
  if (rar === 2) it.nm = pick(NM1) + ' ' + pick(b.s === 'weapon' && b.cls === 'windcaller' ? NM2.weaponS : NM2[b.s] || ['물건']);
  if (o.u) { const U = UNIQ.find(u => u.id === o.u); it.u = o.u; it.af = U.fx.map(x => x.slice()); it.id = false; }
  if (o.set) { it.set = o.set; it.af = []; it.id = false; }
  if (b.s !== 'ring' && b.s !== 'amulet' && b.s !== 'ear' && !o.u && !o.set) { const r = Math.random(); it.st = r < .06 ? 1 : r < .1 ? -1 : 0; }
  if (o.st != null) it.st = o.st;
  if (o.id) it.id = true;
  return it;
}
// 드롭할 장비 고르기: 레벨에 맞는 기본 장비 중 하나 + 등급
function rollDrop(ilv, find, cls) {
  const ok = BASES.filter(b => b.lv <= ilv + 1 && (!b.cls || b.cls === cls || Math.random() < .35));
  const b = pick(ok); const r = Math.random() / (1 + find / 100);
  const rar = r < .045 ? 2 : r < .3 ? 1 : 0;
  if (Math.random() < .02 * (1 + find / 100) && ilv >= 3) { const sp = pick(SETS.dandelion.parts); return makeItem(sp[0], 4, Math.max(3, ilv), { set: 'dandelion' }); }
  return makeItem(b.id, rar, ilv);
}
function itemName(it) {
  if (it.g) return GOODS[it.g].n + (it.n > 1 ? ' ×' + it.n : '');
  const b = BASE[it.b]; let n;
  if (!it.id) return '감정 안 된 ' + b.n;
  if (it.u) n = UNIQ.find(u => u.id === it.u).n;
  else if (it.set) n = SETS[it.set].parts.find(p => p[0] === it.b)[1];
  else if (it.r === 2) n = it.nm;
  else if (it.r === 1 && it.af.length) n = ADJ[it.af[0][0]] + ' ' + b.n;
  else n = b.n;
  return (it.st === 1 ? '축복 받은 ' : it.st === -1 ? '저주받은 ' : '') + (it.en ? '+' + it.en + ' ' : '') + n;
}
const itemColor = it => it.g ? (GOODS[it.g].quest ? '#ffe08a' : '#e7e2d4') : RAR[it.r].c;
function afxText(k, v, cls) { const a = AFXK[k]; let t = a.d.replace('{}', v); const br = BRANCH[cls] || BRANCH.warden; return t.replace('{br0}', br[0]).replace('{br1}', br[1]).replace('{br2}', br[2]); }
// 장비 하나가 주는 수치 합
function itemMods(it, out) {
  const b = BASE[it.b], add = (k, v) => { out[k] = (out[k] || 0) + v; };
  const bl = it.st || 0;
  if (b.dmg) { const e = it.en + bl; out.dmg = b.dmg.map(v => Math.max(1, v + e)); out.wspd = b.spd || 1; }
  if (b.ac != null) add('ac', b.ac + (b.s !== 'weapon' && !b.noench ? it.en + bl : 0));
  if (b.blk) add('blk', b.blk);
  if (b.sail) out.sail = b.sail.slice();
  for (const k in b.fix || {}) add(k, b.fix[k]);
  if (it.id) { for (const [k, v] of it.af) add(k, v); if (it.hid && it.tame >= TAME_N) add(it.hid[0], it.hid[1]); }
  return out;
}
function priceOf(it) { if (it.g) return Math.round((GOODS[it.g].price || 8) * .4) * it.n; const b = BASE[it.b]; return Math.round((6 + b.lv * 4 + it.en * 10) * [1, 2, 4, 8, 6][it.r] * (it.id ? 1 : .6)); }
function canWear(P, it) { const b = BASE[it.b]; if (it.g) return '장비가 아니에요'; if (b.cls && b.cls !== P.cls) return CLASSES[b.cls].name + ' 전용'; if (P.lv < b.lv) return b.lv + '레벨부터';
  for (const k in b.req || {}) if (P.st[k] < b.req[k]) return STATS.find(s => s[0] === k)[1] + ' ' + b.req[k] + ' 필요'; return ''; }
// 강화: mat = 'hone'|'glue'|'bhone'|'bglue' → {ok, msg}
function enchant(it, mat) {
  const b = BASE[it.b], kind = encKind(b), blessedMat = mat[0] === 'b';
  if (!kind) return { ok: 0, msg: '장신구는 강화할 수 없어요' };
  if ((kind === 'weapon') !== (mat === 'hone' || mat === 'bhone')) return { ok: 0, msg: kind === 'weapon' ? '무기는 숫돌로 강화해요' : '방어구는 아교로 강화해요' };
  if (it.en >= MAXENCH) return { ok: 0, msg: '+10이 끝이에요' };
  if (!it.id) return { ok: 0, msg: '먼저 감정해야 해요' };
  const next = it.en + 1, safe = next <= SAFE[kind], rate = safe ? 1 : ENCH_RATE[kind][next] || .05;
  if (blessedMat) { if (safe || Math.random() < Math.max(rate, .5)) { const up = (Math.random() < .35 && next < MAXENCH) ? 2 : 1; it.en += up; return { ok: 1, up, msg: '+' + it.en + ' 성공!' + (up > 1 ? ' 두 단계!' : '') }; } return { ok: 2, msg: '실패했지만 축복 덕분에 그대로예요' }; }
  if (Math.random() < rate) { it.en = next; return { ok: 1, up: 1, msg: '+' + it.en + ' 성공!' }; }
  if (it.st === 1) { it.st = 0; return { ok: 2, msg: '실패! 축복이 대신 사라졌어요(단계 유지)' }; }
  it.en = Math.max(0, it.en - 1); return { ok: 3, msg: '실패… +' + it.en + '(으)로 내려갔어요' };
}
function reroll(it) { const b = BASE[it.b]; if (!(it.r === 1 || it.r === 2) || !it.af.length) return false; const i = Math.floor(Math.random() * it.af.length); const rest = it.af.filter((_, j) => j !== i); const n = rollAfx(b, it.ilv, 1, rest.concat([it.af[i]]))[0]; if (!n) return false; it.af[i] = n; return i; }

/* ---------- 캐릭터 수치 ---------- */
function setCount(P) { const c = {}; for (const s in P.eq) { const it = P.eq[s]; if (it && it.set && it.id) c[it.set] = (c[it.set] || 0) + 1; } return c; }
function calc(P) {
  const C = CLASSES[P.cls], m = { ac: 0 };
  for (const s in P.eq) if (P.eq[s]) itemMods(P.eq[s], m);
  const sc = setCount(P); for (const k in sc) for (const [n, fx] of SETS[k].bonus) if (sc[k] >= n) for (const [a, v] of fx) m[a] = (m[a] || 0) + v;
  const st = {}; for (const [k] of STATS) st[k] = C.stat[k] + (P.sp[k] || 0) + (m[k] || 0);
  const S = P.st = st;
  P.mhp = Math.round(30 + S.vit * 4 + P.lv * 6 + (m.hp || 0));
  P.mwind = Math.round(18 + S.spi * 2 + P.lv * 2 + (m.wind || 0));
  P.ac = (m.ac || 0) + Math.floor(S.agi / 5) + (P.buf.shout ? 6 : 0);
  P.dmg = m.dmg || [1, 2, 1, 3]; if (m.mind) { P.dmg = P.dmg.slice(); P.dmg[0] += m.mind; P.dmg[2] += m.mind; }
  P.dmgp = (m.dmgp || 0) + (C.melee ? S.str : S.spi) + (P.buf.brave ? 25 : 0);
  P.aspd = C.aspd * (m.wspd || 1) * (1 + ((m.aspd || 0) + S.agi * .6) / 100);
  P.crit = 3 + S.agi * .25 + (m.crit || 0);
  P.move = 3.6 * (1 + ((m.move || 0) + Math.min(10, S.agi * .2)) / 100);
  P.wreg = (.9 + S.spi * .06) * (1 + (m.wreg || 0) / 100);
  P.blk = P.cls === 'warden' ? (m.blk || 0) + S.agi * .1 : (m.blk || 0);
  P.res = m.res || 0; P.thorn = m.thorn || 0; P.kbm = 1 + (m.kb || 0) / 100; P.lifek = m.lifek || 0; P.windk = m.windk || 0; P.xpm = 1 + (m.xp || 0) / 100; P.find = m.find || 0;
  P.skb = [m.sk0 || 0, m.sk1 || 0, m.sk2 || 0];
  P.sail = m.sail || [2.4, 1.6];
  P.hp = Math.min(P.hp == null ? P.mhp : P.hp, P.mhp); P.wind = Math.min(P.wind == null ? P.mwind : P.wind, P.mwind);
}
const xpNeed = L => Math.round(40 * Math.pow(L, 1.45));
function skLv(P, s) { const base = P.sk[s.id] || 0; return base ? base + P.skb[s.br] : 0; }
function synergy(P, s) { let n = 0; for (const o of SKILLS[P.cls]) if (o.br === s.br && o.id !== s.id) n += P.sk[o.id] || 0; return 1 + n * .06; }
