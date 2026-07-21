from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models" / "round-2"
FALLBACK_DIR = ROOT / "public" / "fallback" / "round-2"
ARTIFACT_DIR = ROOT / "artifacts"
IMAGE_DIR = ROOT / "public" / "images"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
FALLBACK_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)

COLORS = {
    "paper": "#F6F5EF",
    "white": "#FFFFFF",
    "sheet": "#FBFAF4",
    "sky": "#BFD4F5",
    "blue": "#2456FF",
    "coral": "#FF7157",
    "black": "#111318",
    "metal": "#AEB7C2",
    "green": "#4D8063",
    "shadow": "#7E8998",
}

EXTERNAL_TEXTURE_PREFIXES = ("SCREEN_", "PRINT_", "REL_project_image_")


def srgb(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        alpha,
    )


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for datablocks in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.images,
    ):
        for block in list(datablocks):
            datablocks.remove(block)


def new_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(
    name: str,
    color: str,
    roughness: float,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = srgb(color, alpha)
    bsdf = next(
        (node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"),
        None,
    )
    if bsdf is None:
        raise RuntimeError(f"Principled BSDF node missing from {name}")
    bsdf.inputs["Base Color"].default_value = srgb(color, alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission_input and emission:
        emission_input.default_value = srgb(emission)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def make_image_material(
    name: str,
    image_name: str,
    emission_strength: float = 0.22,
) -> bpy.types.Material:
    path = IMAGE_DIR / image_name
    if not path.exists():
        raise FileNotFoundError(f"Required Round 2 image is missing: {path}")

    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    for node in list(nodes):
        nodes.remove(node)
    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(path), check_existing=True)
    texture.interpolation = "Linear"
    links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
    if emission_input:
        links.new(texture.outputs["Color"], emission_input)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    bsdf.inputs["Roughness"].default_value = 0.32
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return material


def create_materials() -> dict[str, bpy.types.Material]:
    return {
        "warm": make_material("MAT_WarmWhitePlastic", COLORS["paper"], 0.78, 0.02),
        "white": make_material("MAT_CoolWhiteCeramic", COLORS["white"], 0.62),
        "paper": make_material("MAT_Paper", COLORS["sheet"], 0.95),
        "acrylic": make_material("MAT_FrostedAcrylic", COLORS["sky"], 0.35, 0.02, 0.72),
        "metal": make_material("MAT_SoftGreyMetal", COLORS["metal"], 0.52, 0.38),
        "rubber": make_material("MAT_BlackRubber", COLORS["black"], 0.9),
        "black": make_material("MAT_BlackInk", COLORS["black"], 0.86),
        "screen": make_material("MAT_ScreenGlass", "#15191F", 0.24, 0.08),
        "coral": make_material("MAT_CoralAccent", COLORS["coral"], 0.58),
        "blue": make_material("MAT_CobaltAccent", COLORS["blue"], 0.5),
        "green": make_material("MAT_Passed", COLORS["green"], 0.65),
        "shadow": make_material("MAT_ShadowGrey", COLORS["shadow"], 0.82),
        "ground": make_material("MAT_SkyGround", COLORS["sky"], 0.9),
    }


def parent_empty(name: str, collection: bpy.types.Collection) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    return obj


def rounded_box(
    name: str,
    size: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    bevel: float = 0.06,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(value / 2 for value in size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("Soft bevel", "BEVEL")
    modifier.width = min(bevel, min(size) * 0.35)
    modifier.segments = 3
    modifier.limit_method = "ANGLE"
    obj.data.materials.append(material)
    obj.parent = parent
    obj.select_set(False)
    move_to_collection(obj, collection)
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 32,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("Edge bevel", "BEVEL")
    bevel.width = min(0.035, radius * 0.2, depth * 0.2)
    bevel.segments = 2
    obj.data.materials.append(material)
    obj.parent = parent
    move_to_collection(obj, collection)
    return obj


def sphere(
    name: str,
    radius: float,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = parent
    move_to_collection(obj, collection)
    return obj


def torus(
    name: str,
    major_radius: float,
    minor_radius: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.parent = parent
    move_to_collection(obj, collection)
    return obj


def curve_tube(
    name: str,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    curve_data = bpy.data.curves.new(name, type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 3
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coords in zip(spline.bezier_points, points):
        point.co = coords
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.parent = parent
    return obj


def image_plane(
    name: str,
    size: tuple[float, float],
    location: tuple[float, float, float],
    image_name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    material = make_image_material(f"MAT_{name}", image_name)
    bpy.ops.mesh.primitive_plane_add(location=location, rotation=(math.pi / 2, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.parent = parent
    move_to_collection(obj, collection)
    return obj


def text_mesh(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
    rotation: tuple[float, float, float] = (math.pi / 2, 0.0, 0.0),
    parent: bpy.types.Object | None = None,
) -> bpy.types.Object:
    bpy.ops.object.text_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.012
    obj.data.bevel_depth = 0.004
    obj.data.materials.append(material)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj["export_role"] = "render_label"
    move_to_collection(obj, collection)
    return obj


def crop_frame(
    name: str,
    center: tuple[float, float, float],
    width: float,
    height: float,
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    parent = parent_empty(name, collection)
    x, y, z = center
    thickness = 0.035
    rounded_box(f"{name}_top", (width, thickness, thickness), (x, y, z + height / 2), material, collection, 0.012, parent=parent)
    rounded_box(f"{name}_bottom", (width, thickness, thickness), (x, y, z - height / 2), material, collection, 0.012, parent=parent)
    rounded_box(f"{name}_left", (thickness, thickness, height), (x - width / 2, y, z), material, collection, 0.012, parent=parent)
    rounded_box(f"{name}_right", (thickness, thickness, height), (x + width / 2, y, z), material, collection, 0.012, parent=parent)
    return parent


def scale_figure(
    name: str,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    collection: bpy.types.Collection,
) -> bpy.types.Object:
    parent = parent_empty(name, collection)
    x, y, z = location
    cylinder(f"{name}_body", 0.11, 0.46, (x, y, z + 0.23), material, collection, parent=parent)
    sphere(f"{name}_head", 0.13, (x, y, z + 0.58), (1.0, 1.0, 1.0), material, collection, parent=parent)
    return parent


def add_common_route(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    curve_tube(
        "ROUTE_coral",
        [(-3.1, -1.5, 0.1), (-1.4, -1.8, 0.13), (0.5, -1.55, 0.12), (2.7, -1.78, 0.11)],
        0.035,
        materials["coral"],
        collection,
    )
    cylinder("ROUTE_node", 0.14, 0.06, (-2.8, -1.48, 0.13), materials["coral"], collection)


def build_observe(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    rounded_box("OBS_research_table", (6.4, 3.8, 0.28), (0, 0, 0.18), materials["warm"], collection, 0.1)
    for x in (-2.65, 2.65):
        for y in (-1.25, 1.25):
            cylinder(f"OBS_table_leg_{x}_{y}", 0.12, 0.72, (x, y, -0.28), materials["metal"], collection)

    rounded_box("OBS_scanner_body", (2.55, 1.55, 0.24), (-0.25, 0.1, 0.48), materials["white"], collection, 0.07)
    rounded_box("OBS_scanner_bed", (2.1, 1.12, 0.055), (-0.25, -0.05, 0.62), materials["acrylic"], collection, 0.025)
    rounded_box("OBS_scanner_rail", (2.3, 0.12, 0.16), (-0.25, 0.62, 0.68), materials["metal"], collection, 0.03)
    scan = rounded_box("OBS_scan_beam", (2.0, 0.055, 0.035), (-0.25, -0.48, 0.68), materials["coral"], collection, 0.012)
    scan["animation_axis"] = "Y"

    rounded_box("OBS_monitor_frame", (1.72, 0.18, 1.28), (1.85, 0.72, 1.35), materials["screen"], collection, 0.08)
    image_plane("SCREEN_observe_inspection", (1.48, 1.02), (1.85, 0.615, 1.35), "persona-result.webp", collection)
    rounded_box("OBS_monitor_stem", (0.16, 0.3, 0.7), (1.85, 0.84, 0.68), materials["metal"], collection, 0.035)
    rounded_box("OBS_monitor_foot", (0.92, 0.65, 0.1), (1.85, 0.65, 0.38), materials["metal"], collection, 0.04)

    papers = parent_empty("OBS_papers", collection)
    paper_layout = [(-2.15, -0.45, 0.38, -0.08), (-1.72, -0.75, 0.405, 0.12), (-2.25, 0.25, 0.43, 0.05)]
    for index, (x, y, z, angle) in enumerate(paper_layout):
        rounded_box(f"OBS_paper_{index}", (1.35, 0.9, 0.035), (x, y, z), materials["paper"], collection, 0.015, rotation=(0, 0, angle), parent=papers)
    image_plane("PRINT_observe_persona", (1.0, 0.67), (-2.15, -0.56, 0.405), "persona-home.webp", collection, papers)
    output = rounded_box("OBS_output_card", (1.15, 0.76, 0.045), (0.15, -1.05, 0.43), materials["paper"], collection, 0.018)
    image_plane("PRINT_observe_output", (0.94, 0.56), (0.15, -1.082, 0.46), "persona-result.webp", collection, output)
    crop_frame("OBS_crop_frame", (0.15, -1.12, 0.49), 1.18, 0.78, materials["coral"], collection)

    rounded_box("OBS_folder", (1.5, 1.05, 0.11), (-2.0, 0.95, 0.44), materials["blue"], collection, 0.035, rotation=(0, 0, -0.06))
    rounded_box("OBS_folder_tab", (0.42, 0.28, 0.08), (-2.45, 1.34, 0.51), materials["coral"], collection, 0.02)
    rounded_box("OBS_material_tray", (1.3, 0.8, 0.18), (0.85, 1.15, 0.46), materials["warm"], collection, 0.05)
    for index, color in enumerate(("blue", "coral", "sky", "metal", "black")):
        material = materials[color] if color in materials else materials["acrylic"]
        rounded_box(f"OBS_swatch_{index}", (0.18, 0.62, 0.045), (0.45 + index * 0.2, 1.12, 0.59 + index * 0.006), material, collection, 0.014, rotation=(0, 0, -0.26 + index * 0.13))

    cylinder("OBS_pencil", 0.035, 1.45, (-1.2, -1.2, 0.5), materials["blue"], collection, rotation=(0, math.pi / 2, 0.22), vertices=16)
    for index in range(3):
        torus(f"OBS_clip_{index}", 0.11, 0.018, (-2.7 + index * 0.24, -1.05, 0.48), materials["metal"], collection, rotation=(math.pi / 2, 0, 0))
    curve_tube("OBS_lamp_arm", [(2.8, 1.0, 0.5), (2.65, 0.8, 1.5), (2.3, 0.35, 2.2)], 0.055, materials["metal"], collection)
    cylinder("OBS_lamp_shade", 0.28, 0.35, (2.23, 0.22, 2.2), materials["white"], collection, rotation=(math.pi / 2, 0, 0))
    scale_figure("OBS_operator", (2.75, -0.55, 0.35), materials["shadow"], collection)
    text_mesh("OBS_stage_label", "INPUT MATERIAL", (-1.0, 1.72, 0.44), 0.18, materials["black"], collection)
    add_common_route(collection, materials)


def build_structure(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    rounded_box("STR_console", (6.3, 3.6, 0.3), (0, 0, 0.17), materials["warm"], collection, 0.1)
    rounded_box("STR_grid_board", (5.35, 0.24, 3.35), (0, 0.72, 2.05), materials["white"], collection, 0.1)
    rounded_box("STR_board_base", (5.75, 1.1, 0.22), (0, 0.55, 0.48), materials["metal"], collection, 0.06)

    for index in range(9):
        x = -2.3 + index * 0.575
        rounded_box(f"STR_grid_v_{index}", (0.018, 0.025, 2.9), (x, 0.57, 2.05), materials["shadow"], collection, 0.006)
    for index in range(6):
        z = 0.75 + index * 0.52
        rounded_box(f"STR_grid_h_{index}", (4.85, 0.025, 0.018), (0, 0.57, z), materials["shadow"], collection, 0.006)

    panels = parent_empty("STR_panels", collection)
    panel_specs = [(-1.65, 0.42, 2.55, 1.25, 0.72), (-0.15, 0.42, 2.55, 1.35, 0.72), (1.55, 0.42, 2.45, 1.45, 1.02), (-1.35, 0.42, 1.45, 1.8, 0.72), (0.85, 0.42, 1.25, 2.2, 0.62)]
    panel_materials = [materials["paper"], materials["acrylic"], materials["paper"], materials["blue"], materials["paper"]]
    for index, (x, y, z, width, height) in enumerate(panel_specs):
        panel = rounded_box(f"STR_panel_{index}", (width, 0.075, height), (x, y, z), panel_materials[index], collection, 0.03, parent=panels)
        panel["target_slot"] = index
    image_plane("SCREEN_structure_system", (1.18, 0.74), (1.55, 0.372, 2.45), "persona-result.webp", collection, panels)
    rounded_box("STR_phase_chip", (0.52, 0.04, 0.14), (-1.65, 0.365, 2.55), materials["coral"], collection, 0.02, parent=panels)

    ruler = rounded_box("STR_type_ruler", (0.42, 0.09, 2.5), (-2.25, 0.35, 1.95), materials["blue"], collection, 0.03)
    ruler["animation_axis"] = "Z"
    for index, width in enumerate((0.22, 0.32, 0.44, 0.58, 0.72)):
        rounded_box(f"STR_type_bar_{index}", (width, 0.035, 0.05), (-2.25, 0.28, 1.12 + index * 0.35), materials["white"], collection, 0.012)

    tokens = parent_empty("STR_tokens", collection)
    token_materials = [materials["blue"], materials["coral"], materials["acrylic"], materials["black"], materials["metal"]]
    for index, material in enumerate(token_materials):
        rounded_box(f"STR_token_{index}", (0.36, 0.36, 0.36), (-1.2 + index * 0.52, -0.95, 0.48), material, collection, 0.06, parent=tokens)
    rounded_box("STR_token_dock", (3.25, 0.82, 0.18), (-0.15, -0.92, 0.28), materials["white"], collection, 0.05)

    connectors = parent_empty("STR_connectors", collection)
    for index, (start, end) in enumerate([
        ((-1.65, 0.31, 2.2), (-1.35, 0.31, 1.82)),
        ((-0.15, 0.31, 2.2), (0.85, 0.31, 1.55)),
        ((1.55, 0.31, 1.9), (0.85, 0.31, 1.55)),
    ]):
        curve_tube(f"STR_connector_{index}", [start, ((start[0] + end[0]) / 2, 0.29, (start[2] + end[2]) / 2 + 0.18), end], 0.025, materials["coral"], collection, connectors)

    rounded_box("STR_booklet", (1.35, 0.95, 0.12), (2.15, -0.95, 0.38), materials["paper"], collection, 0.04, rotation=(0, 0, -0.12))
    rounded_box("STR_booklet_band", (0.22, 0.98, 0.14), (1.85, -0.9, 0.46), materials["blue"], collection, 0.025, rotation=(0, 0, -0.12))
    rounded_box("STR_control_strip", (1.55, 0.45, 0.16), (-2.0, -0.9, 0.38), materials["black"], collection, 0.04)
    for index in range(4):
        cylinder(f"STR_control_{index}", 0.08, 0.05, (-2.48 + index * 0.32, -0.91, 0.5), materials["coral"] if index == 0 else materials["white"], collection)
    for index in range(8):
        cylinder(f"STR_pin_{index}", 0.055, 0.08, (-2.0 + (index % 4) * 1.3, 0.31, 0.95 + (index // 4) * 1.8), materials["metal"], collection, rotation=(math.pi / 2, 0, 0), vertices=24)
    final_panel = rounded_box("STR_final_panel", (0.2, 0.08, 0.82), (2.18, 0.345, 2.45), materials["coral"], collection, 0.035)
    final_panel["state"] = "wireframe_to_visual"
    scale_figure("STR_operator", (2.75, -0.5, 0.35), materials["shadow"], collection)
    text_mesh("STR_stage_label", "GRID RULE", (-1.55, 0.28, 3.42), 0.18, materials["black"], collection)
    add_common_route(collection, materials)


def build_prototype(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    rounded_box("PRO_test_bench", (6.6, 3.85, 0.3), (0, 0, 0.18), materials["warm"], collection, 0.1)
    rounded_box("PRO_monitor_frame", (2.8, 0.22, 1.8), (-0.55, 0.7, 1.75), materials["screen"], collection, 0.1)
    screen = image_plane("SCREEN_prototype_monitor", (2.5, 1.48), (-0.55, 0.575, 1.75), "web-aeroform.webp", collection)
    screen["state"] = "off_to_live"
    rounded_box("PRO_monitor_stem", (0.18, 0.42, 0.92), (-0.55, 0.88, 0.72), materials["metal"], collection, 0.04)
    rounded_box("PRO_monitor_foot", (1.25, 0.85, 0.12), (-0.55, 0.65, 0.38), materials["metal"], collection, 0.05)

    rounded_box("PRO_phone_frame", (0.72, 0.13, 1.42), (1.55, -0.55, 1.05), materials["black"], collection, 0.09, rotation=(0, 0, -0.08))
    image_plane("SCREEN_prototype_phone", (0.58, 1.18), (1.55, -0.625, 1.05), "persona-home.webp", collection)
    rounded_box("PRO_phone_stand", (0.78, 0.65, 0.12), (1.55, -0.32, 0.38), materials["metal"], collection, 0.04)
    rounded_box("PRO_tablet_frame", (1.6, 0.13, 1.18), (2.15, 0.65, 1.05), materials["white"], collection, 0.08, rotation=(0, 0, 0.05))
    image_plane("SCREEN_prototype_tablet", (1.38, 0.92), (2.15, 0.575, 1.05), "web-field-notes.webp", collection)

    rounded_box("PRO_keyboard", (2.15, 0.92, 0.13), (-0.8, -1.05, 0.39), materials["white"], collection, 0.06)
    for row in range(4):
        for col in range(9):
            rounded_box(f"PRO_key_{row}_{col}", (0.16, 0.14, 0.045), (-1.55 + col * 0.19, -1.3 + row * 0.18, 0.49), materials["paper"], collection, 0.02)
    rounded_box("PRO_trackpad", (0.85, 0.72, 0.08), (0.8, -1.05, 0.36), materials["metal"], collection, 0.05)
    sphere("PRO_mouse", 0.28, (2.35, -1.1, 0.47), (0.72, 1.0, 0.48), materials["white"], collection)

    rounded_box("PRO_esp32_board", (1.2, 0.78, 0.08), (-2.25, -0.65, 0.42), materials["blue"], collection, 0.04)
    rounded_box("PRO_esp32_chip", (0.38, 0.32, 0.11), (-2.25, -0.65, 0.51), materials["black"], collection, 0.025)
    for index in range(8):
        cylinder(f"PRO_pin_{index}", 0.025, 0.1, (-2.68 + (index % 4) * 0.28, -0.9 + (index // 4) * 0.5, 0.5), materials["metal"], collection, vertices=16)
    sensor = rounded_box("PRO_sensor", (0.48, 0.48, 0.38), (-2.55, 0.35, 0.55), materials["white"], collection, 0.08)
    sensor["state"] = "idle_to_active"
    ring = torus("PRO_light_ring", 0.48, 0.08, (-1.55, 0.45, 0.78), materials["coral"], collection, rotation=(math.pi / 2, 0, 0))
    ring["state"] = "low_to_active"
    curve_tube("PRO_cable_main", [(-2.2, -0.2, 0.38), (-1.25, -0.35, 0.35), (-0.2, -0.15, 0.34), (0.3, 0.35, 0.38)], 0.045, materials["rubber"], collection)
    curve_tube("PRO_cable_phone", [(1.55, -0.3, 0.36), (1.2, 0.0, 0.31), (0.55, 0.2, 0.34)], 0.035, materials["rubber"], collection)
    cursor = sphere("PRO_cursor", 0.075, (-1.1, 0.5, 1.85), (1, 1, 1), materials["coral"], collection)
    cursor["path"] = "monitor_ui"
    ui_layer = rounded_box("PRO_ui_layer", (0.82, 0.035, 0.26), (-0.3, 0.44, 1.35), materials["acrylic"], collection, 0.018)
    ui_layer["state"] = "enter"
    scale_figure("PRO_operator", (2.85, -0.2, 0.35), materials["shadow"], collection)
    text_mesh("PRO_stage_label", "LIVE PROTOTYPE", (-1.65, 0.48, 2.82), 0.17, materials["black"], collection)
    add_common_route(collection, materials)


def build_release(collection: bpy.types.Collection, materials: dict[str, bpy.types.Material]) -> None:
    rounded_box("REL_delivery_station", (6.7, 3.9, 0.32), (0, 0, 0.18), materials["warm"], collection, 0.1)
    rounded_box("REL_monitor_frame", (2.35, 0.2, 1.58), (-1.45, 0.72, 1.62), materials["screen"], collection, 0.09)
    image_plane("SCREEN_release_monitor", (2.08, 1.3), (-1.45, 0.605, 1.62), "web-units.webp", collection)
    rounded_box("REL_monitor_stem", (0.16, 0.35, 0.78), (-1.45, 0.84, 0.69), materials["metal"], collection, 0.04)
    rounded_box("REL_monitor_foot", (1.12, 0.72, 0.11), (-1.45, 0.65, 0.38), materials["metal"], collection, 0.05)

    rounded_box("REL_laptop_base", (1.85, 1.25, 0.12), (0.75, -0.15, 0.43), materials["metal"], collection, 0.06)
    lid = rounded_box("REL_devices", (1.85, 0.13, 1.2), (0.75, 0.35, 1.12), materials["screen"], collection, 0.07, rotation=(0.12, 0, 0))
    image_plane("SCREEN_release_laptop", (1.62, 0.98), (0.75, 0.274, 1.12), "web-smoke-fruit.webp", collection, lid)
    rounded_box("REL_phone_frame", (0.64, 0.12, 1.28), (2.25, -0.65, 0.96), materials["black"], collection, 0.08)
    image_plane("SCREEN_release_phone", (0.51, 1.06), (2.25, -0.72, 0.96), "persona-result.webp", collection)
    rounded_box("REL_phone_stand", (0.68, 0.58, 0.1), (2.25, -0.45, 0.38), materials["metal"], collection, 0.04)

    rounded_box("REL_projection_frame", (2.1, 0.11, 1.45), (1.75, 1.1, 1.7), materials["white"], collection, 0.07)
    image_plane("PRINT_release_device", (1.82, 1.17), (1.75, 1.035, 1.7), "device-tree-hole.webp", collection)

    qa_rows = parent_empty("REL_qa_rows", collection)
    rounded_box("REL_qa_panel", (2.1, 0.16, 1.72), (-2.45, -0.6, 1.32), materials["white"], collection, 0.08, parent=qa_rows)
    for index, label in enumerate(("BUILD", "BROWSER QA", "MOBILE", "DEPLOY")):
        z = 1.78 - index * 0.36
        rounded_box(f"REL_qa_row_{index}", (1.65, 0.04, 0.24), (-2.48, -0.705, z), materials["paper"], collection, 0.022, parent=qa_rows)
        cylinder(f"REL_qa_check_{index}", 0.075, 0.05, (-3.05, -0.75, z), materials["green"], collection, rotation=(math.pi / 2, 0, 0), parent=qa_rows)
        text_mesh(f"REL_qa_text_{index}", label, (-2.32, -0.76, z), 0.1, materials["black"], collection, parent=qa_rows)

    package = rounded_box("REL_archive_box", (1.55, 1.15, 0.55), (-0.25, -1.02, 0.56), materials["paper"], collection, 0.08)
    lid_group = parent_empty("REL_package_lid", collection)
    rounded_box("REL_archive_lid", (1.62, 1.22, 0.16), (-0.25, -1.02, 0.93), materials["white"], collection, 0.06, parent=lid_group)
    rounded_box("REL_archive_latch", (0.35, 0.12, 0.2), (-0.25, -1.65, 0.68), materials["coral"], collection, 0.03)
    rounded_box("REL_release_folder", (1.25, 0.85, 0.08), (0.0, -0.95, 1.04), materials["blue"], collection, 0.035, rotation=(0, 0, -0.08))

    rounded_box("REL_project_rack", (1.0, 0.72, 0.18), (1.4, -1.25, 0.36), materials["white"], collection, 0.05)
    for index, image in enumerate(("web-aeroform.webp", "persona-home.webp", "web-field-notes.webp")):
        card = rounded_box(f"REL_project_card_{index}", (0.72, 0.055, 0.55), (1.15 + index * 0.28, -1.32 + index * 0.06, 0.72 + index * 0.12), materials["paper"], collection, 0.025, rotation=(0.05 * index, 0, -0.12 + index * 0.08))
        image_plane(f"REL_project_image_{index}", (0.6, 0.42), (1.15 + index * 0.28, -1.355 + index * 0.06, 0.72 + index * 0.12), image, collection, card)

    rounded_box("REL_version", (1.15, 0.22, 0.15), (-1.5, -1.48, 0.43), materials["coral"], collection, 0.035)
    text_mesh("REL_version_text", "V2.1 LIVE", (-1.5, -1.6, 0.45), 0.1, materials["white"], collection)
    qr_base = rounded_box("REL_qr_card", (0.82, 0.08, 0.82), (2.75, 0.28, 0.85), materials["paper"], collection, 0.04)
    for row, col in ((0, 0), (0, 2), (1, 1), (2, 0), (2, 2), (3, 1), (1, 3), (3, 3)):
        rounded_box(f"REL_qr_{row}_{col}", (0.12, 0.03, 0.12), (2.5 + col * 0.16, 0.225, 0.58 + row * 0.16), materials["black"], collection, 0.01, parent=qr_base)

    live = rounded_box("REL_live_state", (0.82, 0.16, 0.22), (-1.45, 0.48, 2.62), materials["green"], collection, 0.04)
    live["state"] = "draft_to_live"
    final_panel = rounded_box("REL_final_panel", (1.3, 0.08, 0.55), (1.75, 0.98, 2.36), materials["acrylic"], collection, 0.035)
    final_panel["state"] = "expand"
    text_mesh("REL_stage_label", "QA PASSED", (-2.45, -0.72, 2.42), 0.17, materials["black"], collection)
    add_common_route(collection, materials)


BUILDERS = {
    "observe": build_observe,
    "structure": build_structure,
    "prototype": build_prototype,
    "release": build_release,
}

CAMERAS = {
    "observe": ((7.8, -10.8, 6.9), (0.0, 0.0, 1.0), 52),
    "structure": ((7.1, -11.2, 6.2), (0.0, 0.25, 1.65), 55),
    "prototype": ((7.2, -10.6, 5.6), (0.0, -0.05, 1.25), 58),
    "release": ((8.4, -12.2, 7.0), (0.0, 0.0, 1.25), 56),
}


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(stage: str, materials: dict[str, bpy.types.Material]) -> bpy.types.Collection:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.color_mode = "RGB"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.65

    world = bpy.data.worlds.new("MORPH World") if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    background = next(
        (node for node in world.node_tree.nodes if node.bl_idname == "ShaderNodeBackground"),
        None,
    )
    if background is None:
        raise RuntimeError("Background node missing from MORPH World")
    background.inputs["Color"].default_value = srgb(COLORS["sky"])
    background.inputs["Strength"].default_value = 0.45

    render_collection = new_collection("RENDER_ONLY")
    rounded_box("RENDER_floor", (18, 14, 0.08), (0, 0, -0.46), materials["ground"], render_collection, 0.02)

    camera_data = bpy.data.cameras.new("RenderCamera")
    camera = bpy.data.objects.new("RenderCamera", camera_data)
    render_collection.objects.link(camera)
    position, target, lens = CAMERAS[stage]
    camera.location = position
    camera.data.lens = lens
    camera.data.sensor_width = 36
    look_at(camera, target)
    scene.camera = camera

    key_data = bpy.data.lights.new("KeyArea", type="AREA")
    key_data.energy = 450
    key_data.shape = "DISK"
    key_data.size = 5.5
    key = bpy.data.objects.new("KeyArea", key_data)
    key.location = (-4.5, -5.5, 9.5)
    look_at(key, (0, 0, 0.8))
    render_collection.objects.link(key)

    fill_data = bpy.data.lights.new("FillArea", type="AREA")
    fill_data.energy = 170
    fill_data.color = (0.74, 0.84, 1.0)
    fill_data.size = 4.2
    fill = bpy.data.objects.new("FillArea", fill_data)
    fill.location = (5.5, -1.5, 6.5)
    look_at(fill, (0, 0, 1.0))
    render_collection.objects.link(fill)

    sun_data = bpy.data.lights.new("SoftSun", type="SUN")
    sun_data.energy = 0.45
    sun_data.angle = math.radians(16)
    sun = bpy.data.objects.new("SoftSun", sun_data)
    sun.rotation_euler = (math.radians(28), math.radians(-22), math.radians(-32))
    render_collection.objects.link(sun)
    return render_collection


def replace_external_texture_materials(
    collection: bpy.types.Collection,
    runtime_material: bpy.types.Material,
) -> list[tuple[bpy.types.Object, list[bpy.types.Material]]]:
    replacements = []
    for obj in collection.all_objects:
        if obj.type != "MESH" or not obj.name.startswith(EXTERNAL_TEXTURE_PREFIXES):
            continue
        original_materials = list(obj.data.materials)
        if not original_materials:
            continue
        obj.data.materials.clear()
        obj.data.materials.append(runtime_material)
        replacements.append((obj, original_materials))
    return replacements


def restore_external_texture_materials(
    replacements: list[tuple[bpy.types.Object, list[bpy.types.Material]]],
) -> None:
    for obj, original_materials in replacements:
        obj.data.materials.clear()
        for material in original_materials:
            obj.data.materials.append(material)


def export_stage(stage: str, collection: bpy.types.Collection) -> Path:
    bpy.ops.object.select_all(action="DESELECT")
    export_objects = [obj for obj in collection.all_objects if obj.get("export_role") != "render_label"]
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
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    bpy.ops.object.select_all(action="DESELECT")
    return output


def exported_asset_stats(path: Path) -> tuple[int, int]:
    payload = path.read_bytes()
    json_length = int.from_bytes(payload[12:16], "little")
    document = json.loads(payload[20 : 20 + json_length].decode("utf8").rstrip(" \0"))
    triangles = 0
    accessors = document.get("accessors", [])
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                continue
            triangles += accessors[primitive["indices"]]["count"] // 3
    return len(document.get("nodes", [])), triangles


def render_stage(stage: str) -> tuple[Path, Path]:
    scene = bpy.context.scene
    artifact = ARTIFACT_DIR / f"{list(BUILDERS).index(stage) + 1:02d}-{stage}.png"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(artifact)
    bpy.ops.render.render(write_still=True)

    fallback = FALLBACK_DIR / f"{stage}.webp"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 90
    scene.render.filepath = str(fallback)
    bpy.ops.render.render(write_still=True)
    return artifact, fallback


def build_stage(stage: str) -> dict[str, int | str]:
    clear_scene()
    materials = create_materials()
    export_collection = new_collection(f"EXPORT_{stage.upper()}")
    BUILDERS[stage](export_collection, materials)
    setup_render(stage, materials)
    replacements = replace_external_texture_materials(export_collection, materials["screen"])
    try:
        glb = export_stage(stage, export_collection)
    finally:
        restore_external_texture_materials(replacements)
    objects, triangles = exported_asset_stats(glb)
    artifact, fallback = render_stage(stage)
    return {
        "stage": stage,
        "glb": str(glb),
        "glb_bytes": glb.stat().st_size,
        "objects": objects,
        "triangles": triangles,
        "artifact": str(artifact),
        "artifact_bytes": artifact.stat().st_size,
        "fallback": str(fallback),
        "fallback_bytes": fallback.stat().st_size,
    }


def main() -> None:
    results = [build_stage(stage) for stage in BUILDERS]
    print("ROUND2_ASSET_STATS=" + json.dumps(results, ensure_ascii=True))


if __name__ == "__main__":
    main()
