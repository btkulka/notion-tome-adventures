"""
Landmarks and pin markers: stone circles, ruins of the old empire, the dwarven
gate, the elven spires, dragon bones, waystones and shrines; the dungeon, cave,
wizard's tower, camp and temple markers; and the party's banner.

These are few on the map and seen up close, so they carry more detail than the
scatter. Each has a deliberate low-detail build for far zoom; shape choices are
drawn from rng before branching on `lo` so both share a silhouette.
"""
import math

import bmesh
from mathutils import Matrix, Vector, noise

from kit import Mesh, mix, model, shade, xform

TAU = math.tau
SQ = math.sqrt(0.5)  # loft radius whose 4-sided ring (phase TAU/8) is a unit square
OCT = 0.5 / math.cos(math.pi / 8)  # loft radius whose 8-sided ring (phase pi/8) is 1 across the flats
ICO20, ICO80 = 1, 2  # create_icosphere subdivisions for a 20- and an 80-triangle sphere


# -- helpers --------------------------------------------------------------------

def blob(m, radius, at=(0, 0, 0), scale=1.0, rot=(0, 0, 0), subdiv=ICO20, color='granite', jitter=0.0,
         noise_amount=0.0, noise_scale=2.0, flat_bottom=None):
    """kit.Mesh.blob, transforming only the new sphere's vertices.

    kit's version finds them by diffing set(bm.verts), which also catches
    earlier geometry, so each blob dragged everything built before it along.
    """
    verts = bmesh.ops.create_icosphere(m.bm, subdivisions=subdiv, radius=radius, matrix=Matrix.Identity(4))['verts']
    offset = Vector((m.rng.uniform(0, 100), m.rng.uniform(0, 100), m.rng.uniform(0, 100)))
    for v in verts:
        if noise_amount:
            v.co *= 1.0 + noise.noise(v.co * noise_scale / radius * 0.5 + offset) * noise_amount
        if flat_bottom is not None and v.co.z < flat_bottom:
            v.co.z = flat_bottom
    bmesh.ops.transform(m.bm, matrix=xform(at, rot, scale), verts=verts)
    return m.paint(list({f for v in verts for f in v.link_faces}), color, jitter)


def box(m, size, at=(0, 0, 0), rot=(0, 0, 0), color='stone_wall', jitter=0.0, bevel=0.0, taper=0.0):
    """kit.Mesh.box, with the chamfer built directly when `bevel` is set.

    kit's bevel leaves some rebuilt faces unpainted (they render white), so a
    bevelled box here is made from its own 26 faces: six inset sides, twelve
    edge chamfers and eight corner triangles.
    """
    if not bevel:
        return m.box(size, at=at, rot=rot, color=color, jitter=jitter, taper=taper)
    hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
    b = min(bevel, hx * 0.45, hy * 0.45, hz * 0.45)
    mat = xform(at, rot)
    bm = m.bm
    verts = {}

    def vert(cx, cy, cz, axis):
        key = (cx, cy, cz, axis)
        if key not in verts:
            x = cx * (hx - (0 if axis == 0 else b))
            y = cy * (hy - (0 if axis == 1 else b))
            z = cz * (hz - (0 if axis == 2 else b))
            k = 1.0 - taper * (z + hz) / (2 * hz)
            verts[key] = bm.verts.new(mat @ Vector((x * k, y * k, z + hz)))
        return verts[key]

    ring = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    quads = []
    for s in (-1, 1):
        quads.append([vert(s, u, w, 0) for u, w in ring])
        quads.append([vert(u, s, w, 1) for u, w in ring])
        quads.append([vert(u, w, s, 2) for u, w in ring])
    for u in (-1, 1):
        for w in (-1, 1):
            quads.append([vert(-1, u, w, 1), vert(1, u, w, 1), vert(1, u, w, 2), vert(-1, u, w, 2)])
            quads.append([vert(u, -1, w, 0), vert(u, 1, w, 0), vert(u, 1, w, 2), vert(u, -1, w, 2)])
            quads.append([vert(u, w, -1, 0), vert(u, w, 1, 0), vert(u, w, 1, 1), vert(u, w, -1, 1)])
    faces = [bm.faces.new(q) for q in quads]
    faces += [bm.faces.new((vert(cx, cy, cz, 0), vert(cx, cy, cz, 1), vert(cx, cy, cz, 2)))
              for cx in (-1, 1) for cy in (-1, 1) for cz in (-1, 1)]
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    return m.paint(faces, color, jitter)


def finish(m, ao=0.1, strength=0.35):
    """Face every island outward (the app culls back faces), then darken the ground line."""
    bmesh.ops.recalc_face_normals(m.bm, faces=list(m.bm.faces))
    m.bm.normal_update()
    if ao:
        m.ground_ao(ao, strength)
    return m


def up(k=0.6):
    return lambda f: f.normal.z > k


def speckle(m, faces, color, chance, test=None, jitter=0.08):
    """Repaint a random share of `faces` (moss, lichen, wear)."""
    m.bm.normal_update()
    return m.paint([f for f in faces if (test is None or test(f)) and m.rng.random() < chance], color, jitter)


def slab(m, w, d, h, at=(0, 0, 0), rot=(0, 0, 0), color='granite', top=0.75, tip=None, seg=4,
         wobble=0.0, jitter=0.0, rough=0.0, sink=0.05, mid=True):
    """A rough standing stone: a w x d block rising h, narrowing to `top` (then to `tip`)."""
    rings = [(-sink, SQ)]
    if mid:
        rings.append((h * 0.55, SQ * (1 + (top - 1) * 0.35)))
    if tip is None:
        rings.append((h, SQ * top))
    else:
        rings += [(h * 0.84, SQ * top), (h, SQ * tip)]
    faces = m.loft(rings, seg=seg, phase=TAU / 8 if seg == 4 else 0.0, at=at, rot=rot, scale=(w, d, 1.0),
                   color=color, jitter=jitter, wobble=wobble, cap_bottom=False)
    if rough:
        m.jitter(faces, rough)
    return faces


def tube(m, pts, radii, seg=5, color='bone', jitter=0.0, caps=(True, True), phase=0.0, flat=1.0):
    """A tube through `pts` with a radius per point (0 closes to a tip): horns, ribs, bridges.

    `flat` squashes the cross-section across the bend, for blades and decks.
    """
    pts = [Vector(p) for p in pts]
    n = len(pts)
    radii = list(radii) if hasattr(radii, '__len__') else [radii] * n
    tangents = [(pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]).normalized() for i in range(n)]
    ref = Vector((0, 0, 1)) if abs(tangents[0].z) < 0.9 else Vector((1, 0, 0))
    side = tangents[0].cross(ref).normalized()
    bm = m.bm
    rows = []
    for p, t, r in zip(pts, tangents, radii):
        side = (side - t * side.dot(t)).normalized()
        upv = t.cross(side)
        if r <= 0:
            rows.append([bm.verts.new(p)])
            continue
        rows.append([bm.verts.new(p + (side * math.cos(phase + k * TAU / seg) + upv * math.sin(phase + k * TAU / seg) * flat) * r)
                     for k in range(seg)])
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
    if caps[0] and len(rows[0]) > 1:
        faces.append(bm.faces.new(list(reversed(rows[0]))))
    if caps[1] and len(rows[-1]) > 1:
        faces.append(bm.faces.new(rows[-1]))
    return m.paint(faces, color, jitter)


def curve(ctrl, n):
    """n points along a Catmull-Rom spline through the control points."""
    c = [Vector(p) for p in ctrl]
    c = [c[0] * 2 - c[1]] + c + [c[-1] * 2 - c[-2]]
    segs = len(ctrl) - 1
    out = []
    for k in range(n):
        t = k / (n - 1) * segs
        i = min(segs - 1, int(t))
        u = t - i
        p0, p1, p2, p3 = c[i], c[i + 1], c[i + 2], c[i + 3]
        out.append(0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u ** 3))
    return out


def rubble(m, spots, color='granite', subdiv=ICO20, jitter=0.1):
    """Half-sunk broken stones: spots of (x, y, radius, squash)."""
    faces = []
    for x, y, r, squash in spots:
        faces += blob(m, r, at=(x, y, 0.0), scale=(1.0, 1.0, squash), subdiv=subdiv, color=color, jitter=jitter,
                        noise_amount=0.3, flat_bottom=-r * 0.25)
    return faces


def scatter_spots(rng, n, rmin, rmax, size, squash=(0.5, 0.8), centre=(0.0, 0.0), arc=(0.0, TAU)):
    cx, cy = centre
    out = []
    for _ in range(n):
        a = rng.uniform(*arc)
        d = rng.uniform(rmin, rmax)
        out.append((cx + math.cos(a) * d, cy + math.sin(a) * d, rng.uniform(*size), rng.uniform(*squash)))
    return out


def pennant(m, at, length, height, notch, wave, thick=0.006, color='oxblood', jitter=0.04):
    """A swallowtail flag flying toward +X from `at` (its top inner corner), folding toward the tails."""
    x0, y0, z0 = at
    xs = [0.0, 0.5 * length, length - notch, length]
    ys = [0.0, 0.0, wave, -wave * 0.6]
    droop = [0.0, 0.0, height * 0.05, height * 0.12]
    bm = m.bm

    def column(i, z, back):
        return bm.verts.new((x0 + xs[i], y0 + ys[i] + (thick / 2 if back else -thick / 2), z0 - droop[i] + z))

    sides = []
    for back in (False, True):
        top = [column(i, 0.0, back) for i in range(4)]
        bot = [column(i, -height, back) for i in range(4)]
        mid = column(2, -height / 2, back)
        sides.append((top, bot, mid))
    faces = []
    for k, (top, bot, mid) in enumerate(sides):
        polys = [
            [top[0], top[1], bot[1], bot[0]],
            [top[1], top[2], mid, bot[2], bot[1]],
            [top[2], top[3], mid],
            [mid, bot[3], bot[2]],
        ]
        for p in polys:
            faces.append(bm.faces.new(p if k == 0 else list(reversed(p))))
    (tf, bf, mf), (tb, bb, mb) = sides
    loop_f = [tf[0], tf[1], tf[2], tf[3], mf, bf[3], bf[2], bf[1], bf[0]]
    loop_b = [tb[0], tb[1], tb[2], tb[3], mb, bb[3], bb[2], bb[1], bb[0]]
    for i in range(len(loop_f)):
        j = (i + 1) % len(loop_f)
        faces.append(bm.faces.new((loop_f[i], loop_f[j], loop_b[j], loop_b[i])))
    return m.paint(faces, color, jitter)


def arch_outline(w, h_side, rise, steps=6):
    """A round-headed opening [(x, z)]: straight sides to h_side, then a half-circle."""
    pts = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h_side)]
    for k in range(1, steps):
        a = math.pi * k / steps
        pts.append((math.cos(a) * w / 2, h_side + math.sin(a) * rise))
    pts.append((-w / 2, h_side))
    return pts


# -- stone circles and monoliths ------------------------------------------------

@model('stones-1', budget=800, lo=120, ground='grass', size=0.75)
def stone_circle(rng, lo):
    n = rng.choice((8, 9))
    radius = rng.uniform(0.24, 0.26)
    fallen = rng.randrange(n)
    # Two trilithons, roughly facing each other across the ring.
    first = (fallen + 2) % n
    lintels = [first, (first + n // 2) % n]
    capped = {k for i in lintels for k in (i, (i + 1) % n)}
    tall = rng.uniform(0.25, 0.27)
    stones = [dict(a=k * TAU / n + rng.uniform(-0.06, 0.06), w=rng.uniform(0.07, 0.09), d=rng.uniform(0.045, 0.055),
                   h=rng.uniform(0.17, 0.23), out=rng.uniform(-0.03, 0.12), tilt=rng.uniform(-0.08, 0.08),
                   top=rng.uniform(0.62, 0.85), tip=rng.uniform(0.25, 0.5), roll=rng.uniform(-0.3, 0.3))
              for k in range(n)]
    for k in capped:
        stones[k].update(h=tall, out=0.0, tilt=0.0, top=0.94)
    altar = (rng.uniform(0.13, 0.16), rng.uniform(0.08, 0.1), rng.uniform(-0.3, 0.3))
    debris = scatter_spots(rng, 6, 0.08, 0.36, (0.012, 0.02))

    m = Mesh(rng)
    stone_faces = []
    for i in lintels:
        a, b = stones[i], stones[(i + 1) % n]
        ax, ay = math.cos(a['a']) * radius, math.sin(a['a']) * radius
        bx, by = math.cos(b['a']) * radius, math.sin(b['a']) * radius
        span = math.hypot(bx - ax, by - ay)
        lintel = box(m, (span + 0.075, 0.055, 0.04), at=((ax + bx) / 2, (ay + by) / 2, tall - 0.006),
                     rot=(0, 0, math.atan2(by - ay, bx - ax)), color='granite_light', bevel=0 if lo else 0.006, jitter=0.06)
        if not lo:
            m.jitter(lintel, 0.004)
    for k, s in enumerate(stones):
        x, y = math.cos(s['a']) * radius, math.sin(s['a']) * radius
        yaw = s['a'] + math.pi / 2
        if k in capped:
            stone_faces += slab(m, s['w'], s['d'], s['h'], at=(x, y, 0), rot=(0, 0, yaw), color='granite', top=s['top'],
                                seg=4 if lo else 5, mid=not lo, wobble=0 if lo else 0.06, rough=0 if lo else 0.005)
            continue
        if k == fallen:
            # Toppled outward and half sunk; its broken stump stays standing.
            stone_faces += slab(m, s['w'], s['d'], s['h'] * 0.95, at=(x * 1.08, y * 1.08, s['d'] * 0.18),
                                rot=(math.pi / 2 - 0.08, s['roll'] * 0.3, yaw), color='granite', top=s['top'],
                                seg=4 if lo else 5, mid=not lo, wobble=0 if lo else 0.08, rough=0 if lo else 0.006)
            if not lo:
                stone_faces += slab(m, s['w'] * 0.95, s['d'] * 0.95, 0.045, at=(x, y, 0), rot=(0, 0, yaw),
                                    color='granite', top=0.9, seg=5, mid=False, rough=0.008)
            continue
        stone_faces += slab(m, s['w'], s['d'], s['h'], at=(x, y, 0), rot=(s['out'], s['tilt'], yaw), color='granite',
                            top=s['top'], tip=None if lo else s['tip'] + 0.35, seg=4 if lo else 5, mid=not lo,
                            wobble=0 if lo else 0.1, rough=0 if lo else 0.007)
    m.paint_by_height(stone_faces, 'moss_dark', 'granite_light', -0.02, 0.24, jitter=0 if lo else 0.08)

    aw, ad, ayaw = altar
    box(m, (aw, ad, 0.065), at=(0, 0, -0.02), rot=(0, 0, ayaw), color='granite_dark', bevel=0 if lo else 0.008, jitter=0.06)
    if lo:
        return finish(m)
    rubble(m, debris, color='granite_dark')
    return finish(m)


@model('stones-2', budget=800, lo=120, ground='hills', size=0.6)
def dolmen(rng, lo):
    yaw = rng.uniform(-0.25, 0.25)
    cap = (rng.uniform(0.32, 0.36), rng.uniform(0.22, 0.26), rng.uniform(-0.1, 0.1), rng.uniform(0.03, 0.09))
    ring = [(a, rng.uniform(0.22, 0.28), rng.uniform(0.04, 0.11), rng.uniform(0.05, 0.08), rng.uniform(-0.2, 0.2))
            for a in (0.3, 1.2, 2.3, 3.6, 4.5, 5.4) if rng.random() < 0.85]
    fall = rng.uniform(0, TAU)
    debris = scatter_spots(rng, 6, 0.16, 0.3, (0.015, 0.03))

    m = Mesh(rng)
    c, s = math.cos(yaw), math.sin(yaw)

    def place(x, y):
        return (x * c - y * s, x * s + y * c)

    seg = 4 if lo else 5
    uprights = []
    # Two side stones and a back stone make the chamber; the front stays open (-Y).
    for x, y, w, d, h in ((-0.115, -0.01, 0.05, 0.17, 0.19), (0.115, 0.0, 0.05, 0.16, 0.18), (0.0, 0.085, 0.19, 0.05, 0.185)):
        uprights += slab(m, w, d, h, at=(*place(x, y), 0), rot=(0, 0, yaw), color='granite', top=0.92, seg=seg,
                         mid=not lo, wobble=0 if lo else 0.06, rough=0 if lo else 0.006)
    m.paint_by_height(uprights, 'moss_dark', 'granite', -0.02, 0.2, jitter=0.08)
    box(m, (0.18, 0.15, 0.012), at=(*place(0, 0.0), -0.006), rot=(0, 0, yaw), color=shade('basalt', 0.6))

    cw, cd, tilt, roll = cap
    capstone = box(m, (cw, cd, 0.065), at=(*place(0.0, 0.01), 0.172), rot=(tilt, roll * 0.5, yaw),
                   color='granite', bevel=0 if lo else 0.014, taper=0.18, jitter=0.07)
    if not lo:
        m.jitter(capstone, 0.014)
        speckle(m, capstone, 'moss_dark', 0.45, test=up(0.5))

    for a, d, h, w, lean in (ring[:3] if lo else ring):
        x, y = math.cos(a) * d, math.sin(a) * d
        slab(m, w, w * 0.7, h, at=(x, y, 0), rot=(lean, 0, a + math.pi / 2), color='granite', top=0.8, seg=seg,
             mid=False, rough=0 if lo else 0.008)
    if lo:
        return finish(m)
    fx, fy = math.cos(fall) * 0.26, math.sin(fall) * 0.26
    slab(m, 0.06, 0.04, 0.16, at=(fx, fy, 0.012), rot=(math.pi / 2 - 0.1, 0, fall + math.pi / 2), color='granite',
         seg=5, wobble=0.08, rough=0.006)
    rubble(m, debris, color='granite_dark')
    return finish(m)


@model('monolith-1', budget=400, lo=60, ground='grass', size=0.4)
def monolith(rng, lo):
    w, d, h = rng.uniform(0.11, 0.125), rng.uniform(0.075, 0.085), rng.uniform(0.46, 0.5)
    yaw = rng.uniform(-0.12, 0.12)
    glyphs = [(col, row, rng.uniform(0.012, 0.026), rng.uniform(0.01, 0.018)) for col in (-1, 1) for row in range(4)]
    side_glyphs = [(side, row, rng.uniform(0.012, 0.022)) for side in (-1, 1) for row in range(2)]

    m = Mesh(rng)
    base = 0.075
    box(m, (0.3, 0.3, 0.085), at=(0, 0, -0.05), rot=(0, 0, yaw), color='granite_dark', bevel=0 if lo else 0.01, jitter=0.05)
    box(m, (0.22, 0.22, 0.04), at=(0, 0, 0.035), rot=(0, 0, yaw), color='granite', bevel=0 if lo else 0.008, jitter=0.05)
    if lo:
        m.loft([(base, SQ), (h * 0.86, SQ * 0.92), (h, SQ * 0.3)], seg=4, phase=TAU / 8, scale=(w, d, 1), rot=(0, 0, yaw),
               color='granite_light', cap_bottom=False)
        return finish(m)

    top_z = h * 0.86
    shape = lambda z: 1 - 0.08 * (z - base) / (top_z - base)  # noqa: E731  how far the faces have drawn in
    stone = m.loft([(base, OCT), (h * 0.5, OCT * shape(h * 0.5)), (top_z, OCT * 0.92), (h, OCT * 0.32)],
                   seg=8, phase=math.pi / 8, scale=(w, d, 1), rot=(0, 0, yaw), color='granite_light', cap_bottom=False)
    m.paint_by_height(stone, 'granite', 'granite_light', base, h, jitter=0.06)

    band_z = h * 0.56
    k = shape(band_z) * 1.07
    m.loft([(band_z, OCT * k), (band_z + 0.022, OCT * k)], seg=8, phase=math.pi / 8, scale=(w, d, 1), rot=(0, 0, yaw),
           color='gilt', jitter=0.05)

    # Rune columns cut into the front face above and below the band, two glyphs on each side face.
    frame = lambda x, y, z: (x * math.cos(yaw) - y * math.sin(yaw), x * math.sin(yaw) + y * math.cos(yaw), z)  # noqa: E731
    for col, row, gh, gw in glyphs:
        z = band_z + 0.04 + row * 0.045 if row < 2 else band_z - 0.06 - (row - 2) * 0.05
        y = -d / 2 * shape(z) - 0.001
        box(m, (gw, 0.006, gh), at=frame(col * 0.022, y, z - gh / 2), rot=(0, 0, yaw), color='basalt')
    for side, row, gh in side_glyphs:
        z = band_z + 0.05 + row * 0.05
        x = side * (w / 2 * shape(z) + 0.001)
        box(m, (0.006, 0.014, gh), at=frame(x, 0, z - gh / 2), rot=(0, 0, yaw), color='basalt')
    # A gilt diamond sigil high on the face.
    sz = h * 0.76
    m.prism([(0, -0.018), (0.013, 0), (0, 0.018), (-0.013, 0)], 0.008, at=frame(0, -d / 2 * shape(sz) - 0.002, sz),
            rot=(0, 0, yaw), color='gilt')
    return finish(m)


# -- ruins of the old empire --------------------------------------------------------

def column(m, x, y, z0, h, r, lo, breaks=None, capital=False, color='marble'):
    """A fluted column on a square plinth; `breaks` lowers its top ring unevenly."""
    seg = 5 if lo else 12
    if not lo:
        box(m, (r * 2.7, r * 2.7, 0.02), at=(x, y, z0), color='marble_dark', jitter=0.05)
    zb = z0 + (0 if lo else 0.02)
    shaft = m.loft([(zb, r * 1.06), (zb + (h - zb + z0) * 0.5, r), (z0 + h, r * 0.93)], seg=seg, at=(x, y, 0),
                   profile=None if lo else (lambda i: 1.0 if i % 2 == 0 else 0.84), color=color, jitter=0.04,
                   cap_bottom=False)
    if breaks and not lo:
        top = [v for v in m.verts_of(shaft) if abs(v.co.z - (z0 + h)) < 1e-6]
        for v, b in zip(sorted(top, key=lambda v: math.atan2(v.co.y - y, v.co.x - x)), breaks):
            v.co.z += b
    m.paint_by_height(shaft, 'marble_dark', color, z0, z0 + 0.4, jitter=0.05)
    if capital and not lo:
        m.cylinder(r * 0.95, r * 1.4, 0.022, seg=12, at=(x, y, z0 + h), color=color, jitter=0.04)
        box(m, (r * 3.0, r * 3.0, 0.018), at=(x, y, z0 + h + 0.022), color=color, jitter=0.04)
    return shaft


@model('ruin-colonnade', budget=1500, lo=200, ground='grass', size=0.85)
def colonnade(rng, lo):
    xs = [-0.27, -0.135, 0.0, 0.135, 0.27]
    full = 0.4
    heights = [rng.uniform(0.17, 0.28), full, full, rng.uniform(0.22, 0.33), rng.uniform(0.04, 0.08)]
    breaks = [[rng.uniform(-0.035, 0.0) for _ in range(12)] for _ in xs]
    drums = [(rng.uniform(-0.28, 0.28), rng.choice((-1, 1)) * rng.uniform(0.12, 0.16), rng.uniform(0, TAU),
              rng.uniform(0.06, 0.1)) for _ in range(3)]
    block = (rng.uniform(0.0, 0.2), rng.uniform(0.15, 0.2), rng.uniform(0, TAU))
    debris = scatter_spots(rng, 8, 0.2, 0.4, (0.012, 0.024), squash=(0.4, 0.7))
    yaw = rng.uniform(-0.15, 0.15)

    m = Mesh(rng)
    marble = mix('marble', 'marble_dark', 0.35)
    plat = box(m, (0.76, 0.3, 0.07), at=(0, 0, -0.045), color='marble_dark', bevel=0 if lo else 0.01, jitter=0.05)
    if not lo:
        m.jitter(plat, 0.006)
        step = box(m, (0.68, 0.22, 0.03), at=(0, 0, 0.025), color=marble, bevel=0.006, jitter=0.05)
        speckle(m, plat + step, 'moss', 0.3, test=up(0.5))
    z0 = 0.025 if lo else 0.055
    r = 0.031
    for k, (x, h) in enumerate(zip(xs, heights)):
        column(m, x, 0.0, z0, h, r, lo, breaks=None if k in (1, 2) else breaks[k], capital=k in (1, 2), color=marble)

    # The architrave over the two standing columns, snapped off toward the third.
    beam_z = z0 + full + (0 if lo else 0.04)
    beam = box(m, (0.27, 0.085, 0.055), at=(-0.06, 0, beam_z), color=marble, bevel=0 if lo else 0.006, jitter=0.04)
    if not lo:
        end = [v for v in m.verts_of(beam) if v.co.x > 0.0]
        for v in end:
            v.co.x += rng.uniform(-0.03, 0.01)
            v.co.z += rng.uniform(-0.01, 0.005)
        frieze = box(m, (0.22, 0.07, 0.03), at=(-0.075, 0, beam_z + 0.055), color='marble_dark', jitter=0.05)
        for i in range(5):
            box(m, (0.008, 0.074, 0.022), at=(-0.16 + i * 0.04, 0, beam_z + 0.058), color=marble, jitter=0.03)
        speckle(m, frieze, 'moss_dark', 0.3)

    for x, y, a, ln in (drums[:1] if lo else drums):
        m.cylinder(r * 1.05, r * 1.05, ln, seg=5 if lo else 10, at=(x, y, r * 0.75), rot=(math.pi / 2, 0, a),
                   color=marble, jitter=0.06)
    if lo:
        return finish(m)
    bx, by, ba = block
    box(m, (0.1, 0.07, 0.045), at=(bx, by, -0.01), rot=(0.12, 0.2, ba), color=marble, bevel=0.005, jitter=0.05)
    rubble(m, debris, color='marble_dark')
    return finish(m)


@model('ruin-arch', budget=1500, lo=200, ground='desert', size=0.8)
def great_arch(rng, lo):
    gap_from = rng.randint(4, 5)
    gap_to = gap_from + rng.randint(2, 3)  # voussoirs [gap_from, gap_to) have fallen
    right_top = rng.uniform(0.3, 0.36)
    fallen = [(rng.uniform(-0.08, 0.14), rng.uniform(-0.2, 0.12), rng.uniform(0, TAU), rng.uniform(-0.5, 0.5)) for _ in range(4)]
    debris = scatter_spots(rng, 9, 0.12, 0.42, (0.015, 0.03), squash=(0.4, 0.7))
    breaks = [rng.uniform(-0.05, 0.0) for _ in range(8)]

    m = Mesh(rng)
    px, pw, pd = 0.27, 0.15, 0.17
    spring = 0.2
    ri, ro = px - pw / 2, px - pw / 2 + 0.085
    count = 11

    def arc(k0, k1, inner, outer, n):
        """Outline of the arch ring between voussoirs k0 and k1 (left to right)."""
        a0, a1 = math.pi - k0 * math.pi / count, math.pi - k1 * math.pi / count
        pts = [(math.cos(a0 + (a1 - a0) * i / n) * inner, spring + math.sin(a0 + (a1 - a0) * i / n) * inner) for i in range(n + 1)]
        return pts + [(math.cos(a0 + (a1 - a0) * i / n) * outer, spring + math.sin(a0 + (a1 - a0) * i / n) * outer)
                      for i in range(n, -1, -1)]

    def pier(x, top, ruined):
        body = box(m, (pw, pd, top + 0.05), at=(x, 0, -0.05), color='sandstone', bevel=0 if lo else 0.008, jitter=0.05)
        if ruined and not lo:
            for v, b in zip([v for v in m.verts_of(body) if v.co.z > top - 0.02], breaks):
                v.co.z += b
        m.paint_by_height(body, 'sandstone_dark', 'sandstone', -0.05, 0.3, jitter=0.06)
        return body

    # Left: a pier carried up as a gate tower. Right: a pier broken off above the springing.
    tower_top = spring + 0.33
    pier(-px, tower_top, False)
    pier(px, right_top, True)
    if lo:
        m.prism(arc(0, gap_from, ri, ro, 3), pd * 0.9, color='sandstone_light')
        m.prism(arc(gap_to, count, ri, ro, 2), pd * 0.9, color='sandstone_light')
        box(m, (pw + 0.04, pd + 0.04, 0.03), at=(-px, 0, tower_top), color='sandstone_light')
        rubble(m, debris[:2], color='sandstone_dark')
        return finish(m)

    # Imposts at the springing, a cornice and broken merlons on the tower.
    for x in (-px, px):
        box(m, (pw + 0.03, pd + 0.03, 0.028), at=(x, 0, spring - 0.028), color='sandstone_light', jitter=0.04)
    box(m, (pw + 0.04, pd + 0.04, 0.03), at=(-px, 0, tower_top), color='sandstone_light', bevel=0.005, jitter=0.04)
    for k in range(3):
        box(m, (0.032, pd * 0.45, 0.04 - k * 0.008), at=(-px - pw / 2 + 0.026 + k * 0.049, 0, tower_top + 0.03),
            color='sandstone', jitter=0.05)
    # Pilasters and sunken relief panels on the piers' fronts.
    for x, top in ((-px, tower_top - 0.01), (px, right_top - 0.05)):
        for dx in (-pw / 2 + 0.012, pw / 2 - 0.012):
            box(m, (0.024, 0.012, top), at=(x + dx, -pd / 2 - 0.004, 0.0), color='sandstone_light', jitter=0.04)
        box(m, (0.075, 0.006, 0.12), at=(x, -pd / 2 - 0.001, 0.04), color='sandstone_dark', jitter=0.04)
    box(m, (0.075, 0.006, 0.11), at=(-px, -pd / 2 - 0.001, spring + 0.08), color='sandstone_dark', jitter=0.04)
    m.cylinder(0.022, 0.022, 0.008, seg=8, at=(-px, -pd / 2 - 0.002, spring + 0.135), rot=(math.pi / 2, 0, 0),
               color='gilt', jitter=0.05)
    # Voussoirs reaching from both haunches; the crown and keystone lie in the sand.
    for k in list(range(gap_from)) + list(range(gap_to, count)):
        a0 = math.pi - k * math.pi / count - 0.012
        a1 = math.pi - (k + 1) * math.pi / count + 0.012
        outline = [(math.cos(a0) * ri, spring + math.sin(a0) * ri), (math.cos(a1) * ri, spring + math.sin(a1) * ri),
                   (math.cos(a1) * ro, spring + math.sin(a1) * ro), (math.cos(a0) * ro, spring + math.sin(a0) * ro)]
        f = m.prism(outline, pd * 0.9, color='sandstone', jitter=0.06)
        if k in (gap_from - 1, gap_to):
            m.jitter(f, 0.006)
    for x, y, a, tilt in fallen:
        box(m, (0.06, 0.13, 0.085), at=(x, y - 0.05, -0.02), rot=(tilt * 0.4, tilt, a), color='sandstone', bevel=0.005, jitter=0.06)
    key = box(m, (0.075, 0.15, 0.1), at=(0.05, -0.17, -0.02), rot=(0.3, -0.5, 0.6), color='sandstone_light', bevel=0.005)
    m.jitter(key, 0.004)
    rubble(m, debris, color='sandstone_dark')
    return finish(m)


@model('ruin-head', budget=1500, lo=200, ground='desert', size=0.6)
def fallen_head(rng, lo):
    tilt = rng.uniform(1.15, 1.3)
    yaw = rng.uniform(0.3, 0.5)
    roll = rng.uniform(-0.15, 0.05)
    sink = rng.uniform(0.07, 0.09)
    spikes = [rng.uniform(0.35, 1.0) if rng.random() < 0.3 else 1.0 for _ in range(8)]
    shard = (rng.uniform(-0.25, -0.15), rng.uniform(-0.2, -0.1), rng.uniform(0, TAU))
    debris = scatter_spots(rng, 8, 0.2, 0.34, (0.015, 0.03), squash=(0.4, 0.7))

    m = Mesh(rng)
    head = []
    stone = 'stone_wall'
    seg = 6 if lo else 10
    face_phase = -math.pi / 2 + math.pi / seg  # a flat facet looks straight down -Y
    rings = ([(0.0, 0.08), (0.12, 0.14), (0.3, 0.135), (0.39, 0.06)] if lo else
             [(0.0, 0.07), (0.05, 0.11), (0.12, 0.138), (0.22, 0.145), (0.3, 0.136), (0.35, 0.115), (0.385, 0.07), (0.4, 0.02)])
    head += m.loft(rings, seg=seg, phase=face_phase, scale=(1, 0.92, 1), color=stone, jitter=0.05)
    head += box(m, (0.045, 0.06, 0.1), at=(0, -0.13, 0.095), taper=0.55, color=stone, jitter=0.04)  # nose
    head += box(m, (0.21, 0.04, 0.035), at=(0, -0.118, 0.2), rot=(0.25, 0, 0), color=stone, jitter=0.04)  # brow
    head += box(m, (0.11, 0.03, 0.03), at=(0, -0.112, 0.035), color=stone, jitter=0.05)  # lips
    head += m.loft([(0.27, 0.148), (0.32, 0.152)], seg=seg, phase=face_phase, scale=(1, 0.92, 1), color='gilt', jitter=0.06)
    for k, keep in enumerate(spikes if not lo else spikes[::2]):
        a = k * TAU / (8 if not lo else 4) + math.pi / 8
        x, y = math.cos(a) * 0.15, math.sin(a) * 0.15 * 0.92
        head += m.cylinder(0.02, 0.0, 0.075 * keep, seg=4, at=(x, y, 0.315), rot=(0, 0, a), color='gilt', jitter=0.06,
                           cap_bottom=False)
    if lo:
        head += box(m, (0.13, 0.02, 0.03), at=(0, -0.125, 0.155), color='basalt')
    else:
        for side in (-1, 1):
            head += box(m, (0.05, 0.022, 0.03), at=(side * 0.052, -0.124, 0.153), color=shade('basalt', 0.7))  # sockets
            head += box(m, (0.022, 0.05, 0.075), at=(side * 0.142, 0.0, 0.11), color=stone, jitter=0.05)  # ears
            head += box(m, (0.03, 0.02, 0.012), at=(side * 0.052, -0.13, 0.173), rot=(0.4, 0, 0), color=stone)  # lids
        head += box(m, (0.06, 0.02, 0.006), at=(0, -0.127, 0.045), color='basalt')  # mouth
        beard = box(m, (0.13, 0.08, 0.1), at=(0, -0.075, 0.03), rot=(math.pi, 0, 0), taper=0.55, color='stone_wall_dark', jitter=0.06)
        for i in range(4):
            beard += box(m, (0.012, 0.012, 0.06), at=(-0.036 + i * 0.024, -0.118, -0.055), color='stone_wall_dark', jitter=0.06)
        head += beard
        speckle(m, head, 'sandstone_dark', 0.2)

    # Topple it: onto its right cheek, face turned to the camera, sunk into the ground.
    m.transform(head, rot=(roll, tilt, yaw), scale=1.25)
    verts = m.verts_of(head)
    lo_z = min(v.co.z for v in verts)
    cx = (min(v.co.x for v in verts) + max(v.co.x for v in verts)) / 2
    cy = (min(v.co.y for v in verts) + max(v.co.y for v in verts)) / 2
    m.transform(head, at=(-cx + 0.03, -cy + 0.02, -lo_z - sink))

    sx, sy, sa = shard
    m.cylinder(0.02, 0.0, 0.07, seg=4, at=(sx, sy, 0.012), rot=(math.pi / 2 - 0.2, 0, sa), color='gilt', jitter=0.08)
    rubble(m, debris if not lo else debris[:2], color=stone)
    return finish(m)


def broken_shell(m, seg, radius, thick, levels, tops, floor, color, phase=0.0):
    """A hollow round tower wall: outer rings at `levels`, a jagged rim at per-vertex `tops`,
    an inner wall facing in, and a floor. Returns (outer, inner, rim, floor) faces."""
    bm = m.bm
    angles = [phase + k * TAU / seg for k in range(seg)]

    def ring(heights, inset):
        return [bm.verts.new((math.cos(a) * (radius(z) - inset), math.sin(a) * (radius(z) - inset), z))
                for a, z in zip(angles, heights)]

    outer = [ring([z] * seg, 0.0) for z in levels] + [ring(tops, 0.0)]
    inner = [ring([z] * seg, thick) for z in [floor] + [z for z in levels if z > floor + 0.02]] + [ring(tops, thick)]
    faces = ([], [], [], [])
    for rows, idx, flip in ((outer, 0, False), (inner, 1, True)):
        for lo, hi in zip(rows, rows[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                q = (lo[i], lo[j], hi[j], hi[i])
                faces[idx].append(bm.faces.new(tuple(reversed(q)) if flip else q))
    for i in range(seg):
        j = (i + 1) % seg
        faces[2].append(bm.faces.new((outer[-1][i], outer[-1][j], inner[-1][j], inner[-1][i])))
    faces[3].append(bm.faces.new(inner[0]))
    m.paint(faces[0] + faces[1] + faces[2], color, 0.06)
    return faces


@model('ruin-tower', budget=1500, lo=200, ground='hills', size=0.6)
def broken_tower(rng, lo):
    R, thick = 0.118, 0.026
    peak = rng.uniform(1.9, 2.6)  # the tall remnant stands to the back-left
    high, low = rng.uniform(0.56, 0.62), rng.uniform(0.3, 0.36)
    jag = [rng.uniform(-0.035, 0.02) for _ in range(14)]
    windows = [(rng.uniform(0, TAU), rng.uniform(0.18, 0.46)) for _ in range(7)]
    blocks = [(rng.uniform(0.12, 0.3), rng.uniform(-0.6, 0.9), rng.uniform(0, TAU), rng.uniform(-0.4, 0.4)) for _ in range(6)]
    debris = scatter_spots(rng, 10, 0.12, 0.27, (0.014, 0.028), arc=(-1.6, 1.2))

    m = Mesh(rng)
    seg = 6 if lo else 10
    radius = lambda z: R * (1 + 0.09 * max(0.0, 0.1 - z) / 0.15)  # noqa: E731  a battered foot
    # The rim breaks in courses: a stepped shard at the back, shoulders each side, the front fallen low,
    # every vertex a ragged tooth.
    tops = []
    for k in range(seg):
        c = math.cos(k * TAU / seg - peak)
        if c > 0.75:
            level = high
        elif c > 0.3:
            level = high - 0.09
        elif c > -0.35:
            level = low + (high - low) * 0.35
        else:
            level = low
        tooth = (0.025 if k % 2 else -0.02) + jag[k % len(jag)]
        tops.append(level + (0 if lo else tooth))
    levels = [-0.05] if lo else [-0.05, 0.1, 0.24]
    outer, inner, rim, floor = broken_shell(m, seg, radius, thick, levels, tops, 0.06, 'stone_wall')
    m.paint_by_height(outer, 'moss_dark', 'stone_wall', -0.05, 0.14, jitter=0.07)
    speckle(m, outer, 'stone_wall_dark', 0.3)
    m.paint(inner, 'stone_wall_dark', 0.08)
    m.paint(floor, shade('basalt', 0.7))
    speckle(m, rim, 'moss_dark', 0.3)
    # Doorway on the front.
    m.prism(arch_outline(0.06, 0.06, 0.03, steps=3 if lo else 5), 0.02, at=(0, -radius(0.0) + 0.006, -0.01),
            color=shade('basalt', 0.6))
    if lo:
        rubble(m, debris[:2], color='stone_wall_dark')
        return finish(m)

    m.loft([(0.17, R + 0.009), (0.19, R + 0.009)], seg=seg, color='stone_wall_dark', jitter=0.05)  # string course
    for a, z in windows:
        k = int(round(a / TAU * seg)) % seg
        if z > tops[k] - 0.07:
            continue
        r = radius(z) + 0.003
        box(m, (0.018, 0.012, 0.05), at=(math.cos(a) * r, math.sin(a) * r, z), rot=(0, 0, a + math.pi / 2), color=shade('basalt', 0.6))
    rubble(m, [(0.0, 0.0, 0.05, 0.4)], color='stone_wall_dark')  # fill inside the shell
    for d, a, yaw, tilt in blocks:
        box(m, (0.05, 0.035, 0.03), at=(math.cos(a) * d, math.sin(a) * d - 0.05, -0.01), rot=(tilt, tilt * 0.5, yaw),
              color='stone_wall', bevel=0.004, jitter=0.06)
    rubble(m, debris, color='stone_wall_dark')
    return finish(m)


# -- the dwarven gate -----------------------------------------------------------------

@model('dwarfgate-1', budget=2000, lo=250, ground='rock', size=0.85)
def dwarf_gate(rng, lo):
    back = 0.12
    outline = [(-0.43, -0.06), (0.43, -0.06), (0.44, 0.2), (0.41, 0.34), (0.34, 0.44), (0.24, 0.58), (0.11, 0.56),
               (0.0, 0.67), (-0.13, 0.6), (-0.25, 0.52), (-0.36, 0.43), (-0.42, 0.28)]
    outline = [(x + rng.uniform(-0.02, 0.02), z + rng.uniform(-0.03, 0.03)) if z > 0 else (x, z) for x, z in outline]
    crags = [(-0.36, 0.0, 0.22, 0.12, 0.14, 0.25), (0.36, 0.0, 0.26, 0.12, 0.14, 0.28), (-0.2, 0.0, 0.5, 0.16, 0.13, 0.13),
             (0.2, 0.0, 0.53, 0.16, 0.13, 0.14), (0.0, 0.03, 0.6, 0.18, 0.12, 0.1), (-0.42, -0.08, 0.06, 0.07, 0.07, 0.08),
             (0.43, -0.07, 0.07, 0.08, 0.07, 0.09)]
    crags = [(x + rng.uniform(-0.02, 0.02), y, z + rng.uniform(-0.02, 0.02), sx, sy, sz) for x, y, z, sx, sy, sz in crags]
    debris = scatter_spots(rng, 6, 0.3, 0.45, (0.014, 0.026), centre=(0.0, -0.1), arc=(-2.6, -0.5))

    m = Mesh(rng)
    rock = m.prism(outline, back * 2, color='granite_dark', jitter=0.08)
    # Angular shards of the mountain round the carved face, leaning outward.
    for x, y, z, sx, sy, sz in (crags[:3] if lo else crags):
        lean = (rng.uniform(-0.15, 0.15), -0.25 * (1 if x > 0 else -1) * (1 if abs(x) > 0.3 else 0.4))
        rock += m.loft([(z - sz, SQ * 1.1), (z + sz * 0.3, SQ), (z + sz * 0.85, SQ * 0.45), (z + sz * 1.15, 0.0)],
                       seg=4 if lo else 5, at=(x, y, 0), rot=(lean[0], lean[1], rng.uniform(0, TAU)),
                       scale=(sx * 1.6, sy * 1.6, 1.0), color='granite_dark', jitter=0.1, wobble=0 if lo else 0.18)
    if not lo:
        m.jitter(rock, 0.008)
        m.paint_by_height(rock, 'basalt', 'granite', -0.05, 0.7, jitter=0.12)

    stone, dark = 'granite_light', shade('basalt', 0.6)
    face_y = -back - 0.025
    # The dressed facade and its stepped gable.
    box(m, (0.52, 0.05, 0.53), at=(0, face_y, -0.05), color=stone, jitter=0.04)
    for k, w in enumerate((0.44, 0.34, 0.24, 0.13)):
        if lo and k % 2:
            continue
        box(m, (w, 0.05, 0.04), at=(0, face_y, 0.48 + k * 0.04), color=stone, jitter=0.04)
    # Doors, with a dark gap at the seam.
    box(m, (0.2, 0.01, 0.27), at=(0, face_y - 0.026, 0.06), color=dark)
    if lo:
        box(m, (0.196, 0.016, 0.265), at=(0, face_y - 0.034, 0.065), color='slate')
        box(m, (0.32, 0.03, 0.34), at=(0, face_y - 0.03, 0.06), color='granite')
        box(m, (0.4, 0.13, 0.11), at=(0, -0.24, -0.05), color=stone)
        for x in (-0.27, 0.27):
            box(m, (0.1, 0.1, 0.11), at=(x, -0.2, -0.05), color='granite_dark')
            box(m, (0.075, 0.06, 0.22), at=(x, -0.2, 0.06), taper=0.2, color='granite')
        for v in m.bm.verts:
            v.co.y = min(v.co.y, back)
        return finish(m)

    for x in (-0.05, 0.05):
        box(m, (0.096, 0.018, 0.265), at=(x, face_y - 0.04, 0.065), color='slate', jitter=0.03)
        for z in (0.1, 0.19, 0.28):
            box(m, (0.088, 0.006, 0.01), at=(x, face_y - 0.05, z), color='gilt', jitter=0.05)
        for z in (0.135, 0.235):
            box(m, (0.012, 0.007, 0.012), at=(x + (0.03 if x > 0 else -0.03), face_y - 0.05, z), color='gilt_hi')
    m.cylinder(0.034, 0.034, 0.008, seg=10, at=(0, face_y - 0.049, 0.205), rot=(math.pi / 2, 0, 0), color='gilt', jitter=0.04)
    m.cylinder(0.018, 0.018, 0.004, seg=6, at=(0, face_y - 0.057, 0.205), rot=(math.pi / 2, 0, 0), color='gilt_hi')
    # Nested frames stepping forward from the doors: the deepest is the outermost.
    for w, depth, h, thick in ((0.24, 0.04, 0.3, 0.025), (0.32, 0.06, 0.35, 0.04), (0.4, 0.08, 0.41, 0.045)):
        y = face_y - 0.025 - depth / 2
        for side in (-1, 1):
            box(m, (thick, depth, h), at=(side * (w / 2 - thick / 2), y, 0.06), color=stone, jitter=0.03)
        box(m, (w, depth, thick), at=(0, y, 0.06 + h - thick), color=stone, jitter=0.03)
    lintel_front = face_y - 0.025 - 0.08
    box(m, (0.3, 0.004, 0.009), at=(0, lintel_front - 0.002, 0.43), color='gilt', jitter=0.04)
    for i in range(9):
        box(m, (0.012, 0.004, 0.016 if i % 2 else 0.01), at=(-0.12 + i * 0.03, lintel_front - 0.002, 0.444), color='basalt')
    # A stepped pediment over the outer frame.
    for k, w in enumerate((0.42, 0.3, 0.18)):
        box(m, (w, 0.07, 0.025), at=(0, face_y - 0.06, 0.47 + k * 0.025), color=stone, jitter=0.04)
    # Landing and the stair down from it.
    box(m, (0.42, 0.09, 0.11), at=(0, -0.205, -0.05), color=stone, jitter=0.04)
    for k, w in enumerate((0.36, 0.39, 0.42)):
        box(m, (w, 0.045, 0.095 - k * 0.015), at=(0, -0.2725 - k * 0.045, -0.05), color=stone if k % 2 else 'granite',
              jitter=0.04)
    # Two guardians leaning on their warhammers.
    for side in (-1, 1):
        x, y = side * 0.275, -0.205
        box(m, (0.105, 0.1, 0.12), at=(x, y, -0.05), color='granite', bevel=0.006, jitter=0.04)
        box(m, (0.07, 0.055, 0.12), at=(x, y + 0.005, 0.07), taper=0.15, color=stone, jitter=0.04)
        box(m, (0.105, 0.07, 0.035), at=(x, y + 0.005, 0.185), color=stone, jitter=0.04)
        box(m, (0.045, 0.05, 0.045), at=(x, y + 0.005, 0.215), color=stone, jitter=0.04)
        m.loft([(0.25, 0.038), (0.27, 0.034), (0.3, 0.0)], seg=4, phase=TAU / 8, at=(x, y + 0.005, 0), color='granite',
               jitter=0.05)
        box(m, (0.05, 0.022, 0.085), at=(x, y - 0.03, 0.23), rot=(math.pi, 0, 0), taper=0.6, color='granite', jitter=0.04)
        box(m, (0.011, 0.011, 0.17), at=(x, y - 0.05, 0.07), color='timber_dark')
        box(m, (0.07, 0.03, 0.04), at=(x, y - 0.05, 0.07), color='iron', jitter=0.04)
        box(m, (0.03, 0.012, 0.012), at=(x, y - 0.05, 0.235), color='gilt')
    rubble(m, debris, color='granite_dark')
    for v in m.bm.verts:
        v.co.y = min(v.co.y, back)
    return finish(m)


# -- the elven spires -------------------------------------------------------------------

@model('elfspire-1', budget=1500, lo=200, ground='forest', size=0.65)
def elf_spires(rng, lo):
    spires = [(rng.uniform(-0.02, 0.02), 0.08, rng.uniform(1.2, 1.3)), (-0.19, -0.06, rng.uniform(0.92, 1.0)),
              (0.18, -0.1, rng.uniform(0.76, 0.84))]
    turns = [rng.uniform(0, TAU) for _ in spires]
    leaf_turns = [rng.uniform(0, TAU) for _ in spires]

    m = Mesh(rng)
    pale, pale_dark = 'marble', 'marble_dark'
    # Each spire rises from its own stepped plinth; mossy paving links them.
    for x, y, h in spires:
        m.loft([(-0.05, 0.1), (0.02, 0.095), (0.03, 0.08)], seg=6 if lo else 8, at=(x, y, 0), phase=math.pi / 8,
               color=pale_dark, jitter=0.04)
    if not lo:
        paving = m.loft([(-0.05, 0.25), (0.008, 0.24)], seg=10, at=(0.0, -0.02, 0), color=mix(pale_dark, 'moss', 0.45),
                        jitter=0.1, wobble=0.08)
        speckle(m, paving, 'moss_dark', 0.4)
    seg = 4 if lo else 8
    blade = None if lo else (lambda i: 1.0 if i % 2 == 0 else 0.78)
    for (x, y, h), turn, lt in zip(spires, turns, leaf_turns):
        rings = ([(0.0, 0.07), (h * 0.45, 0.04), (h * 0.6, 0.06), (h, 0.0)] if lo else
                 [(0.0, 0.075), (0.05, 0.068), (0.075, 0.05), (h * 0.44, 0.038), (h * 0.5, 0.06), (h * 0.6, 0.066),
                  (h * 0.67, 0.034), (h * 0.73, 0.026), (h * 0.88, 0.012), (h, 0.0)])
        shaft = m.loft(rings, seg=seg, phase=turn, at=(x, y, 0), profile=blade, color=pale, jitter=0.04, cap_bottom=False)
        m.paint_by_height(shaft, pale_dark, pale, 0.0, h * 0.5, jitter=0.04)
        m.paint_where(shaft, lambda f, h=h: f.calc_center_median().z > h * 0.86, 'gilt', jitter=0.05)
        if lo:
            continue
        m.loft([(h * 0.6, 0.071), (h * 0.62, 0.071)], seg=seg, phase=turn, at=(x, y, 0), profile=blade, color='gilt', jitter=0.04)
        # Leaf-blade flourishes cupping the chamber, gilt at the tips.
        leaf = [(0.0, 0.0), (0.02, 0.06), (0.02, 0.13), (0.0, 0.21), (-0.007, 0.12), (-0.008, 0.05)]
        for k in range(6):
            a = lt + k * TAU / 6
            f = m.prism(leaf, 0.007, at=(x + math.cos(a) * 0.04, y + math.sin(a) * 0.04, h * 0.4),
                        rot=(0, 0.24, a), color=pale, jitter=0.04)
            m.paint_where(f, lambda face, h=h: face.calc_center_median().z > h * 0.4 + 0.14, 'gilt', jitter=0.04)
        # Low blade-roots flaring at the foot of the shaft.
        for k in range(4):
            a = lt + math.pi / 4 + k * TAU / 4
            m.prism([(0.0, 0.0), (0.06, 0.0), (0.0, 0.16)], 0.008, at=(x + math.cos(a) * 0.03, y + math.sin(a) * 0.03, 0.02),
                    rot=(0, 0, a), color=pale_dark, jitter=0.04)
    # Bridges from the tall spire to the others: a slender deck over a sweeping underside.
    mx, my, mh = spires[0]
    for x, y, h in spires[1:]:
        z = h * 0.55
        a = Vector((mx, my, z))
        b = Vector((x, y, z))
        d = (b - a).normalized()
        a, b = a + d * 0.045, b - d * 0.045
        n = 3 if lo else 6
        deck = [a.lerp(b, t / (n - 1)) + Vector((0, 0, 0.035 * math.sin(math.pi * t / (n - 1)))) for t in range(n)]
        tube(m, deck, 0.013, seg=4 if not lo else 3, color=pale, phase=TAU / 8, flat=0.5)
        if not lo:
            under = [a.lerp(b, t / (n - 1)) + Vector((0, 0, -0.06 + 0.075 * math.sin(math.pi * t / (n - 1)))) for t in range(n)]
            tube(m, under, 0.007, seg=4, color=pale_dark, phase=TAU / 8)
            mid = deck[n // 2]
            m.cylinder(0.008, 0.0, 0.03, seg=4, at=(mid.x, mid.y, mid.z + 0.005), color='gilt')
    return finish(m, ao=0.08)


# -- dragon bones ------------------------------------------------------------------------

@model('bones-1', budget=1800, lo=220, ground='desert', size=0.9)
def dragon_bones(rng, lo):
    jig = [Vector((rng.uniform(-0.01, 0.01), rng.uniform(-0.015, 0.015), rng.uniform(-0.01, 0.01))) for _ in range(10)]
    spine_ctrl = [(-0.3, -0.07, 0.03), (-0.2, -0.03, 0.1), (-0.08, 0.0, 0.15), (0.04, 0.02, 0.13), (0.14, 0.03, 0.04),
                  (0.2, 0.02, -0.04), (0.27, 0.0, 0.0), (0.34, -0.03, 0.05), (0.42, -0.06, 0.02), (0.48, -0.07, -0.03)]
    spine_ctrl = [Vector(p) + j for p, j in zip(spine_ctrl, jig)]
    skull_yaw = math.pi + rng.uniform(0.4, 0.6)
    skull_roll = rng.uniform(0.2, 0.4)
    jaw_open = rng.uniform(0.15, 0.3)
    rib_spread = [rng.uniform(0.92, 1.08) for _ in range(12)]

    m = Mesh(rng)
    bone, bone_dark = 'bone', 'bone_dark'
    pts = curve(spine_ctrl, 8 if lo else 26)
    n = len(pts)
    radii = [0.026 * (1 - 0.7 * i / (n - 1)) * (1.0 if lo or i % 2 == 0 else 0.66) for i in range(n)]
    spine = tube(m, pts, radii, seg=3 if lo else 5, color=bone, jitter=0.05)
    if not lo:
        for i in range(2, n - 6, 2):
            p = pts[i]
            if p.z < 0.02:
                continue
            spine += tube(m, [p, p + Vector((-0.014, 0, 0.05 * (1 - i / n)))], [0.009, 0.0], seg=3, color=bone_dark)

    # Ribs arch out of the back and down into the ground on both sides.
    cage = [i for i in range(n) if -0.18 < pts[i].x < 0.1]
    picks = cage[::max(1, len(cage) // (3 if lo else 6))][: (3 if lo else 6)]
    ribs = []
    for k, i in enumerate(picks):
        base = pts[i]
        R = 0.14 * (1 - 0.3 * k / max(1, len(picks) - 1))
        for side in (-1, 1):
            spread = rib_spread[(2 * k + (side > 0)) % len(rib_spread)]
            thetas = [0.15, 1.0, 2.0] if lo else [0.15, 0.55, 0.95, 1.35, 1.7, 2.05]
            path = [base + Vector((0.035 * t, side * R * math.sin(t) * spread, R * (math.cos(t) - 1) * 0.95)) for t in thetas]
            ribs += tube(m, path, [0.009, 0.007, 0.006] if lo else [0.009, 0.008, 0.0075, 0.007, 0.0065, 0.006],
                         seg=3, color=bone, jitter=0.05, caps=(False, True))

    # The skull, built pointing +X, then laid at the end of the neck facing the camera.
    skull = []
    snout = ([(-0.05, 0, 0.0), (0.03, 0, 0.0), (0.13, 0, -0.01), (0.2, 0, -0.015)] if lo else
             [(-0.05, 0, 0.0), (-0.02, 0, 0.006), (0.03, 0, 0.0), (0.08, 0, -0.006), (0.13, 0, -0.01), (0.17, 0, -0.012), (0.205, 0, -0.016)])
    sr = [0.032, 0.042, 0.026, 0.008] if lo else [0.03, 0.046, 0.04, 0.03, 0.026, 0.02, 0.008]
    skull += tube(m, snout, sr, seg=4 if lo else 6, color=bone, jitter=0.05, flat=0.72, phase=TAU / 8)
    for side in (-1, 1):
        horn = ([(0.0, side * 0.025, 0.02), (-0.1, side * 0.05, 0.065), (-0.2, side * 0.05, 0.035)] if lo else
                [(0.0, side * 0.025, 0.02), (-0.05, side * 0.04, 0.05), (-0.11, side * 0.05, 0.066), (-0.17, side * 0.055, 0.056), (-0.215, side * 0.05, 0.034)])
        f = tube(m, horn, [0.016, 0.009, 0.0] if lo else [0.016, 0.013, 0.009, 0.005, 0.0], seg=3 if lo else 5, color=bone_dark)
        m.paint_by_height(f, bone_dark, 'bark_grey', 0.02, 0.07, jitter=0.05)
        skull += f
        if not lo:
            skull += box(m, (0.032, 0.012, 0.018), at=(0.035, side * 0.034, 0.002), rot=(side * 0.5, 0, 0), color=shade('basalt', 0.7))
            skull += tube(m, [(0.06, side * 0.03, 0.012), (0.03, side * 0.05, 0.03)], [0.006, 0.0], seg=3, color=bone_dark)
            for fx in (0.13, 0.165):
                skull += tube(m, [(fx, side * 0.018, -0.022), (fx + 0.004, side * 0.018, -0.048)], [0.005, 0.0], seg=3, color=bone)
    jaw = tube(m, [(-0.01, 0, -0.032), (0.08, 0, -0.04), (0.17, 0, -0.045)] if lo else
               [(-0.01, 0, -0.032), (0.05, 0, -0.04), (0.11, 0, -0.045), (0.17, 0, -0.046)],
               [0.028, 0.02, 0.008] if lo else [0.03, 0.024, 0.017, 0.008], seg=4, color=bone, jitter=0.05, flat=0.5, phase=TAU / 8)
    m.transform(jaw, rot=(0, jaw_open, 0))
    skull += jaw
    m.transform(skull, rot=(skull_roll, 0, skull_yaw), scale=1.35)
    head = pts[0]
    m.transform(skull, at=(head.x - 0.01, head.y - 0.005, head.z + 0.005))

    # The far wing rears up out of the sand; a near-side finger barely breaks the surface.
    shoulder = pts[n // 3]
    elbow = shoulder + Vector((0.04, 0.12, 0.12))
    wrist = elbow + Vector((0.11, 0.08, 0.1))
    wing = tube(m, [shoulder, elbow, wrist], [0.02, 0.016, 0.013], seg=3 if lo else 5, color=bone, jitter=0.05)
    fingers = ([(0.3, 0.24, -0.03)] if lo else
               [(0.36, 0.22, -0.03), (0.24, 0.4, -0.03), (0.03, 0.44, -0.03)])
    for tip in fingers:
        tip = Vector(tip)
        knuckle = wrist.lerp(tip, 0.5) + Vector((0, 0, 0.06))
        wing += tube(m, [wrist, knuckle, tip], [0.011, 0.008, 0.004], seg=3 if lo else 4, color=bone, jitter=0.05)
    if not lo:
        wing += tube(m, [wrist, wrist + Vector((-0.02, 0.01, 0.05))], [0.008, 0.0], seg=3, color=bone_dark)
        wing += tube(m, [(-0.02, -0.15, -0.02), (0.08, -0.22, 0.06), (0.2, -0.27, -0.03)], [0.011, 0.008, 0.005], seg=4, color=bone)
    if not lo:
        m.paint_by_height(spine + ribs + wing, bone_dark, bone, -0.02, 0.2, jitter=0.06)
    return finish(m, ao=0.06, strength=0.3)


# -- roadside stones and shrines ----------------------------------------------------------

@model('waystone-1', budget=150, lo=30, ground='road', size=0.25)
def waystone(rng, lo):
    w, d, h = rng.uniform(0.055, 0.065), rng.uniform(0.035, 0.042), rng.uniform(0.13, 0.15)
    lean = (rng.uniform(-0.06, 0.06), rng.uniform(-0.06, 0.06))
    glyphs = [rng.uniform(0.008, 0.016) for _ in range(3)]

    m = Mesh(rng)
    rot = (lean[0], lean[1], 0)
    if lo:
        slab(m, w, d, h, rot=rot, color='granite_light', top=0.8, mid=False)
        m.loft([(h * 0.55, SQ * 1.06), (h * 0.62, SQ * 1.06)], seg=4, phase=TAU / 8, scale=(w, d, 1), rot=rot, color='gilt',
               cap_bottom=False, cap_top=False)
        return finish(m)
    box(m, (w * 1.6, d * 1.8, 0.04), at=(0, 0, -0.03), color='granite', jitter=0.05)
    stone = m.loft([(-0.04, OCT), (h * 0.7, OCT * 0.96), (h * 0.88, OCT * 0.78), (h, OCT * 0.35)], seg=8, phase=math.pi / 8,
                   scale=(w, d, 1), rot=rot, color='granite_light', jitter=0.04, cap_bottom=False)
    m.paint_by_height(stone, 'granite', 'granite_light', 0.0, h, jitter=0.05)
    m.loft([(h * 0.55, OCT * 1.06), (h * 0.62, OCT * 1.06)], seg=8, phase=math.pi / 8, scale=(w, d, 1), rot=rot, color='gilt',
           jitter=0.04)
    for k, gh in enumerate(glyphs):
        box(m, (0.009, 0.006, gh), at=(-0.016 + k * 0.016, -d / 2 - 0.001, h * 0.3), rot=rot, color='basalt')
    return finish(m)


@model('shrine-1', budget=600, lo=80, ground='grass', size=0.35)
def shrine(rng, lo):
    yaw = rng.uniform(-0.1, 0.1)
    roof_pitch = rng.uniform(0.5, 0.6)

    m = Mesh(rng)
    stone, roof = 'stone_wall', 'roof_slate'
    box(m, (0.24, 0.2, 0.06), at=(0, 0, -0.04), rot=(0, 0, yaw), color='stone_wall_dark', bevel=0 if lo else 0.006, jitter=0.05)
    box(m, (0.19, 0.15, 0.03), at=(0, 0.01, 0.02), rot=(0, 0, yaw), color=stone, bevel=0 if lo else 0.005, jitter=0.05)
    box(m, (0.15, 0.03, 0.17), at=(0, 0.06, 0.05), rot=(0, 0, yaw), color=stone, jitter=0.05)  # back wall
    if not lo:
        for x in (-0.065, 0.065):
            box(m, (0.024, 0.024, 0.165), at=(x - 0.0 * yaw, -0.045, 0.05), rot=(0, 0, yaw), color=stone, bevel=0.003, jitter=0.05)
    # The hooded figure, its face in shadow.
    fig = (0, 0.005, 0.05)
    if lo:
        m.loft([(0.0, 0.032), (0.1, 0.022), (0.145, 0.0)], seg=4, phase=TAU / 8, at=fig, color='marble_dark')
    else:
        m.loft([(0.0, 0.034), (0.05, 0.03), (0.09, 0.026), (0.105, 0.025), (0.13, 0.022), (0.15, 0.012), (0.158, 0.0)], seg=6,
               phase=-math.pi / 2, at=fig, color='marble_dark', jitter=0.04)
        box(m, (0.024, 0.012, 0.028), at=(0, -0.017, 0.155), color=shade('basalt', 0.6))
        box(m, (0.03, 0.014, 0.02), at=(0, -0.028, 0.1), color='marble')  # folded hands
        m.cylinder(0.018, 0.022, 0.012, seg=8, at=(0, -0.075, 0.05), rot=(0, 0, yaw), color='gilt', jitter=0.05)  # offering bowl
        m.cylinder(0.012, 0.012, 0.004, seg=8, at=(0, -0.075, 0.062), color='ember')
    # Pitched stone roof over the niche.
    zr = 0.215
    if lo:
        m.prism([(-0.11, 0.0), (0.11, 0.0), (0.0, 0.065)], 0.2, at=(0, 0.005, zr), rot=(0, 0, yaw), color=roof)
        return finish(m)
    for side in (-1, 1):
        box(m, (0.13, 0.21, 0.014), at=(side * 0.054, 0.005, zr), rot=(0, side * roof_pitch, yaw), color=roof, jitter=0.05)
    m.prism([(-0.085, 0.0), (0.085, 0.0), (0.0, 0.05)], 0.17, at=(0, 0.005, zr), rot=(0, 0, yaw), color=stone)
    box(m, (0.014, 0.215, 0.012), at=(0, 0.005, zr + 0.05), rot=(0, 0, yaw), color='gilt', jitter=0.05)
    return finish(m)


# -- pin markers: dungeon, cave, wizard's tower, camp, temple ------------------------------

@model('dungeon-1', budget=1200, lo=150, ground='hills', size=0.6)
def dungeon(rng, lo):
    stumps = [rng.uniform(0.11, 0.16), rng.uniform(0.21, 0.27)]
    mound_seed = (rng.uniform(0.33, 0.36), rng.uniform(0.25, 0.28), rng.uniform(0.15, 0.17))
    outcrops = [(rng.uniform(-0.2, -0.12), rng.uniform(0.12, 0.22), rng.uniform(0.04, 0.05)),
                (rng.uniform(0.12, 0.2), rng.uniform(0.1, 0.22), rng.uniform(0.035, 0.05))]
    debris = scatter_spots(rng, 6, 0.24, 0.33, (0.013, 0.024), arc=(-2.8, -0.3))

    m = Mesh(rng)
    mx, my, mz = mound_seed
    mound = blob(m, 1.0, at=(0, 0.12, -0.045), scale=(mx, my, mz), subdiv=ICO20 if lo else ICO80, color=mix('roof_turf', 'moss', 0.3),
                 jitter=0.12, noise_amount=0.4, flat_bottom=-0.3)
    if not lo:
        m.bm.normal_update()
        m.paint_where(mound, lambda f: f.normal.z < 0.5, mix('earth', 'roof_turf', 0.3), jitter=0.12)
        speckle(m, mound, 'moss_dark', 0.3, test=up(0.5))
        for x, y, r in outcrops:
            blob(m, r, at=(x, y, 0.07), scale=(1.2, 1.0, 1.1), subdiv=ICO20, color='granite_dark', jitter=0.1, noise_amount=0.3)
    stone, dark = 'granite_dark', shade('basalt', 0.45)
    box(m, (0.28, 0.06, 0.22), at=(0, -0.085, -0.04), color=stone, bevel=0 if lo else 0.006, jitter=0.05)  # portal face
    m.prism(arch_outline(0.12, 0.09, 0.05, steps=3 if lo else 6), 0.02, at=(0, -0.116, 0.0), color=dark)
    # Side walls of the stairwell, the steps going down into the dark, and the apron.
    for side in (-1, 1):
        box(m, (0.04, 0.22, 0.12 if lo else 0.115), at=(side * 0.09, -0.21, -0.04), color=stone, bevel=0 if lo else 0.005, jitter=0.05)
    steps = 2 if lo else 5
    for k in range(steps):
        t = k / max(1, steps - 1)
        box(m, (0.14, 0.04 if not lo else 0.08, 0.1 - t * 0.085), at=(0, -0.29 + k * (0.04 if not lo else 0.08), -0.04),
              color=mix('granite', 'basalt', 0.15 + t * 0.75), jitter=0.04)
    box(m, (0.14, 0.03, 0.01), at=(0, -0.125, -0.005), color=dark)
    if lo:
        for side, h in zip((-1, 1), stumps):
            m.cylinder(0.026, 0.024, h, seg=4, at=(side * 0.17, -0.3, -0.03), color='granite')
        return finish(m)
    # Stepped lintel and a carved band over the door.
    box(m, (0.2, 0.03, 0.03), at=(0, -0.122, 0.135), color='granite', jitter=0.04)
    box(m, (0.14, 0.03, 0.03), at=(0, -0.122, 0.165), color='granite', jitter=0.04)
    for side in (-1, 1):
        box(m, (0.03, 0.03, 0.14), at=(side * 0.085, -0.122, -0.005), color='granite', jitter=0.04)
    box(m, (0.04, 0.032, 0.03), at=(0, -0.124, 0.195), rot=(0, 0, 0), color='bone_dark')  # a carved skull boss
    box(m, (0.026, 0.034, 0.01), at=(0, -0.125, 0.205), color=dark)
    box(m, (0.32, 0.08, 0.04), at=(0, -0.345, -0.03), color='granite', bevel=0.004, jitter=0.05)
    # Broken pillars flanking the way down.
    for side, h in zip((-1, 1), stumps):
        col = m.loft([(-0.03, 0.03), (0.01, 0.028), (h, 0.026)], seg=8, at=(side * 0.17, -0.3, 0), color='granite', jitter=0.05,
                     profile=lambda i: 1.0 if i % 2 == 0 else 0.86)
        for v in m.verts_of(col):
            if v.co.z > h - 0.001:
                v.co.z += m.rng.uniform(-0.03, 0.0)
        m.paint_by_height(col, 'moss_dark', 'stone_wall', 0.0, 0.15, jitter=0.06)
    m.cylinder(0.027, 0.027, 0.07, seg=8, at=(0.24, -0.2, 0.02), rot=(math.pi / 2, 0, 0.7), color='granite', jitter=0.06)
    rubble(m, debris, color='granite_dark')
    return finish(m)


@model('cave-1', budget=800, lo=120, ground='rock', size=0.65)
def cave(rng, lo):
    masses = [(0.0, 0.1, 0.0, 0.3, 0.2, 0.25), (-0.2, 0.01, 0.0, 0.15, 0.15, 0.17), (0.21, 0.03, 0.0, 0.16, 0.15, 0.15)]
    masses = [(x + rng.uniform(-0.015, 0.015), y, z, sx * rng.uniform(0.95, 1.05), sy, sz * rng.uniform(0.95, 1.08))
              for x, y, z, sx, sy, sz in masses]
    # Shards stacked on the outcrop; the first is the lip over the mouth.
    shards = [(0.0, -0.06, 0.15, 0.2, 0.09, 0.07, 1.35), (-0.13, 0.08, 0.16, 0.1, 0.09, 0.2, 0.0),
              (0.12, 0.12, 0.14, 0.09, 0.08, 0.17, 0.0), (0.02, 0.17, 0.2, 0.08, 0.07, 0.15, 0.0)]
    shards = [(x, y, z, w, d, h, tip if tip else rng.uniform(-0.25, 0.25)) for x, y, z, w, d, h, tip in shards]
    yaws = [rng.uniform(-0.4, 0.4) for _ in shards]
    boulders = [(-0.14, -0.25, 0.04, 0.7), (0.16, -0.23, 0.032, 0.75), (0.28, -0.11, 0.028, 0.7)]
    debris = scatter_spots(rng, 5, 0.25, 0.36, (0.012, 0.022), arc=(-2.6, -0.4))

    m = Mesh(rng)
    rock = []
    for x, y, z, sx, sy, sz in masses:
        rock += blob(m, 1.0, at=(x, y, z), scale=(sx, sy, sz), subdiv=ICO20 if lo else ICO80, color='granite', jitter=0.1,
                     noise_amount=0.32, flat_bottom=-0.3)
    for (x, y, z, w, d, h, tilt), yaw in zip(shards[:1] if lo else shards, yaws):
        if tilt > 1.0:
            # The lip: a flat slab jutting out over the opening.
            rock += box(m, (w, d * 1.6, h), at=(x, y, z), rot=(0.12, 0, yaw * 0.3), taper=0.15, color='granite',
                        bevel=0 if lo else 0.01, jitter=0.08)
            continue
        rock += m.loft([(z - 0.04, SQ), (z + h * 0.6, SQ * 0.8), (z + h, SQ * 0.3)], seg=4 if lo else 5, at=(x, y, 0),
                       rot=(tilt, tilt * 0.5, yaw), scale=(w, d, 1.0), color='granite', jitter=0.1, wobble=0.15)
    if not lo:
        m.jitter(rock, 0.006)
        m.paint_by_height(rock, 'granite_dark', 'granite_light', -0.02, 0.38, jitter=0.12)
        speckle(m, rock, 'moss_dark', 0.18, test=up(0.75))
    mouth = [(-0.085, -0.02), (0.085, -0.02), (0.08, 0.06), (0.06, 0.12), (0.02, 0.15), (-0.03, 0.145), (-0.07, 0.11), (-0.088, 0.05)]
    m.prism(mouth, 0.05, at=(0, -0.125, 0), color=shade('basalt', 0.35))
    if lo:
        rubble(m, boulders[:1], color='granite')
        return finish(m)
    m.prism([(x * 0.68, z * 0.78) for x, z in mouth], 0.01, at=(0, -0.153, 0.0), color=shade('basalt', 0.15))
    rubble(m, boulders, color='granite')
    rubble(m, debris, color='granite_dark')
    return finish(m)


@model('wizardtower-1', budget=1500, lo=200, ground='grass', size=0.5)
def wizard_tower(rng, lo):
    drift = [(rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012)) for _ in range(3)]
    windows = [(rng.uniform(0, TAU), z) for z in (0.14, 0.24, 0.38, 0.45, 0.58, 0.61)]
    annex_side = rng.choice((-1, 1))

    m = Mesh(rng)
    stone, band, slate = 'stone_wall', 'stone_wall_dark', 'roof_slate'
    seg = 6 if lo else 8
    ph = math.pi / seg
    (ax, ay), (bx, by), (cx, cy) = drift
    # Battered base, two narrower storeys stepping off-centre, an overhanging study and its roof.
    storeys = [((0, 0), [(-0.05, 0.112), (0.06, 0.1), (0.3, 0.092)], stone),
               ((ax, ay), [(0.3, 0.082), (0.5, 0.08)], stone),
               ((ax + bx, ay + by), [(0.5, 0.074), (0.52, 0.09), (0.65, 0.092)], 'plaster_dark')]
    for (dx, dy), rings, color in storeys:
        f = m.loft([(z, r, dx, dy) for z, r in rings], seg=seg, phase=ph, color=color, jitter=0.05)
        if color == stone and not lo:
            m.paint_by_height(f, 'moss_dark', stone, 0.0, 0.2, jitter=0.06)
    tx, ty = ax + bx + cx, ay + by + cy
    if not lo:
        for z, r, (dx, dy) in ((0.3, 0.1, (0, 0)), (0.5, 0.089, (ax, ay)), (0.65, 0.1, (ax + bx, ay + by))):
            m.loft([(z - 0.012, r, dx, dy), (z + 0.006, r, dx, dy)], seg=seg, phase=ph, color=band, jitter=0.05)
        for k in range(seg):  # timber posts on the study
            a = ph + k * TAU / seg
            r = 0.093
            box(m, (0.008, 0.006, 0.13), at=(ax + bx + math.cos(a) * r, ay + by + math.sin(a) * r, 0.52),
                  rot=(0, 0, a + math.pi / 2), color='timber_dark')
    roof = m.loft([(0.65, 0.122, tx, ty), (0.68, 0.104, tx, ty), (0.79, 0.05, tx * 1.4, ty * 1.4), (0.9, 0.0, tx * 2, ty * 2)],
                  seg=seg, phase=ph, color=slate, jitter=0.06, cap_bottom=True)
    m.paint_by_height(roof, slate, 'roof_slate_light', 0.65, 0.9, jitter=0.06)
    fx, fy = tx * 2, ty * 2
    m.cylinder(0.006, 0.004, 0.07, seg=4, at=(fx, fy, 0.88), color='gilt')
    if not lo:
        blob(m, 0.012, at=(fx, fy, 0.93), subdiv=ICO20, color='gilt_hi')
        m.cylinder(0.004, 0.0, 0.035, seg=4, at=(fx, fy, 0.94), color='gilt')
        for a, z in windows:
            dx, dy = (0, 0) if z < 0.3 else (ax, ay) if z < 0.5 else (ax + bx, ay + by)
            r = (0.094 if z < 0.3 else 0.08 if z < 0.5 else 0.092) + 0.003
            box(m, (0.016, 0.01, 0.04), at=(dx + math.cos(a) * r, dy + math.sin(a) * r, z), rot=(0, 0, a + math.pi / 2),
                  color=shade('basalt', 0.6))
    m.prism(arch_outline(0.05, 0.055, 0.025, steps=2 if lo else 4), 0.02, at=(0, -0.105, -0.01), color=shade('basalt', 0.6))
    # A low stone annex with a slate roof and a chimney.
    sx = annex_side * 0.15
    box(m, (0.12, 0.11, 0.12), at=(sx, 0.05, -0.04), color=stone, jitter=0.05)
    m.prism([(-0.075, 0.0), (0.075, 0.0), (0.0, 0.06)], 0.13, at=(sx, 0.05, 0.08), rot=(0, 0, math.pi / 2), color=slate, jitter=0.05)
    if not lo:
        box(m, (0.025, 0.025, 0.1), at=(sx + annex_side * 0.04, 0.08, 0.06), color=band, jitter=0.05)
        box(m, (0.02, 0.008, 0.035), at=(sx, -0.006, 0.0), color=shade('basalt', 0.6))
    return finish(m)


@model('camp-1', budget=800, lo=100, ground='grass', size=0.55)
def camp(rng, lo):
    tents = [((-0.14, 0.08), rng.uniform(-0.5, -0.2)), ((0.14, 0.1), rng.uniform(0.2, 0.5))]
    fire = (rng.uniform(-0.02, 0.03), rng.uniform(-0.13, -0.09))
    logs = [rng.uniform(0, TAU) for _ in range(3)]
    rolls = [((-0.12, -0.12), rng.uniform(0, TAU)), ((0.15, -0.12), rng.uniform(0, TAU))]

    m = Mesh(rng)
    canvas = 'canvas'
    for (x, y), yaw in tents:
        # An A-frame along its yaw, door at the front end.
        f = m.prism([(-0.085, -0.02), (0.085, -0.02), (0.0, 0.115)], 0.17, at=(x, y, 0.0), rot=(0, 0, yaw), color=canvas,
                    jitter=0.06)
        if not lo:
            m.jitter(f, 0.004)
            c, s = math.cos(yaw), math.sin(yaw)
            fx, fy = x + s * 0.086, y - c * 0.086
            m.prism([(-0.04, -0.02), (0.04, -0.02), (0.0, 0.065)], 0.004, at=(fx, fy, 0.0), rot=(0, 0, yaw),
                    color=shade('basalt', 0.6))
            box(m, (0.008, 0.21, 0.008), at=(x, y, 0.108), rot=(0, 0, yaw), color='timber_dark')
    # The captain's pavilion at the back.
    px, py = 0.0, 0.17
    pav = m.loft([(-0.03, 0.095), (0.07, 0.095), (0.085, 0.1), (0.17, 0.0)], seg=6 if lo else 8, at=(px, py, 0), color=canvas,
                 jitter=0.05, phase=math.pi / 8)
    m.paint_where(pav, lambda f: 0.06 < f.calc_center_median().z < 0.09, 'oxblood', jitter=0.05)
    m.cylinder(0.004, 0.003, 0.06, seg=4, at=(px, py, 0.16), color='gilt')
    if lo:
        blob(m, 0.03, at=(fire[0], fire[1], 0.0), scale=(1, 1, 0.5), subdiv=ICO20, color='ember')
        return finish(m)
    box(m, (0.05, 0.012, 0.06), at=(px, py - 0.093, 0.0), color=shade('basalt', 0.6))
    pennant(m, (px + 0.005, py, 0.215), 0.06, 0.035, 0.018, 0.006, thick=0.004, color='oxblood')
    # Fire ring: stones round crossed logs with embers between them.
    fx, fy = fire
    for k in range(8):
        a = k * TAU / 8
        blob(m, 0.012, at=(fx + math.cos(a) * 0.042, fy + math.sin(a) * 0.042, 0.0), scale=(1, 1, 0.7), subdiv=ICO20,
               color='granite', jitter=0.1, noise_amount=0.2)
    for a in logs:
        m.cylinder(0.007, 0.006, 0.06, seg=4, at=(fx - math.cos(a) * 0.03, fy - math.sin(a) * 0.03, 0.008),
                   rot=(math.pi / 2 - 0.25, 0, a - math.pi / 2), color='timber', jitter=0.08)
    blob(m, 0.018, at=(fx, fy, 0.0), scale=(1, 1, 0.5), subdiv=ICO20, color='ember', jitter=0.1)
    blob(m, 0.03, at=(fx, fy, -0.012), scale=(1, 1, 0.25), subdiv=ICO20, color='basalt', jitter=0.1)
    for (x, y), a in rolls:
        box(m, (0.04, 0.085, 0.012), at=(x, y, -0.004), rot=(0, 0, a), color='oxblood_dark', jitter=0.06)
        c, s = math.cos(a), math.sin(a)
        m.cylinder(0.011, 0.011, 0.04, seg=6, at=(x - s * 0.04 - c * 0.02, y + c * 0.04 - s * 0.02, 0.01),
                   rot=(0, math.pi / 2, a), color=canvas, jitter=0.05)
    # Spears stacked in a tripod.
    for k in range(3):
        a = k * TAU / 3 + 0.4
        m.cylinder(0.004, 0.003, 0.2, seg=4, at=(-0.2 + math.cos(a) * 0.03, -0.12 + math.sin(a) * 0.03, -0.01),
                   rot=(0.15 * math.sin(a), -0.15 * math.cos(a), 0), color='timber_dark')
        m.cylinder(0.006, 0.0, 0.025, seg=4, at=(-0.2 + math.cos(a) * 0.002, -0.12 + math.sin(a) * 0.002, 0.185),
                   rot=(0.15 * math.sin(a), -0.15 * math.cos(a), 0), color='iron')
    # Supplies and the company standard.
    box(m, (0.04, 0.035, 0.035), at=(-0.22, -0.02, -0.005), rot=(0, 0, 0.3), color='timber', jitter=0.06)
    box(m, (0.032, 0.03, 0.03), at=(-0.2, 0.02, 0.03), rot=(0, 0, -0.2), color='timber_dark', jitter=0.06)
    m.cylinder(0.005, 0.004, 0.3, seg=4, at=(0.24, -0.02, -0.03), color='timber_dark')
    pennant(m, (0.245, -0.02, 0.255), 0.08, 0.05, 0.022, 0.008, thick=0.004, color='oxblood')
    m.transform(list(m.bm.faces), scale=1.12)
    return finish(m)


@model('temple-1', budget=2000, lo=250, ground='forest', size=0.85)
def jungle_temple(rng, lo):
    vines = [(rng.randrange(5), rng.choice((-1, 0, 1)), rng.uniform(-0.8, 0.8), rng.uniform(0.04, 0.08)) for _ in range(12)]
    clumps = [(rng.randrange(4), rng.choice((-1, 1)), rng.choice((-1, 1)), rng.uniform(0.05, 0.08)) for _ in range(7)]

    m = Mesh(rng)
    stone, dark = 'granite_light', shade('basalt', 0.5)
    tiers = [(0.4, 0.09), (0.33, 0.18), (0.26, 0.27), (0.2, 0.36), (0.15, 0.45)]
    bottom = -0.05
    tier_faces = []
    for k, (hw, top) in enumerate(tiers):
        z0 = bottom if k == 0 else tiers[k - 1][1]
        tier_faces += box(m, (hw * 2, hw * 2, top - z0), at=(0, 0, z0), taper=0.04, color=stone, bevel=0 if lo else 0.006, jitter=0.05)
    m.paint_by_height(tier_faces, 'granite', stone, 0.0, 0.45, jitter=0.06)
    if not lo:
        speckle(m, tier_faces, 'moss', 0.6, test=up(0.6), jitter=0.12)
        speckle(m, tier_faces, 'moss_dark', 0.25, test=lambda f: f.normal.z < 0.3)

    # The stair climbs the front (-Y) from the ground to the top tier.
    front, back, rise = -0.47, -0.15, 0.45
    n = 4 if lo else 12
    run, step = (back - front) / n, rise / n
    outline = [(front, -0.04)]
    for i in range(n):
        outline += [(front + i * run, (i + 1) * step), (front + (i + 1) * run, (i + 1) * step)]
    outline.append((back, -0.04))
    m.prism(outline, 0.13, rot=(0, 0, math.pi / 2), color='stone_wall_dark', jitter=0.04)
    if not lo:
        for side in (-1, 1):
            m.prism([(front, -0.04), (front, 0.06), (back, rise + 0.05), (back, rise - 0.02)], 0.026,
                    at=(side * 0.078, 0, 0), rot=(0, 0, math.pi / 2), color=stone, jitter=0.04)
            # Serpent heads guarding the foot of the stair.
            hx = side * 0.078
            box(m, (0.045, 0.07, 0.045), at=(hx, front - 0.02, -0.01), color=stone, bevel=0.004, jitter=0.05)
            box(m, (0.046, 0.03, 0.012), at=(hx, front - 0.042, 0.005), color=dark)
            box(m, (0.008, 0.008, 0.008), at=(hx + side * 0.019, front - 0.03, 0.025), color='gilt')

    # The shrine on top, with a pierced roof comb.
    top = tiers[-1][1]
    box(m, (0.2, 0.16, 0.1), at=(0, 0.02, top), color=stone, bevel=0 if lo else 0.005, jitter=0.05)
    box(m, (0.06, 0.012, 0.07), at=(0, -0.062, top), color=dark)
    box(m, (0.23, 0.19, 0.022), at=(0, 0.02, top + 0.1), color='stone_wall_dark', jitter=0.05)
    comb = box(m, (0.17, 0.026, 0.1), at=(0, 0.04, top + 0.122), color=stone, jitter=0.05)
    if lo:
        for k, x, y, s in clumps[:3]:
            hw, z = tiers[k][0], tiers[k][1]
            blob(m, s, at=(x * hw * 0.9, y * hw * 0.9, z), scale=(1, 1, 0.6), subdiv=ICO20, color='jungle')
        return finish(m)
    speckle(m, comb, 'moss', 0.4)
    for x in (-0.05, 0.0, 0.05):
        box(m, (0.026, 0.032, 0.035), at=(x, 0.04, top + 0.15), color=dark)
    # Overgrowth: hanging vines and canopy clumps lodged on the terraces.
    for k, face, along, length in vines:
        hw, z = tiers[k]
        if face == 0:
            x, y, yaw = along * hw * 0.8, -hw - 0.003, 0.0
            if abs(x) < 0.1:
                continue
        else:
            x, y, yaw = face * (hw + 0.003), along * hw * 0.8, math.pi / 2
        box(m, (0.012, 0.006, length), at=(x, y, z - length), rot=(0, 0, yaw), color='jungle', jitter=0.1)
    leaf = mix('jungle', 'moss_dark', 0.35)
    for k, sx, sy, size in clumps:
        hw, z = tiers[k][0], tiers[k][1]
        cx, cy = sx * hw * 0.92, sy * hw * 0.92
        for j in range(3):
            a = m.rng.uniform(0, TAU)
            r = size * m.rng.uniform(0.45, 0.65)
            blob(m, r, at=(cx + math.cos(a) * size * 0.45, cy + math.sin(a) * size * 0.45, z + r * 0.15 * j),
                 scale=(1.1, 1.0, 0.65), rot=(0, 0, a), subdiv=ICO20, color='jungle_light' if j == 2 else leaf, jitter=0.15,
                 noise_amount=0.35, flat_bottom=-0.35 * r)
    return finish(m)


# -- the party's banner ------------------------------------------------------------------

@model('banner-1', budget=300, lo=300, ground='grass', size=0.45)
def banner(rng, lo):
    wave = 0.022
    m = Mesh(rng)
    m.loft([(-0.05, 0.06), (0.012, 0.055), (0.024, 0.04), (0.03, 0.03)], seg=8, phase=math.pi / 8, color='stone_wall_dark', jitter=0.05)
    m.cylinder(0.014, 0.011, 0.86, seg=6, at=(0, 0, -0.04), color='timber_dark', jitter=0.04, cap_bottom=False)
    for z, h in ((0.02, 0.035), (0.54, 0.018), (0.785, 0.018)):
        m.cylinder(0.018, 0.018, h, seg=6, at=(0, 0, z), color='gilt', jitter=0.04)
    # Spear-tip finial: a collar and a flat leaf blade.
    m.cylinder(0.016, 0.012, 0.02, seg=6, at=(0, 0, 0.82), color='gilt')
    m.loft([(0.835, 0.012), (0.86, 0.026), (0.94, 0.0)], seg=4, profile=lambda i: 1.0 if i % 2 == 0 else 0.35,
           color='gilt_hi', jitter=0.04)
    box(m, (0.05, 0.008, 0.008), at=(0, 0, 0.838), color='gilt')
    top = 0.795
    pennant(m, (0.012, 0.0, top), 0.34, 0.22, 0.1, wave, thick=0.006, color='oxblood')
    # A gilt lozenge charge on the flat part of the flag, showing on both faces.
    m.prism([(0, -0.045), (0.032, 0), (0, 0.045), (-0.032, 0)], 0.011, at=(0.012 + 0.09, 0.0, top - 0.11), color='gilt')
    m.prism([(0, -0.02), (0.014, 0), (0, 0.02), (-0.014, 0)], 0.013, at=(0.012 + 0.09, 0.0, top - 0.11), color='oxblood_dark')
    return finish(m, ao=0.05, strength=0.3)
