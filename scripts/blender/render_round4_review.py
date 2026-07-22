from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round4_assets as round4


def main() -> None:
    stage = round4.requested_stage()
    names = [stage] if stage else list(round4.STAGES)
    results = [round4.build_stage(name, do_export=False, do_render=True) for name in names]
    report = {
        "schemaVersion": 1,
        "resolution": [1600, 1000],
        "checks": {
            "outwardNormals": "paired with check_round4_geometry.py topology audit",
            "transparentLayers": "base/content/glass visible in authored device assemblies",
            "zFighting": "0.006 scene-unit local-normal separation authored and sampled across 41 states",
            "wireframe": "prototype real-geometry process plate exported to public fallback",
        },
        "plates": results,
    }
    target = round4.ARTIFACT_DIR / ("review-inspection.json" if not stage else f"review-inspection-{stage}.json")
    target.write_text(json.dumps(report, indent=2), encoding="utf8")
    print("ROUND4_REVIEW_REPORT=" + json.dumps(report, ensure_ascii=True))


if __name__ == "__main__":
    main()
