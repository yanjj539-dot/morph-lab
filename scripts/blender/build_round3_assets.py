from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_round2_assets as r2


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models" / "round-3"
FALLBACK_DIR = ROOT / "public" / "fallback" / "round-3"
TEXTURE_DIR = ROOT / "public" / "textures" / "round-3"
ARTIFACT_DIR = ROOT / "artifacts" / "qa-round3"

for directory in (MODEL_DIR, FALLBACK_DIR, TEXTURE_DIR, ARTIFACT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class StageSpec:
    name: str
    clip_name: str
    focus: tuple[float, float, float]
    key_energy: float
    fill_energy: float
    rim_energy: float


STAGES = {
    "observe": StageSpec("observe", "ML_OBSERVE_ACTION", (0.0, 0.0, 0.95), 720.0, 210.0, 420.0),
    "structure": StageSpec("structure", "ML_STRUCTURE_ACTION", (0.0, 0.35, 1.75), 780.0, 230.0, 480.0),
    "prototype": StageSpec("prototype", "ML_PROTOTYPE_ACTION", (-0.15, 0.0, 1.25), 820.0, 185.0, 520.0),
    "release": StageSpec("release", "ML_RELEASE_ACTION", (0.0, 0.0, 1.25), 860.0, 250.0, 440.0),
}


def node_input(node: bpy.types.Node, names: tuple[str, ...], value) -> None:
    for name in names:
        socket = node.inputs.get(name)
        if socket is not None:
            socket.default_value = value
            return


def add_micro_surface(material: bpy.types.Material, scale: float, strength: float) -> None:
    if not material.use_nodes or material.node_tree is None:
        return
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next((node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf is None or bsdf.inputs.get("Normal") is None:
        return
    noise = nodes.new("ShaderNodeTexNoise")
    noise.name = f"{material.name}_MicroNoise"
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.62
    bump = nodes.new("ShaderNodeBump")
    bump.name = f"{material.name}_MicroBump"
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.035
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def create_round3_materials() -> dict[str, bpy.types.Material]:
    materials = r2.create_materials()
    settings = {
        "warm": (0.62, 0.02),
        "white": (0.40, 0.0),
        "paper": (0.92, 0.0),
        "metal": (0.43, 0.82),
        "rubber": (0.91, 0.0),
        "screen": (0.16, 0.08),
        "coral": (0.52, 0.0),
        "blue": (0.46, 0.0),
    }
    for key, (roughness, metallic) in settings.items():
        material = materials[key]
        bsdf = next(node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
        node_input(bsdf, ("Roughness",), roughness)
        node_input(bsdf, ("Metallic",), metallic)
        material.use_backface_culling = key not in {"paper"}

    acrylic = materials["acrylic"]
    acrylic.diffuse_color = r2.srgb("#C9DCF4", 1.0)
    acrylic.use_backface_culling = True
    acrylic_bsdf = next(node for node in acrylic.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
    node_input(acrylic_bsdf, ("Base Color",), r2.srgb("#D8E8F8"))
    node_input(acrylic_bsdf, ("Roughness",), 0.31)
    node_input(acrylic_bsdf, ("Transmission Weight", "Transmission"), 0.68)
    node_input(acrylic_bsdf, ("IOR",), 1.46)
    node_input(acrylic_bsdf, ("Alpha",), 1.0)

    materials["content"] = r2.make_material("MAT_ScreenContentPlaceholder", "#F4F6F8", 0.36)
    materials["content"].use_backface_culling = False
    materials["glass"] = r2.make_material("MAT_ScreenGlassLayer", "#D7E2EC", 0.12, 0.08, 0.28)
    materials["glass"].use_backface_culling = True
    glass_bsdf = next(node for node in materials["glass"].node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
    node_input(glass_bsdf, ("Transmission Weight", "Transmission"), 0.25)
    node_input(glass_bsdf, ("IOR",), 1.45)

    add_micro_surface(materials["warm"], 125.0, 0.055)
    add_micro_surface(materials["white"], 92.0, 0.035)
    add_micro_surface(materials["paper"], 175.0, 0.08)
    add_micro_surface(materials["metal"], 68.0, 0.045)
    add_micro_surface(materials["rubber"], 145.0, 0.09)
    return materials


def delete_object(name: str) -> None:
    obj = bpy.data.objects.get(name)
    if obj is not None:
        bpy.data.objects.remove(obj, do_unlink=True)


def parent_keep_world(child: bpy.types.Object, parent: bpy.types.Object) -> None:
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def set_local_surface(
    child: bpy.types.Object,
    parent: bpy.types.Object,
    location: tuple[float, float, float],
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
) -> None:
    child.parent = parent
    child.matrix_parent_inverse = Matrix.Identity(4)
    child.location = location
    child.rotation_euler = rotation
    child.scale = (1.0, 1.0, 1.0)


def recenter_parent(parent: bpy.types.Object, origin: tuple[float, float, float]) -> None:
    child_world = [(child, child.matrix_world.copy()) for child in parent.children]
    parent.location = origin
    bpy.context.view_layer.update()
    for child, world in child_world:
        child.matrix_world = world


def add_fasteners(
    prefix: str,
    points: list[tuple[float, float, float]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> None:
    for index, point in enumerate(points):
        fastener = r2.cylinder(
            f"{prefix}_{index}",
            0.035,
            0.025,
            point,
            material,
            collection,
            rotation=rotation,
            vertices=16,
        )
        fastener["detail_tier"] = "micro"


def refine_observe(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    delete_object("ROUTE_coral")
    delete_object("ROUTE_node")

    output = bpy.data.objects["OBS_output_card"]
    output.dimensions = (1.15, 0.055, 0.76)
    output.location = (0.15, -1.05, 0.82)
    bpy.context.view_layer.objects.active = output
    output.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    output.select_set(False)
    set_local_surface(bpy.data.objects["PRINT_observe_output"], output, (0.0, -0.032, 0.0))

    delete_object("OBS_crop_frame")
    for suffix in ("top", "bottom", "left", "right"):
        delete_object(f"OBS_crop_frame_{suffix}")
    crop = r2.crop_frame("OBS_crop_frame", (0.15, -1.09, 0.82), 1.18, 0.78, materials["coral"], collection)
    recenter_parent(crop, (0.15, -1.09, 0.82))
    assembly = r2.parent_empty("OBS_output_assembly", collection)
    parent_keep_world(output, assembly)
    parent_keep_world(crop, assembly)

    bpy.data.objects["OBS_papers"].location.x = -0.62
    bpy.data.objects["OBS_folder"].location.x = -2.35
    bpy.data.objects["OBS_folder"].location.y = 1.30
    bpy.data.objects["OBS_folder_tab"].location.x = -2.80
    bpy.data.objects["OBS_folder_tab"].location.y = 1.55
    bpy.data.objects["OBS_material_tray"].location.x = 0.65
    bpy.data.objects["OBS_material_tray"].location.y = 1.35
    for index in range(5):
        bpy.data.objects[f"OBS_swatch_{index}"].location += Vector((-0.20, 0.20, 0.0))
    for index in range(3):
        bpy.data.objects[f"OBS_clip_{index}"].location.x = -2.72 + index * 0.30
    bpy.data.objects["OBS_pencil"].location = (-0.82, -1.40, 0.50)

    r2.rounded_box("OBS_scanner_lid", (2.46, 1.45, 0.085), (-0.25, 0.1, 0.78), materials["warm"], collection, 0.028)
    for index, x in enumerate((-1.18, 0.68)):
        r2.cylinder(f"OBS_lid_hinge_{index}", 0.055, 0.22, (x, 0.77, 0.72), materials["metal"], collection, rotation=(0.0, math.pi / 2, 0.0), vertices=20)
    r2.rounded_box("OBS_control_recess", (0.62, 0.24, 0.035), (0.55, -0.54, 0.63), materials["rubber"], collection, 0.012)
    for index, color in enumerate(("coral", "white", "white")):
        r2.cylinder(f"OBS_control_key_{index}", 0.045, 0.028, (0.38 + index * 0.17, -0.55, 0.66), materials[color], collection, vertices=20)
    bpy.data.objects["OBS_control_recess"].location.y = -0.72
    for index in range(3):
        bpy.data.objects[f"OBS_control_key_{index}"].location.y = -0.73
    for index, x in enumerate((-1.08, 0.58)):
        r2.rounded_box(f"OBS_paper_guide_{index}", (0.08, 0.62, 0.09), (x, -0.05, 0.72), materials["metal"], collection, 0.018)
    for index in range(4):
        r2.rounded_box(f"OBS_tray_divider_{index}", (0.025, 0.7, 0.12), (0.48 + index * 0.24, 1.15, 0.56), materials["metal"], collection, 0.006)
        bpy.data.objects[f"OBS_tray_divider_{index}"].location += Vector((-0.20, 0.20, 0.0))
    add_fasteners(
        "OBS_scanner_screw",
        [(-1.36, -0.57, 0.63), (0.86, -0.57, 0.63), (-1.36, 0.75, 0.63), (0.86, 0.75, 0.63)],
        collection,
        materials["metal"],
    )
    r2.rounded_box("OBS_table_seam", (5.4, 0.018, 0.024), (0.0, 1.45, 0.34), materials["shadow"], collection, 0.004)
    r2.rounded_box("OBS_status_window", (0.34, 0.035, 0.08), (-0.94, -0.68, 0.66), materials["green"], collection, 0.012)


def refine_structure(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    delete_object("ROUTE_coral")
    delete_object("ROUTE_node")
    for index, x in enumerate((-2.42, -1.2, 0.0, 1.2, 2.42)):
        r2.rounded_box(f"STR_mount_rail_{index}", (0.055, 0.12, 2.72), (x, 0.43, 2.03), materials["metal"], collection, 0.012)
    for index in range(10):
        x = -2.1 + (index % 5) * 1.05
        z = 1.05 + (index // 5) * 1.85
        r2.rounded_box(f"STR_card_clip_{index}", (0.18, 0.08, 0.1), (x, 0.29, z), materials["metal"], collection, 0.014)
    for index in range(5):
        r2.rounded_box(f"STR_token_slot_{index}", (0.42, 0.42, 0.035), (-1.2 + index * 0.52, -0.92, 0.39), materials["rubber"], collection, 0.04)
    r2.rounded_box("STR_ruler_track", (0.62, 0.12, 2.72), (-2.25, 0.43, 1.95), materials["metal"], collection, 0.02)
    r2.rounded_box("STR_console_seam", (5.45, 0.02, 0.025), (0.0, 1.36, 0.34), materials["shadow"], collection, 0.005)
    bpy.data.objects["STR_control_strip"].location.x -= 0.60
    for index in range(4):
        bpy.data.objects[f"STR_control_{index}"].location.x -= 0.60
    bpy.data.objects["STR_booklet"].location.x += 0.18
    bpy.data.objects["STR_booklet_band"].location.x += 0.18
    bpy.data.objects["STR_operator"].location.x = 0.42
    add_fasteners(
        "STR_base_bolt",
        [(-2.55, 0.2, 0.61), (2.55, 0.2, 0.61), (-2.55, 0.88, 0.61), (2.55, 0.88, 0.61)],
        collection,
        materials["metal"],
        rotation=(math.pi / 2, 0.0, 0.0),
    )


def refine_prototype(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    delete_object("ROUTE_coral")
    delete_object("ROUTE_node")
    for index in range(8):
        r2.rounded_box(f"PRO_monitor_vent_{index}", (0.18, 0.028, 0.025), (-1.25 + index * 0.2, 0.825, 2.42), materials["rubber"], collection, 0.005)
    r2.cylinder("PRO_monitor_hinge", 0.12, 0.52, (-0.55, 0.82, 0.91), materials["metal"], collection, rotation=(math.pi / 2, 0.0, 0.0), vertices=24)
    r2.rounded_box("PRO_phone_backrail", (0.42, 0.2, 0.72), (1.55, -0.42, 0.82), materials["metal"], collection, 0.03)
    r2.rounded_box("PRO_tablet_hinge", (0.72, 0.18, 0.1), (2.15, 0.72, 0.48), materials["metal"], collection, 0.025)
    for index in range(4):
        r2.cylinder(f"PRO_rubber_foot_{index}", 0.075, 0.04, (-2.7 + index * 1.8, 1.38, 0.34), materials["rubber"], collection, vertices=20)
    for index in range(3):
        r2.rounded_box(f"PRO_sensor_slot_{index}", (0.25, 0.03, 0.025), (-2.55, 0.09, 0.48 + index * 0.11), materials["rubber"], collection, 0.005)
    r2.rounded_box("PRO_bench_seam", (5.55, 0.02, 0.025), (0.0, 1.48, 0.35), materials["shadow"], collection, 0.005)
    add_fasteners(
        "PRO_board_screw",
        [(-2.72, -0.92, 0.49), (-1.78, -0.92, 0.49), (-2.72, -0.38, 0.49), (-1.78, -0.38, 0.49)],
        collection,
        materials["metal"],
    )
    for name in ["PRO_esp32_board", "PRO_esp32_chip", *[f"PRO_pin_{index}" for index in range(8)], *[f"PRO_board_screw_{index}" for index in range(4)]]:
        bpy.data.objects[name].location.x -= 0.42
    delete_object("PRO_board_screw_0")
    delete_object("PRO_board_screw_2")
    bpy.data.objects["PRO_light_ring"].location = (-2.55, 0.55, 1.35)


def refine_release(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    delete_object("ROUTE_coral")
    delete_object("ROUTE_node")
    lid = bpy.data.objects["REL_devices"]
    set_local_surface(bpy.data.objects["SCREEN_release_laptop"], lid, (0.0, -0.071, 0.0))
    for index in range(3):
        card = bpy.data.objects[f"REL_project_card_{index}"]
        image = bpy.data.objects[f"REL_project_image_{index}"]
        set_local_surface(image, card, (0.0, -0.033, 0.0))
    qr_card = bpy.data.objects["REL_qr_card"]
    for row, col in ((0, 0), (0, 2), (1, 1), (2, 0), (2, 2), (3, 1), (1, 3), (3, 3)):
        cell = bpy.data.objects[f"REL_qr_{row}_{col}"]
        set_local_surface(cell, qr_card, (-0.25 + col * 0.16, -0.055, -0.27 + row * 0.16), (0.0, 0.0, 0.0))

    r2.cylinder("REL_laptop_hinge", 0.07, 1.55, (0.75, 0.39, 0.52), materials["metal"], collection, rotation=(0.0, math.pi / 2, 0.0), vertices=24)
    for index in range(9):
        r2.rounded_box(f"REL_laptop_key_{index}", (0.14, 0.12, 0.025), (0.15 + (index % 3) * 0.21, -0.38 + (index // 3) * 0.18, 0.5), materials["rubber"], collection, 0.012)
    for index in range(4):
        r2.rounded_box(f"REL_archive_corner_{index}", (0.16, 0.16, 0.22), (-0.92 + (index % 2) * 1.34, -1.48 + (index // 2) * 0.9, 0.52), materials["metal"], collection, 0.022)
    r2.rounded_box("REL_cable_channel", (2.05, 0.18, 0.12), (-1.45, 1.08, 0.42), materials["rubber"], collection, 0.025)
    bpy.data.objects["REL_cable_channel"].location.y = 1.24
    r2.rounded_box("REL_station_seam", (5.6, 0.02, 0.025), (0.0, 1.48, 0.36), materials["shadow"], collection, 0.005)
    add_fasteners(
        "REL_station_bolt",
        [(-3.05, -1.65, 0.36), (3.05, -1.65, 0.36), (-3.05, 1.65, 0.36), (3.05, 1.65, 0.36)],
        collection,
        materials["metal"],
    )
    for name in ["REL_laptop_base", "REL_devices", "REL_laptop_hinge", *[f"REL_laptop_key_{index}" for index in range(9)]]:
        bpy.data.objects[name].location.y += 0.16
    for name in ["REL_archive_box", "REL_package_lid", "REL_archive_latch", "REL_release_folder", *[f"REL_archive_corner_{index}" for index in range(4)]]:
        bpy.data.objects[name].location.y -= 0.30
    bpy.data.objects["REL_version"].location.x = -1.88
    bpy.data.objects["REL_version_text"].location.x = -1.88


REFINERS = {
    "observe": refine_observe,
    "structure": refine_structure,
    "prototype": refine_prototype,
    "release": refine_release,
}


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
    obj.keyframe_insert(data_path="location", frame=first)
    obj.keyframe_insert(data_path="rotation_euler", frame=first)
    obj.keyframe_insert(data_path="scale", frame=first)

    obj.location = end_location.copy() if end_location is not None else neutral_location
    obj.rotation_euler = end_rotation.copy() if end_rotation is not None else neutral_rotation
    obj.scale = end_scale.copy() if end_scale is not None else neutral_scale
    obj.keyframe_insert(data_path="location", frame=settle)
    obj.keyframe_insert(data_path="rotation_euler", frame=settle)
    obj.keyframe_insert(data_path="scale", frame=settle)
    obj.keyframe_insert(data_path="location", frame=last)
    obj.keyframe_insert(data_path="rotation_euler", frame=last)
    obj.keyframe_insert(data_path="scale", frame=last)

    action = obj.animation_data.action if obj.animation_data else None
    if action is None:
        raise RuntimeError(f"Could not create action for {obj.name}")
    action.name = action_name
    action.use_fake_user = True


def author_actions(stage: str) -> None:
    spec = STAGES[stage]
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 121
    scene.render.fps = 60

    if stage == "observe":
        beam = bpy.data.objects["OBS_scan_beam"]
        animate_transform(beam, spec.clip_name, (1, 72, 121), end_location=beam.location + Vector((0.0, 0.96, 0.0)))
        papers = bpy.data.objects["OBS_papers"]
        animate_transform(papers, "OBSERVE_SECONDARY_PAPERS", (1, 38, 121), start_location=papers.location + Vector((-0.35, -0.16, 0.12)), start_rotation=Vector(papers.rotation_euler) + Vector((0.0, 0.0, -0.08)))
        output = bpy.data.objects["OBS_output_assembly"]
        animate_transform(output, "OBSERVE_SECONDARY_OUTPUT", (58, 102, 121), start_location=output.location + Vector((0.0, 0.05, 0.0)))
        crop = bpy.data.objects["OBS_crop_frame"]
        animate_transform(crop, "OBSERVE_SECONDARY_CROP", (82, 112, 121), start_scale=Vector((0.72, 0.72, 0.72)))
    elif stage == "structure":
        panels = bpy.data.objects["STR_panels"]
        animate_transform(panels, spec.clip_name, (1, 58, 121), start_location=panels.location + Vector((-0.72, 0.0, 0.24)), start_scale=Vector((0.96, 0.96, 0.96)))
        tokens = bpy.data.objects["STR_tokens"]
        animate_transform(tokens, "STRUCTURE_SECONDARY_TOKENS", (38, 86, 121), start_location=tokens.location + Vector((0.0, -0.38, -0.12)), start_scale=Vector((0.84, 0.84, 0.84)))
        ruler = bpy.data.objects["STR_type_ruler"]
        animate_transform(ruler, "STRUCTURE_SECONDARY_RULER", (22, 70, 121), start_scale=Vector((1.0, 1.0, 0.12)))
        for index in range(3):
            connector = bpy.data.objects[f"STR_connector_{index}"]
            animate_transform(connector, f"STRUCTURE_CONNECTOR_{index}", (54 + index * 8, 92 + index * 8, 121), start_scale=Vector((0.03, 0.03, 0.03)))
        final_panel = bpy.data.objects["STR_final_panel"]
        animate_transform(final_panel, "STRUCTURE_SECONDARY_FINAL", (92, 114, 121), start_scale=Vector((0.1, 0.8, 0.8)))
    elif stage == "prototype":
        ui = bpy.data.objects["PRO_ui_layer"]
        animate_transform(ui, spec.clip_name, (1, 58, 121), start_location=ui.location + Vector((0.0, 0.08, -0.18)), start_scale=Vector((0.12, 0.12, 0.12)))
        cursor = bpy.data.objects["PRO_cursor"]
        animate_transform(cursor, "PROTOTYPE_SECONDARY_CURSOR", (20, 82, 121), start_location=cursor.location + Vector((-0.75, 0.0, -0.35)), end_location=cursor.location + Vector((0.75, 0.0, 0.18)))
        phone = bpy.data.objects["SCREEN_prototype_phone"]
        animate_transform(phone, "PROTOTYPE_SECONDARY_PHONE", (42, 92, 121), start_scale=Vector((0.92, 0.92, 0.92)))
        ring = bpy.data.objects["PRO_light_ring"]
        animate_transform(ring, "PROTOTYPE_SECONDARY_RING", (52, 106, 121), start_scale=Vector((0.76, 0.76, 0.76)), end_scale=Vector((1.04, 1.04, 1.04)))
        sensor = bpy.data.objects["PRO_sensor"]
        animate_transform(sensor, "PROTOTYPE_SECONDARY_SENSOR", (58, 110, 121), start_rotation=Vector(sensor.rotation_euler) + Vector((0.0, 0.0, -0.1)), end_rotation=Vector(sensor.rotation_euler) + Vector((0.0, 0.0, 0.05)))
    else:
        devices = bpy.data.objects["REL_devices"]
        animate_transform(devices, spec.clip_name, (1, 48, 121), start_rotation=Vector(devices.rotation_euler) + Vector((-0.34, 0.0, 0.0)))
        qa = bpy.data.objects["REL_qa_rows"]
        animate_transform(qa, "RELEASE_SECONDARY_QA", (26, 78, 121), start_location=qa.location + Vector((-0.16, 0.0, 0.0)), start_scale=Vector((0.96, 0.96, 0.96)))
        version = bpy.data.objects["REL_version"]
        animate_transform(version, "RELEASE_SECONDARY_VERSION", (62, 102, 121), start_scale=Vector((0.12, 0.12, 0.12)))
        package_lid = bpy.data.objects["REL_package_lid"]
        animate_transform(package_lid, "RELEASE_SECONDARY_PACKAGE", (70, 114, 121), start_location=package_lid.location + Vector((0.0, 0.0, 0.34)), start_rotation=Vector(package_lid.rotation_euler) + Vector((0.36, 0.0, 0.0)))
        final_panel = bpy.data.objects["REL_final_panel"]
        animate_transform(final_panel, "RELEASE_SECONDARY_FINAL", (94, 118, 121), start_scale=Vector((0.08, 0.72, 0.72)))

    scene.frame_set(121)


def mesh_world_min_z(collection: bpy.types.Collection) -> float:
    values: list[float] = []
    for obj in collection.all_objects:
        if obj.type not in {"MESH", "CURVE"} or obj.get("export_role") == "render_label":
            continue
        for corner in obj.bound_box:
            values.append((obj.matrix_world @ Vector(corner)).z)
    return min(values) if values else 0.0


def normalize_root(stage: str, collection: bpy.types.Collection) -> bpy.types.Object:
    root = r2.parent_empty(f"ROOT_{stage.upper()}", collection)
    for obj in list(collection.objects):
        if obj == root or obj.parent is not None or obj.get("export_role") == "render_label":
            continue
        parent_keep_world(obj, root)
    root.location.z -= mesh_world_min_z(collection)
    root["stage"] = stage
    root["round"] = 3
    root["collision_proxy_radius"] = 0.3
    bpy.context.view_layer.update()
    return root


def setup_round3_render(stage: str, materials: dict[str, bpy.types.Material]) -> None:
    render_collection = r2.setup_render(stage, materials)
    scene = bpy.context.scene
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.35

    key = bpy.data.objects.get("KeyArea")
    fill = bpy.data.objects.get("FillArea")
    if key is not None:
        key.data.energy = STAGES[stage].key_energy
        key.data.size = 6.5
    if fill is not None:
        fill.data.energy = STAGES[stage].fill_energy
        fill.data.size = 5.0

    rim_data = bpy.data.lights.new(f"{stage}_RimArea", type="AREA")
    rim_data.energy = STAGES[stage].rim_energy
    rim_data.color = (0.66, 0.78, 1.0)
    rim_data.shape = "DISK"
    rim_data.size = 4.0
    rim = bpy.data.objects.new(f"{stage}_RimArea", rim_data)
    rim.location = (4.8, 4.2, 7.5)
    r2.look_at(rim, STAGES[stage].focus)
    render_collection.objects.link(rim)

    bounce_data = bpy.data.lights.new(f"{stage}_BounceArea", type="AREA")
    bounce_data.energy = 110.0
    bounce_data.color = (1.0, 0.76, 0.68)
    bounce_data.size = 2.8
    bounce = bpy.data.objects.new(f"{stage}_BounceArea", bounce_data)
    bounce.location = (-3.5, 3.5, 2.4)
    r2.look_at(bounce, STAGES[stage].focus)
    render_collection.objects.link(bounce)

    floor = bpy.data.objects.get("RENDER_floor")
    if floor is not None:
        floor.location.z = -0.06


def prepare_stage(stage: str) -> tuple[bpy.types.Collection, dict[str, bpy.types.Material]]:
    r2.clear_scene()
    materials = create_round3_materials()
    collection = r2.new_collection(f"EXPORT_{stage.upper()}")
    r2.BUILDERS[stage](collection, materials)
    REFINERS[stage](collection, materials)
    bpy.context.view_layer.update()
    normalize_root(stage, collection)
    author_actions(stage)
    setup_round3_render(stage, materials)
    return collection, materials


def export_stage(stage: str, collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> Path:
    replacements = r2.replace_external_texture_materials(collection, materials["content"])
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
            filepath=str(output),
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_animations=True,
            export_animation_mode="ACTIONS",
            export_optimize_animation_size=True,
            export_optimize_animation_keep_anim_object=True,
            export_anim_slide_to_zero=True,
            export_bake_animation=False,
            export_extras=True,
            export_cameras=False,
            export_lights=False,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
        )
        return output
    finally:
        bpy.ops.object.select_all(action="DESELECT")
        r2.restore_external_texture_materials(replacements)


def read_glb_stats(path: Path) -> dict[str, int | list[str]]:
    payload = path.read_bytes()
    json_length = int.from_bytes(payload[12:16], "little")
    document = json.loads(payload[20 : 20 + json_length].decode("utf8").rstrip(" \0"))
    accessors = document.get("accessors", [])
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) == 4 and "indices" in primitive:
                triangles += accessors[primitive["indices"]]["count"] // 3
    return {
        "bytes": len(payload),
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "triangles": triangles,
        "animations": [animation.get("name", "") for animation in document.get("animations", [])],
    }


def render_stage(stage: str) -> tuple[Path, Path]:
    scene = bpy.context.scene
    scene.frame_set(121)
    review = ARTIFACT_DIR / f"review-{stage}.png"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(review)
    bpy.ops.render.render(write_still=True)

    fallback = FALLBACK_DIR / f"{stage}.webp"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(fallback)
    bpy.ops.render.render(write_still=True)
    return review, fallback


def build_stage(stage: str, *, do_export: bool = True, do_render: bool = True) -> dict[str, object]:
    collection, materials = prepare_stage(stage)
    result: dict[str, object] = {"stage": stage}
    if do_export:
        glb = export_stage(stage, collection, materials)
        result["glb"] = str(glb)
        result.update(read_glb_stats(glb))
    if do_render:
        review, fallback = render_stage(stage)
        result.update(
            {
                "review": str(review),
                "review_bytes": review.stat().st_size,
                "fallback": str(fallback),
                "fallback_bytes": fallback.stat().st_size,
            }
        )
    return result


def requested_stage() -> str | None:
    if "--" not in sys.argv:
        return None
    args = sys.argv[sys.argv.index("--") + 1 :]
    if "--stage" not in args:
        return None
    index = args.index("--stage")
    return args[index + 1] if index + 1 < len(args) else None


def main() -> None:
    stage = requested_stage()
    names = [stage] if stage else list(STAGES)
    unknown = [name for name in names if name not in STAGES]
    if unknown:
        raise ValueError(f"Unknown stage: {unknown[0]}")
    results = [build_stage(name) for name in names]
    (ARTIFACT_DIR / "asset-stats.json").write_text(json.dumps(results, indent=2), encoding="utf8")
    print("ROUND3_ASSET_STATS=" + json.dumps(results, ensure_ascii=True))


if __name__ == "__main__":
    main()
