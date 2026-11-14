
/* =================== 세계: 섬·다리·소품 =================== */
// 바닥 칸: 0 하늘(빈칸) 1 풀 2 흙길 3 다리 4 끊어진 다리 5 돌바닥
const TW = 64, TH = 32; // 1배 화면에서 칸 마름모 크기
const iso = (x, y) => [(x - y) * TW / 2, (x + y) * TH / 2];
const unIso = (sx, sy) => [(sx / (TW / 2) + sy / (TH / 2)) / 2, (sy / (TH / 2) - sx / (TW / 2)) / 2];
function noise2(seed) { // 값 잡음(부드러운 0~1)
  const R = srand(seed), N = 64, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = R();
  const at = (x, y) => g[((y % N + N) % N) * N + ((x % N + N) % N)], sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sm(x - x0), fy = sm(y - y0); return lerp(lerp(at(x0, y0), at(x0 + 1, y0), fx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), fx), fy); };
}
function makeWorld(seed) {
  const W = 100, H = 84, R = srand(seed), nz = noise2(seed + 7), nz2 = noise2(seed + 13);
  const g = new Uint8Array(W * H), isl = new Int16Array(W * H).fill(-1), depth = new Float32Array(W * H);
  const id = (x, y) => y * W + x, inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const islands = [];
  // 섬 모양 = 각도마다 반지름이 다른 둥근 땅(잡음). 칸은 가운데 점이 땅 안이면 땅.
  const shape = (s, x, y) => { const dx = x - s.cx, dy = y - s.cy, a = Math.atan2(dy, dx); return s.r * (1 + .18 * Math.sin(a * 3 + s.ph) + .12 * Math.sin(a * 5 + s.ph * 2) + .07 * Math.sin(a * 11 + s.ph * 3) + .22 * (nz(x * .15, y * .15) - .5)); };
  function blob(cx, cy, r, kind) {
    const k = islands.length, s = { cx, cy, r, kind, k, ph: R() * 10 }; islands.push(s);
    for (let y = Math.floor(cy - r * 1.6); y <= cy + r * 1.6; y++) for (let x = Math.floor(cx - r * 1.6); x <= cx + r * 1.6; x++) {
      if (!inb(x, y)) continue; const d = Math.hypot(x + .5 - cx, y + .5 - cy), rr = shape(s, x + .5, y + .5);
      if (d < rr) { g[id(x, y)] = 1; isl[id(x, y)] = k; depth[id(x, y)] = 1 - d / rr; }
    }
    return k;
  }
  // 섬 배치(맛보기판): 마을 섬 → 들판 섬 4~5개 → (끊어진 다리) → 바람개비 언덕
  const town = blob(16, 42, 10.5, 'town');
  const F = [[34, 30, 8], [37, 54, 8.5], [53, 40, 9], [62, 22, 7.5], [66, 60, 7.5]].map(([x, y, r]) => [x + R() * 3 - 1.5, y + R() * 3 - 1.5, r + R() * 1.2]);
  const fi = F.map(([x, y, r]) => blob(x, y, r, 'field'));
  const hill = blob(86, 30, 8.5, 'hill');
  // 작은 떠돌이 바위섬(장식)
  for (let i = 0; i < 7; i++) { const x = 10 + R() * 80, y = 6 + R() * 74; let ok = true; for (const s of islands) if (Math.hypot(s.cx - x, s.cy - y) < s.r + 5) ok = false; if (ok) blob(x, y, 1.6 + R() * 1.4, 'rock'); }
  // 다리: 두 섬 사이를 x축 → y축 순서로 잇는 2칸 너비 길. 빈칸만 다리로 바꾼다.
  const bridges = [];
  function bridge(a, b, broken) {
    const A = islands[a], B = islands[b], cells = [];
    let x = Math.round(A.cx), y = Math.round(A.cy); const tx = Math.round(B.cx), ty = Math.round(B.cy);
    const put = (x, y) => { for (const [ox, oy] of [[0, 0], [0, 1], [1, 0]]) { const X = x + ox, Y = y + oy; if (!inb(X, Y)) continue; const i = id(X, Y); if (g[i] === 0) { g[i] = broken ? 4 : 3; cells.push(i); } else if (g[i] !== 3 && g[i] !== 4) land.push(i); } }, land = [];
    const vert = Math.abs(ty - y) > Math.abs(tx - x);
    if (!vert) { while (x !== tx) { put(x, y); x += Math.sign(tx - x); } while (y !== ty) { put(x, y); y += Math.sign(ty - y); } }
    else { while (y !== ty) { put(x, y); y += Math.sign(ty - y); } while (x !== tx) { put(x, y); x += Math.sign(tx - x); } }
    // 다리 끝은 땅 쪽으로 1~2칸 더 깐다(둥근 섬 가장자리와 이어지게)
    const ends = land.filter(i => { const X = i % W, Y = (i / W) | 0; for (let yy = Y - 2; yy <= Y + 2; yy++) for (let xx = X - 2; xx <= X + 2; xx++) if (inb(xx, yy) && (g[id(xx, yy)] === 3 || g[id(xx, yy)] === 4) && Math.hypot(xx - X, yy - Y) < 2.2) return true; return false; });
    bridges.push({ a, b, cells, ends, broken: !!broken }); return bridges.length - 1;
  }
  bridge(town, fi[0]); bridge(town, fi[1]); bridge(fi[0], fi[2]); bridge(fi[1], fi[2]); bridge(fi[2], fi[3]); bridge(fi[2], fi[4]);
  const bq = bridge(fi[3], hill, true);
  // 길(흙): 마을 광장, 다리 입구 쪽 흙길
  const tI = islands[town];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = id(x, y); if (g[i] !== 1) continue;
    const dT = Math.hypot(x - tI.cx, y - tI.cy); if (isl[i] === town && dT < 3.2) g[i] = 5;
    else if (nz2(x * .22, y * .22) > .7 && isl[i] !== town) { let ok = 1; for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) if (!inb(xx, yy) || !g[id(xx, yy)]) ok = 0; if (ok) g[i] = 2; } }
  const bm = new Uint8Array(W * H); for (const b of bridges) { for (const i of b.cells) bm[i] = 1; for (const i of b.ends) bm[i] = 2; }
  const Wd = { W, H, g, isl, depth, islands, bridges, bq, town, fi, hill, id, inb, nz, seed, bm, shape };
  for (const s2 of islands) s2.poly = contour(Wd, s2);
  return Wd;
}
// 섬 둘레 점(월드 좌표): 각도마다 바깥으로 걸어가며 땅이 끝나는 곳
function contour(Wd, s) {
  const N = Math.round(clamp(s.r * 16, 36, 180)), out = [];
  for (let i = 0; i < N; i++) { const a = i / N * TAU, c = Math.cos(a), sn = Math.sin(a); let t = 0; while (t < s.r * 2 && Math.hypot(c * t, sn * t) < Wd.shape(s, s.cx + c * t, s.cy + sn * t)) t += .03; out.push([s.cx + c * t, s.cy + sn * t]); }
  return out;
}
function onLand(Wd, x, y) { // 정확한(둥근) 땅 판정
  const X = Math.floor(x), Y = Math.floor(y); let k = Wd.isl[Wd.id(X, Y)];
  if (k < 0) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!Wd.inb(X + ox, Y + oy)) continue; const k2 = Wd.isl[Wd.id(X + ox, Y + oy)]; if (k2 >= 0) { k = k2; break; } }
  if (k < 0) return false; const s = Wd.islands[k]; return Math.hypot(x - s.cx, y - s.cy) < Wd.shape(s, x, y);
}
const ground = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y)) return 0; const i = Wd.id(X, Y), t = Wd.g[i]; if (Wd.bm[i]) return t === 4 ? 0 : 3; return onLand(Wd, x, y) ? (t || 1) : 0; };
const walk = (Wd, x, y) => { const X = Math.floor(x), Y = Math.floor(y); if (!Wd.inb(X, Y) || Wd.block && Wd.block[Wd.id(X, Y)]) return false; return ground(Wd, x, y) > 0; };

// 소품 배치. 소품 = {k: 아틀라스 키, x, y, foot}
function placeProps(Wd, PM) {
  const R = srand(Wd.seed + 99), props = [], block = Wd.block = new Uint8Array(Wd.W * Wd.H);
  const free = (x, y, r) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) { if (!Wd.inb(xx, yy)) return false; const t = Wd.g[Wd.id(xx, yy)]; if (t !== 1 && t !== 2 || block[Wd.id(xx, yy)] === 2) return false; } return true; };
  const add = (k, x, y, solid) => { const m = PM[k]; if (!m) return; const foot = m[6] * (/^(home|tavern|market|smithy|windmill|ruin|grain)/.test(k) ? .62 : 1);
    // 섬 가장자리에 걸치지 않게 안쪽으로 당김
    { const X0 = Math.floor(x), Y0 = Math.floor(y), kk = Wd.isl[Wd.id(X0, Y0)], S = Wd.islands[kk >= 0 ? kk : 0], rr = foot + .9; for (let n = 0; n < 16; n++) { let ok = true; for (let j = 0; j < 8; j++) { const a = j / 8 * TAU; if (!onLand(Wd, x + Math.cos(a) * rr, y + Math.sin(a) * rr)) { ok = false; break; } } if (ok) break; const dx = S.cx - x, dy = S.cy - y, d = Math.hypot(dx, dy) || 1; x += dx / d * .3; y += dy / d * .3; } }
    props.push({ k, x, y, foot });
    if (solid !== false) for (let yy = Math.floor(y - foot); yy <= y + foot; yy++) for (let xx = Math.floor(x - foot); xx <= x + foot; xx++) if (Wd.inb(xx, yy) && Math.hypot(xx + .5 - x, yy + .5 - y) < foot + .35) block[Wd.id(xx, yy)] = 1;
    // 길 막지 않게 주변 1칸 예약
    for (let yy = Math.floor(y - foot - 1); yy <= y + foot + 1; yy++) for (let xx = Math.floor(x - foot - 1); xx <= x + foot + 1; xx++) if (Wd.inb(xx, yy) && !block[Wd.id(xx, yy)]) block[Wd.id(xx, yy)] = 2; };
  // 다리 입구 3칸은 비워 둔다
  for (const b of Wd.bridges) for (const c of b.cells) { const x = c % Wd.W, y = (c / Wd.W) | 0; for (let yy = y - 3; yy <= y + 3; yy++) for (let xx = x - 3; xx <= x + 3; xx++) if (Wd.inb(xx, yy) && Wd.g[Wd.id(xx, yy)] && !block[Wd.id(xx, yy)]) block[Wd.id(xx, yy)] = 2; }
  const T = Wd.islands[Wd.town];
  // 마을: 집·풍차·대장간·시장·우물 (광장 둘레)
  const ring = [['windmill', -6, -5], ['home1', -6.5, 2.5], ['home2', -2.5, 6.5], ['smithy', 5.5, -5.5], ['market', 6.2, 3], ['tavern', -1, -7.5]];
  for (const [k, dx, dy] of ring) add(k, T.cx + dx, T.cy + dy);
  add('well', T.cx + 0.2, T.cy - 0.2);
  for (const [k, dx, dy] of [['barrel', 4, -3], ['crateB', 4.6, -2.2], ['sack', 3.6, 4.6], ['barrow', -4, 4.4], ['lumber', -4.4, -2.6], ['flag', 2.6, 2.4], ['crateS', 5.4, 1.3], ['bucket', 1.6, -1.6]]) add(k, T.cx + dx, T.cy + dy);
  Wd.npcAt = { chief: [T.cx - 1.6, T.cy + 1.8], smith: [T.cx + 3.6, T.cy - 3.6], merchant: [T.cx + 3.8, T.cy + 2.2], sage: [T.cx - 3.4, T.cy - 1.2] };
  Wd.wps = [{ n: '민들레 마을', x: T.cx + 1.6, y: T.cy + .2, on: 1 }];
  const Hh = Wd.islands[Wd.hill]; Wd.wps.push({ n: '바람개비 언덕', x: Hh.cx - 1, y: Hh.cy + 1.5, on: 0 });
  add('windmill', Hh.cx + 1.5, Hh.cy - 2.5); add('ruin', Hh.cx - 4, Hh.cy - 2.5); add('rock3', Hh.cx + 4, Hh.cy + 2);
  // 들판·언덕: 나무 무리·바위·통나무 더미
  const TREES = ['treesL', 'treesM', 'treesBL', 'treesBM', 'treesS', 'treesBS', 'tree1', 'tree2'], ROCK = ['rock1', 'rock2', 'rock3', 'rock4', 'rock5'];
  for (const s of Wd.islands) {
    if (s.kind === 'rock') { if (s.r > 2.2) add(ROCK[Math.floor(R() * 5)], s.cx, s.cy, true); continue; }
    if (s.kind === 'town') { for (let i = 0; i < 6; i++) { const a = R() * TAU, d = s.r * (.72 + R() * .2), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, k = TREES[4 + Math.floor(R() * 4)], f = PM[k][6]; if (free(x, y, f)) add(k, x, y); } continue; }
    const n = s.kind === 'hill' ? 5 : 9;
    for (let i = 0; i < n * 3 && n > 0; i++) { const a = R() * TAU, d = s.r * (.35 + R() * .6), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d;
      const r = R(), k = r < .55 ? TREES[Math.floor(R() * TREES.length)] : r < .85 ? ROCK[Math.floor(R() * ROCK.length)] : ['lumber', 'stone', 'crateO', 'barrel'][Math.floor(R() * 4)]; const f = PM[k][6];
      if (free(x, y, f)) add(k, x, y); }
  }
  // 작은 장식(덤불·버섯·그루터기·민들레 솜털): 길을 막지 않는 것은 통과 가능
  const DECO = [['bush1', 1], ['bush2', 1], ['bush1', 1], ['mush', 0], ['stump', 1], ['log', 1], ['reeds', 0], ['puffs', 0], ['puffs', 0], ['reeds', 0]];
  for (const s of Wd.islands) { if (s.kind === 'rock') continue; const n = s.kind === 'town' ? 6 : s.kind === 'hill' ? 8 : 12;
    for (let i = 0; i < n * 3 && n; i++) { const a = R() * TAU, d = s.r * (.25 + R() * .68), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, [k, sol] = DECO[Math.floor(R() * DECO.length)];
      if (s.kind === 'town' && k === 'log') continue; const f = PM[k] ? PM[k][6] : .3; if (free(x, y, f + .2) && onLand(Wd, x, y)) add(k, x, y, !!sol); } }
  if (PM.sign) { const T2 = Wd.islands[Wd.town]; add('sign', T2.cx + 5.5, T2.cy + 5.2); }
  for (let i = 0; i < block.length; i++) if (block[i] === 2) block[i] = 0;
  return props;
}
// 다리 고치기: 끊어진 칸을 다리로
function repairBridge(Wd, bi) { const b = Wd.bridges[bi]; if (!b || !b.broken) return; b.broken = false; for (const c of b.cells) Wd.g[c] = 3; }

/* ---------- 바닥 그림(칸 단위로 미리 굽기) ---------- */
let TILES = null;
function bakeTiles(S) { // S = 화면 배율(1배 px → 캔버스 px)
  const mk = (w, h, f) => { const c = document.createElement('canvas'); c.width = Math.ceil(w * S); c.height = Math.ceil(h * S); const g = c.getContext('2d'); g.scale(S, S); f(g); return c; };
  const dia = g => { g.beginPath(); g.moveTo(TW / 2, -.6); g.lineTo(TW + .8, TH / 2); g.lineTo(TW / 2, TH + .6); g.lineTo(-.8, TH / 2); g.closePath(); };
  const R = srand(5), out = { grass: [], dirt: [], path: [], plaza: [], bridge: [], broken: [], tuft: [], flower: [] };
  const GR = ['#80b95b', '#83bc5d', '#86bf5f', '#89c261', '#8cc563', '#8fc865'];
  for (const base of GR) for (let v = 0; v < 2; v++) out.grass.push(mk(TW, TH, g => { dia(g); g.fillStyle = base; g.fill(); g.save(); dia(g); g.clip();
    for (let i = 0; i < 26; i++) { g.fillStyle = R() < .5 ? 'rgba(255,255,220,.07)' : 'rgba(30,70,20,.07)'; g.beginPath(); g.ellipse(R() * TW, R() * TH, 2 + R() * 5, 1 + R() * 2.5, 0, 0, TAU); g.fill(); } g.restore(); }));
  // 흙길: 가장자리가 부드러운 얼룩(이웃 칸으로 번짐) → 네모난 칸 느낌 없앰
  for (let v = 0; v < 3; v++) out.dirt.push(mk(TW * 1.6, TH * 1.6, g => { const cx = TW * .8, cy = TH * .8; g.save(); g.translate(cx, cy); g.scale(1, .5); const gr = g.createRadialGradient(0, 0, 4, 0, 0, TW * .78); const c = ['201,168,115', '194,160,107', '207,174,121'][v]; gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(.62, `rgba(${c},.95)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, TW * .78, 0, TAU); g.fill(); g.restore();
    for (let i = 0; i < 10; i++) { g.fillStyle = R() < .5 ? 'rgba(255,240,200,.3)' : 'rgba(90,60,30,.2)'; g.beginPath(); g.ellipse(cx + (R() - .5) * TW * .9, cy + (R() - .5) * TH * .9, 1 + R() * 2.5, .8 + R() * 1.2, 0, 0, TAU); g.fill(); } }));
  for (let v = 0; v < 3; v++) out.path.push(mk(TW, TH, g => { dia(g); g.fillStyle = ['#c9a873', '#c2a06b', '#cfae79'][v]; g.fill(); g.save(); dia(g); g.clip();
    for (let i = 0; i < 18; i++) { g.fillStyle = R() < .5 ? 'rgba(255,240,200,.25)' : 'rgba(90,60,30,.18)'; g.beginPath(); g.ellipse(R() * TW, R() * TH, 1 + R() * 3, .8 + R() * 1.4, 0, 0, TAU); g.fill(); } g.restore(); }));
  for (let v = 0; v < 3; v++) out.plaza.push(mk(TW, TH, g => { dia(g); g.fillStyle = '#b9b4a8'; g.fill(); g.save(); dia(g); g.clip(); g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 1;
    for (let i = -2; i < 4; i++) { const [ax, ay] = iso(i / 2, 0), [bx, by] = iso(i / 2, 1); g.beginPath(); g.moveTo(ax + TW / 2, ay); g.lineTo(bx + TW / 2, by); g.stroke(); const [cx, cy] = iso(0, i / 2), [dx, dy] = iso(1, i / 2); g.beginPath(); g.moveTo(cx + TW / 2, cy); g.lineTo(dx + TW / 2, dy); g.stroke(); }
    for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(${R() < .5 ? '255,255,240,.18' : '60,50,40,.12'})`; g.fillRect(R() * TW, R() * TH, 4, 2); } g.restore(); }));
  // 다리: 널빤지(두 방향)
  for (const dir of [0, 1]) for (const br of [0, 1]) (br ? out.broken : out.bridge).push(mk(TW, TH + 12, g => {
    const P = (u, v) => { const [x, y] = iso(dir ? v : u, dir ? u : v); return [x + TW / 2, y]; };
    for (let i = 0; i < 4; i++) { if (br && (i === 1 || i === 2)) continue; const u0 = i / 4 + .02, u1 = (i + 1) / 4 - .02;
      const q = [P(u0, 0), P(u1, 0), P(u1, 1), P(u0, 1)]; g.beginPath(); g.moveTo(...q[0]); for (const p of q.slice(1)) g.lineTo(...p); g.closePath(); g.fillStyle = ['#a87b4f', '#9c7046', '#b08455', '#a0744a'][i]; g.fill(); g.strokeStyle = '#5a3a20'; g.lineWidth = .8; g.stroke();
      g.beginPath(); g.moveTo(q[2][0], q[2][1]); g.lineTo(q[2][0], q[2][1] + 4); g.lineTo(q[3][0], q[3][1] + 4); g.lineTo(q[3][0], q[3][1]); g.fillStyle = '#6a4628'; g.fill(); }
    g.strokeStyle = '#7a5532'; g.lineWidth = 1.6; for (const v of [.06, .94]) { const a = P(0, v), b = P(1, v); g.beginPath(); g.moveTo(a[0], a[1] + 2); g.lineTo(b[0], b[1] + 2); g.stroke(); }
  }));
  // 풀 포기·민들레
  for (let v = 0; v < 4; v++) out.tuft.push(mk(16, 12, g => { g.strokeStyle = ['#5a9a3a', '#6aaa44', '#4f8a34', '#76b84c'][v]; g.lineWidth = 1.3; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { const x = 3 + R() * 10; g.beginPath(); g.moveTo(x, 12); g.quadraticCurveTo(x + R() * 4 - 2, 6, x + R() * 6 - 3, 1 + R() * 4); g.stroke(); } }));
  for (let v = 0; v < 3; v++) out.flower.push(mk(14, 14, g => { g.strokeStyle = '#5a9a3a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(7, 14); g.lineTo(7, 6); g.stroke();
    if (v === 2) { g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; g.beginPath(); g.arc(7 + Math.cos(a) * 3.2, 5 + Math.sin(a) * 3.2, .9, 0, TAU); g.fill(); } }
    else { g.fillStyle = v ? '#ffd23a' : '#f6c02a'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.ellipse(7 + Math.cos(a) * 2.4, 5 + Math.sin(a) * 2.4, 1.6, 1, a, 0, TAU); g.fill(); } g.fillStyle = '#e09a1a'; g.beginPath(); g.arc(7, 5, 1.4, 0, TAU); g.fill(); } }));
  out.S = S; return out;
}
