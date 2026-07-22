from __future__ import annotations

import json
import math
import os
import random
import shutil
import subprocess
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "artifacts" / "qa-round3" / "texture-sources"
OUTPUT_DIR = ROOT / "public" / "textures" / "round-3"
SOURCE_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


MAPS = {
    "paper-normal": (256, 256, "normal", 17),
    "plastic-normal": (256, 256, "normal", 29),
    "metal-brushed-normal": (256, 256, "brushed", 41),
    "rubber-normal": (256, 256, "normal", 53),
    "studio-orm": (256, 256, "orm", 67),
    "neutral-studio-env": (512, 256, "environment", 79),
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def pixels_for(width: int, height: int, kind: str, seed: int) -> list[float]:
    random.seed(seed)
    pixels: list[float] = []
    phase = random.random() * math.tau
    for y in range(height):
        v = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            grain = math.sin((u * 173.0 + v * 97.0) * math.tau + phase) * 0.018
            grain += math.sin((u * 29.0 - v * 61.0) * math.tau) * 0.012
            if kind == "normal":
                nx = 0.5 + grain
                ny = 0.5 + math.sin((u * 113.0 + v * 151.0) * math.tau) * 0.016
                pixels.extend((clamp(nx), clamp(ny), 1.0, 1.0))
            elif kind == "brushed":
                nx = 0.5 + math.sin(v * 420.0 + phase) * 0.022
                ny = 0.5 + math.sin(v * 71.0) * 0.006
                pixels.extend((clamp(nx), clamp(ny), 1.0, 1.0))
            elif kind == "orm":
                roughness = 0.57 + grain * 2.1
                pixels.extend((0.96, clamp(roughness), 0.08, 1.0))
            else:
                horizon = math.exp(-((v - 0.47) ** 2) / 0.045)
                warm = math.exp(-(((u - 0.22) ** 2 + (v - 0.35) ** 2) / 0.025))
                pixels.extend(
                    (
                        clamp(0.34 + horizon * 0.34 + warm * 0.16),
                        clamp(0.43 + horizon * 0.36 + warm * 0.09),
                        clamp(0.58 + horizon * 0.34),
                        1.0,
                    )
                )
    return pixels


def write_sources() -> list[dict[str, object]]:
    manifest: list[dict[str, object]] = []
    for name, (width, height, kind, seed) in MAPS.items():
        image = bpy.data.images.new(name, width=width, height=height, alpha=True, float_buffer=False)
        image.colorspace_settings.name = "Non-Color" if kind != "environment" else "sRGB"
        image.pixels.foreach_set(pixels_for(width, height, kind, seed))
        source = SOURCE_DIR / f"{name}.png"
        image.filepath_raw = str(source)
        image.file_format = "PNG"
        image.save()
        bpy.data.images.remove(image)
        manifest.append({"name": name, "width": width, "height": height, "kind": kind, "source": str(source)})
    return manifest


def find_toktx() -> str | None:
    configured = os.environ.get("MORPH_TOKTX")
    if configured and Path(configured).exists():
        return configured
    return shutil.which("toktx")


def encode_sources(toktx: str, manifest: list[dict[str, object]]) -> None:
    for item in manifest:
        name = str(item["name"])
        source = Path(str(item["source"]))
        output = OUTPUT_DIR / f"{name}.ktx2"
        command = [toktx, "--t2", "--encode", "uastc", "--uastc_quality", "2", "--zcmp", "9", "--genmipmap"]
        if item["kind"] in {"normal", "brushed"}:
            command.extend(("--assign_oetf", "linear", "--assign_primaries", "none", "--normal_mode"))
        elif item["kind"] != "environment":
            command.extend(("--assign_oetf", "linear", "--assign_primaries", "none"))
        command.extend((str(output), str(source)))
        subprocess.run(command, check=True)


def main() -> None:
    manifest = write_sources()
    toktx = find_toktx()
    if toktx:
        encode_sources(toktx, manifest)
    (SOURCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")
    print("ROUND3_TEXTURE_SOURCES=" + json.dumps(manifest, ensure_ascii=True))
    if not toktx:
        print("ROUND3_TEXTURE_ENCODER=missing (set MORPH_TOKTX or put toktx on PATH)")


if __name__ == "__main__":
    main()
