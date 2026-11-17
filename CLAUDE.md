# Tome: notes for Claude

## This machine is small: guard heavy work

Ben's PC is an i7-6700K (4 cores, 8 threads) with 16 GB of RAM and an RTX 3070
(8 GB). The RAM is shared with VS Code, browsers, Tome's dev servers, Benhäus and
often other Claude sessions, so free memory is usually under 2 GB. Stacking heavy
jobs has already forced a reboot (2026-11-11).

- **One heavy job at a time, across all sessions.** Heavy means: Blender builds
  and bakes, ComfyUI/TRELLIS, headless browsers, image or model downloads that
  unpack big archives. Before starting one, check nothing else heavy is running
  (`Get-Process blender, python, chrome`, and the lock files `%TEMP%\tome-*.lock`).
- **Use the guarded launchers, never the raw executables.**
  - Blender: `npm run models` and `npm run models:conform` (scripts/models/run.mjs).
  - TRELLIS: `node scripts/models/trellis/serve.mjs`.

  Both go through scripts/models/heavy.mjs, which takes a cross-session lock,
  refuses to start when memory is too low, caps threads at half the cores and runs
  the job below normal priority. Don't call blender.exe or ComfyUI's main.py
  directly, and don't pass `TOME_FORCE=1` unless Ben says to.
- **Look at the app in Ben's real Chrome** (the Claude in Chrome extension uses the
  GPU). Headless Chrome renders WebGL on the CPU (SwiftShader) and pins every
  core. Use it only when Ben agrees and the extension can't be used, with these
  limits:
  - one browser and one page, at 1280×720;
  - every shot taken in that one page session, not a reload per shot;
  - a hard overall timeout, `browser.close()` in `finally`;
  - check for leftover chrome.exe processes afterwards.
- **Check free memory before anything big.** Under about 2 GB free, tell Ben what
  is using it and ask what to close; don't start anyway.
- **Background tasks:** downloads can run alongside other work, but CPU or GPU jobs
  can't run alongside each other. Stop whatever you started when you're done with it.
- **Iterate small.** `npm run models -- --names <model> --no-ao --sheet out.png`
  builds one model in seconds; the full set with the AO bake takes a few minutes.

## Where things are

- World-map props (Blender, bpy/bmesh), the AO bake, importing image-to-3D models,
  TRELLIS: the `tome-models` skill (.claude/skills/tome-models/SKILL.md).
- The sky, sun, moon and day/night light: src/features/maps/render/sky.ts (the
  maths, unit-tested) and SkyRig.tsx (lights and the painted backdrop).
- Other Claude sessions edit this repo at the same time. Use Edit on files you've
  read; don't rewrite whole files from a stale copy.
