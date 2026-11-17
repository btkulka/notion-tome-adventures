# Concept art prompts for the hi-def miniatures

One image per map prop (all 79 in `MODEL_NAMES`, src/features/maps/render/catalog.ts), made in ChatGPT the way
toejam's mms concept art was (Nov 16 2026). Each image becomes the input to TRELLIS.2 on a rented GPU
(`npm run minis`, scripts/models/minis/rent.mjs), so every prompt keeps the framing TRELLIS wants: one object,
centred, entirely visible, a three-quarter view from slightly above, a plain light grey background, soft even light,
clear material zones, no text. The designs start from what the Blender builders draw (scripts/models/trees.py,
ground.py, settlements.py, landmarks.py) and push them further toward the Tome look: angular, serious, ancient high
fantasy, tarnished rather than shiny, never cute.

Save each image as `scripts/models/minis/concept/<name>.png`, the name in brackets at the start of its prompt.

## How to post them

One prop at a time, in the Benhäus panel chat (Ben's way since Nov 16 2026): Claude gives the shared block with one
prop's prompt, ChatGPT makes four extremely varied options, Ben attaches the one he picks, Claude saves it as the
concept image, models it on the rented GPU and shows the preview, then waits for his go before the next prop.
Complex models first (Ben, Nov 16): cities and castles, towns, villages, landmarks, then trees and ground cover.
The batches below are grouped by kind, not in that order.

---

### The shared block (a fresh ChatGPT chat per prop, so it can't copy its last images)

The first seven props all came back with the same gilt, oxblood banners and grey stone, because the block named one
palette for everything and ChatGPT reuses its own earlier images in a chat. So the block carries only the framing;
each prop brings its own format, palette and twist.

> Make four separate images of the subject below. Each is a single high-fantasy tabletop miniature, sculpted in crisp,
> high detail and painted by a master miniature painter, stylised and toon-leaning (bold, exaggerated, readable shapes,
> chunky hand-sculpted forms, a strong gesture), angular and ancient, never cute or chibi. The four must be extremely
> different from each other: different silhouette, proportions, architecture or growth, age and condition. One object
> per image, centred, entirely visible with nothing cropped, a three-quarter view from slightly above, on a plain light
> grey seamless background, soft even light with no harsh shadows, matte, no glow, no text or letters. No display base
> or plinth (a settlement may stand on a thin, irregular patch of its own ground). Clean silhouette, flat light, clearly
> distinct material zones: these feed an image-to-3D model.

Then the prop's own lines:

- **Format**: portrait 1024 x 1536 for tall props (trees, towers, spires, monoliths), landscape 1536 x 1024 for
  sprawling ones (cities, camps, bones, colonnades), square otherwise.
- **Palette**: its own materials and colours, and what to leave out (most props: no gold, no red banners).
- **Twist**: one fantastical idea that makes it unlike its siblings.
- **The subject**: the prompt from the batches below.

---

### Batch 1: trees (northern and mountain)

1. [fir-1] A tall northern fir of a primeval forest: five distinct drooping tiers of dark blue-green needles, each
   skirt's edge cut into sharp star points, narrowing to a single spear-straight leader. A straight grey-brown trunk
   shows beneath the lowest tier.
2. [fir-2] A northern fir leaning a few degrees, as if pushed by centuries of wind: fewer, wider tiers at the bottom,
   one tier torn ragged, and a twin leader splitting at the very top like a forked spear.
3. [fir-3] A very narrow fir like a dark spire: seven tight, short tiers hugging the trunk, a few silver-grey dead
   twigs at its base and a cluster of black cones near the top.
4. [elderfir-1] An ancient giant fir, a thousand years old: a massive root-buttressed trunk with deep vertical
   fluting, lower limbs snapped into jagged stubs, pale grey-green lichen beards hanging from the branches, dense
   drooping tiers high above, crowned by a lightning-split tip.
5. [snowfir-1] A fir bowed under heavy snow: every drooping tier carries a thick white load along its top with a dark
   green fringe of needles below, the leader bent over under a snow cap, short icicles along the lowest skirt.
6. [snowfir-2] A short, broad fir almost buried in snow: three wide tiers sagging under deep drifts frozen into
   sculpted, wind-carved ridges on one side, a few green needle tips breaking through.
7. [pine-1] A windswept mountain pine like an ink painting: a trunk bent hard sideways by the wind, reddish plated
   bark, holding three flat, layered cloud-shaped crowns of dark needles that all stream in one direction.
8. [pine-2] An ancient cliff pine with a corkscrew trunk that rises, dips and rises again, one long horizontal limb
   reaching out to a single flat needle crown, bare roots gripping a broken stone.
9. [elderoak-1] A vast sacred oak: a hollow, deeply fluted trunk with a tall dark archway opening at its base, heavy
   spreading limbs propped on their own fallen branches, great roots coiling over the ground, spiral knotwork carved
   into the bark, bundles of mistletoe, and a huge canopy of angular, faceted leaf clumps.
10. [oak-1] A great oak of an old kingdom: a short, massively thick, twisted trunk with flared roots, forking into
    heavy limbs that hold clusters of angular, faceted leaf clumps in deep green, a broad dome-shaped crown.
11. [oak-2] A tall oak whose trunk splits into two leaning halves around a hollow, the iron links of an old chain grown
    into its bark, its faceted crown lopsided toward one side.

### Batch 2: trees (warm, wet and dry country)

1. [oak-3] An autumn oak: a gnarled trunk wrapped in thick ivy, its angular leaf clumps in russet, ochre and deep red,
   a few clumps already bare to twisted black twigs.
2. [jungle-1] An emergent jungle giant: a tall, pale, smooth bole rising from huge blade-like buttress fins, bare for
   most of its height, then two layered, flat umbrella canopies with thick lianas hanging from them.
3. [jungle-2] A strangler-fig giant: a lattice of woven roots enclosing the hollow ghost of a dead tree, rising to one
   broad, flat umbrella crown, aerial roots hanging like curtains, a large orange bracket fungus on one side.
4. [palm-1] A coastal palm: a long, gracefully curved, ringed grey trunk leaning seaward, crowned by a burst of
   angular, ridged fronds drooping at the tips, a cluster of dark coconuts under the crown.
5. [palm-2] A primeval tree-fern: a straight, shaggy brown trunk covered in old frond stubs, topped by a wide ring of
   long arching feathered fronds, a tight fiddlehead uncoiling at the centre.
6. [cypress-1] A drowned swamp cypress: a broad flared base like a bell, conical cypress knees rising around it, a tall
   trunk with flat, horizontal shelf crowns hung with long grey curtains of moss.
7. [cypress-2] An ancient swamp cypress whose trunk splits into three leaning stems from one great flared base, each
   with its own flat crown, grey moss curtains between them, the prow of a rotting rowboat wedged among its knees.
8. [snag-1] A dead tree: a bleached, silver-grey trunk with a deep spiral grain, a splintered, jagged top and a few
   broken angular limbs, an empty rusted iron lantern cage hanging from one of them.
9. [snag-2] A dead forked tree: the trunk splits into two bone-white limbs that fork again like antlers, bark peeling
   off in strips, a large abandoned nest of black twigs in the fork.
10. [thorn-1] A savanna thorn tree: a forked dark trunk opening into a wide, perfectly flat, wind-flattened crown like
    a table top, long white thorns along the branches, small dusty olive leaves.
11. [thorn-2] A tall thorn tree with a slender trunk leaning hard to one side, its flat crown in two staggered layers,
    woven weaver-bird nests hanging from the underside.

### Batch 3: undergrowth

1. [shrub-1] A faceted broadleaf bush: a low, rounded mound of angular dark green leaf clusters, a few gnarled twigs
   showing, a scatter of small dark red berries.
2. [shrub-2] A juniper shrub shaped like a dark flame: three tight, upward-licking spires of blue-green scale
   foliage, silver-blue berries, a twisted pale trunk at the base.
3. [shrub-3] A flowering gorse bush: a spiky, angular mound of dark green thorns studded with clusters of bright
   yellow flowers.
4. [scrub-1] A spinifex tussock: hundreds of stiff, sharp, straw-gold blades of dry desert grass fanning out from a
   tight crown, the inner blades greener, a few dry seed heads.
5. [scrub-2] Dead desert brush: crooked pale grey twigs rising from one root and forking again and again, a few
   curled dry leaves, sharp and sparse.
6. [reeds-1] A clump of swamp cattails: tall, straight, sword-like green and ochre leaves and a few dark brown velvet
   cattail heads on stiff stalks, rising from a tight base.
7. [reeds-2] A clump of tall marsh reeds: dense, slender blades bending in different directions, feathery pale plume
   heads, some stems broken and bent at sharp angles.
8. [fern-1] A forest fern: a crown of finely divided green fronds rising and arching outward, one fiddlehead still
   coiled at the centre.
9. [fern-2] A broad jungle undergrowth plant: a few huge, angular, deeply split leaves on long stems, deep green with
   paler veins.

### Batch 4: stone

1. [boulder-1] A single weathered granite boulder: a big angular block with flat cleaved faces, grey with patches of
   pale lichen, sunk a little into the ground.
2. [boulder-2] A granite boulder split clean in two by frost, the halves leaning apart with a pale fresh fracture face
   between them and a tuft of grass growing in the crack.
3. [boulder-3] A cluster of three angular granite boulders of different sizes huddled together, the largest
   flat-topped, lichen and moss on their shaded sides.
4. [mossrock-1] A mossy forest rock: an angular stone thickly blanketed on top with a deep green moss mat that drips
   over its edges, small ferns and a few pale mushrooms at its foot.
5. [mossrock-2] A long, flat stone slab lying tilted like a fallen standing stone, its top carpeted in moss, a few
   small stones beside it.
6. [crag-1] A mountain crag: one tall, tilted rock blade rising to a broken, slanted summit, split down one side,
   sharp faceted grey stone with pale fresh fractures.
7. [crag-2] A mountain crag of two leaning rock blades, one tall and one shorter, splaying apart from a shared foot,
   jagged summits, scree at the base.
8. [crag-3] A crag of four sharp rock blades clustered like broken teeth, the tallest in the middle, snow lodged in the
   clefts.
9. [hoodoo-1] A desert hoodoo: a tall eroded sandstone spire with a wide foot, stacked uneven blocks alternating narrow
   necks and bulges, banded red, ochre and cream, topped by a flat, overhanging dark caprock.
10. [hoodoo-2] Twin desert hoodoos of banded red sandstone side by side, one tall and slender, one short and stout,
    each balancing its own dark caprock.
11. [searock-1] A sea rock: a cluster of dark hexagonal basalt columns of different heights with slanted tops,
    barnacles and dark green weed around the base.
12. [searock-2] A tall sea stack: one tower of stacked hexagonal basalt joints, each shifted and turned a little,
    seabird nests on its top ledge, barnacles at its foot.
13. [icerock-1] A broken slab of glacial ice: a jagged opaque shard of pale blue-white ice rising from a flattened foot
    to a ragged two-pointed top, deep blue in its cracks.
14. [icerock-2] A low frozen mound: a rounded heap of hard-packed snow and ice with a few jagged blue ice blades
    breaking through its crust.

### Batch 5: settlements (temperate and north)

1. [village-temperate] A small human village: five or six stone-and-timber cottages with steep slate and thatch roofs
   and jettied upper storeys, a small stone chapel with a broach spire, a well and a few garden trees around a
   crossroads.
2. [town-temperate] A walled market town: a ring of grey stone curtain wall with a twin-towered gatehouse at the
   front; inside, tightly packed tall timber-framed houses with steep roofs and a church with a tall spire; oxblood
   banners on the towers.
3. [city-temperate] A great capital city: tall grey limestone walls with many round towers and a gatehouse at the
   front, rows of tall steep-roofed houses inside, and towering over them a cruciform cathedral with twin spires,
   flying buttresses and a crossing spire.
4. [castle-temperate] A stone castle: a square curtain wall with round corner towers and a twin-towered gatehouse in
   front; inside, a tall square keep with corner turrets and a hipped slate roof; oxblood banners with gilt tips.
5. [village-north] A Norse village in snow: three long turf-roofed longhouses with crossed horn-shaped bargeboards at
   the gables, a small storehouse raised on stone feet, a timber watchtower on splayed legs, a sharpened-log
   palisade, snow on the roofs, a few small firs.
6. [town-north] A Norse timber town: a palisade of sharpened logs with a gate tower; inside, a great mead hall with a
   steep shingled roof and carved dragon-head gable ends, longhouses around it, snow on every roof.
7. [city-north] A dwarf-hold built into a mountainside: three battered dark-granite terraces climbing to a massive
   great hall with a steep stone roof, square towers with overhanging fighting tops, and a colossal carved gate at the
   front under a gilt band of abstract runes.
8. [castle-north] A dwarven fortress: thick sloping granite walls with heavy buttresses and angular bastion corners, a
   deep carved gate between two battered towers, and a stepped keep at the centre with gilt-trimmed edges.

### Batch 6: settlements (desert and marsh)

1. [village-desert] A desert village: a cluster of flat-roofed adobe houses with parapets, some with small domes or
   rooftop rooms, a well beside a date palm, a striped cloth awning, all in sand and ochre.
2. [town-desert] A desert town: sandstone walls with a tall pointed-arch gate between slim towers; inside, flat-roofed
   houses and a domed prayer hall with an arcaded front and one slender minaret with a gilt cap.
3. [city-desert] A great desert city: high sandstone walls and a gate, packed flat-roofed houses, and at the centre a
   palace on a raised platform with a great gilt onion dome on a drum, four lesser domes and four slender minarets.
4. [castle-desert] A desert kasbah: four tall battered adobe towers crowned with stepped merlons and incised lozenge
   patterns, thick earthen walls between them, a tower-house rising over the courtyard.
5. [village-marsh] A marsh village: thatched plank huts on tall stilts over dark still water, steep thatch roofs,
   rickety boardwalks between them, reeds around the pools.
6. [town-marsh] A raised marsh town: an octagonal timber deck on piles over dark water, ringed by a stockade, carrying
   large thatched halls, a long boardwalk leading in.
7. [city-marsh] A jungle temple-city of stone: a mossy stone curtain wall, a raised causeway between dark pools leading
   to a tall stepped ziggurat with a shrine on top, thatched stone houses, vines draping everything.
8. [castle-marsh] A swamp fort: a mossy stone keep on a raised mound ringed by a dark moat, a timber palisade around the
   crown, a wooden bridge and ramp, creepers on the walls.

### Batch 7: landmarks (ancient)

1. [stones-1] A stone circle: a ring of tall weathered standing stones, some leaning, two joined by a lintel,
   lichen-spotted grey granite, a flat altar stone in the middle.
2. [stones-2] A dolmen: three massive upright stones holding a huge flat capstone over a dark chamber, moss on the
   capstone, a few fallen stones beside it.
3. [monolith-1] A towering monolith: a tall, slightly tapering black basalt obelisk with chamfered edges, deep carved
   geometric bands, weathered and cracked, a ring of small stones around its foot.
4. [ruin-colonnade] Ruins of an old empire: a row of fluted white marble columns on square plinths, some whole with
   ornate capitals carrying a broken stretch of entablature, others snapped at different heights, fallen drums lying
   in the grass.
5. [ruin-arch] A colossal ruined triumphal arch half-buried in desert sand: one great round-headed arch of weathered
   sandstone, its top broken, its carved reliefs worn smooth, a fallen block at its foot.
6. [ruin-head] The colossal fallen stone head of a forgotten king, lying on its side half-sunk in desert sand: a stern
   bearded face, a broken crown, a crack across the cheek, sand drifted against it.
7. [ruin-tower] A broken round watchtower: a hollow stone tower whose wall rises tall on one side and has crumbled
   away on the other in a jagged rim, an empty window, ivy, fallen blocks around its foot.
8. [dwarfgate-1] A dwarven mountain gate: a huge doorway cut into a sheer rock face, flanked by two colossal stern dwarf
   guardian statues holding axes, a stepped angular lintel with a gilt band of abstract runes, heavy bronze-studded
   doors ajar onto darkness.
9. [bones-1] Dragon bones: the colossal skeleton of a long-dead dragon half-buried in sand, a great horned skull, a
   curving spine, an arching ribcage, bleached bone with ochre staining.

### Batch 8: landmarks (places on the road)

1. [elfspire-1] Elven spires in a forest: three impossibly slender, tapering towers of white stone and silver of
   different heights, curving like growing shoots, with leaf-shaped balconies and pointed windows, joined by one thin
   arched bridge, trees around their roots.
2. [waystone-1] A roadside waystone: a short, squat, chamfered stone pillar with a pointed top, a carved spiral sigil,
   an iron ring set in its side, a small cairn of offering stones at its foot.
3. [shrine-1] A wayside shrine: a small stone shrine with a pitched slate roof over a niche holding a hooded statue,
   a stone basin in front, wildflowers at its base.
4. [dungeon-1] A dungeon entrance: a stepped stone portal set into a grassy hillock, a dark stairway leading down, a
   rusted iron portcullis half raised, a skull-carved keystone, two cracked braziers either side.
5. [cave-1] A cave mouth: a jagged dark opening in a craggy grey rock outcrop, fang-like rock teeth hanging over it,
   scattered bones and boulders at the entrance.
6. [wizardtower-1] A wizard's tower: a tall, slender stone tower that twists slightly as it rises, jutting oriel
   windows, a balcony with a brass telescope, a tall pointed slate roof with a gilt astrolabe finial, geometric
   patterns carved around its base.
7. [camp-1] An adventurers' camp: two canvas A-frame tents and a round pavilion tent, a ring-of-stones campfire with a
   cooking pot on a tripod, bedrolls, crates and a weapon rack.
8. [temple-1] A jungle temple: a stepped stone pyramid overgrown with roots and vines, a steep central stair up to a
   shrine with a serpent-mouthed doorway, great stone serpent heads at the foot of the stair.
9. [banner-1] A heraldic war banner: a tall iron pole with a gilt spear tip, a long swallowtail banner of oxblood red
   with a gilt border and an abstract device, flying out to one side, its foot planted among a few stones.

---

## After the images

1. Put them in scripts/models/minis/concept/ as `<name>.png`.
2. `npm run minis` lists what's missing and prices the rental (spends nothing); `npm run minis -- --yes` rents the
   GPU, models every prop that has art, and terminates the pod. The GLBs land in scripts/models/minis/out/.
3. A prop that comes out wrong: fix its prompt here, remake the image, delete its GLB and run again (or
   `--names <prop> --redo`).
