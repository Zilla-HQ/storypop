"""
Generate a 1024x1024 app icon for the Meta App.
Outputs to /tmp/relist-creatives/app-icon-1024.png
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "/tmp/relist-creatives/app-icon-1024.png"
os.makedirs("/tmp/relist-creatives", exist_ok=True)

SIZE = 1024
BG = (15, 23, 42)    # slate-900 — matches the brand bar in the ad composites
FG = (255, 255, 255)
ACCENT = (251, 191, 36)  # amber-400 accent dot

def load_font(size, bold=True):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()

img = Image.new("RGB", (SIZE, SIZE), BG)
d = ImageDraw.Draw(img)

# Big monogram "R"
font = load_font(720)
text = "R"
bbox = d.textbbox((0, 0), text, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (SIZE - tw) // 2 - bbox[0]
y = (SIZE - th) // 2 - bbox[1] - 40  # slight optical lift
d.text((x, y), text, font=font, fill=FG)

# Accent dot under the R, centered, baseline-aligned
dot_r = 36
cx, cy = SIZE // 2, SIZE - 180
d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=ACCENT)

img.save(OUT, "PNG", optimize=True)
print("wrote", OUT, os.path.getsize(OUT) // 1024, "KB")
