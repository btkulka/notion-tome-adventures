"""
Builds the world-map props in Blender.

  npm run models                                  # every model → public/models/world-props.glb
  npm run models -- --only trees --sheet out.png  # one module, preview sheet, no GLB
  npm run models -- --names fir-1,oak-2 --sheet out.png --lo

Runs inside Blender (scripts/models/run.mjs finds it):
  blender --background --factory-startup --python-exit-code 1 --python scripts/models/build.py -- [args]

Each model is built twice: full detail as '<name>' and far zoom as
'<name>_lo'. Triangle counts are checked against the budgets in each
@model(...) registration; going over fails the build. Ambient occlusion is
then baked into every model's colours (--no-ao skips it).
"""
import argparse
import importlib
import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
# Progress shows as it happens, even through a pipe or a log file.
sys.stdout.reconfigure(line_buffering=True)

import kit  # noqa: E402
import detail as detail_pass  # noqa: E402

MODULES = ['trees', 'ground', 'settlements', 'landmarks', 'imported']

# Ambient occlusion baked into 'Col' (bake_ao). Distance is in tiles: how far
# away geometry still shades a corner. Strength is how dark a fully enclosed
# corner gets (0 none, 1 black). The app multiplies colour by PROP_EXPOSURE, so
# AO reads about twice as strong there as the raw numbers suggest.
AO_DISTANCE = 0.4
AO_STRENGTH = 0.65
AO_SAMPLES = 64

# Sides multiplier for round shapes in full-detail builds (kit.dseg). 1 is the
# original faceted look; above 1 also refines rocks and foliage one level and
# runs the detail pass (detail.py: windows, slits, timber, eaves).
DETAIL = 1.0

# Model detail tiers: the app loads one by the viewer's Graphics setting
# (src/features/maps/render/quality.ts). Each step doubles the triangles of the
# one below (DETAIL doubles; see kit.sphere_frequency). Medium and up add the
# high-fantasy flair in detail.py. (name, detail, flair, file in public/models/)
TIERS = [
    ('low', 3.0, False, 'world-props-low.glb'),
    ('medium', 6.0, True, 'world-props-medium.glb'),
]
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
    p.add_argument('--no-ao', action='store_true', help="skip the AO bake (fast iteration; falls back to each model's ground_ao)")
    p.add_argument('--ao-strength', type=float, default=AO_STRENGTH)
    p.add_argument('--ao-distance', type=float, default=AO_DISTANCE)
    p.add_argument('--ao-corners', action='store_true', help='keep per-corner AO gradients instead of one value per face')
    p.add_argument('--detail', type=float, default=DETAIL,
                   help='multiply the sides of round shapes (and the triangle budgets) in full-detail builds; far versions stay as drawn')
    p.add_argument('--tier', default='', help='build only this tier (low, medium); with --names/--sheet, preview at that tier')
    p.add_argument('--flair', action='store_true', help='with --detail and no --tier: add the high-fantasy flair pass')
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
    """Collapse to the triangle target. One pass can stop well short on dense
    imported meshes, so repeat (up to four times) while it's still over."""
    for _ in range(4):
        tris = count_tris(obj)
        if tris <= target:
            break
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.use_collapse_triangulate = True
        mod.ratio = max(0.02, target / max(1, tris) * 0.95)
        deps = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
        old = obj.data
        obj.modifiers.remove(mod)
        obj.data = mesh
        mesh.name = obj.name
        bpy.data.meshes.remove(old)


def build_all(names, detail=1.0, flair=False):
    built, problems = [], []
    for name in names:
        spec = kit.REGISTRY[name]
        # Round shapes gain sides at DETAIL in the full build; the far version never does.
        kit.CONTEXT = spec['module']
        kit.DETAIL = detail
        mesh = spec['fn'](kit.seeded(name), False)
        if detail > 1:
            detail_pass.apply(mesh, name, flair)
        hi = mesh.to_object(name)
        kit.DETAIL = 1.0
        lo = spec['fn'](kit.seeded(name), True).to_object(name + '_lo')
        if count_tris(lo) > spec['lo']:
            decimate(lo, spec['lo'])
        th, tl = count_tris(hi), count_tris(lo)
        # The cap doubles with every tier, like the triangles: 4x at Low (detail 3), 8x at Medium.
        budget = int(spec['budget'] * (4 * detail / 3 if detail > 1 else 1))
        if th > budget:
            problems.append(f'{name}: {th} triangles, budget {budget}')
        if tl > spec['lo'] * 1.1:
            problems.append(f'{name}_lo: {tl} triangles, budget {spec["lo"]}')
        dims = hi.dimensions
        built.append({'name': name, 'hi': hi, 'lo': lo, 'spec': spec, 'tris': th, 'lo_tris': tl, 'height': dims.z})
        print(f'  {name:<24} {th:>5} / {budget:<5} lo {tl:>4} / {spec["lo"]:<4} h {dims.z:.2f} w {max(dims.x, dims.y):.2f}')
    return built, problems


def bake_ao(objs, distance=AO_DISTANCE, strength=AO_STRENGTH, samples=AO_SAMPLES, per_face=True):
    """Multiply Cycles-baked ambient occlusion into each object's 'Col'.

    Cycles bakes every face corner; by default each face then takes the mean of
    its corners, so facets stay flat (per_face=False keeps the per-corner
    gradients, which read softer). A ground plane stands in for the terrain, which
    is what makes bases sit in the ground. Every model is built at the origin,
    so all but the one baking are hidden from the render while it bakes.
    """
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake')
    scene.world.light_settings.distance = distance
    scene.render.bake.target = 'VERTEX_COLORS'
    scene.render.bake.use_selected_to_active = False

    # Cycles bakes through a material; the diffuse colour doesn't matter for AO.
    mat = bpy.data.materials.new('ao-bake')
    ground_me = bpy.data.meshes.new('ao-ground')
    ground_me.from_pydata([(-4, -4, 0), (4, -4, 0), (4, 4, 0), (-4, 4, 0)], [], [(0, 1, 2, 3)])
    ground = bpy.data.objects.new('ao-ground', ground_me)
    scene.collection.objects.link(ground)

    for obj in objs:
        obj.hide_render = True
    started = time.time()
    for n, obj in enumerate(objs):
        me = obj.data
        obj.hide_render = False
        added_mat = not me.materials
        if added_mat:
            me.materials.append(mat)
        ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = ao
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')

        count = len(me.loops)
        occl = np.empty(count * 4, dtype=np.float32)
        me.color_attributes['AO'].data.foreach_get('color', occl)
        occl = np.clip(occl.reshape(-1, 4)[:, 0], 0.0, 1.0)
        # Corners sunk below the ground bake black; they're never seen, so they don't count.
        vidx = np.empty(count, dtype=np.int64)
        me.loops.foreach_get('vertex_index', vidx)
        co = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        seen = co.reshape(-1, 3)[vidx, 2] >= -1e-4
        if per_face:
            # One value per face keeps facets flat: a crease darkens the faces
            # that meet in it, without gradients softening them.
            polys = len(me.polygons)
            total = np.empty(polys, dtype=np.int64)
            me.polygons.foreach_get('loop_total', total)
            face = np.repeat(np.arange(polys), total)
            hits = np.bincount(face, weights=seen.astype(np.float64), minlength=polys)
            sums = np.bincount(face, weights=np.where(seen, occl, 0.0), minlength=polys)
            occl = np.where(hits > 0, sums / np.maximum(hits, 1), 1.0)[face]
        else:
            occl = np.where(seen, occl, 1.0)
        col = np.empty(count * 4, dtype=np.float32)
        me.color_attributes['Col'].data.foreach_get('color', col)
        # 'color' reads and writes linear values on the byte attribute, so the darkening is in linear light.
        k = 1.0 - strength * (1.0 - occl)
        col = col.reshape(-1, 4)
        col[:, :3] *= k[:, None]
        me.color_attributes['Col'].data.foreach_set('color', col.ravel())
        me.color_attributes.remove(me.color_attributes['AO'])
        target = me.color_attributes['Col']
        me.color_attributes.active_color = target
        me.color_attributes.render_color_index = me.color_attributes.find('Col')
        if added_mat:
            me.materials.clear()
        obj.hide_render = True
        if (n + 1) % 20 == 0:
            print(f'  AO {n + 1}/{len(objs)}  {time.time() - started:.0f}s')

    for obj in objs:
        obj.hide_render = False
    bpy.data.objects.remove(ground)
    bpy.data.meshes.remove(ground_me)
    print(f'Baked AO into {len(objs)} meshes in {time.time() - started:.0f}s (distance {distance}, strength {strength})')


def tag_materials(objs):
    """Copy each face's material (kit.MATERIALS index) to a corner float '_mat',
    which glTF carries as a custom vertex attribute for the app's pattern shader."""
    for obj in objs:
        me = obj.data
        src = me.attributes.get('mat')
        polys = len(me.polygons)
        mats = np.zeros(polys, dtype=np.int64)
        if src is not None and src.domain == 'FACE':
            src.data.foreach_get('value', mats)
        total = np.empty(polys, dtype=np.int64)
        me.polygons.foreach_get('loop_total', total)
        dst = me.attributes.get('_mat') or me.attributes.new('_mat', 'FLOAT', 'CORNER')
        dst.data.foreach_set('value', np.repeat(mats, total).astype(np.float32))


def export_glb(built, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tag_materials([o for b in built for o in (b['hi'], b['lo'])])
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
        # '_mat' (see tag_materials): attributes starting with '_' go out as custom attributes.
        export_attributes=True,
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


def nodes_on(idblock):
    """Blender 5 gives every material and world a node tree; 4.x needed use_nodes."""
    if bpy.app.version < (5, 0, 0):
        idblock.use_nodes = True


def principled(nodes):
    """The Principled BSDF, found by type: names are localised."""
    return next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')


# -- preview sheet ---------------------------------------------------------------

PATTERN_ATLAS = os.path.join(ROOT, 'public', 'textures', 'props', 'patterns.png')
MATERIAL_TABLE = os.path.join(ROOT, 'src', 'features', 'maps', 'render', 'prop-materials.json')
# The atlas layout of scripts/textures/generate-prop-patterns.ts.
ATLAS_COLS, ATLAS_CELL, ATLAS_GUTTER = 4, 512, 16
ARCANE_DAY = (0.42 * 0.45, 0.78 * 0.45, 1.0 * 0.45)


def pattern_images():
    """{material index: (image, scale, strength)}: each patterned material's cell cut from the app's atlas."""
    if not os.path.exists(PATTERN_ATLAS) or not os.path.exists(MATERIAL_TABLE):
        return {}
    with open(MATERIAL_TABLE, encoding='utf-8') as fh:
        table = json.load(fh)
    atlas = bpy.data.images.load(PATTERN_ATLAS, check_existing=True)
    w, h = atlas.size
    px = np.empty(w * h * 4, dtype=np.float32)
    atlas.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    side = ATLAS_CELL + ATLAS_GUTTER * 2
    out = {}
    for i, entry in enumerate(table):
        if entry['strength'] <= 0:
            continue
        col, row = i % ATLAS_COLS, i // ATLAS_COLS
        # Blender's pixel rows start at the bottom; the atlas's rows count from the top.
        y0 = h - (row + 1) * side + ATLAS_GUTTER
        x0 = col * side + ATLAS_GUTTER
        img = bpy.data.images.new('pattern-' + entry['name'], ATLAS_CELL, ATLAS_CELL)
        img.pixels.foreach_set(px[y0:y0 + ATLAS_CELL, x0:x0 + ATLAS_CELL].ravel())
        img.colorspace_settings.name = 'Non-Color'
        out[i] = (img, entry['scale'], entry['strength'])
    return out


def prop_material():
    """What the app draws: vertex colour x exposure, times each face's material
    pattern (box-projected in object space, like the app's shader), plus the
    faint daytime glow of arcane faces."""
    mat = bpy.data.materials.new('prop')
    # The app draws front faces only, so a face wound inward is a hole there; show it here too.
    mat.use_backface_culling = True
    nodes_on(mat)
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

    material_id = nodes.new('ShaderNodeAttribute')
    material_id.attribute_type = 'GEOMETRY'
    material_id.attribute_name = 'mat'
    coords = nodes.new('ShaderNodeTexCoord')
    factor = None
    for index, (img, scale, strength) in pattern_images().items():
        mapping = nodes.new('ShaderNodeMapping')
        mapping.inputs['Scale'].default_value = (scale, scale, scale)
        links.new(coords.outputs['Object'], mapping.inputs['Vector'])
        tex = nodes.new('ShaderNodeTexImage')
        tex.image = img
        tex.projection = 'BOX'
        tex.projection_blend = 0.0
        links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        is_it = nodes.new('ShaderNodeMath')
        is_it.operation = 'COMPARE'
        is_it.inputs[1].default_value = index
        is_it.inputs[2].default_value = 0.5
        links.new(material_id.outputs['Fac'], is_it.inputs[0])
        # 1 + strength * is_it * (2 * pattern - 1)
        centred = nodes.new('ShaderNodeMath')
        centred.operation = 'MULTIPLY_ADD'
        centred.inputs[1].default_value = 2.0
        centred.inputs[2].default_value = -1.0
        links.new(tex.outputs['Color'], centred.inputs[0])
        weight = nodes.new('ShaderNodeMath')
        weight.operation = 'MULTIPLY'
        weight.inputs[1].default_value = strength
        links.new(is_it.outputs['Value'], weight.inputs[0])
        term = nodes.new('ShaderNodeMath')
        term.operation = 'MULTIPLY_ADD'
        term.inputs[2].default_value = 1.0
        links.new(centred.outputs['Value'], term.inputs[0])
        links.new(weight.outputs['Value'], term.inputs[1])
        if factor is None:
            factor = term
        else:
            both = nodes.new('ShaderNodeMath')
            both.operation = 'MULTIPLY'
            links.new(factor.outputs['Value'], both.inputs[0])
            links.new(term.outputs['Value'], both.inputs[1])
            factor = both
    if factor is not None:
        patterned = nodes.new('ShaderNodeVectorMath')
        patterned.operation = 'SCALE'
        links.new(lift.outputs['Vector'], patterned.inputs[0])
        links.new(factor.outputs['Value'], patterned.inputs['Scale'])
        links.new(patterned.outputs['Vector'], diffuse.inputs['Color'])
    else:
        links.new(lift.outputs['Vector'], diffuse.inputs['Color'])

    # Arcane faces glow faintly by day (the app adds more after dark).
    arcane = nodes.new('ShaderNodeMath')
    arcane.operation = 'COMPARE'
    arcane.inputs[1].default_value = kit.MATERIALS.index('arcane')
    arcane.inputs[2].default_value = 0.5
    links.new(material_id.outputs['Fac'], arcane.inputs[0])
    glow = nodes.new('ShaderNodeEmission')
    glow.inputs['Color'].default_value = (*ARCANE_DAY, 1.0)
    links.new(arcane.outputs['Value'], glow.inputs['Strength'])
    add = nodes.new('ShaderNodeAddShader')
    links.new(diffuse.outputs['BSDF'], add.inputs[0])
    links.new(glow.outputs['Emission'], add.inputs[1])
    links.new(add.outputs['Shader'], out.inputs['Surface'])
    return mat


def ground_material(key, cache={}):
    if key in cache:
        return cache[key]
    mat = bpy.data.materials.new('ground-' + key)
    nodes_on(mat)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = principled(nodes)
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
    nodes_on(side)
    principled(side.node_tree.nodes).inputs['Base Color'].default_value = (0.06, 0.045, 0.03, 1)
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
    nodes_on(mat)
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
    nodes_on(world)
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

    # Blender 5 renamed EEVEE Next back to EEVEE.
    engines = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = cols * cell
    scene.render.resolution_y = max(200, int(cols * cell * height / width))
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Filmic'
    scene.render.image_settings.media_type = 'IMAGE'  # Blender 5: set before file_format
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    print(f'Wrote sheet {path}')


def main():
    args = parse()
    only = [s for s in args.only.split(',') if s]
    picked = [s for s in args.names.split(',') if s]
    reset_scene()
    # Baked AO darkens where models meet the ground, so the builders' cheap ground_ao steps aside.
    kit.BAKED_AO = not args.no_ao
    load_modules(only)
    # Draft imports (imported.py) only build when named, so they never reach the app's GLB by accident.
    names = sorted(n for n, s in kit.REGISTRY.items() if not s.get('draft')) if not picked else picked
    missing = [n for n in names if n not in kit.REGISTRY]
    if missing:
        raise SystemExit(f'Unknown models: {", ".join(missing)}')
    if not names:
        raise SystemExit('No models registered')

    # The app's files: every tier, each its own build, bake and GLB. A filtered
    # run (--only/--names) or an explicit --glb builds just the one asked for.
    if not (only or picked or args.glb):
        tiers = [t for t in TIERS if not args.tier or t[0] == args.tier]
    else:
        named = {t[0]: t for t in TIERS}.get(args.tier)
        tiers = [(args.tier, named[1], named[2], args.glb or '')] if named else [('custom', args.detail, args.flair, args.glb or '')]

    problems = []
    for tier, detail, flair, glb_name in tiers:
        reset_scene()
        print(f'Building {len(names)} models, {tier} tier (detail {detail:g}{", flair" if flair else ""}) (triangles / budget):')
        built, over = build_all(names, detail, flair)
        problems += [f'{tier}: {p}' for p in over]
        total = sum(b['tris'] for b in built)
        print(f'Total {total} triangles full, {sum(b["lo_tris"] for b in built)} far')
        if not args.no_ao:
            bake_ao([o for b in built for o in (b['hi'], b['lo'])], distance=args.ao_distance, strength=args.ao_strength, per_face=not args.ao_corners)
        if glb_name:
            export_glb(built, glb_name if os.path.isabs(glb_name) or os.sep in glb_name or '/' in glb_name else os.path.join(ROOT, 'public', 'models', glb_name))

    if args.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.blend))
    if args.sheet:
        render_sheet(built, args.sheet, args.lo, args.cell)
    if problems:
        print('Over budget:\n  ' + '\n  '.join(problems))
        raise SystemExit(1)


main()
