// 5락실 게시판 (2026-11-14 BK). 글쓰기는 프로필(복구 코드)이 있어야 가능. 이용 지침: /board-rules
// GET  /api/board?page=0                       → 공개 목록(숨김 제외, 비밀글은 제목 가림)
// POST /api/board {a:"read", id, code?}         → 글 보기(비밀글은 작성자 코드 또는 관리자만)
// POST /api/board {a:"write", code, title, body, secret} → 글쓰기
// POST /api/board {a:"report", id}              → 신고(같은 사람 하루 1번, 서로 다른 3명이면 자동 숨김)
// POST /api/board {a:"del", id, code}           → 내 글 삭제
// 자동 차단: 욕설·사칭, 링크, 전화·이메일·계좌 같은 개인정보, 도배(프로필 하루 5개·IP 하루 10개). 관리자 조치는 admin.js
import { BAD } from "../../lib/nick.js";
import { normCode } from "./profile.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const now = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
let ready = false;
export async function ensureBoard(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (h TEXT PRIMARY KEY, nick TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, h TEXT NOT NULL, nick TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, secret INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, reports INTEGER NOT NULL DEFAULT 0, reply TEXT, replied TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS preports (id INTEGER NOT NULL, rh TEXT NOT NULL, PRIMARY KEY (id, rh))"),
    db.prepare("CREATE TABLE IF NOT EXISTS bans (h TEXT PRIMARY KEY, nick TEXT, until TEXT NOT NULL, reason TEXT)"),
  ]);
  ready = true;
}
// 금지 내용 검사. 문제가 있으면 이유 문구, 없으면 null
export function badText(s) {
  const t = String(s || "");
  const flat = t.toLowerCase().replace(/[\s\p{P}\p{S}0-9]/gu, "");
  if (BAD.some((w) => flat.includes(w))) return "욕설·비하·사칭 표현은 쓸 수 없어요.";
  if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|kr|co|io|me|ly|gg|xyz|link|site|shop)\b|open\.kakao|t\.me\/|오픈채팅|오픈카톡)/i.test(t)) return "링크·오픈채팅 주소는 쓸 수 없어요.";
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t)) return "이메일 주소 같은 개인정보는 쓸 수 없어요.";
  if (/(01[016789]|0\d{1,2})[\s.-]?\d{3,4}[\s.-]?\d{4}/.test(t)) return "전화번호 같은 개인정보는 쓸 수 없어요.";
  if (/\d[\d-]{9,}\d/.test(t.replace(/\s/g, ""))) return "계좌·카드번호처럼 긴 숫자는 쓸 수 없어요.";
  if (/(.)\1{9,}/.test(t)) return "같은 글자를 너무 많이 반복했어요.";
  return null;
}
const clip = (s, n) => String(s || "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, n);
async function hit(env, key, limit) {
  const day = kst(), h = (await sha(`${key}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const r = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(h).first();
  if (r && r.n >= limit) return false;
  await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(h, day).run();
  return true;
}
async function profileOf(env, code) {
  const c = normCode(code);
  if (!c) return null;
  const h = await sha(`${c}|${env.VOTE_SALT || ""}`);
  const row = await env.DB.prepare("SELECT h, nick FROM profiles WHERE h = ?").bind(h).first();
  return row || null;
}
async function banOf(env, h) {
  const b = await env.DB.prepare("SELECT until FROM bans WHERE h = ?").bind(h).first();
  return b && b.until >= kst() ? b.until : null;
}
const pub = (p) => ({ id: p.id, nick: p.nick, title: p.secret ? "🔒 비밀글입니다" : p.title, secret: !!p.secret, created: p.created, replied: !!p.reply });

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ list: [] });
  await ensureBoard(env.DB);
  const pg = Math.max(0, Math.min(500, Math.floor(+new URL(request.url).searchParams.get("page") || 0)));
  const { results } = await env.DB.prepare("SELECT id, nick, title, secret, created, reply FROM posts WHERE hidden = 0 ORDER BY id DESC LIMIT 21 OFFSET ?").bind(pg * 20).all();
  return json({ list: (results || []).slice(0, 20).map(pub), more: (results || []).length > 20 });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (!env.DB) return json({ error: "nodb" }, 500);
  await ensureBoard(env.DB);
  const a = b && b.a, ip = request.headers.get("cf-connecting-ip") || "0";
  const id = Math.floor(+b.id || 0);

  if (a === "read") {
    const p = await env.DB.prepare("SELECT * FROM posts WHERE id = ? AND hidden = 0").bind(id).first();
    if (!p) return json({ error: "none", msg: "글이 없거나 숨겨졌어요." }, 404);
    const me = b.code ? await profileOf(env, b.code) : null, mine = !!(me && me.h === p.h);
    if (p.secret && !mine) return json({ error: "secret", msg: "비밀글은 쓴 사람과 관리자만 볼 수 있어요." }, 403);
    return json({ ...pub(p), title: p.title, body: p.body, reply: p.reply || null, replied_at: p.replied || null, mine });
  }
  if (a === "report") {
    if (!(await hit(env, `${ip}|brep`, 20))) return json({ error: "limit", msg: "오늘은 신고를 더 할 수 없어요." }, 429);
    const p = await env.DB.prepare("SELECT id FROM posts WHERE id = ? AND hidden = 0").bind(id).first();
    if (!p) return json({ ok: true });
    const rh = (await sha(`${ip}|rep|${env.VOTE_SALT || ""}`)).slice(0, 32);
    const r = await env.DB.prepare("INSERT INTO preports (id, rh) VALUES (?, ?) ON CONFLICT DO NOTHING").bind(id, rh).run();
    if (r.meta && r.meta.changes) await env.DB.prepare("UPDATE posts SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= 3 THEN 2 ELSE hidden END WHERE id = ?").bind(id).run();
    return json({ ok: true, msg: "신고했어요. 3명 이상 신고하면 자동으로 숨겨지고 관리자가 확인해요." });
  }
  const me = await profileOf(env, b.code);
  if (!me) return json({ error: "noprofile", msg: "글을 쓰려면 프로필(복구 코드)이 있어야 해요." }, 403);
  if (a === "del") {
    const r = await env.DB.prepare("DELETE FROM posts WHERE id = ? AND h = ?").bind(id, me.h).run();
    return json({ ok: !!(r.meta && r.meta.changes) });
  }
  if (a === "write") {
    const until = await banOf(env, me.h);
    if (until) return json({ error: "ban", msg: `이용 지침 위반으로 ${until.startsWith("9999") ? "글쓰기가 영구 제한" : until + "까지 글쓰기가 제한"}됐어요.` }, 403);
    const title = clip(b.title, 40), body = clip(b.body, 1000);
    if (title.length < 2 || body.length < 2) return json({ error: "short", msg: "제목과 내용을 2자 이상 써 주세요." }, 400);
    const why = badText(title + "\n" + body);
    if (why) return json({ error: "rule", msg: why + " 이용 지침을 확인해 주세요." }, 400);
    if (!(await hit(env, `${me.h}|bw`, 5)) || !(await hit(env, `${ip}|bw`, 10))) return json({ error: "limit", msg: "오늘은 글을 더 쓸 수 없어요. 내일 다시 써 주세요." }, 429);
    const r = await env.DB.prepare("INSERT INTO posts (h, nick, title, body, secret, created) VALUES (?, ?, ?, ?, ?, ?) RETURNING id").bind(me.h, me.nick, title, body, b.secret ? 1 : 0, now()).first();
    return json({ ok: true, id: r && r.id });
  }
  return json({ error: "bad" }, 400);
}
