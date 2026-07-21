from __future__ import annotations

import json
import math
import re
import sys
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

ROUND4_ALLOW_RULES = [
    (r"OBS_crop_frame_(top|bottom)", r"OBS_crop_frame_(left|right)", 0.025, "crop-frame-corner-joint", "intentional crop-marking frame corner joint"),
    (r"OBS_scan_beam", r"OBS_lid_hinge_", 0.035, "scanner-beam-hinge-clearance", "scanner beam travels through the authored hinge envelope"),
    (r"OBS_scan_beam", r"OBS_scanner_rail", 0.045, "scanner-beam-rail-contact", "scanner beam is physically seated in its guide rail"),
    (r"STR_phase_chip", r"STR_mount_rail_", 0.016, "phase-chip-rail-seat", "phase chip seats against the system-wall mount rail"),
    (r"PRO_phone_frame", r"PRO_device_button_", 0.025, "phone-button-seat", "device button is seated in the phone frame"),
    (r"REL_archive_box", r"REL_package_safety_guide_", 0.085, "package-safety-guide-seat", "package safety guide attaches to archive box interior"),
    (r"REL_cable_channel", r"REL_status_tag_", 0.025, "status-tag-channel-mount", "status tag mounts to the delivery-station cable channel"),
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


def bounds_payload(obj: bpy.types.Object) -> dict[str, object]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "name": obj.name,
        "collisionProxy": obj.get("collisionProxy", "evaluated-mesh"),
        "boundsMin": [round(min(point[index] for point in points), 5) for index in range(3)],
        "boundsMax": [round(max(point[index] for point in points), 5) for index in range(3)],
    }


def overlap_depth(left: tuple[Vector, Vector], right: tuple[Vector, Vector]) -> tuple[float, float, float]:
    return tuple(min(left[1][index], right[1][index]) - max(left[0][index], right[0][index]) for index in range(3))


def allow_contact(left: bpy.types.Object, right: bpy.types.Object, depth: float) -> tuple[bool, str | None, str]:
    layer_names = (left.name, right.name)
    if all(name.startswith(SURFACE_PREFIXES) for name in layer_names):
        return True, "surface-layer-attachment", "authored base/content/glass or print substrate attachment"
    if left.parent is not None and left.parent == right.parent and left.parent.get("assemblyRole") == "device":
        return True, "device-parent-contact", f"intentional device assembly under {left.parent.name}"
    for left_pattern, right_pattern, max_depth, rule_name, reason in ROUND4_ALLOW_RULES:
        matches = ((re.search(left_pattern, left.name) and re.search(right_pattern, right.name))
                   or (re.search(left_pattern, right.name) and re.search(right_pattern, left.name)))
        if matches and depth <= max_depth:
            return True, rule_name, reason
    for index, rule in enumerate(round3check.ALLOW_RULES):
        if rule.matches(left.name, right.name) and depth <= rule.max_depth:
            return True, f"round3-physical-contact-{index:02d}", rule.reason
    if depth <= 0.012:
        return True, "layer-attachment-tolerance", "intentional attachment within 0.012 scene-unit seating tolerance"
    return False, None, "unallowlisted solid intersection"


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
    return {
        "cameraNearPlane": camera_result,
        "monitorPanelWorkbenchProxy": {"status": "pass" if not missing_proxies else "fail", "objects": PROXY_OBJECTS[stage], "missing": missing_proxies},
        "externalOcclusion": {"status": "pass" if not external_meshes else "fail", "externalMeshes": external_meshes},
        "internalSurfaceExposure": {"status": "pass" if not double_sided_solids else "fail", "doubleSidedSolids": double_sided_solids},
    }


def audit_stage(stage: str) -> tuple[list[dict[str, object]], list[dict[str, object]], dict[str, int], dict[str, object], dict[str, object], list[dict[str, object]]]:
    collection, _materials = round4.prepare_stage(stage)
    bpy.context.scene.frame_set(120)
    objects = [obj for obj in collection.all_objects if obj.type == "MESH" and obj.get("export_role") != "render_label"]
    topology = topology_audit(objects)
    surfaces = surface_state(stage)
    environment = environment_checks(stage, collection)
    collision_metadata = [bounds_payload(obj) for obj in objects]
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
                contained = minimum_depth > 0.02 and not surface_hits
                if not surface_hits and not contained:
                    continue
                allowed, allow_rule, reason = allow_contact(left, right, minimum_depth)
                record = {
                    "stage": stage,
                    "progress": progress,
                    "objectA": left.name,
                    "objectB": right.name,
                    "penetrationDepth": round(minimum_depth, 6),
                    "severity": "low" if allowed else ("high" if minimum_depth > 0.025 else "medium"),
                    "collisionProxy": [left.get("collisionProxy", "evaluated-mesh"), right.get("collisionProxy", "evaluated-mesh")],
                    "allowRule": allow_rule,
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
