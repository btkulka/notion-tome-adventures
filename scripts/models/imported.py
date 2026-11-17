"""
Models brought in from outside (TRELLIS.2 and other image-to-3D tools),
already conformed to the kit by conform.py: low-poly, standing on the origin,
front to -Y, every face one palette colour.

Each lives in imported/<name>.json:

  {"name": "ruin-keep", "budget": 900, "lo": 160, "ground": "grass", "size": 0.9,
   "draft": true, "source": "...", "verts": [[x, y, z], ...],
   "faces": [[i, j, k], ...], "colors": ["granite", ...]}

A draft builds only when named (npm run models -- --names ruin-keep --sheet
out.png). To put one on the map: set "draft": false, add its name to
MODEL_NAMES in src/features/maps/render/catalog.ts, and choose it somewhere
in src/features/maps/render/props.ts.
"""
import json
import os

import kit

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'imported')


def builder(data):
    def build(rng, lo):
        m = kit.Mesh(rng)
        verts = [m.bm.verts.new(v) for v in data['verts']]
        jitter = data.get('jitter', 0.04)
        for face, key in zip(data['faces'], data['colors']):
            try:
                f = m.bm.faces.new([verts[i] for i in face])
            except ValueError:
                continue  # a duplicate face; conform.py should have dropped it
            m.paint([f], key, jitter)
        # The far version is the same mesh; build.py decimates it to the lo budget.
        return m
    return build


def register_all():
    if not os.path.isdir(DIR):
        return
    for file in sorted(os.listdir(DIR)):
        if not file.endswith('.json'):
            continue
        with open(os.path.join(DIR, file), encoding='utf-8') as fh:
            data = json.load(fh)
        kit.model(
            data['name'], budget=data['budget'], lo=data['lo'], ground=data.get('ground', 'grass'),
            size=data.get('size', 0.8), draft=data.get('draft', True),
        )(builder(data))


register_all()
