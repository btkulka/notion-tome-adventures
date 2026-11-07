"""Trees: every biome's woodland, from northern firs to drowned cypresses.

Every builder draws all of its shape parameters from rng before it branches on
`lo`, so the far version keeps the full model's silhouette.
"""
import math

import bmesh
from mathutils import Matrix, Vector, noise

from kit import Mesh, mix, model, shade, xform

TAU = math.tau
ICO20 = 1  # icosphere subdivisions for a 20-triangle icosahedron
ICO80 = 2  # and for an 80-triangle sphere


# -- helpers -------------------------------------------------------------------

def blob(m, radius, at=(0, 0, 0), scale=1.0, rot=(0, 0, 0), subdiv=ICO80, color='oak', jitter=0.0, noise_amount=0.0,
         noise_scale=2.0):
    """kit.Mesh.blob, but transforming only the new sphere's vertices.

    kit.blob finds its vertices by diffing set(bm.verts), which also catches
    existing ones, so every blob dragged the trunk and earlier clumps along.
    """
    verts = bmesh.ops.create_icosphere(m.bm, subdivisions=subdiv, radius=radius, matrix=Matrix.Identity(4))['verts']
    offset = Vector((m.rng.uniform(0, 100), m.rng.uniform(0, 100), m.rng.uniform(0, 100)))
    if noise_amount:
        for v in verts:
            v.co *= 1.0 + noise.noise(v.co * noise_scale / radius * 0.5 + offset) * noise_amount
    bmesh.ops.transform(m.bm, matrix=xform(at, rot, scale), verts=verts)
    faces = list({f for v in verts for f in v.link_faces})
    return m.paint(faces, color, jitter)


def rows_loft(m, rows, color, jitter=0.0, cap_bottom=False, cap_top=False):
    """Join rows of points (a one-point row is a tip) into bands of faces.

    Rows run bottom to top and each ring goes counter-clockwise about the axis,
    so faces wind outward. Faces come back band by band.
    """
    bm = m.bm
    vrows = [[bm.verts.new(Vector(p)) for p in row] for row in rows]
    faces = []
    for lo, hi in zip(vrows, vrows[1:]):
        if len(lo) == 1 and len(hi) == 1:
            continue
        n = max(len(lo), len(hi))
        for i in range(n):
            j = (i + 1) % n
            if len(hi) == 1:
                faces.append(bm.faces.new((lo[i], lo[j], hi[0])))
            elif len(lo) == 1:
                faces.append(bm.faces.new((lo[0], hi[j], hi[i])))
            else:
                faces.append(bm.faces.new((lo[i], lo[j], hi[j], hi[i])))
    if cap_bottom and len(vrows[0]) > 2:
        faces.append(bm.faces.new(list(reversed(vrows[0]))))
    if cap_top and len(vrows[-1]) > 2:
        faces.append(bm.faces.new(vrows[-1]))
    return m.paint(faces, color, jitter)


def frame(d, u_prev=None):
    """Two axes across direction d with u × v = d; carries u_prev along to avoid twisting."""
    d = d.normalized()
    if u_prev is not None:
        u = u_prev - d * u_prev.dot(d)
        if u.length > 1e-6:
            u.normalize()
            return u, d.cross(u)
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    return u, d.cross(u)


def tube(m, pts, radii, seg, color, jitter=0.08, cap_top=False, phase=0.0, wobble=0.0):
    """A tapering tube through points (limbs, roots, curved trunks). Radius 0 ends in a point."""
    pts = [Vector(p) for p in pts]
    rows, u = [], None
    for k, (p, r) in enumerate(zip(pts, radii)):
        d = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]
        u, v = frame(d, u)
        if r <= 0:
            rows.append([p])
            continue
        row = []
        for i in range(seg):
            a = phase + i * TAU / seg
            rr = r * (1.0 + (m.rng.uniform(-wobble, wobble) if wobble else 0.0))
            row.append(p + (u * math.cos(a) + v * math.sin(a)) * rr)
        rows.append(row)
    return rows_loft(m, rows, color, jitter, cap_top=cap_top)


def trunk(m, rings, seg, color, phase=0.0, twist=0.0, wobble=0.0, dent=None, jitter=0.08, cap_top=True):
    """A vertical trunk from rings (z, radius, ridge[, dx, dy]).

    `ridge` pulls every other vertex in by that fraction: root flare and
    buttresses at the base, fluting higher up. `twist` turns each ring further
    than the one below; `dent(k, angle)` scales a vertex radius (hollows).
    """
    rows = []
    for k, ring in enumerate(rings):
        z, r, ridge = ring[:3]
        dx, dy = (ring[3], ring[4]) if len(ring) > 3 else (0.0, 0.0)
        row = []
        for i in range(seg):
            a = phase + twist * k + i * TAU / seg
            rr = r * (1.0 - ridge if i % 2 else 1.0)
            if wobble:
                rr *= 1.0 + m.rng.uniform(-wobble, wobble)
            if dent:
                rr *= dent(k, a)
            row.append(Vector((dx + math.cos(a) * rr, dy + math.sin(a) * rr, z)))
        rows.append(row)
    return rows_loft(m, rows, color, jitter, cap_top=cap_top)


def tone(m, faces, top, side, under, jitter=0.1):
    """Paint by facing: lit tops, mid sides, shadowed undersides."""
    for f in faces:
        f.normal_update()
        nz = f.normal.z
        if nz < -0.3:
            c = mix(side, under, min(1.0, 0.5 + (-nz - 0.3) / 0.5))
        else:
            c = mix(side, top, max(0.0, min(1.0, nz / 0.8)))
        m.paint([f], c, jitter)
    return faces


def strand(m, at, length, radius, color):
    """A hanging wisp of moss or vine: a thin three-sided spike pointing down."""
    return m.loft([(-length, 0.0), (0.0, radius)], seg=3, at=at, color=color, jitter=0.1, phase=m.rng.uniform(0, TAU))


def pad(m, at, r, th, seg, color, lo=False, yaw=0.0, stretch=1.0, wobble=0.16, rings=None):
    """A flat foliage layer: ink-painting pine clouds, cypress and thorn crowns."""
    if lo:
        rings = [(-th * 0.5, r), (th * 0.5, r * 0.8)]
        wobble = 0.0
    elif rings is None:
        rings = [(-th * 0.5, r * 0.6), (-th * 0.1, r), (th * 0.5, r * 0.8)]
    return m.loft(rings, seg=seg, at=at, rot=(0, 0, yaw), scale=(stretch, 1.0, 1.0), color=color, wobble=wobble,
                  phase=m.rng.uniform(0, TAU))


# -- firs ----------------------------------------------------------------------

def fir_params(rng, h, spread, tiers, tips=(5, 6, 6, 7)):
    return {
        'h': rng.uniform(*h),
        'spread': rng.uniform(*spread),
        'tiers': rng.choice(tiers),
        'lean': (rng.uniform(-1, 1), rng.uniform(-1, 1)),
        'phase': [rng.uniform(0, TAU) for _ in range(12)],
        'size': [rng.uniform(0.88, 1.12) for _ in range(12)],
        'droop': [rng.uniform(0.8, 1.25) for _ in range(12)],
        'tips': [rng.choice(tips) for _ in range(12)],
        'shift': [rng.uniform(-0.18, 0.18) for _ in range(12)],
    }


def fir_tiers(m, p, lo, z0, top, snow=False, lo_tiers=3, max_tips=7, taper=0.78):
    """Drooping star-edged skirts from z0 (lowest tips) to a spear tip at `top`.

    Each skirt is darkest where the skirt above shades it and lightest at its
    drooping rim, so the tiers read as separate layers even at a distance.
    """
    n = lo_tiers if lo else p['tiers']
    z_last = top - (top - z0) * 0.26
    step = (z_last - z0) / (n - 1)
    lx, ly = p['lean']
    faces = []
    for k in range(n):
        t = k / (n - 1)
        z_tip = z0 + step * (k + (p['shift'][k] if 0 < k < n - 1 else 0.0))
        r = p['spread'] * (1.0 - taper * t) * p['size'][k]
        cx, cy = lx * 0.025 * t, ly * 0.025 * t
        apex = top if k == n - 1 else z_tip + r * 1.0 + 0.035
        droop = r * 0.32 * p['droop'][k]
        under = [(cx, cy, z_tip + (apex - z_tip) * 0.12)]
        tip = [(cx, cy, apex)]
        rim = mix('fir_mid', 'fir_light', 0.25 + 0.75 * t)
        if lo:
            ring = [(cx + math.cos(p['phase'][k] + i * TAU / 6) * r, cy + math.sin(p['phase'][k] + i * TAU / 6) * r,
                     z_tip - droop * 0.6) for i in range(6)]
            f = rows_loft(m, [under, ring, tip], rim)
            m.paint(f[:6], shade('fir', 0.5))
            if snow:
                # Alternate white and green facets: a snow-laden fir's streaks at a distance.
                m.paint(f[6::2], 'snow', 0.04)
                m.paint(f[7::2], mix('fir_mid', 'snow', 0.25), 0.06)
            else:
                m.paint(f[6:], rim, 0.06)
            faces += f
            continue
        nn = min(p['tips'][k], max_tips) * 2
        star = []
        for i in range(nn):
            a = p['phase'][k] + i * TAU / nn
            point = i % 2 == 0
            rr = r if point else r * 0.58
            star.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z_tip - droop if point else z_tip + droop * 0.25))

        def inner(scale, zf):
            return [(cx + (x - cx) * scale, cy + (y - cy) * scale, z_tip + (apex - z_tip) * zf) for x, y, _ in star]

        rows = [under, star] + ([inner(0.74, 0.14)] if snow else []) + [inner(0.4, 0.42), tip]
        f = rows_loft(m, rows, rim)
        bands = [f[i * nn:(i + 1) * nn] for i in range(len(rows) - 1)]
        m.paint(bands[0], shade('fir', 0.45), 0.08)
        if snow:
            m.paint(bands[1], rim, 0.1)
            m.paint(bands[2], 'snow', 0.04)
            m.paint(bands[3], mix('snow', 'ice', 0.5), 0.04)
        else:
            m.paint(bands[1], rim, 0.12)
            m.paint(bands[2], mix('fir', 'fir_mid', 0.3 * t), 0.1)
        faces += f
    return faces


def leader(m, p, top, length=0.1):
    lx, ly = p['lean']
    cx, cy = lx * 0.025, ly * 0.025
    return tube(m, [(cx, cy, top - length), (cx, cy, top + 0.04)], [0.011, 0.0], 4, 'fir_mid')


def fir(rng, lo):
    """A tall northern fir: distinct drooping tiers narrowing to a spear tip."""
    p = fir_params(rng, (0.58, 0.74), (0.13, 0.16), (5, 6, 7))
    h = p['h']
    z0 = h * 0.16
    m = Mesh(rng)
    trunk(m, [(-0.05, 0.034, 0.0), (z0 + 0.02, 0.024, 0.0), (h * 0.6, 0.012, 0.0)][:2 if lo else 3],
          4 if lo else 5, 'bark', cap_top=False)
    fir_tiers(m, p, lo, z0, h)
    if not lo:
        leader(m, p, h)
    m.ground_ao(0.1, 0.35)
    return m


def snowfir(rng, lo):
    """A fir bowed under snow: every tier carries a white load over a green fringe."""
    p = fir_params(rng, (0.5, 0.64), (0.13, 0.16), (5, 6), tips=(5, 6))
    mound = (rng.uniform(0.06, 0.08), rng.uniform(0, TAU))
    h = p['h']
    z0 = h * 0.15
    m = Mesh(rng)
    trunk(m, [(-0.05, 0.034, 0.0), (z0 + 0.02, 0.024, 0.0), (h * 0.6, 0.012, 0.0)][:2 if lo else 3],
          4 if lo else 5, 'bark_dark', cap_top=False)
    fir_tiers(m, p, lo, z0, h, snow=True, max_tips=5 if p['tiers'] == 6 else 6)
    if not lo:
        leader(m, p, h, 0.08)
        blob(m, mound[0], at=(0, 0, -0.02), scale=(1.0, 1.0, 0.4), rot=(0, 0, mound[1]), subdiv=ICO20,
               color='snow', jitter=0.04, noise_amount=0.15)
    m.ground_ao(0.08, 0.25)
    return m


def elderfir(rng, lo):
    """An ancient giant fir: root-buttressed trunk, snapped lower limbs, lichen beards."""
    p = fir_params(rng, (1.02, 1.16), (0.2, 0.235), (8, 9), tips=(6, 7))
    limbs = [(i * TAU / 5 + rng.uniform(-0.4, 0.4), rng.uniform(0.1, 0.27), rng.uniform(0.1, 0.17), rng.uniform(-0.07, 0.01))
             for i in range(5)]
    lichen = [(rng.uniform(0, TAU), rng.uniform(0.45, 0.85), rng.uniform(0.05, 0.11), rng.randrange(3)) for _ in range(8)]
    moss = [rng.random() for _ in range(80)]
    h = p['h']
    z0 = 0.3
    m = Mesh(rng)
    if lo:
        trunk(m, [(-0.05, 0.075, 0.0), (z0, 0.04, 0.0), (h * 0.5, 0.02, 0.0)], 5, 'bark', cap_top=False)
    else:
        bark = trunk(m, [(-0.05, 0.135, 0.55), (0.0, 0.115, 0.5), (0.05, 0.078, 0.36), (0.14, 0.056, 0.16),
                         (z0 + 0.02, 0.045, 0.06), (h * 0.55, 0.024, 0.0)], 10, 'bark', twist=0.12, wobble=0.06,
                     cap_top=False)
        m.paint_by_height(bark, 'bark_dark', 'bark', -0.05, 0.3, jitter=0.1)
        for f, roll in zip(bark, moss):
            c = f.calc_center_median()
            if c.z < 0.26 and (roll < 0.3 or (c.y > 0 and roll < 0.55)):
                m.paint([f], 'moss' if roll < 0.2 else 'moss_dark', 0.12)
    fir_tiers(m, p, lo, z0, h, lo_tiers=4, taper=0.8)
    if not lo:
        leader(m, p, h, 0.14)
        for a, z, length, dz in limbs:
            ca, sa = math.cos(a), math.sin(a)
            base = 0.04 if z > 0.15 else 0.06
            tube(m, [(ca * base, sa * base, z), (ca * length * 0.55, sa * length * 0.55, z + dz * 0.4 + 0.01),
                     (ca * length, sa * length, z + dz)], [0.016, 0.01, 0.0], 4, 'bark_grey', 0.1)
        step = (h - (h - z0) * 0.26 - z0) / (p['tiers'] - 1)
        for a, frac, length, k in lichen:
            r = p['spread'] * (1.0 - 0.8 * k / (p['tiers'] - 1)) * frac
            strand(m, (math.cos(a) * r, math.sin(a) * r, z0 + step * k + 0.02), length, 0.007,
                   mix('moss', 'bark_pale', 0.45))
    m.ground_ao(0.14, 0.4)
    return m


# -- windswept pines -------------------------------------------------------------

def pine(rng, lo):
    """A windswept mountain pine: a bent trunk under flat layered cloud crowns."""
    h = rng.uniform(0.38, 0.48)
    lean = rng.uniform(0.11, 0.17)
    sway = rng.uniform(-0.04, 0.04)
    kink = rng.uniform(-0.03, 0.03)
    n = rng.choice((4, 5, 5))
    pads = []
    for _ in range(5):
        t = rng.uniform(0.5, 0.9)
        reach = rng.uniform(-0.05, 0.14)
        pads.append({'t': t, 'reach': reach, 'side': rng.uniform(-0.06, 0.06),
                     'r': rng.uniform(0.05, 0.08) * (0.7 if reach < 0 else 1.0), 'th': rng.uniform(0.024, 0.032),
                     'yaw': rng.uniform(-0.35, 0.35), 'rise': rng.uniform(0.0, 0.035)})
    crown = {'r': rng.uniform(0.085, 0.1), 'th': rng.uniform(0.03, 0.036), 'yaw': rng.uniform(-0.3, 0.3)}
    pads = sorted(pads[:n - 1], key=lambda q: q['t'])

    def at(t):
        return Vector((lean * t ** 1.6 + kink * math.sin(t * math.pi), sway * t, -0.05 + (h - 0.03 + 0.05) * t))

    m = Mesh(rng)
    if lo:
        tube(m, [at(0), at(1)], [0.03, 0.012], 3, 'bark')
    else:
        bark = tube(m, [at(0), at(0.08), at(0.35), at(0.65), at(1.0)], [0.042, 0.03, 0.022, 0.016, 0.01], 5, 'bark', 0.1)
        m.paint_by_height(bark, 'bark_dark', mix('bark', 'sandstone_dark', 0.35), -0.05, h, jitter=0.1)
    ends = []
    for q in pads:
        base = at(q['t'])
        end = base + Vector((q['reach'] + 0.02, q['side'], q['rise']))
        ends.append((end, q))
        if not lo and q['reach'] > 0.02:
            tube(m, [base, base + (end - base) * 0.55 + Vector((0, 0, 0.012)), end], [0.012, 0.009, 0.006], 4, 'bark')
    top = at(1.0) + Vector((0.025, 0.0, 0.0))
    ends.append((top, crown))
    if lo:
        ends = [ends[-1]] + sorted(ends[:-1], key=lambda e: -e[1]['r'])[:2]
    foliage = []
    for centre, q in ends:
        foliage += pad(m, centre, q['r'], q['th'], 5 if lo else 9, 'fir_mid', lo, q['yaw'], 1.45)
    tone(m, foliage, 'fir_light', 'fir_mid', shade('fir', 0.5), 0.1)
    m.ground_ao(0.08, 0.3)
    return m


# -- oaks ------------------------------------------------------------------------

OAK_TONES = (mix(mix('oak_mid', 'oak_light', 0.3), 'granite', 0.15), mix(mix('oak', 'oak_mid', 0.35), 'granite', 0.1),
             shade('oak', 0.5))


def limb(m, start, end, radii, kink, seg=4, color='bark'):
    start, end = Vector(start), Vector(end)
    mid = start + (end - start) * 0.45 + kink
    return tube(m, [start, mid, end], radii, seg, color, 0.1)


def cluster(rng, centre, spread, count, r, squash):
    """Specs for `count` foliage clumps scattered about a branch end."""
    out = []
    for _ in range(count):
        a = rng.uniform(0, TAU)
        d = rng.uniform(0.3, 1.0) * spread
        out.append((Vector(centre) + Vector((math.cos(a) * d, math.sin(a) * d, rng.uniform(-0.4, 0.6) * spread * squash)),
                    r * rng.uniform(0.8, 1.15), squash * rng.uniform(0.85, 1.1), rng.uniform(0, TAU), rng.uniform(0.85, 1.25)))
    return out


def clumps(m, specs, tones, noise_amount=0.3):
    """Angular foliage: noisy 20-face icosahedra, each squashed and turned its own way."""
    faces = []
    for centre, r, squash, yaw, stretch in specs:
        faces += blob(m, r, at=centre, scale=(stretch, 1.0, squash), rot=(0, 0, yaw), subdiv=ICO20, color=tones[1],
                      noise_amount=noise_amount)
    return tone(m, faces, *tones, 0.1)


def oak(rng, lo):
    """A great oak: twisted, root-flared trunk forking into clusters of faceted leaf clumps."""
    H = rng.uniform(0.42, 0.54)
    W = rng.uniform(0.37, 0.44)
    lean = Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), 0))
    twist = rng.uniform(0.28, 0.45) * rng.choice((-1, 1))
    phase = rng.uniform(0, TAU)
    ch = H * 0.62
    zb = H - ch
    fork = lean + Vector((0, 0, zb + 0.01))
    a0 = rng.uniform(0, TAU)
    branches = []
    for k in range(3):
        a = a0 + k * TAU / 3 + rng.uniform(-0.3, 0.3)
        end = Vector((lean.x + math.cos(a) * W * 0.29, lean.y + math.sin(a) * W * 0.29, zb + ch * rng.uniform(0.34, 0.46)))
        branches.append((end, cluster(rng, end, W * 0.12, 3, W * 0.215, 0.72)))
    crown = Vector((lean.x * 1.5, lean.y * 1.5, H - W * 0.24))
    branches.append((crown, cluster(rng, crown, W * 0.12, 4, W * 0.2, 0.72)))
    kinks = [Vector((rng.uniform(-0.025, 0.025), rng.uniform(-0.025, 0.025), rng.uniform(0.0, 0.025))) for _ in range(4)]

    m = Mesh(rng)
    if lo:
        tube(m, [(0, 0, -0.05), fork], [0.04, 0.026], 4, 'bark')
        body = (lean + Vector((0, 0, zb + ch * 0.42)), W * 0.42, 0.62, a0, 1.0)
        top = (crown, W * 0.3, 0.7, a0 + 1.0, 1.1)
        side = (branches[0][0], W * 0.25, 0.7, a0 + 2.0, 1.1)
        clumps(m, [body, top, side], OAK_TONES, 0.15)
        return m
    bark = trunk(m, [(-0.05, 0.07, 0.45), (0.0, 0.06, 0.42), (0.05, 0.041, 0.22), (zb * 0.6, 0.032, 0.08, lean.x * 0.5, lean.y * 0.5),
                     (fork.z, 0.028, 0.04, lean.x, lean.y)], 8, 'bark', phase=phase, twist=twist, wobble=0.05)
    m.paint_by_height(bark, 'bark_dark', 'bark', -0.05, zb, jitter=0.1)
    specs = []
    for (end, group), kink in zip(branches, kinks):
        tip = fork + (end - fork) * 0.85
        limb(m, fork, tip, [0.024, 0.016, 0.01], kink)
        for c, *_ in group:
            tube(m, [tip, c], [0.008, 0.005], 3, 'bark')
        specs += group
    clumps(m, specs, OAK_TONES)
    m.ground_ao(0.1, 0.35)
    return m


def elderoak(rng, lo):
    """A vast ancient oak: hollow fluted trunk, heavy spreading limbs, roots over the ground."""
    H = rng.uniform(0.82, 0.93)
    W = rng.uniform(0.68, 0.74)
    a0 = rng.uniform(0, TAU)
    limbs_p = [{'a': a0 + k * TAU / 5 + rng.uniform(-0.3, 0.3), 'd': W * rng.uniform(0.33, 0.38), 'z': rng.uniform(0.5, 0.62),
                'start': rng.uniform(0.2, 0.3)} for k in range(5)]
    ends = [Vector((math.cos(q['a']) * q['d'], math.sin(q['a']) * q['d'], q['z'] * H)) for q in limbs_p]
    groups = [cluster(rng, e, W * 0.1, 5, W * 0.15, 0.7) for e in ends]
    crown = Vector((0, 0, H - W * 0.16))
    top_group = cluster(rng, crown, W * 0.17, 8, W * 0.15, 0.72)
    roots = [(a0 + (k + 0.5) * TAU / 6 + rng.uniform(-0.3, 0.3), rng.uniform(0.17, 0.26)) for k in range(6)]
    kinks = [Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), rng.uniform(0.01, 0.05))) for _ in range(5)]
    twist = rng.uniform(0.22, 0.35)
    fork = Vector((0, 0, 0.3))

    m = Mesh(rng)
    if lo:
        tube(m, [(0, 0, -0.05), fork], [0.1, 0.065], 4, 'bark')
        body = (Vector((0, 0, H * 0.62)), W * 0.36, 0.55, a0, 1.0)
        clumps(m, [body] + [(ends[i], W * 0.2, 0.7, a0 + i, 1.1) for i in (0, 1, 2, 3)], OAK_TONES, 0.15)
        return m

    def hollow(k, a):
        front = abs(((a + math.pi / 2) + math.pi) % TAU - math.pi)
        return 0.5 if k in (1, 2) and front < 0.45 else 1.0

    bark = trunk(m, [(-0.05, 0.145, 0.5), (0.0, 0.125, 0.46), (0.08, 0.095, 0.3), (0.19, 0.078, 0.16), (fork.z, 0.07, 0.1)],
                 10, 'bark', phase=-math.pi / 2, twist=twist, wobble=0.08, dent=hollow)
    m.paint_by_height(bark, 'bark_dark', 'bark', -0.05, 0.3, jitter=0.12)
    for f in bark:
        c = f.calc_center_median()
        if c.y < 0 and abs(c.x) < 0.06 and 0.0 < c.z < 0.17:
            m.paint([f], shade('bark_dark', 0.45), 0.05)
        elif c.y > 0.03 and c.z < 0.22 and m.rng.random() < 0.5:
            m.paint([f], 'moss_dark', 0.12)
    for q, end, kink in zip(limbs_p, ends, kinks):
        start = Vector((math.cos(q['a']) * 0.03, math.sin(q['a']) * 0.03, q['start']))
        limb(m, start, start + (end - start) * 0.9, [0.046, 0.03, 0.016], kink, seg=5)
    for a, length in roots:
        ca, sa = math.cos(a), math.sin(a)
        tube(m, [(ca * 0.08, sa * 0.08, 0.06), (ca * length * 0.55, sa * length * 0.55, 0.025), (ca * length, sa * length, -0.04)],
             [0.036, 0.022, 0.01], 4, 'bark', 0.1)
    clumps(m, [s for g in groups for s in g] + top_group, OAK_TONES)
    m.ground_ao(0.12, 0.4)
    return m


# -- jungle ----------------------------------------------------------------------

def jungle(rng, lo):
    """An emergent jungle giant: finned buttresses, a tall pale bole, umbrella canopies."""
    H = rng.uniform(0.62, 0.78)
    bend = Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0))
    top_r = rng.uniform(0.19, 0.23)
    phase = rng.uniform(0, TAU)
    a0 = rng.uniform(0, TAU)
    sides = [(a0 + k * TAU / 3 + rng.uniform(-0.4, 0.4), rng.uniform(0.42, 0.66), rng.uniform(0.11, 0.14), rng.uniform(0.14, 0.2))
             for k in range(3)]
    vines = [(rng.uniform(0, TAU), rng.uniform(0.3, 0.85), rng.uniform(0.08, 0.2)) for _ in range(4)]

    def at(t):
        return Vector((0, 0, 0.15 + (H - 0.19) * t)) + bend * (t * t)

    # The emergent crown: a broad, flat ring of clumps; lower boughs carry smaller flat clusters.
    top = at(1.0) - Vector((0, 0, 0.015))
    crown = [(top + Vector((math.cos(phase + k * TAU / 6) * top_r * 0.62, math.sin(phase + k * TAU / 6) * top_r * 0.62,
                            rng.uniform(-0.012, 0.012))), top_r * 0.42 * rng.uniform(0.85, 1.15), 0.42, rng.uniform(0, TAU),
              rng.uniform(0.95, 1.3)) for k in range(6)]
    crown.append((top + Vector((0, 0, 0.022)), top_r * 0.5, 0.45, phase, 1.1))
    boughs = []
    for a, f, r, reach in sides:
        start = at(f)
        end = start + Vector((math.cos(a) * reach, math.sin(a) * reach, 0.05))
        boughs.append((start, end, cluster(rng, end, r * 0.45, 3, r * 0.5, 0.42)))
    tones = (mix(mix('jungle', 'jungle_light', 0.45), 'granite', 0.12), mix('jungle', 'granite', 0.08), shade('jungle', 0.42))
    m = Mesh(rng)
    if lo:
        tube(m, [(0, 0, -0.05), (0, 0, 0.12), at(1.0)], [0.09, 0.035, 0.02], 4, 'bark_pale')
        start, end, _ = boughs[0]
        clumps(m, [(top, top_r * 1.0, 0.3, phase, 1.1), (end, sides[0][2] * 0.95, 0.34, phase + 1, 1.1)], tones, 0.12)
        return m
    base = trunk(m, [(-0.05, 0.13, 0.72), (0.03, 0.086, 0.62), (0.1, 0.046, 0.3), (0.17, 0.032, 0.05)], 10, 'bark_pale',
                 phase=phase, cap_top=False)
    bole = tube(m, [at(0.0), at(0.35), at(0.7), at(1.0)], [0.032, 0.028, 0.024, 0.02], 5, 'bark_pale', 0.08)
    m.paint_by_height(base + bole, 'bark_grey', 'bark_pale', -0.05, H * 0.6, jitter=0.08)
    specs = list(crown)
    for start, end, group in boughs:
        tube(m, [start, end], [0.016, 0.01], 4, 'bark_pale')
        specs += group
    clumps(m, specs, tones, 0.25)
    for a, frac, length in vines:
        strand(m, top + Vector((math.cos(a) * top_r * frac, math.sin(a) * top_r * frac, -0.02)), length, 0.006, 'moss_dark')
    m.ground_ao(0.12, 0.4)
    return m


# -- palms and tree-ferns -----------------------------------------------------------

def frond(m, base, yaw, length, rise, droop, width, inner=3, color='palm', thick=0.008):
    """An angular leaf: a ridged spine with drooping edges, closed so it holds from below."""
    base = Vector(base)
    n = inner + 2
    pts = []
    for k in range(n):
        s = k / (n - 1)
        d = length * s
        pts.append(base + Vector((math.cos(yaw) * d, math.sin(yaw) * d, length * (rise * s - droop * s * s))))
    rows, u = [[pts[0]]], None
    for k in range(1, n - 1):
        s = k / (n - 1)
        u, v = frame(pts[k + 1] - pts[k - 1], u)
        w = width * math.sin(math.pi * s) ** 0.8
        p = pts[k]
        rows.append([p + u * w + v * (w * 0.45), p + v * (w * 0.15), p - u * w + v * (w * 0.45), p - v * thick])
    rows.append([pts[-1]])
    return rows_loft(m, rows, color)


def palm(rng, lo, fern=False):
    """A coastal palm (curved, ringed trunk) or a jungle tree-fern (straight, shaggy, arching fronds)."""
    H = rng.uniform(0.46, 0.58)
    curve = rng.uniform(0.0, 0.03) if fern else rng.uniform(0.08, 0.14)
    yaw0 = rng.uniform(0, TAU)
    count = 9 if fern else 7
    fronds = [(yaw0 + k * TAU / count + rng.uniform(-0.25, 0.25), rng.uniform(0.17, 0.23), rng.uniform(0.85, 1.1),
               rng.uniform(1.25, 1.55) if fern else rng.uniform(0.95, 1.3), rng.uniform(0.026, 0.034)) for k in range(count)]
    dry = -1 if fern or rng.random() < 0.2 else rng.randrange(count)
    joints = 5

    def at(t):
        return Vector((math.cos(yaw0) * curve * t * t, math.sin(yaw0) * curve * t * t, -0.05 + (H * 0.88 + 0.05) * t))

    crown = at(1.0)
    m = Mesh(rng)
    if lo:
        tube(m, [at(0), crown], [0.03, 0.02], 3, 'bark_grey' if not fern else 'bark_dark')
        for k in range(0, count, 2 if fern else 1)[:5]:
            yaw, length, rise, droop, width = fronds[k]
            rise = 0.9 if fern else 0.4 * rise
            f = frond(m, crown, yaw, length, rise, droop, width * 1.2, inner=1)
            m.paint(f, 'palm')
        return m
    if fern:
        bark = tube(m, [at(0), at(0.3), at(0.65), at(0.95)], [0.04, 0.03, 0.027, 0.032], 5, 'bark_dark', 0.12, cap_top=True,
                    wobble=0.18)
        m.paint_by_height(bark, 'bark_dark', mix('bark_dark', 'moss_dark', 0.5), 0, H, jitter=0.15)
    else:
        pts, radii = [], []
        for k in range(joints):
            t0, t1 = k / joints, (k + 0.28) / joints
            r = 0.03 - 0.011 * t0
            pts += [at(t0), at(t1)]
            radii += [r * 1.14, r * 0.9]
        pts.append(at(0.98))
        radii.append(0.02)
        bark = tube(m, pts, radii, 5, 'bark_grey', 0.06, cap_top=True)
        m.paint_by_height(bark, shade('bark_grey', 0.8), mix('bark_grey', 'sandstone', 0.35), 0, H, jitter=0.08)
    blob(m, 0.032, at=crown + Vector((0, 0, 0.005)), scale=(1, 1, 0.8), subdiv=ICO20,
           color=mix('palm', 'bark', 0.55), jitter=0.1)
    leaves = []
    for k, (yaw, length, rise, droop, width) in enumerate(fronds):
        if k == dry:
            f = frond(m, crown, yaw, length * 0.9, -0.5, 0.6, width * 0.8)
            m.paint(f, 'dry_leaf', 0.12)
            continue
        if fern:
            leaves += frond(m, crown, yaw, length * 1.1, 0.95 * rise, droop, width * 0.75)
        else:
            leaves += frond(m, crown, yaw, length, 0.42 * rise, droop, width)
    tone(m, leaves, mix('palm', 'oak_light', 0.45), 'palm', shade('palm', 0.5), 0.1)
    m.ground_ao(0.08, 0.3)
    return m


# -- swamp -------------------------------------------------------------------------

def cypress(rng, lo):
    """A drowned swamp cypress: flared waterline base, knees, flat crowns hung with moss."""
    H = rng.uniform(0.5, 0.64)
    lean = Vector((rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03), 0))
    phase = rng.uniform(0, TAU)
    n = 6
    a0 = rng.uniform(0, TAU)
    # Layers spiral down the upper trunk, widest near the top: the old swamp cypress's flat, tiered crown.
    pads = [{'f': 0.3 + 0.6 * k / 4 + rng.uniform(-0.04, 0.04), 'a': a0 + k * 2.4 + rng.uniform(-0.3, 0.3),
             'reach': rng.uniform(0.06, 0.12), 'r': rng.uniform(0.09, 0.115) * (0.85 + 0.2 * k / 4), 'th': rng.uniform(0.03, 0.04)}
            for k in range(5)]
    crown = {'r': rng.uniform(0.13, 0.15), 'th': rng.uniform(0.035, 0.045)}
    strands = [(rng.randrange(n), rng.uniform(0, TAU), rng.uniform(0.45, 0.95), rng.uniform(0.05, 0.13)) for _ in range(13)]
    knees = [(rng.uniform(0, TAU), rng.uniform(0.1, 0.18), rng.uniform(0.03, 0.06)) for _ in range(5)]

    def at(f):
        return Vector((0, 0, 0.15 + (H - 0.18) * f)) + lean * f

    centres = [(at(1.0) + Vector((0, 0, 0.0)), crown['r'], crown['th'])]
    for q in pads[:n - 1]:
        centres.append((at(q['f']) + Vector((math.cos(q['a']) * q['reach'], math.sin(q['a']) * q['reach'], 0.01)), q['r'], q['th']))
    # Each layer is a flat cluster of clumps: three on the flat top, two per lower layer.
    layers = [cluster(rng, c, r * 0.6, 3 if k == 0 else 2, r * 0.75, 0.42) for k, (c, r, th) in enumerate(centres)]
    tones = (mix('moss', 'swamp_leaf', 0.55), 'swamp_leaf', shade('swamp_leaf', 0.42))
    m = Mesh(rng)
    if lo:
        tube(m, [(0, 0, -0.05), (0, 0, 0.1), at(1.0)], [0.08, 0.035, 0.015], 4, 'bark_grey')
        c0, r0, _ = centres[0]
        c1, r1, _ = centres[len(centres) // 2]
        clumps(m, [(c0, r0 * 1.05, 0.38, phase, 1.15), (c1, r1 * 1.2, 0.4, phase + 1, 1.2)], tones, 0.12)
        return m
    bark = mix('bark_grey', 'bark', 0.45)
    base = trunk(m, [(-0.05, 0.11, 0.55), (0.02, 0.075, 0.45), (0.08, 0.042, 0.2), (0.15, 0.03, 0.05)], 8, bark,
                 phase=phase, cap_top=False)
    bole = tube(m, [at(0.0), at(0.5), at(1.0)], [0.03, 0.022, 0.014], 5, bark, 0.08)
    m.paint_by_height(base + bole, mix(bark, 'water_dark', 0.6), bark, 0.0, 0.14, jitter=0.08)
    for c, r, th in centres[1:]:
        start = at(min(1.0, (c.z - 0.15) / (H - 0.18)))
        if (c - start).length > 0.03:
            tube(m, [start, c], [0.011, 0.007], 4, 'bark_grey')
    clumps(m, [s for layer in layers for s in layer], tones, 0.25)
    for k, a, frac, length in strands:
        c, r, th = centres[k % len(centres)]
        strand(m, c + Vector((math.cos(a) * r * frac, math.sin(a) * r * frac, -th * 0.3)), length, 0.009,
               mix('moss', 'bark_pale', 0.45))
    for a, d, h in knees:
        m.cylinder(0.014, 0.0, h + 0.03, seg=4, at=(math.cos(a) * d, math.sin(a) * d, -0.03), color='bark_grey',
                   jitter=0.1, cap_bottom=False)
    m.ground_ao(0.1, 0.35)
    return m


def snag(rng, lo, forked=False):
    """A dead tree: pale weathered bark, a splintered top and broken angular limbs."""
    H = rng.uniform(0.38, 0.45) if forked else rng.uniform(0.3, 0.38)
    lean = Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 0))
    phase = rng.uniform(0, TAU)
    jag = [rng.uniform(-1, 1) for _ in range(6)]
    count = 2 if forked else 4
    a0 = rng.uniform(0, TAU)
    limbs = [{'a': a0 + k * TAU / count + rng.uniform(-0.5, 0.5), 'f': rng.uniform(0.35, 0.75), 'len': rng.uniform(0.08, 0.15),
              'rise': rng.uniform(-0.02, 0.07), 'turn': rng.uniform(-0.7, 0.7), 'twig': rng.uniform(-1.2, 1.2),
              'broken': rng.random() < 0.35} for k in range(count)]
    fork = [(rng.uniform(0, TAU), rng.uniform(0.06, 0.1)) for _ in range(2)]
    top_z = H * (0.66 if forked else 1.0)

    def at(f):
        return Vector((0, 0, -0.05 + (top_z + 0.05) * f)) + lean * f

    m = Mesh(rng)
    if lo:
        tube(m, [at(0), at(1)], [0.055, 0.025], 4, 'bark_grey')
        for q in limbs[:3]:
            start = at(q['f'])
            tube(m, [start, start + Vector((math.cos(q['a']) * q['len'], math.sin(q['a']) * q['len'], q['rise']))], [0.016, 0.0], 3,
                 'bark_pale')
        if forked:
            for a, d in fork:
                tube(m, [at(1), at(1) + Vector((math.cos(a) * d, math.sin(a) * d, H - top_z))], [0.014, 0.0], 3, 'bark_pale')
        return m
    rows = []
    for k, (z, r, ridge) in enumerate([(-0.05, 0.068, 0.4), (0.02, 0.05, 0.25), (0.12, 0.036, 0.08), (top_z * 0.7, 0.029, 0.04),
                                       (top_z, 0.025, 0.0)]):
        f = (z + 0.05) / (top_z + 0.05)
        c = lean * f
        row = []
        for i in range(6):
            a = phase + i * TAU / 6
            rr = r * (1.0 - ridge if i % 2 else 1.0)
            dz = jag[i] * 0.022 if k == 4 and not forked else 0.0
            row.append(Vector((c.x + math.cos(a) * rr, c.y + math.sin(a) * rr, z + dz)))
        rows.append(row)
    if not forked:
        rows.append([at(1.0) - Vector((0, 0, 0.012))])
    bark = rows_loft(m, rows, 'bark_grey', 0.08, cap_top=forked)
    m.paint_by_height(bark, shade('bark_grey', 0.75), 'bark_pale', -0.05, top_z, jitter=0.1)
    if not forked:
        m.paint(bark[-6:], mix('bark_pale', 'bone', 0.5), 0.06)
    else:
        for (a, d), z in zip(fork, (H, H * 0.86)):
            top = at(1.0) + Vector((math.cos(a) * d, math.sin(a) * d, z - top_z))
            mid = at(1.0) + (top - at(1.0)) * 0.5 + Vector((0, 0, 0.02))
            tube(m, [at(1.0) - Vector((0, 0, 0.01)), mid, top], [0.023, 0.016, 0.0], 5, 'bark_pale', 0.1)
    for q in limbs:
        start = at(q['f'])
        a = q['a']
        kink = start + Vector((math.cos(a) * q['len'] * 0.5, math.sin(a) * q['len'] * 0.5, q['rise'] * 0.6))
        b = a + q['turn']
        reach = q['len'] * (0.25 if q['broken'] else 0.55)
        end = kink + Vector((math.cos(b) * reach, math.sin(b) * reach, q['rise'] * 0.5 + 0.02))
        tube(m, [start, kink, end], [0.017, 0.011, 0.0], 4, 'bark_pale', 0.1)
        if not q['broken']:
            c = a + q['twig']
            tube(m, [kink, kink + Vector((math.cos(c) * 0.05, math.sin(c) * 0.05, 0.04))], [0.007, 0.0], 3, 'bark_pale')
    m.ground_ao(0.08, 0.35)
    return m


# -- dry country -----------------------------------------------------------------------

def thorn(rng, lo):
    """A flat-topped thorn tree: a forked trunk holding a wide, wind-flattened crown."""
    H = rng.uniform(0.36, 0.44)
    R = rng.uniform(0.18, 0.21)
    fork_f = rng.uniform(0.3, 0.42)
    lean = Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 0))
    yaw = rng.uniform(0, TAU)
    a0 = rng.uniform(0, TAU)
    limbs = [(a0 + k * TAU / 3 + rng.uniform(-0.4, 0.4), rng.uniform(0.07, 0.12)) for k in range(3)]
    subs = [(a0 + (k + 0.5) * TAU / 3 + rng.uniform(-0.4, 0.4), rng.uniform(0.13, 0.19), rng.uniform(0.06, 0.085),
             rng.uniform(-0.035, -0.012)) for k in range(3)]
    kinks = [Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), rng.uniform(-0.01, 0.015))) for _ in range(3)]
    th = 0.036
    fork = Vector((0, 0, H * fork_f)) + lean * 0.5
    top = Vector((0, 0, H - th)) + lean
    # A flat plate of clumps: a ring round the crown's centre plus outliers on their own boughs.
    plate = [(top + Vector((math.cos(yaw + k * TAU / 6) * R * 0.56, math.sin(yaw + k * TAU / 6) * R * 0.56, rng.uniform(-0.008, 0.01))),
              R * 0.36 * rng.uniform(0.85, 1.15), 0.3, rng.uniform(0, TAU), rng.uniform(1.1, 1.4)) for k in range(6)]
    plate.append((top + Vector((0, 0, 0.01)), R * 0.45, 0.32, yaw, 1.2))
    outliers = [(top + Vector((math.cos(a) * d, math.sin(a) * d, dz)), r * 0.9, 0.32, a, 1.3) for a, d, r, dz in subs]
    tones = (mix('dry_leaf', 'dry_grass', 0.3), mix('dry_leaf', 'moss_dark', 0.35), shade('moss_dark', 0.7))
    m = Mesh(rng)
    if lo:
        tube(m, [(0, 0, -0.05), fork], [0.025, 0.02], 3, 'bark_dark')
        for a, d in limbs[:2]:
            tube(m, [fork, top + Vector((math.cos(a) * d, math.sin(a) * d, 0.0))], [0.014, 0.008], 3, 'bark_dark')
        clumps(m, [(top, R * 1.05, 0.24, yaw, 1.15)], tones, 0.1)
        return m
    bark = tube(m, [(0, 0, -0.05), fork * 0.5, fork], [0.03, 0.023, 0.02], 5, 'bark_dark', 0.1)
    m.paint_by_height(bark, 'bark_dark', 'bark_grey', -0.05, H * 0.5, jitter=0.08)
    for (a, d), kink in zip(limbs, kinks):
        end = top + Vector((math.cos(a) * d, math.sin(a) * d, 0.0))
        limb(m, fork, end, [0.016, 0.011, 0.007], kink, color='bark_grey')
    for c, *_ in outliers:
        tube(m, [fork + (c - fork) * 0.35, c], [0.009, 0.006], 4, 'bark_grey')
    clumps(m, plate + outliers, tones, 0.25)
    m.ground_ao(0.08, 0.35)
    return m


# -- registry ----------------------------------------------------------------------------

for i in (1, 2, 3):
    model(f'fir-{i}', budget=450, lo=60, ground='taiga', size=0.35)(fir)
model('elderfir-1', budget=900, lo=100, ground='taiga', size=0.5)(elderfir)
for i in (1, 2):
    model(f'snowfir-{i}', budget=450, lo=60, ground='snow', size=0.35)(snowfir)
    model(f'pine-{i}', budget=400, lo=60, ground='rock', size=0.4)(pine)
for i in (1, 2, 3):
    model(f'oak-{i}', budget=500, lo=70, ground='forest', size=0.45)(oak)
model('elderoak-1', budget=1000, lo=110, ground='forest', size=0.75)(elderoak)
for i in (1, 2):
    model(f'jungle-{i}', budget=550, lo=70, ground='forest', size=0.5)(jungle)
    model(f'cypress-{i}', budget=500, lo=70, ground='swamp', size=0.4)(cypress)
    model(f'thorn-{i}', budget=350, lo=50, ground='desert', size=0.45)(thorn)
model('palm-1', budget=350, lo=50, ground='beach', size=0.45)(lambda rng, lo: palm(rng, lo, fern=False))
model('palm-2', budget=350, lo=50, ground='forest', size=0.45)(lambda rng, lo: palm(rng, lo, fern=True))
model('snag-1', budget=250, lo=40, ground='swamp', size=0.35)(lambda rng, lo: snag(rng, lo, forked=False))
model('snag-2', budget=250, lo=40, ground='swamp', size=0.35)(lambda rng, lo: snag(rng, lo, forked=True))
