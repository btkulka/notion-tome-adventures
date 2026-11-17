---
name: tome-models
description: Build, change, import or review Tome's 3D world-map props (trees, rocks, settlements, landmarks) in Blender 5.2 with bpy/bmesh, bake their AO, conform TRELLIS or other image-to-3D meshes into the kit, or tune how they read under the map's sky. Use for any "make/model/add a prop", "the map should look more fantasy", Blender, GLB or TRELLIS work in this repo, even if Blender isn't named.
---

# Tome world-map props

**Form comes from facets, silhouette and colour. AO and lighting only confirm it.**

Props are low-poly, flat-shaded and drawn with one Lambert material. They have
no textures, UVs, normals or emission. Each face is one palette colour, stored
in the face-corner byte attribute `Col`. The look is angular, serious high
fantasy (see the tome-design-direction memory): tall, chamfered and tarnished,
never rounded, cute or generic medieval.

## Before anything heavy

The machine is 4 cores and 16 GB of RAM, shared with everything else. Follow
the CLAUDE.md rules, which come down to:

- one heavy job at a time;
- only the guarded launchers;
- previews in Ben's real Chrome, not headless SwiftShader.

`npm run models*` enforces this: it takes a lock, checks memory, uses half the
cores, runs at low priority and has a watchdog (scripts/models/heavy.mjs,
run.mjs).

## Commands

| Need | Command |
|---|---|
| Iterate on one model, fast | `npm run models -- --names oak-2 --no-ao --sheet out.png` |
| Look at a module with AO | `npm run models -- --only landmarks --sheet out.png` |
| Rebuild the app's GLBs | `npm run models`: every detail tier, Low (`world-props-low.glb`) and Medium (`world-props-medium.glb`), AO baked, Draco. `--tier medium` builds one |
| Preview at a tier | `npm run models -- --names x --tier medium --sheet out.png` (sheets now draw the app's surface patterns and the arcane glow) |
| Import a generated mesh | `npm run models:conform -- raw.glb --name ruin-keep --height 1.1` |
| One-off Blender script, guarded | `node scripts/models/run.mjs script path/to/x.py -- args` |
| Detail tiers | **Each step doubles the triangles** (Low 112,839; Medium 247,537 on 2026-11-12; High and Ultra still to build). Low = `--detail 3`, Medium = `--detail 6` plus flair (detail.py: stonework courses, pointed windows, gilt finials, pennants, heraldic banners, gilt eaves, arcane runes). Calibrate DETAIL and stonework size so each tier lands about 2x the one below; spheres use `kit.sphere` (geodesic, about 2x facets per step). At Low: Round shapes get 3× sides (`kit.dseg`), icosphere clumps one level finer (`kit.dsubdiv`), hull rocks 2× points (`kit.dpoints`), plus detail.py's windows, slits, timber and eaves; budgets ×4; far versions unchanged. Builders call these helpers for anything laid out around a ring; `exact=True` keeps a designed polygon |
| Terrain textures | `npm run textures` (512 px, tiles every 2.5 tiles; scripts/textures) |
| TRELLIS server | `node scripts/models/trellis/serve.mjs` (see references/importing.md) |
| Hi-def miniatures on a rented GPU | `npm run minis` (price only), `-- --up --yes`, `-- --next` (one prop and its preview), `-- --down` (references/importing.md) |

Always open the sheet PNG and look at it before reporting. Scripts print their
numbers: report triangles, budgets and file paths, not adjectives.

## Making or changing a model

1. **Brief.** Write down the 3–5 silhouette features that make it read at map
   size, and which family it belongs to (its siblings must differ by outline,
   not just size). Choose a triangle budget near its siblings' (see the
   `@model` lines in landmarks.py and the other modules).
2. **Build it in the right module**: trees.py, ground.py, settlements.py or
   landmarks.py. Use `@model(name, budget=, lo=, ground=, size=)` and the
   kit.Mesh primitives: `loft`, `cylinder`, `box(bevel=, taper=)`, `prism`,
   `blob`, `jitter`, `bend`, `insert`, `paint*`. Draw shape parameters from
   `rng` *before* branching on `lo`, so both versions share a silhouette.
3. **Colour from `kit.PALETTE` keys only.** Add a key rather than inline hex.
   Paint undersides and recesses with the `_dark` twin. Keep value contrast
   between neighbouring parts; the map camera sees mostly shaded sides.
4. **Look** (`--names x --no-ao --sheet`), fix and look again. Three rounds is
   normal; more than five means the part list was wrong. Then look once with AO.
5. **New names** must be added to `MODEL_NAMES` in
   src/features/maps/render/catalog.ts and picked somewhere in props.ts. The
   catalog test fails if the GLB and the list disagree.
6. Run `npm run models` and `npx vitest run src/features/maps`, then check the
   map in the app.

## Rules that bite

- 1 unit is one tile; one elevation step is 0.3. Sink bases to about -0.05.
  The front faces -Y. Camera elevation is 35.26°, looking down (1,-1,1).
  Details: references/conventions.md.
- A thin element whose broad face points along ±(1,1,0) is seen edge-on and
  vanishes. Spend facets and accents on the -Y, +X and top sides.
- Byte colour: bmesh layers and `.color_srgb` are sRGB; RNA `.color` is
  **linear**. Mixing them up double-darkens the palette.
- The AO bake is per face by default (`--ao-corners` for gradients),
  strength 0.65, distance 0.4 tiles. It ignores corners below ground. Don't let
  AO or night light be what makes a prop read.
- Preview sheets match the app only while `PROP_EXPOSURE` and
  `SUN_FROM`/`STUDIO_SUN` agree between build.py, models.ts and sky.ts.
- Blender 5.2 API changes and the error → fix table: references/blender5.md.

## Do not

- Decimate a high-poly mesh and call it low-poly. Conformed imports still get a
  look and a palette check.
- Exceed a budget "just a little": drop a ring, merge parts.
- Accept a model from one flattering view, or from numbers alone.
- Run Blender, ComfyUI or a headless browser alongside another heavy job, or
  skip the launchers.
- When Ben rejects a prop, add the rule here (or to a reference) before rebuilding.

## References

| File | Read it when |
|---|---|
| references/conventions.md | Starting any model: axes, units, colour space, lighting contract |
| references/modelling.md | Shaping: faceting rules, budgets, bmesh snippets (chamfer, recess, rocks), `_lo` strategy |
| references/review.md | Judging a sheet: critique checklist, QA gates, silhouette checks |
| references/importing.md | TRELLIS.2 or any image-to-3D: setup, prompts, conform.py knobs, promoting a draft |
| references/blender5.md | Code fails with AttributeError/TypeError, or you touch export or bake settings |
| references/sky-and-light.md | Props read wrong at some hour or weather; changing sky.ts |
