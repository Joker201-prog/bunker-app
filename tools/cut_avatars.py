"""Вырезает аватары из общего листа tools/avatars-sheet.jpg в assets/ui/avatar_*.jpg.
Запуск: python3 tools/cut_avatars.py"""
import os
from PIL import Image

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "assets", "ui")
sheet = Image.open(os.path.join(HERE, "avatars-sheet.jpg")).convert("RGB")
K = sheet.width / 1932  # координаты сняты с превью шириной 1932

# (пол, левый, верх, правый, низ) — внутренняя часть рамки на превью
BOXES = [
    ("m", 94, 272, 472, 674),
    ("f", 511, 272, 842, 674),
    ("m", 870, 272, 1178, 674),
    ("f", 1200, 272, 1424, 674),
    ("m", 1462, 272, 1842, 674),
    ("f", 94, 846, 477, 1234),
    ("m", 542, 846, 930, 1234),
    ("f", 1002, 864, 1391, 1285),
    ("m", 1454, 864, 1841, 1284),
    ("f", 339, 1407, 715, 1816),
    ("m", 777, 1407, 1158, 1816),
    ("f", 1221, 1407, 1601, 1816),
]

ASPECT = 5 / 6  # ширина / высота, как у фото в досье
counts = {"m": 0, "f": 0}
for sex, l, t, r, b in BOXES:
    l, t, r, b = (round(v * K) for v in (l, t, r, b))
    w, h = r - l, b - t
    # Подгоняем под пропорции 5:6, обрезая по центру
    if w / h > ASPECT:
        nw = round(h * ASPECT)
        l += (w - nw) // 2
        w = nw
    else:
        nh = round(w / ASPECT)
        t += (h - nh) // 2
        h = nh
    img = sheet.crop((l, t, l + w, t + h)).resize((250, 300), Image.LANCZOS)
    img.save(os.path.join(OUT, f"avatar_{sex}{counts[sex]}.jpg"), quality=88)
    counts[sex] += 1
print(counts)
