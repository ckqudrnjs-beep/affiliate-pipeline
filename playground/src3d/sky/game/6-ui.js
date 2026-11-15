
/* =================== 화면(DOM)·입력·소리 =================== */
let panel, raf = 0, last = 0, acc = 0, PANEL = null, SEL = null, SHOP = null;
const TOUCH = { on: false, pad: null, held: {} }, KEYS = {};
function css() {
  const st = document.createElement('style');
  st.textContent = '.sk-ov{position:fixed;inset:0;z-index:9999;background:#9cc8e8;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;color:#3a2e22}.sk-ov canvas{box-shadow:none!important}.sk-ov>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}'
    + '.sk-pn{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;background:rgba(40,52,64,.45);padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) 8px max(8px,env(safe-area-inset-left))}'
    + '.sk-bx{background:linear-gradient(#fbf6ea,#efe5d0);border:2px solid #b89a6a;border-radius:16px;box-shadow:0 10px 40px rgba(30,20,10,.35),inset 0 0 0 3px #fffaf0;max-width:min(860px,100%);max-height:100%;width:100%;overflow:auto;padding:12px 14px;position:relative}'
    + '.sk-bx h3{margin:0 0 8px;font-size:17px;color:#5a3e22}.sk-bx h4{margin:10px 0 6px;font-size:13px;color:#7a5a32}.sk-x{position:sticky;top:0;float:right;border:0;background:#c8a06a;color:#fff;border-radius:10px;width:32px;height:32px;font-size:16px;cursor:pointer;z-index:2}'
    + '.sk-b{border:1.5px solid #b89a6a;background:#fffaf0;color:#5a3e22;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;margin:3px}.sk-b.p{background:#4f9fc8;border-color:#3a7fa8;color:#fff}.sk-b.g{background:#7ab85a;border-color:#5a9a3a;color:#fff}.sk-b:disabled{opacity:.45;cursor:default}'
    + '.sk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}.sk-c{aspect-ratio:1;border-radius:9px;background:#e6dac0;border:1.5px solid #c8b088;position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center}.sk-c canvas{width:84%;height:84%}.sk-c.on{outline:3px solid #4f9fc8}.sk-c i{position:absolute;right:2px;bottom:0;font-style:normal;font-size:10px;font-weight:800;color:#5a3e22;text-shadow:0 0 2px #fff}.sk-c b{position:absolute;left:3px;top:1px;font-size:10px;color:#a88a5a}.sk-c.r1{border-color:#5ab88a;background:#dff0e0}.sk-c.r2{border-color:#9a7ad8;background:#ebe2f6}.sk-c.r3{border-color:#e8805a;background:#f8e2d6}.sk-c.r4{border-color:#e88ab8;background:#f8e0ec}.sk-c.cu{box-shadow:inset 0 0 0 2px #a83a3a}'
    + '.sk-eq{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:5px}@media (max-width:520px){.sk-eq{grid-template-columns:repeat(5,minmax(0,1fr))}}'
    + '.sk-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media (max-width:640px){.sk-two{grid-template-columns:1fr}}'
    + '.sk-card{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:8px 10px;font-size:12.5px;line-height:1.55}.sk-card .n{font-size:15px;font-weight:800}.sk-card .m{color:#8a7458;font-size:11.5px}.sk-card .a{color:#3a7fa8}.sk-card .h{color:#9a7ad8}.sk-card .bad{color:#c84a3a}.sk-card .st{color:#7a5a32;font-style:italic;font-size:11.5px}'
    + '.sk-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed #d8c8a8;font-size:13px}.sk-row .f{flex:1}.sk-row small{color:#8a7458}'
    + '.sk-talk{max-width:640px}.sk-talk p{font-size:14.5px;line-height:1.7;margin:6px 0}.sk-talk .who{font-weight:800;color:#7a5a32}'
    + '.sk-title{max-width:760px;text-align:center}.sk-title .t{font-size:34px;font-weight:900;letter-spacing:.06em;color:#3a5a7a;margin:6px 0 0;text-shadow:0 2px 0 #fff}.sk-title .s{color:#7a8aa0;font-size:12px;letter-spacing:.3em;margin-bottom:10px}'
    + '.sk-cls{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:10px 0 6px}.sk-cdesc{font-size:12.5px;color:#5a4a36;background:#fffaf0;border:1px dashed #c8b088;border-radius:10px;padding:6px 10px;margin:0 0 8px;line-height:1.6}.sk-cl{border:2px solid #c8b088;border-radius:14px;background:#fffaf0;padding:6px 2px;cursor:pointer;text-align:center}.sk-cl.on{border-color:#4f9fc8;box-shadow:0 0 0 3px #4f9fc844}.sk-cl canvas{width:84px;height:90px}.sk-cl b{display:block;font-size:14px;white-space:nowrap}.sk-cl small{display:block;font-size:11.5px;color:#7a6a58;line-height:1.5}'
    + '.sk-sk{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media (max-width:640px){.sk-sk{grid-template-columns:1fr}}.sk-br{background:#fffaf0;border:1.5px solid #c8b088;border-radius:12px;padding:6px}.sk-br h4{margin:2px 0 6px;text-align:center}.sk-s{display:flex;gap:8px;align-items:flex-start;padding:5px;border-radius:9px;cursor:pointer}.sk-s.on{background:#e2f0f8}.sk-s canvas{width:42px;height:42px;flex:none}.sk-s .f{flex:1;font-size:12px;line-height:1.45}.sk-s b{font-size:13px}.sk-s .lk{opacity:.45}'
    + '.sk-doll{display:grid;grid-template-columns:54px minmax(120px,1fr) 54px;gap:6px;align-items:start;background:radial-gradient(circle at 50% 42%,#fffaf0,#e6d8bc);border:1.5px solid #c8b088;border-radius:14px;padding:8px}.sk-doll .cl{display:flex;flex-direction:column;gap:5px}.sk-doll .bd{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%}.sk-doll .bd canvas{width:150px;height:160px;filter:drop-shadow(0 6px 4px rgba(60,40,20,.25))}.sk-doll .bd b{font-size:14px;color:#5a3e22}.sk-doll .bt{grid-column:1/4;display:grid;grid-template-columns:repeat(3,54px);justify-content:center;gap:6px}.sk-doll .sk-c b{font-size:9px}@media (max-height:520px){.sk-doll{grid-template-columns:44px minmax(100px,1fr) 44px;padding:6px}.sk-doll .cl{gap:3px}.sk-doll .bt{grid-template-columns:repeat(3,44px);gap:4px}.sk-doll .bd canvas{width:110px;height:118px}}'
    + '.sk-map canvas{width:100%;border-radius:12px;display:block;background:#bfe0f4}.sk-lg{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:#7a6a58;margin-top:6px}.sk-lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}'
    + '.sk-rot{position:absolute;inset:0;z-index:5;display:none;align-items:center;justify-content:center;text-align:center;color:#fff;font-size:20px;font-weight:800;background:#3a5a7af2;padding:20px}@media (orientation:portrait) and (pointer:coarse){.sk-ov.play .sk-rot{display:flex}}';
  st.textContent += '.sk-hexw{display:flex;justify-content:center}.sk-hex{position:relative;width:300px;height:300px;margin:4px auto;flex:none}.sk-hx{position:absolute;width:62px;height:54px;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%);background:#d8c8a8;cursor:pointer;display:flex;align-items:center;justify-content:center}.sk-hx::before{content:"";position:absolute;inset:3px;clip-path:inherit;background:#efe4cc}.sk-hx.ctr::before{background:radial-gradient(#fff6d8,#ead6a8)}.sk-hx.ctr{background:#d8a84a}.sk-hx.on{background:#3a7fa8}.sk-hx.lk{background:#fff3c0}'
    + '.sk-gem{position:relative;width:30px;height:30px;transform:rotate(45deg);border-radius:6px;box-shadow:inset -4px -4px 0 rgba(0,0,0,.18),inset 3px 3px 0 rgba(255,255,255,.45),0 0 10px var(--g)}.sk-gem i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-45deg);font-style:normal;font-size:11px;font-weight:900;color:#fff;text-shadow:0 1px 2px #0008}'
    + '.sk-tray{display:flex;flex-wrap:wrap;gap:6px;min-height:44px;padding:6px;border:1.5px dashed #c8b088;border-radius:12px;background:#f6eedc}.sk-tr{width:40px;height:40px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px solid transparent}.sk-tr.on{border-color:#3a7fa8;background:#dff0fb}'
    + '.sk-c u{position:absolute;left:4px;right:4px;bottom:3px;height:3px;border-radius:2px;background:#d8c8e8;overflow:hidden;text-decoration:none}.sk-c u b{display:block;height:100%;background:#9a6ae8}.sk-c em{position:absolute;right:2px;top:0;font-style:normal;font-size:11px;color:#9a6ae8;text-shadow:0 0 3px #fff}'
    + '.sk-tame{height:7px;border-radius:4px;background:#e6dcf4;overflow:hidden;margin:3px 0}.sk-tame b{display:block;height:100%;background:linear-gradient(90deg,#b49aff,#7a4ae8)}';
  document.head.appendChild(st);
}
function mkDom() {
  css(); ov = document.createElement('div'); ov.className = 'sk-ov'; ov.hidden = true;
  cv = document.createElement('canvas'); x = cv.getContext('2d', { alpha: false }); ov.appendChild(cv);
  panel = document.createElement('div'); panel.className = 'sk-pn'; panel.hidden = true; ov.appendChild(panel);
  const rot = document.createElement('div'); rot.className = 'sk-rot'; rot.innerHTML = '📱↻<br>휴대폰을 가로로 돌려 주세요'; ov.appendChild(rot);
  document.body.appendChild(ov);
  addEventListener('resize', () => { if (!ov.hidden) layout(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && !PANEL) openPanel('menu'); if (document.hidden) { save(); cloudFlush(); } });
  input();
}
function layout() {
  const cw = ov.clientWidth || innerWidth, ch = ov.clientHeight || innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2); if (cw * ch * dpr * dpr > 3.2e6) dpr = Math.sqrt(3.2e6 / (cw * ch));
  const Z = clamp(Math.min(ch / 440, cw / 900), .88, 1.4);
  lay = { cw, ch, dpr, Z }; cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  TOUCH.on = matchMedia('(pointer:coarse)').matches || DEBUG && /touch/.test(location.hash);
  if (!TILES || TILES.S !== Z * dpr) TILES = bakeTiles(Z * dpr);
}
const KM = { ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd' };
function inputVec() {
  let sx = 0, sy = 0; if (KEYS.l) sx--; if (KEYS.r) sx++; if (KEYS.u) sy--; if (KEYS.d) sy++;
  if (TOUCH.pad && (TOUCH.pad.dx || TOUCH.pad.dy)) { sx = TOUCH.pad.dx; sy = TOUCH.pad.dy; if (hyp(sx, sy) < .25) return [0, 0]; }
  if (!sx && !sy) return [0, 0]; // 마우스 이동은 P.path 로(누르고 있으면 계속 갱신)
  return scr2w(sx, sy);
}
const inputHeld = k => !!TOUCH.held[k] || (k === 'atk' && MOUSE.atk);
const MOUSE = { x: 0, y: 0, down: 0, atk: 0 };
function mouseWorld() { const V = view(); return unIso((MOUSE.x - V.ox) / V.Z, (MOUSE.y - V.oy) / V.Z); }
function hitBtn(px, py) { for (const b of BTN) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return b; return null; }
const PKEY = { KeyI: 'inv', KeyC: 'char', KeyS: 'skill', KeyM: 'map', KeyJ: 'quest', KeyB: 'board' };
function press(k, down) {
  if (!G) return; const P = G.P;
  if (k === 'atk') { TOUCH.held.atk = down; if (down) { P.tgt = null; basicAttack(); } return; }
  if (!down) return;
  if (k[0] === 's' && k.length === 2) { P.aimLock = false; P.aim = null; castSkill(+k[1]); }
  else if (k === 'pot' || k === 'wpot') drink(k); else if (k === 'dodge') doDodge(); else if (k === 'use') interact();
  else if (['inv', 'char', 'skill', 'map', 'menu'].includes(k)) openPanel(k);
}
// 화면을 누른 곳: 사람·표지·끊긴 다리·떨어진 물건이면 그쪽으로 가서 쓰기, 아니면 그냥 이동
function clickWorld(px, py) {
  const P = G.P, Wd = G.Wd, V = view(), [wx, wy] = unIso((px - V.ox) / V.Z, (py - V.oy) / V.Z), Z = V.Z;
  const onScr = (ex, ey, h) => { const [sx, sy] = iso(ex, ey), X = V.ox + sx * Z, Y = V.oy + sy * Z; return Math.abs(px - X) < 20 * Z && py > Y - h * Z && py < Y + 8 * Z; };
  P.tgt = null; P.goal = null;
  for (const k in Wd.npcAt) { const [nx, ny] = Wd.npcAt[k]; if (onScr(nx, ny, 56)) { P.goal = { k: 'npc', id: k, x: nx, y: ny, r: 1.4 }; P.path = [nx + .6, ny + .6]; return; } }
  for (const w of Wd.wps) if (onScr(w.x, w.y, 60)) { if (w.on) P.goal = { k: 'wp', x: w.x, y: w.y, r: 1.3 }; P.path = [w.x + .5, w.y + .5]; return; }
  const d = G.drops.find(d => onScr(d.x, d.y, 30)); if (d) { P.path = [d.x, d.y]; return; }
  const b = Wd.bridges[Wd.bq]; if (b.broken) for (const c of b.cells) { const cx = c % Wd.W + .5, cy = ((c / Wd.W) | 0) + .5; if (hyp(wx - cx, wy - cy) < 1.2) { P.goal = { k: 'bridge', x: cx, y: cy, r: 2.1 }; let best = null, bd = 1e9; for (const e of b.ends) { const ex = e % Wd.W + .5, ey = ((e / Wd.W) | 0) + .5, dd = hyp(ex - P.x, ey - P.y); if (dd < bd) { bd = dd; best = [ex, ey]; } } P.path = best || [cx, cy]; return; } }
  P.path = [wx, wy];
}
function input() {
  addEventListener('keydown', e => {
    if (ov.hidden) return; if (KM[e.code]) { KEYS[KM[e.code]] = 1; e.preventDefault(); }
    if (e.repeat) return; const c = e.code;
    if (c === 'Escape') { if (PANEL) { if (PANEL !== 'title') closePanel(); } else openPanel('menu'); return; }
    if (PANEL) { if (PANEL === 'title') return; if (PKEY[c]) { if (PANEL === PKEY[c]) closePanel(); else { SEL = null; SHOP = null; openPanel(PKEY[c]); } } return; }
    if (!G) return;
    if (/^Digit[1-4]$/.test(c)) { G.P.aimLock = !!MOUSE.in; if (MOUSE.in) { const [wx, wy] = mouseWorld(), dx = wx - G.P.x, dy = wy - G.P.y, d = hyp(dx, dy) || 1; G.P.aim = [dx / d, dy / d]; G.P.dir = w2dir(dx, dy); } castSkill(+c[5] - 1); }
    else if (c === 'Space') { doDodge(); e.preventDefault(); } else if (c === 'KeyQ') drink('pot'); else if (c === 'KeyR') drink('wpot'); else if (c === 'KeyF' || c === 'KeyE') interact();
    else if (PKEY[c]) openPanel(PKEY[c]);
  });
  addEventListener('keyup', e => { if (KM[e.code]) KEYS[KM[e.code]] = 0; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (!G || PANEL) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; const b = hitBtn(px, py);
    if (e.pointerType === 'touch' || TOUCH.on && e.pointerType !== 'mouse') { TOUCH.on = true; if (b) { press(b.k, 1); TOUCH.ids = TOUCH.ids || {}; TOUCH.ids[e.pointerId] = b.k; return; }
      if (px < lay.cw * .45) { TOUCH.pad = { id: e.pointerId, x0: px, y0: py, dx: 0, dy: 0 }; } else clickWorld(px, py); return; }
    if (b) { press(b.k, 1); return; }
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1;
    if (e.button === 2) { MOUSE.atk = 1; return; }
    if (e.button === 0) { MOUSE.down = 1; clickWorld(px, py); }
  });
  addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (TOUCH.pad && e.pointerId === TOUCH.pad.id) { const dx = px - TOUCH.pad.x0, dy = py - TOUCH.pad.y0, d = hyp(dx, dy), m = Math.min(1, d / 44); TOUCH.pad.dx = d ? dx / d * m : 0; TOUCH.pad.dy = d ? dy / d * m : 0; return; }
    if (e.pointerType !== 'mouse') return;
    MOUSE.x = px; MOUSE.y = py; MOUSE.in = 1; MOUSE.down = e.buttons & 1 ? MOUSE.down : 0; MOUSE.atk = e.buttons & 2 ? 1 : 0;
    if (MOUSE.down && G && !PANEL) { const P = G.P; if (!P.goal) { const [wx, wy] = mouseWorld(); P.path = [wx, wy]; P.tgt = null; } } });
  setInterval(() => { if (MOUSE.down && G && !PANEL && !G.P.goal && !TOUCH.on) { const [wx, wy] = mouseWorld(); G.P.path = [wx, wy]; } }, 120); // 누른 채 가만히 있어도 계속 따라감
  const up = e => { if (TOUCH.pad && e.pointerId === TOUCH.pad.id) TOUCH.pad = null; if (TOUCH.ids && TOUCH.ids[e.pointerId]) { press(TOUCH.ids[e.pointerId], 0); delete TOUCH.ids[e.pointerId]; }
    if (e.pointerType === 'mouse') { MOUSE.down = e.buttons & 1 ? MOUSE.down : 0; MOUSE.atk = e.buttons & 2 ? 1 : 0; } };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);
  addEventListener('blur', () => { MOUSE.down = 0; MOUSE.atk = 0; for (const k in KEYS) KEYS[k] = 0; });
}
function mobAt(wx, wy) { let b = null, bd = .9; for (const m of G.mobs) { if (m.dead) continue; const d = hyp(m.x - wx + .3, m.y - wy + .3); if (d < bd + m.r) { bd = d; b = m; } } return b; }

/* ---------- 소리(코드로 합성) ---------- */
const A = { ctx: null, muted: false };
function audioInit() { try { A.muted = localStorage.getItem('sky_mute') === '1'; } catch (e) {} if (A.ctx) { A.ctx.resume(); return; } try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : .45; A.master.connect(A.ctx.destination); wind(); } catch (e) {} }
function tone(f, d, type, v, f2, delay) { const c = A.ctx; if (!c || A.muted) return; const t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v || .2, t + .01); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(A.master); o.start(t); o.stop(t + d + .02); }
function noise(d, v, fq, q, delay) { const c = A.ctx; if (!c || A.muted) return; const t = c.currentTime + (delay || 0), n = c.sampleRate * d, b = c.createBuffer(1, n, c.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq || 1200; f.Q.value = q || 1; const g = c.createGain(); g.gain.setValueAtTime(v || .2, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(f); f.connect(g); g.connect(A.master); s.start(t); }
function sfx(k) {
  if (!A.ctx || A.muted) return;
  switch (k) {
    case 'hit': noise(.08, .3, 900, 1.5); tone(180, .08, 'triangle', .15, 90); break; case 'crit': noise(.12, .4, 1400, 1); tone(320, .12, 'square', .1, 120); break;
    case 'hurt': tone(220, .15, 'sawtooth', .12, 110); break; case 'block': tone(900, .08, 'square', .08, 600); break;
    case 'coin': tone(1320, .08, 'triangle', .12); tone(1760, .12, 'triangle', .1, null, .06); break; case 'pick': tone(660, .08, 'triangle', .12, 990); break;
    case 'lvl': [523, 659, 784, 1046].forEach((f, i) => tone(f, .25, 'triangle', .15, null, i * .09)); break;
    case 'dodge': noise(.25, .25, 700, .7); break; case 'shoot': noise(.14, .18, 1600, 2); break;
    case 'line': case 'nova': noise(.16, .3, 1100, 1.2); break; case 'cone': noise(.3, .35, 600, .6); break; case 'buff': case 'shield': tone(392, .4, 'sine', .14, 523); break;
    case 'shout': tone(160, .35, 'sawtooth', .12, 120); break; case 'flag': tone(523, .3, 'triangle', .12, 659); break; case 'twister': case 'gust': noise(.6, .3, 500, .5); break;
    case 'bolt': case 'chain': noise(.12, .35, 3000, 2); tone(1200, .1, 'square', .06, 300); break; case 'mist': noise(.8, .15, 400, .4); break;
    case 'slam': tone(70, .4, 'sine', .4, 40); noise(.3, .3, 300, .7); break; case 'die': tone(330, .8, 'triangle', .15, 110); break; case 'fall': tone(700, .5, 'sine', .12, 120); break;
    case 'bell': tone(660, .9, 'sine', .12, 640); tone(1320, .6, 'sine', .05, 1300); tone(990, .7, 'triangle', .04); break;
    case 'no': tone(200, .1, 'square', .06); break; case 'drink': tone(520, .15, 'sine', .12, 780); break;
    case 'ench': tone(880, .3, 'triangle', .14, 1320); break; case 'fail': tone(300, .4, 'sawtooth', .1, 120); break;
  }
}
function wind() { // 잔잔한 바람 + 가끔 피리 소리
  const c = A.ctx, n = c.sampleRate * 4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * .995 + (Math.random() * 2 - 1) * .02; d[i] = l; }
  const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.value = .5; s.connect(f); f.connect(g); g.connect(A.master); s.start();
  const sc = [392, 440, 523, 587, 659, 784]; setInterval(() => { if (!G || PANEL || ov.hidden || Math.random() < .5) return; const f0 = pick(sc); tone(f0, 1.6, 'sine', .035); if (Math.random() < .5) tone(pick(sc) / 2, 2.2, 'triangle', .025, null, .4); }, 2600);
}

/* ---------- 창(패널) ---------- */
function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function closePanel() { PANEL = null; SEL = null; SHOP = null; panel.hidden = true; panel.innerHTML = ''; last = performance.now(); if (G) { calc(G.P); save(); } }
function openPanel(k, arg) { PANEL = k; panel.hidden = false; SEL = arg != null && k !== 'talk' ? SEL : SEL; render(arg); }
function iconCanvas(it, s) { const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1); c.width = c.height = s * d; const g = c.getContext('2d'); g.scale(d, d); drawIcon(it, 0, 0, s, g); return c; }
function tameBar(it) { if (!it || it.g || !it.hid || !it.id) return ''; return it.tame >= TAME_N ? '<em>✦</em>' : `<u><b style="width:${Math.round((it.tame || 0) / TAME_N * 100)}%"></b></u>`; }
function cell(it, k, extra) { const r = it && !it.g ? ' r' + it.r : ''; return `<div class="sk-c${r}${it && it.st === -1 && it.id ? ' cu' : ''}${SEL === k ? ' on' : ''}" data-c="${k}">${extra || ''}${it ? '<span data-ic="' + k + '"></span>' : ''}${tameBar(it)}${it && it.g && it.n > 1 ? '<i>' + it.n + '</i>' : it && it.en ? '<i>+' + it.en + '</i>' : ''}</div>`; }
function fillIcons(map) { panel.querySelectorAll('[data-ic]').forEach(el => { const it = map(el.dataset.ic); if (it) el.replaceWith(iconCanvas(it, 40)); }); }
function itemCard(it, P, cmp) {
  if (!it) return ''; const b = it.g ? null : BASE[it.b], L = [];
  L.push(`<div class="n" style="color:${it.g ? '#5a3e22' : shade(itemColor(it))}">${esc(itemName(it))}</div>`);
  if (it.g) { L.push(`<div class="m">${esc(GOODS[it.g].d)}</div>`); return '<div class="sk-card">' + L.join('') + '</div>'; }
  L.push(`<div class="m">${RAR[it.r].n} · ${SLOTN[b.s === 'ring' ? 'ring1' : b.s]}${b.cls ? ' · ' + CLASSES[b.cls].name + ' 전용' : ''} · ${b.lv}레벨</div>`);
  const m = itemMods({ ...it, af: [], hid: null }, {});
  if (m.dmg) L.push(`작은 적 피해 <b>${m.dmg[0]}~${m.dmg[1]}</b> · 큰 적 피해 <b>${m.dmg[2]}~${m.dmg[3]}</b>`);
  if (m.ac) L.push(`<div>방어력 <b>${m.ac}</b>${b.blk ? ' · 막기 ' + b.blk + '%' : ''}</div>`);
  if (b.sail) L.push(`<div>활공 ${b.sail[0]}칸 · 다시 쓰기 ${b.sail[1]}초</div>`);
  for (const k in b.fix || {}) L.push(`<div class="a">${afxText(k, b.fix[k], P.cls)}</div>`);
  if (!it.id) L.push('<div class="m">감정하면 옵션이 보여요 (이야기꾼 솔바람 · 살펴보기 쪽지)</div>');
  else { for (const [k, v] of it.af) L.push(`<div class="a">${afxText(k, v, P.cls)}</div>`); if (it.hid) L.push(it.tame >= TAME_N ? `<div class="h">✦ 길들임 완료: <b>${afxText(it.hid[0], it.hid[1], P.cls)}</b></div>` : `<div class="h">길들이기 ${it.tame || 0}/${TAME_N} · 숨은 옵션 <b>???</b></div><div class="sk-tame"><b style="width:${Math.round((it.tame || 0) / TAME_N * 100)}%"></b></div><div class="m" style="font-size:11px">입고 밑것을 ${TAME_N - (it.tame || 0)}마리 더 쓰러뜨리면 숨은 옵션이 열려요.</div>`); }
  if (it.set && it.id) { const S = SETS[it.set], n = setCount(P)[it.set] || 0; L.push(`<div class="h">「${S.n}」 ${n}/${S.parts.length}</div>`); for (const [c, fx] of S.bonus) L.push(`<div class="${n >= c ? 'a' : 'm'}">${c}벌: ${fx.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}</div>`); }
  if (it.u && it.id) L.push(`<div class="st">${esc(UNIQ.find(u => u.id === it.u).story)}</div>`);
  if (it.st === 1) L.push('<div class="a">축복: 기본 수치 +1, 강화 실패 1번 막아 줌</div>'); if (it.st === -1 && it.id) L.push('<div class="bad">저주: 기본 수치 -1, 맑은 샘물로 정화하기 전엔 벗을 수 없음</div>');
  const why = canWear(P, it); if (why) L.push(`<div class="bad">${esc(why)}</div>`);
  L.push(`<div class="m">팔 때 ${priceOf(it)}G</div>`);
  return '<div class="sk-card">' + L.join('') + '</div>' + (cmp ? '<div class="m" style="font-size:11px;margin:6px 0 2px">지금 낀 것</div>' + itemCard(cmp, P) : '');
}
function shade(c) { return c === '#ece6d6' ? '#5a4a36' : c === '#8ee8b0' ? '#2a8a5a' : c === '#c9a8ff' ? '#6a4ab8' : c === '#ff9f7c' ? '#c8502a' : c === '#ffb7dc' ? '#c84a8a' : c; }
function slotFor(P, it) { const s = BASE[it.b].s; if (s === 'ring') return !P.eq.ring1 ? 'ring1' : !P.eq.ring2 ? 'ring2' : 'ring1'; return s; }
function equip(i) { const P = G.P, it = P.inv[i], why = canWear(P, it); if (why) { toast(why); return; } const s = slotFor(P, it), old = P.eq[s]; if (old && old.st === -1 && old.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } P.inv.splice(i, 1); if (old) P.inv.push(old); P.eq[s] = it; if (it.st === -1) it.id = true; calc(P); }
function unequip(s) { const P = G.P, it = P.eq[s]; if (!it) return; if (it.st === -1 && it.id) { toast('저주받은 장비는 정화하기 전에 벗을 수 없어요'); return; } if (P.inv.length >= 40) { toast('가방이 가득 찼어요'); return; } P.inv.push(it); delete P.eq[s]; calc(P); }
let toastT = 0; function toast(s) { const t = panel.querySelector('.sk-toast'); if (t) { t.textContent = s; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = 0; }, 1800); } else if (G) say(s, '#fff', 1); }
const TOAST = '<div class="sk-toast" style="position:sticky;bottom:0;margin-top:8px;background:#5a3e22;color:#fff;border-radius:10px;padding:7px 10px;font-size:13px;opacity:0;transition:opacity .3s;text-align:center">.</div>';
function render(arg) {
  const P = G && G.P, k = PANEL; let h = '';
  const X = '<button class="sk-x" data-a="x" aria-label="닫기">✕</button>';
  if (k === 'inv') {
    const sel = SEL, si = sel && sel[0] === 'i' ? +sel.slice(1) : -1, ss = sel && sel[0] === 'e' ? sel.slice(1) : null, it = si >= 0 ? P.inv[si] : ss ? P.eq[ss] : null;
    h = `<div class="sk-bx">${X}<h3>가방 <small style="font-size:12px;color:#8a7458">${P.gold.toLocaleString()}G · ${P.inv.length}/40${SHOP ? ' · 상점: 물건을 눌러 팔기' : ''}</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${[...Array(40)].map((_, i) => cell(P.inv[i], 'i' + i)).join('')}</div></div><div>`;
    if (it) { const cmp = si >= 0 && !it.g ? P.eq[slotFor(P, it)] : null; h += itemCard(it, P, cmp) + '<div style="margin-top:6px">';
      if (si >= 0) { if (it.g === 'pot' || it.g === 'wpot') h += `<button class="sk-b g" data-a="use">마시기</button>`; if (!it.g) h += `<button class="sk-b p" data-a="eq">입기</button>`; if (it.g === 'look') h += '<p class="m" style="font-size:11.5px">감정 안 된 장비를 고른 뒤 「쪽지로 감정」</p>'; if (!it.g && !it.id && count('look')) h += `<button class="sk-b" data-a="lookit">쪽지로 감정</button>`; if (it.g === 'pure' || !it.g && it.st === -1 && count('pure')) h += ''; if (SHOP) h += `<button class="sk-b" data-a="sell">팔기 ${priceOf(it)}G</button>`; else h += `<button class="sk-b" data-a="drop">내려놓기</button>`; }
      else h += `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '');
      h += '</div>'; } else h += '<p class="m" style="font-size:12.5px;color:#8a7458">물건을 누르면 자세히 보여요. 같은 부위 장비와 비교해 줘요.</p>';
    if (SHOP) h += shopHtml(); h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'char') {
    const ss = SEL && SEL[0] === 'e' ? SEL.slice(1) : null, it = ss ? P.eq[ss] : null, sl = q => cell(P.eq[q], 'e' + q, '<b>' + SLOTN[q] + '</b>');
    h = `<div class="sk-bx" style="max-width:820px">${X}<h3>캐릭터 <small style="font-size:12px;color:#8a7458">${CLASSES[P.cls].name} ${P.lv}레벨 · 방어력 ${P.ac} · 생명력 ${P.mhp}</small></h3><div class="sk-two"><div>
      <div class="sk-doll"><div class="cl">${['helm', 'ear', 'amulet', 'armor', 'inner', 'gloves'].map(sl).join('')}</div><div class="bd"><span data-po="${P.cls}"></span><b>${CLASSES[P.cls].name}</b><small style="color:#8a7458;font-size:11px">이음꾼 · ${P.lv}레벨</small></div><div class="cl">${['cloak', 'belt', 'legs', 'boots', 'ring1', 'ring2'].map(sl).join('')}</div><div class="bt">${['weapon', 'off', 'sail'].map(sl).join('')}</div></div>
      <p class="m" style="font-size:11.5px;color:#8a7458;margin:6px 2px">칸을 누르면 자세히 보여요. 갈아입기는 가방(I)에서 해요.</p></div><div>`;
    if (it) h += itemCard(it, P) + `<button class="sk-b" data-a="uneq">벗기</button>` + (it.st === -1 && count('pure') ? `<button class="sk-b g" data-a="purify">샘물로 정화</button>` : '') + `<button class="sk-b" data-a="nosel">능력 보기</button>`;
    else { h += `<h4 style="margin-top:0">능력 <small style="color:#8a7458">남은 점수 ${P.pts}</small></h4>`;
      for (const [s2, n, d] of STATS) h += `<div class="sk-row"><div class="f"><b>${n}</b> ${P.st[s2]} <small>(${CLASSES[P.cls].stat[s2]} + 올림 ${P.sp[s2] || 0})</small><br><small>${d}</small></div><button class="sk-b" data-a="st" data-s="${s2}" ${P.pts ? '' : 'disabled'}>+1</button></div>`;
      const big = P.dmg; h += `<h4>지금 수치</h4><div class="sk-card">생명력 ${P.mhp} · 바람 ${P.mwind} (초당 +${P.wreg.toFixed(1)})<br>피해: 작은 적 ${big[0]}~${big[1]} / 큰 적 ${big[2]}~${big[3]} · 피해 +${Math.round(P.dmgp)}%<br>방어력 ${P.ac} (맞을 확률 ${Math.round(clamp(.92 - P.ac * .008, .55, .95) * 100)}%)${P.blk ? ' · 막기 ' + Math.round(P.blk) + '%' : ''}<br>공격 속도 초당 ${P.aspd.toFixed(2)}번 · 치명타 ${P.crit.toFixed(1)}% · 이동 ${P.move.toFixed(1)}<br>돛: 활공 ${P.sail[0]}칸 / ${P.sail[1]}초${P.find ? ' · 좋은 물건 +' + P.find + '%' : ''}${P.xpm > 1 ? ' · 경험치 +' + Math.round((P.xpm - 1) * 100) + '%' : ''}<br>쓰러뜨린 밑것들 ${P.kills}마리 · 경험 ${P.xp}/${xpNeed(P.lv)}</div>${respecBtn('rs')}`; }
    h += '</div></div>' + TOAST + '</div>';
  } else if (k === 'map') {
    h = `<div class="sk-bx sk-map" style="max-width:900px">${X}<h3>지도 <small style="font-size:12px;color:#8a7458">1장 민들레 섬</small></h3><canvas data-map></canvas><div class="sk-lg"><span><i style="background:#fff;border:2px solid #3a5a7a"></i>나</span><span><i style="background:#ffd166"></i>마을 사람</span><span><i style="background:#9fe4ff"></i>바람개비 표지</span><span><i style="background:#ff6a4a"></i>할 일 목표</span><span><i style="background:#c8a070"></i>다리</span></div></div>`;
  } else if (k === 'skill') {
    const sel = SEL; h = `<div class="sk-bx">${X}<h3>스킬 <small style="font-size:12px;color:#8a7458">남은 점수 ${P.skp} · 같은 갈래 스킬끼리 점수당 피해 +6%(잇기)</small></h3><div style="margin:-2px 0 6px"><button class="sk-b p" data-a="board" ${P.lv >= BOARD_LV ? '' : 'disabled'}>◆ 나침반판 (B)${P.lv >= BOARD_LV ? '' : ' · ' + BOARD_LV + '레벨'}</button>${respecBtn('rk')}</div><div class="sk-sk">`;
    BRANCH[P.cls].forEach((bn, bi) => { h += `<div class="sk-br"><h4>${bn}</h4>`; for (const s of SKILLS[P.cls].filter(q => q.br === bi)) { const lv = P.sk[s.id] || 0, lk = P.lv < s.req; h += `<div class="sk-s${sel === s.id ? ' on' : ''}" data-sk="${s.id}"><span data-si="${s.id}"></span><div class="f ${lk ? 'lk' : ''}"><b>${s.name}</b> ${lv}/10${P.skb[bi] && lv ? ' (+' + P.skb[bi] + ')' : ''}${lk ? ' · ' + s.req + '레벨' : ''}<br>${esc(s.desc)}<br><small>바람 ${s.cost} · ${s.cd}초${lv >= 5 && P.fork[s.id] != null ? ' · 갈래: ' + s.fork[P.fork[s.id]][0] : ''}</small></div></div>`; } h += '</div>'; });
    h += '</div>'; { const U = ULT[P.cls], on = P.lv >= U.req; h += `<div class="sk-card" style="margin-top:8px;border-color:#e8b05a;background:#fff6e4"><b style="color:#b0702a">궁극 기술 · ${U.name}</b> ${on ? '<small style="color:#3a7fa8">익힘 · 4번 칸</small>' : '<small style="color:#a88a5a">' + U.req + '레벨에 저절로 익혀요</small>'}<br>${esc(U.desc)}<br><small>다시 쓰기 ${U.cd}초 · 바람 안 씀</small></div>`; }
    const s = sel && SKILLS[P.cls].find(q => q.id === sel);
    if (s) { const lv = P.sk[s.id] || 0; h += `<div class="sk-card" style="margin-top:8px"><b>${s.name}</b> ${lv}/10 — ${esc(s.desc)}<br>`;
      h += `<button class="sk-b g" data-a="learn" ${P.skp && lv < 10 && P.lv >= s.req ? '' : 'disabled'}>배우기 +1</button> `; if (lv) h += [0, 1, 2, 3].filter(i => P.slots[i] !== 'ult').map(i => `<button class="sk-b${P.slots[i] === s.id ? ' p' : ''}" data-a="slot" data-i="${i}">${TOUCH.on ? '칸 ' : ''}${i + 1}번에 놓기</button>`).join('');
      h += `<h4>갈래 고르기 (스킬 5레벨)</h4>` + s.fork.map((f, i) => `<button class="sk-b${P.fork[s.id] === i ? ' p' : ''}" data-a="fork" data-i="${i}" ${lv >= 5 && P.fork[s.id] == null ? '' : 'disabled'}><b>${f[0]}</b> — ${esc(f[1])}</button>`).join('<br>') + (P.fork[s.id] != null ? '<p class="m" style="font-size:11px">갈래는 정하면 바꿀 수 없어요(맛보기판).</p>' : '') + '</div>'; }
    else h += '<p style="font-size:12.5px;color:#8a7458">스킬을 누르면 배우기·칸 놓기·갈래 고르기를 할 수 있어요.</p>';
    h += TOAST + '</div>';
  } else if (k === 'board') h = boardHtml();
  else if (k === 'talk') h = talkHtml(arg);
  else if (k === 'smith') h = smithHtml();
  else if (k === 'travel') { h = `<div class="sk-bx" style="max-width:420px">${X}<h3>바람개비 표지</h3>${G.Wd.wps.map((w, i) => `<div class="sk-row"><div class="f"><b>${w.n}</b></div><button class="sk-b p" data-a="go" data-i="${i}" ${w.on ? '' : 'disabled'}>${w.on ? '날아가기' : '아직 잠김'}</button></div>`).join('')}</div>`; }
  else if (k === 'quest') { h = `<div class="sk-bx" style="max-width:560px">${X}<h3>할 일</h3>`; for (const id in QUESTS) { const q = P.q[id], Q = QUESTS[id]; if (!q) continue; h += `<div class="sk-row"><div class="f"><b>${Q.n}</b> ${q.s === 3 ? '✔' : q.s === 2 ? '(보고하기)' : ''}<br><small>${esc(Q.goal)} — ${NPCDEF[Q.from].n}</small></div></div>`; } h += '</div>'; }
  else if (k === 'menu') { h = `<div class="sk-bx" style="max-width:420px;text-align:center">${X}<h3>잠깐 쉬기</h3><button class="sk-b p" data-a="x">계속하기</button><br><button class="sk-b" data-a="quest">할 일 보기</button><br><button class="sk-b" data-a="mute">${A.muted ? '소리 켜기' : '소리 끄기'}</button><br><button class="sk-b" data-a="help">조작법</button><br><button class="sk-b" data-a="title">저장하고 처음 화면으로</button><br><button class="sk-b" data-a="quit">저장하고 나가기</button><p class="m" style="font-size:11.5px;color:#8a7458;margin-top:8px">기록은 10초마다, 그리고 창을 닫을 때 이 기기에 저장돼요.</p></div>`; }
  else if (k === 'help') { h = `<div class="sk-bx" style="max-width:600px">${X}<h3>조작법</h3><div class="sk-card"><b>PC</b><br>마우스 왼쪽: 이동 (누르고 있으면 따라가요 · 사람·표지·다리를 누르면 가서 말 걸기)<br>마우스 오른쪽: 공격 (누르고 있으면 계속 · 적을 누르면 다가가서 공격)<br>1~4: 기술 (마우스 쪽으로 · 4번은 궁극 기술) · Q 민들레 차 · R 바람 사탕 · 스페이스 돛 활공(피하기)<br>I 가방 · C 캐릭터 · S 기술 · M 지도 · B 나침반판 · J 할 일 · F 말 걸기 · Esc 쉬기<br><br><b>휴대폰</b> (가로 화면)<br>왼쪽 아무 곳이나 끌어서 이동 · 오른쪽 큰 버튼 공격(누르고 있으면 계속, 가까운 적을 알아서 노려요) · 둘레 버튼 기술 4개(금색 테두리가 궁극 기술) · 돛·차·사탕 버튼 · 사람이나 물건을 톡 누르면 그쪽으로 가요.<br><br><b>요령</b>: 방패지기는 적을 섬 끝으로 밀어 떨어뜨릴 수 있어요(보상은 조금 줄어요). 쉬고 돌아오면 순풍(경험치 2배)이 쌓여 있어요.</div></div>`; }
  else if (k === 'end') h = endHtml();
  panel.innerHTML = h; bindPanel(arg);
  if (k === 'inv') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : c[0] === 'i' ? P.inv[+c.slice(1)] : c[0] === 'b' ? SHOP[+c.slice(1)] : null);
  if (k === 'char') { fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : null); panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 150))); }
  if (k === 'map') drawMap(panel.querySelector('[data-map]'));
  if (k === 'board') CONF = null;
  if (k === 'smith') fillIcons(c => c[0] === 'e' ? P.eq[c.slice(1)] : P.inv[+c.slice(1)]);
  if (k === 'skill') panel.querySelectorAll('[data-si]').forEach(el => { const s = SKILLS[P.cls].find(q => q.id === el.dataset.si), c = document.createElement('canvas'), d = 2; c.width = c.height = 42 * d; const g = c.getContext('2d'); g.scale(d, d); drawSkillIcon(g, s, 0, 0, 42, P.cls); el.replaceWith(c); });
}
let CONF = null; // 한 번 더 눌러 확인
const respecCost = P => 30 * P.lv;
function respecBtn(kind) { const P = G.P, free = !P.flags[kind], cost = respecCost(P), what = kind === 'rs' ? '능력 점수' : '스킬 점수';
  return `<button class="sk-b${CONF === kind ? ' p' : ''}" data-a="respec" data-k="${kind}" ${free || P.gold >= cost ? '' : 'disabled'}>${CONF === kind ? '정말 다시 나눌까요? 한 번 더 누르세요' : what + ' 다시 나누기 (' + (free ? '1장 무료 1번' : cost + 'G') + ')'}</button>`; }
function doRespec(kind) { const P = G.P, free = !P.flags[kind], cost = respecCost(P); if (!free && P.gold < cost) { toast('골드가 모자라요'); return; } if (free) P.flags[kind] = 1; else P.gold -= cost;
  if (kind === 'rs') { let n = 0; for (const k in P.sp) n += P.sp[k]; P.sp = {}; P.pts += n; toast('능력 점수 ' + n + '점을 돌려받았어요'); }
  else { const st = CLS_START[P.cls][2]; let n = 0; for (const k in P.sk) n += P.sk[k]; n -= 1; P.sk = { [st]: 1 }; P.fork = {}; P.skp += Math.max(0, n); P.slots = P.slots.map(x2 => x2 === 'ult' ? 'ult' : null); autoSlots(P); toast('스킬 점수 ' + Math.max(0, n) + '점을 돌려받았어요. 갈래도 다시 고를 수 있어요'); }
  calc(P); sfx('ench'); }
function boardHtml() {
  const P = G.P, B = P.board, I = boardInfo(P), sum = boardSum(P), sel = SEL, w = 62, hh = 54;
  const gem = (sh, sz) => `<div class="sk-gem" style="--g:${SHARD[sh.c].c};background:${SHARD[sh.c].c};width:${sz}px;height:${sz}px${sh.q === 3 ? ';outline:2px solid #fff6c0' : ''}"><i>${'◆'.repeat(sh.q)}</i></div>`;
  let cells = ''; HEX.forEach(([q, r], i) => { const x2 = 150 - w / 2 + q * w * .75, y2 = 150 - hh / 2 + (r + q / 2) * hh, sh = B[i], lk = sh && HEXN[i].some(n => B[n] && B[n].c === sh.c);
    cells += `<div class="sk-hx${i === HEXC ? ' ctr' : ''}${sel === 'b' + i ? ' on' : ''}${lk ? ' lk' : ''}" data-a="hx" data-i="${i}" style="left:${x2}px;top:${y2}px">${sh ? gem(sh, 26) : i === HEXC ? '<small style="position:relative;font-size:10px;color:#a8803a;font-weight:800">바람눈</small>' : ''}</div>`; });
  const fxs = Object.entries(sum).filter(([, v]) => v).map(([k, v]) => afxText(k, Math.round(v * 10) / 10, P.cls)).join(' · ') || '아직 없어요';
  const sets = Object.keys(SHARD).map(c => `<div class="${I.sets[c] ? 'a' : 'm'}"><b style="color:${SHARD[c].c}">${SHARD[c].n} 3개 잇기</b>: ${SHARD[c].set.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}${I.sets[c] ? ' ✓' : ''}</div>`).join('') + `<div class="${I.trio ? 'a' : 'm'}"><b>세 바람</b>(세 색 모두 잇기): ${TRIO.map(([k, v]) => afxText(k, v, P.cls)).join(', ')}${I.trio ? ' ✓' : ''}</div>`;
  // 합치기: 같은 색·품질 3개 → 한 단계 위
  const groups = {}; P.shd.forEach(sh => { if (sh.q < 3) { const k = sh.c + sh.q; groups[k] = (groups[k] || 0) + 1; } });
  const merges = Object.entries(groups).filter(([, n]) => n >= 3).map(([k]) => `<button class="sk-b" data-a="merge" data-k="${k}">${SHARD[k.slice(0, -1)].n} ${SHQ[+k.slice(-1)]} 3개 → ${SHQ[+k.slice(-1) + 1]}</button>`).join('');
  const ts = sel && sel[0] === 't' ? P.shd[+sel.slice(1)] : sel && sel[0] === 'b' ? B[+sel.slice(1)] : null;
  return `<div class="sk-bx" style="max-width:820px"><button class="sk-x" data-a="x">✕</button><h3>나침반판 <small style="font-size:12px;color:#8a7458">바람 조각을 끼워 힘을 얻어요 · 둥지지기·우두머리가 조각을 줘요</small></h3><div class="sk-two"><div><div class="sk-hexw"><div class="sk-hex">${cells}</div></div>
    <h4>조각 주머니 <small style="color:#8a7458">${P.shd.length}/${SHD_MAX} · 누르고 판의 칸을 누르면 끼워요</small></h4><div class="sk-tray">${P.shd.map((sh, i) => `<div class="sk-tr${sel === 't' + i ? ' on' : ''}" data-a="tr" data-i="${i}">${gem(sh, 24)}</div>`).join('') || '<small style="color:#8a7458;padding:8px">비어 있어요</small>'}</div>${merges ? '<h4>합치기</h4>' + merges : ''}</div><div>
    ${ts ? `<div class="sk-card"><div class="n" style="color:${shade(SHARD[ts.c].c)}">${shardName(ts)}</div><div class="m">${SHARD[ts.c].d}</div>${SHARD[ts.c].fx.map(([k, v]) => '<div class="a">' + afxText(k, v * ts.q, P.cls) + ' (기본)</div>').join('')}<div class="m" style="font-size:11px">둘레에 같은 색이 있으면 1개마다 +25%, 가운데 바람눈은 1.5배</div>${sel[0] === 'b' ? '<button class="sk-b" data-a="unhx">주머니로 빼기</button>' : ''}</div>` : '<p class="m" style="font-size:12.5px;color:#8a7458">같은 색 조각을 붙여 놓을수록 세져요. 같은 색 3개를 이으면 보너스, 세 색을 다 이으면 「세 바람」이 켜져요. 언제든 무료로 바꿔 끼울 수 있어요.</p>'}
    <h4>지금 얻는 힘</h4><div class="sk-card">${fxs}</div><h4>잇기 보너스</h4><div class="sk-card">${sets}</div>
    <button class="sk-b" data-a="skillp">← 스킬로</button></div></div>${TOAST}</div>`;
}
function shopHtml() { return `<h4>얼레의 물건 <small style="color:#8a7458">(누르면 사기)</small></h4><div class="sk-grid">${SHOP.map((it, i) => cell(it, 'b' + i)).join('')}</div>` + (SEL && SEL[0] === 'b' ? itemCard(SHOP[+SEL.slice(1)], G.P, null) + `<button class="sk-b g" data-a="buy">사기 ${buyPrice(SHOP[+SEL.slice(1)])}G</button>` : '') + coinHtml(); }
function coinHtml() { const B = opts.bonus; if (!B) return ''; const day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10), used = G.P.flags.coinDay === day ? G.P.flags.coinN || 0 : 0; return `<h4>5락실 코인 바꾸기</h4><p class="m" style="font-size:11.5px;color:#8a7458">코인 1개 = 200G, 하루 5개까지 (보유 ${B.coins()}개, 오늘 ${used}/5)</p><button class="sk-b" data-a="coin" ${B.coins() > 0 && used < 5 ? '' : 'disabled'}>🪙 1개 → 200G</button>`; }
const buyPrice = it => it.g ? GOODS[it.g].price : priceOf(it) * 4;
function makeShop() { const P = G.P, L = [goods('pot'), goods('wpot'), goods('pure'), goods('look')]; const lv = Math.max(2, P.lv); for (let i = 0; i < 8; i++) { const it = rollDrop(lv, 30, P.cls); it.id = true; if (it.r > 1) it.r = 1; if (it.st === -1) it.st = 0; L.push(it); } return L; }
function talkHtml(id) {
  const P = G.P, N = NPCDEF[id]; let lines = [], btns = [];
  const q = qid => P.q[qid];
  const offer = qid => { const Q = QUESTS[qid]; lines = Q.talk; btns.push(`<button class="sk-b p" data-a="accept" data-q="${qid}">맡을게요</button>`); };
  const finish = qid => { lines = QUESTS[qid].done; btns.push(`<button class="sk-b g" data-a="finish" data-q="${qid}">보상 받기</button>`); };
  if (id === 'chief') { if (!q('q1')) offer('q1'); else if (q('q1').s === 2) finish('q1'); else if (q('q1').s === 3 && !q('q3')) offer('q3'); else if (q('q3') && q('q3').s === 2 && P.flags['wp_바람개비 언덕']) finish('q3'); else if (q('q3') && q('q3').s === 2) lines = ['우두머리를 쓰러뜨렸다고? 언덕의 바람개비 표지에 손을 얹어 주게. 그래야 바람이 섬에 돌아오네.']; else if (q('q3') && q('q3').s === 3) lines = ['바람개비가 다시 도네. 이음꾼, 고맙네. 둥지섬 쪽은 다음에 함께 이야기하세.']; else lines = ['널빤지는 들판 밑것들이 물고 다닌다네. 다리는 마을 동쪽 들판 너머, 맨 위쪽 섬 끝에 있지.']; }
  if (id === 'sage') { if (!q('q2')) offer('q2'); else if (q('q2').s === 2) finish('q2'); else lines = ['큰바람은 원래 세상을 한 바퀴 돌면서 섬마다 숨을 불어넣었대. 그게 멎었으니 뜸돌도 잠들어 가는 거야.', '감정 안 된 물건이 있으면 보여 줘. 하나에 15G면 봐 줄게.'];
    const n = P.inv.filter(it => !it.g && !it.id).length; btns.push(`<button class="sk-b" data-a="ident" ${n && P.gold >= 15 ? '' : 'disabled'}>감정하기 (${n}개 · 개당 15G)</button>`); }
  if (id === 'smith') { if (!q('q4')) offer('q4'); else if (q('q4').s === 1 && count('hone') >= 3) { lines = ['오, 숫돌 세 개 가져왔구나!']; btns.push(`<button class="sk-b g" data-a="finish" data-q="q4">숫돌 건네기</button>`); } else lines = ['강화든 옵션 다시 굴리기든 맡겨. 무기는 +6, 방어구는 +4까지 안전해.']; btns.push(`<button class="sk-b p" data-a="smith">대장간 열기</button>`); }
  if (id === 'merchant') { lines = ['어서 와. 다리가 끊겨서 나도 이 섬에 발이 묶였지 뭐야. 필요한 거 있어?']; btns.push(`<button class="sk-b p" data-a="shop">사고팔기</button>`); }
  return `<div class="sk-bx sk-talk"><button class="sk-x" data-a="x">✕</button><div class="who">${N.n}</div>${lines.map(l => '<p>' + esc(l) + '</p>').join('')}<div>${btns.join('')}<button class="sk-b" data-a="x">닫기</button></div>${TOAST}</div>`;
}
function smithHtml() {
  const P = G.P, sel = SEL, it = sel ? (sel[0] === 'e' ? P.eq[sel.slice(1)] : P.inv[+sel.slice(1)]) : null;
  let h = `<div class="sk-bx"><button class="sk-x" data-a="x">✕</button><h3>무쇠의 대장간 <small style="font-size:12px;color:#8a7458">숫돌 ${count('hone')} · 아교 ${count('glue')} · 축복 숫돌 ${count('bhone')} · 축복 아교 ${count('bglue')} · ${P.gold}G</small></h3><div class="sk-two"><div><h4>입은 장비</h4><div class="sk-eq">${SLOTS.map(([s, n]) => cell(P.eq[s], 'e' + s, '<b>' + n + '</b>')).join('')}</div><h4>가방</h4><div class="sk-grid">${P.inv.map((x2, i) => x2.g ? '' : cell(x2, 'i' + i)).join('')}</div></div><div>`;
  if (it && !it.g) { const kind = encKind(BASE[it.b]); h += itemCard(it, P);
    if (kind) { const next = it.en + 1, safe = next <= SAFE[kind], rate = safe ? 1 : (ENCH_RATE[kind][next] || 0); const mat = kind === 'weapon' ? ['hone', 'bhone'] : ['glue', 'bglue'];
      h += `<h4>강화 (+${it.en} → +${next}) · 성공 ${Math.round(rate * 100)}%${safe ? ' · 안전' : ' · 실패하면 한 단계 내려감'}</h4><button class="sk-b p" data-a="ench" data-m="${mat[0]}" ${count(mat[0]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[0]].n}로 강화</button><button class="sk-b g" data-a="ench" data-m="${mat[1]}" ${count(mat[1]) && it.en < MAXENCH ? '' : 'disabled'}>${GOODS[mat[1]].n}로 강화</button>`; }
    else h += '<p class="m" style="font-size:12px">장신구는 강화할 수 없어요.</p>';
    if ((it.r === 1 || it.r === 2) && it.id) { const cost = 40 + it.ilv * 15, mat = kind === 'weapon' ? 'hone' : 'glue'; h += `<h4>옵션 다시 굴리기</h4><p class="m" style="font-size:11.5px">무작위 옵션 하나를 새로 굴려요. ${cost}G${kind ? ' + ' + GOODS[mat].n + ' 1' : ''}</p><button class="sk-b" data-a="reroll" ${P.gold >= cost && (!kind || count(mat)) ? '' : 'disabled'}>다시 굴리기</button>`; }
  } else h += '<p style="font-size:12.5px;color:#8a7458">강화하거나 옵션을 다시 굴릴 장비를 고르세요.<br>무기 +6 · 방어구 +4까지는 100% 성공, 그 위는 실패하면 한 단계 내려가요. 축복 받은 장비는 실패를 한 번 막아 줘요.</p>';
  return h + '</div></div>' + TOAST + '</div>';
}
function endHtml() { const P = G.P; return `<div class="sk-bx sk-talk" style="text-align:center"><h3>1장 「민들레 섬」 앞부분 끝</h3><p>바람개비가 다시 돌기 시작했다. 아주 약하지만, 분명히 바람이다.</p><p>그런데 저 멀리 둥지섬 쪽 하늘에서 커다란 날개 그림자가 구름을 가르고 지나갔다…</p><p style="font-size:13px;color:#8a7458">맛보기판은 여기까지예요. ${CLASSES[P.cls].name} ${P.lv}레벨 · 쓰러뜨린 밑것들 ${P.kills}마리 · 플레이 ${Math.round(P.play / 60)}분<br>계속 사냥하며 장비를 모으고 강화할 수 있어요. 1장 뒷부분(둥지섬·큰 왜가리)은 곧 열려요.</p><button class="sk-b p" data-a="x">계속 둘러보기</button></div>`; }
function bindPanel(arg) {
  panel.onclick = e => {
    const t = e.target.closest('[data-a],[data-c],[data-sk]'); if (!t) { if (e.target === panel && PANEL !== 'title') closePanel(); return; }
    const P = G && G.P, a = t.dataset.a;
    if (t.dataset.c) { SEL = t.dataset.c; if (SEL[0] === 'b' && PANEL === 'inv') {} render(arg); return; }
    if (t.dataset.sk) { SEL = t.dataset.sk; render(); return; }
    if (a === 'x') { closePanel(); if (PANEL === null && G && G.endNext) { G.endNext = 0; openPanel('end'); } return; }
    if (a === 'eq') { equip(+SEL.slice(1)); SEL = null; render(); }
    else if (a === 'uneq') { unequip(SEL.slice(1)); SEL = null; render(); }
    else if (a === 'nosel') { SEL = null; render(); }
    else if (a === 'use') { const it = P.inv[+SEL.slice(1)]; drink(it.g); if (!P.inv.includes(it)) SEL = null; render(); }
    else if (a === 'drop') { const it = P.inv.splice(+SEL.slice(1), 1)[0]; G.drops.push({ x: P.x + .4, y: P.y + .4, it, t: -1 }); SEL = null; render(); }
    else if (a === 'sell') { const i = +SEL.slice(1), it = P.inv[i]; P.gold += priceOf(it); P.inv.splice(i, 1); SEL = null; sfx('coin'); render(); }
    else if (a === 'buy') { const it = SHOP[+SEL.slice(1)], pr = buyPrice(it); if (P.gold < pr) { toast('골드가 모자라요'); return; } const c = it.g ? goods(it.g) : it; if (!addInv(c)) { toast('가방이 가득 찼어요'); return; } P.gold -= pr; if (!it.g) { SHOP.splice(SHOP.indexOf(it), 1); SEL = null; } sfx('coin'); render(); }
    else if (a === 'coin') { const B = opts.bonus, day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10); if (P.flags.coinDay !== day) { P.flags.coinDay = day; P.flags.coinN = 0; } if (P.flags.coinN >= 5 || !B.spend(1)) return; P.flags.coinN++; P.gold += 200; sfx('coin'); render(); }
    else if (a === 'lookit') { const it = P.inv[+SEL.slice(1)]; if (useGood('look')) { it.id = true; sfx('ench'); SEL = 'i' + P.inv.indexOf(it); } render(); }
    else if (a === 'purify') { const it = P.eq[SEL.slice(1)]; if (useGood('pure')) { it.st = 0; calc(P); sfx('ench'); toast('정화했어요'); } render(); }
    else if (a === 'st') { if (P.pts > 0) { P.pts--; P.sp[t.dataset.s] = (P.sp[t.dataset.s] || 0) + 1; calc(P); } render(); }
    else if (a === 'learn') { const s = SKILLS[P.cls].find(q => q.id === SEL); if (P.skp > 0 && P.lv >= s.req && (P.sk[s.id] || 0) < 10) { P.skp--; P.sk[s.id] = (P.sk[s.id] || 0) + 1; autoSlots(P); if (P.sk[s.id] === 5) toast('5레벨! 갈래를 고를 수 있어요'); } render(); }
    else if (a === 'slot') { const i = +t.dataset.i, o = P.slots.indexOf(SEL); if (o >= 0) P.slots[o] = P.slots[i]; P.slots[i] = SEL; render(); }
    else if (a === 'fork') { const s = SKILLS[P.cls].find(q => q.id === SEL); if ((P.sk[s.id] || 0) >= 5 && P.fork[s.id] == null) { P.fork[s.id] = +t.dataset.i; toast('「' + s.fork[+t.dataset.i][0] + '」 갈래를 골랐어요'); } render(); }
    else if (a === 'go') { const w = G.Wd.wps[+t.dataset.i]; P.x = w.x + .8; P.y = w.y + .8; G.cam = [P.x, P.y]; closePanel(); sfx('dodge'); }
    else if (a === 'accept') { qSet(t.dataset.q, 1); toast('「' + QUESTS[t.dataset.q].n + '」을(를) 맡았어요'); closePanel(); }
    else if (a === 'finish') finishQuest(t.dataset.q);
    else if (a === 'ident') { let n = 0; for (const it of P.inv) if (!it.g && !it.id && P.gold >= 15) { P.gold -= 15; it.id = true; n++; } toast(n + '개 감정했어요'); sfx('ench'); render(arg); }
    else if (a === 'smith') { PANEL = 'smith'; SEL = null; render(); }
    else if (a === 'shop') { PANEL = 'inv'; SHOP = G.shop || (G.shop = makeShop()); SEL = null; render(); }
    else if (a === 'ench') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], m = t.dataset.m; if (!count(m)) return; const r = enchant(it, m); if (r.ok || r.msg.includes('실패')) useGood(m); if (!r.ok && !r.msg.includes('실패')) { toast(r.msg); return; } sfx(r.ok === 1 ? 'ench' : 'fail'); calc(P); render(); toast(r.msg); }
    else if (a === 'reroll') { const it = SEL[0] === 'e' ? P.eq[SEL.slice(1)] : P.inv[+SEL.slice(1)], kind = encKind(BASE[it.b]), cost = 40 + it.ilv * 15; if (P.gold < cost) return; if (kind && !useGood(kind === 'weapon' ? 'hone' : 'glue')) return; P.gold -= cost; const i = reroll(it); calc(P); sfx('ench'); render(); toast(i === false ? '바뀌지 않았어요' : '새 옵션: ' + afxText(it.af[i][0], it.af[i][1], P.cls)); }
    else if (a === 'respec') { const kd = t.dataset.k; if (CONF === kd) { CONF = null; doRespec(kd); } else CONF = kd; render(); }
    else if (a === 'board') { PANEL = 'board'; SEL = null; render(); }
    else if (a === 'skillp') { PANEL = 'skill'; SEL = null; render(); }
    else if (a === 'tr') { const k2 = 't' + t.dataset.i; if (SEL && SEL[0] === 'b') { const bi = +SEL.slice(1), ti = +t.dataset.i, o = P.board[bi]; P.board[bi] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); } else SEL = SEL === k2 ? null : k2; render(); }
    else if (a === 'hx') { const i = +t.dataset.i, B = P.board; if (SEL && SEL[0] === 't') { const ti = +SEL.slice(1), o = B[i]; B[i] = P.shd[ti]; P.shd.splice(ti, 1); if (o) P.shd.push(o); SEL = null; calc(P); sfx('pick'); }
      else if (SEL && SEL[0] === 'b' && SEL !== 'b' + i) { const j = +SEL.slice(1); [B[i], B[j]] = [B[j], B[i]]; SEL = null; calc(P); sfx('pick'); } else SEL = B[i] || SEL === 'b' + i ? (SEL === 'b' + i ? null : 'b' + i) : null; render(); }
    else if (a === 'unhx') { const i = +SEL.slice(1); if (P.board[i] && P.shd.length < SHD_MAX) { P.shd.push(P.board[i]); P.board[i] = null; calc(P); } SEL = null; render(); }
    else if (a === 'merge') { const c = t.dataset.k.slice(0, -1), q = +t.dataset.k.slice(-1); let n = 0; P.shd = P.shd.filter(sh => { if (n < 3 && sh.c === c && sh.q === q) { n++; return false; } return true; }); if (n === 3) { P.shd.push({ c, q: q + 1 }); sfx('ench'); toast(SHARD[c].n + ' ' + SHQ[q + 1] + '을 만들었어요'); } SEL = null; render(); }
    else if (a === 'quest') { PANEL = 'quest'; render(); } else if (a === 'help') { PANEL = 'help'; render(); }
    else if (a === 'mute') { A.muted = !A.muted; try { localStorage.setItem('sky_mute', A.muted ? '1' : '0'); } catch (er) {} if (A.master) A.master.gain.value = A.muted ? 0 : .45; render(); }
    else if (a === 'title') { save(); G = null; title(); }
    else if (a === 'quit') { save(); close(); }
    else if (a === 'pick') { TSEL = t.dataset.cls; title(); }
    else if (a === 'start') startFrom(t.dataset.n === '1');
  };
}
function drawMap(c) {
  if (!c) return; const Wd = G.Wd, P = G.P, w = Math.min(860, (panel.clientWidth || innerWidth) - 60), d = Math.min(2, window.devicePixelRatio || 1);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const s2 of Wd.islands) for (const [a, b] of s2.poly) { const [sx, sy] = iso(a, b); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const pad = 30, sc = Math.min((w - pad * 2) / (x1 - x0), ((innerHeight * .62) - pad * 2) / (y1 - y0 + 30)), h = (y1 - y0 + 30) * sc + pad * 2;
  c.width = w * d; c.height = h * d; c.style.height = h + 'px'; const g = c.getContext('2d'); g.scale(d, d);
  const M = (a, b) => { const [sx, sy] = iso(a, b); return [pad + (sx - x0) * sc, pad + (sy - y0) * sc]; };
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#9ccbea'); bg.addColorStop(1, '#e4f0f6'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const s2 of Wd.order || Wd.islands) { const pts = s2.poly.map(([a, b]) => M(a, b)); g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b + 7) : g.moveTo(a, b + 7)); g.closePath(); g.fillStyle = '#8a6a48'; g.fill();
    g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.closePath(); g.fillStyle = s2.kind === 'rock' ? '#9ab878' : s2.kind === 'town' ? '#a8d488' : '#94c870'; g.fill(); g.strokeStyle = '#5f8a3a'; g.lineWidth = 1.5; g.stroke(); }
  for (const b of Wd.bridges) { g.fillStyle = b.broken ? '#8a6a50' : '#c8a070'; for (const i of b.cells) { const [a, bb] = M(i % Wd.W + .5, ((i / Wd.W) | 0) + .5); g.fillRect(a - 2.5, bb - 1.5, 5, 3); } if (b.broken) { const i = b.cells[b.cells.length >> 1], [a, bb] = M(i % Wd.W + .5, ((i / Wd.W) | 0) + .5); g.font = '700 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#a83a2a'; g.fillText('끊어진 다리', a, bb - 8); } }
  const T = Wd.islands[Wd.town]; { const [a, b] = M(T.cx, T.cy); g.fillStyle = '#d8d0c0'; g.beginPath(); g.ellipse(a, b, 3.2 * sc * 32, 3.2 * sc * 16, 0, 0, TAU); g.fill(); }
  g.font = '800 12px system-ui'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.85)';
  const lab = (s2, t) => { const [a, b] = M(s2.cx, s2.cy - s2.r * .9); g.fillStyle = '#3a4a2a'; g.strokeText(t, a, b); g.fillText(t, a, b); };
  lab(T, '민들레 마을'); lab(Wd.islands[Wd.hill], '바람개비 언덕'); Wd.fi.forEach((k2, i) => lab(Wd.islands[k2], ['동쪽 들판', '남쪽 들판', '가운데 들판', '윗 들판', '아랫 들판'][i] || '들판'));
  for (const k2 in Wd.npcAt) { const [a, b] = M(...Wd.npcAt[k2]); g.fillStyle = '#ffd166'; g.strokeStyle = '#7a5a20'; g.lineWidth = 1.2; g.beginPath(); g.arc(a, b, 4, 0, TAU); g.fill(); g.stroke(); }
  for (const wp of Wd.wps) { const [a, b] = M(wp.x, wp.y); g.fillStyle = wp.on ? '#9fe4ff' : '#c8c0b0'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a, b - 7); g.lineTo(a + 5, b); g.lineTo(a, b + 7); g.lineTo(a - 5, b); g.closePath(); g.fill(); g.stroke(); }
  // 할 일 목표
  const goals = []; const q = P.q; const bq = Wd.bridges[Wd.bq];
  if (q.q1 && q.q1.s === 1) { const i = bq.cells[bq.cells.length >> 1]; goals.push([i % Wd.W + .5, ((i / Wd.W) | 0) + .5]); }
  if (q.q3 && q.q3.s === 1) { const H2 = Wd.islands[Wd.hill]; goals.push([H2.cx, H2.cy]); }
  if (q.q3 && q.q3.s === 2 && !P.flags['wp_바람개비 언덕']) goals.push([Wd.wps[1].x, Wd.wps[1].y]);
  for (const id in q) if (q[id].s === 2) goals.push(Wd.npcAt[QUESTS[id].from]);
  for (const [gx, gy] of goals) { const [a, b] = M(gx, gy); g.strokeStyle = '#ff6a4a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 9, 0, TAU); g.stroke(); g.fillStyle = '#ff6a4a'; g.font = '900 13px system-ui'; g.fillText('!', a, b - 12); }
  { const [a, b] = M(P.x, P.y); g.fillStyle = '#fff'; g.strokeStyle = '#3a5a7a'; g.lineWidth = 2.5; g.beginPath(); g.arc(a, b, 6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#3a5a7a'; g.font = '800 11px system-ui'; g.fillText('나', a, b - 10); }
}
function finishQuest(id) {
  const P = G.P, q = P.q[id]; if (!q) return;
  if (id === 'q4') { if (!useGood('hone', 3)) return; addInv(goods('bhone')); }
  q.s = 3; const R = { q1: [150, 80], q2: [120, 50], q3: [500, 200], q4: [80, 30] }[id]; gainXp(R[0]); P.gold += R[1];
  if (id === 'q1') addInv(makeItem(CLS_START[P.cls][3], 1, 4, { id: 1, st: 0 }));
  if (id === 'q2') addInv(makeItem('ring1', 1, 4, { id: 1, st: 0 }));
  if (id === 'q3') addInv(makeItem('sail1', 2, 9, { id: 1, st: 1 }));
  sfx('lvl'); save(); closePanel(); say('「' + QUESTS[id].n + '」 완료! 경험치 ' + R[0] + ', ' + R[1] + 'G', '#ffd166');
  if (id === 'q1') setTimeout(() => talk('chief'), 300);
  if (id === 'q3') setTimeout(() => openPanel('end'), 400);
}
function talk(id, auto) { if (!G) return; if (auto && PANEL) return; openPanel('talk', id); }

/* ---------- 처음 화면 ---------- */
let TSEL = 'warden', STARTING = 0;
const HEADK = ['warden', 'drifter', 'windcaller', 'trapper', 'ringer'];
function portrait(cls, w) { const c = document.createElement('canvas'), d = 2; c.width = w * d; c.height = w * 1.07 * d; const g = c.getContext('2d'); if (IM[cls]) g.drawImage(IM[cls], 0, 2 * HC[1], HC[0], HC[1], 0, 0, c.width, c.height); else if (IM.heads) g.drawImage(IM.heads, HEADK.indexOf(cls) * HC[0], 0, HC[0], HC[1], 0, 0, c.width, c.height); return c; }
let PULLED = 0;
function title() {
  PANEL = 'title'; panel.hidden = false; ov.classList.remove('play');
  const sv = Object.fromEntries(Object.keys(CLASSES).map(k => [k, loadSave(k)])), s = sv[TSEL];
  panel.innerHTML = `<div class="sk-bx sk-title"><button class="sk-x" data-a="quit" aria-label="나가기">✕</button><div class="t">끊어진 하늘</div><div class="s">맛보기판 · 1장 민들레 섬</div><p style="font-size:13px;line-height:1.7;color:#5a4a36;margin:4px 0">${STORY_INTRO.map(esc).join('<br>')}</p><div class="sk-cls">${Object.keys(CLASSES).map(k => `<div class="sk-cl${TSEL === k ? ' on' : ''}" data-a="pick" data-cls="${k}"><span data-po="${k}"></span><b>${CLASSES[k].name}</b><small style="color:#3a7fa8;margin-top:2px">${sv[k] ? sv[k].lv + '레벨' : '새 이음꾼'}</small></div>`).join('')}</div><div class="sk-cdesc"><b>${CLASSES[TSEL].name}</b> · ${esc(CLASSES[TSEL].desc)}</div>
    ${s ? `<button class="sk-b p" data-a="start" data-n="0">이어하기 (${s.lv}레벨)</button><button class="sk-b" data-a="start" data-n="1">처음부터 (기록 지움)</button>` : `<button class="sk-b p" data-a="start" data-n="1">이 직업으로 시작</button>`}
    <p style="font-size:11px;color:#8a7458;margin:8px 0 0">${pcode() ? '기록은 이 기기와 5락실 프로필(복구 코드)에 저장돼요. 다른 기기에서도 같은 복구 코드로 이어 할 수 있어요.' : '기록은 이 기기에 저장돼요. 5락실 프로필을 만들면 다른 기기에서도 이어 할 수 있어요.'}${PULLED ? ' · 다른 기기 기록을 불러왔어요' : ''}</p></div>`;
  panel.querySelectorAll('[data-po]').forEach(el => el.replaceWith(portrait(el.dataset.po, 84))); bindPanel();
}
function startFrom(fresh) {
  if (fresh && loadSave(TSEL) && !panel.querySelector('[data-sure]')) { const b = panel.querySelector('[data-n="1"]'); b.dataset.sure = 1; b.textContent = '정말 지울까요? 한 번 더 누르면 지워져요'; return; }
  const S = fresh ? newSave(TSEL) : loadSave(TSEL); if (STARTING) return; STARTING = 1;
  const go = () => { STARTING = 0; PANEL = null; panel.hidden = true; panel.innerHTML = ''; ov.classList.add('play'); MINI = null; startGame(S); save(); last = performance.now(); };
  if (IM[S.cls]) return go(); panel.querySelectorAll('[data-a="start"]').forEach(b => { b.disabled = true; b.textContent = '불러오는 중…'; }); return loadHero(S.cls).then(go);
}

/* ---------- 반복 ---------- */
function loop(t) {
  raf = requestAnimationFrame(loop); const dt = Math.min(.1, (t - last) / 1000); last = t;
  if (G && !PANEL) { acc += dt; let n = 0; while (acc >= STEP && n < 6) { update(STEP); acc -= STEP; n++; } if (n === 6) acc = 0; }
  draw();
}
function fs() { const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) return; const r = ov.requestFullscreen || ov.webkitRequestFullscreen; if (!r) return; try { const p = r.call(ov, { navigationUI: 'hide' }); if (p && p.then) p.then(() => layout()).catch(() => {}); } catch (e) {} }
function open() { ov.hidden = false; document.documentElement.style.overflow = 'hidden'; layout(); audioInit(); if (TOUCH.on) fs(); G = null; Promise.all([assets(), cloudPull().then(n => { PULLED = n || 0; })]).then(() => { layout(); title(); }); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); }
function close() { save(); cloudFlush(); cancelAnimationFrame(raf); ov.hidden = true; document.documentElement.style.overflow = ''; panel.hidden = true; PANEL = null; if (A.ctx) A.ctx.suspend(); const d = document; if (d.fullscreenElement || d.webkitFullscreenElement) { try { (d.exitFullscreen || d.webkitExitFullscreen).call(d); } catch (e) {} } const P = G && G.P; G = null; opts.onExit && opts.onExit(P ? { lv: P.lv, cls: P.cls } : null); }
window.SkyGame = {
  boot(o) { opts = o || {}; if (!ov) mkDom(); assets();
    if (DEBUG) window.__sky = { open, G: () => G, start(cls, fresh) { TSEL = cls || 'warden'; return startFrom(fresh !== false); }, loadHero, skills() { return SKILLS[G.P.cls].map(s => s.id); }, step(n) { for (let i = 0; i < n; i++) update(STEP); }, draw, god(b) { G.god = b; }, tp(x2, y2) { G.P.x = x2; G.P.y = y2; G.cam = [x2, y2]; }, panel: openPanel, close: closePanel, give(id, r) { addInv(makeItem(id, r || 0, 5)); }, goods(g, n) { addInv(goods(g, n)); }, lv(n) { gainXp(xpNeed(G.P.lv) * n); }, keys: KEYS, press, talk, layout, hit: hitMob, dbg: { drawParts, drawFx, drawMob, drawDrop, drawHero, hud, view } };
    return { open }; },
};
})();
