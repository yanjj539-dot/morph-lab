from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round3_assets as r3


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models" / "round-4"
FALLBACK_DIR = ROOT / "public" / "fallback" / "round-4"
ARTIFACT_DIR = ROOT / "artifacts" / "qa-round4"

for directory in (MODEL_DIR, FALLBACK_DIR, ARTIFACT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class StageSpec:
    clip_name: str
    animated_parent: str
    focus: tuple[float, float, float]


STAGES = {
    "observe": StageSpec("OBSERVE_ACTION", "OBS_scan_beam", (0.0, 0.0, 0.95)),
    "structure": StageSpec("STRUCTURE_ACTION", "STR_panels", (0.0, 0.35, 1.75)),
    "prototype": StageSpec("PROTOTYPE_ACTION", "PRO_ui_layer", (-0.15, 0.0, 1.25)),
    "release": StageSpec("RELEASE_ACTION", "REL_devices", (0.0, 0.0, 1.25)),
}


INVENTORY = {
    "observe": {
        "primary": ["OBS_research_table", "OBS_scanner_body"],
        "secondary": ["OBS_monitor_frame", "OBS_folder", "OBS_material_tray", "OBS_papers", "OBS_output_assembly"],
        "tertiary": [
            "OBS_lid_hinge_0", "OBS_scanner_screw_0", "OBS_paper_guide_0", "OBS_tray_divider_0",
            "OBS_clip_0", "OBS_table_leg_-2.65_-1.25", "OBS_table_seam", "OBS_control_recess",
            "OBS_control_key_0", "OBS_status_window", "OBS_scanner_rail", "OBS_folder_tab",
        ],
    },
    "structure": {
        "primary": ["STR_console", "STR_grid_board"],
        "secondary": ["STR_panels", "STR_token_dock", "STR_type_ruler", "STR_control_strip", "STR_booklet"],
        "tertiary": [
            "STR_mount_rail_0", "STR_card_clip_0", "STR_base_bolt_0", "STR_token_slot_0",
            "STR_pin_0", "STR_console_seam", "STR_connector_0", "STR_ruler_track",
            "STR_phase_chip", "STR_grid_h_0", "STR_grid_v_0", "STR_booklet_band",
        ],
    },
    "prototype": {
        "primary": ["PRO_test_bench", "PRO_keyboard"],
        "secondary": ["PRO_monitor_frame", "PRO_phone_frame", "PRO_tablet_frame", "PRO_esp32_board", "PRO_sensor", "PRO_light_ring"],
        "tertiary": [
            "PRO_monitor_vent_0", "PRO_monitor_hinge", "PRO_phone_backrail", "PRO_rubber_foot_0",
            "PRO_sensor_slot_0", "PRO_pin_0", "PRO_board_screw_1", "PRO_key_0_0",
            "PRO_bench_seam", "PRO_tablet_hinge", "PRO_phone_stand", "PRO_trackpad",
        ],
    },
    "release": {
        "primary": ["REL_delivery_station", "REL_archive_box"],
        "secondary": ["REL_monitor_frame", "REL_laptop_base", "REL_phone_frame", "REL_project_rack", "REL_qa_panel", "REL_final_panel"],
        "tertiary": [
            "REL_laptop_hinge", "REL_laptop_key_0", "REL_archive_corner_0", "REL_archive_latch",
            "REL_cable_channel", "REL_station_bolt_0", "REL_qr_0_0", "REL_package_safety_guide_0",
            "REL_status_tag_0", "REL_station_seam", "REL_phone_stand", "REL_project_card_0",
        ],
    },
}


EVENTS = {
    "observe": [
        ("material_arrival", 0, 28, "primary", "OBS_papers"),
        ("scanner_beam", 32, 70, "secondary", "OBS_scan_beam"),
        ("output_card", 74, 102, "secondary", "OBS_output_assembly"),
        ("crop_marking", 106, 120, "secondary", "OBS_crop_frame"),
    ],
    "structure": [
        ("panels_attach", 0, 36, "primary", "STR_panels"),
        ("token_seats", 40, 68, "secondary", "STR_tokens"),
        ("connectors_establish", 72, 96, "secondary", "STR_connectors"),
        ("wireframe_final_panel_resolves", 100, 120, "secondary", "STR_final_panel"),
    ],
    "prototype": [
        ("monitor_ui_starts", 0, 28, "primary", "PRO_ui_layer"),
        ("cursor_moves", 32, 56, "secondary", "PRO_cursor"),
        ("phone_syncs", 60, 80, "secondary", "PRO_phone_device"),
        ("sensor_triggers", 84, 100, "secondary", "PRO_sensor"),
        ("light_ring_responds", 104, 120, "secondary", "PRO_light_ring"),
    ],
    "release": [
        ("qa_rows_pass", 0, 28, "primary", "REL_qa_rows"),
        ("draft_becomes_live", 32, 52, "secondary", "REL_version"),
        ("devices_synchronize", 56, 76, "secondary", "REL_devices"),
        ("package_closes_after_safe", 80, 104, "secondary", "REL_package_lid"),
        ("final_panel_opens", 108, 120, "secondary", "REL_final_panel"),
    ],
}


SCREEN_DEVICES = {
    "observe": {
        "SCREEN_observe_inspection": ("OBS_inspection_device", ["OBS_monitor_frame", "OBS_monitor_stem", "OBS_monitor_foot"]),
    },
    "structure": {
        "SCREEN_structure_system": ("STR_system_device", ["STR_panel_4"]),
    },
    "prototype": {
        "SCREEN_prototype_monitor": ("PRO_monitor_device", ["PRO_monitor_frame", "PRO_monitor_stem", "PRO_monitor_foot", "PRO_monitor_hinge"]),
        "SCREEN_prototype_phone": ("PRO_phone_device", ["PRO_phone_frame", "PRO_phone_stand", "PRO_phone_backrail"]),
        "SCREEN_prototype_tablet": ("PRO_tablet_device", ["PRO_tablet_frame", "PRO_tablet_hinge"]),
    },
    "release": {
        "SCREEN_release_monitor": ("REL_monitor_device", ["REL_monitor_frame", "REL_monitor_stem", "REL_monitor_foot"]),
        "SCREEN_release_laptop": ("REL_laptop_device", ["REL_devices", "REL_laptop_hinge"]),
        "SCREEN_release_phone": ("REL_phone_device", ["REL_phone_frame", "REL_phone_stand"]),
    },
}

PRINT_TARGETS = {
    "observe": ["PRINT_observe_persona", "PRINT_observe_output"],
    "structure": [],
    "prototype": [],
    "release": ["PRINT_release_device", "REL_project_image_0", "REL_project_image_1", "REL_project_image_2"],
}


def create_device_parent(name: str, collection: bpy.types.Collection, members: list[str]) -> bpy.types.Object:
    parent = bpy.data.objects.get(name)
    if parent is None:
        parent = r3.r2.parent_empty(name, collection)
    parent["assemblyRole"] = "device"
    for member_name in members:
        member = bpy.data.objects.get(member_name)
        if member is not None and member != parent:
            r3.parent_keep_world(member, parent)
    return parent


def duplicate_surface(
    source: bpy.types.Object,
    name: str,
    material: bpy.types.Material,
    local_normal_offset: float,
    role: str,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    layer = source.copy()
    layer.data = source.data.copy()
    layer.name = name
    layer.data.name = f"{name}_mesh"
    layer.animation_data_clear()
    layer.data.materials.clear()
    layer.data.materials.append(material)
    collection.objects.link(layer)
    layer.matrix_world = source.matrix_world @ Matrix.Translation((0.0, 0.0, local_normal_offset))
    layer["surfaceRole"] = role
    layer["surfaceTarget"] = source.name
    layer["layerSeparation"] = abs(local_normal_offset)
    layer["collisionProxy"] = "surface"
    return layer


def add_screen_layers(stage: str, collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    for content_name, (parent_name, members) in SCREEN_DEVICES[stage].items():
        content = bpy.data.objects[content_name]
        parent = create_device_parent(parent_name, collection, [*members, content_name])
        if content.parent != parent:
            r3.parent_keep_world(content, parent)
        content["surfaceRole"] = "content"
        content["collisionProxy"] = "surface"
        base = duplicate_surface(content, f"BASE_{content_name.removeprefix('SCREEN_')}", materials["screen"], -0.006, "base", collection)
        glass = duplicate_surface(content, f"GLASS_{content_name.removeprefix('SCREEN_')}", materials["glass"], 0.006, "glass", collection)
        for layer in (base, glass):
            if layer.parent != parent:
                r3.parent_keep_world(layer, parent)
        parent["contentTarget"] = content_name
        parent["baseLayer"] = base.name
        parent["glassLayer"] = glass.name


def add_print_substrates(stage: str, collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    for content_name in PRINT_TARGETS[stage]:
        content = bpy.data.objects[content_name]
        content["surfaceRole"] = "printContent"
        content["collisionProxy"] = "surface"
        substrate_name = f"SUBSTRATE_{content_name}"
        substrate = duplicate_surface(content, substrate_name, materials["paper"], -0.006, "printSubstrate", collection)
        substrate["physicalSubstrate"] = True


def finalize_root_hierarchy(stage: str, collection: bpy.types.Collection) -> bpy.types.Object:
    root = bpy.data.objects[f"ROOT_{stage.upper()}"]
    for obj in list(collection.objects):
        if obj == root or obj.parent is not None or obj.get("export_role") == "render_label":
            continue
        r3.parent_keep_world(obj, root)
    bpy.context.view_layer.update()
    for obj in collection.all_objects:
        if obj == root or obj.get("export_role") == "render_label":
            continue
        ancestor = obj.parent
        while ancestor is not None and ancestor != root:
            ancestor = ancestor.parent
        if ancestor != root:
            raise RuntimeError(f"Round 4 object is outside {root.name}: {obj.name}")
    return root


def add_round4_details(stage: str, collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    if stage == "structure":
        for index in range(3):
            r3.r2.rounded_box(
                f"STR_connector_guide_{index}", (0.18, 0.08, 0.08),
                (-0.55 + index * 0.55, 0.27, 1.05 + index * 0.52), materials["metal"], collection, 0.014,
            )["detail_tier"] = "tertiary"
    elif stage == "prototype":
        for index in range(3):
            r3.r2.rounded_box(
                f"PRO_cable_clip_{index}", (0.16, 0.08, 0.06),
                (-1.2 + index * 0.65, 1.34, 0.44), materials["metal"], collection, 0.014,
            )["detail_tier"] = "tertiary"
        for index in range(2):
            r3.r2.cylinder(
                f"PRO_device_button_{index}", 0.04, 0.024,
                (1.82 + index * 0.13, -0.64, 0.56), materials["coral"], collection, vertices=16,
            )["detail_tier"] = "tertiary"
    elif stage == "release":
        for index, x in enumerate((-0.58, 0.04, 0.66)):
            r3.r2.rounded_box(
                f"REL_package_safety_guide_{index}", (0.08, 0.62, 0.12),
                (x, -1.0, 0.66), materials["metal"], collection, 0.018,
            )["detail_tier"] = "tertiary"
        for index, x in enumerate((-2.10, -1.75)):
            r3.r2.rounded_box(
                f"REL_status_tag_{index}", (0.24, 0.05, 0.10),
                (x, 1.23, 0.49), materials["coral" if index == 0 else "green"], collection, 0.012,
            )["detail_tier"] = "tertiary"


def clear_actions() -> None:
    for obj in bpy.data.objects:
        obj.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def clean_mesh_object(obj: bpy.types.Object) -> None:
    child_world = [(child, child.matrix_world.copy()) for child in obj.children]
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    for child, matrix in child_world:
        child.matrix_world = matrix

    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.00001)
    if bm.faces:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.validate(verbose=False, clean_customdata=True)
    mesh.update(calc_edges=True)
    for material in mesh.materials:
        if material is not None:
            material.use_backface_culling = True


def clean_geometry(collection: bpy.types.Collection) -> None:
    clear_actions()
    bpy.context.scene.frame_set(120)
    mesh_objects = [obj for obj in collection.all_objects if obj.type == "MESH" and obj.get("export_role") != "render_label"]
    def parent_depth(item: bpy.types.Object) -> int:
        depth = 0
        parent = item.parent
        while parent is not None:
            depth += 1
            parent = parent.parent
        return depth

    for obj in sorted(mesh_objects, key=parent_depth):
        clean_mesh_object(obj)


def animate_transform(
    obj: bpy.types.Object,
    action_name: str,
    frames: tuple[int, int, int],
    start_location: Vector | None = None,
    end_location: Vector | None = None,
    start_rotation: Vector | None = None,
    end_rotation: Vector | None = None,
    start_scale: Vector | None = None,
    end_scale: Vector | None = None,
) -> None:
    neutral_location = obj.location.copy()
    neutral_rotation = obj.rotation_euler.copy()
    neutral_scale = obj.scale.copy()
    first, settle, last = frames
    obj.location = start_location.copy() if start_location is not None else neutral_location
    obj.rotation_euler = start_rotation.copy() if start_rotation is not None else neutral_rotation
    obj.scale = start_scale.copy() if start_scale is not None else neutral_scale
    for path in ("location", "rotation_euler", "scale"):
        obj.keyframe_insert(data_path=path, frame=first)
    obj.location = end_location.copy() if end_location is not None else neutral_location
    obj.rotation_euler = end_rotation.copy() if end_rotation is not None else neutral_rotation
    obj.scale = end_scale.copy() if end_scale is not None else neutral_scale
    for frame in (settle, last):
        for path in ("location", "rotation_euler", "scale"):
            obj.keyframe_insert(data_path=path, frame=frame)
    action = obj.animation_data.action if obj.animation_data else None
    if action is None:
        raise RuntimeError(f"Could not create action for {obj.name}")
    action.name = action_name
    action.use_fake_user = True


def author_actions(stage: str) -> None:
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = 120
    scene.render.fps = 24
    spec = STAGES[stage]

    if stage == "observe":
        papers = bpy.data.objects["OBS_papers"]
        animate_transform(papers, "OBSERVE_MATERIAL_ARRIVAL", (0, 28, 120), start_location=papers.location + Vector((-0.35, -0.16, 0.12)))
        beam = bpy.data.objects["OBS_scan_beam"]
        animate_transform(beam, spec.clip_name, (0, 70, 120), end_location=beam.location + Vector((0.0, 0.96, 0.0)))
        output = bpy.data.objects["OBS_output_assembly"]
        animate_transform(output, "OBSERVE_OUTPUT_CARD", (74, 102, 120), start_location=output.location + Vector((0.0, 0.05, 0.0)))
        crop = bpy.data.objects["OBS_crop_frame"]
        animate_transform(crop, "OBSERVE_CROP_MARKING", (106, 116, 120), start_scale=Vector((0.72, 0.72, 0.72)))
    elif stage == "structure":
        panels = bpy.data.objects["STR_panels"]
        animate_transform(panels, spec.clip_name, (0, 36, 120), start_location=panels.location + Vector((-0.72, 0.0, 0.24)))
        tokens = bpy.data.objects["STR_tokens"]
        animate_transform(tokens, "STRUCTURE_TOKEN_SEATS", (40, 68, 120), start_location=tokens.location + Vector((0.0, -0.38, -0.12)))
        connectors = bpy.data.objects["STR_connectors"]
        animate_transform(connectors, "STRUCTURE_CONNECTORS", (72, 96, 120), start_scale=Vector((0.08, 0.08, 0.08)))
        final_panel = bpy.data.objects["STR_final_panel"]
        animate_transform(final_panel, "STRUCTURE_FINAL_PANEL", (100, 116, 120), start_scale=Vector((0.1, 0.8, 0.8)))
    elif stage == "prototype":
        ui = bpy.data.objects["PRO_ui_layer"]
        animate_transform(ui, spec.clip_name, (0, 28, 120), start_scale=Vector((0.12, 0.12, 0.12)))
        cursor = bpy.data.objects["PRO_cursor"]
        animate_transform(cursor, "PROTOTYPE_CURSOR", (32, 56, 120), start_location=cursor.location + Vector((-0.75, 0.0, -0.35)), end_location=cursor.location + Vector((0.75, 0.0, 0.18)))
        phone = bpy.data.objects["PRO_phone_device"]
        animate_transform(phone, "PROTOTYPE_PHONE_SYNC", (60, 80, 120), start_scale=Vector((0.92, 0.92, 0.92)))
        sensor = bpy.data.objects["PRO_sensor"]
        animate_transform(sensor, "PROTOTYPE_SENSOR", (84, 100, 120), start_rotation=Vector(sensor.rotation_euler) + Vector((0.0, 0.0, -0.1)))
        ring = bpy.data.objects["PRO_light_ring"]
        animate_transform(ring, "PROTOTYPE_LIGHT_RING", (104, 116, 120), start_scale=Vector((0.76, 0.76, 0.76)))
    else:
        qa = bpy.data.objects["REL_qa_rows"]
        animate_transform(qa, "RELEASE_QA_ROWS", (0, 28, 120), start_location=qa.location + Vector((-0.16, 0.0, 0.0)))
        version = bpy.data.objects["REL_version"]
        animate_transform(version, "RELEASE_DRAFT_TO_LIVE", (32, 52, 120), start_scale=Vector((0.12, 0.12, 0.12)))
        devices = bpy.data.objects["REL_devices"]
        animate_transform(devices, spec.clip_name, (0, 76, 120), start_rotation=Vector(devices.rotation_euler) + Vector((-0.34, 0.0, 0.0)))
        package_lid = bpy.data.objects["REL_package_lid"]
        animate_transform(package_lid, "RELEASE_PACKAGE_CLOSE", (80, 104, 120), start_location=package_lid.location + Vector((0.0, 0.0, 0.34)))
        final_panel = bpy.data.objects["REL_final_panel"]
        animate_transform(final_panel, "RELEASE_FINAL_PANEL", (108, 118, 120), start_scale=Vector((0.08, 0.72, 0.72)))
    scene.frame_set(120)


def assign_metadata(stage: str, collection: bpy.types.Collection) -> None:
    root = bpy.data.objects[f"ROOT_{stage.upper()}"]
    root["round"] = 4
    root["collisionProxy"] = "collection-aabb"
    root["collisionProxyRadius"] = 0.3
    root["primaryClip"] = STAGES[stage].clip_name
    for tier, names in INVENTORY[stage].items():
        for name in names:
            obj = bpy.data.objects.get(name)
            if obj is None:
                raise RuntimeError(f"Inventory object missing: {stage}/{name}")
            obj["detailTier"] = tier
    for obj in collection.all_objects:
        if obj.type == "MESH" and "collisionProxy" not in obj:
            obj["collisionProxy"] = "evaluated-mesh"


def collection_bounds(collection: bpy.types.Collection) -> tuple[list[float], list[float]]:
    points = [obj.matrix_world @ Vector(corner) for obj in collection.all_objects if obj.type == "MESH" for corner in obj.bound_box]
    return (
        [round(min(point[index] for point in points), 5) for index in range(3)],
        [round(max(point[index] for point in points), 5) for index in range(3)],
    )


def prepare_stage(stage: str) -> tuple[bpy.types.Collection, dict[str, bpy.types.Material]]:
    if stage not in STAGES:
        raise ValueError(f"Unknown stage: {stage}")
    collection, materials = r3.prepare_stage(stage)
    add_round4_details(stage, collection, materials)
    add_screen_layers(stage, collection, materials)
    add_print_substrates(stage, collection, materials)
    finalize_root_hierarchy(stage, collection)
    bpy.context.view_layer.update()
    clean_geometry(collection)
    author_actions(stage)
    assign_metadata(stage, collection)
    return collection, materials


def export_stage(stage: str, collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> Path:
    replacements = r3.r2.replace_external_texture_materials(collection, materials["content"])
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [obj for obj in collection.all_objects if obj.get("export_role") != "render_label"]
    try:
        for obj in export_objects:
            obj.select_set(True)
        selectable = [obj for obj in export_objects if obj.type in {"MESH", "CURVE", "EMPTY"}]
        if selectable:
            bpy.context.view_layer.objects.active = next((obj for obj in selectable if obj.type == "MESH"), selectable[0])
        output = MODEL_DIR / f"{stage}.glb"
        bpy.ops.export_scene.gltf(
            filepath=str(output), export_format="GLB", use_selection=True, export_apply=True,
            export_animations=True, export_animation_mode="ACTIONS",
            export_optimize_animation_size=True, export_optimize_animation_keep_anim_object=True,
            export_anim_slide_to_zero=False, export_bake_animation=False, export_extras=True,
            export_cameras=False, export_lights=False,
            export_tangents=True,
            export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        )
        return output
    finally:
        bpy.ops.object.select_all(action="DESELECT")
        r3.r2.restore_external_texture_materials(replacements)


def render_stage(stage: str) -> tuple[Path, Path, Path | None]:
    scene = bpy.context.scene
    scene.frame_set(120)
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    review = ARTIFACT_DIR / f"review-{stage}.png"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(review)
    bpy.ops.render.render(write_still=True)
    fallback = FALLBACK_DIR / f"{stage}.webp"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(fallback)
    bpy.ops.render.render(write_still=True)

    wireframe = None
    if stage == "prototype":
        wireframe = FALLBACK_DIR / "wireframe.webp"
        modifiers: list[tuple[bpy.types.Object, bpy.types.Modifier]] = []
        for obj in bpy.data.objects:
            if obj.type != "MESH" or obj.get("export_role") == "render_label":
                continue
            modifier = obj.modifiers.new("ROUND4_REVIEW_WIREFRAME", "WIREFRAME")
            modifier.thickness = 0.007
            modifier.use_replace = False
            modifiers.append((obj, modifier))
        scene.render.filepath = str(wireframe)
        bpy.ops.render.render(write_still=True)
        for obj, modifier in modifiers:
            obj.modifiers.remove(modifier)
    return review, fallback, wireframe


def read_glb_stats(path: Path) -> dict[str, object]:
    payload = path.read_bytes()
    if payload[:4] != b"glTF" or int.from_bytes(payload[4:8], "little") != 2:
        raise RuntimeError(f"Invalid GLB header: {path}")
    declared_length = int.from_bytes(payload[8:12], "little")
    if declared_length != len(payload):
        raise RuntimeError(f"GLB length mismatch: {path}")
    json_length = int.from_bytes(payload[12:16], "little")
    document = json.loads(payload[20:20 + json_length].decode("utf8").rstrip(" \0"))
    accessors = document.get("accessors", [])
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) == 4 and "indices" in primitive:
                triangles += accessors[primitive["indices"]]["count"] // 3
    animation_durations: dict[str, float] = {}
    for animation in document.get("animations", []):
        maximum = 0.0
        for sampler in animation.get("samplers", []):
            accessor = accessors[sampler["input"]]
            maximum = max(maximum, float(accessor.get("max", [0.0])[0]))
        animation_durations[animation.get("name", "")] = round(maximum, 6)
    nodes = document.get("nodes", [])
    scene_index = int(document.get("scene", 0))
    scene_roots = document.get("scenes", [{}])[scene_index].get("nodes", [])
    reachable: set[int] = set()
    pending = list(scene_roots)
    while pending:
        node_index = pending.pop()
        if node_index in reachable:
            continue
        reachable.add(node_index)
        pending.extend(nodes[node_index].get("children", []))
    return {
        "bytes": len(payload),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "triangles": triangles,
        "animations": list(animation_durations),
        "animationDurationsSeconds": animation_durations,
        "extensionsUsed": document.get("extensionsUsed", []),
        "glbVersion": 2,
        "declaredLength": declared_length,
        "sceneRootNames": [nodes[index].get("name", "") for index in scene_roots],
        "sceneNodeCount": len(reachable),
        "unreachableNodeCount": len(nodes) - len(reachable),
    }


def inventory_payload() -> dict[str, object]:
    stages: dict[str, object] = {}
    for stage, tiers in INVENTORY.items():
        stages[stage] = {
            tier: {"count": len(names), "names": names}
            for tier, names in tiers.items()
        }
    return {"schemaVersion": 1, "round": 4, "stages": stages}


def animation_payload() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "timeline": {"frameStart": 0, "frameEnd": 120, "fps": 24, "durationSeconds": 5.0},
        "stages": {
            stage: {
                "clipName": STAGES[stage].clip_name,
                "durationFrames": 120,
                "durationSeconds": 5.0,
                "animatedParentNames": sorted({event[4] for event in events}),
                "events": [
                    {
                        "name": name,
                        "frameRange": [start, end],
                        "offsetFrames": 0 if index == 0 else start - events[index - 1][2],
                        "offsetMilliseconds": 0 if index == 0 else round((start - events[index - 1][2]) * 1000 / 24),
                        "classification": classification,
                        "animatedParentName": parent,
                    }
                    for index, (name, start, end, classification, parent) in enumerate(events)
                ],
            }
            for stage, events in EVENTS.items()
        },
    }


def write_manifests() -> None:
    (ARTIFACT_DIR / "asset-inventory.json").write_text(json.dumps(inventory_payload(), indent=2), encoding="utf8")
    (ARTIFACT_DIR / "animation-manifest.json").write_text(json.dumps(animation_payload(), indent=2), encoding="utf8")


def build_stage(stage: str, *, do_export: bool = True, do_render: bool = True) -> dict[str, object]:
    collection, materials = prepare_stage(stage)
    bounds_min, bounds_max = collection_bounds(collection)
    result: dict[str, object] = {"stage": stage, "boundsMin": bounds_min, "boundsMax": bounds_max, "collisionProxy": "collection-aabb"}
    if do_export:
        glb = export_stage(stage, collection, materials)
        result.update({"glb": str(glb), **read_glb_stats(glb)})
    if do_render:
        review, fallback, wireframe = render_stage(stage)
        result.update({
            "review": str(review), "review_bytes": review.stat().st_size,
            "fallback": str(fallback), "fallback_bytes": fallback.stat().st_size,
        })
        if wireframe is not None:
            result.update({"wireframe": str(wireframe), "wireframe_bytes": wireframe.stat().st_size})
    return result


def requested_stage() -> str | None:
    if "--" not in sys.argv:
        return None
    args = sys.argv[sys.argv.index("--") + 1:]
    if "--stage" not in args:
        return None
    index = args.index("--stage")
    return args[index + 1] if index + 1 < len(args) else None


def main() -> None:
    stage = requested_stage()
    names = [stage] if stage else list(STAGES)
    if any(name not in STAGES for name in names):
        raise ValueError(f"Unknown stage: {names[0]}")
    write_manifests()
    results = [build_stage(name) for name in names]
    if stage:
        stats_path = ARTIFACT_DIR / f"asset-stats-{stage}.json"
    else:
        stats_path = ARTIFACT_DIR / "asset-stats.json"
    stats_path.write_text(json.dumps(results, indent=2), encoding="utf8")
    print("ROUND4_ASSET_STATS=" + json.dumps(results, ensure_ascii=True))


if __name__ == "__main__":
    main()
