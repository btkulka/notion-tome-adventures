"""
Conforms an AI-generated or downloaded mesh to the world-map prop kit and
writes scripts/models/imported/<name>.json, which imported.py builds like any
hand-scripted model (budgets, far version, AO bake, preview sheets).

  npm run models:conform -- raw.glb --name ruin-keep --height 1.1
  npm run models -- --names ruin-keep --sheet out.png        # then look at it

The kit's rules (kit.py) decide everything here: one tile is one unit, the
model stands on the origin facing -Y, and every face is one palette colour,
because the app draws props flat-shaded with no textures.

Steps:
  1. Import (GLB/glTF/OBJ/FBX/PLY/STL), unparent, join into one mesh.
  2. Read each face's colour: the base-colour texture at the face's UV centre,
     else vertex colours, else the material colour.
  3. Drop floaters: loose pieces under --min-piece of the total area.
  4. Turn (--yaw), scale to --height tiles (or --width), stand on the origin.
  5. Optionally voxel-remesh (--remesh) to seal holes, merge near-flat
     neighbours (--planar) so facets read as planes, then decimate to --budget.
  6. Give each new face the area-weighted colour of the surface under it.
  7. Cluster those colours (--colors groups) and snap each group to the
     nearest kit palette colour (--palette limits the keys), then repaint lone
     speckles to match their neighbours.
  8. Write verts, faces and palette keys. New models are drafts.
"""
import argparse
import datetime
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# Progress shows as it happens, even through a pipe or a log file.
sys.stdout.reconfigure(line_buffering=True)

import kit  # noqa: E402

OUT = os.path.join(HERE, 'imported')
# Sources above this are decimated on import, to bound memory and time.
MAX_SOURCE_TRIS = 250_000


def parse():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(prog='conform.py')
    p.add_argument('source', help='mesh file to conform')
    p.add_argument('--name', required=True, help="'<group>-<variant>', e.g. ruin-keep")
    p.add_argument('--height', type=float, default=None, help='height in tiles (default 1.0 unless --width)')
    p.add_argument('--width', type=float, default=None, help='footprint width in tiles instead of height')
    p.add_argument('--yaw', type=float, default=0.0, help='degrees to turn about Z so the front faces -Y')
    p.add_argument('--sink', type=float, default=0.04, help='push the base this far below the ground')
    p.add_argument('--budget', type=int, default=2400, help='triangle cap for the full model (2400 keeps imported shapes close to the source)')
    p.add_argument('--lo', type=int, default=0, help='triangle cap for the far version (default budget / 6)')
    p.add_argument('--remesh', type=float, default=0.0, help='voxel size in tiles to remesh at first (0: off); seals holes and floaters')
    p.add_argument('--planar', type=float, default=5.0, help='merge neighbours flatter than this many degrees, mid-decimation (0: off)')
    p.add_argument('--min-piece', type=float, default=0.01, help='drop loose pieces under this fraction of the total area')
    p.add_argument('--colors', type=int, default=6, help='colour groups before snapping to the palette (0: snap every face on its own)')
    p.add_argument('--palette', default='', help='comma-separated palette keys to snap to (default: the whole kit palette)')
    p.add_argument('--jitter', type=float, default=0.04, help="per-face brightness variation, as kit.Mesh.paint's jitter")
    p.add_argument('--ground', default='grass', help='terrain to stand it on in preview sheets')
    p.add_argument('--final', action='store_true', help='write it as finished rather than a draft')
    return p.parse_args(argv)


# -- colour -----------------------------------------------------------------------

def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, dtype=np.float64), 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def oklab(srgb):
    """sRGB (n, 3) in 0..1 → OKLab (n, 3): distances there match how different colours look."""
    lin = srgb_to_linear(srgb)
    m1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    m2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    return np.cbrt(lin @ m1.T) @ m2.T


def upstream_image(socket):
    """The first image texture feeding a socket, walking back through mix and multiply nodes."""
    seen, stack = set(), [l.from_node for l in socket.links]
    while stack:
        node = stack.pop()
        if node in seen:
            continue
        seen.add(node)
        if node.type == 'TEX_IMAGE' and node.image:
            return node.image
        for inp in node.inputs:
            stack.extend(l.from_node for l in inp.links)
    return None


def material_source(mat):
    """(image or None, flat sRGB colour) for a material's base colour."""
    if mat is None:
        return None, (0.6, 0.6, 0.6)
    tree = getattr(mat, 'node_tree', None)
    if tree:
        for node in tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                base = node.inputs['Base Color']
                img = upstream_image(base)
                lin = tuple(base.default_value)[:3]
                return img, tuple(linear_to_srgb(lin))
    return None, tuple(linear_to_srgb(tuple(mat.diffuse_color)[:3]))


def image_array(img):
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    arr = px.reshape(h, w, 4)[:, :, :3]
    # Byte images hold sRGB-encoded values; float images hold linear ones.
    return linear_to_srgb(arr) if img.is_float else arr.astype(np.float64)


def face_colours(obj):
    """sRGB colour per polygon, from texture, vertex colours or material."""
    me = obj.data
    n = len(me.polygons)
    cols = np.full((n, 3), 0.6)
    start = np.empty(n, dtype=np.int64)
    total = np.empty(n, dtype=np.int64)
    mat_index = np.empty(n, dtype=np.int64)
    me.polygons.foreach_get('loop_start', start)
    me.polygons.foreach_get('loop_total', total)
    me.polygons.foreach_get('material_index', mat_index)

    centre_uv = None
    if me.uv_layers.active:
        uv = np.empty(len(me.loops) * 2, dtype=np.float64)
        me.uv_layers.active.data.foreach_get('uv', uv)
        centre_uv = np.add.reduceat(uv.reshape(-1, 2), start) / total[:, None]

    textured = False
    mats = [s.material for s in obj.material_slots] or [None]
    for mi, mat in enumerate(mats):
        sel = mat_index == mi
        if not sel.any():
            continue
        img, flat = material_source(mat)
        if img is not None and centre_uv is not None:
            arr = image_array(img)
            h, w = arr.shape[:2]
            uvs = centre_uv[sel] % 1.0
            x = np.clip((uvs[:, 0] * w).astype(np.int64), 0, w - 1)
            y = np.clip((uvs[:, 1] * h).astype(np.int64), 0, h - 1)
            cols[sel] = arr[y, x]
            textured = True
        else:
            cols[sel] = flat

    if not textured and len(me.color_attributes):
        attr = me.color_attributes.active_color or me.color_attributes[0]
        data = np.empty(len(attr.data) * 4, dtype=np.float32)
        attr.data.foreach_get('color_srgb', data)
        data = data.reshape(-1, 4)[:, :3].astype(np.float64)
        if attr.domain == 'CORNER':
            cols = np.add.reduceat(data, start) / total[:, None]
        elif attr.domain == 'POINT':
            verts = np.empty(len(me.loops), dtype=np.int64)
            me.loops.foreach_get('vertex_index', verts)
            cols = np.add.reduceat(data[verts], start) / total[:, None]
    return cols


def store_face_colours(obj, cols):
    """Keep source colours on the mesh as a face attribute so they survive separating and joining."""
    me = obj.data
    attr = me.attributes.new('src', 'FLOAT_COLOR', 'FACE')
    rgba = np.concatenate([cols, np.ones((len(cols), 1))], axis=1).astype(np.float32)
    attr.data.foreach_set('color', rgba.ravel())


def read_face_colours(me):
    attr = me.attributes['src']
    data = np.empty(len(attr.data) * 4, dtype=np.float32)
    attr.data.foreach_get('color', data)
    return data.reshape(-1, 4)[:, :3].astype(np.float64)


# -- mesh -------------------------------------------------------------------------

def select_only(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def import_mesh(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.obj':
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.ply':
        bpy.ops.wm.ply_import(filepath=path)
    elif ext == '.stl':
        bpy.ops.wm.stl_import(filepath=path)
    else:
        raise SystemExit(f'Unsupported mesh type {ext}')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise SystemExit('No meshes in ' + path)
    select_only(meshes)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    for o in meshes:
        store_face_colours(o, face_colours(o))
    select_only(meshes)
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in [o for o in bpy.context.scene.objects if o is not obj]:
        bpy.data.objects.remove(o)
    return obj


def poly_areas(me):
    a = np.empty(len(me.polygons), dtype=np.float64)
    me.polygons.foreach_get('area', a)
    return a


def weld(obj):
    """Merge coincident vertices. glTF splits vertices along every UV seam and
    flat-normal edge, so an imported mesh is often thousands of disconnected
    triangles until welded. Face colours and UVs live on faces and loops, so they survive."""
    me = obj.data
    size = float(np.ptp(vertex_array(me), axis=0).max()) or 1.0
    bm = bmesh.new()
    bm.from_mesh(me)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=size * 1e-5)
    bm.to_mesh(me)
    bm.free()
    me.update()
    print(f'  welded {before} → {len(me.vertices)} vertices')


def drop_floaters(obj, min_piece):
    """Delete loose pieces under min_piece of the total area. Islands are found
    in memory: splitting into objects would make one per piece, which is
    unbounded on an unwelded mesh."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    island = [-1] * len(bm.faces)
    areas = []
    for seed in bm.faces:
        if island[seed.index] >= 0:
            continue
        n = len(areas)
        island[seed.index] = n
        stack, area = [seed], 0.0
        while stack:
            f = stack.pop()
            area += f.calc_area()
            for v in f.verts:
                for g in v.link_faces:
                    if island[g.index] < 0:
                        island[g.index] = n
                        stack.append(g)
        areas.append(area)
    total = sum(areas) or 1.0
    biggest = max(range(len(areas)), key=areas.__getitem__)
    keep = {i for i, a in enumerate(areas) if a >= min_piece * total} | {biggest}
    doomed = [f for f in bm.faces if island[f.index] not in keep]
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()
    print(f'  kept {len(keep)} of {len(areas)} pieces')
    return obj


def vertex_array(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    return co.reshape(-1, 3)


def normalise(obj, args):
    """Turn, scale and stand the mesh on the origin, front to -Y."""
    me = obj.data
    co = vertex_array(me)
    yaw = math.radians(args.yaw)
    c, s = math.cos(yaw), math.sin(yaw)
    co = co @ np.array([[c, s, 0], [-s, c, 0], [0, 0, 1]])
    lo, hi = co.min(axis=0), co.max(axis=0)
    size = hi - lo
    if args.width:
        k = args.width / max(size[0], size[1], 1e-9)
    else:
        k = (args.height or 1.0) / max(size[2], 1e-9)
    centre = np.array([(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]])
    co = (co - centre) * k - np.array([0, 0, args.sink])
    me.vertices.foreach_set('co', co.ravel())
    me.update()
    print(f'  scaled x{k:.3f} to {size[0] * k:.2f} x {size[1] * k:.2f} x {size[2] * k:.2f} tiles')


def tri_count(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def apply_modifier(obj, mod):
    select_only([obj])
    bpy.ops.object.modifier_apply(modifier=mod.name)


def collapse_to(obj, budget):
    for _ in range(6):
        tris = tri_count(obj.data)
        if tris <= budget:
            break
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.use_collapse_triangulate = True
        mod.ratio = max(0.001, budget / tris * 0.97)
        apply_modifier(obj, mod)


def simplify(obj, args):
    """Optional remesh, coarse collapse, merge flat neighbours, collapse to the budget.

    Merging near-coplanar faces is what leaves large readable facets; collapsing
    straight to the budget gives even triangle soup (the LPM skill's chain).
    But on a dense smooth surface every neighbour is within a few degrees, so
    dissolving first would fuse whole curved walls into giant non-planar
    polygons that take minutes to triangulate. So: collapse to 4x the budget,
    where curvature shows as real angles between faces, then dissolve, then
    collapse the rest of the way.
    """
    if args.remesh > 0:
        mod = obj.modifiers.new('remesh', 'REMESH')
        mod.mode = 'VOXEL'
        mod.voxel_size = args.remesh
        apply_modifier(obj, mod)
        print(f'  remeshed at {args.remesh}: {tri_count(obj.data)} triangles')
    if args.planar > 0:
        collapse_to(obj, args.budget * 4)
        mod = obj.modifiers.new('planar', 'DECIMATE')
        mod.decimate_type = 'DISSOLVE'
        mod.angle_limit = math.radians(args.planar)
        apply_modifier(obj, mod)
        print(f'  planar dissolve at {args.planar}°: {tri_count(obj.data)} triangles')
    collapse_to(obj, args.budget)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    # Ear clipping is linear in polygon size; BEAUTY on a big n-gon is not.
    bmesh.ops.triangulate(bm, faces=bm.faces, quad_method='BEAUTY', ngon_method='EAR_CLIP')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    degenerate = [f for f in bm.faces if f.calc_area() < 1e-9]
    if degenerate:
        bmesh.ops.delete(bm, geom=degenerate, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    print(f'  simplified to {tri_count(obj.data)} triangles')


def transfer_colours(low, high):
    """Each low face takes the area-weighted colour of the high surface nearest its centre and corners."""
    hb = bmesh.new()
    hb.from_mesh(high.data)
    hb.faces.ensure_lookup_table()
    tree = BVHTree.FromBMesh(hb)
    src = srgb_to_linear(read_face_colours(high.data))
    hb.free()
    out = []
    for poly in low.data.polygons:
        centre = Vector(poly.center)
        pts = [centre] + [centre.lerp(low.data.vertices[v].co, 0.6) for v in poly.vertices]
        acc, wsum = np.zeros(3), 0.0
        for i, pt in enumerate(pts):
            loc, _normal, index, _dist = tree.find_nearest(pt)
            if index is None:
                continue
            w = 2.0 if i == 0 else 1.0
            acc += src[index] * w
            wsum += w
        out.append(linear_to_srgb(acc / wsum) if wsum else np.array([0.6, 0.6, 0.6]))
    return np.array(out)


def kmeans(points, weights, k, seed=1, iters=30):
    """Weighted k-means with deterministic k-means++ seeding."""
    rng = np.random.default_rng(seed)
    k = max(1, min(k, len(points)))
    centres = [points[rng.choice(len(points), p=weights / weights.sum())]]
    for _ in range(1, k):
        d = np.min([((points - c) ** 2).sum(axis=1) for c in centres], axis=0) * weights
        centres.append(points[rng.choice(len(points), p=d / d.sum())] if d.sum() > 0 else points[0])
    centres = np.array(centres)
    for _ in range(iters):
        labels = np.argmin(((points[:, None, :] - centres[None]) ** 2).sum(axis=2), axis=1)
        for j in range(k):
            m = labels == j
            if m.any():
                centres[j] = np.average(points[m], axis=0, weights=weights[m])
    return labels, centres


def snap_to_palette(colours, areas, normals_z, args):
    keys = [k for k in (args.palette.split(',') if args.palette else kit.PALETTE) if k]
    unknown = [k for k in keys if k not in kit.PALETTE]
    if unknown:
        raise SystemExit(f'Not palette keys: {", ".join(unknown)}')
    pal = oklab(np.array([kit.rgb(k) for k in keys]))
    lab = oklab(colours)
    if args.colors > 0:
        labels, centres = kmeans(lab, np.maximum(areas, 1e-9), args.colors)
        cluster_key = np.argmin(((centres[:, None, :] - pal[None]) ** 2).sum(axis=2), axis=1)
        picked = cluster_key[labels]
    else:
        picked = np.argmin(((lab[:, None, :] - pal[None]) ** 2).sum(axis=2), axis=1)
    # Undersides take a colour's darker twin when the palette has one: the
    # cheap recess shading kit.py models use (LPM: "pair each hue with a dark shade").
    out = []
    for i, k in zip(picked, normals_z):
        key = keys[i]
        dark = key + '_dark'
        out.append(dark if k < -0.3 and dark in kit.PALETTE and (not args.palette or dark in keys) else key)
    return out


def despeckle(me, keys, passes=2):
    """A face whose colour none of its neighbours share, but two of them agree on, takes theirs."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    neighbours = [[o.index for e in f.edges for o in e.link_faces if o is not f] for f in bm.faces]
    bm.free()
    keys = list(keys)
    for _ in range(passes):
        nxt = list(keys)
        for i, around in enumerate(neighbours):
            theirs = [keys[j] for j in around]
            if not theirs or keys[i] in theirs:
                continue
            best = max(set(theirs), key=theirs.count)
            if theirs.count(best) >= 2:
                nxt[i] = best
        keys = nxt
    return keys


def main():
    args = parse()
    assert args.name.replace('-', '').isalnum() and args.name == args.name.lower() and '_' not in args.name, 'name must be <group>-<variant>'
    bpy.ops.wm.read_factory_settings(use_empty=True)
    print(f'Conforming {args.source} → {args.name}')
    obj = import_mesh(os.path.abspath(args.source))
    print(f'  imported {tri_count(obj.data)} triangles')
    weld(obj)
    # Image-to-3D output can run to millions of triangles. Thin it before
    # separating, copying and building BVH trees, which would each hold the
    # whole thing in memory; at prop scale nothing visible is lost.
    if tri_count(obj.data) > MAX_SOURCE_TRIS:
        mod = obj.modifiers.new('thin', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = MAX_SOURCE_TRIS / tri_count(obj.data)
        apply_modifier(obj, mod)
        print(f'  thinned to {tri_count(obj.data)} triangles first')
    obj = drop_floaters(obj, args.min_piece)
    normalise(obj, args)

    high = obj
    low = obj.copy()
    low.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(low)
    simplify(low, args)

    colours = transfer_colours(low, high)
    nz = np.array([p.normal.z for p in low.data.polygons])
    keys = despeckle(low.data, snap_to_palette(colours, poly_areas(low.data), nz, args))

    me = low.data
    co = np.round(vertex_array(me), 4)
    faces = [list(p.vertices) for p in me.polygons]
    lo_c, hi_c = co.min(axis=0), co.max(axis=0)
    data = {
        'name': args.name,
        'budget': args.budget,
        'lo': args.lo or max(40, args.budget // 6),
        'ground': args.ground,
        'size': round(float(max(hi_c[0] - lo_c[0], hi_c[1] - lo_c[1])), 2),
        'draft': not args.final,
        'jitter': args.jitter,
        'source': os.path.basename(args.source),
        'conformed': datetime.date.today().isoformat(),
        'settings': {k: v for k, v in vars(args).items() if k not in ('source', 'name', 'final')},
        'verts': co.tolist(),
        'faces': faces,
        'colors': keys,
    }
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, args.name + '.json')
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, separators=(',', ':'))
    used = sorted(set(keys), key=keys.count, reverse=True)
    print(f'Wrote {path}: {len(faces)} faces, {len(co)} verts, colours {", ".join(used)}')
    print(f'Look at it: npm run models -- --names {args.name} --sheet {args.name}.png')


main()
