// 순 방문자 수(2026-11-15 BK): 관리자 페이지에서만 본다. 공개 화면에는 숫자를 안 보여 준다.
// POST /api/visit (모든 페이지 공통 스크립트가 브라우저마다 하루 1번만 보냄) → 204
// - 원본 IP는 저장하지 않는다. (IP + 날짜 + 비밀값 VOTE_SALT) 해시 앞 16자리만 그날 하루 '오늘 방문자' 표에 둔다.
//   날짜가 해시에 들어가서 다음 날이면 같은 사람도 다른 값이 된다(날짜를 넘어 사람을 이어 볼 수 없음).
// - 지난날 것은 '날짜별 숫자 1개'(visit_daily)로 접고 해시는 지운다 → 해시는 길어야 하루 남짓만 남는다.
// - 돈삼촌(don3chon.com, 정적 사이트·서버 없음)도 같은 주소로 보낸다(2026-11-15 BK). Origin 이 https://don3chon.com 이면 d3_ 표에 따로 센다.
//   그래서 돈삼촌 숫자도 5락실 /admin 에서 같이 본다(돈삼촌에 관리자·D1을 새로 만들지 않음).
// - 같은 IP는 하루 1명(INSERT OR IGNORE: 이미 있으면 D1에 아무것도 안 씀). 봇(UA)·자동화 브라우저는 세지 않는다.
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|phantom|selenium|puppeteer|playwright|python|curl|wget|go-http|okhttp|axios|node-fetch|yeti|gtmetrix|pingdom|uptime/i;
const kst = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const none = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// 사이트별 표 이름(고정 목록에서만 고름)
export const SITES = { raksil: "", d3: "d3_" };
const tb = (site) => { const p = SITES[site] ?? ""; return { v: p + "visits", d: p + "visit_daily" }; };
const ready = {};
export async function ensureVisits(db, site = "raksil") {
  if (ready[site]) return;
  const t = tb(site);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS ${t.v} (day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY (day, h)) WITHOUT ROWID`),
    db.prepare(`CREATE TABLE IF NOT EXISTS ${t.d} (day TEXT PRIMARY KEY, n INTEGER NOT NULL)`),
  ]);
  ready[site] = true;
}

// 오늘 이전 날짜의 해시를 날짜별 숫자로 접고 지운다(한 묶음 = 한 트랜잭션). 늦게 들어온 자정 직전 요청도 더해진다.
export async function rollup(db, today = kst(), site = "raksil") {
  const t = tb(site);
  await db.batch([
    db.prepare(`INSERT INTO ${t.d} (day, n) SELECT day, COUNT(*) FROM ${t.v} WHERE day < ? GROUP BY day ON CONFLICT(day) DO UPDATE SET n = n + excluded.n`).bind(today),
    db.prepare(`DELETE FROM ${t.v} WHERE day < ?`).bind(today),
  ]);
}

// 관리자용 숫자: 오늘(실시간), 어제, 최근 7일·30일(오늘 포함, 날마다 센 순 방문자의 합), 최근 30일 날짜별
export async function visitStats(db, site = "raksil") {
  if (!(site in SITES)) site = "raksil";
  const t = tb(site);
  await ensureVisits(db, site);
  const today = kst();
  await rollup(db, today, site);
  const from = kst(Date.now() - 29 * 864e5), y = kst(Date.now() - 864e5), w = kst(Date.now() - 6 * 864e5);
  const c = await db.prepare(`SELECT COUNT(*) AS n FROM ${t.v} WHERE day = ?`).bind(today).first();
  const { results } = await db.prepare(`SELECT day, n FROM ${t.d} WHERE day >= ? AND day < ? ORDER BY day DESC`).bind(from, today).all();
  const days = [{ day: today, n: c ? c.n : 0 }].concat(results || []);
  const sum = (d0) => days.filter((r) => r.day >= d0).reduce((s, r) => s + r.n, 0);
  const yd = days.find((r) => r.day === y);
  const first = await db.prepare(`SELECT MIN(day) AS d FROM ${t.d}`).first();
  return { today: days[0].n, yday: yd ? yd.n : 0, d7: sum(w), d30: sum(from), days, since: (first && first.d) || today };
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return none();
  const ua = request.headers.get("user-agent") || "";
  if (ua.length < 20 || BOT.test(ua)) return none();
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return none();
  const site = { "https://5raksil.com": "raksil", "https://don3chon.com": "d3" }[request.headers.get("origin") || ""];
  if (!site) return none(); // 다른 사이트가 숫자를 부풀리지 못하게
  const day = kst();
  const h = (await sha(`${ip}|visit|${site === "d3" ? "d3|" : ""}${day}|${env.VOTE_SALT || ""}`)).slice(0, 16);
  await ensureVisits(env.DB, site);
  const r = await env.DB.prepare(`INSERT OR IGNORE INTO ${tb(site).v} (day, h) VALUES (?, ?)`).bind(day, h).run();
  // 관리자가 한동안 안 봐도 해시가 쌓이지 않게: 새 방문자 50명에 1번꼴로 지난날 정리
  if (r && r.meta && r.meta.changes && Math.random() < 0.02) { try { await rollup(env.DB, day, site); } catch { /* 다음에 */ } }
  return none();
}
