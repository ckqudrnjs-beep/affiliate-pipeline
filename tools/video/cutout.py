"""상품 사진 배경 지우기 (2026-11-09): video_assets/<slug>/<사진> → video_assets/<slug>/cutout.png (RGBA).

    python tools/video/cutout.py baseus-led-desk-lamp 01.jpg --keep 215,400 --erase 48,19,212,137

--keep x,y   : 남길 상품 위의 한 점 (같은 덩어리만 남기고 노트북·컵 등은 버린다)
--erase 상자 : 지울 영역 (로고·글자). 상품을 가린 로고는 지운 뒤 손으로 이어 그려야 할 수 있다.
필요: pip install rembg onnxruntime scipy, 모델 isnet-general-use (~/.u2net/isnet-general-use.onnx).
판매자 사진(알리 공식 API로 받은 것)만 쓴다.
"""
import argparse
import pathlib

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy import ndimage

ROOT = pathlib.Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("image")
ap.add_argument("--keep", action="append", default=[])
ap.add_argument("--erase", action="append", default=[])
a = ap.parse_args()
d = ROOT / "video_assets" / a.slug
cut = np.array(remove(Image.open(d / a.image).convert("RGB"), session=new_session("isnet-general-use")))
for e in a.erase:
    x0, y0, x1, y1 = map(int, e.split(","))
    cut[y0:y1, x0:x1, 3] = 0
if a.keep:
    lab, _ = ndimage.label(cut[:, :, 3] > 128)
    ids = [lab[int(y), int(x)] for x, y in (k.split(",") for k in a.keep)]
    cut[:, :, 3] = np.where(ndimage.binary_dilation(np.isin(lab, ids), iterations=3), cut[:, :, 3], 0)
im = Image.fromarray(cut)
im.crop(im.getbbox()).save(d / "cutout.png")
print(d / "cutout.png")
