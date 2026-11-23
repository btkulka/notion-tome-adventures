# Clouds over the map

The weather over a region map (src/features/maps/render/clouds.ts and Weather.tsx): cloud shadows drifting across
the ground and water, two see-through mist layers rolling over the land (the peaks stand up through them), and
cloud models drifting high overhead. All of it follows the table's weather (more cloud and mist from clear through
overcast, rain, storm and snow to fog), fades at the map's edges, and fades out as the camera zooms in past about
2×, gone by 6×. The cloud models cast real shadows when shadows are on (High quality).

## Ben's words (2026-11-22)

- "can we add cloud overlays? like transparent fog that rolls over the map? we can use generated effects but maybe
  some isometric cloud models as well, like 5 variations"
- Style: "fantasy toon", "dnd inspired". After the first style round: "it needs to be whispier and toonier still.
  much lighter in concept". "make sure we're generating under a tome project".
- He picked the second round's C (a flowing body edged with spiral curls and trailing flicks) as the style, then
  chose to model three of the five variations (1, 2, 4) rather than redraw the three that copied the reference.

## Concept art (Nano Banana Pro, `gemini-image`, credential `gemini/toejam` shown as "Gemini (shared API key)", `--app dnd`)

Out of git, in `scripts/models/clouds/concept/` (each image has its prompt and cost beside it in `<name>.json`):

| Round | Folder | What | Cost |
|---|---|---|---|
| Style 1 | `style/` | A carved miniature, old-map swirls, inked cel, a storm cloud: too heavy | $0.56 |
| Style 2 | `style2/` | Four wispy flat cartoon clouds; Ben picked `cloud-wisp-c` | $0.56 |
| Variations | `r1/` | Five 3D toon clouds with `cloud-wisp-c` as the reference; 1, 3 and 5 copied its outline | $0.70 |
| Redraws | `r2/` | The bank (3) and the wisp (5) again, the references for colour and line only: the bank came out fully 3D, the wisp still leans on the reference's outline | $0.28 |

`r1/jobs.json` holds the variation prompts. Run again with
`node D:/source/packages/gemini-client/dist/esm/cli/gemini-image.js --jobs <folder>/jobs.json --out <folder> --app dnd --yes`
(without `--yes` it prints the price). A reference makes Nano Banana copy the outline: to vary the shape, say the
reference is for colour and line only, and describe a different silhouette.

## Models (Meshy, `meshy-3d`, key `MESHY_API_KEY`, `--app dnd`)

```
meshy-3d --image r1/cloud-1.jpg --name cloud-1 --image r1/cloud-2.jpg --name cloud-2 --image r1/cloud-4.jpg --name cloud-4 \
  --out public/models/clouds --texture --polycount 4000 --app dnd --usd-per-credit ultra --yes
```

90 credits ($1.13 on Ultra) for 1, 2 and 4, then 60 ($0.75) for 3 and 5 from `r2/` ("do that", Ben, 2026-11-22); 45 to 66 s each, about 4,000 triangles each, 2K base colour texture. Out of git in
`public/models/clouds/` with a `.meta.json` each and the run record `meshy-<stamp>.json`. Vite copies `public/` into
the build, so a deploy from this machine carries them; another machine needs the command run again.

- `cloud-1` and `cloud-2` are relief plaques (about a tenth as deep as wide, as the face-on concept art implies):
  Weather.tsx lays them face up, so they read as storybook clouds from above.
- `cloud-4` is a full 3D tower and `cloud-3` a full 3D bank, long and low with a streaming tail: both ride upright.
- `cloud-5` (the wisp) is another relief plaque, laid face up.

Total: $2.10 concept art, $1.88 models (150 credits).

## Later: the cloud models are switched off

Ben, 2026-11-22, on seeing the five drifting over the table: "this looks terrible lmao. let's flip it off for now and
make a note to work with it later. the generated fog looks good though". `SHOW_CLOUD_MODELS` in Weather.tsx is
false, so they aren't drawn or downloaded; the mist layers and cloud shadows stay on. The models and concept art are
still on disk. Before turning them back on, work out with Ben what was wrong. Likely suspects: the relief plaques
lying flat read as stickers rather than clouds; the textures' baked blue shading and outlines clash with Tome's lit,
textured ground; they're opaque, solid and sharp-edged where the mist is soft; the sizes and heights were never
tuned. A softer approach might fit better: fewer, larger clouds, soft-edged and half see-through, or clouds made
from the same noise as the mist rather than models.
