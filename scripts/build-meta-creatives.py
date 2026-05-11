"""
Build before/after Meta ad image composites from R2 samples.

Pulls the agents-audience samples (photo-staging, twilight-exterior),
generates side-by-side and stacked composites in three aspect ratios:
  - 1080x1080  (1:1, Feed)
  - 1080x1350  (4:5, Feed mobile)
  - 1080x1920  (9:16, Reels/Stories)

Outputs to /tmp/relist-creatives/*.jpg ready for upload to Meta.

Usage:
  python3 scripts/build-meta-creatives.py
"""
import os, io, sys
import boto3
from botocore.config import Config
from PIL import Image, ImageDraw, ImageFont

def _clean(v: str) -> str:
    v = v.strip()
    if v.startswith('"') and v.endswith('"'):
        v = v[1:-1]
    # vercel pulls store literal \n in quoted values
    return v.replace("\\n", "").replace("\\r", "").strip()

ENV_FILE = ".env.r2.tmp"
if os.path.exists(ENV_FILE):
    for line in open(ENV_FILE):
        if line.startswith("R2_") and "=" in line:
            k, v = line.strip().split("=", 1)
            os.environ[k] = _clean(v)

ACCOUNT = _clean(os.environ["R2_ACCOUNT_ID"])
KEY_ID = _clean(os.environ["R2_ACCESS_KEY_ID"])
SECRET = _clean(os.environ["R2_SECRET_ACCESS_KEY"])
BUCKET = _clean(os.environ.get("R2_BUCKET") or "relist-photos")

s3 = boto3.client(
    "s3",
    region_name="auto",
    endpoint_url=f"https://{ACCOUNT}.r2.cloudflarestorage.com",
    aws_access_key_id=KEY_ID,
    aws_secret_access_key=SECRET,
    config=Config(signature_version="s3v4"),
)

OUT = "/tmp/relist-creatives"
os.makedirs(OUT, exist_ok=True)

PAIRS = [
    ("staging",  "samples/services/photo-staging-before.jpg",     "samples/services/photo-staging-after.jpg"),
    ("twilight", "samples/services/twilight-exterior-before.jpg", "samples/services/twilight-exterior-after.jpg"),
]

# Try to use a clean sans font; fall back if missing.
def load_font(size):
    for path in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()

def fetch(key: str) -> Image.Image:
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    return Image.open(io.BytesIO(obj["Body"].read())).convert("RGB")

def cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Resize + center-crop to exactly w×h."""
    src_ratio = img.width / img.height
    tgt_ratio = w / h
    if src_ratio > tgt_ratio:
        new_h = h
        new_w = int(round(h * src_ratio))
    else:
        new_w = w
        new_h = int(round(w / src_ratio))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - w) // 2
    top = (new_h - h) // 2
    return img.crop((left, top, left + w, top + h))

def draw_label(draw: ImageDraw.ImageDraw, text: str, xy, font, fg=(255,255,255), bg=(0,0,0,180), pad=18):
    """Draw a text pill with rounded background."""
    bbox = draw.textbbox((0,0), text, font=font)
    tw, th = bbox[2]-bbox[0], bbox[3]-bbox[1]
    x, y = xy
    rect = [x, y, x + tw + pad*2, y + th + pad*2]
    overlay = Image.new("RGBA", (rect[2]-rect[0], rect[3]-rect[1]), bg)
    base = draw._image
    base.paste(overlay, (rect[0], rect[1]), overlay)
    draw.text((x + pad, y + pad - bbox[1]), text, font=font, fill=fg)

def composite_side_by_side(before: Image.Image, after: Image.Image, w: int, h: int, label_size: int) -> Image.Image:
    half_w = w // 2
    b = cover_crop(before, half_w, h)
    a = cover_crop(after, half_w, h)
    canvas = Image.new("RGB", (w, h), (10, 10, 10))
    canvas.paste(b, (0, 0))
    canvas.paste(a, (half_w, 0))
    # divider
    d = ImageDraw.Draw(canvas)
    d.rectangle([half_w-2, 0, half_w+2, h], fill=(255,255,255))
    # labels
    f_lbl = load_font(label_size)
    draw_label(d, "BEFORE", (24, 24), f_lbl)
    draw_label(d, "AFTER",  (half_w + 24, 24), f_lbl)
    # bottom brand bar
    bar_h = max(60, h // 18)
    d.rectangle([0, h - bar_h, w, h], fill=(15, 23, 42))
    f_brand = load_font(int(bar_h * 0.45))
    bbox = d.textbbox((0,0), "Relist  ·  AI listing photos in 24h", font=f_brand)
    tw = bbox[2]-bbox[0]
    d.text(((w - tw) // 2, h - bar_h + (bar_h - (bbox[3]-bbox[1])) // 2 - bbox[1]),
           "Relist  ·  AI listing photos in 24h", font=f_brand, fill=(255,255,255))
    return canvas

def composite_stacked(before: Image.Image, after: Image.Image, w: int, h: int, label_size: int) -> Image.Image:
    half_h = h // 2
    b = cover_crop(before, w, half_h)
    a = cover_crop(after, w, half_h)
    canvas = Image.new("RGB", (w, h), (10, 10, 10))
    canvas.paste(b, (0, 0))
    canvas.paste(a, (0, half_h))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, half_h-2, w, half_h+2], fill=(255,255,255))
    f_lbl = load_font(label_size)
    draw_label(d, "BEFORE", (24, 24), f_lbl)
    draw_label(d, "AFTER",  (24, half_h + 24), f_lbl)
    bar_h = max(60, h // 18)
    d.rectangle([0, h - bar_h, w, h], fill=(15, 23, 42))
    f_brand = load_font(int(bar_h * 0.45))
    bbox = d.textbbox((0,0), "Relist  ·  AI listing photos in 24h", font=f_brand)
    tw = bbox[2]-bbox[0]
    d.text(((w - tw) // 2, h - bar_h + (bar_h - (bbox[3]-bbox[1])) // 2 - bbox[1]),
           "Relist  ·  AI listing photos in 24h", font=f_brand, fill=(255,255,255))
    return canvas

ASPECTS = [
    ("1x1",  1080, 1080, 56),  # Feed
    ("4x5",  1080, 1350, 60),  # Feed mobile
    ("9x16", 1080, 1920, 72),  # Reels/Stories — use stacked
]

def main():
    out_files = []
    for slug, before_key, after_key in PAIRS:
        print(f"\n=== {slug} ===")
        before = fetch(before_key)
        after = fetch(after_key)
        print(f"  before: {before.size}, after: {after.size}")
        for ar, w, h, lbl in ASPECTS:
            stacked = ar == "9x16"  # vertical → stacked top/bottom reads better
            img = (composite_stacked if stacked else composite_side_by_side)(before, after, w, h, lbl)
            path = f"{OUT}/relist-{slug}-{ar}.jpg"
            img.save(path, "JPEG", quality=92, optimize=True)
            print(f"  wrote {path}  {os.path.getsize(path)//1024} KB")
            out_files.append(path)
    print("\nGenerated:")
    for p in out_files:
        print(" ", p)

if __name__ == "__main__":
    main()
