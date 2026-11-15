// 돈삼촌 관리자 페이지(https://don3chon.com/admin.html, 2026-11-15 BK)가 순 방문자 수를 읽는 곳. 읽기 전용.
// 돈삼촌은 서버가 없는 정적 사이트라 5락실 서버를 쓴다. 비밀번호·틀린 횟수 제한은 5락실 관리자와 같다(admin.js gate).
// 다른 주소에서 부르는 것이라(교차 출처) don3chon.com 에서 온 요청만 응답을 읽을 수 있게 한다.
import { gate } from "./admin.js";
import { visitStats } from "./visit.js";

const ORIGIN = "https://don3chon.com";
const cors = { "access-control-allow-origin": ORIGIN, "vary": "Origin" };

export async function onRequestOptions({ request }) {
  if (request.headers.get("origin") !== ORIGIN) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "POST", "access-control-allow-headers": "content-type, x-admin-key", "access-control-max-age": "600" } });
}

export async function onRequestPost({ request, env }) {
  if (request.headers.get("origin") !== ORIGIN) return new Response(JSON.stringify({ error: "origin" }), { status: 403, headers: { "content-type": "application/json" } });
  const g = await gate(request, env, cors);
  if (g) return g;
  const r = new Response(JSON.stringify(await visitStats(env.DB, "d3")), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });
  return r;
}
