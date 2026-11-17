# Blender 5.2 notes

Tome uses Blender **5.2.4 LTS**, portable at
`D:/tools/blender/blender-5.2.4-windows-x64/` (4.2 was removed on 2026-11-11).
run.mjs finds it, or set `BLENDER`. Python inside is 3.13; numpy is bundled.

## API changes that matter here (4.x → 5.x)

These come from EL4CTEO/blender-skills `blender-core/references/api-changes-5x.md`
(verified there on 5.2.3); the items marked ✓ were confirmed in this repo.

| Old | 5.x | Here |
|---|---|---|
| engine `BLENDER_EEVEE_NEXT` | `BLENDER_EEVEE` (the old id is rejected) | ✓ build.py picks whichever exists |
| `material.use_nodes = True`, `world.use_nodes = True` | deprecated (removed in 6.0); new materials and worlds already have node trees | ✓ `nodes_on()` guards it |
| `nodes['Principled BSDF']` | works, but names are localised; find by `n.type == 'BSDF_PRINCIPLED'` | ✓ `principled()` |
| `image_settings.file_format` alone | set `image_settings.media_type = 'IMAGE'` first | ✓ |
| `mesh.use_auto_smooth` | gone since 4.1; we stay flat (`poly.use_smooth = False` is the bmesh default) | — |
| `Mesh.shade_smooth(kwargs)` | takes no kwargs in 5.x | avoid |
| GN `mod["Socket_2"] = v` | `getattr(mod.properties.inputs, sock.identifier).value = v` (5.2) | GN not used |
| glTF `export_colors` | gone; use `export_vertex_color` (`ACTIVE` here; 5.2 also has `NAME` + `export_vertex_color_name`) | ✓ |
| Filmic default | AgX default; Filmic still exists. Judge palette colours under **Standard** | sheets use Filmic for mood |
| Cycles bake target | unchanged: `scene.render.bake.target = 'VERTEX_COLORS'`, `bake(type='AO', target=...)` | ✓ |

Unsure about an operator's arguments? Introspect rather than guess:
`[p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties]`.

## The AO bake (how it works and why)

- It needs no UVs: Cycles bakes the active colour attribute per face corner.
  The bake adds a scratch `AO` `FLOAT_COLOR` corner attribute, reads it, then
  removes it.
- Reach is `world.light_settings.distance`. The default of 10 means 10 tiles
  here and darkens everything; we use 0.4.
- Objects with `hide_render` don't occlude; viewport-hidden ones still do.
  Every model sits at the origin, so each one bakes alone, plus a temporary
  ground plane at z = 0 for contact shading.
- Corners below ground bake black and are ignored. By default each face takes
  the mean of its visible corners (flat facets); `--ao-corners` keeps the
  gradients.
- Cost scales with corners × samples, not pixels: the full landmark set bakes
  in about a second.

## Error → fix

| Symptom | Fix |
|---|---|
| `TypeError: enum "BLENDER_EEVEE_NEXT" not found` | use `BLENDER_EEVEE` |
| DeprecationWarning `use_nodes` | `nodes_on(idblock)` |
| `COLOR_0` missing in the GLB | `Col` not active after an edit: set `color_attributes.active_color` and `render_color_index` |
| Palette looks washed out on the sheet | Filmic/AgX view transform; compare under Standard |
| Black corners or faces after AO | buried faces (delete them) or AO distance left at 10 |
| Prop reads as a line | broad face edge-on to (1,1,0): turn it |
| conform hangs right after import | an unwelded mesh (glTF seams); conform now welds first, so check the edit didn't remove `weld()` |
| "Another blender job is running" | wait; it's the cross-session lock (`%TEMP%\tome-blender.lock`), and a dead holder is taken over automatically |
| "Blender ran past N minutes" | the watchdog; find out why before raising `TOME_TIMEOUT_MIN` |
