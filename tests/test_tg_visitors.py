"""텔레그램 방문자 조회(playground/functions/api/tg.js, 2026-11-20): BK 대화·비밀 머리글일 때만 숫자를 답한다."""
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

JS = r"""
const tg = await import(process.argv[1]);
const tok = "123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const sec = await tg.tgSecret(tok);
const db = { prepare(q){ const o={bind(){return o;},
  async first(){ if(q.includes("COUNT(*)")) return {n: q.includes("d3_")?4:23}; if(q.includes("MIN")) return {d:"2026-11-15"}; return null;},
  async all(){ return {results: []};}, async run(){return {};} }; return o; }, async batch(){} };
const env = { TELEGRAM_BOT_TOKEN: tok, TELEGRAM_ADMIN_CHAT_ID: "777", DB: db };
const mk = (text, chat, s) => new Request("https://5raksil.com/api/tg", {method:"POST",
  headers: s?{"x-telegram-bot-api-secret-token": s}:{}, body: JSON.stringify({message:{chat:{id:chat,type:"private"},text}})});
const out = {sec};
for (const [k,t,c,s] of [["ok","방문자",777,sec],["days","7일",777,sec],["other","방문자",999,sec],["bad","방문자",777,"x"]]) {
  const r = await tg.onRequestPost({request: mk(t,c,s), env}); const b = await r.text();
  out[k] = {st: r.status, text: b.startsWith("{") ? JSON.parse(b).text : b};
}
console.log(JSON.stringify(out));
"""


@unittest.skipUnless(shutil.which("node"), "node 없음")
class TgVisitors(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import json
        p = (ROOT / "playground/functions/api/tg.js").as_uri()
        r = subprocess.run(["node", "--input-type=module", "-e", JS, p], capture_output=True, text=True, check=True)
        cls.o = json.loads(r.stdout)

    def test_admin_gets_numbers(self):
        self.assertEqual(self.o["ok"]["st"], 200)
        self.assertIn("5락실", self.o["ok"]["text"])
        self.assertIn("오늘 23", self.o["ok"]["text"])
        self.assertIn("오늘 4", self.o["ok"]["text"])
        self.assertIn("(오늘)", self.o["days"]["text"])

    def test_others_get_nothing(self):
        self.assertNotIn("23", self.o["other"]["text"])
        self.assertEqual(self.o["bad"]["st"], 404)

    def test_secret_same_as_python(self):
        import tg_webhook
        self.assertEqual(tg_webhook.secret("123456:ABCDEFGHIJKLMNOPQRSTUVWXYZ"), self.o["sec"])


if __name__ == "__main__":
    unittest.main()
