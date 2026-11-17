"""
Modelling kit for the world-map props: a coloured-bmesh builder, the shared
palette and the model registry. Model modules (trees.py, ground.py, ...) use
this; build.py runs them, exports the GLB and renders preview sheets.

Conventions, matching src/features/maps/render:
- 1 Blender unit is one map tile edge; one elevation step is 0.3 high.
- A model stands on its origin: z = 0 is the ground. Push bases a little below
  zero (about -0.05) so props sit flush on sloped tiles.
- The front faces -Y, which becomes three.js +Z after the glTF Y-up export.
- Colour lives in the face-corner attribute 'Col' (sRGB). The app draws every
  prop flat-shaded with one Lambert material: no textures, no normals, no
  emission. Form has to come from facets, silhouette and colour.
"""
import math
import random
import zlib

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

# Set by build.py: True when ambient occlusion will be baked after building.
BAKED_AO = False

# Set by build.py (--detail): how many times the sides of round shapes are
# multiplied in full-detail builds. Far versions always build at 1.
DETAIL = 1.0


# Detail tiers double their triangles at every step: Low is DETAIL 3, Medium 6,
# High 12, Ultra 24. Round shapes scale sides with DETAIL directly; spheres and
# hull rocks scale their facets with DETAIL / 3 on top of Low's doubling.

def dsubdiv(subdiv, exact=False):
    """Icosphere subdivisions at the current DETAIL: one level finer (4x facets) from 2 up.
    Kept for callers that need a power-of-two sphere; sphere() scales smoothly."""
    return subdiv + 1 if DETAIL >= 2 and not exact else subdiv


def dpoints(n, exact=False):
    """Points for a hull-built rock: twice as many at Low, doubling again each tier."""
    if DETAIL < 2 or exact:
        return n
    return int(round(n * 2 * DETAIL / 3))


def sphere_frequency(subdiv, exact=False):
    """Geodesic frequency (20·f² faces) for an icosphere of `subdiv` at the current DETAIL.

    subdiv 1 is f 1 (20 faces), 2 is f 2 (80). Low doubles f (4x faces);
    each tier above multiplies faces by about 2 (f by √2).
    """
    f = 2 ** (subdiv - 1)
    if DETAIL < 2 or exact:
        return f
    return max(1, int(round(f * 2 * math.sqrt(DETAIL / 3))))


_ICOSAHEDRON = None


def _icosahedron():
    global _ICOSAHEDRON
    if _ICOSAHEDRON is None:
        t = (1 + 5 ** 0.5) / 2
        verts = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
                 (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
        faces = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
                 (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
                 (8, 6, 7), (9, 8, 1)]
        _ICOSAHEDRON = ([Vector(v).normalized() for v in verts], faces)
    return _ICOSAHEDRON


def sphere(bm, subdiv, radius, exact=False):
    """A sphere of `radius` at the origin of bm for an icosphere of `subdiv`, scaled to
    the current DETAIL; returns its new vertices. Powers of two are Blender's own
    icosphere (so Low is unchanged); other frequencies are a geodesic grid on
    each icosahedron face, f² triangles per face."""
    f = sphere_frequency(subdiv, exact)
    if f & (f - 1) == 0:
        return bmesh.ops.create_icosphere(bm, subdivisions=int(math.log2(f)) + 1, radius=radius, matrix=Matrix.Identity(4))['verts']
    base, faces = _icosahedron()
    shared = {}

    def vert(p):
        p = p.normalized()
        key = (round(p.x, 6), round(p.y, 6), round(p.z, 6))
        v = shared.get(key)
        if v is None:
            v = shared[key] = bm.verts.new(p * radius)
        return v

    new = []
    for a, b, c in faces:
        A, B, C = base[a], base[b], base[c]
        grid = {(i, j): vert(A + (B - A) * (i / f) + (C - A) * (j / f)) for i in range(f + 1) for j in range(f + 1 - i)}
        for i in range(f):
            for j in range(f - i):
                new.append(bm.faces.new((grid[i, j], grid[i + 1, j], grid[i, j + 1])))
                if i + j < f - 1:
                    new.append(bm.faces.new((grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1])))
    bmesh.ops.recalc_face_normals(bm, faces=new)
    return list(shared.values())


def dseg(seg, exact=False):
    """Sides for a round shape at the current DETAIL.

    Only round approximations (6+ sides) scale. 3-5 sides are designed shapes
    (square towers, pyramid roofs, rough rocks) and `exact` keeps any count
    as drawn (hexagonal basalt). Everything that lays out geometry around a
    ring must go through this, so parapets stay on their towers.
    """
    if exact or seg < 6 or DETAIL == 1:
        return seg
    return max(seg, int(round(seg * DETAIL)))

# Tarnished, muted high-fantasy palette. Keys are shared across every module so
# the whole map reads as one world; add keys rather than inventing hex inline.
PALETTE = {
    # wood
    'bark': '#3A2A1C',
    'bark_dark': '#271B12',
    'bark_grey': '#5C544B',
    'bark_pale': '#8C8170',
    'timber': '#4A3423',
    'timber_dark': '#33241A',
    # foliage
    'fir': '#1F3529',
    'fir_mid': '#28432F',
    'fir_light': '#35553A',
    'oak': '#2F5430',
    'oak_mid': '#3D6634',
    'oak_light': '#56793F',
    'jungle': '#255A2E',
    'jungle_light': '#3C7A35',
    'palm': '#3F6B32',
    'swamp_leaf': '#46522F',
    'moss': '#5B6936',
    'moss_dark': '#3E4A28',
    'dry_leaf': '#7B7442',
    'dry_grass': '#9C8C55',
    'reed': '#6E7440',
    # stone and earth
    'granite': '#7A746B',
    'granite_light': '#958E83',
    'granite_dark': '#58534C',
    'slate': '#4A4852',
    'basalt': '#36343A',
    'sandstone': '#B48A5C',
    'sandstone_light': '#CDA678',
    'sandstone_dark': '#8A6440',
    'marble': '#CFC8B8',
    'marble_dark': '#A39B8A',
    'earth': '#4E3B2A',
    'ice': '#C9D6DE',
    'snow': '#E8EEF2',
    # building
    'plaster': '#CDBF9F',
    'plaster_dark': '#A8987A',
    'stone_wall': '#B3A68A',
    'stone_wall_dark': '#857A63',
    'roof_slate': '#3E3B45',
    'roof_slate_light': '#545060',
    'roof_thatch': '#8A7347',
    'roof_turf': '#4D5C33',
    'roof_tile': '#7A3E2E',
    'adobe': '#C39A6B',
    'adobe_light': '#D8B587',
    # heraldry, metal, bone
    'gilt': '#C4A35A',
    'gilt_hi': '#DEC27F',
    'oxblood': '#7E2B27',
    'oxblood_dark': '#5A1E1B',
    'iron': '#3A3A3E',
    'bone': '#D9D0BC',
    'bone_dark': '#A99F8A',
    'canvas': '#B8A988',
    'ember': '#D9822F',
    'water_dark': '#1E3A4A',
}


# -- materials ------------------------------------------------------------------
# What each face is made of, recorded as it's painted (face attribute 'mat',
# exported to the GLB as '_mat'). The app's prop shader overlays a surface
# pattern per material (scripts/textures/generate-prop-patterns.ts writes them
# in this order) and the detail pass reads it. Keep the list's order in step
# with PROP_MATERIALS in src/features/maps/render/models.ts.
MATERIALS = ['none', 'masonry', 'rock', 'plaster', 'wood', 'bark', 'slate', 'thatch', 'tile', 'foliage', 'cloth', 'window', 'arcane']

_MATERIAL_BY_PREFIX = [
    ('bark', 'bark'), ('timber', 'wood'),
    ('fir', 'foliage'), ('oak', 'foliage'), ('jungle', 'foliage'), ('palm', 'foliage'), ('swamp_leaf', 'foliage'),
    ('moss', 'foliage'), ('dry_leaf', 'foliage'), ('dry_grass', 'foliage'), ('reed', 'foliage'), ('roof_turf', 'foliage'),
    ('roof_slate', 'slate'), ('roof_thatch', 'thatch'), ('roof_tile', 'tile'),
    ('granite', 'rock'), ('basalt', 'rock'), ('slate', 'rock'), ('earth', 'rock'),
    ('sandstone', 'masonry'), ('stone_wall', 'masonry'), ('marble', 'masonry'),
    ('plaster', 'plaster'), ('adobe', 'plaster'),
    ('canvas', 'cloth'), ('oxblood', 'cloth'),
]

# Set by build.py to the module of the model being built: stone means rock in
# nature (trees, ground) and masonry in settlements.
CONTEXT = ''


class Colour(tuple):
    """An (r, g, b) that remembers the palette key it came from, so paint() knows the material."""
    key = None


def _keyed(values, key):
    c = Colour(values)
    c.key = key
    return c


def key_of(color):
    if isinstance(color, str):
        return color if color in PALETTE else None
    return getattr(color, 'key', None)


def material_of(key):
    """The material for a palette key in the current CONTEXT ('none' if unknown)."""
    kind = 'none'
    if key:
        for prefix, k in _MATERIAL_BY_PREFIX:
            if key.startswith(prefix):
                kind = k
                break
    if CONTEXT in ('ground', 'trees') and kind == 'masonry':
        return 'rock'
    if CONTEXT == 'settlements' and kind == 'rock':
        return 'masonry'
    return kind


def rgb(color):
    """A palette key, '#RRGGBB' or an (r, g, b) tuple of 0..1 floats."""
    if isinstance(color, Colour):
        return color
    if isinstance(color, str):
        h = PALETTE.get(color, color).lstrip('#')
        return _keyed((int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)), color if color in PALETTE else None)
    return tuple(color[:3])


def mix(a, b, t):
    """A blend of two colours; it keeps the material of whichever it's closer to."""
    key = (key_of(a) if t < 0.5 else key_of(b)) or key_of(a) or key_of(b)
    a, b = rgb(a), rgb(b)
    return _keyed((a[i] + (b[i] - a[i]) * t for i in range(3)), key)


def shade(color, k):
    c = rgb(color)
    return _keyed((min(1.0, max(0.0, v * k)) for v in c), key_of(color))


def xform(at=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    s = scale if hasattr(scale, '__len__') else (scale, scale, scale)
    return Matrix.Translation(Vector(at)) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((*s, 1.0))


class Mesh:
    """A bmesh whose faces each carry a colour, plus primitives that add to it.

    Every primitive returns the list of faces it created, so callers can paint,
    displace or jitter just that part.
    """

    def __init__(self, rng=None):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new('Col')
        self.mat = self.bm.faces.layers.int.new('mat')
        self.rng = rng or random.Random(0)

    # -- colour ---------------------------------------------------------------

    def paint(self, faces, color, jitter=0.0, material=None):
        """Flat colour per face; `jitter` varies each face's brightness by up to ±jitter.

        The face's material comes from the colour's palette key (see MATERIALS)
        unless `material` names one.
        """
        base = rgb(color)
        mat = MATERIALS.index(material or material_of(key_of(color)))
        for f in faces:
            k = 1.0 + (self.rng.uniform(-jitter, jitter) if jitter else 0.0)
            c = (min(1.0, base[0] * k), min(1.0, base[1] * k), min(1.0, base[2] * k), 1.0)
            for loop in f.loops:
                loop[self.col] = c
            f[self.mat] = mat
        return faces

    def paint_by_height(self, faces, low, high, z0, z1, jitter=0.0):
        """Blend each face from `low` at z0 to `high` at z1 by its centre height."""
        for f in faces:
            t = 0.0 if z1 == z0 else min(1.0, max(0.0, (f.calc_center_median().z - z0) / (z1 - z0)))
            self.paint([f], mix(low, high, t), jitter)
        return faces

    def paint_where(self, faces, test, color, jitter=0.0):
        """Repaint the faces for which test(face) is true (e.g. upward-facing → snow)."""
        return self.paint([f for f in faces if test(f)], color, jitter)

    def ground_ao(self, height=0.12, strength=0.4):
        """Darken corners near the ground so props sit in the terrain instead of on it.

        A stand-in for real occlusion: when build.py bakes AO (the default) this
        does nothing, since the bake's ground plane darkens bases properly.
        """
        if BAKED_AO:
            return
        for f in self.bm.faces:
            for loop in f.loops:
                z = loop.vert.co.z
                if z < height:
                    k = 1.0 - strength * (1.0 - max(0.0, z) / height)
                    c = loop[self.col]
                    loop[self.col] = (c[0] * k, c[1] * k, c[2] * k, 1.0)

    # -- primitives -----------------------------------------------------------

    def loft(self, rings, seg=6, at=(0, 0, 0), rot=(0, 0, 0), scale=1.0, color='bark', jitter=0.0,
             cap_bottom=True, cap_top=True, phase=0.0, twist=0.0, wobble=0.0, profile=None, exact=False):
        """Rings joined into a tube: the workhorse for trunks, tiers, towers and spires.

        rings: [(z, radius) or (z, radius, dx, dy)], bottom to top. A radius of 0
        makes a single point (a cone tip). `profile(i)` scales the radius of the
        i-th vertex of every ring, e.g. alternating 1.0 / 0.7 for a star-shaped
        tier of branch tips. `wobble` randomises each vertex's radius by ±wobble,
        `twist` turns each ring by that many radians more than the one below.
        Round lofts gain sides with DETAIL (see dseg); `exact` keeps `seg` as drawn.
        """
        seg = dseg(seg, exact)
        m = xform(at, rot, scale)
        bm = self.bm
        rows = []
        for k, ring in enumerate(rings):
            z, r = ring[0], ring[1]
            dx, dy = (ring[2], ring[3]) if len(ring) > 3 else (0.0, 0.0)
            if r <= 0:
                rows.append([bm.verts.new(m @ Vector((dx, dy, z)))])
                continue
            row = []
            for i in range(seg):
                a = phase + twist * k + i * math.tau / seg
                rr = r * (profile(i) if profile else 1.0) * (1.0 + (self.rng.uniform(-wobble, wobble) if wobble else 0.0))
                row.append(bm.verts.new(m @ Vector((dx + math.cos(a) * rr, dy + math.sin(a) * rr, z))))
            rows.append(row)
        faces = []
        for lo, hi in zip(rows, rows[1:]):
            if len(lo) == 1 and len(hi) == 1:
                continue
            for i in range(seg):
                j = (i + 1) % seg
                if len(hi) == 1:
                    faces.append(bm.faces.new((lo[i], lo[j], hi[0])))
                elif len(lo) == 1:
                    faces.append(bm.faces.new((lo[0], hi[j], hi[i])))
                else:
                    faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
        if cap_bottom and len(rows[0]) > 1:
            faces.append(bm.faces.new(list(reversed(rows[0]))))
        if cap_top and len(rows[-1]) > 1:
            faces.append(bm.faces.new(rows[-1]))
        return self.paint(faces, color, jitter)

    def cylinder(self, r1, r2, h, seg=6, **kw):
        """A frustum standing on its base. r2 = 0 makes a cone."""
        return self.loft([(0.0, r1), (h, r2)], seg=seg, **kw)

    def box(self, size, at=(0, 0, 0), rot=(0, 0, 0), color='stone_wall', jitter=0.0, bevel=0.0, taper=0.0):
        """A box standing on its base centre. `bevel` chamfers every edge; `taper` shrinks the top."""
        sx, sy, sz = size
        bm = self.bm
        existing = set(bm.faces)
        m = xform(at, rot)
        t = 1.0 - taper
        corners = [(-1, -1, 0), (1, -1, 0), (1, 1, 0), (-1, 1, 0), (-t, -t, 1), (t, -t, 1), (t, t, 1), (-t, t, 1)]
        v = [bm.verts.new(m @ Vector((x * sx / 2, y * sy / 2, z * sz))) for x, y, z in corners]
        quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        faces = [bm.faces.new([v[i] for i in q]) for q in quads]
        if bevel > 0:
            edges = list({e for f in faces for e in f.edges})
            bmesh.ops.bevel(bm, geom=edges + v, offset=bevel, segments=1, affect='EDGES', profile=0.5)
            # Bevel rebuilds and adds faces (corner patches too), so take every face the box now owns.
            faces = [f for f in bm.faces if f not in existing]
        return self.paint(faces, color, jitter)

    def prism(self, outline, depth, at=(0, 0, 0), rot=(0, 0, 0), scale=1.0, color='stone_wall', jitter=0.0):
        """A 2D outline [(x, z), ...] in the XZ plane, extruded `depth` along Y (centred).

        Gables, arches, flags, steles and wall profiles. Give the outline
        counter-clockwise as seen from the front (-Y).
        """
        m = xform(at, rot, scale)
        bm = self.bm
        front = [bm.verts.new(m @ Vector((x, -depth / 2, z))) for x, z in outline]
        back = [bm.verts.new(m @ Vector((x, depth / 2, z))) for x, z in outline]
        faces = [bm.faces.new(front), bm.faces.new(list(reversed(back)))]
        n = len(outline)
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new((front[j], front[i], back[i], back[j])))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        return self.paint(faces, color, jitter)

    def blob(self, radius, at=(0, 0, 0), scale=1.0, rot=(0, 0, 0), subdiv=1, color='granite', jitter=0.0,  # noqa: PLR0913
             noise_amount=0.0, noise_scale=2.0, flat_bottom=None, exact=False):
        """An icosphere, optionally lumped by noise: rocks, foliage clumps, moss.

        subdiv 1 is the 20-triangle icosahedron, 2 is 80. `flat_bottom` clamps
        vertices below that local z, so rocks sit on the ground instead of
        balancing on a point. At DETAIL 2 and above, full-detail builds go one
        level finer (four times the facets, the noise sampled finer), unless
        `exact`.
        """
        if DETAIL >= 2 and not exact:
            subdiv += 1
        bm = self.bm
        verts = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius, matrix=Matrix.Identity(4))['verts']
        offset = Vector((self.rng.uniform(0, 100), self.rng.uniform(0, 100), self.rng.uniform(0, 100)))
        for v in verts:
            if noise_amount:
                n = noise.noise(v.co * noise_scale / max(radius, 1e-6) * 0.5 + offset)
                v.co *= 1.0 + n * noise_amount
            if flat_bottom is not None and v.co.z < flat_bottom:
                v.co.z = flat_bottom
        bmesh.ops.transform(bm, matrix=xform(at, rot, scale), verts=verts)
        faces = list({f for v in verts for f in v.link_faces})
        return self.paint(faces, color, jitter)

    # -- editing --------------------------------------------------------------

    def verts_of(self, faces):
        return list({v for f in faces for v in f.verts})

    def jitter(self, faces, amount):
        """Nudge every vertex of `faces` randomly by up to `amount` on each axis (welded corners move together)."""
        for v in self.verts_of(faces):
            v.co += Vector((self.rng.uniform(-amount, amount), self.rng.uniform(-amount, amount), self.rng.uniform(-amount, amount)))
        return faces

    def transform(self, faces, at=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
        bmesh.ops.transform(self.bm, matrix=xform(at, rot, scale), verts=self.verts_of(faces))
        return faces

    def bend(self, faces, amount, axis=(1, 0), z0=0.0):
        """Lean geometry sideways quadratically with height: wind-bent pines, drooping spires."""
        ax, ay = axis
        for v in self.verts_of(faces):
            h = max(0.0, v.co.z - z0)
            v.co.x += ax * amount * h * h
            v.co.y += ay * amount * h * h
        return faces

    def insert(self, other, at=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
        """Copy another Mesh into this one with a transform: kit-bash houses into towns."""
        tmp = bpy.data.meshes.new('_insert')
        other.bm.to_mesh(tmp)
        start = len(self.bm.verts)
        self.bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
        # from_mesh appends, so the copy is everything past the old count.
        self.bm.verts.ensure_lookup_table()
        verts = [self.bm.verts[i] for i in range(start, len(self.bm.verts))]
        bmesh.ops.transform(self.bm, matrix=xform(at, rot, scale), verts=verts)
        return list({f for v in verts for f in v.link_faces})

    def delete(self, faces):
        bmesh.ops.delete(self.bm, geom=faces, context='FACES')

    def tris(self):
        return sum(len(f.verts) - 2 for f in self.bm.faces)

    def bounds(self):
        xs = [v.co for v in self.bm.verts]
        lo = Vector((min(c.x for c in xs), min(c.y for c in xs), min(c.z for c in xs)))
        hi = Vector((max(c.x for c in xs), max(c.y for c in xs), max(c.z for c in xs)))
        return lo, hi

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        attr = me.color_attributes.get('Col')
        if attr is not None:
            me.color_attributes.active_color = attr
            me.color_attributes.render_color_index = me.color_attributes.find('Col')
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        return obj


# -- registry -----------------------------------------------------------------

REGISTRY = {}

BIOME_GROUNDS = ('grass', 'forest', 'taiga', 'swamp', 'desert', 'beach', 'hills', 'rock', 'snow', 'cobble', 'road')


def model(name, *, budget, lo, ground='grass', size=0.5, draft=False):
    """Register a builder: fn(rng, lo) -> Mesh.

    name     '<group>-<variant>', lowercase letters, digits and hyphens only
             (the app picks variants by group; '_lo' is reserved).
    budget   triangle cap for the full model.
    lo       triangle cap for the far-zoom model. A builder may ignore `lo` and
             let the build decimate it; building a deliberately simpler shape
             when lo=True usually looks better. Draw shape parameters from rng
             before branching on lo so both versions share a silhouette.
    ground   terrain texture to stand the model on in preview sheets.
    size     rough footprint width, for preview layout.
    draft    built only when named (--names), never into the app's GLB:
             imported models under review (see imported.py).
    """
    def wrap(fn):
        assert name.replace('-', '').isalnum() and name == name.lower() and '_' not in name, name
        assert name not in REGISTRY, f'model {name} registered twice'
        REGISTRY[name] = {'fn': fn, 'budget': budget, 'lo': lo, 'ground': ground, 'size': size, 'module': fn.__module__, 'draft': draft}
        return fn
    return wrap


def seeded(name, salt=''):
    return random.Random(zlib.crc32((name + salt).encode()))
