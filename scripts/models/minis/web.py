"""Web versions of the hi-def miniatures, for the map's 'minis' model detail.

    node scripts/models/run.mjs script scripts/models/minis/web.py [name ...]

For each scripts/models/minis/out/<name>-textured.glb (every one, or the names
given): join, decimate to the family's triangle budget, shrink the base-colour
and normal maps, drop the metallic-roughness and occlusion maps (a matte
miniature), and write public/models/minis/<name>.glb (Draco, JPEG textures).
Then src/features/maps/render/minis.json lists every web mini, which is what
the app loads.

Budgets: a tree or rock can stand hundreds of times on a map; a settlement or
landmark stands once at a pin, so it keeps far more.
"""
import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(HERE, 'out')
WEB = os.path.join(ROOT, 'public', 'models', 'minis')
INDEX = os.path.join(ROOT, 'src', 'features', 'maps', 'render', 'minis.json')

SETTLEMENT = ('village-', 'town-', 'city-', 'castle-')
GROUND = ('shrub-', 'scrub-', 'reeds-', 'fern-', 'boulder-', 'mossrock-', 'crag-', 'hoodoo-', 'searock-', 'icerock-')
TREES = ('fir-', 'elderfir-', 'snowfir-', 'pine-', 'oak-', 'elderoak-', 'jungle-', 'palm-', 'cypress-', 'snag-', 'thorn-')


def budget(name):
    """(triangles, texture px) for a prop."""
    if name.startswith(SETTLEMENT):
        return 150_000, 2048
    if name.startswith(TREES):
        return 24_000, 1024
    if name.startswith(GROUND):
        return 8_000, 512
    return 60_000, 2048  # landmarks and pin markers


def convert(name):
    src = os.path.join(OUT, f'{name}-textured.glb')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise SystemExit(f'No meshes in {src}')
    with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes):
        if len(meshes) > 1:
            bpy.ops.object.join()
    obj = meshes[0]
    # Drop the import's empties so the mesh is the scene's only node.
    for o in list(bpy.context.scene.objects):
        if o is not obj:
            bpy.data.objects.remove(o, do_unlink=True)
    obj.parent = None

    tris_before = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    target, px = budget(name)
    if tris_before > target:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = target / tris_before
        mod.use_collapse_triangulate = True
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)

    for slot in obj.material_slots:
        mat = slot.material
        if not mat or not mat.node_tree:
            continue
        nt = mat.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        # A painted miniature is matte: no metal, no baked occlusion.
        for key in ('Metallic', 'Roughness'):
            for link in list(bsdf.inputs[key].links):
                nt.links.remove(link)
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.9
        for n in list(nt.nodes):
            if n.type == 'TEX_IMAGE' and n.image and not n.outputs['Color'].links and not n.outputs['Alpha'].links:
                nt.nodes.remove(n)
        for n in nt.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                w, h = n.image.size
                if max(w, h) > px:
                    n.image.scale(px, px)

    os.makedirs(WEB, exist_ok=True)
    dest = os.path.join(WEB, f'{name}.glb')
    bpy.ops.export_scene.gltf(
        filepath=dest,
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='JPEG',
        export_image_quality=88,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    mb = os.path.getsize(dest) / 1e6
    print(f'{name}: {tris_before} -> {tris} triangles, {px} px maps, {mb:.1f} MB')
    entry = {'name': name, 'url': f'/models/minis/{name}.glb', 'triangles': tris}

    # The concept art it came from, small, for the models library.
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        art = os.path.join(HERE, 'concept', name + ext)
        if not os.path.exists(art):
            continue
        img = bpy.data.images.load(art)
        w, h = img.size
        k = 768 / max(w, h)
        if k < 1:
            img.scale(round(w * k), round(h * k))
        os.makedirs(os.path.join(WEB, 'concept'), exist_ok=True)
        scene = bpy.context.scene
        scene.render.image_settings.media_type = 'IMAGE'  # Blender 5: set before file_format
        scene.render.image_settings.file_format = 'JPEG'
        scene.render.image_settings.quality = 85
        img.save_render(os.path.join(WEB, 'concept', f'{name}.jpg'), scene=scene)
        entry['concept'] = f'/models/minis/concept/{name}.jpg'
        break
    return entry


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    names = argv or sorted(f[: -len('-textured.glb')] for f in os.listdir(OUT) if f.endswith('-textured.glb'))
    try:
        with open(INDEX, encoding='utf-8') as f:
            known = {e['name']: e for e in json.load(f)}
    except (OSError, ValueError):
        known = {}
    for name in names:
        known[name] = convert(name)
    # The index lists every web mini on disk, not just this run's.
    have = sorted(f[:-4] for f in os.listdir(WEB) if f.endswith('.glb'))
    entries = [known.get(name, {'name': name, 'url': f'/models/minis/{name}.glb'}) for name in have]
    with open(INDEX, 'w', encoding='utf-8') as f:
        json.dump(entries, f, indent=1)
        f.write('\n')
    print(f'Wrote {INDEX} ({len(entries)} minis)')


main()
