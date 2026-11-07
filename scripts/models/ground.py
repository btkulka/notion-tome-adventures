"""Ground cover and stone: the undergrowth and rocks scattered across every biome.

Rocks are convex hulls of point clouds sliced flat by random planes, so they
read as cleaved stone with hard split faces rather than lumpy blobs. Blades,
fronds and twigs are closed three-sided strands, wound outward, so they hold
up under back-face culling from every camera turn.
"""
import math

import bmesh
from mathutils import Vector

from kit import Mesh, mix, model, shade

GOLDEN = math.pi * (3 - math.sqrt(5))
SINK = -0.04


# -- point clouds -----------------------------------------------------------------

def even(n, turn=0.0):
    """n evenly spread unit directions (a Fibonacci sphere)."""
    out = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0.0, 1 - z * z))
        a = i * GOLDEN + turn
        out.append(Vector((math.cos(a) * r, math.sin(a) * r, z)))
    return out


def shell(rng, n, radii, at=(0, 0, 0), rough=0.1, wobble=0.18):
    """n points spread over an ellipsoid, each pushed in or out a little."""
    rx, ry, rz = radii
    pts = []
    for d in even(n, rng.uniform(0, math.tau)):
        d = (d + Vector((rng.uniform(-wobble, wobble), rng.uniform(-wobble, wobble), rng.uniform(-wobble, wobble)))).normalized()
        k = rng.uniform(1 - rough, 1 + rough)
        pts.append(Vector(at) + Vector((d.x * rx, d.y * ry, d.z * rz)) * k)
    return pts


def cleave(rng, pts, radii, centre, cuts, depth=(0.5, 0.8), lift=(-0.25, 0.9)):
    """Slice the cloud flat against `cuts` random planes; returns their normals."""
    rx, ry, rz = radii
    c = Vector(centre)
    normals = []
    for _ in range(cuts):
        n = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(*lift))).normalized()
        reach = math.sqrt((n.x * rx) ** 2 + (n.y * ry) ** 2 + (n.z * rz) ** 2)
        d = rng.uniform(*depth) * reach
        for i, p in enumerate(pts):
            over = (p - c).dot(n) - d
            if over > 0:
                pts[i] = p - n * over
        normals.append(n)
    return normals


def floor(pts, z=SINK):
    for p in pts:
        if p.z < z:
            p.z = z
    return pts


def subset(pts, k):
    """The outermost points in k even directions: a cheap hull with the same outline."""
    c = sum(pts, Vector()) / len(pts)
    out = []
    for d in even(k):
        best = max(pts, key=lambda p: (p - c).dot(d))
        if all((best - q).length > 1e-6 for q in out):
            out.append(best)
    return out


def turn(pts, angle, pivot=(0, 0, 0), axis='Z'):
    """Rotate points about a pivot (in place)."""
    from mathutils import Matrix
    rot = Matrix.Rotation(angle, 3, axis) if isinstance(axis, str) else Matrix.Rotation(angle, 3, Vector(axis))
    pv = Vector(pivot)
    for i, p in enumerate(pts):
        pts[i] = rot @ (p - pv) + pv
    return pts


# -- geometry ---------------------------------------------------------------------

def hull(m, pts, color, jitter=0.0, flat=5.0):
    """Convex hull of a point cloud; near-coplanar facets merge into single flat faces."""
    bm = m.bm
    verts = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=verts)
    loose = [v for v in verts if v.is_valid and not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    verts = [v for v in verts if v.is_valid]
    faces = list({f for v in verts for f in v.link_faces})
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    if flat:
        edges = list({e for f in faces for e in f.edges})
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(flat), verts=verts, edges=edges)
        verts = [v for v in verts if v.is_valid]
        faces = list({f for v in verts for f in v.link_faces})
    for f in faces:
        f.normal_update()
    return m.paint(faces, color, jitter)


def strand(m, path, widths, color, jitter=0.0, flat=False, ridge=0.35):
    """A three-sided tube along `path` that closes to a point at the last point.

    widths[i] is the half-width at path[i]. Flat strands are leaf ribbons: wide
    sideways with a low midrib ridge on top; the rest are thin spikes. Every
    face is wound away from the strand's axis.
    """
    bm = m.bm
    pts = [Vector(p) for p in path]
    rings, centres = [], []
    for i in range(len(pts) - 1):
        t = (pts[i + 1] - pts[i]).normalized()
        if i > 0:
            t = (t + (pts[i] - pts[i - 1]).normalized()).normalized()
        side = t.cross(Vector((0, 0, 1)))
        if side.length < 1e-5:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(t).normalized()
        w = widths[i]
        if flat:
            ring = [pts[i] + side * w, pts[i] + up * w * ridge, pts[i] - side * w]
        else:
            ring = [pts[i] + (side * math.cos(a) + up * math.sin(a)) * w for a in (math.pi / 2, math.pi / 2 + math.tau / 3, math.pi / 2 + 2 * math.tau / 3)]
        rings.append([bm.verts.new(v) for v in ring])
        centres.append(sum(ring, Vector()) / 3)
    tip = bm.verts.new(pts[-1])
    faces = []

    def add(vs, axis):
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.dot(f.calc_center_median() - axis) < 0:
            f.normal_flip()
        faces.append(f)

    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        axis = (centres[k] + centres[k + 1]) / 2
        for i in range(3):
            j = (i + 1) % 3
            add((lo[i], lo[j], hi[j], hi[i]), axis)
    axis = (centres[-1] + pts[-1]) / 2
    last = rings[-1]
    for i in range(3):
        add((last[i], last[(i + 1) % 3], tip), axis)
    return m.paint(faces, color, jitter)


def drape(m, faces, top, lip, thick=0.012, drip=0.016, test=lambda f: f.normal.z > 0.5, patchy=0.0, jitter=0.08):
    """Lay a mat (moss, snow) over the upward faces: the region is lifted with a
    lip around it, and some edge corners hang lower so the edge looks irregular.
    `patchy` leaves that share of the qualifying faces bare."""
    region = [f for f in faces if f.is_valid and test(f) and m.rng.random() >= patchy]
    if not region:
        return [], []
    res = bmesh.ops.extrude_face_region(m.bm, geom=region)
    new_verts = {g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)}
    cap = [g for g in res['geom'] if isinstance(g, bmesh.types.BMFace) and all(v in new_verts for v in g.verts)]
    cap_set = set(cap)
    sides = list({f for v in new_verts for f in v.link_faces} - cap_set)
    for v in new_verts:
        n = Vector()
        for f in v.link_faces:
            if f in cap_set:
                n += f.normal
        n = n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))
        v.co += n * thick
    edge = {v for f in sides for v in f.verts if v in new_verts}
    for v in edge:
        if m.rng.random() < 0.5:
            out = Vector((v.co.x, v.co.y, 0))
            out = out.normalized() if out.length > 1e-6 else Vector()
            v.co += out * drip * 0.4 - Vector((0, 0, drip * m.rng.uniform(0.4, 1.0)))
    for f in cap + sides:
        f.normal_update()
    m.paint(cap, top, jitter)
    m.paint(sides, lip, jitter * 0.7)
    return cap, sides


def weather(m, faces, side, top, breaks=(), fresh=None, under=None, jitter=0.1, top_at=0.6):
    """Stone colouring: sides, lit tops, paler fresh split faces, dark undersides."""
    m.paint(faces, side, jitter)
    m.paint_where(faces, lambda f: f.normal.z > top_at, top, jitter)
    if fresh:
        for n in breaks:
            m.paint_where(faces, lambda f, n=n: f.normal.dot(n) > 0.97, fresh, jitter * 0.5)
    if under:
        m.paint_where(faces, lambda f: f.normal.z < -0.3, under, jitter * 0.5)
    return faces


def lichen(m, faces, colors, share=0.45, top_at=0.55, avoid=()):
    """Speckle some upward faces with lichen, never the fresh split faces."""
    for f in faces:
        if f.normal.z > top_at and m.rng.random() < share and all(f.normal.dot(n) <= 0.97 for n in avoid):
            m.paint([f], colors[m.rng.randrange(len(colors))], 0.08)




# -- shrubs -----------------------------------------------------------------------

def spire(rng, cx, cy, r, top, lean):
    """Points for a flame-shaped juniper spire."""
    lx, ly = lean
    pts = []
    for zf, k, n in ((0.08, 1.0, 5), (0.42, 0.85, 4), (0.72, 0.45, 3)):
        spin = rng.uniform(0, math.tau)
        for i in range(n):
            a = spin + i * math.tau / n
            rr = r * k * rng.uniform(0.85, 1.1)
            pts.append(Vector((cx + lx * zf + math.cos(a) * rr, cy + ly * zf + math.sin(a) * rr, top * zf)))
    pts.append(Vector((cx + lx, cy + ly, top)))
    return pts


def shrub(rng, lo, kind):
    """Faceted bushes: a broadleaf mound, flame-shaped juniper, flowering gorse."""
    clouds = []
    if kind == 'juniper':
        h, w = rng.uniform(0.13, 0.15), rng.uniform(0.12, 0.14)
        spin = rng.uniform(0, math.tau)
        for k in range(3):
            a = spin + k * math.tau / 3 + rng.uniform(-0.3, 0.3)
            d = 0.0 if k == 0 else w * rng.uniform(0.24, 0.3)
            top = h * (1.0 if k == 0 else rng.uniform(0.55, 0.72))
            r = w * (0.24 if k == 0 else rng.uniform(0.17, 0.2))
            lean = (math.cos(a) * 0.015 * (k > 0), math.sin(a) * 0.015 * (k > 0))
            clouds.append(floor(spire(rng, math.cos(a) * d, math.sin(a) * d, r, top, lean), -0.03))
        clouds.append(floor(shell(rng, 8, (w * 0.42, w * 0.38, h * 0.18), at=(0, 0, h * 0.08), rough=0.12), -0.03))
        low, high = 'fir', mix('fir_light', 'moss', 0.25)
    else:
        count = 5
        if kind == 'gorse':
            h, w = rng.uniform(0.075, 0.09), rng.uniform(0.18, 0.2)
            low, high = 'moss_dark', 'moss'
        else:
            h, w = rng.uniform(0.11, 0.13), rng.uniform(0.17, 0.19)
            low, high = shade('oak', 0.85), mix('oak_light', 'moss', 0.2)
        for k in range(count):
            a = rng.uniform(0, math.tau)
            d = 0.0 if k == 0 else rng.uniform(0.42, 0.62) * w / 2
            cx, cy = math.cos(a) * d, math.sin(a) * d
            r = w * (0.32 if k == 0 else rng.uniform(0.18, 0.26))
            rz = h * (0.5 if k == 0 else rng.uniform(0.28, 0.4))
            z = h - rz if k == 0 else rz * rng.uniform(0.75, 1.05)
            clouds.append(floor(shell(rng, 9, (r, r * rng.uniform(0.85, 1.1), rz), at=(cx, cy, z), rough=0.14), -0.03))
    blooms = [rng.random() < 0.45 for _ in range(80)]

    m = Mesh(rng)
    if lo:
        faces = hull(m, subset([p for c in clouds for p in c], 10), low, flat=3)
    else:
        faces = []
        for c in clouds:
            faces += hull(m, c, low, flat=3)
    m.paint_by_height(faces, low, high, 0.0, h, jitter=0.12)
    m.paint_where(faces, lambda f: f.normal.z < -0.2, shade(low, 0.6), 0.05)
    if kind == 'gorse':
        tops = [f for f in faces if f.normal.z > 0.3]
        for f, on in zip(tops, blooms):
            if on:
                m.paint([f], mix('dry_leaf', 'gilt', 0.45), 0.12)
    m.ground_ao(0.05, 0.4)
    return m


# -- scrub ------------------------------------------------------------------------

def tussock(rng, lo):
    """Spinifex-like spiky dry grass, fanning out from a tight crown."""
    h = rng.uniform(0.075, 0.095)
    long_spikes, short_spikes = [], []
    for i in range(6):
        a = i * math.tau / 6 + rng.uniform(-0.35, 0.35)
        tilt = rng.uniform(0.45, 0.85)
        length = h * rng.uniform(1.0, 1.3)
        base = Vector((math.cos(a) * 0.01, math.sin(a) * 0.01, SINK))
        out = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        mid = base + out * length * 0.55 + Vector((0, 0, 0.02))
        tip = mid + (out * 0.55 + Vector((math.cos(a), math.sin(a), -0.35)) * 0.25).normalized() * length * 0.5
        long_spikes.append(([base, mid, tip], [0.007, 0.004], rng.uniform(0, 1)))
    for i in range(8):
        a = i * GOLDEN * 2 + rng.uniform(-0.3, 0.3)
        tilt = rng.uniform(0.05, 0.5)
        length = h * rng.uniform(0.8, 1.05) + 0.04
        base = Vector((math.cos(a) * 0.006, math.sin(a) * 0.006, SINK))
        tip = base + Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt))) * length
        short_spikes.append(([base, tip], [0.006], rng.uniform(0, 1)))

    m = Mesh(rng)
    parts = (short_spikes[::2] + long_spikes[:1]) if lo else (short_spikes + long_spikes)
    for path, widths, t in parts:
        if lo:
            path, widths = [path[0], path[-1]], widths[:1]
        faces = strand(m, path, widths, mix('dry_leaf', 'dry_grass', t))
        m.paint_by_height(faces, mix('dry_leaf', 'dry_grass', t * 0.5), mix('dry_grass', 'bone_dark', 0.25 + t * 0.3), 0.0, h, jitter=0.1)
    m.ground_ao(0.04, 0.45)
    return m


def brush(rng, lo):
    """Twiggy dead desert brush: crooked pale twigs from one root, forking, with a little dry leaf."""
    h = rng.uniform(0.075, 0.095)
    spin = rng.uniform(0, math.tau)
    twigs = []
    for i in range(6):
        a = spin + i * math.tau / 6 + rng.uniform(-0.3, 0.3)
        tilt = rng.uniform(0.25, 0.65)
        out = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        base = Vector((math.cos(a) * 0.005, math.sin(a) * 0.005, SINK))
        length = h * rng.uniform(0.75, 1.1) + 0.04
        kink = Vector((rng.uniform(-0.012, 0.012), rng.uniform(-0.012, 0.012), 0))
        mid = base + out * length * 0.55 + kink
        tip = mid + (out + Vector((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), 0.1))).normalized() * length * 0.45
        fork = None
        if i % 3 != 2:
            fa = a + rng.choice((-1, 1)) * rng.uniform(0.7, 1.2)
            fork = mid + Vector((math.cos(fa) * 0.7, math.sin(fa) * 0.7, 0.7)).normalized() * length * rng.uniform(0.3, 0.4)
        twigs.append((base, mid, tip, fork))
    tufts = [shell(rng, 5, (0.012, 0.012, 0.008), at=twigs[k][2].lerp(twigs[k][1], 0.2), rough=0.2) for k in (0, 3)]

    m = Mesh(rng)
    for k, (base, mid, tip, fork) in enumerate(twigs):
        if lo:
            if k < 5:
                strand(m, [base, tip], [0.006], 'bark_pale', 0.1)
            continue
        strand(m, [base, mid, tip], [0.005, 0.0032], mix('bark_pale', 'bark_grey', (k % 3) * 0.35), 0.12)
        if fork is not None:
            strand(m, [mid, fork], [0.0028], 'bark_grey', 0.1)
    if not lo:
        for tuft in tufts:
            hull(m, tuft, mix('dry_leaf', 'dry_grass', 0.35), 0.12, flat=0)
    m.ground_ao(0.04, 0.45)
    return m


# -- reeds ------------------------------------------------------------------------

def reeds(rng, lo, cattails):
    h = rng.uniform(0.15, 0.2)
    blades = []
    for i in range(7 if cattails else 12):
        a = rng.uniform(0, math.tau)
        d = rng.uniform(0.0, 0.035)
        x, y = math.cos(a) * d, math.sin(a) * d
        lean = rng.uniform(0, math.tau)
        bh = h * rng.uniform(0.6, 1.0)
        reach = bh * rng.uniform(0.12, 0.35)
        broken = rng.random() < 0.2
        lx, ly = math.cos(lean), math.sin(lean)
        base = Vector((x, y, SINK))
        mid = Vector((x + lx * reach * 0.3, y + ly * reach * 0.3, bh * 0.55))
        if broken:
            tip = Vector((x + lx * (reach + bh * 0.35), y + ly * (reach + bh * 0.35), bh * 0.35))
        else:
            tip = Vector((x + lx * reach, y + ly * reach, bh))
        blades.append(([base, mid, tip], [rng.uniform(0.005, 0.007), 0.0035], rng.uniform(0, 1)))
    heads = []
    if cattails:
        for i in range(3):
            a = i * math.tau / 3 + rng.uniform(-0.5, 0.5)
            d = rng.uniform(0.008, 0.03)
            heads.append((math.cos(a) * d, math.sin(a) * d, h * rng.uniform(0.95, 1.15), rng.uniform(0.032, 0.042)))

    m = Mesh(rng)
    for k, (path, widths, t) in enumerate(blades):
        if lo and k % 2:
            continue
        if lo:
            path, widths = [path[0], path[-1]], widths[:1]
        faces = strand(m, path, widths, 'reed')
        m.paint_by_height(faces, mix('reed', 'moss_dark', 0.5 - t * 0.3), mix('reed', 'dry_grass', 0.3 + t * 0.6), 0.0, h, jitter=0.1)
    for k, (x, y, top, length) in enumerate(heads):
        if lo and k:
            continue
        strand(m, [(x, y, SINK), (x, y, top - length * 0.5)], [0.0025], 'reed', 0.1)
        if lo:
            strand(m, [(x, y, top - length), (x, y, top + 0.012)], [0.008], 'timber', 0.05)
        else:
            m.loft([(top - length, 0.0075, x, y), (top, 0.0085, x, y), (top + 0.022, 0, x, y)], seg=4,
                   phase=rng.uniform(0, math.tau), color='timber', jitter=0.08)
    m.ground_ao(0.05, 0.45)
    return m


# -- ferns and undergrowth ---------------------------------------------------------

def fern(rng, lo, broad):
    """Fronds rising from a crown and arching outward; `broad` makes jungle leaves on stems."""
    n = 5 if broad else 7
    reach = rng.uniform(0.11, 0.13) if broad else rng.uniform(0.1, 0.125)
    h = rng.uniform(0.1, 0.12) if broad else rng.uniform(0.08, 0.1)
    spin = rng.uniform(0, math.tau)
    fronds = []
    for i in range(n):
        a = spin + i * math.tau / n + rng.uniform(-0.25, 0.25)
        upright = i == 0 or (not broad and i == 3)
        r = reach * (rng.uniform(0.55, 0.65) if upright else rng.uniform(0.82, 1.08))
        top = h * (rng.uniform(1.0, 1.1) if upright else rng.uniform(0.75, 1.0))
        droop = rng.uniform(0.35, 0.6)
        fronds.append((a, r, top, droop, rng.uniform(0, 1)))

    m = Mesh(rng)
    for k, (a, r, top, droop, t) in enumerate(fronds):
        if lo and k >= 5:
            continue
        ca, sa = math.cos(a), math.sin(a)
        at = lambda dist, z: (ca * dist, sa * dist, z)  # noqa: E731
        if lo:
            path = [at(r * 0.12, top * 0.45), at(r * 0.95, top * droop * 0.7)]
            widths = [0.026 if broad else 0.014]
        elif broad:
            path = [at(0.0, -0.01), at(r * 0.22, top * 0.8), at(r * 0.45, top), at(r * 0.75, top * 0.85), at(r, top * droop)]
            widths = [0.003, 0.0035, 0.03, 0.034]
        else:
            path = [at(0.0, -0.01), at(r * 0.38, top), at(r * 0.72, top * 0.82), at(r, top * droop * 0.75)]
            widths = [0.004, 0.0135, 0.011]
        low, high = (('jungle', 'jungle_light') if broad else ('oak_mid', mix('oak_light', 'moss', 0.35)))
        faces = strand(m, path, widths, mix(low, high, t * 0.5), flat=True, ridge=0.3)
        m.paint_by_height(faces, low, mix(low, high, 0.5 + t * 0.5), 0.0, top, jitter=0.12)
        m.paint_where(faces, lambda f: f.normal.z < -0.15, shade(low, 0.55), 0.05)
    m.ground_ao(0.04, 0.4)
    return m


# -- boulders ---------------------------------------------------------------------

STONE_TOP = mix('granite', 'granite_light', 0.45)
FRESH = mix('granite_light', 'sandstone_light', 0.2)
LICHEN = (mix('moss', 'granite_light', 0.35), mix('gilt', 'granite_light', 0.45), mix('moss_dark', 'granite', 0.4))


def boulder(rng, lo, form):
    rocks = []  # (points, cleave normals, outline points for far zoom)
    if form == 'single':
        radii = (rng.uniform(0.095, 0.105), rng.uniform(0.08, 0.09), rng.uniform(0.06, 0.07))
        c = (0, 0, radii[2] * 0.75)
        pts = shell(rng, 18, radii, at=c, rough=0.1)
        cuts = cleave(rng, pts, radii, c, 4, depth=(0.35, 0.6), lift=(-0.2, 0.8))
        rocks.append((floor(pts), cuts, 9))
    elif form == 'split':
        radii = (rng.uniform(0.105, 0.115), rng.uniform(0.09, 0.1), rng.uniform(0.075, 0.085))
        c = Vector((0, 0, radii[2] * 0.7))
        pts = shell(rng, 22, radii, at=c, rough=0.1)
        cuts = cleave(rng, pts, radii, c, 2, depth=(0.4, 0.65), lift=(0.2, 0.9))
        a = math.pi / 4 + rng.uniform(-0.5, 0.5)  # the crack runs toward the default camera
        split = Vector((math.cos(a), math.sin(a), 0))
        gap = 0.006
        tilt = rng.uniform(0.1, 0.16)
        for sign in (1, -1):
            half = []
            for p in pts:
                over = sign * (p - c).dot(split) + gap
                half.append(p - split * sign * over if over > 0 else p.copy())
            pivot = c - split * sign * gap
            pivot.z = 0
            turn(half, sign * tilt, pivot=pivot, axis=split.cross(Vector((0, 0, 1))))
            rocks.append((floor(half), cuts + [split, -split], 7))
    else:
        radii = (rng.uniform(0.08, 0.09), rng.uniform(0.07, 0.08), rng.uniform(0.06, 0.07))
        c = (0, 0, radii[2] * 0.75)
        pts = shell(rng, 18, radii, at=c, rough=0.1)
        rocks.append((floor(pts), cleave(rng, pts, radii, c, 3, depth=(0.35, 0.6)), 8))
        a = rng.uniform(0, math.tau)
        for k in range(2):
            a += rng.uniform(1.6, 2.6) if k else 0.0
            d = rng.uniform(0.1, 0.12)
            fr = (rng.uniform(0.032, 0.042), rng.uniform(0.026, 0.034), rng.uniform(0.022, 0.03))
            fc = (math.cos(a) * d, math.sin(a) * d, fr[2] * 0.6)
            fp = shell(rng, 10, fr, at=fc, rough=0.1)
            rocks.append((floor(fp), cleave(rng, fp, fr, fc, 2, depth=(0.35, 0.6)), 5))

    m = Mesh(rng)
    for k, (pts, cuts, outline) in enumerate(rocks):
        if lo and form == 'cluster' and k == 2:
            continue
        faces = hull(m, subset(pts, outline) if lo else pts, 'granite', flat=6)
        weather(m, faces, mix('granite', 'granite_dark', 0.25), STONE_TOP, cuts, FRESH, 'granite_dark', jitter=0.12, top_at=0.55)
        if not lo:
            lichen(m, faces, LICHEN, share=0.55, top_at=0.45, avoid=cuts)
    m.ground_ao(0.06, 0.5)
    return m


def mossrock(rng, lo, slab):
    rocks = []
    sprigs = []
    if slab:
        radii = (rng.uniform(0.11, 0.12), rng.uniform(0.08, 0.09), rng.uniform(0.045, 0.055))
        c = (0, 0, radii[2] * 0.75)
        pts = shell(rng, 20, radii, at=c, rough=0.07)
        cuts = cleave(rng, pts, radii, c, 2, depth=(0.5, 0.75), lift=(0.5, 1.0))
        rocks.append((floor(pts), cuts, 8, True))
        a = rng.uniform(0, math.tau)
        sr = (0.05, 0.042, 0.06)
        sc = Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, 0.045))
        sp = shell(rng, 12, sr, at=sc, rough=0.1)
        turn(sp, 0.3, pivot=sc - Vector((0, 0, 0.045)), axis=Vector((-math.sin(a), math.cos(a), 0)))
        rocks.append((floor(sp), cleave(rng, sp, sr, sc, 2, depth=(0.4, 0.65)), 6, False))
        for i in range(3):
            b = rng.uniform(0, math.tau)
            base = Vector((math.cos(b) * 0.05, math.sin(b) * 0.04, 0.05))
            sprigs.append(([base, base + Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), rng.uniform(0.045, 0.06)))], [0.004]))
    else:
        radii = (rng.uniform(0.09, 0.1), rng.uniform(0.08, 0.09), rng.uniform(0.075, 0.085))
        c = (0, 0, radii[2] * 0.6)
        pts = shell(rng, 24, radii, at=c, rough=0.08)
        cuts = cleave(rng, pts, radii, c, 1, depth=(0.6, 0.8))
        rocks.append((floor(pts), cuts, 9, True))
    moss_light = [rng.random() < 0.35 for _ in range(60)]

    m = Mesh(rng)
    side = mix('granite_dark', 'granite', 0.35)
    for pts, cuts, outline, mossy in rocks:
        faces = hull(m, subset(pts, outline) if lo else pts, side, flat=6)
        weather(m, faces, side, 'granite', cuts, mix('granite', 'granite_light', 0.5), 'basalt', jitter=0.12, top_at=0.65)
        if lo:
            m.paint_where(faces, lambda f: f.normal.z > 0.4, mix('moss_dark', 'fir_mid', 0.25), 0.1)
        elif mossy:
            cap, _ = drape(m, faces, mix('moss_dark', 'fir_mid', 0.25), shade('moss_dark', 0.75), thick=0.007, drip=0.014,
                           test=lambda f: f.normal.z > 0.42, jitter=0.14)
            for f, on in zip(cap, moss_light):
                if on and f.normal.z > 0.5:
                    m.paint([f], mix('moss_dark', 'moss', 0.7), 0.1)
        else:
            lichen(m, faces, (mix('granite', 'moss', 0.5),), share=0.5)
    if not lo:
        for path, widths in sprigs:
            strand(m, path, widths, mix('oak_mid', 'moss', 0.4), 0.1)
    m.ground_ao(0.06, 0.45)
    return m


# -- mountain crags -----------------------------------------------------------------

def shard(rng, h, rb, at, lean):
    """A tilted rock blade: rings narrowing to a broken, slanted summit, split down one side."""
    x, y = at
    lx, ly = lean
    stretch = rng.uniform(0.65, 0.85)
    spin = rng.uniform(0, math.tau)
    pts = []
    for zf, k, n in ((None, 1.0, 6), (0.5, 0.75, 5), (0.8, 0.5, 4)):
        zz = SINK if zf is None else h * zf
        f = max(0.0, zz) / h
        for i in range(n):
            a = spin + i * math.tau / n + rng.uniform(-0.3, 0.3)
            r = rb * k * rng.uniform(0.85, 1.1)
            pts.append(Vector((x + lx * f * h + math.cos(a) * r, y + ly * f * h + math.sin(a) * r * stretch, zz)))
    for i in range(3):
        a = spin + i * math.tau / 3 + rng.uniform(-0.4, 0.4)
        r = rb * 0.28 * rng.uniform(0.6, 1.2)
        pts.append(Vector((x + lx * h + math.cos(a) * r, y + ly * h + math.sin(a) * r * stretch, h * (1.0 - 0.08 * i))))
    radii = (rb, rb * stretch, h / 2)
    cuts = cleave(rng, pts, radii, (x + lx * h / 2, y + ly * h / 2, h / 2), 1, depth=(0.5, 0.7), lift=(-0.1, 0.3))
    summit = Vector((x + lx * h * 0.88, y + ly * h * 0.88, h * 0.88))
    n = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(1.2, 2.5))).normalized()
    for i, p in enumerate(pts):
        over = (p - summit).dot(n)
        if over > 0:
            pts[i] = p - n * over
    return floor(pts), cuts + [n]


CRAGS = {
    # (height range, base radius range) per shard; the first is the main one
    1: [((0.38, 0.42), (0.09, 0.1)), ((0.26, 0.3), (0.07, 0.08)), ((0.16, 0.2), (0.06, 0.07))],
    2: [((0.42, 0.45), (0.085, 0.095)), ((0.3, 0.34), (0.07, 0.08)), ((0.22, 0.26), (0.06, 0.07)), ((0.12, 0.15), (0.05, 0.055))],
    3: [((0.32, 0.36), (0.1, 0.11)), ((0.28, 0.31), (0.095, 0.1))],
}
CRAG_SIDES = ('granite_dark', mix('granite_dark', 'slate', 0.35), mix('granite', 'granite_dark', 0.4), mix('granite_dark', 'slate', 0.2))


def crag(rng, lo, form):
    shards = []
    spin = rng.uniform(0, math.tau)
    sizes = CRAGS[form]
    for k, (hr, rr) in enumerate(sizes):
        h, rb = rng.uniform(*hr), rng.uniform(*rr)
        a = spin + k * math.tau / len(sizes) + rng.uniform(-0.4, 0.4)
        d = 0.0 if k == 0 else rng.uniform(0.08, 0.11) + (0.02 if form == 3 else 0.0)
        lean_dir = a if k else rng.uniform(0, math.tau)
        lean = (math.cos(lean_dir) * rng.uniform(0.06, 0.18), math.sin(lean_dir) * rng.uniform(0.06, 0.18))
        shards.append(shard(rng, h, rb, (math.cos(a) * d, math.sin(a) * d), lean))
    br = (0.16, 0.13, 0.05)
    base = shell(rng, 14, br, at=(0, 0, 0.0), rough=0.1)
    base_cuts = cleave(rng, base, br, (0, 0, 0), 2, depth=(0.4, 0.6), lift=(0.6, 1.0))
    rubble = []
    if form == 3:
        for k in range(2):
            a = spin + math.pi + rng.uniform(-0.8, 0.8)
            d = rng.uniform(0.15, 0.18)
            rr = (rng.uniform(0.03, 0.04), rng.uniform(0.025, 0.035), rng.uniform(0.022, 0.03))
            rc = (math.cos(a) * d, math.sin(a) * d, rr[2] * 0.6)
            rp = shell(rng, 9, rr, at=rc)
            rubble.append((floor(rp), cleave(rng, rp, rr, rc, 2, depth=(0.35, 0.6))))

    m = Mesh(rng)
    for k, (pts, cuts) in enumerate(shards):
        if lo and k >= 3:
            continue
        side = CRAG_SIDES[k % len(CRAG_SIDES)]
        faces = hull(m, subset(pts, 7) if lo else pts, side, flat=5)
        weather(m, faces, side, 'granite_light', cuts, mix('granite_light', 'granite', 0.3), 'basalt', jitter=0.1, top_at=0.55)
        m.paint_where(faces, lambda f: 0.2 < f.normal.z <= 0.55, mix(side, 'granite_light', 0.35), 0.1)
    faces = hull(m, subset(floor(base), 6) if lo else floor(base), 'granite_dark', flat=6)
    weather(m, faces, 'granite_dark', mix('granite', 'granite_light', 0.4), base_cuts, None, 'basalt', jitter=0.12, top_at=0.5)
    if not lo:
        for pts, cuts in rubble:
            faces = hull(m, pts, 'granite_dark', flat=6)
            weather(m, faces, 'granite_dark', 'granite', cuts, 'granite_light', 'basalt')
    m.ground_ao(0.08, 0.45)
    return m


# -- desert hoodoos -----------------------------------------------------------------

STRATA = ('sandstone_dark', 'sandstone', 'sandstone_light', 'sandstone', mix('sandstone_light', 'bone', 0.3), 'sandstone', 'sandstone_light')
CAPROCK = mix('sandstone_dark', 'basalt', 0.3)


def column_plan(rng, height, base, seg, blocks, at=(0, 0)):
    """An eroded spire: a wide foot, then uneven blocks alternating necks and bulges, then a caprock."""
    weights = [rng.uniform(0.7, 1.3) for _ in range(blocks)]
    total = sum(weights)
    neck_top = height * 0.86
    rings = [(SINK, base * 1.15)]
    z = 0.0
    for k in range(blocks):
        z += neck_top * weights[k] / total
        neck = k % 2 == 0
        r = base * (1.0 - 0.4 * (k + 1) / blocks) * (rng.uniform(0.68, 0.8) if neck else rng.uniform(0.95, 1.08))
        rings.append((z, r))
    rings[-1] = (rings[-1][0], base * rng.uniform(0.42, 0.5))
    rings = [(z, r, rng.uniform(-0.008, 0.008), rng.uniform(-0.008, 0.008), rng.uniform(0, math.tau)) for z, r in rings]
    cr = base * rng.uniform(0.95, 1.15)
    x, y = at
    cc = (x + rings[-1][2], y + rings[-1][3], neck_top + 0.024)
    cap = shell(rng, 12, (cr, cr * 0.85, 0.032), at=cc, rough=0.1)
    cap_cuts = cleave(rng, cap, (cr, cr * 0.85, 0.032), cc, 2, depth=(0.4, 0.6), lift=(0.6, 1.0))
    tilt = rng.uniform(-0.18, 0.18)
    turn(cap, tilt, pivot=cc, axis=Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized())
    return {'at': at, 'rings': rings, 'cap': cap, 'cap_cuts': cap_cuts, 'seg': seg}


def ring_points(z, r, dx, dy, phase, seg, at, wob):
    x, y = at
    return [Vector((x + dx + math.cos(phase + i * math.tau / seg) * r * wob[i % len(wob)],
                    y + dy + math.sin(phase + i * math.tau / seg) * r * wob[(i + 2) % len(wob)], z)) for i in range(seg)]


def hoodoo(rng, lo, twin):
    if twin:
        a = rng.uniform(0, math.tau)
        plans = [column_plan(rng, rng.uniform(0.38, 0.42), 0.062, 5, 5, at=(math.cos(a) * 0.055, math.sin(a) * 0.055)),
                 column_plan(rng, rng.uniform(0.27, 0.31), 0.055, 5, 4, at=(-math.cos(a) * 0.06, -math.sin(a) * 0.06))]
    else:
        plans = [column_plan(rng, rng.uniform(0.44, 0.5), 0.075, 6, 7)]
    wob = [rng.uniform(0.85, 1.12) for _ in range(7)]
    rubble = []
    if not twin:
        for k in range(2):
            b = rng.uniform(0, math.tau)
            rr = (rng.uniform(0.028, 0.036), rng.uniform(0.024, 0.03), rng.uniform(0.018, 0.024))
            rc = (math.cos(b) * 0.12, math.sin(b) * 0.12, rr[2] * 0.6)
            rp = shell(rng, 8, rr, at=rc)
            rubble.append((floor(rp), cleave(rng, rp, rr, rc, 1)))
    foot = None
    if twin:
        fr = (0.13, 0.09, 0.05)
        foot = shell(rng, 12, fr, at=(0, 0, 0.0), rough=0.08)
        turn(foot, a, axis='Z')
        floor(foot)

    m = Mesh(rng)
    for k, plan in enumerate(plans):
        x, y = plan['at']
        rings = plan['rings']
        if lo:
            z0, r0 = rings[0][0], rings[0][1]
            zt, rt = rings[-1][0], rings[-1][1]
            zm, rm = rings[len(rings) // 2][0], rings[len(rings) // 2][1]
            zt += 0.022  # reach up into the caprock
            shape = [(z0, r0, x, y), (zm, rm, x, y), (zt, rt, x, y)] if k == 0 else [(z0, r0, x, y), (zt, rt, x, y)]
            faces = m.loft(shape, seg=4, phase=rings[0][4], color='sandstone', cap_bottom=False)
            m.paint_by_height(faces, 'sandstone_dark', 'sandstone_light', 0, zt, 0.08)
        else:
            for j in range(len(rings) - 1):
                lo_ring = ring_points(*rings[j][:4], rings[j][4], plan['seg'], (x, y), wob)
                hi_ring = ring_points(*rings[j + 1][:4], rings[j][4] + 0.25, plan['seg'], (x, y), wob)
                band = STRATA[j % len(STRATA)]
                faces = hull(m, lo_ring + hi_ring, band, 0.07, flat=3)
                m.paint_where(faces, lambda f: f.normal.z > 0.6, shade(band, 1.08), 0.05)
        cap = hull(m, subset(plan['cap'], 6) if lo else plan['cap'], CAPROCK, 0.08, flat=4)
        m.paint_where(cap, lambda f: f.normal.z > 0.6, mix('sandstone_dark', 'granite', 0.4), 0.06)
        m.paint_where(cap, lambda f: f.normal.z < -0.3, shade(CAPROCK, 0.7), 0.05)
    if foot is not None and not lo:
        faces = hull(m, foot, 'sandstone_dark', 0.08, flat=5)
        m.paint_where(faces, lambda f: f.normal.z > 0.5, 'sandstone', 0.08)
    if not lo:
        for pts, cuts in rubble:
            faces = hull(m, pts, 'sandstone', flat=5)
            weather(m, faces, 'sandstone_dark', 'sandstone_light', cuts, 'sandstone_light', None, 0.08)
    m.ground_ao(0.07, 0.4)
    return m


# -- sea stacks -------------------------------------------------------------------

TIDE = 0.032
TIDE_LINE = mix('bone_dark', 'granite_light', 0.4)


def basalt_segment(m, r, z0, z1, at, phase, slope, slope_dir, side, seg=6, tide=False, lie=None):
    """One joint of a basalt column (a hex prism) with a slanted top; the lowest joint
    carries the pale salt line just above the sand."""
    x, y = at
    if lie is not None:
        faces = m.loft([(0.0, r), (z1 - z0, r)], seg=seg, phase=phase, at=(x, y, r * 0.86), rot=(math.pi / 2, 0, lie),
                       color=side, jitter=0.1)
    else:
        rings = [(z0, r, x, y), (TIDE, r, x, y), (z1, r, x, y)] if tide else [(z0, r, x, y), (z1, r, x, y)]
        faces = m.loft(rings, seg=seg, phase=phase, color=side, jitter=0.15, cap_bottom=False, wobble=0.05)
        for v in m.verts_of(faces):
            if v.co.z > z1 - 1e-6:
                v.co.z += slope * ((v.co.x - x) * math.cos(slope_dir) + (v.co.y - y) * math.sin(slope_dir))
        for f in faces:
            f.normal_update()
        if tide:
            m.paint_where(faces, lambda f: f.calc_center_median().z < TIDE * 0.5 and abs(f.normal.z) < 0.5, TIDE_LINE, 0.1)
    m.paint_where(faces, lambda f: f.normal.z > 0.6, mix(side, 'granite', 0.45), 0.08)
    if lie is None and not tide:
        m.paint_where(faces, lambda f: abs(f.normal.z) < 0.5 and m.rng.random() < 0.12, mix('gilt', 'basalt', 0.6), 0.08)
    return faces


def column_joints(rng, r, h, at, joints, top_slope):
    """Joint heights and offsets for one column: each joint shifts and turns a little."""
    out = []
    z = SINK
    for k in range(joints):
        z1 = h if k == joints - 1 else h * (k + 1) / joints * rng.uniform(0.9, 1.05)
        dx, dy = rng.uniform(-0.004, 0.004) * k, rng.uniform(-0.004, 0.004) * k
        slope = top_slope if k == joints - 1 else rng.uniform(0.0, 0.08)
        out.append((r * rng.uniform(0.96, 1.0), z - (0.004 if k else 0.0), z1, (at[0] + dx, at[1] + dy),
                    rng.uniform(-0.15, 0.15), slope, rng.uniform(0, math.tau), k == 0))
        z = z1
    return out


def searock(rng, lo, stack):
    spin = rng.uniform(0, math.tau)
    cols = []
    if stack:
        r = 0.05
        for k, (hr, joints) in enumerate((((0.28, 0.31), 2), ((0.22, 0.25), 2), ((0.15, 0.18), 1))):
            a = spin + k * math.tau / 3
            d = 0.0 if k == 0 else r * 1.72
            cols.append((column_joints(rng, r * (1.05 if k == 0 else 0.92), rng.uniform(*hr), (math.cos(a) * d, math.sin(a) * d), joints, rng.uniform(0.15, 0.35)), rng.uniform(0, 1)))
        fa = spin + math.pi + rng.uniform(-0.4, 0.4)
        fallen = (0.034, rng.uniform(0.06, 0.08), (math.cos(fa) * 0.13, math.sin(fa) * 0.13), fa + math.pi / 2 + rng.uniform(-0.5, 0.5))
    else:
        r = 0.038
        spots = [(0.0, 0.0)] + [(math.cos(spin + k * math.tau / 6) * r * 1.75, math.sin(spin + k * math.tau / 6) * r * 1.75) for k in (0, 2, 4)]
        plan = (((0.22, 0.25), 2), ((0.16, 0.19), 2), ((0.1, 0.13), 1), ((0.06, 0.09), 1))
        for (hr, joints), pos in zip(plan, spots):
            cols.append((column_joints(rng, r * rng.uniform(0.92, 1.0), rng.uniform(*hr), pos, joints, rng.uniform(0.15, 0.4)), rng.uniform(0, 1)))
        fallen = None
    phases = [rng.uniform(0, math.tau) for _ in cols]

    m = Mesh(rng)
    for k, (joints, t) in enumerate(cols):
        if lo and k >= 2:
            continue
        side = mix(mix('basalt', 'granite_dark', 0.6), 'slate', t * 0.25)
        if lo:
            r, _, z1, pos, _, slope, sdir, _ = joints[-1]
            basalt_segment(m, joints[0][0], SINK, z1, joints[0][3], phases[k], slope, sdir, side, seg=5)
            continue
        for r, z0, z1, pos, dphase, slope, sdir, tide in joints:
            basalt_segment(m, r, z0, z1, pos, phases[k] + dphase, slope, sdir, side, tide=tide)
    if fallen and not lo:
        r, length, pos, lie = fallen
        basalt_segment(m, r, 0.0, length, pos, rng.uniform(0, math.tau), 0, 0, mix('basalt', 'slate', 0.5), lie=lie)
    m.ground_ao(0.05, 0.35)
    return m


# -- frozen rocks -------------------------------------------------------------------

def ice_shard(rng, h, r, at, lean):
    """Points for a broken ice slab: a flattened foot rising to a ragged two-point top."""
    x, y, z = at
    lx, ly = lean
    spin = rng.uniform(0, math.tau)
    across = Vector((math.cos(spin), math.sin(spin), 0))
    thin = Vector((-math.sin(spin), math.cos(spin), 0))
    pts = []
    for zf, k, n in ((0.0, 1.0, 5), (0.55, 0.8, 4)):
        for i in range(n):
            a = i * math.tau / n + rng.uniform(-0.3, 0.3)
            off = across * math.cos(a) * r * k + thin * math.sin(a) * r * k * 0.42
            pts.append(Vector((x + lx * zf * h, y + ly * zf * h, z - 0.03 + zf * h)) + off)
    top = Vector((x + lx * h, y + ly * h, z))
    pts.append(top + across * r * 0.35 + Vector((0, 0, h)))
    pts.append(top - across * r * 0.45 + Vector((0, 0, h * rng.uniform(0.72, 0.85))))
    return pts


def icerock(rng, lo, mound):
    if mound:
        radii = (rng.uniform(0.12, 0.13), rng.uniform(0.1, 0.11), rng.uniform(0.05, 0.06))
        c = (0, 0, radii[2] * 0.6)
    else:
        radii = (rng.uniform(0.095, 0.105), rng.uniform(0.085, 0.095), rng.uniform(0.085, 0.095))
        c = (0, 0, radii[2] * 0.62)
    pts = shell(rng, 20, radii, at=c, rough=0.1)
    cuts = cleave(rng, pts, radii, c, 3 if not mound else 2, depth=(0.4, 0.65), lift=(-0.2, 0.5))
    floor(pts)
    shards = []
    count = 3 if mound else 2
    spin = rng.uniform(0, math.tau)
    for k in range(count):
        a = spin + k * math.tau / count + rng.uniform(-0.3, 0.3)
        if mound:
            d, z = rng.uniform(0.01, 0.03), radii[2] * 0.9
            lean = (math.cos(a) * rng.uniform(0.15, 0.3), math.sin(a) * rng.uniform(0.15, 0.3))
            h = rng.uniform(0.08, 0.1) * (1.2 if k == 0 else 1.0)
        else:
            d, z = rng.uniform(0.09, 0.11), 0.0
            lean = (math.cos(a) * rng.uniform(0.12, 0.28), math.sin(a) * rng.uniform(0.12, 0.28))
            h = rng.uniform(0.07, 0.1) * (1.25 if k == 0 else 1.0)
        shards.append(floor(ice_shard(rng, h, rng.uniform(0.026, 0.034), (math.cos(a) * d, math.sin(a) * d, z), lean)))

    m = Mesh(rng)
    faces = hull(m, subset(pts, 9) if lo else pts, 'basalt', flat=6)
    weather(m, faces, mix('basalt', 'slate', 0.5), 'slate', cuts, mix('slate', 'granite', 0.5), 'basalt', jitter=0.1)
    if lo:
        m.paint_where(faces, lambda f: f.normal.z > 0.5, 'snow', 0.05)
    else:
        drape(m, faces, 'snow', mix('snow', 'ice', 0.5), thick=0.009, drip=0.014, test=lambda f: f.normal.z > 0.5, jitter=0.05)
    for k, sp in enumerate(shards):
        if lo and k:
            continue
        sf = hull(m, subset(sp, 5) if lo else sp, 'ice', 0.12, flat=3)
        m.paint_where(sf, lambda f: f.normal.z > 0.35, mix('ice', 'snow', 0.6), 0.06)
        m.paint_where(sf, lambda f: f.normal.z < -0.05, mix('ice', 'water_dark', 0.3), 0.06)
    m.ground_ao(0.05, 0.35)
    return m


# -- registry ---------------------------------------------------------------------

def register(name, fn, **kw):
    model(name, **kw)(fn)


register('shrub-1', lambda rng, lo: shrub(rng, lo, 'broadleaf'), budget=90, lo=20, ground='grass', size=0.2)
register('shrub-2', lambda rng, lo: shrub(rng, lo, 'juniper'), budget=90, lo=20, ground='grass', size=0.2)
register('shrub-3', lambda rng, lo: shrub(rng, lo, 'gorse'), budget=90, lo=20, ground='grass', size=0.2)
register('scrub-1', tussock, budget=80, lo=16, ground='desert', size=0.15)
register('scrub-2', brush, budget=80, lo=16, ground='desert', size=0.15)
register('reeds-1', lambda rng, lo: reeds(rng, lo, True), budget=120, lo=20, ground='swamp', size=0.15)
register('reeds-2', lambda rng, lo: reeds(rng, lo, False), budget=120, lo=20, ground='swamp', size=0.15)
register('fern-1', lambda rng, lo: fern(rng, lo, False), budget=120, lo=20, ground='forest', size=0.25)
register('fern-2', lambda rng, lo: fern(rng, lo, True), budget=120, lo=20, ground='forest', size=0.25)
register('boulder-1', lambda rng, lo: boulder(rng, lo, 'single'), budget=140, lo=30, ground='hills', size=0.2)
register('boulder-2', lambda rng, lo: boulder(rng, lo, 'split'), budget=140, lo=30, ground='hills', size=0.22)
register('boulder-3', lambda rng, lo: boulder(rng, lo, 'cluster'), budget=140, lo=30, ground='hills', size=0.3)
register('mossrock-1', lambda rng, lo: mossrock(rng, lo, False), budget=160, lo=30, ground='taiga', size=0.2)
register('mossrock-2', lambda rng, lo: mossrock(rng, lo, True), budget=160, lo=30, ground='taiga', size=0.3)
register('crag-1', lambda rng, lo: crag(rng, lo, 1), budget=200, lo=40, ground='rock', size=0.35)
register('crag-2', lambda rng, lo: crag(rng, lo, 2), budget=200, lo=40, ground='rock', size=0.35)
register('crag-3', lambda rng, lo: crag(rng, lo, 3), budget=200, lo=40, ground='rock', size=0.4)
register('hoodoo-1', lambda rng, lo: hoodoo(rng, lo, False), budget=220, lo=40, ground='desert', size=0.3)
register('hoodoo-2', lambda rng, lo: hoodoo(rng, lo, True), budget=220, lo=40, ground='desert', size=0.3)
register('searock-1', lambda rng, lo: searock(rng, lo, False), budget=160, lo=30, ground='beach', size=0.3)
register('searock-2', lambda rng, lo: searock(rng, lo, True), budget=160, lo=30, ground='beach', size=0.3)
register('icerock-1', lambda rng, lo: icerock(rng, lo, False), budget=160, lo=30, ground='snow', size=0.3)
register('icerock-2', lambda rng, lo: icerock(rng, lo, True), budget=160, lo=30, ground='snow', size=0.3)
