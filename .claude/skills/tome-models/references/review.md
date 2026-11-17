# Reviewing a model

Numbers passing on every run while the model looks broken is common. Looking
is mandatory: open the sheet PNG before you report.

## The loop

1. `npm run models -- --names <model>[,<sibling>] --no-ao --sheet out.png` (add
   `--lo` for the far versions; `--cell 420` for a closer look).
2. Read the image. Write the problems as measurements ("spire 30% too thick,
   door edge-on"), not adjectives.
3. Fix the constants in the builder, then rerun. One cause per round; three
   rounds is normal.
4. Last, run with AO, then rebuild the GLB and check it in the app (Ben's
   Chrome, not headless).

## Critique checklist

- **Squint / thumbnail:** does the silhouette tell the story at far zoom, and
  does it stand apart from its siblings?
- **Greyscale:** do neighbouring parts differ in value? Muted palettes fail
  this first.
- **Grounding:** the base sits flush, nothing floats, nothing clips into the
  diorama block.
- **Holes:** inward-wound faces show as holes, because back faces are culled.
- **Edge-on thin parts;** is the detail on the camera side?
- **Facet waste:** curves eating triangles; flat areas that aren't single quads.
- **Art direction:**
  - Fails: rounded blobs, mushroom proportions, perfect symmetry, saturated
    primaries, generic medieval boxes.
  - Passes: tall, narrow proportions, chamfered crests, buttresses,
    leaning or broken silhouettes, tarnished accents.
- **`_lo`:** same outline and the same bounds within about 2%, readable at
  far-zoom pixel size.

## Gates worth checking (automate when a problem repeats)

| Gate | Threshold |
|---|---|
| tris ≤ budget, `_lo` ≤ lo | build.py fails over budget |
| UV layers | none |
| `Col` | present, `BYTE_COLOR`, `CORNER`, active; no other colour attributes left |
| ground | min z in [-0.08, 0.002] |
| centred | bbox centre within 0.05 × size of the origin |
| flipped faces | 0 per loose part (compare against a `recalc_face_normals` copy) |
| degenerate faces | area < (diag·1e-4)² |
| z-fighting | coplanar overlapping faces within about 0.002 |
| GLB | each primitive has `POSITION` and `COLOR_0`, no `NORMAL` or `TEXCOORD_0`; Draco listed as required; mesh names = names ∪ names_lo |

EL4CTEO's `skills/blender-asset-qa/scripts/qa_check.py` (in
D:/tools/skill-packs) is the best reference implementation of the island,
winding and z-fight checks. Port pieces of it; don't run it raw, because it
assumes UVs and materials.

## Silhouette comparison (imports, `_lo`)

Render flat white-on-black from the game camera at the same framing (world
registered, not each image fitted to its own bounding box). IoU ≥ 0.90 passes,
under 0.80 is wrong. Use it to stop decimating a conformed import before its
outline breaks.
