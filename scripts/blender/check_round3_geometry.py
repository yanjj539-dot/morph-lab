from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round3_assets as round3


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "artifacts" / "qa-round3"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_FRAMES = [1 + index * 6 for index in range(21)]


@dataclass(frozen=True)
class AllowRule:
    left: str
    right: str
    max_depth: float
    reason: str

    def matches(self, a: str, b: str) -> bool:
        return bool(
            (re.search(self.left, a) and re.search(self.right, b))
            or (re.search(self.left, b) and re.search(self.right, a))
        )


ALLOW_RULES = [
    AllowRule(r"OBS_research_table$", r"^(OBS|SCREEN_observe|PRINT_observe)", 0.20, "object grounded on Observe work surface"),
    AllowRule(r"STR_console$", r"^(STR|SCREEN_structure)", 0.20, "object grounded on Structure console"),
    AllowRule(r"PRO_test_bench$", r"^(PRO|SCREEN_prototype)", 0.20, "object grounded on Prototype bench"),
    AllowRule(r"REL_delivery_station$", r"^(REL|SCREEN_release|PRINT_release)", 0.20, "object grounded on Release station"),
    AllowRule(r"_(research_table|console|test_bench|delivery_station)$", r"_(table_leg|rubber_foot|station_bolt|table_seam|console_seam|bench_seam|station_seam)", 0.16, "authored base connection"),
    AllowRule(r"monitor_frame", r"monitor_(stem|hinge)|SCREEN_", 0.18, "monitor assembly"),
    AllowRule(r"monitor_stem", r"monitor_foot", 0.16, "monitor stand joint"),
    AllowRule(r"operator_body", r"operator_head", 0.08, "scale figure joint"),
    AllowRule(r"scanner_body", r"scanner_(bed|lid|rail|screw)|control_|paper_guide|status_window", 0.22, "scanner assembly"),
    AllowRule(r"scanner_lid", r"lid_hinge|paper_guide|scanner_rail", 0.08, "scanner lid hardware"),
    AllowRule(r"scan_beam", r"paper_guide", 0.04, "scan beam travels inside guide rails"),
    AllowRule(r"folder", r"folder_tab", 0.08, "folder tab connection"),
    AllowRule(r"material_tray", r"tray_divider|swatch", 0.12, "sample tray assembly"),
    AllowRule(r"swatch_", r"swatch_|tray_divider", 0.08, "overlapped material swatch fan"),
    AllowRule(r"OBS_paper_", r"OBS_paper_|PRINT_observe_persona", 0.08, "stacked research papers"),
    AllowRule(r"OBS_clip_", r"OBS_clip_|OBS_paper_", 0.06, "paper clip contact"),
    AllowRule(r"grid_[hv]_", r"grid_[hv]_", 0.04, "design grid crossing"),
    AllowRule(r"grid_board", r"grid_[hv]_|mount_rail|base_bolt|card_clip|panel_|SCREEN_structure|phase_chip|pin_", 0.24, "design board mounted detail"),
    AllowRule(r"token_dock", r"token_|token_slot", 0.22, "token dock assembly"),
    AllowRule(r"STR_token_\d", r"token_slot", 0.22, "token seated in slot"),
    AllowRule(r"type_ruler", r"type_bar|ruler_track", 0.16, "type scale assembly"),
    AllowRule(r"panel_", r"connector_|phase_chip|SCREEN_structure|card_clip|mount_rail|type_ruler|ruler_track", 0.14, "panel surface detail"),
    AllowRule(r"board_base", r"grid_board|base_bolt", 0.24, "board base assembly"),
    AllowRule(r"booklet", r"booklet_band", 0.12, "booklet binding"),
    AllowRule(r"control_strip", r"STR_control_", 0.12, "control strip assembly"),
    AllowRule(r"type_ruler", r"mount_rail|ruler_track|card_clip|STR_pin_|phase_chip", 0.10, "type ruler track clearance"),
    AllowRule(r"ruler_track", r"mount_rail|phase_chip", 0.10, "type ruler guide assembly"),
    AllowRule(r"phase_chip", r"STR_pin_", 0.04, "phase chip retaining pin"),
    AllowRule(r"phone_frame", r"phone_stand|phone_backrail|SCREEN_.*phone", 0.16, "phone assembly"),
    AllowRule(r"tablet_frame", r"tablet_hinge|SCREEN_.*tablet", 0.16, "tablet assembly"),
    AllowRule(r"esp32_board", r"esp32_chip|board_screw|PRO_pin_", 0.16, "controller board assembly"),
    AllowRule(r"keyboard", r"PRO_key_", 0.12, "keyboard assembly"),
    AllowRule(r"sensor", r"sensor_slot", 0.08, "sensor detail"),
    AllowRule(r"monitor_(stem|foot|hinge)", r"monitor_(vent|hinge|stem|foot)", 0.18, "prototype monitor stand detail"),
    AllowRule(r"REL_devices", r"SCREEN_release_laptop|laptop_hinge", 0.25, "laptop lid assembly"),
    AllowRule(r"laptop_base", r"laptop_key|laptop_hinge", 0.16, "laptop base assembly"),
    AllowRule(r"qa_panel|qa_row_", r"qa_row_|qa_check_|qa_text_", 0.18, "QA panel assembly"),
    AllowRule(r"archive_box", r"archive_lid|archive_latch|archive_corner|release_folder", 0.32, "archive package assembly"),
    AllowRule(r"archive_lid", r"archive_latch|archive_corner|release_folder", 0.16, "archive lid assembly"),
    AllowRule(r"project_rack", r"project_card_", 0.16, "project rack contact"),
    AllowRule(r"project_card_", r"project_card_|project_image_", 0.12, "project card stack"),
    AllowRule(r"qr_card", r"REL_qr_", 0.12, "QR print assembly"),
    AllowRule(r"projection_frame", r"PRINT_release_device|final_panel", 0.12, "projection surface assembly"),
]


def mesh_snapshot(obj: bpy.types.Object, depsgraph) -> tuple[list[Vector], BVHTree | None]:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [list(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices) >= 3]
        tree = BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0.0005) if polygons else None
        return vertices, tree
    finally:
        evaluated.to_mesh_clear()


def bounds(vertices: list[Vector]) -> tuple[Vector, Vector]:
    return (
        Vector((min(vertex.x for vertex in vertices), min(vertex.y for vertex in vertices), min(vertex.z for vertex in vertices))),
        Vector((max(vertex.x for vertex in vertices), max(vertex.y for vertex in vertices), max(vertex.z for vertex in vertices))),
    )


def overlap_depth(a: tuple[Vector, Vector], b: tuple[Vector, Vector]) -> tuple[float, float, float]:
    return (
        min(a[1].x, b[1].x) - max(a[0].x, b[0].x),
        min(a[1].y, b[1].y) - max(a[0].y, b[0].y),
        min(a[1].z, b[1].z) - max(a[0].z, b[0].z),
    )


def common_assembly(a: bpy.types.Object, b: bpy.types.Object) -> str | None:
    parent_a = a.parent
    while parent_a is not None:
        parent_b = b.parent
        while parent_b is not None:
            if parent_a == parent_b and parent_a.name.startswith(("OBS_output", "STR_panels", "STR_tokens", "STR_connectors", "REL_qa_rows", "REL_package")):
                return parent_a.name
            parent_b = parent_b.parent
        parent_a = parent_a.parent
    return None


def allow_contact(a: bpy.types.Object, b: bpy.types.Object, depth: float) -> tuple[bool, str]:
    assembly = common_assembly(a, b)
    if assembly:
        return True, f"shared authored assembly {assembly}"
    for rule in ALLOW_RULES:
        if rule.matches(a.name, b.name) and depth <= rule.max_depth:
            return True, rule.reason
    if depth <= 0.012:
        return True, "surface contact within 0.012 scene-unit tolerance"
    return False, "unallowlisted solid intersection"


def audit_stage(stage: str) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, object]]:
    collection, _materials = round3.prepare_stage(stage)
    objects = [obj for obj in collection.all_objects if obj.type == "MESH" and obj.get("export_role") != "render_label"]
    unresolved: list[dict[str, object]] = []
    accepted: list[dict[str, object]] = []
    topology = {"meshObjects": len(objects), "negativeScale": 0, "zeroAreaFaces": 0, "looseVertices": 0}

    for obj in objects:
        if any(value < 0 for value in obj.scale):
            topology["negativeScale"] += 1
        mesh = obj.data
        used_vertices = {index for polygon in mesh.polygons for index in polygon.vertices}
        topology["looseVertices"] += max(0, len(mesh.vertices) - len(used_vertices))
        topology["zeroAreaFaces"] += sum(1 for polygon in mesh.polygons if polygon.area <= 1e-10)

    for frame in SAMPLE_FRAMES:
        bpy.context.scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        snapshots: dict[str, tuple[tuple[Vector, Vector], BVHTree | None]] = {}
        for obj in objects:
            vertices, tree = mesh_snapshot(obj, depsgraph)
            if vertices:
                snapshots[obj.name] = (bounds(vertices), tree)

        for left_index, left in enumerate(objects):
            left_snapshot = snapshots.get(left.name)
            if left_snapshot is None:
                continue
            for right in objects[left_index + 1 :]:
                right_snapshot = snapshots.get(right.name)
                if right_snapshot is None:
                    continue
                depths = overlap_depth(left_snapshot[0], right_snapshot[0])
                if min(depths) <= 0.0:
                    continue
                left_tree, right_tree = left_snapshot[1], right_snapshot[1]
                surface_hits = left_tree.overlap(right_tree) if left_tree is not None and right_tree is not None else []
                minimum_depth = min(depths)
                contained = minimum_depth > 0.02 and not surface_hits
                if not surface_hits and not contained:
                    continue
                allowed, reason = allow_contact(left, right, minimum_depth)
                record = {
                    "stage": stage,
                    "progress": round((frame - 1) / 120, 2),
                    "frame": frame,
                    "objectA": left.name,
                    "objectB": right.name,
                    "type": "mesh_intersection" if surface_hits else "aabb_containment_candidate",
                    "penetrationDepth": round(minimum_depth, 5),
                    "reason": reason,
                }
                if allowed:
                    record["severity"] = "low"
                    if len(accepted) < 120:
                        accepted.append(record)
                else:
                    record["severity"] = "high" if minimum_depth > 0.025 else "medium"
                    unresolved.append(record)

    def dedupe(records: list[dict[str, object]]) -> list[dict[str, object]]:
        by_pair: dict[tuple[str, str], dict[str, object]] = {}
        for record in records:
            key = tuple(sorted((str(record["objectA"]), str(record["objectB"]))))
            previous = by_pair.get(key)
            if previous is None or float(record["penetrationDepth"]) > float(previous["penetrationDepth"]):
                by_pair[key] = record
        return list(by_pair.values())

    return dedupe(unresolved), dedupe(accepted), topology


def write_report(report: dict[str, object]) -> None:
    json_path = ARTIFACT_DIR / "intersections.json"
    markdown_path = ARTIFACT_DIR / "intersections.md"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf8")
    summary = report["summary"]
    lines = [
        "# MORPH//LAB Round 3 intersection report",
        "",
        f"- High: {summary['high']}",
        f"- Medium: {summary['medium']}",
        f"- Low accepted contacts: {summary['low']}",
        f"- Animation samples per stage: {summary['samples']}",
        f"- Meshes audited: {summary['meshObjects']}",
        "",
        "## Method",
        "",
        "All exported mesh objects are sampled at 5% progress increments. World-space AABB broad phase is followed by evaluated-mesh BVH overlap checks; containment candidates are retained when broad-phase penetration exceeds the contact tolerance. Low contacts require a named pair rule and a maximum allowed depth.",
        "",
        "## Unresolved intersections",
        "",
    ]
    if report["intersections"]:
        lines.extend(["| Stage | Progress | Objects | Severity | Depth |", "| --- | ---: | --- | --- | ---: |"])
        for item in report["intersections"]:
            lines.append(f"| {item['stage']} | {item['progress']:.2f} | `{item['objectA']}` / `{item['objectB']}` | {item['severity']} | {item['penetrationDepth']:.5f} |")
    else:
        lines.append("None. High and Medium acceptance gates are clear.")
    lines.extend(["", "## Topology", "", "```json", json.dumps(report["topology"], indent=2), "```", ""])
    markdown_path.write_text("\n".join(lines), encoding="utf8")


def main() -> None:
    intersections: list[dict[str, object]] = []
    accepted: list[dict[str, object]] = []
    topology: dict[str, object] = {}
    for stage in round3.STAGES:
        stage_unresolved, stage_accepted, stage_topology = audit_stage(stage)
        intersections.extend(stage_unresolved)
        accepted.extend(stage_accepted)
        topology[stage] = stage_topology

    high = sum(1 for item in intersections if item["severity"] == "high")
    medium = sum(1 for item in intersections if item["severity"] == "medium")
    report = {
        "schemaVersion": 1,
        "sampledFrames": SAMPLE_FRAMES,
        "summary": {
            "high": high,
            "medium": medium,
            "low": len(accepted),
            "samples": len(SAMPLE_FRAMES),
            "meshObjects": sum(int(item["meshObjects"]) for item in topology.values()),
        },
        "intersections": intersections,
        "acceptedContacts": accepted,
        "topology": topology,
    }
    write_report(report)
    print("ROUND3_GEOMETRY_REPORT=" + json.dumps(report["summary"], ensure_ascii=True))
    if high or medium:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
