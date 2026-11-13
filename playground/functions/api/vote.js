// POST /api/vote {qid, opt}  opt: "a" | "b" | "r1".."r4"(이모지 반응)
// GET  /api/vote?ids=q1,q2   → {q1:{a:3,b:5,r1:0,...}, ...}
// 원본 IP는 저장하지 않는다. (IP+질문+종류+날짜+VOTE_SALT) 해시만 하루 보관.
const OPTS = new Set(["a", "b", "r1", "r2", "r3", "r4"]);
const QID = /^[0-9]{8}-[0-9]$/;
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// 집계는 엣지에 30초 캐시(D1 읽기 절약). 화면은 내 표를 바로 +1 해서 보여 주므로 30초 지연은 티가 안 난다.
export async function onRequestGet({ request, env, waitUntil }) {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const hit = cache && (await cache.match(request));
  if (hit) return hit;
  const ids = (new URL(request.url).searchParams.get("ids") || "").split(",").filter((x) => QID.test(x)).slice(0, 30);
  if (!ids.length) return json({});
  const q = `SELECT qid, opt, n FROM counts WHERE qid IN (${ids.map(() => "?").join(",")})`;
  const { results } = await env.DB.prepare(q).bind(...ids).all();
  const out = {};
  for (const id of ids) out[id] = { a: 0, b: 0, r1: 0, r2: 0, r3: 0, r4: 0 };
  for (const r of results) out[r.qid][r.opt] = r.n;
  const res = new Response(JSON.stringify(out), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" } });
  if (cache) waitUntil(cache.put(request, res.clone()));
  return res;
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad" }, 400); }
  const { qid, opt } = body || {};
  if (!QID.test(qid || "") || !OPTS.has(opt)) return json({ error: "bad" }, 400);
  const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const kind = opt.startsWith("r") ? opt : "v";
  const h = await sha(`${ip}|${qid}|${kind}|${day}|${env.VOTE_SALT || ""}`);
  const rate = await sha(`${ip}|rate|${day}|${env.VOTE_SALT || ""}`);
  // 하루 횟수 제한: 기본 키 범위 조회(인덱스 사용)로 이 사람 행만 읽는다. LIKE는 인덱스를 못 써서 표 전체를 읽었다.
  const p = rate.slice(0, 16);
  const used = await env.DB.prepare("SELECT COUNT(*) AS c FROM (SELECT 1 FROM seen WHERE h >= ? AND h < ? LIMIT 301)").bind(p, p + "g").first();
  if ((used?.c || 0) > 300) return json({ error: "limit" }, 429);
  const ins = await env.DB.prepare("INSERT OR IGNORE INTO seen (h, day) VALUES (?, ?)").bind(h, day).run();
  if (!ins.meta.changes) return json({ ok: true, dup: true });
  await env.DB.batch([
    env.DB.prepare("INSERT INTO seen (h, day) VALUES (?, ?)").bind(rate.slice(0, 16) + h.slice(0, 16), day),
    env.DB.prepare("INSERT INTO counts (qid, opt, n) VALUES (?, ?, 1) ON CONFLICT(qid, opt) DO UPDATE SET n = n + 1").bind(qid, opt),
  ]);
  // 오래된 해시 삭제는 투표 100번에 한 번만(day 인덱스 사용).
  if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM seen WHERE day < date(?, '-2 day')").bind(day).run();
  return json({ ok: true });
}
