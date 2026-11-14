// 네온 레이드 협동 방 연결 (BK 11/14). GET /api/coop?r=ABCD&n=별명&c=직업 (웹소켓)
// Pages 설정 > 바인딩 > Durable Object 'COOP' (Worker raid-coop, 클래스 Room) 이 있어야 켜진다. 없으면 503 {error:"off"}.
// 같은 사이트 주소에서만 연결(다른 사이트가 끌어다 쓰지 못하게).
const json = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export async function onRequestGet({ request, env }) {
  if (!env.COOP) return json({ error: "off", msg: "협동 방 서버가 아직 연결되지 않았어요." }, 503);
  const u = new URL(request.url), r = String(u.searchParams.get("r") || "").toUpperCase();
  if (!/^[A-Z0-9]{4,6}$/.test(r)) return json({ error: "code" }, 400);
  if (request.headers.get("Upgrade") !== "websocket") return json({ ok: true, on: true }, 200); // 켜져 있는지 확인용
  const o = request.headers.get("Origin") || "";
  if (o && !/^https:\/\/([a-z0-9-]+\.)?(5raksil\.com|5raksil\.pages\.dev)$/.test(o) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return json({ error: "origin" }, 403);
  return env.COOP.get(env.COOP.idFromName(r)).fetch(new Request("https://room/room/" + r + u.search, request));
}
