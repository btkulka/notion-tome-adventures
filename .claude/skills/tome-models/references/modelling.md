# Faceted modelling

These rules are distilled from the public skill packs, mainly
ozanzeng/blender-LPM-skill, EL4CTEO/blender-skills and majidmanzarpour's game
skills (clones are in D:/tools/skill-packs), and adapted to the kit.

## Read at map size

- **Dark-shape test:** the model must be recognisable as a flat dark silhouette
  at far-zoom size. If it isn't, simplify the geometry; don't add detail.
- **Brief first:** write down 3–5 silhouette features before modelling: a lean,
  a broken crown, a buttress, a spire offset from centre.
- **Families differ by outline:** recoloured cones are one variant, not a
  family. Settlement tiers differ by tower count, wall ring and spire, not scale.
- **Asymmetry:** mirror the base, then add seeded asymmetry (a lean, an
  off-centre apex, one broken merlon). Perfect grids read as fake.
- **Spend triangles where the outline changes:** tips, crests, crowns, eaves.
  Flat areas are single quads.
- **Fixed camera:**
  - A thin element whose broad face points along ±(1,1,0) is edge-on and
    disappears. Turn banners, slabs and gates to face between -Y and +X;
    (1,-1,0) is head-on.
  - Put facets and accents on visible faces (normal·(1,-1,1) > 0).
  - Lock yaw for anything with a designed front (settlements, landmarks);
    random yaw is fine for trees and rocks.
  - Odd side counts (5 or 7) avoid a symmetric outline from 45°.
- **Noise:** keep jitter under about a third of the local facet size. Big noise
  hides form and shimmers.
- **Avoid long thin triangles** across visible faces.

## Facet counts and budgets

- At tile scale, props are tiny on screen. Trunks get 5–6 sides, towers 6–8,
  crowns 5–7 with a jittered apex.
- Match the budgets of the props around it: landmarks run 400–2000 tris, with
  `lo` 60–250.
- `_lo`: rebuild from the same recipe with `lo=True` (fewer sides, no bands or
  trim). build.py decimates only as a fallback. Keep the outline: drop
  ornaments before limbs.

## Colour as form

- Neighbouring parts differ in **value**, not just hue: stone next to timber
  next to slate. Avoid two similar mid-tones touching.
- `_dark` twins go on undersides, recesses and door openings: cheap AO before
  any baking.
- Saturation stays moderate on large areas. Gilt, oxblood and heraldry are
  accents only.
- **Fake bevel:** a one-segment chamfer painted one value step lighter when it
  faces up, or darker when it faces down.

## Assembling parts

- Sink parts into each other by about 0.005 or more. Coplanar twins z-fight
  and bake black.
- Delete buried faces (a trunk inside a canopy, a tower inside a wall) when
  cheap. They cost triangles and bake black.
- Weld within a part, never across parts. Overlapping closed shells are fine.

## bmesh snippets (5.2-safe)

```python
import math, bmesh
from mathutils import Vector

def chamfer_crests(bm, col, rgb_hi, rgb_lo, offset=0.02, min_angle_deg=50):
    """One-segment chamfer on crest edges; each chamfer becomes its own lit facet.
    bevel copies loop colours from a neighbour, so repaint the new faces."""
    edges = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(min_angle_deg)]
    res = bmesh.ops.bevel(bm, geom=edges, offset=offset, offset_type='OFFSET', segments=1,
                          profile=0.5, affect='EDGES', clamp_overlap=True)
    for f in res['faces']:
        f.normal_update()
        c = rgb_hi if f.normal.z > 0.3 else rgb_lo
        for l in f.loops:
            l[col] = (*c, 1.0)
    return res['faces']

def recess(bm, face, inset=0.03, depth=-0.015):
    """Window, slit or panel recess. Returns the new faces: paint the sides with the dark twin."""
    return bmesh.ops.inset_region(bm, faces=[face], thickness=inset, depth=depth, use_even_offset=True)['faces']

def taper_to_point(bm, verts_top, apex_offset=(0.03, -0.02, 0.0)):
    """Spire or roof peak merged to one vertex, off-centre for asymmetry."""
    c = sum((v.co for v in verts_top), Vector()) / len(verts_top) + Vector(apex_offset)
    bmesh.ops.pointmerge(bm, verts=verts_top, merge_co=c)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges[:], dist=1e-5)
```

For faceted rocks, `kit.Mesh.blob(subdiv=1, noise_amount=..., flat_bottom=...)`
already does the job. For extra character, push a few vertex clusters along
random directions with a squared falloff instead of adding subdivisions.

## Geometry nodes?

No. Everything GN offers here (scatter, random pick, noise, bevel) is a few
lines of bmesh with full seed control. GN socket identifiers change between
versions (5.2 changed Random Value and Compare), and map-scale scattering
belongs in three.js instancing anyway.
