"""상품 사용 장면 영상 일괄 생성 (BK 노트북에서 실행, 2026-11-09).

ComfyUI Desktop(Wan 2.2 5B) 로컬 API로 data/products 의 상품마다 클립 A·B 후보를 만들고,
BK가 브라우저에서 고른 것만 10초·3MB 이하로 마감해 static/video/<slug>.mp4 와 videoUrl 에 넣는다.

    python tools/video/video_batch.py generate [slug ...]   # 후보 생성 (노트북 켜 둔 채로, 상품당 30~60분)
    python tools/video/video_batch.py review                # 브라우저에서 A·B 하나씩 고르기
    python tools/video/video_batch.py finish                # 고른 것 마감 → 사이트 폴더·쇼츠 폴더

필요한 것: ComfyUI Desktop 실행 중, tools/video/wan22_api.json (템플릿을 "API 형식으로 내보내기"),
ffmpeg (finish 단계), Pillow (있으면 상품 사진을 영상 비율에 맞게 여백 처리).
외부 서비스에 로그인하거나 게시하지 않는다. 계정·키를 쓰지 않는다.
"""
from __future__ import annotations

import http.server
import json
import os
import pathlib
import random
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = ROOT / "tools" / "video"
WORK = ROOT / "video_work"  # 후보·마감 결과 (git 에 올리지 않음)
COMFY = os.environ.get("COMFY_URL", "http://127.0.0.1:8000")
W, H, FRAMES = 1280, 704, 121  # Wan 2.2 5B 기본 720p, 121프레임 ≈ 5초(24fps)
TAKES = int(os.environ.get("VIDEO_TAKES", 2))  # 클립마다 후보 수
CLIP_SEC = 4.3  # 클립 A·B 각각 사용 길이 → 8.6초 + 끝 화면 1.4초 = 10초
DISCLOSURE = "광고 · 알리익스프레스 제휴 링크"
AI_LABEL = "AI로 만든 사용 예시 장면"


# ---------- ComfyUI API ----------
def _req(path: str, data: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(COMFY + path, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def upload_image(path: pathlib.Path) -> str:
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{path.name}\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + path.read_bytes() + \
           f"\r\n--{b}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n--{b}--\r\n".encode()
    r = json.loads(_req("/upload/image", body, {"Content-Type": f"multipart/form-data; boundary={b}"}))
    return r["name"]


def prepare_workflow(wf: dict, image_name: str, positive: str, negative: str, prefix: str) -> dict:
    wf = json.loads(json.dumps(wf))
    by = lambda cls: [k for k, n in wf.items() if n.get("class_type") == cls]
    ks = (by("KSampler") or by("KSamplerAdvanced"))
    if not ks or not by("LoadImage"):
        sys.exit("wan22_api.json 에서 KSampler/LoadImage 노드를 못 찾았어요. 이미지→비디오 템플릿을 API 형식으로 다시 내보내 주세요.")
    k = wf[ks[0]]["inputs"]
    wf[k["positive"][0]]["inputs"]["text"] = positive
    wf[k["negative"][0]]["inputs"]["text"] = negative
    k["seed" if "seed" in k else "noise_seed"] = random.randint(1, 2**48)
    for nid in by("LoadImage"):
        wf[nid]["inputs"]["image"] = image_name
    for nid in by("Wan22ImageToVideoLatent"):
        wf[nid]["inputs"].update(width=W, height=H, length=FRAMES)
    for nid in by("SaveVideo") + by("SaveAnimatedWEBP") + by("VHS_VideoCombine"):
        wf[nid]["inputs"]["filename_prefix"] = prefix
    return wf


def run(wf: dict) -> list[dict]:
    pid = json.loads(_req("/prompt", json.dumps({"prompt": wf, "client_id": "don3chon"}).encode(),
                          {"Content-Type": "application/json"}))["prompt_id"]
    while True:
        time.sleep(float(os.environ.get("POLL_SEC", 10)))
        h = json.loads(_req(f"/history/{pid}")).get(pid)
        if not h:
            continue
        if h.get("status", {}).get("status_str") == "error":
            raise RuntimeError(f"ComfyUI 오류: {h['status'].get('messages', '')[-1:]}")
        files = [f for out in h.get("outputs", {}).values() for lst in out.values() if isinstance(lst, list)
                 for f in lst if isinstance(f, dict) and str(f.get("filename", "")).endswith((".mp4", ".webm"))]
        if files:
            return files


def download(f: dict, dest: pathlib.Path) -> None:
    q = urllib.parse.urlencode({"filename": f["filename"], "subfolder": f.get("subfolder", ""), "type": f.get("type", "output")})
    dest.write_bytes(_req(f"/view?{q}"))


# ---------- 단계 ----------
def products() -> dict[str, dict]:
    out = {}
    for p in sorted((ROOT / "data" / "products").glob("*.json")):
        d = json.loads(p.read_text(encoding="utf-8"))
        if d.get("status", "active") == "active" and d.get("imageUrl"):
            out[d["slug"]] = d
    return out


def fit_image(url: str, dest: pathlib.Path) -> None:
    """상품 사진을 1280×704 에 잘리지 않게 넣는다 (빈 곳은 사진 모서리 색)."""
    raw = dest.with_suffix(".src")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw.write_bytes(urllib.request.urlopen(req, timeout=30).read())
    try:
        from PIL import Image
    except ImportError:
        shutil.copy(raw, dest)
        return
    im = Image.open(raw).convert("RGB")
    im.thumbnail((int(W * 0.9), int(H * 0.9)))
    bg = Image.new("RGB", (W, H), im.getpixel((2, 2)))
    bg.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    bg.save(dest)


def generate(slugs: list[str]) -> None:
    wf_path = HERE / "wan22_api.json"
    if not wf_path.exists():
        sys.exit(f"{wf_path} 가 없어요. ComfyUI 에서 Wan 2.2 5B 템플릿을 열고 '내보내기 → API' 로 이 경로에 저장해 주세요.")
    wf = json.loads(wf_path.read_text(encoding="utf-8"))
    prompts = json.loads((HERE / "prompts.json").read_text(encoding="utf-8"))
    ps = products()
    for slug in slugs or [s for s in ps if s in prompts]:
        if slug not in prompts:
            print(f"건너뜀 {slug}: prompts.json 에 프롬프트가 없음")
            continue
        d = WORK / slug
        d.mkdir(parents=True, exist_ok=True)
        img = d / "first.png"
        if not img.exists():
            fit_image(ps[slug]["imageUrl"], img)
        name = upload_image(img)
        for clip in ("A", "B"):
            for t in range(1, TAKES + 1):
                dest = d / f"{clip}{t}.mp4"
                if dest.exists():
                    continue
                pos = f"{prompts['_style']} {prompts[slug][clip]}"
                print(f"[{time.strftime('%H:%M')}] {slug} {clip}{t} 생성 중...", flush=True)
                files = run(prepare_workflow(wf, name, pos, prompts["_negative"], f"don3chon/{slug}_{clip}{t}"))
                download(files[0], dest)
    print("끝. 이제 review 로 고르세요.")


REVIEW_HTML = """<!doctype html><meta charset=utf-8><title>영상 고르기</title>
<style>body{font-family:sans-serif;margin:20px;background:#f6f4ef}h2{margin:28px 0 8px}video{width:320px;margin:4px;border:4px solid transparent;border-radius:8px;cursor:pointer}
video.on{border-color:#2f7d5b}.row{display:flex;flex-wrap:wrap;align-items:center}b{width:30px}</style>
<p>상품마다 A 한 개, B 한 개를 눌러 고르세요 (초록 테두리). 모양·기능이 사진과 다르거나 손이 이상하면 고르지 마세요. 고르면 바로 저장돼요.</p>
<div id=x></div><script>
fetch('/data').then(r=>r.json()).then(d=>{const x=document.getElementById('x');
for(const [slug,c] of Object.entries(d.cands)){let h=`<h2>${d.names[slug]||slug}</h2>`;
 for(const k of ['A','B']) h+=`<div class=row><b>${k}</b>`+c.filter(f=>f[0]==k).map(f=>`<video muted loop autoplay playsinline src="/v/${slug}/${f}" data-s="${slug}" data-k="${k}" data-f="${f}" class="${(d.picks[slug]||{})[k]==f?'on':''}"></video>`).join('')+`</div>`;
 x.insertAdjacentHTML('beforeend',h);}
document.querySelectorAll('video').forEach(v=>v.onclick=()=>{document.querySelectorAll(`video[data-s="${v.dataset.s}"][data-k="${v.dataset.k}"]`).forEach(o=>o.classList.remove('on'));v.classList.add('on');
 fetch('/pick',{method:'POST',body:JSON.stringify(v.dataset)})});});
</script>"""


def review() -> None:
    picks_path = WORK / "picks.json"
    names = {s: p["name"] for s, p in products().items()}

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, body: bytes, ctype: str):
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/":
                return self._send(REVIEW_HTML.encode(), "text/html; charset=utf-8")
            if self.path == "/data":
                cands = {d.name: c for d in sorted(WORK.iterdir()) if d.is_dir() and (c := sorted(f.name for f in d.glob("[AB]*.mp4")))}
                picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}
                return self._send(json.dumps({"cands": cands, "picks": picks, "names": names}).encode(), "application/json")
            if self.path.startswith("/v/"):
                f = (WORK / urllib.parse.unquote(self.path[3:])).resolve()
                if WORK.resolve() in f.parents and f.exists():
                    return self._send(f.read_bytes(), "video/mp4")
            self.send_error(404)

        def do_POST(self):
            d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            picks = json.loads(picks_path.read_text()) if picks_path.exists() else {}
            picks.setdefault(d["s"], {})[d["k"]] = d["f"]
            picks_path.write_text(json.dumps(picks, ensure_ascii=False, indent=1))
            self._send(b"ok", "text/plain")

    srv = http.server.HTTPServer(("127.0.0.1", 8765), H)
    print("브라우저에서 http://127.0.0.1:8765 를 여세요. 다 고르면 이 창에서 Ctrl+C.")
    import webbrowser
    webbrowser.open("http://127.0.0.1:8765")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


def _font() -> str:
    for f in (os.environ.get("VIDEO_FONT", ""), "C:/Windows/Fonts/malgunbd.ttf", "C:/Windows/Fonts/malgun.ttf",
              "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf"):
        if f and pathlib.Path(f).exists():
            return f.replace(":", "\\:")
    sys.exit("한글 폰트를 못 찾았어요. VIDEO_FONT 환경변수로 .ttf/.otf 경로를 알려 주세요.")


def _txt(d: pathlib.Path, name: str, text: str) -> str:
    p = d / name
    p.write_text(text, encoding="utf-8")
    return p.as_posix().replace(":", "\\:")


def finish() -> None:
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg 가 없어요. 'winget install Gyan.FFmpeg' 로 설치한 뒤 새 창에서 다시 실행해 주세요.")
    picks = json.loads((WORK / "picks.json").read_text())
    ps, font = products(), _font()
    for slug, pk in picks.items():
        if not {"A", "B"} <= pk.keys() or slug not in ps:
            print(f"건너뜀 {slug}: A·B 둘 다 골라야 해요")
            continue
        d = WORK / slug
        label = _txt(d, "label.txt", AI_LABEL)
        end1 = _txt(d, "end1.txt", ps[slug]["name"])
        end2 = _txt(d, "end2.txt", DISCLOSURE)
        end = f"enable='gte(t,{2 * CLIP_SEC})'"
        dt = lambda tf, size, y, extra="": (f"drawtext=fontfile='{font}':textfile='{tf}':fontsize={size}:fontcolor=white:"
                                           f"x=(w-text_w)/2:y={y}{extra}")
        em = sum(1.0 if ord(c) > 0x1100 else 0.6 for c in ps[slug]["name"])  # 상품명 폭(글자 크기 배수)
        name_size = lambda k, width: int(min(46 * k, width * 0.9 / em))
        texts = lambda k, width: (f"{dt(label, int(26 * k), f'h-{int(56 * k)}', ':box=1:boxcolor=black@0.45:boxborderw=10')},"
                           f"{dt(end1, name_size(k, width), f'h/2-{int(70 * k)}', ':' + end)},{dt(end2, int(34 * k), f'h/2+{int(20 * k)}', ':' + end)}")
        base = (f"[0:v]trim=0:{CLIP_SEC},setpts=PTS-STARTPTS,fps=24,scale={W}:{H}[a];"
                f"[1:v]trim=0:{CLIP_SEC},setpts=PTS-STARTPTS,fps=24,scale={W}:{H}[b];"
                f"color=c=0x1f2a2e:s={W}x{H}:d=1.4:r=24[e];[a][b][e]concat=n=3:v=1:a=0[v]")
        outs = {
            # 사이트 카드 4:3 (가운데 자르기)
            ROOT / "static" / "video" / f"{slug}.mp4": f"[v]scale=-2:720,crop=960:720,{texts(1, 960)}[o]",
            # 쇼츠 9:16: 가운데 정사각형을 크게, 뒤는 흐린 배경
            WORK / "shorts" / f"{slug}.mp4": ("[v]split[v1][v2];[v1]scale=-2:1920,crop=1080:1920,boxblur=30[bg];"
                                              f"[v2]crop={H}:{H},scale=1080:1080[fg];[bg][fg]overlay=0:(H-h)/2,{texts(1.6, 1080)}[o]"),
        }
        for out, tail in outs.items():
            out.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(d / pk["A"]), "-i", str(d / pk["B"]),
                            "-filter_complex", base + ";" + tail, "-map", "[o]", "-an", "-c:v", "libx264",
                            "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                            "-t", "10", str(out)], check=True)
        mb = (ROOT / "static" / "video" / f"{slug}.mp4").stat().st_size / 1e6
        pj = ROOT / "data" / "products" / f"{slug}.json"
        data = json.loads(pj.read_text(encoding="utf-8"))
        data["videoUrl"] = f"video/{slug}.mp4"
        pj.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"완료 {slug}: 사이트 {mb:.1f}MB, 쇼츠 {WORK / 'shorts' / (slug + '.mp4')}")
    print("유튜브에 올릴 땐 '변경되거나 합성된 콘텐츠'와 '유료 프로모션 포함'을 체크하세요.")


if __name__ == "__main__":
    cmd, *rest = sys.argv[1:] or ["help"]
    {"generate": lambda: generate(rest), "review": review, "finish": finish}.get(cmd, lambda: print(__doc__))()
