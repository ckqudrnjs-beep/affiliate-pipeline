// Cloudflare Access 이중 확인 (2026-11-15 BK, plan/SECURITY.md D).
// Pages 변수 ACCESS_TEAM(예: "myteam" 또는 "myteam.cloudflareaccess.com")과 ACCESS_AUD(Access 앱의 'Application Audience (AUD) Tag')를
// 둘 다 넣으면, /api/admin 요청은 Access 로그인 증표(Cf-Access-Jwt-Assertion)가 올바를 때만 통과한다.
// 둘 중 하나라도 없으면 지금처럼 관리자 비밀번호만 본다(설정 전 잠김 방지).
let certs = null, certsAt = 0;

const b64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const team = (t) => {
  const s = String(t || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return s.includes(".") ? s : `${s}.cloudflareaccess.com`;
};

async function keys(host, force) {
  if (!force && certs && Date.now() - certsAt < 3600e3) return certs;
  const r = await fetch(`https://${host}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("certs " + r.status);
  certs = (await r.json()).keys || [];
  certsAt = Date.now();
  return certs;
}

export const accessOn = (env) => !!(env.ACCESS_TEAM && env.ACCESS_AUD);

// 통과하면 이메일(없으면 "ok"), 아니면 null
export async function accessOk(request, env) {
  const jwt = request.headers.get("cf-access-jwt-assertion") || "";
  const p = jwt.split(".");
  if (p.length !== 3) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64u(p[0])));
    const body = JSON.parse(new TextDecoder().decode(b64u(p[1])));
    const host = team(env.ACCESS_TEAM), now = Date.now() / 1000;
    if (head.alg !== "RS256") return null;
    const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
    if (!aud.includes(String(env.ACCESS_AUD).trim())) return null;
    if (!(body.exp > now) || (body.nbf && body.nbf > now + 60)) return null;
    if (body.iss !== `https://${host}`) return null;
    let k = (await keys(host)).find((x) => x.kid === head.kid);
    if (!k) k = (await keys(host, true)).find((x) => x.kid === head.kid); // 키가 바뀐 직후
    if (!k) return null;
    const key = await crypto.subtle.importKey("jwk", { kty: k.kty, n: k.n, e: k.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(p[2]), new TextEncoder().encode(p[0] + "." + p[1]));
    return ok ? body.email || "ok" : null;
  } catch {
    return null;
  }
}
