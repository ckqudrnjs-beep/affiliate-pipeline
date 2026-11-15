// 끊어진 하늘 베타 의견 (2026-11-15 BK: 베타 공개 + 게시판 피드백 + 악성 유저 차단)
// POST /api/skyfb {a:"send", code?, star(1~5), tags[], text, ctx{ch,isle,lv,cls,diff,play,dev,why,v}, board?}
//   → {ok, board?}  프로필(복구 코드)이 없어도 보낼 수 있다(기기 IP 기준으로 셈·차단).
//   board=true 이고 프로필이 있으면 게시판에도 「[끊어진 하늘] …」 글로 올린다(게시판 하루 제한·규칙 그대로).
// 자동 거르기: 게시판과 같은 규칙(욕설·링크·개인정보·도배). 한 사람(프로필 또는 IP) 하루 10개.
// 차단: 게시판과 같은 bans 표. 익명은 h = "ip:<IP 해시>". 관리자 조치는 admin.js(skyfb·fbhide·fbban).
import { ensureBoard, badText } from "./board.js";
import { normCode } from "./profile.js";

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const now = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const FB_TAGS = ["bug", "hard", "easy", "dull", "good", "idea"];
let ready = false;
export async function ensureFb(db) {
  if (ready) return;
  await ensureBoard(db);
  await db.prepare("CREATE TABLE IF NOT EXISTS sky_fb (id INTEGER PRIMARY KEY AUTOINCREMENT, h TEXT NOT NULL, nick TEXT, star INTEGER NOT NULL, tags TEXT NOT NULL, text TEXT NOT NULL, ctx TEXT NOT NULL, ch INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, post INTEGER)").run();
  ready = true;
}
// 아이피·프로필 해시 → 차단이면 날짜, 아니면 null (bans 표는 게시판·순위·의견이 같이 씀)
export async function banUntil(env, hs) {
  for (const h of hs) { if (!h) continue; const b = await env.DB.prepare("SELECT until FROM bans WHERE h = ?").bind(h).first(); if (b && b.until >= kst()) return b.until; }
  return null;
}
export async function ipKey(env, ip) { return "ip:" + (await sha(`${ip}|ipban|${env.VOTE_SALT || ""}`)).slice(0, 24); }
async function hit(env, key, limit) {
  const day = kst(), h = (await sha(`${key}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const r = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(h).first();
  if (r && r.n >= limit) return false;
  await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(h, day).run();
  return true;
}
const clip = (s, n) => String(s || "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, n);
const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(+v || 0)));
const TAGN = { bug: "버그", hard: "너무 어려움", easy: "너무 쉬움", dull: "지루함", good: "좋아요", idea: "제안" };

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (!env.DB) return json({ error: "nodb" }, 500);
  if (!b || b.a !== "send") return json({ error: "bad" }, 400);
  await ensureFb(env.DB);
  const en = !!(b.ctx && b.ctx.lang === "en"); // 영어판(/en/sky)은 안내 문구도 영어로
  const ip = request.headers.get("cf-connecting-ip") || "0", ik = await ipKey(env, ip);
  const c = normCode(b.code), ph = c ? await sha(`${c}|${env.VOTE_SALT || ""}`) : null;
  const me = ph ? await env.DB.prepare("SELECT h, nick FROM profiles WHERE h = ?").bind(ph).first() : null;
  const until = await banUntil(env, [me && me.h, ik]);
  if (until) return json({ error: "ban", msg: en ? `Feedback is ${until.startsWith("9999") ? "permanently blocked" : "blocked until " + until} for breaking the rules.` : `이용 지침 위반으로 ${until.startsWith("9999") ? "의견 남기기가 영구 제한" : until + "까지 의견 남기기가 제한"}됐어요.` }, 403);
  const star = num(b.star, 1, 5), tags = (Array.isArray(b.tags) ? b.tags : []).filter((t) => FB_TAGS.includes(t)).slice(0, 6), text = clip(b.text, 500);
  if (!text && !tags.length) return json({ error: "short", msg: en ? "Pick a tag or write at least one line." : "태그를 고르거나 한 줄이라도 써 주세요." }, 400);
  const why = text && badText(text);
  if (why) return json({ error: "rule", msg: en ? "No profanity, links, personal info or spam, please." : why }, 400);
  if (!(await hit(env, `${me ? me.h : ik}|sfb`, 10)) || !(await hit(env, `${ip}|sfb`, 20))) return json({ error: "limit", msg: en ? "You've sent plenty of feedback today. Thanks, see you tomorrow!" : "오늘은 의견을 충분히 보내 주셨어요. 내일 또 부탁해요!" }, 429);
  const x = b.ctx || {};
  const ctx = { ch: num(x.ch, 0, 9), isle: clip(x.isle, 20), lv: num(x.lv, 0, 200), cls: clip(x.cls, 12), diff: num(x.diff, 0, 2), play: num(x.play, 0, 1e7), dev: x.dev === "pc" ? "pc" : "phone", why: clip(x.why, 20), v: clip(x.v, 16), lang: en ? "en" : "ko" };
  const h = me ? me.h : ik, nick = me ? me.nick : "익명";
  const r = await env.DB.prepare("INSERT INTO sky_fb (h, nick, star, tags, text, ctx, ch, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id").bind(h, nick, star, tags.join(","), text, JSON.stringify(ctx), ctx.ch, now()).first();
  let board = null;
  if (b.board && me && text.length >= 2) {
    const ok = (await hit(env, `${me.h}|bw`, 5)) && (await hit(env, `${ip}|bw`, 10));
    if (ok) {
      const title = clip(`[끊어진 하늘] ${tags.map((t) => TAGN[t]).join("·") || "의견"} · ${ctx.ch}장`, 40);
      const body = `${"★".repeat(star)}${"☆".repeat(5 - star)}\n${text}\n\n(${ctx.ch}장 ${ctx.isle} · ${ctx.lv}레벨 · ${ctx.dev === "pc" ? "PC" : "폰"})`;
      const p = await env.DB.prepare("INSERT INTO posts (h, nick, title, body, secret, created) VALUES (?, ?, ?, ?, 0, ?) RETURNING id").bind(me.h, me.nick, title, body, now()).first();
      board = p && p.id; if (board) await env.DB.prepare("UPDATE sky_fb SET post = ? WHERE id = ?").bind(board, r.id).run();
    } else board = 0;
  }
  return json({ ok: true, board });
}
