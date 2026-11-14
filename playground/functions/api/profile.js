// 가입 없는 프로필 + 복구 코드 (2026-11-13 BK)
// POST /api/profile {a:"new", nick, data}        → {code, rev}   새 복구 코드 발급(서버엔 코드의 해시만 저장)
// POST /api/profile {a:"get", code}              → {nick, data, rev}  다른 기기에서 불러오기
// POST /api/profile {a:"put", code, nick, data, rev} → {rev}     저장(코드 아는 사람만)
// POST /api/profile {a:"del", code}              → {ok}       프로필 삭제
// POST /api/profile {a:"tester", code}           → {tester}   테스터 전용 체험판(네온 레이드·몽글숲) 입장 확인
// POST /api/profile {a:"dev", t}                 → {dev}      개발자(관리자) 확인. t = 관리자 페이지 로그인 때 받은 토큰(/api/admin a=devtoken)
// 개인정보(이메일·전화·이름) 없음. 원본 IP 저장 안 함: (IP+날짜+비밀값) 해시로 하루 시도 횟수만 센다.
import { profileNickOk } from "../../lib/nick.js";

const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 0·O·1·I 제외, 32자 → 12자리 = 60비트
const LIMIT = { tester: 300, get: 300, new: 5, put: 300, del: 10, bad: 10 }; // IP당 하루 횟수. bad = 틀린 코드 입력. get 은 페이지 열 때마다 동기화로 불려 20 이면 한 집에서 금방 막혀 300(11/14), tester 는 따로 셈
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const devToken = (k) => sha(`${k}|nr-dev`);
export function normCode(c) {
  const s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 12 && [...s].every((ch) => ABC.includes(ch)) ? s : null;
}
function newCode() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  return [...r].map((x) => ABC[x & 31]).join("");
}
// 저장 데이터 정리: 알려진 칸만, 숫자 범위 제한, 4KB 이하
export function clean(d) {
  d = d && typeof d === "object" ? d : {};
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d.last || "") ? d.last : undefined;
  // 2026-11-14: 아이템이 120개를 넘어 '전부 지급'이 잘리던 문제 → 보유 목록 500개·전체 16KB까지
  const flags = (o, re, n = 150) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([k]) => re.test(k)).slice(0, n).map(([k]) => [k, 1]));
  const out = {
    coins: Math.max(0, Math.min(199, Math.floor(+d.coins || 0))), days: Math.max(0, Math.min(100000, Math.floor(+d.days || 0))),
    streak: Math.max(0, Math.min(100000, Math.floor(+d.streak || 0))), last: day,
    skin: /^[a-z]{1,8}$/.test(d.skin || "") ? d.skin : undefined,
    des: Object.fromEntries(Object.entries(d.des && typeof d.des === "object" ? d.des : {}).filter(([g, v]) => /^[a-z]{1,12}$/.test(g) && /^[a-z]{1,12}$/.test(String(v))).slice(0, 10)),
    own: flags(d.own, /^[cdathrsng]:[a-z0-9:]{1,30}$/, 500), ach: flags(d.ach, /^[a-z0-9]{1,12}$/),
    // 코인 쓰임 1단계(2026-11-14): 칭호·출석 보호권·오늘의 미션
    title: /^[a-z0-9]{1,12}$/.test(d.title || "") ? d.title : undefined,
    // 2단계: 게임 테마(th)·꼬리 효과(trail)·사운드 팩(snd)·별명 색(nc)
    th: Object.fromEntries(Object.entries(d.th && typeof d.th === "object" ? d.th : {}).filter(([g, v]) => /^[a-z]{1,12}$/.test(g) && /^[a-z]{1,12}$/.test(String(v))).slice(0, 10)),
    trail: /^[a-z]{1,12}$/.test(d.trail || "") ? d.trail : undefined, snd: /^[a-z]{1,12}$/.test(d.snd || "") ? d.snd : undefined,
    nc: /^[a-z]{1,12}$/.test(d.nc || "") ? d.nc : undefined,
    // 게임별 미니 상점에서 고른 아이템 {"range:xh":"gold"}
    gi: Object.fromEntries(Object.entries(d.gi && typeof d.gi === "object" ? d.gi : {}).filter(([k, v]) => /^[a-z0-9]{1,12}:[a-z]{1,6}$/.test(k) && /^[a-z]{1,12}$/.test(String(v))).slice(0, 40)),
    shield: Math.max(0, Math.min(2, Math.floor(+d.shield || 0))) || undefined,
    mis: d.mis && typeof d.mis === "object" && /^\d{4}-\d{2}-\d{2}$/.test(d.mis.d || "") ? {
      d: d.mis.d, p: flags(d.mis.p, /^[a-z0-9]{1,12}$/), v: d.mis.v ? 1 : 0, r: d.mis.r ? 1 : 0, got: flags(d.mis.got, /^(p|v|r|all)$/),
    } : undefined,
  };
  // 칭호는 산 것(t:) 또는 출석 조건 무료 칭호(개근상 30일)만
  const avs = Object.keys(out.own).filter((k) => k.startsWith("a:")).length;
  if (out.title && !out.own["t:" + out.title] && !(out.title === "regular" && out.days >= 30) && !(out.title === "collector" && avs >= 30)) out.title = undefined;
  if (out.nc && !out.own["n:" + out.nc]) out.nc = undefined; // 별명 색은 산 것만(순위에 보이니까)
  return JSON.stringify(out).length <= 16000 ? out : null;
}
let ready = false;
async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS profiles (h TEXT PRIMARY KEY, nick TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1, updated TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS ptries (h TEXT PRIMARY KEY, day TEXT NOT NULL, n INTEGER NOT NULL)"),
  ]);
  ready = true;
}
// 하루 횟수 제한. 넘으면 false
async function hit(env, ip, kind, add = 1) {
  const day = kst(), h = (await sha(`${ip}|p|${kind}|${day}|${env.VOTE_SALT || ""}`)).slice(0, 32);
  const r = await env.DB.prepare("SELECT n FROM ptries WHERE h = ?").bind(h).first();
  if (r && r.n >= LIMIT[kind]) return false;
  if (add) await env.DB.prepare("INSERT INTO ptries (h, day, n) VALUES (?, ?, 1) ON CONFLICT(h) DO UPDATE SET n = n + 1").bind(h, day).run();
  return true;
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: "bad" }, 400); }
  if (!env.DB) return json({ error: "nodb" }, 500);
  await ensure(env.DB);
  const a = b && b.a, ip = request.headers.get("cf-connecting-ip") || "0", salt = env.VOTE_SALT || "";
  if (a === "dev") { // 비밀번호 원본이 아니라 그 해시 토큰만 기기에 둔다. ADMIN_KEY 를 바꾸면 모든 토큰 무효
    const k = String(env.ADMIN_KEY || ""), t = String(b.t || "");
    return json({ dev: k.length >= 10 && t.length === 64 && t === (await devToken(k)) });
  }
  if (!["new", "get", "put", "del", "tester"].includes(a)) return json({ error: "bad" }, 400);
  if (!(await hit(env, ip, "bad", 0))) return json({ error: "limit", msg: "틀린 코드를 너무 많이 넣었어요. 내일 다시 해 주세요." }, 429);
  if (!(await hit(env, ip, a))) return json({ error: "limit", msg: "오늘 요청이 너무 많아요. 내일 다시 해 주세요." }, 429);
  const today = kst();
  if (a === "new") {
    if (!profileNickOk(b.nick)) return json({ error: "nick" }, 400);
    const data = clean(b.data); if (!data) return json({ error: "bad" }, 400);
    for (let i = 0; i < 3; i++) {
      const code = newCode(), h = await sha(`${code}|${salt}`);
      const r = await env.DB.prepare("INSERT INTO profiles (h, nick, data, rev, updated) VALUES (?, ?, ?, 1, ?) ON CONFLICT(h) DO NOTHING").bind(h, b.nick, JSON.stringify(data), today).run();
      if (r.meta && r.meta.changes) {
        // 1년 넘게 안 쓴 프로필 정리(가끔만)
        if (Math.random() < 0.05) await env.DB.prepare("DELETE FROM profiles WHERE updated < date(?, '-365 day')").bind(today).run();
        await env.DB.prepare("DELETE FROM ptries WHERE day < ?").bind(today).run();
        return json({ code: code.slice(0, 4) + "-" + code.slice(4, 8) + "-" + code.slice(8), rev: 1 });
      }
    }
    return json({ error: "retry" }, 500);
  }
  const code = normCode(b.code);
  const h = code && (await sha(`${code}|${salt}`));
  const row = h && (await env.DB.prepare("SELECT nick, data, rev, updated FROM profiles WHERE h = ?").bind(h).first());
  if (!row) { await hit(env, ip, "bad"); return json({ error: "nocode", msg: "그런 복구 코드가 없어요. 다시 확인해 주세요." }, 404); }
  if (a === "get") return json({ nick: row.nick, data: JSON.parse(row.data), rev: row.rev });
  if (a === "tester") { // 테스터 전용 체험판 입장 확인(관리자 페이지에서 테스터로 지정한 프로필만)
    try { const t = await env.DB.prepare("SELECT 1 AS ok FROM testers WHERE h = ?").bind(h).first(); return json({ tester: !!t }); } catch { return json({ tester: false }); }
  }
  if (a === "del") { await env.DB.prepare("DELETE FROM profiles WHERE h = ?").bind(h).run(); try { await env.DB.prepare("DELETE FROM pscores WHERE h = ?").bind(h).run(); } catch { /* 표 없음 */ } return json({ ok: true }); }
  // put
  if (!profileNickOk(b.nick)) return json({ error: "nick" }, 400);
  const data = clean(b.data); if (!data) return json({ error: "bad" }, 400);
  if ((+b.rev || 0) < row.rev) return json({ error: "old", nick: row.nick, data: JSON.parse(row.data), rev: row.rev }, 409); // 다른 기기가 먼저 저장함 → 최신 걸 돌려줌
  // 바뀐 게 없으면 쓰지 않는다(D1 쓰기 절약, 2026-11-14)
  if (b.nick === row.nick && JSON.stringify(data) === row.data && row.updated === today) return json({ rev: row.rev });
  const rev = row.rev + 1;
  if (Math.random() < 0.01) await env.DB.prepare("DELETE FROM ptries WHERE day < ?").bind(today).run();
  await env.DB.prepare("UPDATE profiles SET nick = ?, data = ?, rev = ?, updated = ? WHERE h = ?").bind(b.nick, JSON.stringify(data), rev, today, h).run();
  if (b.nick !== row.nick) { try { await env.DB.prepare("UPDATE testers SET nick = ? WHERE h = ?").bind(b.nick, h).run(); } catch { /* testers 표 없음 = 테스터 없음 */ } }
  return json({ rev });
}
