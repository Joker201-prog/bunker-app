"""Генерирует текстуры интерфейса «досье на деревянном столе».
Запуск: python3 tools/make_textures.py  (нужны numpy и Pillow)."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "ui")
rng = np.random.default_rng(7)


def smooth_noise(h, w, scale, seed):
    r = np.random.default_rng(seed)
    gh, gw = max(2, h // scale + 2), max(2, w // scale + 2)
    g = r.random((gh, gw)).astype(np.float32)
    img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img).astype(np.float32) / 255.0


# ---------- Дерево: горизонтальные доски, вытянутые волокна, виньетка ----------
def aniso(h, w, sy, sx, seed):
    """Шум, вытянутый по горизонтали: мелкий по вертикали (sy), крупный по горизонтали (sx)."""
    r = np.random.default_rng(seed)
    g = r.random((max(2, h // sy + 2), max(2, w // sx + 2))).astype(np.float32)
    img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img).astype(np.float32) / 255.0


def wood(w=1080, h=2340):
    base = np.array([112, 74, 46], np.float32)
    img = np.zeros((h, w, 3), np.float32)
    y = np.arange(h)[:, None].astype(np.float32)
    x = np.arange(w)[None, :].astype(np.float32)
    plank_h = 250
    for i, top in enumerate(range(0, h, plank_h)):
        bot = min(h, top + plank_h)
        ph = bot - top
        tone = 0.8 + 0.35 * rng.random()
        streak = aniso(ph, w, 3, 140, 10 + i)          # тонкие длинные полосы
        band = aniso(ph, w, 14, 260, 20 + i)           # широкие полосы
        fine = aniso(ph, w, 1, 30, 30 + i)             # мелкая фактура
        # редкие изогнутые годовые кольца
        warp = aniso(ph, w, 60, 400, 40 + i) * 30
        rings = np.sin((y[top:bot] - top + warp) / (9 + rng.random() * 6))
        rings = np.clip(rings, 0.9, 1) * 10 - 9
        v = tone * (0.72 + 0.20 * (streak - 0.5) + 0.22 * (band - 0.5) + 0.10 * (fine - 0.5) - 0.10 * rings)
        img[top:bot] = base[None, None, :] * v[..., None]
        img[top:top + 3] *= 0.22
        img[top + 3:top + 5] *= 0.55
        img[top + 5:top + 8] *= 1.08
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(70):  # царапины
        x0, y0 = rng.integers(0, w), rng.integers(0, h)
        ln = rng.integers(20, 120)
        a = rng.normal(0, 0.2)
        c = int(rng.integers(105, 130))
        d.line([x0, y0, x0 + ln * math.cos(a), y0 + ln * math.sin(a)], fill=(c, int(c * 0.72), int(c * 0.48)), width=1)
    arr = np.asarray(im).astype(np.float32)
    cx, cy = w / 2, h / 2
    r = np.sqrt(((x - cx) / (w * 0.75)) ** 2 + ((y - cy) / (h * 0.62)) ** 2)
    vig = np.clip(1.10 - r ** 2 * 0.75, 0.3, 1.1)
    lamp = np.exp(-(((x - w * 0.95) / (w * 0.55)) ** 2 + ((y - h * 0.02) / (h * 0.22)) ** 2))
    arr = arr * vig[..., None] + lamp[..., None] * np.array([70, 45, 15], np.float32)
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "wood.jpg"), quality=82)


# ---------- Бумага: бесшовная плитка, волокна и лёгкие пятна ----------
def paper(size=512):
    base = np.array([226, 211, 178], np.float32)
    n1 = rng.normal(0, 1, (size, size)).astype(np.float32)
    n1 = np.asarray(Image.fromarray(((n1 * 20) + 128).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) - 128
    # низкочастотный шум, свёрнутый по краям, чтобы плитка была бесшовной
    low = rng.normal(0, 1, (size // 32, size // 32)).astype(np.float32)
    low = np.tile(low, (3, 3))
    lowi = Image.fromarray(((low * 30) + 128).clip(0, 255).astype(np.uint8)).resize((size * 3, size * 3), Image.BICUBIC)
    low = np.asarray(lowi).astype(np.float32)[size:2 * size, size:2 * size] - 128
    v = 1 + n1 / 255 * 0.45 + low / 255 * 0.12
    arr = base[None, None, :] * v[..., None]
    im = Image.fromarray(arr.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for _ in range(260):  # волокна
        x0, y0 = rng.integers(0, size), rng.integers(0, size)
        a = rng.random() * math.pi
        ln = rng.integers(4, 14)
        c = int(rng.integers(185, 215))
        d.line([x0, y0, x0 + ln * math.cos(a), y0 + ln * math.sin(a)], fill=(c, c - 14, c - 40), width=1)
    im.save(os.path.join(OUT, "paper.jpg"), quality=88)


# ---------- Силуэты на старом фото ----------
def silhouette(kind, idx, w=300, h=360):
    S = 2
    W, H = w * S, h * S
    r = np.random.default_rng(1000 + idx)
    # фон: выцветший серо-бежевый градиент студийной фотографии
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    light = 1 - 0.55 * ((x - 0.5) ** 2 + (y - 0.35) ** 2)
    tone = np.array([[176, 164, 140], [160, 160, 152], [170, 158, 146]][idx % 3], np.float32)
    bg = tone[None, None, :] * light[..., None]
    im = Image.fromarray(bg.clip(0, 255).astype(np.uint8)).convert("RGBA")
    sil = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(sil)
    cx = W / 2 + r.normal(0, W * 0.015)
    head_w, head_h = W * 0.34, H * 0.33
    hy = H * 0.43
    # плечи
    d.ellipse([cx - W * 0.50, H * 0.68, cx + W * 0.50, H * 1.40], fill=255)
    # шея
    d.rounded_rectangle([cx - W * 0.10, hy + head_h * 0.25, cx + W * 0.10, H * 0.76], radius=W * 0.04, fill=255)
    # голова
    d.ellipse([cx - head_w / 2, hy - head_h / 2, cx + head_w / 2, hy + head_h / 2], fill=255)
    hair = idx % 3
    if kind == "m":
        if hair == 0:  # короткая стрижка
            d.ellipse([cx - head_w * 0.53, hy - head_h * 0.58, cx + head_w * 0.53, hy + head_h * 0.05], fill=255)
        elif hair == 1:  # кепка
            d.chord([cx - head_w * 0.56, hy - head_h * 0.68, cx + head_w * 0.56, hy + head_h * 0.10], 180, 360, fill=255)
            d.rectangle([cx - head_w * 0.62, hy - head_h * 0.30, cx + head_w * 0.62, hy - head_h * 0.20], fill=255)
        else:  # борода
            d.ellipse([cx - head_w * 0.5, hy - head_h * 0.56, cx + head_w * 0.5, hy], fill=255)
            d.ellipse([cx - head_w * 0.46, hy, cx + head_w * 0.46, hy + head_h * 0.68], fill=255)
    else:
        if hair == 0:  # длинные волосы
            d.ellipse([cx - head_w * 0.62, hy - head_h * 0.62, cx + head_w * 0.62, hy + head_h * 0.35], fill=255)
            d.rectangle([cx - head_w * 0.66, hy, cx + head_w * 0.66, H * 0.80], fill=255)
        elif hair == 1:  # каре
            d.ellipse([cx - head_w * 0.62, hy - head_h * 0.62, cx + head_w * 0.62, hy + head_h * 0.45], fill=255)
            d.rectangle([cx - head_w * 0.62, hy, cx + head_w * 0.62, hy + head_h * 0.48], fill=255)
        else:  # пучок
            d.ellipse([cx - head_w * 0.54, hy - head_h * 0.6, cx + head_w * 0.54, hy + head_h * 0.1], fill=255)
            d.ellipse([cx - head_w * 0.24, hy - head_h * 0.98, cx + head_w * 0.24, hy - head_h * 0.45], fill=255)
    sil = sil.filter(ImageFilter.GaussianBlur(W * 0.006))
    dark = Image.new("RGBA", (W, H), (34, 30, 27, 255))
    im = Image.composite(dark, im, sil)
    # зерно, сепия, выцветшие края
    arr = np.asarray(im.convert("RGB")).astype(np.float32)
    arr += r.normal(0, 9, arr.shape[:2])[..., None]
    gray = arr.mean(axis=2, keepdims=True)
    sep = np.concatenate([gray * 1.07 + 6, gray * 0.98, gray * 0.82], axis=2)
    vig = 1 - 0.35 * (((x - 0.5) * 1.6) ** 2 + ((y - 0.5) * 1.4) ** 2)
    sep = sep * vig[..., None] + (1 - vig[..., None]) * 40
    out = Image.fromarray(sep.clip(0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    out.save(os.path.join(OUT, f"photo_{kind}{idx}.jpg"), quality=86)


# ---------- Скрепка ----------
def paperclip():
    S = 4
    w, h = 44 * S, 120 * S
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    t = 4 * S
    col = (168, 170, 172, 255)
    shadow = (0, 0, 0, 90)

    def clip(draw, c, off):
        o = off
        draw.rounded_rectangle([4 * S + o, 4 * S + o, 40 * S + o, 116 * S + o], radius=18 * S, outline=c, width=t)
        draw.rounded_rectangle([12 * S + o, 22 * S + o, 32 * S + o, 100 * S + o], radius=10 * S, outline=c, width=t)
    sh = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    clip(ImageDraw.Draw(sh), shadow, 3 * S)
    sh = sh.filter(ImageFilter.GaussianBlur(2 * S))
    im = Image.alpha_composite(sh, im)
    d = ImageDraw.Draw(im)
    clip(d, col, 0)
    # перерезать внутреннюю петлю сверху, как у настоящей скрепки
    d.rectangle([12 * S, 22 * S, 22 * S, 40 * S], fill=(0, 0, 0, 0))
    hl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(hl).rounded_rectangle([5 * S, 5 * S, 39 * S, 115 * S], radius=18 * S, outline=(235, 236, 238, 200), width=S)
    im = Image.alpha_composite(im, hl)
    im.resize((w // S, h // S), Image.LANCZOS).save(os.path.join(OUT, "paperclip.png"))


# ---------- Изолента с рваными краями ----------
def tape(w=900, h=150):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pts = []
    for x in range(0, w + 1, 12):  # верхний край
        pts.append((x, 10 + rng.integers(-1, 2)))
    for y in range(10, h - 10, 9):  # правый рваный край
        pts.append((w - 8 + rng.integers(-8, 9), y))
    for x in range(w, -1, -12):  # нижний край
        pts.append((x, h - 10 + rng.integers(-1, 2)))
    for y in range(h - 10, 10, -9):  # левый рваный край
        pts.append((8 + rng.integers(-8, 9), y))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).polygon(pts, fill=255)
    noise = rng.normal(0, 7, (h, w)).astype(np.float32)
    base = np.array([226, 220, 202], np.float32)
    arr = base[None, None, :] + noise[..., None]
    col = Image.fromarray(arr.clip(0, 255).astype(np.uint8)).convert("RGBA")
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 80), (0, 5), mask.filter(ImageFilter.GaussianBlur(5)))
    im = Image.alpha_composite(im, shadow)
    im.paste(col, (0, 0), mask)
    im.save(os.path.join(OUT, "tape.png"))


wood()
paper()
paperclip()
tape()
print("ok", sorted(os.listdir(OUT)))
