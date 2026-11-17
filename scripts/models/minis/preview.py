"""Preview a generated miniature: four turns of one GLB side by side, seen from the
map camera's angle, on the plain grey of the concept art.

    node scripts/models/run.mjs script scripts/models/minis/preview.py in.glb out.png [cell px]

The model is normalised (footprint centred, base on the ground, largest side 1);
the copies are linked, so a 500k-triangle mesh costs its memory once.
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(argv) < 2:
    raise SystemExit('Usage: preview.py in.glb out.png [cell]')
SRC, OUT = os.path.abspath(argv[0]), os.path.abspath(argv[1])
CELL = int(argv[2]) if len(argv) > 2 else 640
# One turn at a big cell is a close-up for busy models (a city).
TURNS_ARG = int(argv[3]) if len(argv) > 3 else 4

# Same angles as build.py's sheets: the map camera looks down (1, -1, 1), the sun comes from SUN_FROM.
VIEW = Vector((1.0, -1.0, 1.0)).normalized()
SUN_FROM = Vector((-36.0, 14.0, 48.0))
RIGHT = Vector((1.0, 1.0, 0.0)).normalized()
SPACING = 1.6
TURNS = TURNS_ARG

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in scene.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit(f'No meshes in {SRC}')

# Untextured (vertex-painted) meshes: show their colour attribute.
for o in meshes:
    textured = any(n.type == 'TEX_IMAGE' for s in o.material_slots if s.material and s.material.node_tree for n in s.material.node_tree.nodes)
    if textured or not o.data.color_attributes:
        continue
    mat = bpy.data.materials.new('painted')
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    attr = nt.nodes.new('ShaderNodeVertexColor')
    attr.layer_name = o.data.color_attributes[0].name
    nt.links.new(attr.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    o.data.materials.clear()
    o.data.materials.append(mat)

lo = Vector((math.inf,) * 3)
hi = Vector((-math.inf,) * 3)
tris = 0
for o in meshes:
    for c in o.bound_box:
        p = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, p))
        hi = Vector(map(max, hi, p))
    tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
size = hi - lo
scale = 1.0 / max(size)
# Cells as wide as the model's footprint needs (a slender tree gets closer turns, so it renders bigger).
SPACING = max(size.x, size.y) * scale * math.sqrt(2) * 1.08 + 0.12
norm = Matrix.Scale(scale, 4) @ Matrix.Translation(Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))

original = {o.name: o.matrix_world.copy() for o in meshes}
for i in range(TURNS):
    place = Matrix.Translation(RIGHT * (i * SPACING)) @ Matrix.Rotation(i * math.tau / TURNS, 4, 'Z') @ norm
    for o in meshes:
        c = o if i == 0 else o.copy()
        if i:
            scene.collection.objects.link(c)
        c.parent = None
        c.matrix_world = place @ original[o.name]

# Camera: orthographic, framing the row.
elev = math.asin(VIEW.z)
height = size.z * scale
width = (TURNS - 1) * SPACING + SPACING * 1.15
footprint = max(size.x, size.y) * scale * math.sqrt(2)
tall = height * math.cos(elev) + footprint * math.sin(elev) + 0.3
centre = RIGHT * ((TURNS - 1) * SPACING / 2) + Vector((0, 0, height * 0.42))
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'HORIZONTAL'
cam_data.ortho_scale = width
cam_data.clip_end = 500
cam = bpy.data.objects.new('cam', cam_data)
cam.location = centre + VIEW * 100
cam.rotation_euler = (-VIEW).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(cam)
scene.camera = cam

sun_data = bpy.data.lights.new('sun', 'SUN')
sun_data.energy = 3.0
sun_data.color = (1.0, 0.96, 0.9)
sun_data.angle = math.radians(8)
sun = bpy.data.objects.new('sun', sun_data)
sun.rotation_euler = (-SUN_FROM).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(sun)

world = bpy.data.worlds.new('world')
scene.world = world
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs['Color'].default_value = (0.62, 0.63, 0.65, 1)
bg.inputs['Strength'].default_value = 0.9

engines = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = TURNS * CELL
scene.render.resolution_y = int(TURNS * CELL * tall / width)
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.media_type = 'IMAGE'  # Blender 5: set before file_format
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print(f'Wrote {OUT}: {tris} triangles, {size.x:.3f} x {size.y:.3f} x {size.z:.3f} (glTF units)')
