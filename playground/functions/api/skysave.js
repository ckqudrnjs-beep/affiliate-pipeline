// 끊어진 하늘 기록을 5락실 프로필(복구 코드)에 저장 (2026-11-15 BK "2단계 마무리")
// POST /api/skysave {a:"get", code}                → {saves:{<직업>:{data,t}}} (직업 5개)
// POST /api/skysave {a:"put", code, cls, data}     → {t}  |  409 {error:"old", data, t} (다른 기기가 더 나중에 저장함)
// 기록은 게임 진행(레벨·장비·퀘스트)만. 현금 가치 없음(거래·뽑기 없음). 복구 코드가 있는 프로필만 쓸 수 있다.
import { normCode } from "./profile.js";

const CLS = ["warden", "drifter", "windcaller", "trapper", "ringer"], MAX = 60000;
const LIMIT = { get: 300, put: 1500, bad: 10 }; // IP당 하루 횟수(put 은 플레이 중 1분마다)
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS sky_saves (h TEXT NOT NULL, cls TEXT NOT NULL, data TEXT NOT NULL, t INTEGER NOT NULL, updated TEXT NOT NULL, PRIMARY KEY (h, cls))"),
    db.prepare("CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)"),
  ]);
  ready = true;
}
// 하루 횟수 제한(프로필 API 와 같은 표). 'bad'(틀린 코드)는 프로필과 같은 칸을 같이 센다
async function hit(env, ip, kind, add = 1) {
  const day = kst(), tag = kind === "bad" ? `${ip}|p|bad|${day}` : `${ip}|sky|${kind}|${day}`;
  const h = (await sha(`${tag}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const r = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(h).first();
  if (r && r.n >= LIMIT[kind]) return false;
  if (add) await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(h, day).run();
  return true;
}
export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (!env.DB) return json({ error: "nodb" }, 500);
  const a = b && b.a; if (!["get", "put"].includes(a)) return json({ error: "bad" }, 400);
  await ensure(env.DB);
  const ip = request.headers.get("cf-connecting-ip") || "0";
  if (!(await hit(env, ip, "bad", 0))) return json({ error: "limit" }, 429);
  if (!(await hit(env, ip, a))) return json({ error: "limit" }, 429);
  const code = normCode(b.code), h = code && (await sha(`${code}|${env.VOTE_SALT || ""}`));
  const prof = h && (await env.DB.prepare("SELECT 1 AS ok FROM profiles WHERE h = ?").bind(h).first());
  if (!prof) { await hit(env, ip, "bad"); return json({ error: "nocode" }, 404); }
  if (a === "get") {
    const { results } = await env.DB.prepare("SELECT cls, data, t FROM sky_saves WHERE h = ?").bind(h).all();
    const saves = {}; for (const r of results || []) saves[r.cls] = { data: JSON.parse(r.data), t: r.t };
    return json({ saves });
  }
  // put: 모양만 확인(직업·버전·크기). 다른 기기가 더 나중에 저장했으면 그걸 돌려준다
  const cls = String(b.cls || ""), d = b.data;
  if (!CLS.includes(cls) || !d || typeof d !== "object" || d.v !== 1 || d.cls !== cls) return json({ error: "bad" }, 400);
  const t = Math.floor(+d.t || 0), s = JSON.stringify(d);
  if (!t || t > Date.now() + 864e5 || s.length > MAX) return json({ error: "bad" }, 400);
  const row = await env.DB.prepare("SELECT data, t FROM sky_saves WHERE h = ? AND cls = ?").bind(h, cls).first();
  if (row && row.t > t) return json({ error: "old", data: JSON.parse(row.data), t: row.t }, 409);
  if (row && row.data === s) return json({ t });
  await env.DB.prepare("INSERT INTO sky_saves (h, cls, data, t, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(h, cls) DO UPDATE SET data = excluded.data, t = excluded.t, updated = excluded.updated").bind(h, cls, s, t, kst()).run();
  return json({ t });
}
