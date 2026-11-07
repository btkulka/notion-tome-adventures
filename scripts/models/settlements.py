"""Settlements: a village, town, city and castle for each culture of the map.

Each model fills one tile around the origin with its gate on the front (-Y).
Cultures follow the biome under the settlement: temperate (grassland, forest,
hills, beach) human kingdoms; north (taiga, snow, mountain) Norse halls and
dwarf-holds; desert sandstone and adobe; marsh (swamp, jungle) stilt villages
and temple-cities.

Plans are drawn from rng before anything is built, so the far-zoom (lo)
versions keep the same layout with plainer, merged buildings.
"""
import math

import bmesh
from mathutils import Matrix, Vector

from kit import Mesh, mix, model, xform

TAU = math.tau
QUARTER = math.pi / 2

# Greyed limestone for fortifications, so walls read as weathered stone rather than cream plaster.
WALL = mix('stone_wall', 'granite', 0.5)
WALL_DARK = mix('stone_wall_dark', 'granite_dark', 0.55)
SAND_WALL = mix('sandstone', 'adobe', 0.5)
DWARF = mix('granite_dark', 'granite', 0.3)
TURF = mix('roof_turf', 'moss_dark', 0.35)
PALACE = mix('marble', 'sandstone_light', 0.35)


# -- primitives -------------------------------------------------------------------

def clean(m, faces, below=-0.95):
    """Drop faces pointing down past `below`: they sit in the ground, on another block or under a roof."""
    keep, drop = [], []
    for f in faces:
        f.normal_update()
        (drop if f.normal.z < below else keep).append(f)
    if drop:
        m.delete(drop)
    return keep


def block(m, size, at, rot=0.0, color='stone_wall', jitter=0.05, taper=0.0):
    return clean(m, m.box(size, at=at, rot=(0, 0, rot), color=color, jitter=jitter, taper=taper))


def decal(m, outline, at, rot=0.0, color='basalt'):
    """One face in the local XZ plane facing -Y: doors, windows, gates, carved bands."""
    mat = xform(at, (0, 0, rot))
    verts = [m.bm.verts.new(mat @ Vector((x, 0.0, z))) for x, z in outline]
    return m.paint([m.bm.faces.new(verts)], color)


def opening(m, w, h, at, rot=0.0, shape='round', color='basalt'):
    """A dark doorway, window or gate set just proud of a wall that faces -Y (turned by rot)."""
    if shape == 'pointed':
        pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h * 0.6), (0, h), (-w / 2, h * 0.6)]
    elif shape == 'round':
        pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h * 0.66), (w * 0.33, h * 0.92), (0, h), (-w * 0.33, h * 0.92), (-w / 2, h * 0.66)]
    else:
        pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h), (-w / 2, h)]
    return decal(m, pts, at, rot, color)


def facing(dx, dy):
    """The rot that turns a -Y-facing decal or front to face direction (dx, dy)."""
    return math.atan2(dy, dx) + QUARTER


def roof(m, length, depth, rise, at, rot=0.0, color='roof_slate', eave=0.014, thick=0.011, jitter=0.06, solid=False):
    """Pitched roof with its ridge along local X (turned by rot); `at` is the centre of the eave line.

    The undersides are dropped: the map camera looks down and never sees them,
    and the end caps still show the roof's thickness at the gables.
    """
    a = depth / 2 + eave
    if solid:
        outline = [(-a, 0.0), (a, 0.0), (0.0, rise)]
    else:
        s = math.hypot(a, rise)
        tv, k = thick * s / a, min(a * 0.6, thick * s / rise)
        outline = [(-a, 0.0), (-a + k, 0.0), (0.0, rise - tv), (a - k, 0.0), (a, 0.0), (0.0, rise)]
    faces = m.prism(outline, length, at=at, rot=(0, 0, rot + QUARTER), color=color, jitter=jitter)
    return clean(m, faces, below=-0.2)


def gables(m, length, depth, rise, z, rot=0.0, color='timber', eave=0.014, thick=0.011):
    """The triangular wall under each end of a roof() of the same size."""
    a = depth / 2 + eave
    h = max(0.01, (rise - thick * math.hypot(a, rise) / a) * 0.97)
    for side in (1, -1):
        c, s = math.cos(rot) * side * length / 2, math.sin(rot) * side * length / 2
        decal(m, [(-depth / 2, 0), (depth / 2, 0), (0, h)], (c, s, z), rot + (QUARTER if side == 1 else -QUARTER), color)


def snow_ridge(m, length, depth, rise, z, rot=0.0, eave=0.014, share=0.2):
    """A narrow band of snow along a roof() ridge, parallel to the slopes."""
    a = depth / 2 + eave
    b = a * share
    roof(m, length + 0.006, b * 2, rise * share, (0, 0, z + rise * (1 - share) + 0.003), rot=rot, color='snow', eave=0.0, solid=True, jitter=0.03)


def insert(m, sub, at=(0, 0, 0), rot=0.0):
    """Copy sub's faces and colours into m, turned by rot about Z and moved to `at`.

    Used instead of kit's Mesh.insert, which finds the new vertices by diffing
    set(bm.verts) and can catch the existing ones too.
    """
    mat = xform(at, (0, 0, rot))
    sub.bm.verts.index_update()
    new = [m.bm.verts.new(mat @ v.co) for v in sub.bm.verts]
    for f in sub.bm.faces:
        nf = m.bm.faces.new([new[v.index] for v in f.verts])
        for dst, src in zip(nf.loops, f.loops):
            dst[m.col] = src[sub.col]


def place(m, at, rot, build, *args, **kw):
    """Build into a scratch Mesh at the origin, then copy it into m at `at` turned by rot."""
    sub = Mesh(m.rng)
    build(sub, *args, **kw)
    insert(m, sub, (at[0], at[1], at[2] if len(at) > 2 else 0.0), rot)
    sub.bm.free()


def blob(m, radius, at, scale=1.0, subdiv=1, color='oak', jitter=0.1):
    """An icosphere clump; kit's blob has the same vertex-diffing problem as its insert."""
    verts = bmesh.ops.create_icosphere(m.bm, subdivisions=subdiv, radius=radius, matrix=Matrix.Identity(4))['verts']
    for v in verts:
        v.co *= 1.0 + m.rng.uniform(-0.12, 0.12)
    bmesh.ops.transform(m.bm, matrix=xform(at, (0, 0, 0), scale), verts=verts)
    return m.paint(list({f for v in verts for f in v.link_faces}), color, jitter)


def rotated(x, y, a):
    c, s = math.cos(a), math.sin(a)
    return x * c - y * s, x * s + y * c


def stair(m, y0, y1, height, width, steps, at=(0, 0, 0), rot=0.0, color='granite'):
    """A flight of steps rising from local y0 (front, bottom) to y1 (top), centred on local x = 0."""
    run, rise = (y1 - y0) / steps, height / steps
    pts = [(y0, 0.0)]
    for k in range(steps):
        pts += [(y0 + k * run, (k + 1) * rise), (y0 + (k + 1) * run, (k + 1) * rise)]
    pts += [(y1 + 0.03, height), (y1 + 0.03, 0.0)]
    faces = m.prism(pts, width, at=at, rot=(0, 0, rot + QUARTER), color=color, jitter=0.05)
    return clean(m, faces)


# -- shared buildings -----------------------------------------------------------------

def banner(m, at, h=0.08, color='oxblood', rot=0.0):
    """A small heraldic swallowtail on an iron pole with a gilt tip."""
    x, y, z = at
    m.cylinder(0.003, 0.0022, h, seg=4, at=(x, y, z), color='iron', cap_bottom=False)
    fl, fh = 0.048, 0.024
    m.prism([(0.0, 0.0), (fl, 0.0), (fl * 0.7, fh * 0.5), (fl, fh), (0.0, fh)], 0.003,
            at=(x, y, z + h - fh - 0.006), rot=(0, 0, rot), color=color)
    m.cylinder(0.0045, 0.0, 0.014, seg=4, at=(x, y, z + h), color='gilt', cap_bottom=False)


def parapet_round(m, r, h, seg, wall):
    """Corbelled walk with merlons around a round tower top."""
    m.loft([(h, r), (h + 0.012, r * 1.14), (h + 0.03, r * 1.14), (h + 0.03, r * 0.96), (h + 0.014, r * 0.96)],
           seg=seg, color=wall, jitter=0.05, cap_bottom=False, cap_top=True)
    rr = r * 1.05 * math.cos(math.pi / seg)
    for i in range(seg):
        a = (i + 0.5) * TAU / seg
        block(m, (r * 0.38, r * 0.16, 0.022), (math.cos(a) * rr, math.sin(a) * rr, h + 0.03), rot=a + QUARTER, color=wall, jitter=0.07)


def round_tower(m, r, h, lo, roof_h=0.0, wall='stone_wall', roof_col='roof_slate', seg=8, finial='gilt',
                cren=False, flag=None, footing=True, base=-0.05):
    """A round tower on the origin: a conical roof if roof_h, else a crenellated top."""
    s = 5 if lo else seg
    rings = [(base, r * 1.08), (base + 0.07, r), (h, r)] if footing and not lo else [(base, r), (h, r)]
    m.loft(rings, seg=s, color=wall, jitter=0.05, cap_bottom=False, cap_top=not roof_h and (lo or not cren))
    if roof_h:
        m.loft([(h - 0.004, r * 1.25), (h + roof_h, 0.0)], seg=s, color=roof_col, jitter=0.06, cap_bottom=False)
        if not lo and flag:
            banner(m, (0, 0, h + roof_h - 0.012), 0.075, flag)
        elif not lo and finial:
            m.cylinder(0.0045, 0.0, 0.045, seg=4, at=(0, 0, h + roof_h - 0.01), color=finial, cap_bottom=False)
    elif cren and not lo:
        parapet_round(m, r, h, s, wall)
        if flag:
            banner(m, (0, 0, h + 0.014), 0.09, flag)


def square_parapet(m, s, h, wall, merlons=4):
    """Corbelled crenellated walk around the top of a square block of side s."""
    R = s / math.sqrt(2)
    m.loft([(h, R), (h + 0.012, R * 1.07), (h + 0.03, R * 1.07), (h + 0.03, R * 0.96), (h + 0.014, R * 0.96)],
           seg=4, phase=math.pi / 4, color=wall, jitter=0.05, cap_bottom=False, cap_top=True)
    half = s * 1.07 / 2 - 0.006
    for side in range(4):
        a = side * QUARTER
        for k in range(merlons):
            t = (k + 0.5) / merlons - 0.5
            x, y = rotated(half, t * s * 1.0, a)
            block(m, (0.013, s / merlons * 0.5, 0.022), (x, y, h + 0.03), rot=a, color=wall, jitter=0.07)


def wall_run(m, p0, p1, h, t, lo, color='stone_wall', merlon=0.05, taper=0.0, pointed=False, plinth=None):
    """A curtain wall from p0 to p1 with merlons along its outer edge and an optional battered plinth."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L, a = math.hypot(dx, dy), math.atan2(dy, dx)
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    block(m, (L, t, h + 0.05), (mx, my, -0.05), rot=a, color=color, jitter=0.04, taper=taper)
    if plinth and not lo:
        block(m, (L, t + 0.02, 0.085), (mx, my, -0.05), rot=a, color=plinth, jitter=0.04, taper=0.12)
    if lo or not merlon:
        return
    nx, ny = -math.sin(a), math.cos(a)
    if nx * mx + ny * my < 0:
        nx, ny = -nx, -ny
    n = max(1, round(L / merlon))
    off = t * (1 - taper) / 2 - 0.007
    for i in range(n):
        f = (i + 0.5) / n
        x, y = p0[0] + dx * f + nx * off, p0[1] + dy * f + ny * off
        if pointed:
            m.loft([(h, 0.011), (h + 0.026, 0.0)], seg=4, phase=math.pi / 4, at=(x, y, 0), rot=(0, 0, a),
                   scale=(L / n * 0.75 / 0.0155, 0.9, 1.0), color=color, jitter=0.07, cap_bottom=False)
        else:
            block(m, (L / n * 0.52, 0.012, 0.022), (x, y, h), rot=a, color=color, jitter=0.07)


def small_tree(m, at, size=1.0, leaf='oak', lo=False):
    x, y = at
    m.cylinder(0.009 * size, 0.006 * size, 0.07 * size, seg=4, at=(x, y, -0.04), color='bark', cap_bottom=False)
    blob(m, 0.05 * size, (x, y, 0.075 * size), scale=(1.0, 1.0, 0.85), subdiv=1 if lo else 2, color=leaf, jitter=0.12)


def small_palm(m, at, h=0.17, lean=(0.02, 0.0), lo=False):
    x, y = at
    m.loft([(-0.04, 0.008), (h * 0.5, 0.0065, lean[0] * 0.3, lean[1] * 0.3), (h, 0.005, lean[0], lean[1])],
           seg=4, at=(x, y, 0), color='bark_grey', jitter=0.08, cap_bottom=False)
    if lo:
        blob(m, 0.045, (x + lean[0], y + lean[1], h), scale=(1, 1, 0.4), subdiv=1, color='palm')
        return
    for i in range(6):
        a = i * TAU / 6 + 0.3
        m.prism([(0.0, 0.0), (0.03, 0.01), (0.068, -0.016), (0.032, -0.002)], 0.016,
                at=(x + lean[0], y + lean[1], h), rot=(0, 0, a), color='palm', jitter=0.1)


def pool(m, r, at=(0, 0), seg=12, wobble=0.16, z=0.004, scale=(1.0, 1.0, 1.0), color='water_dark', phase=0.0):
    """A flat patch of dark standing water (seg=4 with phase π/4 and r=√½ makes a rectangle of `scale`)."""
    return m.loft([(z, r)], seg=seg, at=(at[0], at[1], 0), scale=scale, wobble=wobble, cap_bottom=False, cap_top=True,
                  color=color, phase=phase)


def lo_block(m, length, depth, top, rise, wall, roof_col):
    block(m, (length, depth, top + 0.05), (0, 0, -0.05), color=wall, jitter=0.03)
    if rise and roof_col:
        roof(m, length, depth, rise, (0, 0, top), color=roof_col, solid=True, eave=0.008)


# -- rows of houses ---------------------------------------------------------------------

def plan_row(rng, start, end, depth, face, make, gap=0.003, min_w=0.06, max_w=0.095, gable_front=0.3):
    """Houses side by side along the centre line start→end with fronts toward `face`
    (+1 the left of the run, -1 the right). Neighbouring roofs never share a height."""
    (x0, y0), (x1, y1) = start, end
    L, a = math.hypot(x1 - x0, y1 - y0), math.atan2(y1 - y0, x1 - x0)
    houses, t, prev = [], 0.0, None
    while L - t > min_w * 0.6:
        w = rng.uniform(min_w, max_w)
        if L - t - w < min_w:
            w = L - t
        gf = rng.random() < gable_front
        s = make(rng, depth, w) if gf else make(rng, w, depth)
        if prev is not None and abs(s['h1'] + s['h2'] - prev) < 0.009:
            s['h1'] += 0.013
        prev = s['h1'] + s['h2']
        c = t + w / 2
        if gf:
            s['rot'], s['door'] = (a + QUARTER if face < 0 else a - QUARTER), 'end'
        else:
            s['rot'], s['door'] = (a if face < 0 else a + math.pi), 'front'
        s['x'], s['y'] = x0 + math.cos(a) * c, y0 + math.sin(a) * c
        houses.append(s)
        t += w + gap
    return {'start': start, 'end': end, 'depth': depth, 'houses': houses}


def build_rows(m, rows, lo, build, wall, roof_col, rise_k=0.8):
    for row in rows:
        if lo:
            (x0, y0), (x1, y1) = row['start'], row['end']
            hs = row['houses']
            top = sum(s['h1'] + s['h2'] for s in hs) / len(hs)
            place(m, ((x0 + x1) / 2, (y0 + y1) / 2), math.atan2(y1 - y0, x1 - x0), lo_block,
                  math.hypot(x1 - x0, y1 - y0), row['depth'], top, row['depth'] * rise_k, wall, roof_col)
        else:
            for s in row['houses']:
                place(m, (s['x'], s['y']), s['rot'], build, s, False)


# -- temperate ----------------------------------------------------------------------------

def temperate_maker(roofs=('roof_slate', 'roof_slate', 'roof_tile', 'roof_thatch'), h1=(0.05, 0.064), upper=0.65,
                    h2=(0.036, 0.05), rise=(0.72, 0.95)):
    def make(rng, w, d):
        roof_col = rng.choice(roofs)
        h2v = rng.uniform(*h2) if rng.random() < upper else 0.0
        return {
            'w': w, 'd': d, 'h1': rng.uniform(*h1), 'h2': h2v, 'rise': d * rng.uniform(*rise), 'roof': roof_col,
            'base': rng.choice(('stone_wall', 'stone_wall', 'stone_wall_dark')),
            'wall': rng.choice(('plaster', 'plaster', 'plaster_dark')),
            'gable': 'plaster_dark' if roof_col == 'roof_thatch' else 'timber',
            'chimney': 0 if roof_col == 'roof_thatch' else rng.choice((0, 1, -1, 1)),
            'door': 'front', 'door_x': rng.uniform(-0.22, 0.22), 'windows': rng.random() < 0.75, 'end': 0.004,
        }
    return make


def house(m, s, lo):
    """A temperate house: stone ground floor, jettied timber-framed upper storey, steep roof; ridge along X, front -Y."""
    w, d, h1, h2, rise = s['w'], s['d'], s['h1'], s['h2'], s['rise']
    thatch = s['roof'] == 'roof_thatch'
    if lo:
        lo_block(m, w, d, h1 + h2, rise, s['wall'] if h2 else s['base'], s['roof'])
        return
    block(m, (w, d, h1 + 0.05), (0, 0, -0.05), color=s['base'])
    top, jw, jd = h1, w, d
    if h2:
        jw, jd = w + 0.008, d + 0.01
        block(m, (jw, jd, h2), (0, 0, h1), color=s['wall'], jitter=0.04)
        top = h1 + h2
    eave = 0.018 if thatch else 0.013
    thick = 0.017 if thatch else 0.011
    gables(m, jw, jd, rise, top, color=s['gable'], eave=eave, thick=thick)
    roof(m, jw + 2 * s.get('end', 0.01), jd, rise, (0, 0, top), color=s['roof'], eave=eave, thick=thick, jitter=0.09 if thatch else 0.06)
    if s.get('chimney'):
        block(m, (0.017, 0.017, rise * 0.78 + 0.02), (s['chimney'] * jw * 0.3, jd * 0.15, top + rise * 0.3), color='stone_wall_dark')
    dh = min(0.04, h1 * 0.72)
    if s.get('door') == 'end':
        opening(m, 0.02, dh, (-w / 2 - 0.0015, 0, 0), rot=-QUARTER, color='timber_dark')
    else:
        opening(m, 0.02, dh, (s.get('door_x', 0.0) * w, -d / 2 - 0.0015, 0), color='timber_dark')
    if s.get('windows') and h2 and w > 0.07:
        for wx in (-0.25, 0.25):
            opening(m, 0.013, 0.016, (wx * jw, -jd / 2 - 0.0015, h1 + h2 * 0.3), shape='rect', color='timber_dark')


def church(m, s, lo):
    """Nave along Y with the altar to +Y; bell tower and broach spire at the front (-Y)."""
    L, w, h, rise = s['L'], s['w'], s['h'], s['rise']
    ts, th, sh = s['tower'], s['tower_h'], s['spire_h']
    ty = -L / 2 - ts / 2 + 0.012
    if lo:
        lo_block(m, L, w, h, rise, 'stone_wall', 'roof_slate')
        m.transform(list(m.bm.faces), rot=(0, 0, QUARTER))
        block(m, (ts, ts, th + 0.05), (0, ty, -0.05), color='stone_wall')
        m.loft([(th, ts * 0.7), (th + sh, 0.0)], seg=4, phase=math.pi / 4, at=(0, ty, 0), cap_bottom=False, color='roof_slate')
        return
    block(m, (w, L, h + 0.05), (0, 0, -0.05), color='stone_wall', jitter=0.04)
    gables(m, L, w, rise, h, rot=QUARTER, color='stone_wall')
    roof(m, L + 0.016, w, rise, (0, 0, h), rot=QUARTER, color='roof_slate')
    # apse
    m.loft([(-0.05, w * 0.4), (h * 0.85, w * 0.4)], seg=6, at=(0, L / 2, 0), color='stone_wall', cap_bottom=False, cap_top=False, jitter=0.04)
    m.loft([(h * 0.85 - 0.003, w * 0.48), (h * 0.85 + rise * 0.55, 0.0)], seg=6, at=(0, L / 2, 0), color='roof_slate', cap_bottom=False)
    n = max(2, int(L / 0.06))
    for side in (-1, 1):
        for k in range(n):
            y = -L / 2 + (k + 0.6) * L / (n + 0.2)
            opening(m, 0.011, h * 0.5, (side * (w / 2 + 0.0015), y, h * 0.25), rot=side * QUARTER, shape='pointed')
    # tower and spire
    block(m, (ts, ts, th + 0.05), (0, ty, -0.05), color='stone_wall', jitter=0.04)
    for k in range(4):
        a = k * QUARTER
        x, y = rotated(0, -ts / 2 - 0.0015, a)
        opening(m, ts * 0.32, ts * 0.45, (x, ty + y, th - ts * 0.6), rot=a, shape='pointed')
    opening(m, 0.024, 0.045, (0, ty - ts / 2 - 0.0015, 0), color='timber_dark')
    m.loft([(th - 0.004, ts * 0.66), (th + sh, 0.0)], seg=8, phase=math.pi / 8, at=(0, ty, 0), color='roof_slate', jitter=0.05, cap_bottom=False)
    m.cylinder(0.0035, 0.0, 0.04, seg=4, at=(0, ty, th + sh - 0.01), color='gilt', cap_bottom=False)
    m.box((0.022, 0.004, 0.004), at=(0, ty, th + sh + 0.012), color='gilt')


def cathedral(m, lo):
    """Cruciform cathedral: twin-spired west front to -Y, transept, apse, flying buttresses and a crossing flèche."""
    L, w, h, rise = 0.28, 0.12, 0.15, 0.11
    ts, th, sh = 0.064, 0.33, 0.33
    ty = -L / 2 - ts / 2 + 0.01
    tx = w / 2 - 0.002
    cy = 0.055
    if lo:
        lo_block(m, L, w, h, rise, 'stone_wall', 'roof_slate')
        m.transform(list(m.bm.faces), rot=(0, 0, QUARTER))
        place(m, (0, cy), 0.0, lo_block, 0.26, 0.09, h, rise * 0.85, 'stone_wall', 'roof_slate')
        for sx in (-1, 1):
            block(m, (ts, ts, th + 0.05), (sx * tx, ty, -0.05), color='stone_wall')
            m.loft([(th, ts * 0.66), (th + sh, 0.0)], seg=4, phase=math.pi / 4, at=(sx * tx, ty, 0), cap_bottom=False, color='roof_slate')
        return
    block(m, (w, L, h + 0.05), (0, 0, -0.05), color='stone_wall', jitter=0.04)
    roof(m, L, w, rise, (0, 0, h), rot=QUARTER, color='roof_slate')
    # transept
    block(m, (0.26, 0.09, h + 0.05), (0, cy, -0.05), color='stone_wall', jitter=0.04)
    gables(m, 0.26, 0.09, rise * 0.85, h, color='stone_wall_dark')
    roof(m, 0.26 + 0.014, 0.09, rise * 0.85, (0, cy, h), color='roof_slate')
    for sx in (-1, 1):
        opening(m, 0.04, 0.04, (sx * 0.1315, cy, h * 0.42), rot=sx * QUARTER, shape='round', color='basalt')
    # apse
    m.loft([(-0.05, w * 0.42), (h * 0.9, w * 0.42)], seg=8, at=(0, L / 2, 0), color='stone_wall', cap_bottom=False, cap_top=False, jitter=0.04)
    m.loft([(h * 0.9 - 0.003, w * 0.5), (h * 0.9 + rise * 0.6, 0.0)], seg=8, at=(0, L / 2, 0), color='roof_slate', cap_bottom=False)
    # flying buttresses and clerestory lancets along the nave
    for side in (-1, 1):
        for y in (-0.105, -0.045, 0.115):
            m.prism([(0.0, -0.05), (0.036, -0.05), (0.036, h * 0.45), (0.0, h * 0.92)], 0.012,
                    at=(side * w / 2, y, 0), rot=(0, 0, 0 if side > 0 else math.pi), color='stone_wall_dark', jitter=0.05)
        for y in (-0.075, -0.015):
            opening(m, 0.012, h * 0.5, (side * (w / 2 + 0.0015), y, h * 0.3), rot=side * QUARTER, shape='pointed')
    # crossing flèche
    m.loft([(h + rise * 0.6, 0.02), (h + rise + 0.03, 0.017), (h + rise + 0.03, 0.022), (h + rise + 0.25, 0.0)],
           seg=8, phase=math.pi / 8, at=(0, cy, 0), color='roof_slate_light', cap_bottom=False)
    m.cylinder(0.0035, 0.0, 0.035, seg=4, at=(0, cy, h + rise + 0.24), color='gilt', cap_bottom=False)
    # west front: towers, spires, portal, rose window
    for sx in (-1, 1):
        x = sx * tx
        block(m, (ts, ts, th + 0.05), (x, ty, -0.05), color='stone_wall', jitter=0.04)
        block(m, (ts + 0.006, ts + 0.006, 0.012), (x, ty, th * 0.55), color='stone_wall_dark')
        for k in range(4):
            a = k * QUARTER
            ox, oy = rotated(0, -ts / 2 - 0.0015, a)
            opening(m, ts * 0.3, ts * 0.55, (x + ox, ty + oy, th - ts * 0.75), rot=a, shape='pointed')
        m.loft([(th - 0.003, ts * 0.64), (th + sh, 0.0)], seg=8, phase=math.pi / 8, at=(x, ty, 0), color='roof_slate', jitter=0.05, cap_bottom=False)
        for k in range(4):
            a = k * QUARTER + math.pi / 4
            px, py = rotated(ts * 0.47, 0, a)
            m.cylinder(0.006, 0.0, 0.05, seg=4, at=(x + px, ty + py, th - 0.003), color='stone_wall', cap_bottom=False)
        m.cylinder(0.004, 0.0, 0.045, seg=4, at=(x, ty, th + sh - 0.012), color='gilt', cap_bottom=False)
    front = ty - ts / 2 + 0.012
    block(m, (2 * tx - ts + 0.004, 0.03, h + rise * 0.6 + 0.05), (0, front + 0.015, -0.05), color='stone_wall', jitter=0.03)
    opening(m, 0.034, 0.075, (0, front - 0.0015, 0), shape='pointed', color='timber_dark')
    rose = [(math.cos(a) * 0.017, h * 0.78 + math.sin(a) * 0.017) for a in [i * TAU / 8 + math.pi / 8 for i in range(8)]]
    decal(m, rose, (0, front - 0.0015, 0), color='basalt')
    decal(m, [(math.cos(a) * 0.006, h * 0.78 + math.sin(a) * 0.006) for a in [i * TAU / 6 for i in range(6)]], (0, front - 0.0025, 0), color='gilt')


def keep(m, s, h, lo, roof_h=0.12, turret_r=0.03, flags=(0, 2), wall=WALL):
    """A square keep with a string course, a corbelled crenellated walk, a hipped roof inside it and corner turrets."""
    block(m, (s, s, h + 0.05), (0, 0, -0.05), color=wall, jitter=0.04)
    R = s / math.sqrt(2)
    if lo:
        m.loft([(h, R * 0.95), (h + roof_h, 0.0)], seg=4, phase=math.pi / 4, cap_bottom=False, color='roof_slate')
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            m.loft([(h * 0.8, turret_r), (h + 0.06, turret_r), (h + 0.14, 0.0)], seg=4, at=(sx * s / 2, sy * s / 2, 0),
                   cap_bottom=False, color=wall)
        return
    block(m, (s + 0.012, s + 0.012, 0.012), (0, 0, h * 0.5), color=WALL_DARK, jitter=0.03)
    square_parapet(m, s, h, wall)
    m.loft([(h + 0.012, R * 0.86), (h + roof_h, 0.0)], seg=4, phase=math.pi / 4, color='roof_slate', jitter=0.05, cap_bottom=False)
    for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        x, y = sx * s / 2, sy * s / 2
        z0 = h * 0.72
        m.loft([(z0 - 0.06, 0.0), (z0, turret_r)], seg=6, at=(x, y, 0), color=WALL_DARK, jitter=0.05, cap_top=False)
        place(m, (x, y, z0), 0.0, round_tower, turret_r, h - z0 + 0.075, False, roof_h=0.085, seg=6, footing=False,
              base=0.0, wall=wall, flag='oxblood' if i in flags else None)
    for k in range(4):
        a = k * QUARTER
        for t in (-0.22, 0.22):
            x, y = rotated(t * s, -s / 2 - 0.0015, a)
            opening(m, 0.01, 0.026, (x, y, h * 0.62), rot=a)
        x, y = rotated(0, -s / 2 - 0.0015, a)
        opening(m, 0.012, 0.03, (x, y, h * 0.3), rot=a)
    opening(m, 0.03, 0.05, (0, -s / 2 - 0.0016, 0), color='timber_dark')


def gatehouse(m, y, h, lo, tower_r=0.045, gap=0.06, depth=0.07, wall=WALL, roof_h=0.0, roof_col='roof_slate',
              shape='round', flag=None, seg=8):
    """Twin round towers flanking a dark gate on the front wall line y; the gate faces -Y."""
    tx = gap / 2 + tower_r * 0.75
    for sx in (-1, 1):
        place(m, (sx * tx, y), 0.0, round_tower, tower_r, h + 0.04, lo, roof_h=roof_h, wall=wall, roof_col=roof_col,
              cren=not roof_h, flag=flag if sx > 0 else None, seg=seg)
    block(m, (2 * tx, depth, h + 0.05), (0, y, -0.05), color=wall, jitter=0.04)
    if lo:
        return
    opening(m, gap * 0.82, h * 0.62, (0, y - depth / 2 - 0.0015, 0), shape=shape)
    block(m, (2 * tx + 0.004, depth + 0.006, 0.01), (0, y, h - 0.012), color=WALL_DARK, jitter=0.03)
    for k in range(3):
        x = (k - 1) * tx * 0.55
        for side in (-1, 1):
            block(m, (tx * 0.3, 0.012, 0.022), (x, y + side * (depth / 2 - 0.006), h), color=wall, jitter=0.06)


def square_curtain(m, C, H, T, lo, gate_half, wall=WALL, merlon=0.05, taper=0.0, pointed=False, plinth=WALL_DARK):
    """Four walls on a square of half-size C with a gate gap of gate_half either side of x = 0 at the front."""
    runs = [((-C, -C), (-gate_half, -C)), ((gate_half, -C), (C, -C)), ((C, -C), (C, C)), ((C, C), (-C, C)), ((-C, C), (-C, -C))]
    for p0, p1 in runs:
        wall_run(m, p0, p1, H, T, lo, color=wall, merlon=merlon, taper=taper, pointed=pointed, plinth=plinth)


def village_temperate(rng, lo):
    m = Mesh(rng)
    make = temperate_maker(roofs=('roof_thatch', 'roof_thatch', 'roof_slate', 'roof_tile'), upper=0.5, h1=(0.058, 0.07))
    plans = []
    for deg, r, big in ((-146, 0.235, True), (-34, 0.235, True), (14, 0.25, True), (166, 0.25, True),
                        (52, 0.335, False), (128, 0.335, False)):
        a = math.radians(deg + rng.uniform(-6, 6))
        if big:
            s = make(rng, rng.uniform(0.175, 0.205), rng.uniform(0.11, 0.125))
        else:
            s = make(rng, rng.uniform(0.11, 0.13), 0.085)
            s.update(h2=0.0, roof='roof_thatch', gable='plaster_dark', chimney=0, h1=0.05)
        s['end'] = 0.012
        plans.append((a, r, s))
    chapel = {'L': 0.2, 'w': 0.1, 'h': 0.09, 'rise': 0.085, 'tower': 0.062, 'tower_h': 0.2, 'spire_h': 0.18}
    chapel_a = math.radians(90 + rng.uniform(-5, 5))
    trees = [(math.radians(d + rng.uniform(-8, 8)), rng.uniform(0.37, 0.4), rng.uniform(0.9, 1.15)) for d in (-118, -62, 196, -14, 124)]
    hay = [(math.radians(d + rng.uniform(-6, 6)), 0.39) for d in (40, 150)]

    for a, r, s in plans:
        place(m, (math.cos(a) * r, math.sin(a) * r), a - QUARTER, house, s, lo)
    place(m, (math.cos(chapel_a) * 0.265, math.sin(chapel_a) * 0.265), chapel_a - QUARTER, church, chapel, lo)
    for a, r, k in trees:
        small_tree(m, (math.cos(a) * r, math.sin(a) * r), k, lo=lo)
    if not lo:
        for a, r in hay:
            m.loft([(-0.02, 0.026), (0.025, 0.024), (0.05, 0.0)], seg=6, at=(math.cos(a) * r, math.sin(a) * r, 0),
                   color='dry_grass', jitter=0.08, cap_bottom=False)
        # well on the green
        m.loft([(-0.04, 0.03), (0.028, 0.03), (0.028, 0.022), (0.02, 0.022)], seg=6, at=(0, -0.03, 0), color=WALL_DARK, jitter=0.06,
               cap_bottom=False)
        for sx in (-1, 1):
            m.box((0.006, 0.006, 0.07), at=(sx * 0.026, -0.03, 0.02), color='timber')
        roof(m, 0.07, 0.05, 0.03, (0, -0.03, 0.085), color='roof_thatch', eave=0.006, thick=0.008)
        # dry-stone walls closing the garden plots behind the houses
        for p0, p1 in (((-0.4, -0.04), (-0.4, 0.18)), ((-0.4, 0.18), (-0.27, 0.33)), ((0.4, -0.02), (0.4, 0.17))):
            wall_run(m, p0, p1, 0.024, 0.014, lo, color=WALL_DARK, merlon=0)
    m.ground_ao(0.06, 0.35)
    return m


def town_temperate(rng, lo):
    m = Mesh(rng)
    C, H, T = 0.4, 0.12, 0.034
    make = temperate_maker()
    rows = [
        plan_row(rng, (-0.105, -0.355), (-0.105, -0.1), 0.105, -1, make),
        plan_row(rng, (-0.215, -0.355), (-0.215, -0.1), 0.105, +1, make),
        plan_row(rng, (0.105, -0.355), (0.105, -0.1), 0.105, +1, make),
        plan_row(rng, (0.215, -0.355), (0.215, -0.1), 0.105, -1, make),
        plan_row(rng, (-0.36, 0.125), (-0.09, 0.125), 0.1, -1, make),
        plan_row(rng, (-0.36, 0.235), (-0.09, 0.235), 0.1, +1, make),
        plan_row(rng, (0.315, 0.0), (0.315, 0.355), 0.1, +1, make),
    ]
    chapel = {'L': 0.24, 'w': 0.11, 'h': 0.105, 'rise': 0.09, 'tower': 0.068, 'tower_h': 0.25, 'spire_h': 0.24}

    square_curtain(m, C, H, T, lo, 0.07)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        place(m, (sx * C, sy * C), 0.0, round_tower, 0.056, 0.2, lo, roof_h=0.13, wall=WALL)
    gatehouse(m, -C, 0.15, lo, tower_r=0.044, gap=0.058, roof_h=0.1)
    build_rows(m, rows, lo, house, 'plaster', 'roof_slate')
    place(m, (0.165, 0.2), 0.0, church, chapel, lo)
    if not lo:
        block(m, (0.03, 0.03, 0.02), (-0.06, 0.0, -0.02), color=WALL_DARK)
        m.cylinder(0.006, 0.005, 0.07, seg=4, at=(-0.06, 0.0, 0.0), color='stone_wall')
        m.box((0.026, 0.006, 0.006), at=(-0.06, 0.0, 0.052), color='stone_wall')
    m.ground_ao(0.06, 0.35)
    return m


def city_temperate(rng, lo):
    m = Mesh(rng)
    C, H, T = 0.415, 0.15, 0.04
    make = temperate_maker(roofs=('roof_slate', 'roof_slate', 'roof_tile', 'roof_slate_light'), upper=0.85,
                           h1=(0.055, 0.07), h2=(0.04, 0.06))
    kw = dict(min_w=0.055, max_w=0.085)
    rows = [
        plan_row(rng, (-0.375, -0.22), (-0.05, -0.22), 0.095, +1, make, **kw),
        plan_row(rng, (-0.37, -0.33), (-0.125, -0.33), 0.09, -1, make, **kw),
        plan_row(rng, (0.05, -0.22), (0.375, -0.22), 0.095, +1, make, **kw),
        plan_row(rng, (0.125, -0.33), (0.37, -0.33), 0.09, -1, make, **kw),
        plan_row(rng, (-0.215, -0.13), (-0.215, 0.37), 0.1, -1, make, **kw),
        plan_row(rng, (-0.32, -0.13), (-0.32, 0.35), 0.095, +1, make, **kw),
        plan_row(rng, (0.215, -0.13), (0.215, 0.37), 0.1, +1, make, **kw),
        plan_row(rng, (0.32, -0.13), (0.32, 0.35), 0.095, -1, make, **kw),
        plan_row(rng, (-0.155, 0.345), (-0.06, 0.345), 0.08, -1, make, **kw),
        plan_row(rng, (0.06, 0.345), (0.155, 0.345), 0.08, -1, make, **kw),
    ]

    square_curtain(m, C, H, T, lo, 0.08, merlon=0.056)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        place(m, (sx * C, sy * C), 0.0, round_tower, 0.052, 0.25, lo, roof_h=0.15, wall=WALL)
    for x, y in ((-C, 0.0), (C, 0.0), (0.0, C)):
        place(m, (x, y), 0.0, round_tower, 0.044, 0.22, lo, roof_h=0.12, wall=WALL)
    gatehouse(m, -C, 0.2, lo, tower_r=0.048, gap=0.066, depth=0.08, flag='oxblood')
    build_rows(m, rows, lo, house, 'plaster', 'roof_slate')
    place(m, (0.0, 0.12), 0.0, cathedral, lo)
    if not lo:
        m.cylinder(0.014, 0.012, 0.035, seg=6, at=(0.0, -0.125, -0.02), color=WALL_DARK)
        m.cylinder(0.005, 0.0, 0.06, seg=4, at=(0.0, -0.125, 0.015), color='gilt', cap_bottom=False)
    m.ground_ao(0.06, 0.35)
    return m


def castle_temperate(rng, lo):
    m = Mesh(rng)
    C, H, T = 0.365, 0.16, 0.046
    make = temperate_maker(roofs=('roof_slate', 'roof_slate_light'), upper=0.3)
    side_row = plan_row(rng, (-0.285, -0.27), (-0.285, 0.1), 0.085, -1, make, min_w=0.07, max_w=0.1, gable_front=0.0)
    hall = {'w': 0.24, 'd': 0.1, 'h1': 0.09, 'h2': 0.0, 'rise': 0.085, 'roof': 'roof_slate', 'base': WALL,
            'wall': 'plaster', 'gable': WALL_DARK, 'chimney': 1, 'door': 'front', 'door_x': 0.0, 'windows': False, 'end': 0.01}

    square_curtain(m, C, H, T, lo, 0.065)
    for i, (sx, sy) in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
        place(m, (sx * C, sy * C), 0.0, round_tower, 0.072, 0.27, lo, roof_h=0.16, wall=WALL, flag='oxblood' if i % 2 == 0 else None)
    gatehouse(m, -C, 0.21, lo, tower_r=0.05, gap=0.056, depth=0.08)
    place(m, (0.03, 0.06), 0.0, keep, 0.2, 0.41, lo)
    place(m, (-0.12, 0.285), math.pi, house, hall, lo)
    build_rows(m, [side_row], lo, house, 'plaster', 'roof_slate')
    m.ground_ao(0.06, 0.35)
    return m


# -- north ------------------------------------------------------------------------------------

def north_maker(roofs=(TURF, TURF, 'timber_dark'), snow=0.25, wall='timber_dark'):
    def make(rng, L, d):
        return {'L': L, 'd': d, 'h': rng.uniform(0.034, 0.044), 'rise': d * rng.uniform(0.85, 1.0), 'roof': rng.choice(roofs),
                'snow': rng.random() < snow, 'gilt': False, 'wall': wall, 'door_x': rng.uniform(-0.3, 0.3)}
    return make


def longhouse(m, s, lo):
    """Norse longhouse: low plank walls under a deep turf or shingle roof, bargeboards crossing into horns at both gables."""
    L, d, h, rise = s['L'], s['d'], s['h'], s['rise']
    eave = 0.02
    if lo:
        lo_block(m, L, d, h, rise, s['wall'], s['roof'])
        return
    block(m, (L, d, h + 0.05), (0, 0, -0.05), color=s['wall'], jitter=0.06)
    gables(m, L, d, rise, h, color=s.get('gable', 'timber'), eave=eave, thick=0.015)
    roof(m, L + 0.024, d, rise, (0, 0, h), color=s['roof'], eave=eave, thick=0.015, jitter=0.1)
    if s.get('snow'):
        snow_ridge(m, L + 0.024, d, rise, h, eave=eave)
    a = d / 2 + eave
    slope = math.hypot(a, rise)
    board = 'gilt' if s.get('gilt') else 'timber'
    for end in ((-1, 1) if s.get('boards', True) else ()):
        x = end * (L / 2 + 0.0135)
        for sgn in (-1, 1):
            m.box((0.005, 0.008, 0.075 * slope / a), at=(x, sgn * 0.036, h + rise * (1 - 0.036 / a) - 0.004),
                  rot=(sgn * math.atan2(a, rise), 0, 0), color=board, jitter=0.05)
    opening(m, 0.022, min(0.034, h + rise * 0.3), (-L / 2 - 0.0015, 0, 0), rot=-QUARTER, color='bark_dark')
    opening(m, 0.02, h * 0.85, (s['door_x'] * L, -d / 2 - 0.0015, 0), shape='rect', color='bark_dark')


def storehouse(m, s, lo):
    """A stabbur: a small timber store raised on stone feet, its upper storey jettied out."""
    w, d, lift = s['w'], s['d'], 0.022
    rise = d * 0.95
    if lo:
        lo_block(m, w, d, lift + 0.06, rise, 'timber', s['roof'])
        return
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cylinder(0.007, 0.006, lift + 0.05, seg=4, at=(sx * (w / 2 - 0.008), sy * (d / 2 - 0.008), -0.05),
                       color='granite_dark', cap_bottom=False)
    block(m, (w, d, 0.036), (0, 0, lift), color='timber', jitter=0.06)
    block(m, (w + 0.014, d + 0.014, 0.024), (0, 0, lift + 0.036), color='timber_dark', jitter=0.06)
    top = lift + 0.06
    gables(m, w + 0.014, d + 0.014, rise, top, color='timber', eave=0.012)
    roof(m, w + 0.03, d + 0.014, rise, (0, 0, top), color=s['roof'], eave=0.012, thick=0.012, jitter=0.1)
    opening(m, 0.016, 0.026, (0, -d / 2 - 0.0015, lift), shape='rect', color='bark_dark')


def small_fir(m, at, size=1.0, lo=False):
    x, y = at
    m.cylinder(0.008 * size, 0.005 * size, 0.06 * size, seg=4, at=(x, y, -0.04), color='bark', cap_bottom=False)
    for k in range(2 if lo else 3):
        z = (0.03 + k * 0.05) * size
        r = (0.05 - k * 0.013) * size
        m.loft([(z, r), (z + 0.075 * size, 0.0)], seg=5 if lo else 7, at=(x, y, 0), phase=k * 0.7,
               color='fir' if k == 0 else 'fir_mid', jitter=0.1)


def watchtower(m, h, lo, w=0.058, roof_col='timber_dark'):
    """A timber watchtower: four splayed legs, a boarded fighting hut and a pyramid roof."""
    if lo:
        block(m, (w * 0.8, w * 0.8, h + 0.09), (0, 0, -0.05), color='timber')
        m.loft([(h + 0.04, (w + 0.02) * 0.72), (h + 0.1, 0.0)], seg=4, phase=math.pi / 4, cap_bottom=False, color=roof_col)
        return
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.loft([(-0.04, 0.006, sx * w * 0.62, sy * w * 0.62), (h, 0.006, sx * w * 0.42, sy * w * 0.42)], seg=4,
                   color='timber_dark', cap_bottom=False, cap_top=False)
    for z in (h * 0.35, h * 0.7):
        for k in range(4):
            a = k * QUARTER
            x, y = rotated(0, -w * (0.62 - 0.2 * z / h), a)
            m.box((w * (1.24 - 0.4 * z / h), 0.005, 0.005), at=(x, y, z), rot=(0, 0, a), color='timber')
    block(m, (w + 0.014, w + 0.014, 0.01), (0, 0, h), color='timber')
    block(m, (w, w, 0.038), (0, 0, h + 0.01), color='timber_dark', jitter=0.06)
    m.loft([(h + 0.046, (w + 0.03) * 0.72), (h + 0.11, 0.0)], seg=4, phase=math.pi / 4, color=roof_col, jitter=0.08, cap_bottom=False)


def palisade(m, pts, h, lo, spacing=0.034, thick=0.022, closed=True, gate=None, z=0.0):
    """Sharpened-log stockade along a polyline; logs whose centre gate(x, y) accepts are left out."""
    segs = list(zip(pts, pts[1:] + pts[:1])) if closed else list(zip(pts, pts[1:]))
    for p0, p1 in segs:
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L, a = math.hypot(dx, dy), math.atan2(dy, dx)
        n = max(1, round(L / spacing))
        sw = L / n
        kept = [i for i in range(n) if not (gate and gate(p0[0] + dx * (i + 0.5) / n, p0[1] + dy * (i + 0.5) / n))]
        if lo:
            runs, start = [], None
            for i in range(n + 1):
                if i < n and i in kept:
                    start = i if start is None else start
                elif start is not None:
                    runs.append((start, i))
                    start = None
            for i0, i1 in runs:
                t0, t1 = i0 / n, i1 / n
                block(m, (L * (t1 - t0), thick, h + 0.07), (p0[0] + dx * (t0 + t1) / 2, p0[1] + dy * (t0 + t1) / 2, z - 0.05),
                      rot=a, color='timber')
            continue
        keep_set = set(kept)
        ca, sa = math.cos(a), math.sin(a)
        for i in kept:
            hh = h * m.rng.uniform(0.88, 1.1)
            t = (i + 0.5) / n
            col = mix('timber', 'bark', m.rng.random() * 0.7)
            faces = m.prism([(-sw / 2, -0.05), (sw / 2, -0.05), (sw / 2, hh), (0.0, hh + sw * 0.9), (-sw / 2, hh)], thick,
                            at=(p0[0] + dx * t, p0[1] + dy * t, z), rot=(0, 0, a), color=col, jitter=0.05)
            drop = []
            for f in faces:
                f.normal_update()
                along = f.normal.x * ca + f.normal.y * sa
                if f.normal.z < -0.9 or (along > 0.9 and i + 1 in keep_set) or (along < -0.9 and i - 1 in keep_set):
                    drop.append(f)
            m.delete(drop)


def village_north(rng, lo):
    m = Mesh(rng)
    make = north_maker(snow=0.35)
    halls = [
        ((0.0, 0.225), 0.0, make(rng, rng.uniform(0.32, 0.35), 0.125)),
        ((-0.24, -0.01), QUARTER, make(rng, rng.uniform(0.27, 0.3), 0.115)),
        ((0.255, 0.02), -QUARTER, make(rng, rng.uniform(0.24, 0.27), 0.11)),
        ((0.13, -0.27), math.pi, make(rng, rng.uniform(0.2, 0.23), 0.1)),
    ]
    halls[0][2]['roof'] = TURF
    stores = [((-0.2, -0.27), 0.25 + rng.uniform(-0.1, 0.1), {'w': 0.07, 'd': 0.06, 'roof': 'timber_dark'}),
              ((-0.06, -0.33), -0.2 + rng.uniform(-0.1, 0.1), {'w': 0.06, 'd': 0.055, 'roof': TURF})]
    firs = [(x + rng.uniform(-0.02, 0.02), y + rng.uniform(-0.02, 0.02), k)
            for x, y, k in ((-0.36, 0.3, 1.1), (0.36, 0.3, 0.95), (0.38, -0.25, 1.0), (-0.37, -0.14, 0.9))]
    for at, rot, s in halls:
        place(m, at, rot, longhouse, s, lo)
    for at, rot, s in stores:
        place(m, at, rot, storehouse, s, lo)
    for x, y, k in firs:
        small_fir(m, (x, y), k, lo)
    if not lo:
        # hearth ring on the yard
        m.loft([(-0.02, 0.032), (0.012, 0.032), (0.012, 0.022), (0.004, 0.022)], seg=7, at=(0.0, -0.03, 0), color='granite_dark',
               jitter=0.12, cap_bottom=False)
        pool(m, 0.02, at=(0.0, -0.03), seg=6, wobble=0.1, z=0.006, color='ember')
        # rune stone, painted red as the old stones were
        m.prism([(-0.017, -0.04), (0.017, -0.04), (0.019, 0.05), (0.008, 0.078), (-0.011, 0.072), (-0.019, 0.04)], 0.013,
                at=(0.1, -0.13, 0), rot=(0, 0, 0.5), color='granite_dark', jitter=0.05)
        for z in (0.012, 0.032, 0.052):
            decal(m, [(-0.012, z), (0.012, z), (0.012, z + 0.006), (-0.012, z + 0.006)],
                  (0.1 + math.sin(0.5) * 0.0075, -0.13 - math.cos(0.5) * 0.0075, 0), rot=0.5, color='oxblood')
        # woodpile by the long hall
        for x, y, z in ((-0.13, 0.142, 0.008), (-0.13, 0.126, 0.008), (-0.12, 0.134, 0.022)):
            m.cylinder(0.008, 0.008, 0.07, seg=5, at=(x, y, z), rot=(0, QUARTER, 0), color='bark_pale', jitter=0.1)
    m.ground_ao(0.06, 0.35)
    return m


def town_north(rng, lo):
    m = Mesh(rng)
    make = north_maker(snow=0.3)
    R = 0.44
    ring = [(R * math.cos(math.pi / 8 + k * math.pi / 4), R * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    hall = make(rng, 0.36, 0.15)
    hall.update(h=0.058, rise=0.16, roof='timber_dark', gilt=True, snow=False, wall='timber', gable='timber_dark')
    houses = [
        ((-0.255, -0.01), QUARTER, make(rng, 0.25, 0.11)),
        ((0.255, 0.0), -QUARTER, make(rng, 0.25, 0.11)),
        ((-0.13, -0.245), QUARTER, make(rng, 0.17, 0.1)),
        ((0.13, -0.245), -QUARTER, make(rng, 0.17, 0.1)),
    ]
    stores = [((-0.255, 0.215), 0.15, {'w': 0.07, 'd': 0.06, 'roof': TURF}),
              ((0.26, 0.215), -0.2, {'w': 0.065, 'd': 0.06, 'roof': 'timber_dark'})]

    palisade(m, ring, 0.085, lo, gate=lambda x, y: y < -0.3 and abs(x) < 0.055)
    for sx in (-1, 1):
        place(m, (sx * 0.085, -0.405), 0.0, watchtower, 0.16, lo)
    place(m, (0.0, 0.18), 0.0, longhouse, hall, lo)
    for at, rot, s in houses:
        place(m, at, rot, longhouse, s, lo)
    for at, rot, s in stores:
        place(m, at, rot, storehouse, s, lo)
    if not lo:
        # oxblood war-banners on poles before the hall
        for sx in (-1, 1):
            banner(m, (sx * 0.075, 0.07, 0.0), 0.13, 'oxblood', rot=math.pi if sx < 0 else 0.0)
        m.prism([(-0.016, -0.04), (0.016, -0.04), (0.018, 0.05), (0.007, 0.08), (-0.012, 0.072), (-0.018, 0.04)], 0.013,
                at=(0.0, -0.1, 0), color='granite_dark', jitter=0.05)
        decal(m, [(-0.012, 0.02), (0.012, 0.02), (0.012, 0.028), (-0.012, 0.028)], (0.0, -0.1075, 0), color='oxblood')
    m.ground_ao(0.06, 0.35)
    return m


def dwarf_tower(m, s, h, lo, cap=0.12, color=DWARF):
    """Battered square tower with an overhanging fighting top and a steep pyramid cap."""
    block(m, (s, s, h + 0.05), (0, 0, -0.05), color=color, taper=0.18, jitter=0.04)
    R = s / math.sqrt(2)
    if lo:
        m.loft([(h, R * 1.05), (h + cap, 0.0)], seg=4, phase=math.pi / 4, cap_bottom=False, color='roof_slate')
        return
    block(m, (s * 1.02, s * 1.02, 0.04), (0, 0, h - 0.004), color='granite', jitter=0.04)
    m.loft([(h + 0.032, R * 1.1), (h + cap, 0.0)], seg=4, phase=math.pi / 4, cap_bottom=False, color='roof_slate', jitter=0.05)
    m.cylinder(0.004, 0.0, 0.04, seg=4, at=(0, 0, h + cap - 0.008), color='gilt', cap_bottom=False)
    for k in range(4):
        a = k * QUARTER
        x, y = rotated(0, -s * 0.51 - 0.0015, a)
        opening(m, 0.008, 0.03, (x, y, h * 0.55), rot=a, shape='rect')
        decal(m, [(-s * 0.4, h + 0.008), (s * 0.4, h + 0.008), (s * 0.4, h + 0.016), (-s * 0.4, h + 0.016)], (x * 1.01, y * 1.01, 0),
              rot=a, color='gilt')


def dwarf_gate(m, w, h, depth, lo, color=DWARF):
    """A massive carved gate block: deep dark doorway, stepped lintel and a gilt rune band."""
    block(m, (w, depth, h + 0.05), (0, 0, -0.05), color=color, taper=0.06, jitter=0.03)
    if lo:
        return
    block(m, (w * 0.7, depth * 0.85, 0.025), (0, 0, h), color='granite', jitter=0.03)
    block(m, (w * 0.4, depth * 0.7, 0.02), (0, 0, h + 0.025), color='granite', jitter=0.03)
    front = -depth / 2 - 0.0015
    decal(m, [(-w * 0.27, 0), (w * 0.27, 0), (w * 0.27, h * 0.58), (0, h * 0.74), (-w * 0.27, h * 0.58)], (0, front, 0), color='basalt')
    decal(m, [(-w * 0.36, h * 0.8), (w * 0.36, h * 0.8), (w * 0.36, h * 0.87), (-w * 0.36, h * 0.87)], (0, front, 0), color='gilt')
    decal(m, [(0, h * 0.9), (0.012, h * 0.94), (0, h * 0.98), (-0.012, h * 0.94)], (0, front, 0), color='gilt')


def city_north(rng, lo):
    """A dwarf-hold: three battered stone terraces climbing to a great hall, entered by a carved gate."""
    m = Mesh(rng)
    stone = north_maker(roofs=('roof_slate', 'roof_slate', TURF), snow=0.2, wall='granite')
    houses = [
        ((-0.17, -0.315), 0.0, stone(rng, 0.17, 0.09)), ((0.17, -0.315), 0.0, stone(rng, 0.17, 0.09)),
        ((-0.18, -0.19), math.pi, stone(rng, 0.15, 0.08)), ((0.18, -0.19), math.pi, stone(rng, 0.15, 0.08)),
        ((-0.375, 0.02), QUARTER, stone(rng, 0.2, 0.08)), ((0.375, 0.02), -QUARTER, stone(rng, 0.2, 0.08)),
        ((-0.375, 0.26), QUARTER, stone(rng, 0.18, 0.08)), ((0.375, 0.26), -QUARTER, stone(rng, 0.18, 0.08)),
        ((-0.235, 0.11), QUARTER, stone(rng, 0.14, 0.085)), ((0.235, 0.12), -QUARTER, stone(rng, 0.14, 0.085)),
        ((-0.17, -0.035), 0.0, stone(rng, 0.13, 0.075)), ((0.17, -0.035), 0.0, stone(rng, 0.13, 0.075)),
        ((-0.3, -0.2), QUARTER, stone(rng, 0.12, 0.07)), ((0.3, -0.2), -QUARTER, stone(rng, 0.12, 0.07)),
    ]
    zs = [0.075] * 8 + [0.16] * 4 + [0.075] * 2
    hall = stone(rng, 0.29, 0.15)
    hall.update(h=0.095, rise=0.17, roof='roof_slate', gilt=True, snow=False, wall='granite', gable=DWARF)
    for _, _, h in houses:
        h['boards'] = False

    terraces = block(m, (0.9, 0.86, 0.125), (0, 0, -0.05), color=DWARF, taper=0.05, jitter=0.03)
    terraces += block(m, (0.62, 0.5, 0.105), (0, 0.13, 0.055), color='granite_dark', taper=0.06, jitter=0.03)
    terraces += block(m, (0.36, 0.3, 0.1), (0, 0.2, 0.14), color='granite', taper=0.06, jitter=0.03)
    m.paint_where(terraces, lambda f: f.normal.z > 0.9, 'granite', jitter=0.04)
    place(m, (0.0, 0.21, 0.24), 0.0, longhouse, hall, lo)
    place(m, (0.0, -0.405), 0.0, dwarf_gate, 0.14, 0.12, 0.07, lo)
    for sx in (-1, 1):
        place(m, (sx * 0.355, -0.335, 0.075), 0.0, dwarf_tower, 0.085, 0.27, lo, 0.1)
    for sx in (-1, 1):
        place(m, (sx * 0.235, 0.3, 0.16), 0.0, dwarf_tower, 0.08, 0.42 if sx < 0 else 0.36, lo, 0.13)
    for (at, rot, s), z in zip(houses, zs):
        place(m, (at[0], at[1], z), rot, longhouse, s, lo)
    if not lo:
        stair(m, -0.2, -0.112, 0.085, 0.07, 5, at=(0, 0, 0.075), color='granite')
        stair(m, -0.005, 0.062, 0.08, 0.06, 4, at=(0, 0, 0.16), color='granite_light')
        # chunky merlons along the rim of the base terrace, open over the gate
        hx, hy = 0.45 * 0.95, 0.43 * 0.95
        for k in range(4):
            a = k * QUARTER
            half = hx if k % 2 == 0 else hy
            span = hy if k % 2 == 0 else hx
            n = round(span * 2 / 0.065)
            for i in range(n):
                t = (i + 0.5) / n * 2 - 1
                x, y = rotated(half - 0.012, t * span * 0.97, a)
                if abs(x) < 0.09 and y < 0:
                    continue
                block(m, (0.02, span * 2 / n * 0.5, 0.026), (x, y, 0.075), rot=a, color=DWARF, jitter=0.06)
        # guardian statues flanking the upper stair
        for sx in (-1, 1):
            x = sx * 0.06
            block(m, (0.03, 0.03, 0.12), (x, -0.13, 0.075), color='granite_light', taper=0.25)
            block(m, (0.024, 0.026, 0.026), (x, -0.13, 0.195), color='granite_light')
            m.box((0.034, 0.006, 0.05), at=(x, -0.147, 0.12), color='granite')
        # oxblood and gilt hangings on the second terrace
        for x in (-0.24, -0.12, 0.12, 0.24):
            decal(m, [(-0.016, 0.1), (0.016, 0.1), (0.016, 0.152), (0.0, 0.142), (-0.016, 0.152)], (x, -0.117, 0), color='oxblood')
            decal(m, [(0, 0.118), (0.007, 0.127), (0, 0.136), (-0.007, 0.127)], (x, -0.118, 0), color='gilt')
        # buttresses along the base terrace
        for k in range(4):
            x = -0.3 + k * 0.2
            for side, rot in ((-1, -QUARTER), (1, QUARTER)):
                if side < 0 and abs(x) < 0.1:
                    continue
                m.prism([(0.0, -0.05), (0.03, -0.05), (0.0, 0.07)], 0.025, at=(x, side * 0.425, 0), rot=(0, 0, rot), color=DWARF, jitter=0.05)
            y = -0.3 + k * 0.2
            for side, rot in ((-1, math.pi), (1, 0.0)):
                m.prism([(0.0, -0.05), (0.03, -0.05), (0.0, 0.07)], 0.025, at=(side * 0.445, y, 0), rot=(0, 0, rot), color=DWARF, jitter=0.05)
    m.ground_ao(0.06, 0.35)
    return m


def castle_north(rng, lo):
    """A dwarven fortress: battered walls with buttresses, bastion corners, a carved gate and a stepped keep."""
    m = Mesh(rng)
    C, H, T = 0.34, 0.17, 0.07
    forge = north_maker(roofs=('roof_slate',), snow=0.0, wall='granite')(rng, 0.22, 0.09)
    runs = [((-C, -C), (-0.07, -C)), ((0.07, -C), (C, -C)), ((C, -C), (C, C)), ((C, C), (-C, C)), ((-C, C), (-C, -C))]
    for p0, p1 in runs:
        wall_run(m, p0, p1, H, T, lo, color=DWARF, merlon=0.075, taper=0.22)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        x, y = sx * C, sy * C
        block(m, (0.17, 0.17, 0.3), (x, y, -0.05), color=DWARF, taper=0.16, jitter=0.03)
        if not lo:
            block(m, (0.15, 0.15, 0.025), (x, y, 0.245), color='granite_dark', jitter=0.03)
            for k in range(4):
                a = k * QUARTER
                for t in (-0.045, 0.0, 0.045):
                    px, py = rotated(t, -0.064, a)
                    block(m, (0.026, 0.02, 0.03), (x + px, y + py, 0.27), rot=a, color='granite_dark', jitter=0.06)
    place(m, (0.0, -C - 0.01), 0.0, dwarf_gate, 0.16, 0.2, 0.1, lo)
    # stepped keep
    ky = 0.06
    tiers = ((0.28, -0.05, 0.25), (0.2, 0.2, 0.15), (0.13, 0.35, 0.1))
    for k, (s, z, hh) in enumerate(tiers):
        block(m, (s, s * 0.95, hh), (0.0, ky, z), color=DWARF if k != 1 else 'granite_dark', taper=0.12, jitter=0.03)
    m.loft([(0.45, 0.13 / math.sqrt(2) * 1.15), (0.58, 0.0)], seg=4, phase=math.pi / 4, at=(0.0, ky, 0), color='roof_slate',
           cap_bottom=False, jitter=0.04)
    place(m, (-0.2, -0.04), QUARTER, longhouse, forge, lo)
    m.paint_where(list(m.bm.faces), lambda f: f.normal.z > 0.9, 'granite', jitter=0.06)
    if not lo:
        def face(k, z, axis):
            """Distance from the keep's axis to tier k's face at height z (axis 0: ±X, 1: ±Y)."""
            s, z0, hh = tiers[k]
            half = s / 2 * (0.95 if axis else 1.0)
            return half * (1 - 0.12 * (z - z0) / hh)
        m.cylinder(0.004, 0.0, 0.05, seg=4, at=(0.0, ky, 0.572), color='gilt', cap_bottom=False)
        front = ky - face(0, 0.05, 1) - 0.002
        decal(m, [(-0.04, 0.0), (0.04, 0.0), (0.04, 0.08), (0.0, 0.11), (-0.04, 0.08)], (0.0, front, 0), color='basalt')
        decal(m, [(0, 0.15), (0.016, 0.175), (0, 0.2), (-0.016, 0.175)], (0.0, ky - face(0, 0.175, 1) - 0.002, 0), color='gilt')
        for k, z in ((1, 0.27), (2, 0.39)):
            s = tiers[k][0]
            decal(m, [(-s * 0.4, z), (s * 0.4, z), (s * 0.4, z + 0.008), (-s * 0.4, z + 0.008)], (0.0, ky - face(k, z + 0.004, 1) - 0.002, 0),
                  color='gilt')
        for q in range(4):
            a = q * QUARTER
            d = face(0, 0.137, q % 2 == 0) + 0.002
            for t in (-0.08, 0.08):
                x, y = rotated(t, -d, a)
                opening(m, 0.008, 0.035, (x, ky + y, 0.12), rot=a, shape='rect')
        for p0, p1 in runs:
            dx, dy = p1[0] - p0[0], p1[1] - p0[1]
            a = math.atan2(dy, dx)
            nx, ny = -math.sin(a), math.cos(a)
            if nx * (p0[0] + p1[0]) + ny * (p0[1] + p1[1]) < 0:
                nx, ny = -nx, -ny
            for f in (0.33, 0.67):
                x, y = p0[0] + dx * f + nx * T * 0.4, p0[1] + dy * f + ny * T * 0.4
                m.prism([(0.0, -0.05), (0.05, -0.05), (0.0, H * 0.75)], 0.03, at=(x, y, 0), rot=(0, 0, math.atan2(ny, nx)),
                        color='granite_dark', jitter=0.05)
    m.ground_ao(0.06, 0.35)
    return m


# -- desert -----------------------------------------------------------------------------------

def desert_maker(h=(0.06, 0.11), upper=0.4):
    def make(rng, w, d):
        return {'w': w, 'd': d, 'h1': rng.uniform(*h), 'h2': 0.0,
                'color': rng.choice(('adobe', 'adobe', 'adobe_light', 'sandstone_light')),
                'upper': rng.random() < upper, 'uw': rng.uniform(0.45, 0.62), 'uh': rng.uniform(0.04, 0.06),
                'ux': rng.uniform(-0.18, 0.18), 'dome': rng.random() < 0.15, 'door_x': rng.uniform(-0.25, 0.25),
                'door': 'front', 'awning': rng.random() < 0.2}
    return make


def cube(m, w, d, h, color, z=0.0, parapet=0.014):
    """A flat-roofed block with a parapet and a sunken roof floor; returns the roof floor height."""
    R = math.sqrt(0.5)
    base = -0.05 if z == 0.0 else z - 0.004
    m.loft([(base, R), (z + h, R), (z + h + parapet, R), (z + h + parapet, R * 0.86), (z + h + parapet * 0.3, R * 0.86)],
           seg=4, phase=math.pi / 4, scale=(w, d, 1.0), color=color, jitter=0.05, cap_bottom=False, cap_top=True)
    return z + h + parapet * 0.3


def dome(m, r, at, color=PALACE, seg=8, onion=False, finial=True, lo=False):
    x, y, z = at
    s = 6 if lo else seg
    if onion:
        rings = [(0.0, r * 0.9), (r * 0.3, r * 1.04), (r * 0.65, r * 0.88), (r * 0.98, r * 0.42), (r * 1.4, 0.0)]
    else:
        rings = [(0.0, r), (r * 0.5, r * 0.87), (r * 0.87, r * 0.5), (r * 1.05, 0.0)]
    if lo:
        rings = [rings[0], rings[len(rings) // 2], rings[-1]]
    m.loft(rings, seg=s, at=(x, y, z), color=color, jitter=0.04, cap_bottom=False)
    if finial and not lo:
        m.cylinder(0.0035, 0.0, r * 0.45 + 0.02, seg=4, at=(x, y, z + rings[-1][0] - 0.004), color='gilt', cap_bottom=False)


def adobe(m, s, lo):
    """A flat-roofed adobe house with a parapet, sometimes a roof room or a small dome; front -Y."""
    w, d, h = s['w'], s['d'], s['h1']
    if lo:
        block(m, (w, d, h + 0.064), (0, 0, -0.05), color=s['color'], jitter=0.03)
        if s['upper']:
            block(m, (w * s['uw'], d * s['uw'], s['uh']), (s['ux'] * w, 0, h), color=s['color'])
        return
    top = cube(m, w, d, h, s['color'])
    if s['upper']:
        uw, ud = w * s['uw'], d * s['uw']
        uy = (d - ud) / 2 * 0.6
        sub = Mesh(m.rng)
        cube(sub, uw, ud, s['uh'], s['color'], z=top)
        insert(m, sub, (s['ux'] * w, uy, 0))
        sub.bm.free()
        opening(m, 0.012, 0.022, (s['ux'] * w, uy - ud / 2 - 0.0015, top), shape='pointed')
    elif s['dome']:
        dome(m, min(w, d) * 0.3, (0, 0, top - 0.002), color=PALACE, seg=8)
    dx = s.get('door_x', 0.0) * w
    if s.get('door') == 'end':
        opening(m, 0.02, min(0.045, h * 0.6), (-w / 2 - 0.0015, 0, 0), rot=-QUARTER, shape='pointed', color='timber_dark')
    else:
        opening(m, 0.02, min(0.045, h * 0.6), (dx, -d / 2 - 0.0015, 0), shape='pointed', color='timber_dark')
        if s.get('awning'):
            m.box((0.05, 0.022, 0.004), at=(dx, -d / 2 - 0.011, min(0.05, h * 0.68)), rot=(-0.35, 0, 0), color='oxblood')
    if h > 0.075:
        for wx in (-0.3, 0.3):
            opening(m, 0.01, 0.012, (wx * w, -d / 2 - 0.0015, h * 0.72), shape='rect')


def minaret(m, r, h, lo, color='sandstone_light', cap='gilt'):
    """A slender minaret: octagonal shaft, corbelled balcony, upper stage and a small gilt dome."""
    s = 6 if lo else 8
    m.loft([(-0.05, r * 1.2), (0.03, r * 1.2), (0.04, r), (h * 0.74, r * 0.85)], seg=s, color=color, jitter=0.04,
           cap_bottom=False, cap_top=False)
    if lo:
        m.loft([(h * 0.74, r * 0.85), (h * 0.9, r * 0.7), (h, 0.0)], seg=s, color=cap, cap_bottom=False)
        return
    m.loft([(h * 0.74, r * 0.85), (h * 0.75, r * 1.45), (h * 0.775, r * 1.45), (h * 0.775, r * 0.72), (h * 0.9, r * 0.72)],
           seg=s, color=color, jitter=0.04, cap_bottom=False, cap_top=False)
    dome(m, r * 0.85, (0, 0, h * 0.9), color=cap, onion=True, seg=s)
    for k in range(4):
        a = k * QUARTER
        x, y = rotated(0, -r * 0.72 - 0.002, a)
        opening(m, r * 0.5, r * 1.3, (x, y, h * 0.8), rot=a, shape='pointed')


def kasbah_tower(m, s, h, lo, color='adobe', taper=0.22, crest=True):
    """A battered adobe tower with a crown of stepped merlons and incised lozenges."""
    block(m, (s, s, h + 0.05), (0, 0, -0.05), color=color, taper=taper, jitter=0.04)
    if lo or not crest:
        return
    top = s * (1 - taper)
    for k in range(4):
        a = k * QUARTER
        for t in (-0.32, 0.0, 0.32):
            x, y = rotated(t * top, -top / 2 + 0.006, a)
            m.loft([(h, 0.009), (h + 0.022, 0.0)], seg=4, phase=math.pi / 4, at=(x, y, 0), rot=(0, 0, a), color=color, jitter=0.06,
                   cap_bottom=False)
        half = s * (1 - taper * (h * 0.8 + 0.05) / (h + 0.05)) / 2
        x, y = rotated(0, -half - 0.002, a)
        for t in (-0.25, 0.25):
            px, py = rotated(t * half * 2, 0, a)
            decal(m, [(0, h * 0.74), (0.009, h * 0.8), (0, h * 0.86), (-0.009, h * 0.8)], (x + px, y + py, 0), rot=a, color='sandstone_dark')
        half = s * (1 - taper * (h * 0.5 + 0.05) / (h + 0.05)) / 2
        x, y = rotated(0, -half - 0.002, a)
        opening(m, 0.008, 0.026, (x, y, h * 0.5), rot=a, shape='rect')


def desert_gate(m, w, h, depth, lo, color=SAND_WALL):
    """A tall gate block with a pointed arch, flanked by slim buttress towers."""
    block(m, (w, depth, h + 0.05), (0, 0, -0.05), color=color, taper=0.05, jitter=0.03)
    if lo:
        return
    for sx in (-1, 1):
        place(m, (sx * w / 2, 0), 0.0, kasbah_tower, 0.05, h + 0.04, False, color, 0.12, False)
    front = -depth / 2 - 0.0015
    decal(m, [(-w * 0.32, 0.0), (w * 0.32, 0), (w * 0.32, h * 0.6), (0, h * 0.84), (-w * 0.32, h * 0.6)], (0, front, 0), color='sandstone_dark')
    opening(m, w * 0.44, h * 0.7, (0, front - 0.001, 0), shape='pointed')
    for t in (-0.25, 0.0, 0.25):
        m.loft([(h, 0.01), (h + 0.026, 0.0)], seg=4, phase=math.pi / 4, at=(t * w, -depth / 2 + 0.008, 0), color=color, cap_bottom=False)


def village_desert(rng, lo):
    m = Mesh(rng)
    make = desert_maker(h=(0.055, 0.09), upper=0.35)
    slots = [(-0.21, -0.17), (-0.27, 0.05), (-0.16, 0.25), (0.14, 0.26), (0.26, 0.07), (0.23, -0.14), (0.11, -0.28), (-0.07, -0.3),
             (-0.01, 0.3), (-0.32, 0.23)]
    plans = []
    for x, y in slots:
        a = math.atan2(y, x)
        rot = round((a - QUARTER) / QUARTER) * QUARTER
        plans.append(((x + rng.uniform(-0.012, 0.012), y + rng.uniform(-0.012, 0.012)), rot,
                      make(rng, rng.uniform(0.1, 0.125), rng.uniform(0.085, 0.105))))
    palms = [(-0.05, -0.13), (0.34, -0.31), (-0.35, -0.31), (0.33, 0.31)]
    leans = [(rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)) for _ in palms]

    for at, rot, s in plans:
        place(m, at, rot, adobe, s, lo)
    # domed shrine at the head of the court
    sh = Mesh(m.rng)
    if lo:
        block(sh, (0.085, 0.085, 0.15), (0, 0, -0.05), color='adobe_light')
        top = 0.1
    else:
        top = cube(sh, 0.085, 0.085, 0.085, 'adobe_light')
        opening(sh, 0.026, 0.055, (0, -0.0425 - 0.0015, 0), shape='pointed')
    dome(sh, 0.04, (0, 0, top - 0.002), color=PALACE, lo=lo)
    insert(m, sh, (0.0, 0.11, 0))
    sh.bm.free()
    for (x, y), lean in zip(palms, leans):
        small_palm(m, (x, y), lean=lean, lo=lo)
    if not lo:
        m.loft([(-0.04, 0.026), (0.02, 0.026), (0.02, 0.019), (0.012, 0.019)], seg=8, at=(0.05, -0.06, 0), color='sandstone',
               jitter=0.05, cap_bottom=False)
        pool(m, 0.019, at=(0.05, -0.06), seg=8, wobble=0.0, z=0.013)
        # low mud walls tying the houses into compounds
        for p0, p1 in (((-0.37, -0.1), (-0.37, 0.17)), ((0.37, -0.04), (0.37, 0.2)), ((0.04, 0.37), (-0.08, 0.37))):
            wall_run(m, p0, p1, 0.035, 0.016, lo, color='adobe', merlon=0)
    m.ground_ao(0.06, 0.3)
    return m


def temple_mosque(m, lo):
    """A domed prayer hall with an arcaded front."""
    if lo:
        block(m, (0.17, 0.15, 0.15), (0, 0, -0.05), color='sandstone_light')
        dome(m, 0.06, (0, 0, 0.1), color=PALACE, lo=True)
        return
    top = cube(m, 0.17, 0.15, 0.1, 'sandstone_light')
    m.loft([(top - 0.004, 0.055), (top + 0.03, 0.055)], seg=8, color='sandstone_light', cap_bottom=False, cap_top=False)
    dome(m, 0.06, (0, 0, top + 0.028), color=PALACE)
    for sx in (-1, 1):
        dome(m, 0.022, (sx * 0.06, -0.045, top - 0.002), color=PALACE, finial=False)
    for t in (-0.3, 0.0, 0.3):
        opening(m, 0.024, 0.06, (t * 0.17, -0.075 - 0.0015, 0), shape='pointed')


def town_desert(rng, lo):
    m = Mesh(rng)
    C, H, T = 0.4, 0.13, 0.04
    make = desert_maker()
    kw = dict(min_w=0.07, max_w=0.11, gable_front=0.0)
    rows = [
        plan_row(rng, (-0.11, -0.355), (-0.11, -0.12), 0.11, -1, make, **kw),
        plan_row(rng, (-0.235, -0.355), (-0.235, -0.12), 0.11, +1, make, **kw),
        plan_row(rng, (0.11, -0.355), (0.11, -0.12), 0.11, +1, make, **kw),
        plan_row(rng, (0.235, -0.355), (0.235, -0.12), 0.11, -1, make, **kw),
        plan_row(rng, (-0.36, 0.11), (-0.06, 0.11), 0.1, -1, make, **kw),
        plan_row(rng, (-0.36, 0.23), (-0.06, 0.23), 0.11, +1, make, **kw),
        plan_row(rng, (0.32, 0.0), (0.32, 0.36), 0.1, +1, make, **kw),
    ]
    stalls = [(-0.02 + rng.uniform(-0.008, 0.008), -0.06 + k * 0.055, rng.choice(('oxblood', 'canvas', 'sandstone_dark'))) for k in range(3)]

    square_curtain(m, C, H, T, lo, 0.07, wall=SAND_WALL, merlon=0.046, taper=0.1, pointed=True, plinth=None)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        place(m, (sx * C, sy * C), 0.0, kasbah_tower, 0.1, 0.21, lo, SAND_WALL, 0.18)
    place(m, (0.0, -C), 0.0, desert_gate, 0.14, 0.19, 0.08, lo)
    build_rows(m, rows, lo, adobe, 'adobe', None)
    place(m, (0.17, 0.22), 0.0, temple_mosque, lo)
    place(m, (0.035, 0.3), 0.0, minaret, 0.022, 0.46, lo)
    if not lo:
        for x, y, col in stalls:
            for sx in (-1, 1):
                m.box((0.004, 0.004, 0.04), at=(x + sx * 0.02, y, 0), color='timber')
            m.box((0.05, 0.034, 0.004), at=(x, y, 0.038), rot=(0.25, 0, 0), color=col)
        small_palm(m, (0.045, 0.03), lean=(0.02, -0.01))
    m.ground_ao(0.06, 0.3)
    return m


def palace(m, lo):
    """A great domed palace on a platform: gilt onion dome on a drum, four lesser domes and four minarets."""
    if lo:
        block(m, (0.36, 0.32, 0.09), (0, 0, -0.05), color='sandstone_light')
        block(m, (0.26, 0.22, 0.12), (0, 0, 0.04), color=PALACE)
        dome(m, 0.09, (0, 0, 0.16), color='gilt', onion=True, lo=True)
        for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
            place(m, (sx * 0.17, sy * 0.15), 0.0, minaret, 0.02, 0.6, True)
        return
    block(m, (0.36, 0.32, 0.09), (0, 0, -0.05), color='sandstone_light', taper=0.03)
    stair(m, -0.21, -0.158, 0.04, 0.08, 4, color='sandstone_light')
    top = cube(m, 0.26, 0.22, 0.12, PALACE, z=0.04)
    m.loft([(top - 0.004, 0.075), (top + 0.045, 0.075), (top + 0.05, 0.08), (top + 0.055, 0.08)], seg=12, color=PALACE,
           jitter=0.03, cap_bottom=False, cap_top=True)
    dome(m, 0.088, (0, 0, top + 0.053), color='gilt', onion=True, seg=12)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        x, y = sx * 0.095, sy * 0.08
        m.loft([(top - 0.004, 0.028), (top + 0.02, 0.028)], seg=8, at=(x, y, 0), color=PALACE, cap_bottom=False, cap_top=False)
        dome(m, 0.03, (x, y, top + 0.018), color='gilt', onion=True)
        place(m, (sx * 0.17, sy * 0.15), 0.0, minaret, 0.02, 0.6, False, PALACE)
    for t in (-0.3, -0.1, 0.1, 0.3):
        opening(m, 0.03, 0.08, (t * 0.26, -0.11 - 0.0015, 0.04), shape='pointed')
    decal(m, [(-0.12, 0.13), (0.12, 0.13), (0.12, 0.14), (-0.12, 0.14)], (0, -0.111 - 0.0015, 0), color='gilt')


def city_desert(rng, lo):
    m = Mesh(rng)
    C, H, T = 0.42, 0.15, 0.045
    make = desert_maker(h=(0.07, 0.12), upper=0.3)
    kw = dict(min_w=0.065, max_w=0.1, gable_front=0.0)
    rows = [
        plan_row(rng, (-0.375, -0.24), (-0.055, -0.24), 0.1, +1, make, **kw),
        plan_row(rng, (-0.37, -0.35), (-0.125, -0.35), 0.09, -1, make, **kw),
        plan_row(rng, (0.055, -0.24), (0.375, -0.24), 0.1, +1, make, **kw),
        plan_row(rng, (0.125, -0.35), (0.37, -0.35), 0.09, -1, make, **kw),
        plan_row(rng, (-0.25, -0.14), (-0.25, 0.37), 0.09, -1, make, **kw),
        plan_row(rng, (-0.345, -0.14), (-0.345, 0.34), 0.09, +1, make, **kw),
        plan_row(rng, (0.25, -0.14), (0.25, 0.37), 0.09, +1, make, **kw),
        plan_row(rng, (0.345, -0.14), (0.345, 0.34), 0.09, -1, make, **kw),
        plan_row(rng, (-0.17, 0.33), (0.17, 0.33), 0.08, -1, make, **kw),
    ]

    square_curtain(m, C, H, T, lo, 0.08, wall=SAND_WALL, merlon=0.05, taper=0.08, pointed=True, plinth=None)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        place(m, (sx * C, sy * C), 0.0, kasbah_tower, 0.11, 0.26, lo, SAND_WALL, 0.16)
    for x, y in ((-C, 0.05), (C, 0.05), (0.0, C)):
        place(m, (x, y), 0.0, kasbah_tower, 0.085, 0.22, lo, SAND_WALL, 0.16)
    place(m, (0.0, -C), 0.0, desert_gate, 0.16, 0.22, 0.09, lo)
    build_rows(m, rows, lo, adobe, 'adobe', None)
    place(m, (0.0, 0.1), 0.0, palace, lo)
    if not lo:
        pool(m, math.sqrt(0.5), at=(0.0, -0.165), seg=4, wobble=0.0, z=0.006, scale=(0.14, 0.05, 1.0), phase=math.pi / 4)
        for sx in (-1, 1):
            small_palm(m, (sx * 0.12, -0.165), h=0.15, lean=(sx * 0.015, 0.01))
    m.ground_ao(0.06, 0.3)
    return m


def castle_desert(rng, lo):
    """A kasbah: four tall battered towers, thick adobe walls and a tower-house over the courtyard."""
    m = Mesh(rng)
    C, H, T = 0.34, 0.2, 0.06
    make = desert_maker(h=(0.06, 0.085), upper=0.25)
    rows = [plan_row(rng, (-0.27, -0.24), (-0.27, 0.13), 0.08, -1, make, min_w=0.08, max_w=0.12, gable_front=0.0),
            plan_row(rng, (-0.2, 0.27), (0.27, 0.27), 0.08, -1, make, min_w=0.08, max_w=0.12, gable_front=0.0)]

    square_curtain(m, C, H, T, lo, 0.06, wall='adobe', merlon=0.045, taper=0.12, pointed=True, plinth=None)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        place(m, (sx * C, sy * C), 0.0, kasbah_tower, 0.13, 0.36, lo, 'adobe', 0.26)
    place(m, (0.0, -C), 0.0, desert_gate, 0.13, 0.24, 0.09, lo, 'adobe_light')
    place(m, (0.08, 0.05), 0.0, kasbah_tower, 0.19, 0.44, lo, 'adobe_light', 0.2)
    build_rows(m, rows, lo, adobe, 'adobe', None)
    if not lo:
        # window bands up the tower-house
        for k in range(4):
            a = k * QUARTER
            for z in (0.14, 0.22, 0.3):
                half = 0.19 * (1 - 0.2 * (z + 0.05) / 0.49) / 2
                for t in (-0.42, 0.42):
                    x, y = rotated(t * half, -half - 0.002, a)
                    opening(m, 0.01, 0.022, (0.08 + x, 0.05 + y, z), rot=a, shape='pointed')
        # gallery of slim posts under an awning along the east wall, a well in the yard
        for k in range(5):
            m.box((0.008, 0.008, 0.08), at=(0.27, -0.22 + k * 0.05, 0), color='timber')
        m.box((0.05, 0.22, 0.006), at=(0.287, -0.12, 0.08), rot=(0, -0.2, 0), color='canvas')
        m.loft([(-0.04, 0.024), (0.02, 0.024), (0.02, 0.017), (0.012, 0.017)], seg=8, at=(-0.08, -0.15, 0), color='sandstone',
               jitter=0.05, cap_bottom=False)
        pool(m, 0.017, at=(-0.08, -0.15), seg=8, wobble=0.0, z=0.013)
        small_palm(m, (0.13, -0.2), h=0.16, lean=(0.02, -0.015))
        m.paint_where(list(m.bm.faces), lambda f: f.normal.z > 0.9 and f.calc_center_median().z > 0.15, 'adobe_light', jitter=0.05)
    m.ground_ao(0.06, 0.3)
    return m


def marsh_maker(lift=(0.035, 0.05), roofs=('roof_thatch', 'roof_thatch', 'dry_grass')):
    def make(rng, w, d):
        return {'w': w, 'd': d, 'lift': rng.uniform(*lift), 'h1': rng.uniform(0.038, 0.048), 'h2': 0.0,
                'rise': d * rng.uniform(1.05, 1.25), 'roof': rng.choice(roofs), 'door_x': rng.uniform(-0.2, 0.2)}
    return make


def stilt_house(m, s, lo):
    """A thatched stilt house: posts, a deck with a walkway lip, plank walls and a steep thatch roof; front -Y."""
    w, d, lift, h, rise = s['w'], s['d'], s['lift'], s['h1'], s['rise']
    base = lift + 0.01
    if lo:
        block(m, (w + 0.02, d + 0.02, 0.012), (0, 0, lift), color='timber')
        block(m, (w, d, h), (0, 0, base), color='timber')
        roof(m, w, d, rise, (0, 0, base + h), color=s['roof'], solid=True, eave=0.015)
        if lift > 0.01:
            block(m, (0.01, 0.01, lift + 0.05), (0, 0, -0.05), color='timber_dark')
        return
    if lift > 0.01:
        for sx in (-1, 1):
            for sy in (-1, 1):
                m.cylinder(0.005, 0.005, lift + 0.05, seg=4, at=(sx * (w / 2 + 0.004), sy * (d / 2 + 0.004), -0.05), color='timber_dark',
                           cap_bottom=False)
    block(m, (w + 0.026, d + 0.03, 0.01), (0, -0.003, lift), color='timber', jitter=0.08)
    block(m, (w, d, h), (0, 0, base), color=s.get('wall', 'timber'), jitter=0.06)
    gables(m, w, d, rise, base + h, color='bark_pale', eave=0.02, thick=0.016)
    roof(m, w + 0.024, d, rise, (0, 0, base + h), color=s['roof'], eave=0.02, thick=0.016, jitter=0.1)
    opening(m, 0.018, h * 0.75, (s['door_x'] * w, -d / 2 - 0.0015, base), shape='rect', color='bark_dark')


def boardwalk(m, p0, p1, z, lo, width=0.028):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L, a = math.hypot(dx, dy), math.atan2(dy, dx)
    block(m, (L, width, 0.007), ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, z), rot=a, color='timber', jitter=0.1)
    if lo:
        return
    n = max(1, int(L / 0.07))
    for k in range(1, n + 1):
        t = k / (n + 1)
        for side in (-1, 1):
            x = p0[0] + dx * t - math.sin(a) * side * width * 0.45
            y = p0[1] + dy * t + math.cos(a) * side * width * 0.45
            m.cylinder(0.003, 0.003, z + 0.05, seg=4, at=(x, y, -0.05), color='timber_dark', cap_bottom=False, cap_top=False)


def reeds(m, at, n=5, h=0.05):
    x, y = at
    for _ in range(n):
        a = m.rng.uniform(0, TAU)
        r = m.rng.uniform(0.0, 0.016)
        m.loft([(-0.01, 0.0035), (h * m.rng.uniform(0.7, 1.15), 0.0)], seg=3, at=(x + math.cos(a) * r, y + math.sin(a) * r, 0),
               rot=(m.rng.uniform(-0.2, 0.2), m.rng.uniform(-0.2, 0.2), 0), color='reed', jitter=0.12, cap_bottom=False)


def village_marsh(rng, lo):
    m = Mesh(rng)
    make = marsh_maker()
    plans = []
    for deg, r in ((-140, 0.25), (-40, 0.25), (20, 0.26), (95, 0.25), (165, 0.26)):
        a = math.radians(deg + rng.uniform(-6, 6))
        plans.append((a, r, make(rng, rng.uniform(0.11, 0.135), rng.uniform(0.085, 0.1))))
    deck_z = 0.04
    trees = [(math.radians(d + rng.uniform(-10, 10)), rng.uniform(0.36, 0.4)) for d in (-90, 58, 130, -168)]
    tufts = [(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3)) for _ in range(7)]

    pool(m, 0.34, seg=14 if not lo else 8, wobble=0.12 if not lo else 0.0, scale=(1.08, 1.0, 1.0))
    for a, r, s in plans:
        x, y = math.cos(a) * r, math.sin(a) * r
        place(m, (x, y), a - QUARTER, stilt_house, s, lo)
        inner = r - s['d'] / 2 - 0.016
        boardwalk(m, (math.cos(a) * inner, math.sin(a) * inner), (math.cos(a) * 0.075, math.sin(a) * 0.075), deck_z, lo)
    # central landing
    m.loft([(deck_z, 0.085), (deck_z + 0.008, 0.085)], seg=8, color='timber', jitter=0.08, cap_bottom=False, cap_top=True)
    if not lo:
        for k in range(8):
            a = k * TAU / 8
            m.cylinder(0.004, 0.004, deck_z + 0.05, seg=4, at=(math.cos(a) * 0.075, math.sin(a) * 0.075, -0.05), color='timber_dark',
                       cap_bottom=False)
        # a dugout drawn up by the landing
        m.prism([(-0.05, 0.0), (-0.035, -0.008), (0.035, -0.008), (0.05, 0.0)], 0.018, at=(0.02, -0.15, 0.012), rot=(0, 0, 0.6),
                color='bark', jitter=0.05)
        for x, y in tufts:
            if math.hypot(x, y) > 0.12:
                reeds(m, (x, y))
        # carved post with a bone-white crown before the longest house
        m.cylinder(0.008, 0.007, 0.12, seg=5, at=(0.11, 0.1, -0.03), color='bark_dark')
        m.cylinder(0.012, 0.0, 0.025, seg=5, at=(0.11, 0.1, 0.088), color='bone')
    for a, r in trees:
        small_tree(m, (math.cos(a) * r, math.sin(a) * r), 1.1, leaf='swamp_leaf', lo=lo)
    m.ground_ao(0.06, 0.3)
    return m


def town_marsh(rng, lo):
    """A raised platform settlement: an octagonal timber deck on piles over dark water, a stockade, thatched halls."""
    m = Mesh(rng)
    make = marsh_maker(lift=(0.0, 0.0))
    deck_z, R, P = 0.055, 0.43, 0.36
    top = deck_z + 0.012
    ring_at = [-30, 22, 64, 116, 158, 210]
    plans = [(math.radians(d + rng.uniform(-5, 5)), make(rng, rng.uniform(0.11, 0.135), rng.uniform(0.085, 0.1))) for d in ring_at]
    hall = make(rng, 0.2, 0.13)
    hall.update(rise=0.17, h1=0.058, roof='roof_thatch')

    pool(m, 0.45, seg=16 if not lo else 8, wobble=0.05 if not lo else 0.0)
    deck = m.loft([(deck_z, R), (top, R)], seg=8, phase=math.pi / 8, color='timber', jitter=0.05, cap_bottom=False, cap_top=True)
    m.paint_where(deck, lambda f: f.normal.z > 0.9, mix('timber', 'bark_pale', 0.25), jitter=0.04)
    if not lo:
        for k in range(16):
            a = math.pi / 8 + k * math.pi / 8
            r = R * (1.0 if k % 2 == 0 else math.cos(math.pi / 8)) - 0.012
            m.cylinder(0.008, 0.008, deck_z + 0.05, seg=4, at=(math.cos(a) * r, math.sin(a) * r, -0.05), color='timber_dark',
                       cap_bottom=False, cap_top=False)
        # plank seams across the walkway outside the stockade
        for k in range(8):
            a = math.pi / 8 + k * math.pi / 4
            x0, y0 = math.cos(a) * (P + 0.01), math.sin(a) * (P + 0.01)
            x1, y1 = math.cos(a) * (R - 0.005), math.sin(a) * (R - 0.005)
            m.box((0.003, math.hypot(x1 - x0, y1 - y0), 0.002), at=((x0 + x1) / 2, (y0 + y1) / 2, top), rot=(0, 0, a - QUARTER),
                  color='timber_dark')
    ring = [(P * math.cos(math.pi / 8 + k * math.pi / 4), P * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    palisade(m, ring, 0.06, lo, spacing=0.034, gate=lambda x, y: y < -0.25 and abs(x) < 0.05, z=top)
    stair(m, -0.475, -0.395, top, 0.07, 4, color='timber')
    for a, s in plans:
        place(m, (math.cos(a) * 0.23, math.sin(a) * 0.23, top), a - QUARTER, stilt_house, s, lo)
    place(m, (0.0, 0.05, top), 0.0, stilt_house, hall, lo)
    place(m, (0.0, 0.27, top), 0.0, watchtower, 0.2, lo, 0.055, 'roof_thatch')
    if not lo:
        for sx in (-1, 1):
            m.cylinder(0.007, 0.006, 0.11, seg=5, at=(sx * 0.06, -0.31, top - 0.01), color='bark_dark')
            m.cylinder(0.011, 0.0, 0.022, seg=5, at=(sx * 0.06, -0.31, top + 0.1), color='bone')
    m.ground_ao(0.06, 0.3)
    return m


def ziggurat(m, base, tiers, step, lo, color='granite'):
    """A stepped temple with a front stair climbing to a thatched shrine."""
    for i in range(tiers):
        s = base * (1 - i * 0.17)
        faces = block(m, (s, s, step + (0.05 if i == 0 else 0.0)), (0, 0, i * step - (0.05 if i == 0 else 0.0)),
                      color=color if i % 2 == 0 else 'granite_dark', taper=0.08, jitter=0.04)
        if not lo:
            m.paint_where(faces, lambda f: f.normal.z > 0.9, 'moss', jitter=0.08)
    top = tiers * step
    ts = base * (1 - (tiers - 1) * 0.17) * 0.92
    if not lo:
        stair(m, -base / 2 - 0.004, -ts / 2 + 0.01, top, base * 0.2, tiers * 3, color='granite_light')
        for sx in (-1, 1):
            m.prism([(-base / 2, -0.01), (-ts / 2, top), (-ts / 2 + 0.01, top), (-ts / 2 + 0.01, -0.01)], 0.012,
                    at=(sx * base * 0.11, 0, 0), rot=(0, 0, QUARTER), color='granite_dark')
    shrine = Mesh(m.rng)
    sw = ts * 0.62
    block(shrine, (sw, sw, 0.06), (0, 0, 0), color='granite_light')
    if not lo:
        opening(shrine, 0.03, 0.04, (0, -sw / 2 - 0.0015, 0), shape='rect')
        decal(shrine, [(-sw * 0.45, 0.046), (sw * 0.45, 0.046), (sw * 0.45, 0.054), (-sw * 0.45, 0.054)], (0, -sw / 2 - 0.0015, 0),
              color='gilt')
    shrine.loft([(0.06, sw * 0.95), (0.06 + sw * 0.9, 0.0)], seg=4, phase=math.pi / 4, color='roof_thatch', jitter=0.08, cap_bottom=False)
    insert(m, shrine, (0, 0, top))
    shrine.bm.free()


def marsh_stone_maker():
    make = temperate_maker(roofs=('roof_thatch', 'roof_thatch', 'dry_grass'), h1=(0.05, 0.065), upper=0.0, rise=(1.0, 1.2))

    def wrap(rng, w, d):
        s = make(rng, w, d)
        s.update(base=rng.choice(('granite', 'granite_light', 'moss_dark')), gable='granite_dark', chimney=0, windows=False)
        return s
    return wrap


def city_marsh(rng, lo):
    """A stone temple-city: a mossy curtain, a causeway between dark pools to a stepped ziggurat, thatched stone houses."""
    m = Mesh(rng)
    C, H, T = 0.435, 0.09, 0.04
    make = marsh_stone_maker()
    stilts = marsh_maker()
    kw = dict(min_w=0.07, max_w=0.1, gable_front=0.25)
    rows = [
        plan_row(rng, (-0.39, -0.29), (-0.08, -0.29), 0.1, +1, make, **kw),
        plan_row(rng, (0.08, -0.29), (0.39, -0.29), 0.1, +1, make, **kw),
        plan_row(rng, (-0.34, -0.17), (-0.34, 0.39), 0.1, -1, make, **kw),
        plan_row(rng, (0.34, -0.17), (0.34, 0.39), 0.1, +1, make, **kw),
        plan_row(rng, (-0.22, 0.37), (0.22, 0.37), 0.08, -1, make, **kw),
    ]
    huts = [((-0.2, -0.16), 0.0, stilts(rng, 0.1, 0.08)), ((0.2, -0.16), 0.0, stilts(rng, 0.1, 0.08))]
    trees = [(-0.245, 0.2), (0.245, 0.21), (-0.24, -0.05), (0.24, -0.04)]

    runs = [((-C, -C), (-0.06, -C)), ((0.06, -C), (C, -C)), ((C, -C), (C, C)), ((C, C), (-C, C)), ((-C, C), (-C, -C))]
    for p0, p1 in runs:
        wall_run(m, p0, p1, H, T, lo, color='granite', merlon=0.06)
    if not lo:
        m.paint_where(list(m.bm.faces), lambda f: f.normal.z > 0.9 and f.calc_center_median().z > 0.05, 'moss', jitter=0.1)
        for sx in (-1, 1):
            block(m, (0.05, 0.05, 0.19), (sx * 0.085, -C, -0.05), color='granite_dark', taper=0.15)
            m.loft([(0.14, 0.024), (0.17, 0.0)], seg=4, phase=math.pi / 4, at=(sx * 0.085, -C, 0), color='gilt', cap_bottom=False)
        for sx in (-1, 1):
            pool(m, math.sqrt(0.5), at=(sx * 0.13, -0.08), seg=4, wobble=0.0, scale=(0.13, 0.11, 1.0), phase=math.pi / 4)
    block(m, (0.07, 0.33, 0.012), (0.0, -0.265, 0.0), color='granite_light', jitter=0.05)
    build_rows(m, rows, lo, house, 'granite', 'roof_thatch', rise_k=1.0)
    for at, rot, s in huts:
        place(m, at, rot, stilt_house, s, lo)
    place(m, (0.0, 0.1), 0.0, ziggurat, 0.4, 5, 0.085, lo)
    for x, y in trees:
        small_tree(m, (x, y), 1.0, leaf='jungle', lo=lo)
    m.ground_ao(0.06, 0.3)
    return m


def castle_marsh(rng, lo):
    """A stone fort on a mound ringed by a moat: timber palisade on the crown, a bridge and ramp, a mossy keep."""
    m = Mesh(rng)
    top = 0.11
    make = marsh_maker(lift=(0.0, 0.0))
    huts = [((-0.125, 0.09), QUARTER, make(rng, 0.09, 0.075)), ((0.125, -0.1), -QUARTER, make(rng, 0.085, 0.07))]
    R = 0.25
    ring = [(R * math.cos(math.pi / 8 + k * math.pi / 4), R * math.sin(math.pi / 8 + k * math.pi / 4)) for k in range(8)]
    tufts = [(math.radians(d + rng.uniform(-10, 10)), rng.uniform(0.39, 0.43)) for d in (35, 150, 215, 320)]

    m.loft([(0.004, 0.45), (0.004, 0.365)], seg=16 if not lo else 8, wobble=0.03 if not lo else 0.0, color='water_dark',
           cap_bottom=False, cap_top=False)
    mound = m.loft([(-0.05, 0.38), (0.02, 0.36), (0.075, 0.31), (top, 0.28)], seg=16 if not lo else 8, wobble=0.03 if not lo else 0.0,
                   color='earth', jitter=0.08, cap_bottom=False, cap_top=True)
    m.paint_by_height(mound, 'earth', 'roof_turf', 0.0, top, jitter=0.1)
    m.paint_where(mound, lambda f: f.normal.z > 0.95, 'roof_turf', jitter=0.08)
    palisade(m, ring, 0.07, lo, spacing=0.032, gate=lambda x, y: y < -0.18 and abs(x) < 0.045, z=top)
    place(m, (0.02, 0.03, top), 0.0, keep, 0.15, 0.22, lo, 0.08, 0.024, (0,), 'granite')
    for at, rot, s in huts:
        place(m, (at[0], at[1], top), rot, stilt_house, s, lo)
    # bridge over the moat and ramp up the mound
    block(m, (0.06, 0.11, 0.01), (0.0, -0.42, 0.012), color='timber', jitter=0.08)
    m.prism([(-0.37, 0.015), (-0.31, 0.07), (-0.235, top - 0.005), (-0.235, top + 0.012), (-0.31, 0.086), (-0.37, 0.03)], 0.06,
            rot=(0, 0, QUARTER), color='timber', jitter=0.06)
    if not lo:
        for sx in (-1, 1):
            for y in (-0.465, -0.375):
                m.cylinder(0.004, 0.004, 0.08, seg=4, at=(sx * 0.03, y, -0.05), color='timber_dark', cap_bottom=False)
        m.paint_where(list(m.bm.faces), lambda f: f.normal.z > 0.9 and f.calc_center_median().z > top + 0.2, 'moss', jitter=0.1)
        for a, r in tufts:
            reeds(m, (math.cos(a) * r, math.sin(a) * r), n=4)
    m.ground_ao(0.06, 0.3)
    return m


# -- registration -----------------------------------------------------------------------------

BUDGETS = {'village': (1600, 220), 'town': (3000, 350), 'city': (5000, 500), 'castle': (3500, 400)}
BUILDERS = {
    ('village', 'temperate'): village_temperate,
    ('town', 'temperate'): town_temperate,
    ('city', 'temperate'): city_temperate,
    ('castle', 'temperate'): castle_temperate,
    ('village', 'north'): village_north,
    ('town', 'north'): town_north,
    ('city', 'north'): city_north,
    ('castle', 'north'): castle_north,
    ('village', 'desert'): village_desert,
    ('town', 'desert'): town_desert,
    ('city', 'desert'): city_desert,
    ('castle', 'desert'): castle_desert,
    ('village', 'marsh'): village_marsh,
    ('town', 'marsh'): town_marsh,
    ('city', 'marsh'): city_marsh,
    ('castle', 'marsh'): castle_marsh,
}

for (size, culture), fn in BUILDERS.items():
    full, far = BUDGETS[size]
    model(f'{size}-{culture}', budget=full, lo=far, ground='cobble', size=1.0)(fn)
