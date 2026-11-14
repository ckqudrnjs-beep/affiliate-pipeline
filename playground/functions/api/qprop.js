// 밸런스 질문 제안 (2026-11-14 BK 코인 2단계). 화면에서 🪙10 을 쓰고 보낸다. 프로필 필요, 프로필 하루 1번·IP 하루 3번.
// POST /api/qprop {code, a, b} → 저장(st 0 대기). 관리자(admin.js qprops/qadopt/qreject)가 채택하면 칭호 「출제자」 + 🪙10 돌려줌.
import { normCode } from "./profile.js";
import { badText } from "./board.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const now = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function ensureQ(db) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (h TEXT PRIMARY KEY, nick TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS qprops (id INTEGER PRIMARY KEY AUTOINCREMENT, h TEXT NOT NULL, nick TEXT NOT NULL, a TEXT NOT NULL, b TEXT NOT NULL, created TEXT NOT NULL, st INTEGER NOT NULL DEFAULT 0)"),
  ]);
}
const clip = (s) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
async function hit(env, key, limit) {
  const day = kst(), h = (await sha(`${key}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const r = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(h).first();
  if (r && r.n >= limit) return false;
  await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(h, day).run();
  return true;
}
export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (!env.DB) return json({ error: "nodb", msg: "지금은 제안을 받을 수 없어요." }, 500);
  await ensureQ(env.DB);
  const c = normCode(b && b.code);
  const me = c && (await env.DB.prepare("SELECT h, nick FROM profiles WHERE h = ?").bind(await sha(`${c}|${env.VOTE_SALT || ""}`)).first());
  if (!me) return json({ error: "noprofile", msg: "질문 제안은 프로필(복구 코드)이 있어야 해요." }, 403);
  const qa = clip(b.a), qb = clip(b.b);
  if (qa.length < 2 || qb.length < 2) return json({ error: "short", msg: "A·B 둘 다 2자 이상 써 주세요." }, 400);
  const why = badText(qa + "\n" + qb);
  if (why) return json({ error: "rule", msg: why }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "0";
  if (!(await hit(env, `${me.h}|qp`, 1)) || !(await hit(env, `${ip}|qp`, 3))) return json({ error: "limit", msg: "질문 제안은 하루 1번이에요. 내일 또 제안해 주세요." }, 429);
  await env.DB.prepare("INSERT INTO qprops (h, nick, a, b, created) VALUES (?, ?, ?, ?, ?)").bind(me.h, me.nick, qa, qb, now()).run();
  return json({ ok: true });
}
