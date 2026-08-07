from hashlib import sha256
from pathlib import Path
import re
import unicodedata


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "shoes"
OUTPUT_DIR = ROOT / "assets" / "shoes-original-safe"
DATA_PATH = ROOT / "data" / "shoes.js"


def digest(path):
    hasher = sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


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
    source_images = source_images_by_id()
    expected_paths = set()
    errors = []

    for index, shoe_id in enumerate(ordered_shoe_ids()):
        source_path = source_images.get(shoe_id)
        if source_path is None:
            errors.append(f"{shoe_id}: source image is missing")
            continue

        output_path = OUTPUT_DIR / f"{index:03d}{source_path.suffix.lower()}"
        expected_paths.add(output_path)
        if not output_path.exists():
            errors.append(f"{shoe_id}: deployed original is missing: {output_path.relative_to(ROOT)}")
            continue
        if digest(source_path) != digest(output_path):
            errors.append(f"{shoe_id}: deployed original differs from source bytes")

    for output_path in OUTPUT_DIR.glob("*.*"):
        if output_path not in expected_paths:
            errors.append(f"unexpected deployed image: {output_path.relative_to(ROOT)}")

    if errors:
        print(f"Official image asset audit failed ({len(errors)} errors)")
        for error in errors:
            print(f"error: {error}")
        raise SystemExit(1)

    print(f"Official original asset audit passed: {len(expected_paths)} images are byte-for-byte copies")


if __name__ == "__main__":
    main()
