from collections import deque
from pathlib import Path
import re
from statistics import median
import unicodedata

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "shoes"
OUTPUT_DIR = ROOT / "assets" / "shoes-cutout-safe"
DATA_PATH = ROOT / "data" / "shoes.js"


def edge_samples(image, margin):
    width, height = image.size
    pixels = image.load()
    samples = []

    for x in range(width):
        for y in range(margin):
            samples.append(pixels[x, y])
            samples.append(pixels[x, height - 1 - y])

    for y in range(height):
        for x in range(margin):
            samples.append(pixels[x, y])
            samples.append(pixels[width - 1 - x, y])

    bright = [pixel for pixel in samples if sum(pixel) / 3 >= 176 and max(pixel) - min(pixel) <= 56]
    return bright or samples


def background_reference(samples):
    return tuple(int(median(channel)) for channel in zip(*samples))


def is_background(pixel, reference):
    red, green, blue = pixel
    ref_red, ref_green, ref_blue = reference
    brightness = (red + green + blue) / 3
    chroma = max(pixel) - min(pixel)
    distance = abs(red - ref_red) + abs(green - ref_green) + abs(blue - ref_blue)

    if brightness >= 244 and chroma <= 34:
        return True
    if brightness >= 214 and chroma <= 42 and distance <= 88:
        return True
    if brightness >= 184 and chroma <= 54 and distance <= 58:
        return True
    return False


def connected_background_mask(rgb):
    width, height = rgb.size
    source = rgb.load()
    margin = max(2, min(width, height) // 80)
    reference = background_reference(edge_samples(rgb, margin))
    visited = bytearray(width * height)
    mask = Image.new("L", (width, height), 0)
    mask_pixels = mask.load()
    queue = deque()

    def enqueue(x, y):
        index = y * width + x
        if visited[index] or not is_background(source[x, y], reference):
            return
        visited[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        mask_pixels[x, y] = 255
        if x > 0:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y > 0:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    return mask


def remove_connected_background(image):
    rgba = image.convert("RGBA")
    width, height = rgba.size
    max_mask_side = 560
    scale = min(1, max_mask_side / max(width, height))

    if scale < 1:
        mask_size = (max(1, round(width * scale)), max(1, round(height * scale)))
        mask_source = rgba.convert("RGB").resize(mask_size, Image.Resampling.BILINEAR)
    else:
        mask_source = rgba.convert("RGB")

    mask = connected_background_mask(mask_source)
    if mask.size != rgba.size:
        mask = mask.resize(rgba.size, Image.Resampling.BICUBIC)

    softened = mask.filter(ImageFilter.GaussianBlur(radius=1.0))
    alpha = ImageChops.invert(softened)
    rgba.putalpha(alpha)

    bounds = alpha.getbbox()
    if bounds:
        padding = max(20, round(max(width, height) * 0.025))
        left = max(0, bounds[0] - padding)
        top = max(0, bounds[1] - padding)
        right = min(width, bounds[2] + padding)
        bottom = min(height, bounds[3] + padding)
        rgba = rgba.crop((left, top, right, bottom))

    return rgba


def slugify(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9가-힣]+", "-", value)
    return value.strip("-")


def ordered_shoe_ids():
    code = DATA_PATH.read_text(encoding="utf-8")
    raw_shoes = code.split("const rawShoes = [", 1)[1].split("\n  ];", 1)[0]
    rows = re.findall(r'^\s*\["([^"]+)",\s*"([^"]+)",', raw_shoes, flags=re.MULTILINE)
    if not rows:
        raise RuntimeError("Could not parse rawShoes from data/shoes.js")
    return [f"{slugify(brand)}-{slugify(model)}" for brand, model in rows]


def source_images_by_id():
    images = {}
    for source_path in SOURCE_DIR.iterdir():
        if source_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        images[unicodedata.normalize("NFC", source_path.stem)] = source_path
    return images


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale_path in OUTPUT_DIR.glob("*.webp"):
        stale_path.unlink()

    source_images = source_images_by_id()
    count = 0

    for index, shoe_id in enumerate(ordered_shoe_ids()):
        source_path = source_images.get(shoe_id)
        if source_path is None:
            raise FileNotFoundError(f"Missing source image for {shoe_id}")
        target_path = OUTPUT_DIR / f"{index:03d}.webp"
        with Image.open(source_path) as image:
            cutout = remove_connected_background(image)
            cutout.save(target_path, "WEBP", quality=92, method=4)
        count += 1

    print(f"Created {count} cutout images in {OUTPUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
