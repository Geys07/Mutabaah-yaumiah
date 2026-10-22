"""Render monogram MY untuk badge status bar Android.

Ukuran fisik ikon status bar ditetapkan oleh Android (sekitar 24dp).
Dua nama panjang akan menjadi mikro-teks. Karena itu gunakan dua huruf
besar yang menutupi ruang ikon; nama penuh tetap pada judul notifikasi.
Script ini hanya untuk menyiapkan aset PNG, bukan dijalankan di runtime.
"""
from pathlib import Path
import os

from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
]
font_path = next((path for path in FONT_CANDIDATES if Path(path).exists()), None)
if not font_path:
    raise RuntimeError("Font bold diperlukan untuk badge Android")

font = ImageFont.truetype(font_path, 1500)
scratch = Image.new("L", (2048, 2048), 0)
bbox = ImageDraw.Draw(scratch).textbbox((0, 0), "MY", font=font)
glyph = Image.new("L", (bbox[2] - bbox[0] + 40, bbox[3] - bbox[1] + 40), 0)
ImageDraw.Draw(glyph).text(
    (20 - bbox[0], 20 - bbox[1]), "MY", fill=255, font=font
)
glyph = glyph.crop(glyph.getbbox()).resize((456, 400), Image.Resampling.LANCZOS)

mask = Image.new("L", (512, 512), 0)
mask.paste(glyph, (28, 56))
mask = mask.resize((96, 96), Image.Resampling.LANCZOS)
image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
image.putalpha(mask)

target = Path("public/notification/mutabaah-status-v3.png")
target.parent.mkdir(parents=True, exist_ok=True)
image.save(target, optimize=True)

assert image.mode == "RGBA"
assert image.getpixel((0, 0))[3] == 0
assert image.getpixel((95, 95))[3] == 0
assert image.getbbox() is not None
assert target.stat().st_size > 1000
print(f"Badge MY: {target}, {image.size}, {target.stat().st_size} bytes")
