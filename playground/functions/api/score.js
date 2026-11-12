// GET  /api/score?game=spot&day=YYYY-MM-DD → TOP 10 [{nick, score}]
// POST /api/score {game, day, score, nick} → 같은 사람(하루 해시)은 최고 점수만 남긴다.
// 별명은 자동 생성 목록 조합만 허용(자유 입력 없음 → 욕설 관리 불필요). build.py ADJ/ANI와 같은 목록.
const ADJ = ["빠른", "느긋한", "용감한", "졸린", "배고픈", "신난", "수줍은", "똑똑한", "엉뚱한", "반짝이는", "조용한", "씩씩한", "날쌘", "포근한", "명랑한", "꼼꼼한"];
const ANI = ["수달", "고양이", "강아지", "판다", "펭귄", "다람쥐", "여우", "너구리", "부엉이", "고래", "토끼", "햄스터", "거북이", "사슴", "오리", "곰"];
const MAX = { spot: 3000, dodge: 20000, stop: 20000 };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function nickOk(n) {
  const p = String(n || "").split(" ");
  return p.length === 3 && ADJ.includes(p[0]) && ANI.includes(p[1]) && /^\d{1,2}$/.test(p[2]);
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const game = u.searchParams.get("game"), day = u.searchParams.get("day") || kst();
  if (!(game in MAX) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return json([]);
  const { results } = await env.DB.prepare("SELECT nick, score FROM scores WHERE day = ? AND game = ? ORDER BY score DESC LIMIT 10").bind(day, game).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  const { game, day, nick } = b || {};
  const score = Math.floor(Number(b?.score));
  if (!(game in MAX) || day !== kst() || !nickOk(nick) || !(score > 0 && score <= MAX[game])) return json({ error: "bad" }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const h = (await sha(`${ip}|${game}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO scores (day, game, h, nick, score) VALUES (?, ?, ?, ?, ?) ON CONFLICT(day, game, h) DO UPDATE SET score = MAX(score, excluded.score), nick = excluded.nick").bind(day, game, h, nick, score),
    env.DB.prepare("DELETE FROM scores WHERE day < date(?, '-7 day')").bind(day),
  ]);
  return json({ ok: true });
}
