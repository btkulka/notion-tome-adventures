"""
Builds the world-map props in Blender.

  npm run models                                  # every model → public/models/world-props.glb
  npm run models -- --only trees --sheet out.png  # one module, preview sheet, no GLB
  npm run models -- --names fir-1,oak-2 --sheet out.png --lo

Runs inside Blender (scripts/models/run.mjs finds it):
  blender --background --factory-startup --python-exit-code 1 --python scripts/models/build.py -- [args]

Each model is built twice: full detail as '<name>' and far zoom as
'<name>_lo'. Triangle counts are checked against the budgets in each
@model(...) registration; going over fails the build.
"""
import argparse
import importlib
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import kit  # noqa: E402

MODULES = ['trees', 'ground', 'settlements', 'landmarks']
TEXTURES = os.path.join(ROOT, 'public', 'textures', 'terrain')

# The app's light (MapView.tsx, daytime) converted from three.js Y-up to Blender Z-up.
# three's directional intensity matches a Blender sun's strength; its hemisphere
# light is π times dimmer than a world of the same strength.
SUN_FROM = Vector((-36.0, 14.0, 48.0))
SUN_STRENGTH = 1.7
SKY = (0.79, 0.83, 0.88)
SKY_STRENGTH = 0.85 / math.pi
# Must match PROP_EXPOSURE in src/features/maps/render/models.ts.
PROP_EXPOSURE = 2.2
BACKDROP = (0.012, 0.011, 0.014)
# The map camera looks down the (1, 1, 1) diagonal in three.js: (1, -1, 1) here.
VIEW = Vector((1.0, -1.0, 1.0)).normalized()
# Rows sit this many cells apart, so a row never covers the labels of the one behind it.
ROW_GAP = 1.75


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(prog='build.py')
    p.add_argument('--only', default='', help='comma-separated modules')
    p.add_argument('--names', default='', help='comma-separated model names')
    p.add_argument('--sheet', default='', help='render a preview sheet to this PNG')
    p.add_argument('--lo', action='store_true', help='show the far-zoom versions in the sheet')
    p.add_argument('--cell', type=int, default=300, help='sheet pixels per column')
    p.add_argument('--glb', default='', help='GLB path (default public/models/world-props.glb when nothing is filtered)')
    p.add_argument('--blend', default='', help='also save the built scene as a .blend for hand editing')
    return p.parse_args(argv)


def load_modules(only):
    wanted = [m for m in MODULES if not only or m in only]
    for name in wanted:
        if os.path.exists(os.path.join(HERE, name + '.py')):
            importlib.import_module(name)
        elif only:
            raise SystemExit(f'No module {name}.py')


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def count_tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate(obj, target):
    mod = obj.modifiers.new('decimate', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.ratio = max(0.02, target / max(1, count_tris(obj)) * 0.95)
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
    old = obj.data
    obj.modifiers.remove(mod)
    obj.data = mesh
    mesh.name = obj.name
    bpy.data.meshes.remove(old)


def build_all(names):
    built, problems = [], []
    for name in names:
        spec = kit.REGISTRY[name]
        hi = spec['fn'](kit.seeded(name), False).to_object(name)
        lo = spec['fn'](kit.seeded(name), True).to_object(name + '_lo')
        if count_tris(lo) > spec['lo']:
            decimate(lo, spec['lo'])
        th, tl = count_tris(hi), count_tris(lo)
        if th > spec['budget']:
            problems.append(f'{name}: {th} triangles, budget {spec["budget"]}')
        if tl > spec['lo'] * 1.1:
            problems.append(f'{name}_lo: {tl} triangles, budget {spec["lo"]}')
        dims = hi.dimensions
        built.append({'name': name, 'hi': hi, 'lo': lo, 'spec': spec, 'tris': th, 'lo_tris': tl, 'height': dims.z})
        print(f'  {name:<24} {th:>5} / {spec["budget"]:<5} lo {tl:>4} / {spec["lo"]:<4} h {dims.z:.2f} w {max(dims.x, dims.y):.2f}')
    return built, problems


def export_glb(built, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for b in built:
        b['hi'].select_set(True)
        b['lo'].select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=False,
        export_texcoords=False,
        export_materials='NONE',
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        # The app decodes with three's Draco decoder, copied into public/draco/.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_color_quantization=10,
    )
    print(f'Wrote {path} ({os.path.getsize(path) // 1024} KB)')


# -- preview sheet ---------------------------------------------------------------

def prop_material():
    mat = bpy.data.materials.new('prop')
    # The app draws front faces only, so a face wound inward is a hole there; show it here too.
    mat.use_backface_culling = True
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.clear()
    attr = nodes.new('ShaderNodeVertexColor')
    attr.layer_name = 'Col'
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    out = nodes.new('ShaderNodeOutputMaterial')
    lift = nodes.new('ShaderNodeVectorMath')
    lift.operation = 'SCALE'
    lift.inputs['Scale'].default_value = PROP_EXPOSURE
    links.new(attr.outputs['Color'], lift.inputs[0])
    links.new(lift.outputs['Vector'], diffuse.inputs['Color'])
    links.new(diffuse.outputs['BSDF'], out.inputs['Surface'])
    return mat


def ground_material(key, cache={}):
    if key in cache:
        return cache[key]
    mat = bpy.data.materials.new('ground-' + key)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 1.0
    path = os.path.join(TEXTURES, key + '.png')
    if os.path.exists(path):
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(path, check_existing=True)
        links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    cache[key] = mat
    return mat


def ground_tile(key, at):
    """A one-tile diorama block under a model, textured like the map (2.5 tiles per repeat)."""
    m = kit.Mesh()
    top = m.box((1.0, 1.0, 0.12), at=(0, 0, -0.12), color='earth')
    obj = m.to_object('tile-' + key)
    obj.location = at
    uv = obj.data.uv_layers.new()
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            co = obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x + 0.5) * 0.4, (co.y + 0.5) * 0.4)
    obj.data.materials.append(ground_material(key))
    side = bpy.data.materials.new('side')
    side.diffuse_color = (0.09, 0.07, 0.05, 1)
    side.use_nodes = True
    side.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.06, 0.045, 0.03, 1)
    obj.data.materials.append(side)
    for poly in obj.data.polygons:
        poly.material_index = 0 if poly.normal.z > 0.5 else 1
    return obj


def label(text, at, rot, size):
    curve = bpy.data.curves.new('label', 'FONT')
    curve.body = text
    curve.size = size
    curve.align_x = 'CENTER'
    obj = bpy.data.objects.new('label', curve)
    obj.location = at
    obj.rotation_euler = rot
    mat = bpy.data.materials.new('label')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    em = nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.77, 0.64, 0.35, 1)
    out = nodes.new('ShaderNodeOutputMaterial')
    mat.node_tree.links.new(em.outputs['Emission'], out.inputs['Surface'])
    curve.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def render_sheet(built, path, use_lo, cell):
    scene = bpy.context.scene
    for b in built:
        (b['hi'] if use_lo else b['lo']).hide_render = True
    items = [(b['lo'] if use_lo else b['hi'], b) for b in built]
    mat = prop_material()
    for obj, _ in items:
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    n = len(items)
    tallest = max(b['height'] for b in built)
    # A one-tile block spans √2 along the screen, so cells need more than that.
    spacing = max(1.6, max(b['spec']['size'] for b in built) + 0.6)
    cols = max(1, min(n, math.ceil(math.sqrt(n * 2.2))))
    rows = math.ceil(n / cols)

    right = Vector((1, 1, 0)).normalized()
    back = Vector((-1, 1, 0)).normalized()
    cam_rot = (-VIEW).to_track_quat('-Z', 'Y').to_euler()
    for i, (obj, b) in enumerate(items):
        c, r = i % cols, i // cols
        pos = right * (c * spacing) - back * (r * spacing * ROW_GAP)
        obj.location = pos
        ground_tile(b['spec']['ground'], pos)
        text = f"{b['name']}  {b['lo_tris'] if use_lo else b['tris']}"
        # Under the block's nearest corner, so the block never hides it.
        label(text, pos + Vector((0.62, -0.62, -0.42)), cam_rot, 0.13)

    # Frame: width along screen-right, height from ground depth and model heights.
    elev = math.asin(VIEW.z)
    width = (cols - 1) * spacing + spacing * 1.1
    depth = (rows - 1) * spacing * ROW_GAP
    height = depth * math.sin(elev) + (tallest + 0.3) * math.cos(elev) + spacing * 0.75 + 0.5
    centre = right * ((cols - 1) * spacing / 2) - back * (depth / 2) + Vector((0, 0, tallest * 0.35 - 0.3))

    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.sensor_fit = 'HORIZONTAL'
    cam_data.ortho_scale = width
    cam_data.clip_end = 500
    cam = bpy.data.objects.new('cam', cam_data)
    cam.location = centre + VIEW * 100
    cam.rotation_euler = cam_rot
    scene.collection.objects.link(cam)
    scene.camera = cam

    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.energy = SUN_STRENGTH
    sun_data.color = (1.0, 0.95, 0.86)
    sun_data.use_shadow = False
    sun = bpy.data.objects.new('sun', sun_data)
    sun.rotation_euler = (-SUN_FROM).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(sun)

    world = bpy.data.worlds.new('world')
    scene.world = world
    world.use_nodes = True
    nodes, links = world.node_tree.nodes, world.node_tree.links
    nodes.clear()
    path_node = nodes.new('ShaderNodeLightPath')
    sky = nodes.new('ShaderNodeBackground')
    sky.inputs['Color'].default_value = (*SKY, 1)
    sky.inputs['Strength'].default_value = SKY_STRENGTH
    dark = nodes.new('ShaderNodeBackground')
    dark.inputs['Color'].default_value = (*BACKDROP, 1)
    mix = nodes.new('ShaderNodeMixShader')
    out = nodes.new('ShaderNodeOutputWorld')
    links.new(path_node.outputs['Is Camera Ray'], mix.inputs['Fac'])
    links.new(sky.outputs['Background'], mix.inputs[1])
    links.new(dark.outputs['Background'], mix.inputs[2])
    links.new(mix.outputs['Shader'], out.inputs['Surface'])

    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = cols * cell
    scene.render.resolution_y = max(200, int(cols * cell * height / width))
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    print(f'Wrote sheet {path}')


def main():
    args = parse()
    only = [s for s in args.only.split(',') if s]
    picked = [s for s in args.names.split(',') if s]
    reset_scene()
    load_modules(only)
    names = sorted(kit.REGISTRY) if not picked else picked
    missing = [n for n in names if n not in kit.REGISTRY]
    if missing:
        raise SystemExit(f'Unknown models: {", ".join(missing)}')
    if not names:
        raise SystemExit('No models registered')

    print(f'Building {len(names)} models (triangles / budget):')
    built, problems = build_all(names)
    total = sum(b['tris'] for b in built)
    print(f'Total {total} triangles full, {sum(b["lo_tris"] for b in built)} far')

    glb = args.glb or ('' if (only or picked) else os.path.join(ROOT, 'public', 'models', 'world-props.glb'))
    if glb:
        export_glb(built, glb)
    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    if args.sheet:
        render_sheet(built, args.sheet, args.lo, args.cell)
    if problems:
        print('Over budget:\n  ' + '\n  '.join(problems))
        raise SystemExit(1)


main()
