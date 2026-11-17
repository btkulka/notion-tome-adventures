# Importing image-to-3D models (TRELLIS.2 and others)

Policy: generated 3D is for **hero pieces** (a ruined keep, a dragon skull, a
strange monument). The everyday kit stays procedural. Everything imported goes
through conform.py and the same review as hand-built props.

## Local TRELLIS.2

- Install: a dedicated ComfyUI 0.45+ at `D:/tools/comfyui-3d` with its own
  venv (Python 3.12, torch cu130). TRELLIS.2 is built into ComfyUI core; it
  needs no custom nodes and nothing compiled. It's kept separate from the main
  ComfyUI (D:/source/comfyui) so that install's custom nodes and workflows are
  untouched. `extra_model_paths.yaml` shares the main install's checkpoints
  (SDXL for concept images).
- Weights (about 9 GB): `node scripts/models/trellis/setup.mjs` downloads
  what's missing and resumes; `--check` reports.
  - `diffusion_models/trellis_2_int8_convrot.safetensors` (5.25 GB)
  - `vae/trellis_2_shape_vae_bf16.safetensors`, `vae/trellis_2_texture_vae_bf16.safetensors`
  - `clip_vision/dino_v3_L_naf_fp32.safetensors`
  - `background_removal/birefnet.safetensors`
- Run: `node scripts/models/trellis/serve.mjs` serves on 127.0.0.1:8190 with
  `--lowvram --reserve-vram 1 --cache-none`, half the cores, low priority. It
  refuses to start if the main ComfyUI (:8188) is up, or if less than 6 GB of
  RAM is free. Close things first; don't force it.
- Generate: `node scripts/models/trellis/generate.mjs --image ref.png --name ruin-keep --height 1.1`.
  `--prompt "subject"` instead draws a concept image with SDXL first.
  `--quality high` uses the full 1536 cascade, a 768 remesh and SDXL base
  concepts at 1024 px: better shapes, slower, and the most RAM. Unknown
  flags pass through to conform.py; `--no-conform` stops at the raw GLB. Raw
  GLBs, concept images, the exact API prompt and a meta file land in
  scripts/models/trellis/out/ (git-ignored). The script converts the template
  below using the server's own node definitions, resolves its switches to
  TRELLIS.2, and saves the **vertex-painted** mesh (PaintMesh). That skips UV
  unwrap and four texture bakes, since conform only needs a colour per face. It
  also caps resolution at 1024 and the remesh at 512 for 8 GB.
- Workflow (what generate.mjs automates): ComfyUI template `3d_pixal3d_trellis2_image_to_model`. Set
  `Boolean (Switch to Trellis2)` to true; Pixal3D is the default and needs the
  extra MoGe model. Nodes: Trellis2Conditioning → Trellis2ShapeStage →
  Trellis2UpsampleStage (target_resolution 1024 on 8 GB, not 1536) →
  Trellis2TextureStage → VaeDecode{Shape,Texture}Trellis → mesh post-process
  (DecimateMesh, UnwrapMesh, BakeTextureFromVoxel) → SaveGLB. Output lands in
  `D:/tools/comfyui-3d/output/3d/`.
- Hardware: an RTX 3070 with 8 GB and 16 GB of system RAM is the floor. Expect
  minutes per model and heavy paging if other apps hold memory. One generation
  at a time; nothing else heavy alongside.

## Rented TRELLIS.2 and the hi-def miniatures (Nov 16 2026)

`npm run minis` (scripts/models/minis/rent.mjs) runs TRELLIS.2 on a GPU
rented by the minute on RunPod, through `@btkulka/trellis-client` (rent) and
`@btkulka/runpod-client` (linked from D:/source/packages). The output isn't
conformed: it's the hi-def set, one textured GLB per prop in `MODEL_NAMES`
(quality high, 4096 PBR maps, up to 500k faces), in scripts/models/minis/out/
(git-ignored). Nothing heavy runs here except the preview render.

- Concept art: one image per prop, made by Ben in ChatGPT from
  docs/MINI_PROMPTS.md (no local SDXL), saved as
  scripts/models/minis/concept/<prop>.png.
- Ben reviews **one model at a time**: `--up --yes` rents one GPU and leaves
  it up (about 10 min of setup; the session is in %TEMP%/tome-minis-pod.json),
  `--next` models the next prop and renders `<prop>-preview.png`
  (scripts/models/minis/preview.py: four turns at the map camera's angle). Show
  him the preview, wait for his word, then `--next` again. `--down` when done.
- Without `--yes` it prints the price and rents nothing. Say the price before
  renting. A 48 GB A40 was $0.59/h on Nov 16; the pod ends at its deadline
  (`--minutes`, 180 for `--up`) even if `--down` never comes.
- `npm run minis -- --yes` with no GPU up does every remaining prop in one
  rental (the plan prints the worst case first).

## The input image

One object, centred, fully visible, plain light background, readable
silhouette, **clear material zones** (stone vs roof vs timber; these become
palette regions), even flat light (baked highlights become wrong palette
picks), no text, nothing cropped. Angular high-fantasy subject matter, not
cute. Generate the image with SDXL (shared checkpoint) or supply a reference.

## conform.py

`npm run models:conform -- raw.glb --name ruin-keep --height 1.1 [knobs]`

| Knob | Default | Use |
|---|---|---|
| `--height` / `--width` | 1.0 / none | Landmarks and trees by height; settlements by footprint width |
| `--yaw` | 0 | Degrees about Z so the front faces -Y. Generators disagree on forward: check the sheet, then fix in 90° steps |
| `--budget` / `--lo` | 2400 / budget÷6 | 2400 keeps battlements and openings that 1200 melted (2026-11-12); go lower only for small props |
| `--planar` | 5 | Degrees: merges near-flat neighbours mid-decimation for big facets (0 off) |
| `--remesh` | 0 | Voxel size in tiles (about 0.01–0.02) to seal holes in non-manifold shells first |
| `--min-piece` | 0.01 | Drop loose pieces below this share of the area |
| `--colors` | 6 | Colour groups before snapping (0 = snap each face) |
| `--palette` | all keys | Restrict to a family, e.g. `granite,granite_dark,granite_light,roof_slate,timber` |
| `--final` | off | Write it as not-a-draft |

What it does: import, weld (glTF splits vertices at every seam), drop
floaters, normalise, collapse to 4× the budget, planar dissolve, collapse to
the budget. Then it samples the source texture under each face, runs k-means
in OKLab, snaps to the palette (undersides take `_dark` twins) and despeckles.
It writes `scripts/models/imported/<name>.json`; imported.py builds it like any
model, with AO and `_lo`. Sources over 250k tris are thinned on import. The
watchdog stops a run after 10 minutes.

## What the first run taught (ruin-dwarfwatch, 2026-11-12)

- **Timings and memory on this machine:** the SDXL Turbo concept takes about
  25 s and the TRELLIS run about 3 minutes (output 250k tris, 7.5 MB GLB);
  conform takes seconds. Free RAM dipped to about 1.6 GB during sampling with
  the desktop apps closed; the memory floor (0.7 GB) never fired.
- **SDXL base on this machine is a truncated download** (4.5 of 6.9 GB in the
  main ComfyUI), so `--concept turbo` (the default) is the one that works.
- **Scale wide subjects by `--width`** (0.6–0.85 for landmarks). `--height`
  let a wide keep spill to 1.3 tiles.
- **Don't `--remesh` TRELLIS output.** It's a thin shell; voxel remeshing
  hollowed it into holes and see-through walls. Plain conform (planar 5) gave
  the solid, readable result.
- **Result quality:** organic and ruined subjects come out well, reading as
  weathered rubble stone at map size. Crisp architecture is still better hand
  built in bmesh. Use TRELLIS for one-off hero pieces, not the kit.
- Concept prompts that worked: subject + "single object, centered, entire
  object visible, three-quarter view from slightly above, plain light grey
  background, soft even lighting, clear distinct material zones, angular
  serious high fantasy" (generate.mjs adds this for you).

## Promoting a draft

1. Review it: `npm run models -- --names <name>,<sibling> --sheet out.png`.
2. Set `"draft": false` in the JSON, or re-conform with `--final`.
3. Add the name to `MODEL_NAMES` in render/catalog.ts and pick it in
   render/props.ts (pin types choose names explicitly).
4. `npm run models`, then the vitest catalog test, then look in the app.

## Other generators

The same conform step works for Meshy, Tripo or Rodin exports. Meshy's useful
settings: `model_type: lowpoly`, `remove_lighting: true`, `symmetry_mode:
off`; Meshy assets expire after 3 days. Keep provenance (source, prompt, seed,
settings): conform.py records its own settings in the JSON.
