"""Prepare generated MORPH//LAB images for responsive web delivery."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_TARGETS = {
    "memory": (1600, 1000),
    "species": (1200, 1500),
    "operator": (1600, 1000),
}


def save_project_image(source: Path, destination: Path, size: tuple[int, int]) -> None:
    with Image.open(source) as image:
        prepared = ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)
        prepared.save(destination.with_suffix(".jpg"), "JPEG", quality=88, optimize=True, progressive=True)
        prepared.save(destination.with_suffix(".webp"), "WEBP", quality=84, method=6)
        prepared.save(destination.with_suffix(".avif"), "AVIF", quality=72)


def save_brand_assets(source: Path, public_dir: Path) -> None:
    with Image.open(source) as image:
        card = image.convert("RGB")
        social_card = ImageOps.fit(
            card,
            (1200, 630),
            method=Image.Resampling.LANCZOS,
            centering=(0.5, 0.5),
        )
        social_card.save(public_dir / "og.png", "PNG", optimize=True)
        mark = ImageOps.fit(
            card,
            (512, 512),
            method=Image.Resampling.LANCZOS,
            centering=(0.84, 0.5),
        )
        mark.resize((64, 64), Image.Resampling.LANCZOS).save(public_dir / "favicon.png", "PNG", optimize=True)
        mark.resize((180, 180), Image.Resampling.LANCZOS).save(
            public_dir / "apple-touch-icon.png", "PNG", optimize=True
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--memory", type=Path, required=True)
    parser.add_argument("--species", type=Path, required=True)
    parser.add_argument("--operator", type=Path, required=True)
    parser.add_argument("--og", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("public"))
    args = parser.parse_args()

    output = args.output.resolve()
    image_dir = output / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    for key, size in PROJECT_TARGETS.items():
        save_project_image(getattr(args, key), image_dir / f"project-{key}", size)

    save_brand_assets(args.og, output)


if __name__ == "__main__":
    main()
