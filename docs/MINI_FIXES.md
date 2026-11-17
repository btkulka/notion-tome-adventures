# Hi-def miniatures: what needs fixing

The running list from Ben's reviews of each model's preview (`scripts/models/minis/out/<prop>-preview.png`).
Ben said to hold all fixes until later (Nov 16 2026): log here, don't fix yet. Each entry: the prop, what's wrong,
where it shows, and the fix to try.

| Prop | Problem | Fix to try |
|---|---|---|
| fir-1 | Salmon-pink undersides on every tier: TRELLIS guessed the colour of surfaces the concept image hides. In both GLBs (painted and textured), not just the preview. | Repaint downward-facing foliage faces from their tier's top colour; or a new seed; or Pixal3D on the same image. |
| fir-2 | Needles paler and frostier (blue-white) than the concept's dark blue-green. Minor. | Check it under the map's own light first; if still pale, darken and saturate the foliage in the texture. |
| city-temperate | Layout and silhouette are right (ring wall, towers with copper domes, the twin-spired cathedral, the avenue to the gate). Colours read darker and browner than the concept's pale limestone; the red banners mostly vanish; the house rows go mushy at 500k faces; a few small holes in the front of the ground patch. | Re-run complex models at a higher face cap (1M+) once the look is settled; lighten and cool the stone in the texture; check the material's metallic map (metallicFactor 1 with a metallic-roughness texture) isn't what darkens it. |
| city-north | Mountain, great hall, terraces and towers came through, but the back half (which the concept doesn't show) is a mass of vertical streaked rock, the guardian statues and knotwork gate blur out, and the stone reads darker and browner than the concept's grey. | Higher face cap; a second concept from behind isn't possible in TRELLIS (one image in), so try Pixal3D or another seed for a cleaner back; lighten the stone. |
| elderfir-1 | The canopy sits low and hides most of the great fluted trunk the concept shows; the lichen beards read as a frosty white fringe on every tier. Roots, stubs and split crown came through. | A new seed, or Pixal3D; if the canopy still swallows the trunk, a concept seen from a little lower. |
| fir-3 | Moss reads as flat mustard-yellow blobs over the tiers and roots, brighter than the concept's olive; needles a brighter green than its dark teal. | Pull the yellows toward olive and darken the greens in the texture (a hue/value pass on the texture image). |

## Shared fixes to consider

- Every model is 500k triangles with 4096 maps (fir-1: 71 MB textured). The app needs a web version per prop
  (decimated, 2048 or smaller maps, Draco/KTX2) before any of them can load on the map.
