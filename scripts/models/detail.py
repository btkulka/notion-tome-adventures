"""
The detail pass: finer modelled detail added to full-detail builds by face
material (kit.MATERIALS), so all 79 models gain it without rewriting their
builders. build.py runs it for every detail tier above the original; far
versions never get it.

Every tier from Low:
  - Windows on building walls (plaster, masonry, wood in settlements and
    landmarks): dark panes with a stone sill, one row per storey, set a hair
    proud of the wall. Their material is 'window', so the app lights them at
    dusk. Squat curtain walls get arrow slits instead.
  - Timber framing on plaster houses in temperate and northern towns.
  - An eave strip along the lower edge of every roof.

Medium and up add high-fantasy flair (`flair=True`):
  - Pointed-arch windows.
  - Gilt finials (spike and orb) on every spire and roof peak that lacks one.
  - Pennants in the culture's colour on the tallest spires, broadside to the camera.
  - Hanging heraldic banners with a gilt diamond on castle and city walls that face the camera.
  - Gilt eave trims on noble buildings.
  - Arcane runes (the glowing 'arcane' material) on magical landmarks, and
    arcane light in the wizard tower's and elf spire's windows.

Everything added sits on or above existing faces, so the builders' own
geometry is untouched. Faces too small to be walls are skipped by size.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import kit

UP = Vector((0.0, 0.0, 1.0))
# Toward the camera, horizontally: the map camera looks down (1, -1, 1).
TOWARD_CAMERA = Vector((1.0, -1.0, 0.0)).normalized()
# Broadside to the camera: a flag along this shows its face, not its edge.
BROADSIDE = Vector((1.0, 1.0, 0.0)).normalized()
# Offsets in front of a wall: framing, then windows, then banners.
FRAME_OFFSET = 0.0008
WINDOW_OFFSET = 0.0014
BANNER_OFFSET = 0.0024

PANE = (0.10, 0.085, 0.07)
ARCANE_PANE = (0.30, 0.55, 0.75)
RUNE = (0.55, 0.85, 0.95)
FRAME_COLOUR = 'timber_dark'
SILL_COLOUR = 'stone_wall_light' if 'stone_wall_light' in kit.PALETTE else 'stone_wall'

# Heraldry by culture (the model name's suffix); landmarks fly oxblood.
CULTURE_COLOURS = {'temperate': 'oxblood', 'north': 'water_dark', 'desert': 'ember', 'marsh': 'moss_dark'}
NOBLE = ('castle-', 'city-', 'temple-', 'elfspire-', 'dwarfgate-')
MAGIC = ('wizardtower-', 'elfspire-', 'shrine-', 'monolith-', 'waystone-', 'stones-')
ARCANE_WINDOWS = ('wizardtower-', 'elfspire-')
ROOFS = ('slate', 'thatch', 'tile')


def culture_colour(name):
    return CULTURE_COLOURS.get(name.rsplit('-', 1)[-1], 'oxblood')


def new_face(m, points, colour, material, facing=None, both=False):
    """A face through `points`; flipped to face `facing` if given; `both` adds the back side too."""
    verts = [m.bm.verts.new(p) for p in points]
    f = m.bm.faces.new(verts)
    f.normal_update()
    if facing is not None and f.normal.dot(facing) < 0:
        f.normal_flip()
    m.paint([f], colour, 0.04, material=material)
    if both:
        back = m.bm.faces.new([m.bm.verts.new(p) for p in reversed(points)])
        back.normal_update()
        if facing is not None and back.normal.dot(facing) > 0:
            back.normal_flip()
        m.paint([back], colour, 0.04, material=material)
    return f


def wall_frame(face):
    """(centre, tangent, width, height, s0, z0) for a vertical face, or None if it isn't a usable rectangle."""
    n = face.normal
    if abs(n.z) > 0.2:
        return None
    t = Vector((-n.y, n.x, 0.0))
    if t.length < 1e-6:
        return None
    t.normalize()
    c = face.calc_center_median()
    ss = [(v.co - c).dot(t) for v in face.verts]
    zs = [v.co.z for v in face.verts]
    s0, s1, z0, z1 = min(ss), max(ss), min(zs), max(zs)
    w, h = s1 - s0, z1 - z0
    if w < 0.045 or h < 0.04 or face.calc_area() < 0.82 * w * h:
        return None
    return c, t, w, h, s0, z0


def on_wall(c, t, n, s, z, offset):
    return c + t * s + UP * z + n * offset


def quad(m, c, t, n, s, z, sw, zh, offset, colour, material):
    """A flat rectangle on a wall: centred `s` along t and `z` up from c, facing n."""
    base = on_wall(c, t, n, s, z, offset)
    a = base - t * (sw / 2) - UP * (zh / 2)
    return new_face(m, [a, a + t * sw, a + t * sw + UP * zh, a + UP * zh], colour, material, facing=n)


def arch(m, c, t, n, s, z, sw, zh, offset, colour, material):
    """A pointed-arch window: straight jambs to 65% of the height, then a point."""
    base = on_wall(c, t, n, s, z, offset)
    a = base - t * (sw / 2) - UP * (zh / 2)
    spring = zh * 0.65
    pts = [a, a + t * sw, a + t * sw + UP * spring, a + t * (sw / 2) + UP * zh, a + UP * spring]
    return new_face(m, pts, colour, material, facing=n)


def windows(m, face, frame, slits, flair, name):
    c, t, w, h, s0, z0 = frame
    n = face.normal.copy()
    zc = c.z
    if slits:
        count = max(1, min(8, int(w / 0.04)))
        for i in range(count):
            s = s0 + w * (i + 0.5) / count
            shape = arch if flair else quad
            shape(m, c, t, n, s, z0 + h * 0.6 - zc, 0.005, min(0.022, h * 0.35), WINDOW_OFFSET, PANE, 'window')
        return
    arcane = flair and name.startswith(ARCANE_WINDOWS)
    pane, material = (ARCANE_PANE, 'arcane') if arcane else (PANE, 'window')
    storeys = 2 if h > 0.11 else 1
    count = max(1, min(6, int((w - 0.016) / 0.032)))
    for k in range(storeys):
        zrow = z0 + h * ((0.38 + 0.36 * k) if storeys == 2 else 0.52) - zc
        for i in range(count):
            s = s0 + w * (i + 0.5) / count
            if flair:
                arch(m, c, t, n, s, zrow + 0.002, 0.011, 0.02, WINDOW_OFFSET, pane, material)
            else:
                quad(m, c, t, n, s, zrow, 0.011, 0.016, WINDOW_OFFSET, pane, material)
            quad(m, c, t, n, s, zrow - 0.0095, 0.015, 0.003, WINDOW_OFFSET, SILL_COLOUR, 'masonry')


def timber(m, face, frame):
    c, t, w, h, s0, z0 = frame
    n = face.normal.copy()
    zc = c.z
    post = 0.0045
    for s in (s0 + post / 2 + 0.001, s0 + w - post / 2 - 0.001):
        quad(m, c, t, n, s, z0 + h / 2 - zc, post, h * 0.98, FRAME_OFFSET, FRAME_COLOUR, 'wood')
    quad(m, c, t, n, s0 + w / 2, z0 + h * 0.55 - zc, w * 0.98, post, FRAME_OFFSET, FRAME_COLOUR, 'wood')
    if w > 0.09:
        a = on_wall(c, t, n, s0 + 0.006, z0 + 0.004 - zc, FRAME_OFFSET)
        b = on_wall(c, t, n, s0 + w * 0.3, z0 + h * 0.55 - zc, FRAME_OFFSET)
        side = n.cross((b - a).normalized()).normalized() * (post / 2)
        new_face(m, [a - side, a + side, b + side, b - side], FRAME_COLOUR, 'wood', facing=n)


def eave(m, face, colour, material):
    """A strip along the roof face's lowest edge."""
    low = min(face.edges, key=lambda e: max(v.co.z for v in e.verts))
    a, b = (v.co.copy() for v in low.verts)
    if abs(a.z - b.z) > 0.01 or (b - a).length < 0.03:
        return
    n = face.normal.copy()
    up_slope = (UP - n * UP.dot(n)).normalized() * 0.005
    lift = n * FRAME_OFFSET
    new_face(m, [a + lift, b + lift, b + up_slope + lift, a + up_slope + lift], colour, material, facing=n)


# -- flair --------------------------------------------------------------------------

def apexes(m):
    """Peak vertices of spires and roofs: the tip of a fan of at least four sloping
    faces whose other corners all sit clearly below it. Merlons and other
    flat-topped blocks never qualify, bevelled or not."""
    out = []
    for v in m.bm.verts:
        faces = v.link_faces
        if len(faces) < 4:
            continue
        normals = [f.normal for f in faces]
        if max(nn.z for nn in normals) > 0.9 or min(nn.z for nn in normals) < -0.2:
            continue
        if sum(nn.z for nn in normals) / len(normals) > 0.85:
            continue
        if any(e.other_vert(v).co.z > v.co.z - 0.012 for e in v.link_edges):
            continue
        kinds = {kit.MATERIALS[f[m.mat]] for f in faces}
        if not kinds & {'slate', 'thatch', 'tile', 'masonry', 'plaster', 'wood', 'none'}:
            continue
        out.append(v.co.copy())
    return out


def has_gilt_above(m, p):
    gilt = kit.rgb('gilt')
    for f in m.bm.faces:
        c = f.calc_center_median()
        if c.z > p.z - 0.002 and (c.xy - p.xy).length < 0.012 and c.z < p.z + 0.06:
            col = f.loops[0][m.col]
            if abs(col[0] - gilt[0]) < 0.12 and abs(col[1] - gilt[1]) < 0.12 and abs(col[2] - gilt[2]) < 0.12:
                return True
    return False


def finial(m, p):
    """A gilt spike with an orb, standing on a peak."""
    spike = m.cylinder(0.0028, 0.0, 0.032, seg=4, at=(p.x, p.y, p.z - 0.002), color='gilt')
    m.paint(spike, 'gilt', 0.05, material='none')
    orb = bmesh.ops.create_icosphere(m.bm, subdivisions=1, radius=0.0048, matrix=Matrix.Translation(p + UP * 0.011))['verts']
    m.paint(list({f for v in orb for f in v.link_faces}), 'gilt', 0.05, material='none')


def pennant(m, p, colour):
    """An iron pole above a peak flying a triangular pennant broadside to the camera."""
    pole = m.cylinder(0.0018, 0.0016, 0.05, seg=4, at=(p.x, p.y, p.z), color='iron')
    m.paint(pole, 'iron', 0.04, material='none')
    top = p + UP * 0.049
    tip = top - UP * 0.009 + BROADSIDE * 0.032
    new_face(m, [top, top - UP * 0.017, tip], colour, 'cloth', facing=TOWARD_CAMERA, both=True)


def banner(m, face, frame, colour):
    """A hanging banner with a swallowtail and a gilt diamond, high on a wall."""
    c, t, w, h, s0, z0 = frame
    n = face.normal.copy()
    bw = 0.014
    length = min(0.048, h * 0.62)
    top = z0 + h * 0.93 - c.z
    centre = on_wall(c, t, n, s0 + w / 2, top, BANNER_OFFSET)
    tl = centre - t * (bw / 2)
    tr = centre + t * (bw / 2)
    bl = tl - UP * length
    br = tr - UP * length
    notch = centre - UP * (length - 0.009)
    new_face(m, [tl, bl, notch, br, tr], colour, 'cloth', facing=n)
    d = centre - UP * (length * 0.42) + n * 0.0006
    r = 0.0042
    new_face(m, [d - UP * r, d + t * r, d + UP * r, d - t * r], 'gilt', 'none', facing=n)
    # The pole it hangs from.
    rod = centre + UP * 0.0012
    quad(m, c, t, n, s0 + w / 2, top + 0.0012, bw * 1.5, 0.0022, BANNER_OFFSET + 0.0003, 'iron', 'none')
    return rod


def runes(m, face, frame_or_face):
    """A column of glowing glyphs down the middle of a stone face."""
    n = face.normal.copy()
    t = Vector((-n.y, n.x, 0.0)).normalized()
    c = face.calc_center_median()
    zs = [v.co.z for v in face.verts]
    z0, z1 = min(zs), max(zs)
    h = z1 - z0
    count = max(2, min(5, int(h / 0.016)))
    for i in range(count):
        z = z0 + h * (0.2 + 0.6 * (i + 0.5) / count) - c.z
        p = on_wall(c, t, n, 0.0, z, WINDOW_OFFSET)
        r = 0.0034 if i % 2 else 0.0026
        # Alternate a diamond and a bar, like a line of script.
        pts = [p - UP * r, p + t * r, p + UP * r, p - t * r] if i % 2 else [p - t * 0.004 - UP * 0.0012, p + t * 0.004 - UP * 0.0012, p + t * 0.004 + UP * 0.0012, p - t * 0.004 + UP * 0.0012]
        new_face(m, pts, RUNE, 'arcane', facing=n)


def stonework(m, face, frame, course=0.042, length=0.076, proud=0.001, gap=0.0019):
    """Dressed stone courses on a masonry wall: each block a shallow raised box,
    courses half-offset, block lengths and tones varied. The wall behind shows
    in the joints as mortar, and the AO bake settles into them."""
    c, t, w, h, s0, z0 = frame
    n = face.normal.copy()
    base = m.rng
    tone = kit.rgb(tuple(face.loops[0][m.col])[:3])
    courses = max(2, int(round(h / course)))
    ch = h / courses
    for k in range(courses):
        za = z0 + k * ch + gap / 2
        zb = z0 + (k + 1) * ch - gap / 2
        s = s0 - (length / 2 if k % 2 else 0.0)
        while s < s0 + w - 1e-4:
            run = length * base.uniform(0.75, 1.25)
            sa, sb = max(s, s0) + gap / 2, min(s + run, s0 + w) - gap / 2
            s += run
            if sb - sa < 0.006:
                continue
            depth = proud * base.uniform(0.7, 1.3)
            k_tone = base.uniform(0.94, 1.1)
            colour = tuple(min(1.0, v * k_tone) for v in tone)
            p = lambda ss, zz, dd: c + t * (ss - 0.0) + UP * (zz - c.z) + n * dd  # noqa: E731
            front = [p(sa, za, depth), p(sb, za, depth), p(sb, zb, depth), p(sa, zb, depth)]
            back = [p(sa, za, 0.0), p(sb, za, 0.0), p(sb, zb, 0.0), p(sa, zb, 0.0)]
            new_face(m, front, colour, 'none', facing=n)
            new_face(m, [back[3], back[2], front[2], front[3]], colour, 'none', facing=UP)
            # No underside: the map camera always looks down on it.
            new_face(m, [back[0], back[3], front[3], front[0]], colour, 'none', facing=-t)
            new_face(m, [back[1], front[1], front[2], back[2]], colour, 'none', facing=t)


def flourish(m, name):
    """The Medium-and-up flair that isn't tied to one wall: finials, pennants, runes."""
    peaks = [p for p in apexes(m) if p.z > 0.08]
    peaks.sort(key=lambda p: -p.z)
    colour = culture_colour(name)
    flags = 3 if name.startswith(('castle-', 'city-')) else 2 if name.startswith('town-') else 1 if kit.CONTEXT == 'settlements' else 0
    for i, p in enumerate(peaks):
        if i < flags:
            pennant(m, p, colour)
        elif not has_gilt_above(m, p):
            finial(m, p)
    if name.startswith(MAGIC):
        stone = [f for f in m.bm.faces if kit.MATERIALS[f[m.mat]] in ('rock', 'masonry', 'none', 'plaster')
                 and abs(f.normal.z) < 0.3 and f.normal.dot(TOWARD_CAMERA) > 0.25 and f.calc_area() > 0.0006]
        stone.sort(key=lambda f: -f.calc_area())
        for f in stone[:3]:
            runes(m, f, None)


def apply(m, name, flair=False):
    """Add the detail (and, with `flair`, the high-fantasy flourishes) to Mesh m in place."""
    bm = m.bm
    bm.normal_update()
    builds = kit.CONTEXT in ('settlements', 'landmarks', 'imported') and not name.startswith('ruin-')
    framed = kit.CONTEXT == 'settlements' and ('temperate' in name or 'north' in name)
    noble = flair and name.startswith(NOBLE)
    heraldic = flair and name.startswith(('castle-', 'city-', 'dwarfgate-'))
    colour = culture_colour(name)
    banners = 0
    for face in list(bm.faces):
        kind = kit.MATERIALS[face[m.mat]]
        if kind in ROOFS and 0.25 < face.normal.z < 0.97:
            eave(m, face, 'gilt' if noble else kit.shade(FRAME_COLOUR, 0.8), 'none')
            continue
        if not builds or kind not in ('plaster', 'masonry', 'wood'):
            continue
        frame = wall_frame(face)
        if frame is None:
            continue
        _, _, w, h, _, _ = frame
        if framed and kind == 'plaster':
            timber(m, face, frame)
        if flair and kind == 'masonry':
            stonework(m, face, frame)
        windows(m, face, frame, slits=kind == 'masonry' and h < w * 0.45, flair=flair, name=name)
        if heraldic and kind == 'masonry' and banners < 6 and w >= 0.08 and h >= 0.05 and face.normal.dot(TOWARD_CAMERA) > 0.3:
            banner(m, face, frame, colour)
            banners += 1
    if flair:
        bm.normal_update()
        flourish(m, name)
