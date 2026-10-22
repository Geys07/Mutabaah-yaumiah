"""Buat badge PNG kecil berisi nama lengkap untuk status bar Android.

Android menentukan ukuran fisik area badge (~24dp). Supaya dua baris tetap
sejelas mungkin, gambar menggunakan teks pekat, condensed, dan hampir tanpa
margin. Berkas hasil jadi juga disimpan di repositori sehingga tidak perlu
menghasilkan aset secara dinamis pada perangkat.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 96
SCALE = 5
WORDS = [
    ("Mutabaah", 90, 38, 7),
    ("Yaumiah", 88, 38, 50),
]
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/noto/NotoSansDisplay-ExtraCondensedBlack.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
    "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
]
font_path = next((p for p in FONT_CANDIDATES if Path(p).exists()), None)
if not font_path:
    raise RuntimeError("Tidak ada font tebal untuk membuat ikon")

font = ImageFont.truetype(font_path, 230)
mask_large = Image.new("L", (SIZE * SCALE, SIZE * SCALE), 0)

for word, width, height, top in WORDS:
    bbox = ImageDraw.Draw(mask_large).textbbox((0, 0), word, font=font)
    glyph = Image.new("L", (bbox[2] - bbox[0] + 12, bbox[3] - bbox[1] + 12), 0)
    ImageDraw.Draw(glyph).text(
        (6 - bbox[0], 6 - bbox[1]), word, font=font, fill=255
    )
    glyph = glyph.crop(glyph.getbbox())
    glyph = glyph.resize((width * SCALE, height * SCALE), Image.Resampling.LANCZOS)
    mask_large.paste(
        glyph, ((SIZE * SCALE - width * SCALE) // 2, top * SCALE)
    )

mask = mask_large.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
# Batasi level transparansi agar edges tetap tajam saat icon dikecilkan.
mask = mask.point(lambda x: max(0, min(255, round(x / 8) * 8)) if x > 4 else 0)
image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
image.putalpha(mask)

target = Path("public/notification/mutabaah-status-v4.png")
target.parent.mkdir(parents=True, exist_ok=True)
image.save(target, optimize=True, compress_level=9)
assert image.size == (96, 96) and image.mode == "RGBA"
assert image.getpixel((0, 0))[3] == 0
assert image.getpixel((95, 95))[3] == 0
assert image.getchannel("A").getbbox() is not None
print(f"PNG badge dibuat: {target} ({target.stat().st_size} byte)")
