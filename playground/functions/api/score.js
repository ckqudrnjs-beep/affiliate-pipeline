// GET  /api/score?game=spot&day=YYYY-MM-DD → TOP 10 [{nick, score}]
// GET  /api/score?game=spot&week=1           → 최근 7일 TOP 10 (프로필 있는 사람만, 사람마다 7일 중 최고 점수)
// POST /api/score {game, day, score, nick, code?} → 같은 사람(하루 해시)은 최고 점수만 남긴다.
//      code(복구 코드)가 맞고 별명이 그 프로필 별명이면 프로필 기록(pscores)에도 저장 → 7일 보관(BK 2026-11-14)
// POST /api/score {a:"mine", code}            → 내 최근 7일 기록(게임별 날짜별 최고 점수)
// 별명은 자동 생성 목록 조합, 또는 프로필 별명(아바타+이름, lib/nick.js 욕설·사칭 거르기 통과)만 허용. build.py ADJ/ANI와 같은 목록.
import { profileNickOk } from "../../lib/nick.js";
import { normCode } from "./profile.js";
const ADJ = ["빠른", "느긋한", "용감한", "졸린", "배고픈", "신난", "수줍은", "똑똑한", "엉뚱한", "반짝이는", "조용한", "씩씩한", "날쌘", "포근한", "명랑한", "꼼꼼한"];
const ANI = ["수달", "고양이", "강아지", "판다", "펭귄", "다람쥐", "여우", "너구리", "부엉이", "고래", "토끼", "햄스터", "거북이", "사슴", "오리", "곰"];
const MAX = { spot: 3000, dodge: 20000, stop: 20000, range: 5000000, starlight: 9000000, tongtong: 200000 };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const ago = (day, n) => new Date(Date.parse(day + "T00:00:00Z") - n * 864e5).toISOString().slice(0, 10);
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS pscores (h TEXT NOT NULL, game TEXT NOT NULL, day TEXT NOT NULL, nick TEXT NOT NULL, score INTEGER NOT NULL, PRIMARY KEY (h, game, day))").run();
  ready = true;
}
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function nickOk(n) {
  const p = String(n || "").split(" ");
  return (p.length === 3 && ADJ.includes(p[0]) && ANI.includes(p[1]) && /^\d{1,2}$/.test(p[2])) || profileNickOk(n);
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const game = u.searchParams.get("game"), day = u.searchParams.get("day") || kst();
  if (!(game in MAX) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return json([]);
  if (u.searchParams.get("week")) {
    await ensure(env.DB);
    const from = ago(kst(), 6);
    let r;
    try { r = await env.DB.prepare("SELECT COALESCE(p.nick, s.nick) AS nick, MAX(s.score) AS score, CASE WHEN t.h IS NULL THEN 0 ELSE 1 END AS t, json_extract(p.data, '$.title') AS ti, json_extract(p.data, '$.nc') AS nc FROM pscores s LEFT JOIN profiles p ON p.h = s.h LEFT JOIN testers t ON t.h = s.h WHERE s.game = ? AND s.day >= ? AND COALESCE(t.hide, 0) = 0 GROUP BY s.h ORDER BY score DESC LIMIT 10").bind(game, from).all(); }
    catch {
      // testers 표가 아직 없으면(관리자 페이지를 안 열었으면) 테스터 표시 없이. 칭호(ti)는 프로필 data 에서
      try { r = await env.DB.prepare("SELECT COALESCE(p.nick, s.nick) AS nick, MAX(s.score) AS score, json_extract(p.data, '$.title') AS ti, json_extract(p.data, '$.nc') AS nc FROM pscores s LEFT JOIN profiles p ON p.h = s.h WHERE s.game = ? AND s.day >= ? GROUP BY s.h ORDER BY score DESC LIMIT 10").bind(game, from).all(); }
      catch { r = await env.DB.prepare("SELECT COALESCE(p.nick, s.nick) AS nick, MAX(s.score) AS score FROM pscores s LEFT JOIN profiles p ON p.h = s.h WHERE s.game = ? AND s.day >= ? GROUP BY s.h ORDER BY score DESC LIMIT 10").bind(game, from).all(); }
    }
    return json(r.results || []);
  }
  // 관리자가 지정한 테스터는 순위에 "테스터" 표시(t=1). '순위 제외'를 켠 테스터만 빠진다(BK 2026-11-13)
  let results;
  try { ({ results } = await env.DB.prepare("SELECT s.nick, s.score, CASE WHEN t.h IS NULL THEN 0 ELSE 1 END AS t FROM scores s LEFT JOIN testers t ON t.nick = s.nick WHERE s.day = ? AND s.game = ? AND COALESCE(t.hide, 0) = 0 ORDER BY s.score DESC LIMIT 10").bind(day, game).all()); }
  catch { ({ results } = await env.DB.prepare("SELECT nick, score FROM scores WHERE day = ? AND game = ? ORDER BY score DESC LIMIT 10").bind(day, game).all()); }
  return json(results);
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (b && b.a === "mine") {
    const c = normCode(b.code);
    if (!c || !env.DB) return json({ error: "noprofile" }, 403);
    await ensure(env.DB);
    const h = await sha(`${c}|${env.VOTE_SALT || ""}`);
    const { results } = await env.DB.prepare("SELECT game, day, score FROM pscores WHERE h = ? AND day >= ? ORDER BY game, day DESC").bind(h, ago(kst(), 6)).all();
    return json({ list: results || [] });
  }
  const { game, day, nick } = b || {};
  const score = Math.floor(Number(b?.score));
  if (!(game in MAX) || day !== kst() || !nickOk(nick) || !(score > 0 && score <= MAX[game])) return json({ error: "bad" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const h = (await sha(`${ip}|${game}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO scores (day, game, h, nick, score) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day, game, h) DO UPDATE SET score = MAX(score, excluded.score), nick = excluded.nick").bind(day, game, h, nick, score),
    env.DB.prepare("DELETE FROM scores WHERE day < date(?, '-7 day')").bind(day),
  ]);
  // 프로필 기록(7일 보관): 복구 코드가 맞고 별명이 그 프로필 별명일 때만
  const c = normCode(b.code);
  if (c && profileNickOk(nick)) {
    await ensure(env.DB);
    const ph = await sha(`${c}|${env.VOTE_SALT || ""}`);
    const pr = await env.DB.prepare("SELECT nick FROM profiles WHERE h = ?").bind(ph).first();
    if (pr && pr.nick === nick) await env.DB.batch([
      env.DB.prepare("INSERT INTO pscores (h, game, day, nick, score) VALUES (?, ?, ?, ?, ?) ON CONFLICT(h, game, day) DO UPDATE SET score = MAX(score, excluded.score), nick = excluded.nick").bind(ph, game, day, nick, score),
      env.DB.prepare("DELETE FROM pscores WHERE day < ?").bind(ago(day, 6)),
    ]);
  }
  return json({ ok: true });
}
