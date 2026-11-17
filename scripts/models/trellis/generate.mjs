/**
 * Image (or text) → 3D model → conformed Tome prop, through the local
 * TRELLIS.2 ComfyUI. Start the server first: node scripts/models/trellis/serve.mjs
 *
 *   node scripts/models/trellis/generate.mjs --image ref.png --name ruin-keep [conform args…]
 *   node scripts/models/trellis/generate.mjs --prompt "a ruined dwarven watchtower" --name ruin-dwarfwatch --height 1.1
 *
 * --quality high uses TRELLIS's full 1536 cascade, a finer remesh and SDXL
 * base concepts at 1024 px (slower; needs the RAM the launcher asks for).
 * --prompt first draws a concept image with SDXL (the main ComfyUI's
 * checkpoint, shared through extra_model_paths.yaml), then models it.
 * Anything this script doesn't know (--height, --budget, --palette, --yaw, …)
 * is passed on to conform.py. --no-conform stops after the raw GLB.
 *
 * The TRELLIS workflow is ComfyUI's own template
 * (3d_pixal3d_trellis2_image_to_model), converted to an API prompt with the
 * server's node definitions. Its switches are resolved to the TRELLIS.2 branch
 * (Pixal3D's models aren't installed). The output is its vertex-painted mesh,
 * which skips UV unwrapping and four texture bakes: conform.py only needs a
 * colour per face. Settings are sized for an 8 GB card.
 *
 * Raw outputs land in scripts/models/trellis/out/ (git-ignored).
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');
const URL = process.env.COMFY3D_URL ?? 'http://127.0.0.1:8190';
const COMFY = process.env.COMFY3D_DIR ?? 'D:/tools/comfyui-3d';
const TEMPLATE = '3d_pixal3d_trellis2_image_to_model';
const OUT = path.join(here, 'out');
/**
 * Concept-image models, from the main ComfyUI's checkpoints. Turbo is the
 * default: it's intact on this machine (sd_xl_base_1.0 there is a truncated
 * download, 4.5 of 6.9 GB) and four steps at 512 px is plenty for TRELLIS.
 */
const CONCEPT = {
  turbo: { file: 'sd_xl_turbo_1.0.safetensors', size: 512, steps: 4, cfg: 1.0, sampler: 'euler_ancestral', scheduler: 'normal' },
  base: { file: 'sd_xl_base_1.0.safetensors', size: 1024, steps: 28, cfg: 6.5, sampler: 'dpmpp_2m', scheduler: 'karras' },
};

// -- arguments ----------------------------------------------------------------

const argv = process.argv.slice(2);
const opts = { conformArgs: [] };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === '--image') opts.image = next();
  else if (a === '--prompt') opts.prompt = next();
  else if (a === '--name') opts.name = next();
  else if (a === '--seed') opts.seed = Number(next());
  else if (a === '--resolution') opts.resolution = Number(next());
  else if (a === '--no-conform') opts.noConform = true;
  else if (a === '--concept') opts.concept = next();
  else if (a === '--quality') opts.quality = next();
  else opts.conformArgs.push(a);
}
if (!opts.name || !/^[a-z0-9]+(-[a-z0-9]+)+$/.test(opts.name) || (!opts.image && !opts.prompt)) {
  console.error('Usage: generate.mjs (--image file | --prompt "subject") --name group-variant [--quality high] [--seed n] [--resolution 1024] [--concept turbo|base] [--no-conform] [conform args]');
  process.exit(2);
}
const seed = Number.isFinite(opts.seed) ? opts.seed : crypto.randomInt(1, 2 ** 31);

// -- ComfyUI API ----------------------------------------------------------------

async function api(route, init) {
  const res = await fetch(URL + route, init);
  if (!res.ok) throw new Error(`${route}: ${res.status} ${await res.text()}`);
  return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
}

async function upload(file) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(file)]), `${opts.name}-${path.basename(file)}`);
  form.append('overwrite', 'true');
  return (await api('/upload/image', { method: 'POST', body: form })).name;
}

/** Queue a prompt and wait for it, printing progress now and then. Returns its history entry. */
async function run(prompt, label) {
  const client = crypto.randomUUID();
  const queued = await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, client_id: client }) });
  if (queued.node_errors && Object.keys(queued.node_errors).length) throw new Error(`${label}: ${JSON.stringify(queued.node_errors).slice(0, 2000)}`);
  const started = Date.now();
  let last = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const hist = (await api(`/history/${queued.prompt_id}`))[queued.prompt_id];
    if (hist?.status?.completed) return hist;
    if (hist?.status?.status_str === 'error') {
      const err = hist.status.messages?.find((m) => m[0] === 'execution_error')?.[1];
      throw new Error(`${label} failed in ${err?.node_type ?? '?'}: ${err?.exception_message ?? JSON.stringify(hist.status).slice(0, 800)}`);
    }
    const secs = Math.round((Date.now() - started) / 1000);
    if (secs - last >= 30) {
      console.log(`  ${label}… ${secs}s`);
      last = secs;
    }
  }
}

// -- UI workflow → API prompt ---------------------------------------------------

const namesOf = (group) => [...Object.keys(group?.required ?? {}), ...Object.keys(group?.optional ?? {})];

/**
 * A template node's widgets_values, in the front end's widget order, mapped
 * onto the server's input names. A widget is any input the template doesn't
 * show as a plain socket. A seed's 'fixed'/'randomize' companion is skipped,
 * and a dynamic combo (COMFY_DYNAMICCOMBO_V3) is followed by its chosen
 * option's own widgets, which the server names '<combo>.<input>'.
 */
function widgetInputs(node, def) {
  const sockets = new Map((node.inputs ?? []).map((i) => [i.name, i]));
  const order = def.input_order ?? { required: Object.keys(def.input?.required ?? {}), optional: Object.keys(def.input?.optional ?? {}) };
  const specs = { ...def.input?.required, ...def.input?.optional };
  const values = Array.isArray(node.widgets_values) ? [...node.widgets_values] : [];
  const inputs = {};
  const take = (name, spec) => {
    if (!values.length) return;
    inputs[name] = values.shift();
    if (spec?.[1]?.control_after_generate) values.shift();
    if (spec?.[0] === 'COMFY_DYNAMICCOMBO_V3') {
      const option = spec[1].options.find((o) => o.key === inputs[name]);
      const subSpecs = { ...option?.inputs?.required, ...option?.inputs?.optional };
      for (const sub of namesOf(option?.inputs)) take(`${name}.${sub}`, subSpecs[sub]);
    }
  };
  for (const name of [...(order.required ?? []), ...(order.optional ?? [])]) {
    const socket = sockets.get(name);
    if (socket && !socket.widget) continue; // a wire-only input
    take(name, specs[name]);
  }
  return inputs;
}

function toApi(workflow, info) {
  const links = new Map(workflow.links.map((l) => [l[0], l]));
  const prompt = {};
  for (const node of workflow.nodes) {
    const def = info[node.type];
    if (!def) continue; // notes and other front-end-only nodes
    const inputs = widgetInputs(node, def);
    for (const input of node.inputs ?? []) {
      if (input.link == null) continue;
      const l = links.get(input.link);
      inputs[input.name] = [String(l[1]), l[2]];
    }
    prompt[String(node.id)] = { class_type: node.type, inputs };
  }
  return prompt;
}

/** Replace each ComfySwitchNode with the branch its switch selects. */
function resolveSwitches(prompt) {
  const valueOf = (v) => (Array.isArray(v) ? prompt[v[0]]?.inputs?.value : v);
  for (const [id, node] of Object.entries(prompt)) {
    if (node.class_type !== 'ComfySwitchNode') continue;
    const chosen = valueOf(node.inputs.switch) ? node.inputs.on_true : node.inputs.on_false;
    delete prompt[id];
    for (const other of Object.values(prompt)) {
      for (const [k, v] of Object.entries(other.inputs)) if (Array.isArray(v) && v[0] === id) other.inputs[k] = chosen;
    }
  }
}

/** Keep only `outputId` and what it depends on. */
function prune(prompt, outputId) {
  const keep = new Set();
  const visit = (id) => {
    if (keep.has(id) || !prompt[id]) return;
    keep.add(id);
    for (const v of Object.values(prompt[id].inputs)) if (Array.isArray(v)) visit(v[0]);
  };
  visit(outputId);
  for (const id of Object.keys(prompt)) if (!keep.has(id)) delete prompt[id];
}

const ofType = (prompt, type) => Object.entries(prompt).filter(([, n]) => n.class_type === type);

async function loadTemplate() {
  try {
    return await api(`/templates/${TEMPLATE}.json`);
  } catch {
    const res = await fetch(`https://raw.githubusercontent.com/Comfy-Org/workflow_templates/main/templates/${TEMPLATE}.json`);
    if (!res.ok) throw new Error(`No ${TEMPLATE} template from the server or GitHub`);
    return res.json();
  }
}

async function trellisPrompt(imageName, info) {
  const prompt = toApi(await loadTemplate(), info);
  // TRELLIS.2, not Pixal3D.
  for (const [, n] of ofType(prompt, 'PrimitiveBoolean')) n.inputs.value = true;
  resolveSwitches(prompt);
  for (const [, n] of ofType(prompt, 'LoadImage')) n.inputs.image = imageName;
  for (const [, n] of ofType(prompt, 'KSampler')) n.inputs.seed = seed;
  // 8 GB card: a 1024 cascade instead of 1536, a lighter remesh, fewer faces out.
  // --quality high: TRELLIS's full 1536 cascade and the template's 768 remesh (slower, heavier on 8 GB).
  const high = opts.quality === 'high';
  for (const [, n] of ofType(prompt, 'Trellis2UpsampleStage')) n.inputs.target_resolution = opts.resolution ?? (high ? 1536 : 1024);
  for (const [, n] of ofType(prompt, 'RemeshMesh')) if (typeof n.inputs.resolution === 'number') n.inputs.resolution = Math.min(n.inputs.resolution, high ? 768 : 512);
  for (const [, n] of ofType(prompt, 'DecimateMesh')) for (const k of Object.keys(n.inputs)) if (typeof n.inputs[k] === 'number' && n.inputs[k] > 250000) n.inputs[k] = 250000;
  // Save the vertex-painted mesh (PaintMesh) with the plain SaveGLB node. The
  // template's Save3DAdvanced needs viewer state only the browser supplies, and
  // its UV-textured branch is work conform.py doesn't need.
  const [[paintId]] = ofType(prompt, 'PaintMesh');
  prompt.tome_save = { class_type: 'SaveGLB', inputs: { mesh: [paintId, 0], filename_prefix: `3d/tome/${opts.name}` } };
  prune(prompt, 'tome_save');
  return prompt;
}

/** A checkpoint's name as this server lists it (subfolder separators differ by OS). */
function checkpointName(info, file) {
  const names = info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
  const hit = names.find((n) => n.replaceAll('\\', '/').endsWith(file));
  if (!hit) throw new Error(`No ${file} among the server's checkpoints; check extra_model_paths.yaml`);
  return hit;
}

function conceptPrompt(subject, ckpt, m) {
  const positive = `${subject}, single object, centered, entire object visible, three-quarter view from slightly above, plain light grey background, soft even lighting, clear distinct material zones, angular serious high fantasy, weathered, game asset concept art, no text`;
  const negative = 'cropped, cut off, multiple objects, scenery, busy background, ground plane, harsh shadows, text, watermark, logo, cute, cartoon, chibi, blurry';
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    2: { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    4: { class_type: 'EmptyLatentImage', inputs: { width: m.size, height: m.size, batch_size: 1 } },
    5: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed, steps: m.steps, cfg: m.cfg, sampler_name: m.sampler, scheduler: m.scheduler, denoise: 1 } },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: `tome/${opts.name}-concept` } },
  };
}

/** The newest file in ComfyUI's output folder whose path contains `stem`. */
function newestOutput(stem, exts) {
  const root = path.join(COMFY, 'output');
  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.replaceAll('\\', '/').includes(stem) && exts.some((x) => p.toLowerCase().endsWith(x))) found.push([fs.statSync(p).mtimeMs, p]);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return found.sort((a, b) => b[0] - a[0])[0]?.[1];
}

// -- main -------------------------------------------------------------------------

try {
  await api('/system_stats');
} catch {
  console.error(`No 3D ComfyUI at ${URL}. Start it with: node scripts/models/trellis/serve.mjs`);
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const info = await api('/object_info');
if (!info.Trellis2ShapeStage) {
  console.error('This ComfyUI has no TRELLIS.2 nodes; update it (0.45+).');
  process.exit(1);
}

let image = opts.image && path.resolve(opts.image);
if (!image) {
  const m = CONCEPT[opts.concept ?? (opts.quality === 'high' ? 'base' : 'turbo')];
  if (!m) throw new Error(`--concept must be one of ${Object.keys(CONCEPT).join(', ')}`);
  console.log(`Drawing a concept image (${m.file}, seed ${seed})…`);
  const t = Date.now();
  await run(conceptPrompt(opts.prompt, checkpointName(info, m.file), m), 'concept');
  image = newestOutput(`tome/${opts.name}-concept`, ['.png']);
  if (!image) throw new Error('SDXL finished but its image is missing');
  fs.copyFileSync(image, path.join(OUT, `${opts.name}-concept.png`));
  image = path.join(OUT, `${opts.name}-concept.png`);
  console.log(`  ${path.relative(ROOT, image)} (${Math.round((Date.now() - t) / 1000)}s)`);
}

console.log(`Modelling ${path.basename(image)} with TRELLIS.2 (seed ${seed})…`);
const t = Date.now();
const prompt = await trellisPrompt(await upload(image), info);
fs.writeFileSync(path.join(OUT, `${opts.name}-prompt.json`), JSON.stringify(prompt, null, 1));
await run(prompt, 'trellis');
const glbSrc = newestOutput(`3d/tome/${opts.name}`, ['.glb']);
if (!glbSrc) throw new Error('TRELLIS finished but no GLB was saved');
const glb = path.join(OUT, `${opts.name}.glb`);
fs.copyFileSync(glbSrc, glb);
console.log(`  ${path.relative(ROOT, glb)} (${(fs.statSync(glb).size / 1e6).toFixed(1)} MB, ${Math.round((Date.now() - t) / 1000)}s)`);
fs.writeFileSync(path.join(OUT, `${opts.name}.meta.json`), JSON.stringify({ name: opts.name, seed, image: path.basename(image), prompt: opts.prompt ?? null, resolution: opts.resolution ?? (opts.quality === 'high' ? 1536 : 1024), quality: opts.quality ?? 'standard', made: new Date().toISOString() }, null, 1));

if (opts.noConform) process.exit(0);
console.log('Conforming…');
const conform = spawnSync(process.execPath, [path.join(here, '..', 'run.mjs'), 'conform', glb, '--name', opts.name, ...opts.conformArgs], { stdio: 'inherit' });
process.exit(conform.status ?? 1);
