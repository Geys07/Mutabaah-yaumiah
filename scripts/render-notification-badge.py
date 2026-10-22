"""Bangun badge PNG Android dengan nama lengkap, bukan monogram.

Status bar Android menampilkan badge sangat kecil. Gunakan dua baris tulisan
hitam paling tebal, padat, dan memenuhi kanvas transparan. Hasil tidak
mengubah dimensi fisik slot ikon yang dikendalikan sistem operasi.
Jalankan manual dari root repo: python scripts/render-notification-badge.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT = Path("public/notification/mutabaah-status-v4.png")
SIZE = 96
CANVAS = 576
FONTS = (
    "/usr/share/fonts/truetype/noto/NotoSans-CondensedBlack.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
)
font_file = next((file for file in FONTS if Path(file).exists()), None)
if not font_file:
    raise RuntimeError("Font tebal-condensed belum terpasang")

mask = Image.new("L", (CANVAS, CANVAS), 0)
lines = (("Mutabaah", 253), ("Yaumiah", 235))
gap, padding = 10, 21
y = (CANVAS - sum(height for _, height in lines) - gap) // 2

for label, height in lines:
    font = ImageFont.truetype(font_file, 900)
    bbox = ImageDraw.Draw(Image.new("L", (10, 10))).textbbox((0, 0), label, font=font)
    glyph = Image.new("L", (bbox[2] - bbox[0] + 32, bbox[3] - bbox[1] + 32), 0)
    ImageDraw.Draw(glyph).text((16 - bbox[0], 16 - bbox[1]), label, font=font, fill=255)
    glyph = glyph.crop(glyph.getbbox()).resize(
        (CANVAS - 2 * padding, height), Image.Resampling.LANCZOS
    )
    glyph = glyph.filter(ImageFilter.MaxFilter(3))
    mask.paste(glyph, (padding, y))
    y += height + gap

mask = mask.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
# Alpha 32 tingkat hampir sama di status bar kecil, tetapi lebih ringan.
mask = mask.point(lambda value: min(255, round(value / 8) * 8))
image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
image.putalpha(mask)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
image.save(OUTPUT, optimize=True)

assert image.mode == "RGBA" and image.size == (96, 96)
assert image.getpixel((0, 0))[3] == 0
assert image.getpixel((95, 95))[3] == 0
assert image.getbbox() is not None and OUTPUT.stat().st_size > 1500
print(f"PNG badge tulisan lengkap: {OUTPUT} ({OUTPUT.stat().st_size} bytes)")
