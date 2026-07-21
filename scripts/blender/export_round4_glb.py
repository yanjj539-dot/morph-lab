from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round4_assets as round4


PER_ASSET_LIMIT = 1_500_000
TOTAL_LIMIT = 5_000_000


def main() -> None:
    stage = round4.requested_stage()
    names = [stage] if stage else list(round4.STAGES)
    round4.write_manifests()
    results = [round4.build_stage(name, do_export=True, do_render=False) for name in names]
    failures: list[str] = []
    total_bytes = sum(int(result["bytes"]) for result in results)
    for result in results:
        stage_name = str(result["stage"])
        if int(result["bytes"]) >= PER_ASSET_LIMIT:
            failures.append(f"{stage_name} exceeds {PER_ASSET_LIMIT} bytes")
        expected = round4.STAGES[stage_name].clip_name
        if expected not in result["animations"]:
            failures.append(f"{stage_name} missing primary clip {expected}")
        if "KHR_draco_mesh_compression" not in result["extensionsUsed"]:
            failures.append(f"{stage_name} missing Draco extension")
        duration = float(result["animationDurationsSeconds"].get(expected, 0.0))
        if abs(duration - 5.0) > 0.001:
            failures.append(f"{stage_name} primary clip duration is {duration}, expected 5.0 seconds")
    if not stage and total_bytes >= TOTAL_LIMIT:
        failures.append(f"total exceeds {TOTAL_LIMIT} bytes")
    report = {
        "schemaVersion": 1,
        "limits": {"perAssetBytes": PER_ASSET_LIMIT, "totalBytes": TOTAL_LIMIT},
        "totalBytes": total_bytes,
        "assets": results,
        "status": "pass" if not failures else "fail",
        "failures": failures,
    }
    target = round4.ARTIFACT_DIR / ("asset-stats.json" if not stage else f"asset-stats-{stage}.json")
    target.write_text(json.dumps(report, indent=2), encoding="utf8")
    print("ROUND4_EXPORT_REPORT=" + json.dumps(report, ensure_ascii=True))
    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
