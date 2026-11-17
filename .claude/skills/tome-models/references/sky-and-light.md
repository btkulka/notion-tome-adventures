# Sky, day/night and how props read under them

Code: src/features/maps/render/sky.ts (pure maths, tested in
`__tests__/sky.test.ts`) and SkyRig.tsx (lights and the painted backdrop).

## How it works

- **Time:** `worldMinutes` from the live session (synced to players). The sun
  is up from `SUNRISE_HOUR` (6) to `SUNSET_HOUR` (20) in travel.ts, the same
  rule fog-of-war sight uses. `hourAngle()` stretches day and night to fit, so
  the sun meets the horizon exactly at those hours.
- **Paths:** `celestial()` rises due east, peaks at `noonHeight` over the
  map's `noon` side (north by default) and sets due west. The moon trails the
  sun by its phase: new rises with the sun, full rises at sunset.
- **Per-map settings** (`MapSettings.sky`, the editor's Sky tab): show the
  sky, noon side, noon height, moon cycle length, a full-moon day.
- **Editor preview** (View menu → Sky): an hour and weather override, saved in
  the browser only.
- **Backdrop:** the camera is orthographic, so every pixel looks the same way
  and a skybox would paint one colour. The backdrop is painted instead: screen
  height is height above the horizon (a third of the way up), screen width is
  bearing around the camera's facing. Turning the view pans it. The sun and
  moon discs sit where the light really comes from.
- **Weather** (`live.weather`): cloud cover, light through cloud, greying.
  Storms add lightning flicker.
- **Time changes sweep:** the DM passing hours animates the sun over about two
  seconds. Weather crossfades over about 1.6 seconds.

## Light rules learned the hard way

- **Light colours are tints, not paint.** Keep hemisphere and sun colours
  light and set the level with intensity. A dark hex like `#3A4466` is about
  8× dimmer in linear light, and it's what made the first night render black.
- **Night is contrast, not darkness.** Night fill stays around 0.6 with a blue
  tint, and moonlight adds more with the phase. The DM must still read the map.
  Never let darkness stand in for missing detail.
- **Low sun keeps its bearing but not its grazing angle:** shading uses at
  least 30° (`SHADE_MIN`). A true 10° sun leaves flat ground at 17% light.
- **The default view is backlit** by the studio sun and the north noon arc.
  Morning sun (east) front-lights the camera-facing sides. If props read flat,
  fix it with per-face value first; moving `STUDIO_SUN` means changing
  build.py's `SUN_FROM` too.
- Light count must never change at runtime (it recompiles every material). The
  campfire point light is always mounted and fades its intensity instead.

## Cost (this machine)

The backdrop is one full-screen shader. It skips stars by day and cloud
lighting where there's no cloud. It isn't drawn at all when the land covers
the screen. Sky state is recomputed only while the clock or weather moves.
Headless Chrome renders all of this on the CPU (SwiftShader), so check it in
Ben's real Chrome.

## Measured reference values (Blender 5.2 sky model, via EL4CTEO time-of-day)

| Sun elevation | Sun colour (sRGB) | Sky ÷ sun on flat ground |
|---|---|---|
| 0° | 1.00 0.39 0.00 | sky only |
| 2° | 1.00 0.60 0.03 | 5.2 |
| 6° (golden) | 1.00 0.77 0.43 | 0.98 |
| 15° | 1.00 0.88 0.68 | 0.34 |
| 30° | 1.00 0.92 0.79 | 0.18 |
| 60° | 1.00 0.94 0.84 | 0.12 |

Brightness targets relative to noon: golden 0.85, sunset 0.7, blue hour 0.35,
night 0.2 (Tome keeps night higher on purpose: it's a play surface, not a
photograph).
