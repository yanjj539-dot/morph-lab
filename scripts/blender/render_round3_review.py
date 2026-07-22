from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round3_assets as round3


def main() -> None:
    stage = round3.requested_stage()
    names = [stage] if stage else list(round3.STAGES)
    results = [round3.build_stage(name, do_export=False, do_render=True) for name in names]
    print("ROUND3_REVIEW_STATS=" + json.dumps(results, ensure_ascii=True))


if __name__ == "__main__":
    main()
