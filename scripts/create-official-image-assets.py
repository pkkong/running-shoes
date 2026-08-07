from pathlib import Path
import re
import shutil
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "shoes"
OUTPUT_DIR = ROOT / "assets" / "shoes-original-safe"
DATA_PATH = ROOT / "data" / "shoes.js"


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
    for stale_path in OUTPUT_DIR.glob("*.*"):
        stale_path.unlink()

    source_images = source_images_by_id()
    copied = 0

    for index, shoe_id in enumerate(ordered_shoe_ids()):
        source_path = source_images.get(shoe_id)
        if source_path is None:
            raise FileNotFoundError(f"Missing official source image for {shoe_id}")

        # Preserve the official source bytes; no background removal or re-encoding.
        target_path = OUTPUT_DIR / f"{index:03d}{source_path.suffix.lower()}"
        shutil.copy2(source_path, target_path)
        copied += 1

    print(f"Copied {copied} official source images to {OUTPUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
