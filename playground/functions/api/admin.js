// 관리자 전용 (2026-11-13 BK: 아들 테스터 프로필에 코인·스킨·테스터 지정)
// 모든 요청 헤더 x-admin-key = Cloudflare Pages 비밀 변수 ADMIN_KEY. 없으면 기능 꺼짐.
// POST /api/admin {a:"find", q}                      → 별명 일부 또는 복구 코드로 프로필 찾기
// POST /api/admin {a:"set", h, coins?, own?, des?, skin?} → 코인 설정·스킨 열기·적용 (rev+1 → 그 기기가 다음 접속 때 받아 감)
// POST /api/admin {a:"tester", h, on}               → 테스터 지정/해제(순위에 "테스터" 표시)
// POST /api/admin {a:"hide", h, on}                 → 순위 제외 켜기/끄기(BK 요청 때만. 켜면 테스터로도 지정)
// POST /api/admin {a:"log"}                          → 최근 관리자 작업 30개
// 틀린 키는 IP당 하루 5번까지만. 모든 변경은 admin_log 에 남긴다.
import { clean, normCode } from "./profile.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const now = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19).replace("T", " ");
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function same(a, b) { // 길이·내용 비교 시간 차이 줄이기
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (h TEXT PRIMARY KEY, nick TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS testers (h TEXT PRIMARY KEY, nick TEXT NOT NULL, t TEXT NOT NULL, hide INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT NOT NULL, act TEXT NOT NULL, nick TEXT, detail TEXT)"),
  ]);
  ready = true;
}
const log = (env, act, nick, detail) => env.DB.prepare("INSERT INTO admin_log (t, act, nick, detail) VALUES (?, ?, ?, ?)").bind(now(), act, nick || "", JSON.stringify(detail || {}).slice(0, 500)).run();

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_KEY || String(env.ADMIN_KEY).length < 10) return json({ error: "off", msg: "관리자 비밀번호(ADMIN_KEY)가 아직 설정되지 않았어요." }, 503);
  if (!env.DB) return json({ error: "nodb" }, 500);
  await ensure(env.DB);
  const ip = request.headers.get("cf-connecting-ip") || "0", day = kst();
  const th = (await sha(`${ip}|adm|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const tr = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(th).first();
  if (tr && tr.n >= 5) return json({ error: "limit", msg: "비밀번호를 너무 많이 틀렸어요. 내일 다시 해 주세요." }, 429);
  if (!same(request.headers.get("x-admin-key") || "", String(env.ADMIN_KEY))) {
    await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(th, day).run();
    return json({ error: "key", msg: "관리자 비밀번호가 틀렸어요." }, 401);
  }
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  const a = b && b.a;
  const view = async (r) => { const t = await env.DB.prepare("SELECT hide FROM testers WHERE h = ?").bind(r.h).first(); return { h: r.h, nick: r.nick, data: JSON.parse(r.data), rev: r.rev, updated: r.updated, tester: !!t, hide: !!(t && t.hide) }; };

  if (a === "find") {
    const q = String(b.q || "").trim().slice(0, 20);
    if (!q) return json({ error: "bad" }, 400);
    const code = normCode(q);
    let rows;
    if (code) rows = (await env.DB.prepare("SELECT * FROM profiles WHERE h = ?").bind(await sha(`${code}|${env.VOTE_SALT || ""}`)).all()).results;
    else rows = (await env.DB.prepare("SELECT * FROM profiles WHERE nick LIKE ? ESCAPE '\\' ORDER BY updated DESC LIMIT 20").bind("%" + q.replace(/[\\%_]/g, (c) => "\\" + c) + "%").all()).results;
    return json({ list: await Promise.all((rows || []).map(view)) });
  }
  if (a === "log") {
    const { results } = await env.DB.prepare("SELECT t, act, nick, detail FROM admin_log ORDER BY id DESC LIMIT 30").all();
    return json({ list: results || [] });
  }
  const h = /^[0-9a-f]{64}$/.test(b.h || "") ? b.h : null;
  const row = h && (await env.DB.prepare("SELECT * FROM profiles WHERE h = ?").bind(h).first());
  if (!row) return json({ error: "noprofile", msg: "프로필을 찾을 수 없어요." }, 404);

  if (a === "tester") {
    if (b.on) await env.DB.prepare("INSERT INTO testers (h, nick, t) VALUES (?, ?, ?) ON CONFLICT(h) DO UPDATE SET nick = excluded.nick").bind(h, row.nick, now()).run();
    else await env.DB.prepare("DELETE FROM testers WHERE h = ?").bind(h).run();
    await log(env, b.on ? "tester_on" : "tester_off", row.nick);
    return json({ ok: true, item: await view(row) });
  }
  if (a === "hide") {
    await env.DB.prepare("INSERT INTO testers (h, nick, t, hide) VALUES (?, ?, ?, ?) ON CONFLICT(h) DO UPDATE SET nick = excluded.nick, hide = excluded.hide").bind(h, row.nick, now(), b.on ? 1 : 0).run();
    await log(env, b.on ? "rank_hide" : "rank_show", row.nick);
    return json({ ok: true, item: await view(row) });
  }
  if (a === "set") {
    const d = JSON.parse(row.data), ch = {};
    if (b.coins !== undefined) { d.coins = Math.floor(+b.coins || 0); ch.coins = b.coins; }
    if (Array.isArray(b.own)) { d.own = d.own || {}; for (const k of b.own.slice(0, 40)) d.own[String(k)] = 1; ch.own = b.own; }
    if (Array.isArray(b.unown)) { d.own = d.own || {}; for (const k of b.unown.slice(0, 40)) delete d.own[String(k)]; ch.unown = b.unown; }
    if (b.des && typeof b.des === "object") { d.des = Object.assign(d.des || {}, b.des); ch.des = b.des; }
    if (b.skin !== undefined) { d.skin = b.skin; ch.skin = b.skin; }
    const data = clean(d); if (!data) return json({ error: "bad" }, 400);
    const rev = row.rev + 1;
    await env.DB.prepare("UPDATE profiles SET data = ?, rev = ?, updated = ? WHERE h = ?").bind(JSON.stringify(data), rev, day, h).run();
    await log(env, "set", row.nick, ch);
    return json({ ok: true, item: await view({ ...row, data: JSON.stringify(data), rev, updated: day }) });
  }
  return json({ error: "bad" }, 400);
}
