from __future__ import annotations

import json
import math
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round4_assets as round4
import check_round3_geometry as round3check


ARTIFACT_DIR = round4.ARTIFACT_DIR
SAMPLE_PROGRESS = [round(index * 0.025, 3) for index in range(41)]
SAMPLE_FRAMES = [index * 3 for index in range(41)]
SURFACE_PREFIXES = ("SCREEN_", "PRINT_", "REL_project_image_", "BASE_", "GLASS_", "SUBSTRATE_")
PROXY_OBJECTS = {
    "observe": ["OBS_research_table", "OBS_monitor_frame"],
    "structure": ["STR_console", "STR_grid_board"],
    "prototype": ["PRO_test_bench", "PRO_monitor_frame"],
    "release": ["REL_delivery_station", "REL_monitor_frame", "REL_qa_panel"],
}

@dataclass(frozen=True)
class ExplicitAllowRule:
    name: str
    left: str
    right: str
    max_depth: float
    reason: str

    def matches(self, left: str, right: str) -> bool:
        return bool(
            (re.fullmatch(self.left, left) and re.fullmatch(self.right, right))
            or (re.fullmatch(self.left, right) and re.fullmatch(self.right, left))
        )


ROUND4_ALLOW_RULES = [
    ExplicitAllowRule("crop-frame-corner-joint", r"OBS_crop_frame_(top|bottom)", r"OBS_crop_frame_(left|right)", 0.025, "intentional crop-marking frame corner joint"),
    ExplicitAllowRule("scanner-beam-hinge-clearance", r"OBS_scan_beam", r"OBS_lid_hinge_[01]", 0.035, "scanner beam travels through the authored hinge envelope"),
    ExplicitAllowRule("scanner-beam-rail-contact", r"OBS_scan_beam", r"OBS_scanner_rail", 0.045, "scanner beam is physically seated in its guide rail"),
    ExplicitAllowRule("observe-control-key-seat", r"OBS_control_recess", r"OBS_control_key_[0-2]", 0.012, "control key is seated in the scanner control recess"),
    ExplicitAllowRule("observe-control-fastener-seat", r"OBS_control_recess", r"OBS_scanner_screw_[0-3]", 0.012, "scanner fastener is seated at the control recess edge"),
    ExplicitAllowRule("observe-control-bed-seat", r"OBS_control_recess", r"OBS_scanner_bed", 0.015, "control recess is attached to the scanner bed"),
    ExplicitAllowRule("observe-output-crop-overlay", r"OBS_output_card", r"OBS_crop_frame_(top|bottom|left|right)", 0.012, "crop marking is attached to the output-card perimeter"),
    ExplicitAllowRule("monitor-frame-support-joint", r"(OBS|PRO|REL)_monitor_frame", r"(OBS|PRO|REL)_monitor_(stem|hinge)", 0.185, "monitor frame is joined to its authored stem or hinge"),
    ExplicitAllowRule("monitor-stand-joint", r"(OBS|PRO|REL)_monitor_stem", r"(OBS|PRO|REL)_monitor_(foot|hinge)", 0.185, "monitor stem is seated in its authored support"),
    ExplicitAllowRule("monitor-layer-frame-seat", r"(OBS|PRO|REL)_monitor_(frame|hinge)", r"(SCREEN|BASE|GLASS)_(observe_inspection|prototype_monitor|release_monitor)", 0.012, "monitor screen layer is seated within the monitor frame"),
    ExplicitAllowRule("prototype-phone-support-joint", r"PRO_phone_frame", r"PRO_phone_(stand|backrail)", 0.105, "Prototype phone frame is joined to its stand or back rail"),
    ExplicitAllowRule("prototype-phone-layer-frame-seat", r"PRO_phone_frame", r"(SCREEN|BASE|GLASS)_prototype_phone", 0.012, "Prototype phone screen layer is seated within the frame"),
    ExplicitAllowRule("prototype-phone-button-seat", r"PRO_device_button_[01]", r"(PRO_phone_frame|(SCREEN|BASE|GLASS)_prototype_phone)", 0.025, "Prototype phone button is seated at the frame edge"),
    ExplicitAllowRule("prototype-tablet-hinge-joint", r"PRO_tablet_frame", r"PRO_tablet_hinge", 0.075, "Prototype tablet frame is joined to its hinge"),
    ExplicitAllowRule("prototype-tablet-layer-frame-seat", r"PRO_tablet_frame", r"(SCREEN|BASE|GLASS)_prototype_tablet", 0.012, "Prototype tablet screen layer is seated within the frame"),
    ExplicitAllowRule("prototype-cursor-monitor-layer", r"PRO_cursor", r"(SCREEN|GLASS)_prototype_monitor", 0.012, "Prototype cursor is an authored monitor-content overlay"),
    ExplicitAllowRule("structure-phase-chip-rail-seat", r"STR_phase_chip", r"STR_mount_rail_[0-4]", 0.016, "phase chip seats against the system-wall mount rail"),
    ExplicitAllowRule("structure-display-panel-seat", r"(SCREEN|BASE|GLASS)_structure_system", r"STR_(final_panel|mount_rail_3)", 0.012, "Structure display layers are attached to the final panel and display rail"),
    ExplicitAllowRule("structure-panel-clip-seat", r"STR_final_panel", r"STR_(card_clip_9|panel_2)", 0.012, "Structure final panel is retained by its adjacent clip and panel"),
    ExplicitAllowRule("structure-type-bar-clip-seat", r"STR_type_bar_0", r"STR_card_clip_0", 0.012, "type-ruler bar is retained by its authored card clip"),
    ExplicitAllowRule("release-laptop-lid-joint", r"REL_devices", r"REL_laptop_hinge", 0.075, "Release laptop lid is joined to its hinge"),
    ExplicitAllowRule("release-laptop-layer-lid-seat", r"REL_devices", r"(SCREEN|BASE|GLASS)_release_laptop", 0.125, "Release laptop screen layers are attached to the animated lid"),
    ExplicitAllowRule("release-phone-stand-joint", r"REL_phone_frame", r"REL_phone_stand", 0.105, "Release phone frame is joined to its stand"),
    ExplicitAllowRule("release-package-safety-guide-seat", r"REL_archive_box", r"REL_package_safety_guide_[0-2]", 0.085, "package safety guide attaches to archive box interior"),
    ExplicitAllowRule("release-status-tag-channel-mount", r"REL_cable_channel", r"REL_status_tag_[01]", 0.025, "status tag mounts to the delivery-station cable channel"),
]


def mesh_snapshot(obj: bpy.types.Object, depsgraph) -> tuple[list[Vector], BVHTree | None]:
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        matrix = evaluated.matrix_world
        vertices = [matrix @ vertex.co for vertex in mesh.vertices]
        polygons = [list(polygon.vertices) for polygon in mesh.polygons if len(polygon.vertices) >= 3]
        tree = BVHTree.FromPolygons(vertices, polygons, all_triangles=False, epsilon=0.00025) if polygons else None
        return vertices, tree
    finally:
        evaluated.to_mesh_clear()


def bounds(vertices: list[Vector]) -> tuple[Vector, Vector]:
    return (
        Vector(tuple(min(vertex[index] for vertex in vertices) for index in range(3))),
        Vector(tuple(max(vertex[index] for vertex in vertices) for index in range(3))),
    )


def bounds_payload(obj: bpy.types.Object, root: bpy.types.Object) -> dict[str, object]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    ancestors: list[str] = []
    ancestor = obj.parent
    while ancestor is not None:
        ancestors.append(ancestor.name)
        ancestor = ancestor.parent
    return {
        "name": obj.name,
        "collisionProxy": obj.get("collisionProxy", "evaluated-mesh"),
        "boundsMin": [round(min(point[index] for point in points), 5) for index in range(3)],
        "boundsMax": [round(max(point[index] for point in points), 5) for index in range(3)],
        "stageRoot": root.name,
        "rootOwned": root.name in ancestors,
        "ancestorPath": ancestors,
    }


def overlap_depth(left: tuple[Vector, Vector], right: tuple[Vector, Vector]) -> tuple[float, float, float]:
    return tuple(min(left[1][index], right[1][index]) - max(left[0][index], right[0][index]) for index in range(3))


def allow_contact(left: bpy.types.Object, right: bpy.types.Object, depth: float) -> tuple[bool, str | None, float | None, str]:
    for rule in ROUND4_ALLOW_RULES:
        if rule.matches(left.name, right.name) and depth <= rule.max_depth:
            return True, rule.name, rule.max_depth, rule.reason
    for index, rule in enumerate(round3check.ALLOW_RULES):
        if rule.matches(left.name, right.name) and depth <= rule.max_depth:
            return True, f"round3-physical-contact-{index:02d}", rule.max_depth, rule.reason
    return False, None, None, "unmatched contact: no explicit object/category pair rule"


def allow_rule_manifest() -> list[dict[str, object]]:
    rules = [
        {
            "name": rule.name,
            "objectPatternA": rule.left,
            "objectPatternB": rule.right,
            "maxPenetrationDepth": rule.max_depth,
            "reason": rule.reason,
            "source": "round4",
        }
        for rule in ROUND4_ALLOW_RULES
    ]
    rules.extend(
        {
            "name": f"round3-physical-contact-{index:02d}",
            "objectPatternA": rule.left,
            "objectPatternB": rule.right,
            "maxPenetrationDepth": rule.max_depth,
            "reason": rule.reason,
            "source": "round3-derived",
        }
        for index, rule in enumerate(round3check.ALLOW_RULES)
    )
    return rules


def topology_audit(objects: list[bpy.types.Object]) -> dict[str, int]:
    result = {
        "meshCount": len(objects),
        "negativeScale": 0,
        "unappliedRotationScale": 0,
        "looseVertices": 0,
        "zeroAreaFaces": 0,
        "nonManifoldEdges": 0,
        "internalFaces": 0,
        "coplanarPairs": 0,
        "duplicateMaterialSlots": 0,
        "invalidMeshes": 0,
        "solidMeshesUsingDoubleSide": 0,
    }
    surface_objects: list[bpy.types.Object] = []
    for obj in objects:
        if any(value < -1e-7 for value in obj.scale):
            result["negativeScale"] += 1
        rotation_applied = all(abs(value) <= 1e-6 for value in obj.rotation_euler)
        scale_applied = all(abs(value - 1.0) <= 1e-6 for value in obj.scale)
        if not rotation_applied or not scale_applied:
            result["unappliedRotationScale"] += 1
        mesh = obj.data
        used_vertices = {index for polygon in mesh.polygons for index in polygon.vertices}
        result["looseVertices"] += max(0, len(mesh.vertices) - len(used_vertices))
        result["zeroAreaFaces"] += sum(1 for polygon in mesh.polygons if polygon.area <= 1e-10)
        role = str(obj.get("surfaceRole", ""))
        is_surface = bool(role) or obj.name.startswith(SURFACE_PREFIXES)
        if is_surface:
            surface_objects.append(obj)
        else:
            edge_uses: dict[tuple[int, int], int] = {}
            for polygon in mesh.polygons:
                indices = list(polygon.vertices)
                for index, vertex in enumerate(indices):
                    key = tuple(sorted((vertex, indices[(index + 1) % len(indices)])))
                    edge_uses[key] = edge_uses.get(key, 0) + 1
            result["nonManifoldEdges"] += sum(1 for uses in edge_uses.values() if uses != 2)
        material_names = [slot.material.name for slot in obj.material_slots if slot.material is not None]
        result["duplicateMaterialSlots"] += len(material_names) - len(set(material_names))
        if any(slot.material is not None and not slot.material.use_backface_culling for slot in obj.material_slots) and not is_surface:
            result["solidMeshesUsingDoubleSide"] += 1
        face_keys: set[tuple[tuple[float, float, float], ...]] = set()
        for polygon in mesh.polygons:
            key = tuple(sorted(tuple(round(value, 6) for value in mesh.vertices[index].co) for index in polygon.vertices))
            if key in face_keys:
                result["internalFaces"] += 1
            face_keys.add(key)
        probe = mesh.copy()
        if probe.validate(verbose=False, clean_customdata=False):
            result["invalidMeshes"] += 1
        bpy.data.meshes.remove(probe)

    for index, left in enumerate(surface_objects):
        left_center = left.matrix_world.translation
        for right in surface_objects[index + 1:]:
            if left.parent != right.parent:
                continue
            if (left_center - right.matrix_world.translation).length <= 0.001:
                result["coplanarPairs"] += 1
    return result


def surface_state(stage: str) -> dict[str, object]:
    failures: list[dict[str, object]] = []
    samples: list[dict[str, object]] = []
    for progress, frame in zip(SAMPLE_PROGRESS, SAMPLE_FRAMES):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for content_name, (parent_name, _members) in round4.SCREEN_DEVICES[stage].items():
            content = bpy.data.objects[content_name]
            base = bpy.data.objects[f"BASE_{content_name.removeprefix('SCREEN_')}"]
            glass = bpy.data.objects[f"GLASS_{content_name.removeprefix('SCREEN_')}"]
            parents = {item.parent.name if item.parent else None for item in (base, content, glass)}
            base_gap = (content.matrix_world.translation - base.matrix_world.translation).length
            glass_gap = (glass.matrix_world.translation - content.matrix_world.translation).length
            passed = parents == {parent_name} and 0.004 <= base_gap <= 0.008 and 0.004 <= glass_gap <= 0.008
            sample = {
                "stage": stage, "progress": progress, "target": content_name,
                "parent": next(iter(parents)) if len(parents) == 1 else sorted(str(value) for value in parents),
                "baseGap": round(base_gap, 6), "glassGap": round(glass_gap, 6), "pass": passed,
            }
            samples.append(sample)
            if not passed:
                failures.append(sample)
        for content_name in round4.PRINT_TARGETS[stage]:
            content = bpy.data.objects[content_name]
            substrate = bpy.data.objects[f"SUBSTRATE_{content_name}"]
            gap = (content.matrix_world.translation - substrate.matrix_world.translation).length
            passed = content.parent == substrate.parent and 0.004 <= gap <= 0.008
            sample = {"stage": stage, "progress": progress, "target": content_name, "substrateGap": round(gap, 6), "pass": passed}
            samples.append(sample)
            if not passed:
                failures.append(sample)
    return {"status": "pass" if not failures else "fail", "failures": failures, "samples": samples}


def environment_checks(stage: str, collection: bpy.types.Collection) -> dict[str, object]:
    camera = bpy.context.scene.camera
    camera_result: dict[str, object]
    if camera is None:
        camera_result = {"status": "fail", "reason": "render camera missing"}
    else:
        mesh_centers = [obj.matrix_world.translation for obj in collection.all_objects if obj.type == "MESH"]
        nearest = min((center - camera.matrix_world.translation).length for center in mesh_centers)
        camera_result = {
            "status": "pass" if nearest > camera.data.clip_start else "fail",
            "clipStart": round(camera.data.clip_start, 6),
            "nearestObjectOrigin": round(nearest, 6),
        }
    missing_proxies = [name for name in PROXY_OBJECTS[stage] if bpy.data.objects.get(name) is None]
    exported = set(collection.all_objects)
    external_meshes = [obj.name for obj in bpy.context.scene.objects if obj.type == "MESH" and obj not in exported and not obj.name.startswith("RENDER_floor")]
    double_sided_solids = [
        obj.name for obj in collection.all_objects if obj.type == "MESH" and not obj.get("surfaceRole")
        and any(slot.material is not None and not slot.material.use_backface_culling for slot in obj.material_slots)
    ]
    root = bpy.data.objects[f"ROOT_{stage.upper()}"]
    root_offenders: list[str] = []
    for obj in collection.all_objects:
        if obj == root or obj.get("export_role") == "render_label":
            continue
        ancestor = obj.parent
        while ancestor is not None and ancestor != root:
            ancestor = ancestor.parent
        if ancestor != root:
            root_offenders.append(obj.name)
    exported_top_level = [
        obj.name for obj in collection.objects
        if obj.get("export_role") != "render_label" and obj.parent is None
    ]
    return {
        "cameraNearPlane": camera_result,
        "monitorPanelWorkbenchProxy": {"status": "pass" if not missing_proxies else "fail", "objects": PROXY_OBJECTS[stage], "missing": missing_proxies},
        "externalOcclusion": {"status": "pass" if not external_meshes else "fail", "externalMeshes": external_meshes},
        "internalSurfaceExposure": {"status": "pass" if not double_sided_solids else "fail", "doubleSidedSolids": double_sided_solids},
        "stageRootOwnership": {
            "status": "pass" if not root_offenders and exported_top_level == [root.name] else "fail",
            "stageRoot": root.name,
            "exportedTopLevelObjects": exported_top_level,
            "offenders": sorted(root_offenders),
        },
    }


def audit_stage(stage: str) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, int], dict[str, object], dict[str, object], list[dict[str, object]]]:
    collection, _materials = round4.prepare_stage(stage)
    bpy.context.scene.frame_set(120)
    objects = [obj for obj in collection.all_objects if obj.type == "MESH" and obj.get("export_role") != "render_label"]
    topology = topology_audit(objects)
    surfaces = surface_state(stage)
    environment = environment_checks(stage, collection)
    root = bpy.data.objects[f"ROOT_{stage.upper()}"]
    collision_metadata = [bounds_payload(obj, root) for obj in objects]
    unresolved: list[dict[str, object]] = []
    accepted: list[dict[str, object]] = []

    for progress, frame in zip(SAMPLE_PROGRESS, SAMPLE_FRAMES):
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
            for right in objects[left_index + 1:]:
                right_snapshot = snapshots.get(right.name)
                if right_snapshot is None:
                    continue
                depths = overlap_depth(left_snapshot[0], right_snapshot[0])
                if min(depths) <= 0.0:
                    continue
                left_tree, right_tree = left_snapshot[1], right_snapshot[1]
                surface_hits = left_tree.overlap(right_tree) if left_tree is not None and right_tree is not None else []
                minimum_depth = min(depths)
                both_surfaces = bool(left.get("surfaceRole")) and bool(right.get("surfaceRole"))
                contained = minimum_depth > 0.02 and not surface_hits and not both_surfaces
                if not surface_hits and not contained:
                    continue
                allowed, allow_rule, max_allowed_depth, reason = allow_contact(left, right, minimum_depth)
                record = {
                    "stage": stage,
                    "progress": progress,
                    "objectA": left.name,
                    "objectB": right.name,
                    "penetrationDepth": round(minimum_depth, 6),
                    "severity": "low" if allowed else ("high" if minimum_depth > 0.025 else "medium"),
                    "collisionProxy": [left.get("collisionProxy", "evaluated-mesh"), right.get("collisionProxy", "evaluated-mesh")],
                    "allowRule": allow_rule,
                    "maxAllowedDepth": max_allowed_depth,
                    "reason": reason,
                }
                (accepted if allowed else unresolved).append(record)

    def dedupe(records: list[dict[str, object]]) -> list[dict[str, object]]:
        by_pair: dict[tuple[str, str], dict[str, object]] = {}
        for record in records:
            key = tuple(sorted((str(record["objectA"]), str(record["objectB"]))))
            previous = by_pair.get(key)
            if previous is None or float(record["penetrationDepth"]) > float(previous["penetrationDepth"]):
                by_pair[key] = record
        return sorted(by_pair.values(), key=lambda item: (str(item["objectA"]), str(item["objectB"])))

    return dedupe(unresolved), dedupe(accepted), topology, surfaces, environment, collision_metadata


def write_markdown(report: dict[str, object]) -> None:
    summary = report["summary"]
    lines = [
        "# MORPH//LAB Round 4 geometry and intersection audit", "",
        f"- High: {summary['high']}", f"- Medium: {summary['medium']}",
        f"- Allow-listed Low: {summary['low']}", f"- States per stage: {summary['samples']}",
        f"- Meshes audited: {summary['meshCount']}", "", "## Unresolved intersections", "",
    ]
    if report["intersections"]:
        lines.extend(["| Stage | Progress | Objects | Severity | Depth | Reason |", "| --- | ---: | --- | --- | ---: | --- |"])
        for item in report["intersections"]:
            lines.append(f"| {item['stage']} | {item['progress']:.3f} | `{item['objectA']}` / `{item['objectB']}` | {item['severity']} | {item['penetrationDepth']:.6f} | {item['reason']} |")
    else:
        lines.append("None. High and Medium gates are clear.")
    lines.extend(["", "## Topology", "", "```json", json.dumps(report["topology"], indent=2), "```", "", "## Environment checks", "", "```json", json.dumps(report["environmentChecks"], indent=2), "```", ""])
    (ARTIFACT_DIR / "intersections.md").write_text("\n".join(lines), encoding="utf8")


def main() -> None:
    intersections: list[dict[str, object]] = []
    accepted: list[dict[str, object]] = []
    topology: dict[str, dict[str, int]] = {}
    surface_checks: dict[str, object] = {}
    environment: dict[str, object] = {}
    collision_metadata: dict[str, object] = {}
    for stage in round4.STAGES:
        stage_unresolved, stage_accepted, stage_topology, stage_surfaces, stage_environment, stage_collision = audit_stage(stage)
        intersections.extend(stage_unresolved)
        accepted.extend(stage_accepted)
        topology[stage] = stage_topology
        surface_checks[stage] = stage_surfaces
        environment[stage] = stage_environment
        collision_metadata[stage] = stage_collision

    high = sum(1 for item in intersections if item["severity"] == "high")
    medium = sum(1 for item in intersections if item["severity"] == "medium")
    topology_errors = sum(
        value for stage_result in topology.values() for key, value in stage_result.items()
        if key != "meshCount"
    )
    surface_failures = sum(len(stage_result["failures"]) for stage_result in surface_checks.values())
    environment_failures = sum(
        1 for stage_result in environment.values() for check in stage_result.values() if check["status"] != "pass"
    )
    report = {
        "schemaVersion": 2,
        "sampleProgress": SAMPLE_PROGRESS,
        "sampleFrames": SAMPLE_FRAMES,
        "summary": {
            "high": high, "medium": medium, "low": len(accepted), "samples": len(SAMPLE_PROGRESS),
            "meshCount": sum(item["meshCount"] for item in topology.values()),
            "topologyErrors": topology_errors, "surfaceFailures": surface_failures, "environmentFailures": environment_failures,
        },
        "intersections": intersections,
        "acceptedContacts": accepted,
        "explicitAllowRules": allow_rule_manifest(),
        "topology": topology,
        "surfaceLayerChecks": surface_checks,
        "environmentChecks": environment,
    }
    (ARTIFACT_DIR / "intersections.json").write_text(json.dumps(report, indent=2), encoding="utf8")
    (ARTIFACT_DIR / "collision-metadata.json").write_text(json.dumps({"schemaVersion": 1, "stages": collision_metadata}, indent=2), encoding="utf8")
    write_markdown(report)
    print("ROUND4_GEOMETRY_REPORT=" + json.dumps(report["summary"], ensure_ascii=True))
    if high or medium or topology_errors or surface_failures or environment_failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
