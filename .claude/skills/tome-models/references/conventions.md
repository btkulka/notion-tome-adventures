# Conventions contract

Everything in scripts/models and src/features/maps/render agrees on these. Change
one side and you must change the other.

| Thing | Value | Where it's enforced |
|---|---|---|
| Unit | 1 Blender unit = 1 map tile edge; one elevation step = 0.3 | kit.py docstring, render/geometry.ts |
| Origin | model stands on z = 0; bases pushed to about -0.05 so they sit flush on slopes | kit.py |
| Front | -Y in Blender → +Z in three.js (the glTF exporter maps x,y,z → x,z,-y) | kit.py |
| Camera | orthographic, looking down the (1,-1,1) diagonal in Blender, (1,1,1) in three.js; elevation asin(1/√3) = 35.26° | build.py `VIEW`, render/camera.ts |
| Visible sides | faces with normal·(1,-1,1) > 0: -Y, +X and top | — |
| Colour | face-corner `BYTE_COLOR` attribute `Col`, sRGB in the bytes; `COLOR_0` in the GLB (linear, three treats it so) | kit.Mesh, build.export_glb |
| Palette | `kit.PALETTE` keys only; muted, tarnished; `_dark`/`_light` twins for recesses and tops | kit.py |
| Material | none exported; the app uses one `MeshLambertMaterial({ vertexColors, flatShading })` with colour × `PROP_EXPOSURE` (2.2) | render/models.ts |
| Normals, UVs | not exported (GLTFLoader computes flat normals) | build.export_glb |
| Back faces | culled in the app and in preview sheets: an inward face is a hole | prop_material |
| Far zoom | every model has `<name>_lo`, under its `lo` budget; drawn below 30 px/tile | Props3D.tsx `FAR_ZOOM` |
| GLB | public/models/world-props.glb, Draco level 7, position 14 bits, colour 10 bits | build.export_glb |
| Model tiers | Low (`world-props-low.glb`, detail 3) and Medium (`world-props-medium.glb`, detail 6 + flair), each about 2x the one below; High and Ultra to come. Viewers pick in Graphics (editor View menu, player toolbar), stored per browser, default Medium; every tier must match catalog.ts | build.py `TIERS`, render/quality.ts, catalog.test.ts |
| Face materials | face int attribute `mat` (kit.MATERIALS index, set by `paint()` from the palette key and `kit.CONTEXT`), exported per corner as `_MAT`; the prop shader picks a 512 px surface pattern per material (public/textures/props/patterns.png, `npm run textures:props`) and lights `window` faces at dusk | kit.py, build.tag_materials, render/models.ts |
| Render density | High (default) supersamples at 2× the screen's pixel density, capped at 3×, falling back to Standard if fps drops; per browser in the View menu | render/quality.ts, MapView |
| Terrain textures | 512 px, one repeat per 2.5 tiles (about 205 texels per tile) | scripts/textures, render/geometry.ts `TOP_REPEAT` |
| Names | `<group>-<variant>`, lowercase, hyphens; `_lo` reserved; must be in catalog.ts `MODEL_NAMES` | kit.model, catalog.test.ts |

## The light the props are drawn under

- **No world clock** (editor outside a session): the studio sun, `STUDIO_SUN =
  normalize(-36, 48, -14)` in three.js, at 51° elevation and intensity 1.7,
  plus hemisphere 0.85. build.py's `SUN_FROM`, `SUN_STRENGTH` and `SKY` mirror
  this for preview sheets.
- **With a clock** (table sessions, the View menu preview): sky.ts moves the
  sun along an arc. It rises due east and peaks over the map's chosen noon
  side, which defaults to north. The moon follows its phase. The shading light
  never comes from lower than 30° (`SHADE_MIN`), so low light keeps its bearing
  without grazing the land black.
- The studio sun nearly backlights props from the default view, so the walls
  facing the camera get mostly hemisphere fill. Separate facets with per-face
  colour and value, not with light. A hemisphere light depends only on how much
  a face points up, so vertical facets facing the camera shade identically.

## Colour space traps

- `bm.loops.layers.color` (kit.Mesh) reads and writes the raw sRGB bytes.
- `mesh.color_attributes['Col'].data[i].color` is **linear**; `.color_srgb` is sRGB.
- The AO bake reads and writes `.color` (linear), on purpose: occlusion darkens
  in linear light.
- Draco's 10-bit colour quantization shifts the darkest palette entries by
  1–2/255. A palette check on a decoded GLB needs about 3/255 of tolerance.
