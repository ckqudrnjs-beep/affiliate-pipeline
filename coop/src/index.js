// 네온 레이드 협동 방 (2~4명). 서버는 메시지만 전달하고 게임 계산은 방장 브라우저가 한다.
// 사이트(Pages Function /api/coop)가 바인딩으로 이 Durable Object 에 웹소켓을 넘긴다. Worker 주소는 공개하지 않음(workers_dev=false).
// 방 1개 = DO 1개(방 코드 이름). 웹소켓 휴면 API 를 써서 조용할 땐 비용이 거의 안 든다.
const MAX = 4, MSG_MAX = 6000;

export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  peers() { return this.ctx.getWebSockets().map((ws) => ({ ws, a: ws.deserializeAttachment() || {} })).filter((p) => p.a.id); }
  hostId() { const l = this.peers().sort((x, y) => x.a.j - y.a.j); return l.length ? l[0].a.id : null; }
  send(ws, o) { try { ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch { /* 끊긴 연결 */ } }
  cast(o, except) { const s = JSON.stringify(o); for (const p of this.peers()) if (p.ws !== except) this.send(p.ws, s); }

  async fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
    const u = new URL(req.url), list = this.peers();
    const name = String(u.searchParams.get("n") || "").slice(0, 16) || "모험가", cls = String(u.searchParams.get("c") || "knight").slice(0, 12);
    const started = (await this.ctx.storage.get("started")) && list.length > 0;
    if (list.length >= MAX) return new Response(JSON.stringify({ error: "full" }), { status: 409 });
    if (started) return new Response(JSON.stringify({ error: "started" }), { status: 409 });
    if (!list.length) await this.ctx.storage.delete("started");
    const pair = new WebSocketPair(), [client, server] = Object.values(pair);
    const id = crypto.randomUUID().slice(0, 8), a = { id, name, cls, j: Date.now() };
    this.ctx.acceptWebSocket(server); server.serializeAttachment(a);
    const host = this.hostId();
    this.send(server, { k: "hello", id, host, peers: list.map((p) => ({ id: p.a.id, name: p.a.name, cls: p.a.cls })) });
    this.cast({ k: "join", id, name, cls, host }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    if (typeof msg !== "string" || msg.length > MSG_MAX) return;
    const a = ws.deserializeAttachment() || {}; if (!a.id) return;
    let o; try { o = JSON.parse(msg); } catch { return; }
    if (!o || typeof o.k !== "string") return;
    if (o.k === "cls") { a.cls = String(o.c || "knight").slice(0, 12); ws.serializeAttachment(a); }
    if (o.k === "start") { if (this.hostId() !== a.id) return; await this.ctx.storage.put("started", 1); }
    if (o.k === "ping") { this.send(ws, { k: "pong", t: o.t }); return; }
    o.f = a.id;
    if (o.to) { const p = this.peers().find((q) => q.a.id === o.to); if (p) this.send(p.ws, o); return; }
    this.cast(o, ws);
  }

  async webSocketClose(ws) { this.leave(ws); }
  async webSocketError(ws) { this.leave(ws); }
  async leave(ws) {
    const a = ws.deserializeAttachment() || {}; ws.serializeAttachment({}); try { ws.close(1000, "bye"); } catch { /* 이미 닫힘 */ }
    if (!a.id) return;
    const host = this.hostId(); this.cast({ k: "leave", id: a.id, host });
    if (!host) await this.ctx.storage.delete("started");
  }
}

export default {
  async fetch(req, env) {
    // 사이트 Function 이 바인딩으로만 부른다. 직접 주소로 와도 방 코드 형식만 맞으면 같은 방(공개 주소는 꺼 둠).
    const u = new URL(req.url), m = u.pathname.match(/^\/room\/([A-Z0-9]{4,6})$/);
    if (!m) return new Response("not found", { status: 404 });
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  },
};
