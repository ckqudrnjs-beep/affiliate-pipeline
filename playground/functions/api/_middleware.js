// 트래픽 폭주 대비 (2026-11-14 BK). 모든 /api/* 요청을 감싼다(같은 요청 안에서 돌아서 요청 수는 늘지 않음).
// 1) 순위·게시판 목록(GET)은 엣지 캐시: 같은 주소는 잠깐 동안 D1을 다시 읽지 않는다. 주소에 f=… 가 있으면 새로 읽고 캐시도 갱신(내 기록 올린 직후).
// 2) D1 한도 초과·오류가 나면 500 대신 503 + 쉬운 안내 문구. 화면은 이 응답을 보고 "잠시 쉬는 중"을 보여 주고, 게임은 그대로 된다.
// 3) 비상 스위치: Cloudflare 환경변수 API_PAUSE=1 이면 저장(POST)만 잠시 멈춘다(조회는 캐시로 계속). 0 또는 지우면 원래대로.
const TTL = {
  "/api/score": (u) => (u.searchParams.get("week") ? 120 : 15), // 오늘 순위 15초, 최근 7일 순위 2분
  "/api/board": () => 20,
};
const BUSY = "지금 접속이 많아 순위·저장이 잠시 쉬어요. 게임은 그대로 할 수 있고, 기록은 이 기기에 남아 있어요.";
const busy = () => new Response(JSON.stringify({ error: "busy", msg: BUSY }), {
  status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "retry-after": "600" },
});

export async function onRequest({ request, env, next, waitUntil }) {
  const u = new URL(request.url), get = request.method === "GET";
  if (!get && String(env.API_PAUSE || "") === "1" && u.pathname !== "/api/admin") return busy();
  const ttl = get && TTL[u.pathname] ? TTL[u.pathname](u) : 0;
  const cache = ttl && typeof caches !== "undefined" ? caches.default : null;
  let key = null;
  if (cache) {
    const k = new URL(u.toString());
    k.searchParams.delete("f");
    k.searchParams.sort();
    key = new Request(k.toString(), { method: "GET" });
    if (!u.searchParams.has("f")) {
      try { const hit = await cache.match(key); if (hit) return hit; } catch { /* 캐시 실패 = 그냥 D1 */ }
    }
  }
  let res;
  try { res = await next(); }
  catch (e) {
    console.error("api error", u.pathname, String(e && e.message || e).slice(0, 300));
    return busy();
  }
  if (key && res.status === 200) {
    const out = new Response(res.body, res);
    out.headers.set("cache-control", `public, max-age=${ttl}`);
    try { waitUntil(cache.put(key, out.clone())); } catch { /* 무시 */ }
    return out;
  }
  return res;
}
