// 끊어진 하늘 순위 (2026-11-15 BK: 최고 레벨·엔딩 시간·떠도는 섬 보스 수 + 난이도 6단계, 한글/영문 구분)
// 순위는 서버 저장(skysave put)이 올 때 그 기록에서 뽑아 sky_rank 에 넣는다 → 프로필(복구 코드) 있는 캐릭터만.
// 말이 안 되는 기록(플레이 시간에 비해 레벨이 너무 높음 등)은 순위에 넣지 않는다.
// GET /api/skyrank?k=lv|end|dmax|boss&d=0..5&lang=ko|en|all → {list:[{nick,cls,lang,v,at}]}
const json = (o, s = 200, c = "no-store") => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": c } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const CLS = ["warden", "drifter", "windcaller", "trapper", "ringer"], ND = 6;
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS sky_rank (h TEXT NOT NULL, cls TEXT NOT NULL, nick TEXT NOT NULL, lang TEXT NOT NULL, lv INTEGER NOT NULL, lv_at INTEGER NOT NULL, end_t INTEGER, dmax INTEGER, dmax_at INTEGER, b0 INTEGER NOT NULL DEFAULT 0, b1 INTEGER NOT NULL DEFAULT 0, b2 INTEGER NOT NULL DEFAULT 0, b3 INTEGER NOT NULL DEFAULT 0, b4 INTEGER NOT NULL DEFAULT 0, b5 INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (h, cls))"),
    db.prepare("CREATE INDEX IF NOT EXISTS sky_rank_lv ON sky_rank (lv DESC, lv_at)"),
  ]);
  ready = true;
}
const int = (v) => Math.floor(+v || 0);
// 저장 기록 → 순위 줄(믿기 어려우면 null)
export function rankRow(d) {
  const f = (d && d.flags) || {}, lv = int(d.lv), play = int(d.play), now = Date.now(), T0 = Date.UTC(2026, 10, 14);
  if (!CLS.includes(d.cls) || lv < 1 || lv > 120 || play < 0) return null;
  if (lv > 5 && play < lv * 30) return null; // 레벨당 30초도 안 걸렸다면 조작
  const ended = d.q && d.q.q37 && d.q.q37.s === 3;
  let lvAt = int(f.lvAt) || int(d.t); if (lvAt < T0 || lvAt > now + 864e5) lvAt = int(d.t);
  let endT = f.endT != null ? int(f.endT) : null; if (!ended || endT == null || endT < 3600 || endT > play) endT = null;
  let dmax = ended ? Math.max(0, Math.min(ND - 1, f.dmax != null ? int(f.dmax) : 0)) : null, dmaxAt = int(f.dmaxAt) || int(d.t);
  const rb = Array.isArray(f.rb) ? f.rb : [], b = [...Array(ND)].map((_, i) => Math.max(0, Math.min(100000, int(rb[i]))));
  if (b.reduce((a, c) => a + c, 0) > play / 60 + 1) return null; // 보스는 1분에 하나도 못 잡는다
  return { lv, lvAt, endT, dmax, dmaxAt, b, lang: d.lang === "en" ? "en" : "ko" };
}
export async function rankUpsert(env, h, d) {
  try {
    const r = rankRow(d); await ensure(env.DB);
    if (!r) { await env.DB.prepare("DELETE FROM sky_rank WHERE h = ? AND cls = ?").bind(h, d.cls).run(); return; }
    const p = await env.DB.prepare("SELECT nick FROM profiles WHERE h = ?").bind(h).first(); if (!p) return;
    await env.DB.prepare("INSERT INTO sky_rank (h, cls, nick, lang, lv, lv_at, end_t, dmax, dmax_at, b0, b1, b2, b3, b4, b5, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(h, cls) DO UPDATE SET nick = excluded.nick, lang = excluded.lang, lv = excluded.lv, lv_at = CASE WHEN excluded.lv = sky_rank.lv THEN sky_rank.lv_at ELSE excluded.lv_at END, end_t = excluded.end_t, dmax = excluded.dmax, dmax_at = CASE WHEN excluded.dmax = sky_rank.dmax THEN sky_rank.dmax_at ELSE excluded.dmax_at END, b0 = excluded.b0, b1 = excluded.b1, b2 = excluded.b2, b3 = excluded.b3, b4 = excluded.b4, b5 = excluded.b5, updated = excluded.updated")
      .bind(h, d.cls, p.nick, r.lang, r.lv, r.lvAt, r.endT, r.dmax, r.dmaxAt, ...r.b, Date.now()).run();
  } catch { /* 순위는 저장을 막지 않는다 */ }
}
export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "nodb" }, 500);
  await ensure(env.DB);
  const u = new URL(request.url), k = u.searchParams.get("k") || "lv", d = Math.max(0, Math.min(ND - 1, int(u.searchParams.get("d")))), lang = u.searchParams.get("lang");
  const Q = {
    lv: ["lv AS v, lv_at AS at", "1", "lv DESC, lv_at ASC"],
    end: ["end_t AS v, updated AS at", "end_t IS NOT NULL", "end_t ASC, updated ASC"],
    dmax: ["dmax AS v, dmax_at AS at", "dmax IS NOT NULL", "dmax DESC, dmax_at ASC"],
    boss: [`b${d} AS v, updated AS at`, `b${d} > 0`, `b${d} DESC, updated ASC`],
  }[k];
  if (!Q) return json({ error: "bad" }, 400);
  const lw = lang === "ko" || lang === "en" ? " AND lang = ?" : "";
  let rows = [];
  try {
    const { results } = await env.DB.prepare(`SELECT nick, cls, lang, lv, ${Q[0]} FROM sky_rank WHERE ${Q[1]}${lw} AND h NOT IN (SELECT h FROM bans WHERE until >= ?) ORDER BY ${Q[2]} LIMIT 30`).bind(...(lw ? [lang, kst()] : [kst()])).all();
    rows = results || [];
  } catch {
    const { results } = await env.DB.prepare(`SELECT nick, cls, lang, lv, ${Q[0]} FROM sky_rank WHERE ${Q[1]}${lw} ORDER BY ${Q[2]} LIMIT 30`).bind(...(lw ? [lang] : [])).all();
    rows = results || [];
  }
  return json({ list: rows }, 200, "public, max-age=30");
}
