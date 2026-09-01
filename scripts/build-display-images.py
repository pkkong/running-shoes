"""Build normalized display frames from the archived official source images.

The archived files under ``assets/shoes`` and ``assets/shoes-original-safe`` stay
byte-for-byte untouched. This script creates white 4:3 display frames that use
the same lateral product-photo baseline, so official source padding cannot move
one shoe lower or make it appear smaller than the next one in the app.
"""

from __future__ import annotations

from pathlib import Path
import argparse
import re
import unicodedata

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "shoes"
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "shoes-display"
DATA_PATH = ROOT / "data" / "shoes.js"

CANVAS_SIZE = (1600, 1200)
CONTENT_WIDTH = 1220
CONTENT_MAX_HEIGHT = 610
CONTENT_BASELINE = 770
BACKGROUND_BOUNDS_THRESHOLD = 18
BACKGROUND_FADE_START = 7
BACKGROUND_OPAQUE_AT = 32

# Some adidas catalog exports place a pale studio field inside a larger white
# image. Their outer edge is not the real photography background.
BACKGROUND_OVERRIDES = {
    "adidas-슈퍼노바-라이즈-3": (234, 238, 239),
    "adidas-슈퍼노바-프리마-3": (234, 238, 239),
    "adidas-슈퍼노바-솔루션-3": (234, 238, 239),
    "adidas-sl-2": (234, 238, 239),
    "adidas-하이퍼부스트-런": (234, 238, 239),
    "adidas-아디오스-9": (234, 238, 239),
    "adidas-에보-sl": (234, 238, 239),
    "adidas-하이퍼부스트-엣지": (234, 238, 239),
    "adidas-보스턴-13": (234, 238, 239),
    "adidas-프라임-x3-스트렁": (234, 238, 239),
    "adidas-타쿠미-센-11": (234, 238, 239),
    "adidas-아디오스-프로-4": (234, 238, 239),
    "adidas-프로-에보-3": (234, 238, 239),
}


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9가-힣]+", "-", value)
    return value.strip("-")


def ordered_shoe_ids() -> list[str]:
    code = DATA_PATH.read_text(encoding="utf-8")
    raw_shoes = code.split("const rawShoes = [", 1)[1].split("\n  ];", 1)[0]
    rows = re.findall(r'^\s*\["([^"]+)",\s*"([^"]+)",', raw_shoes, flags=re.MULTILINE)
    if not rows:
        raise RuntimeError("Could not parse rawShoes from data/shoes.js")
    return [f"{slugify(brand)}-{slugify(model)}" for brand, model in rows]


def source_images_by_id() -> dict[str, Path]:
    images: dict[str, Path] = {}
    for path in SOURCE_DIR.iterdir():
        if path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        images[unicodedata.normalize("NFC", path.stem)] = path
    return images


def border_background(image: Image.Image) -> tuple[int, int, int]:
    """Use the outer edge, which is product-free in official studio imagery."""
    width, height = image.size
    inset = max(2, min(width, height) // 120)
    samples = []
    for x in range(width):
        samples.append(image.getpixel((x, 0)))
        samples.append(image.getpixel((x, height - 1)))
    for y in range(inset, height - inset):
        samples.append(image.getpixel((0, y)))
        samples.append(image.getpixel((width - 1, y)))
    return tuple(sorted(sample[channel] for sample in samples)[len(samples) // 2] for channel in range(3))


def difference_masks(image: Image.Image, background: tuple[int, int, int]) -> tuple[Image.Image, Image.Image]:
    """Approximate the visible product without making the source transparent.

    White product panels may blend into a white output canvas, which is desired:
    it avoids a rectangular studio-background halo around white shoes.
    """
    backdrop = Image.new("RGB", image.size, background)
    red, green, blue = ImageChops.difference(image, backdrop).split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    bounds = maximum.point(lambda value: 255 if value >= BACKGROUND_BOUNDS_THRESHOLD else 0)
    # Fade the studio field into white rather than punching it out. This retains
    # white knit/foam edges without the speckled cutout effect of a hard alpha mask.
    alpha = maximum.point(
        lambda value: round(
            max(0, min(255, (value - BACKGROUND_FADE_START) * 255 / (BACKGROUND_OPAQUE_AT - BACKGROUND_FADE_START)))
        )
    ).filter(ImageFilter.GaussianBlur(0.7))
    return alpha, bounds


def visible_bounds(bounds_mask: Image.Image) -> tuple[int, int, int, int] | None:
    return bounds_mask.filter(ImageFilter.MaxFilter(9)).getbbox()


def normalized_frame(source_path: Path, shoe_id: str) -> Image.Image:
    with Image.open(source_path) as source_file:
        source = source_file.convert("RGB")

    background = BACKGROUND_OVERRIDES.get(shoe_id, border_background(source))
    mask, bounds_mask = difference_masks(source, background)
    bounds = visible_bounds(bounds_mask)
    if not bounds:
        return Image.new("RGB", CANVAS_SIZE, "white")

    left, top, right, bottom = bounds
    content_width = max(1, right - left)
    content_height = max(1, bottom - top)

    # Leave enough breathing room for shadows and high heel counters.
    padding_x = round(content_width * 0.065)
    padding_y = round(content_height * 0.18)
    crop_left = max(0, left - padding_x)
    crop_top = max(0, top - padding_y)
    crop_right = min(source.width, right + padding_x)
    crop_bottom = min(source.height, bottom + padding_y)

    crop = source.crop((crop_left, crop_top, crop_right, crop_bottom))
    crop_mask = mask.crop((crop_left, crop_top, crop_right, crop_bottom))

    # Size from the detected product, not the varying studio-photo canvas.
    scale = min(CONTENT_WIDTH / content_width, CONTENT_MAX_HEIGHT / content_height)
    target_size = (
        max(1, round(crop.width * scale)),
        max(1, round(crop.height * scale)),
    )
    crop = crop.resize(target_size, Image.Resampling.LANCZOS)
    crop_mask = crop_mask.resize(target_size, Image.Resampling.LANCZOS)

    content_left = (left - crop_left) * scale
    content_bottom = (bottom - crop_top) * scale
    paste_x = round(CANVAS_SIZE[0] / 2 - (content_left + content_width * scale / 2))
    paste_y = round(CONTENT_BASELINE - content_bottom)

    frame = Image.new("RGB", CANVAS_SIZE, "white")
    # Soft mask keeps the official product pixels but replaces only the studio field.
    frame.paste(crop, (paste_x, paste_y), crop_mask)
    return frame


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    source_images = source_images_by_id()
    shoe_ids = ordered_shoe_ids()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    missing = []
    count = 0
    for index, shoe_id in enumerate(shoe_ids):
        if args.limit is not None and index >= args.limit:
            break
        source_path = source_images.get(shoe_id)
        if source_path is None:
            missing.append(shoe_id)
            continue
        output_path = output_dir / f"{index:03d}.jpg"
        normalized_frame(source_path, shoe_id).save(output_path, "JPEG", quality=94, optimize=True, progressive=True)
        count += 1

    if missing:
        raise SystemExit("Missing source images: " + ", ".join(missing))
    print(f"Built {count} normalized display images in {output_dir}")


if __name__ == "__main__":
    main()
