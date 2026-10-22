"""Bangun badge PNG monokrom untuk status bar Android.

Hanya dua baris nama aplikasi, tanpa logo/detail kecil yang hilang
ketika badge menjadi kira-kira 24 px di Android.
"""
import base64
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

CANVAS = 512
SCALE = 3
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
]
font_file = next((path for path in FONT_CANDIDATES if Path(path).exists()), None)
if not font_file:
    raise RuntimeError("No bold font available to render notification badge")

image = Image.new("RGBA", (CANVAS * SCALE, CANVAS * SCALE), (0, 0, 0, 0))


def add_word(word, y, height):
    font = ImageFont.truetype(font_file, 200 * SCALE // 3)
    bounds = ImageDraw.Draw(image).textbbox((0, 0), word, font=font, stroke_width=1)
    glyph = Image.new(
        "RGBA",
        (bounds[2] - bounds[0] + 12, bounds[3] - bounds[1] + 12),
        (0, 0, 0, 0),
    )
    ImageDraw.Draw(glyph).text(
        (6 - bounds[0], 6 - bounds[1]),
        word,
        font=font,
        fill=(0, 0, 0, 255),
        stroke_width=1,
        stroke_fill=(0, 0, 0, 255),
    )
    glyph = glyph.crop(glyph.getbbox())
    width = (CANVAS - 20) * SCALE
    glyph = glyph.resize((width, height * SCALE), Image.Resampling.LANCZOS)
    image.alpha_composite(glyph, ((CANVAS * SCALE - width) // 2, y * SCALE))


add_word("Mutabaah", 50, 192)
add_word("Yaumiah", 270, 192)

image = image.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS)
target = Path("public/notification/mutabaah-status-v2.png")
target.parent.mkdir(parents=True, exist_ok=True)
image.save(target, optimize=True)

# Batas verifikasi: transparansi sungguhan, tepi tidak kosong seluruhnya,
# tetapi sudut harus transparan sehingga gambar tidak menjadi kotak.
assert image.getpixel((0, 0))[3] == 0
assert image.getpixel((CANVAS - 1, CANVAS - 1))[3] == 0
assert image.getbbox() is not None
assert target.stat().st_size > 1000
print(f"Badge created: {target} {image.size} {target.stat().st_size} bytes")
if os.environ.get("EMIT_BADGE_BASE64") == "1":
    print("BADGE_B64_START:" + base64.b64encode(target.read_bytes()).decode("ascii") + ":BADGE_B64_END")
