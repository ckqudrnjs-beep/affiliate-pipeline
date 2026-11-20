// 텔레그램에서 방문자 수 바로 보기 (2026-11-20 BK). BK 개인 대화에서 "방문자" 라고 보내면 바로 답한다.
// - 텔레그램이 이 주소(https://5raksil.com/api/tg)로 메시지를 넘겨준다(웹훅). 늘 켜져 있고 추가 비용 없음(Pages Functions 무료 한도 안).
// - 웹훅 등록은 Actions `tg-webhook`(수동 1회). 그때 텔레그램에 '비밀 머리글'을 함께 등록하고, 여기서 그 값이 맞을 때만 받는다.
//   비밀값은 봇 토큰에서 계산(tgSecret)하므로 따로 만들 값이 없다. 토큰이 없거나 틀리면 아무것도 안 함.
// - BK 대화(TELEGRAM_ADMIN_CHAT_ID)가 아니면 숫자를 절대 안 보여 준다(답도 안 함).
// - 답은 웹훅 응답 본문으로 바로 보낸다(sendMessage 를 따로 부르지 않음 → 바깥 요청 0번).
// - 숫자는 /admin 과 같은 순 방문자(같은 IP 하루 1명, visit.js visitStats). 읽기만 한다.
import { visitStats } from "./visit.js";

const ok = () => new Response("ok", { status: 200 });
const reply = (chat_id, text) => new Response(JSON.stringify({ method: "sendMessage", chat_id, text, disable_web_page_preview: true }), {
  status: 200, headers: { "content-type": "application/json; charset=utf-8" },
});

export async function tgSecret(token) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${token}|tg-webhook`));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 40);
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const KST = (ms = Date.now()) => new Date(ms + 9 * 3600e3);
const md = (day) => `${+day.slice(5, 7)}/${+day.slice(8, 10)}`;
const fmt = (n) => Number(n || 0).toLocaleString("en-US");

// 무엇을 물었는지: 요약 / 날짜별 / 도움말
export function intent(text) {
  const t = String(text || "").trim().toLowerCase().replace(/@\w+$/, "");
  if (/7일|일주일|주간|날짜|^\/?(days?|week|v7)$/.test(t)) return "days";
  if (/방문|손님|숫자|지금|^\/?(visitors?|v|start|stats)$/.test(t)) return "sum";
  return "help";
}

export function render(kind, raksil, d3, now = KST()) {
  const hh = `${now.getUTCMonth() + 1}/${now.getUTCDate()} ${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  if (kind === "help") return "보낼 수 있는 말\n• 방문자 → 오늘·어제·7일·30일\n• 7일 → 최근 7일 날짜별";
  if (kind === "days") {
    const get = (s, day) => { const r = (s.days || []).find((x) => x.day === day); return fmt(r ? r.n : 0); };
    const lines = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(now.getTime() - i * 864e5).toISOString().slice(0, 10);
      lines.push(`${md(day)}${i === 0 ? "(오늘)" : ""}  🎮 ${get(raksil, day)} · 🪙 ${get(d3, day)}`);
    }
    return `📅 최근 7일 방문자 (${hh} 기준)\n🎮 5락실 · 🪙 돈삼촌\n${lines.join("\n")}`;
  }
  const one = (name, s) => `${name}\n  오늘 ${fmt(s.today)} · 어제 ${fmt(s.yday)}\n  7일 ${fmt(s.d7)} · 30일 ${fmt(s.d30)}`;
  return `📊 방문자 (${hh} 기준)\n${one("🎮 5락실", raksil)}\n${one("🪙 돈삼촌", d3)}\n\n같은 사람은 하루 1명으로 셈 · "7일" 보내면 날짜별`;
}

export async function onRequestPost({ request, env }) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const admin = String(env.TELEGRAM_ADMIN_CHAT_ID || "").trim();
  // 연결 점검용 상태 코드(tg-webhook info 의 '마지막 오류'에 그대로 보임): 503 = Cloudflare 변수 없음, 401 = 토큰이 GitHub 것과 다름
  if (token.length < 20 || !admin) return new Response(null, { status: 503 });
  if (!same(request.headers.get("x-telegram-bot-api-secret-token") || "", await tgSecret(token))) return new Response(null, { status: 401 });
  let u;
  try { u = await request.json(); } catch { return ok(); }
  const m = u && u.message;
  if (!m || !m.chat || m.chat.type !== "private" || String(m.chat.id) !== admin) return ok(); // BK 말고는 무시
  if (!env.DB) return reply(m.chat.id, "서버 DB 연결이 없어요(관리자 확인 필요).");
  const kind = intent(m.text);
  if (kind === "help") return reply(m.chat.id, render("help"));
  try {
    const [r, d] = [await visitStats(env.DB, "raksil"), await visitStats(env.DB, "d3")];
    return reply(m.chat.id, render(kind, r, d));
  } catch (e) {
    return reply(m.chat.id, "지금 숫자를 못 읽었어요(서버가 잠시 바쁨). 조금 뒤 다시 보내 주세요.");
  }
}

export const onRequestGet = () => new Response(null, { status: 404 });
