/**
 * Hi-def miniatures of the map props: each prop's concept image through
 * TRELLIS.2 on a GPU rented by the minute on RunPod (@btkulka/trellis-client's
 * rent, on @btkulka/runpod-client), to a high-resolution, UV-textured GLB.
 * Nothing heavy runs on this PC but the preview render (Blender, guarded).
 *
 * One at a time, so Ben sees each model before the next:
 *   npm run minis                       # what's left and the price; rents nothing
 *   npm run minis -- --up --yes         # rents one GPU and leaves it up (about 10 min to set up)
 *   npm run minis -- --next             # the next prop with art and no model yet, on that GPU, then its preview
 *   npm run minis -- --names fir-1      # that prop (--redo to make it again)
 *   npm run minis -- --down             # terminates the GPU
 * All at once, with no GPU up:
 *   npm run minis -- --yes              # rents, models every prop with art and no model yet, terminates
 *
 * Concept images: scripts/models/minis/concept/<prop>.png (.jpg, .jpeg, .webp),
 * one per name in MODEL_NAMES (src/features/maps/render/catalog.ts); the
 * prompts are in docs/MINI_PROMPTS.md. Models: scripts/models/minis/out/
 * <prop>.glb (vertex-painted), <prop>-textured.glb (UV-textured, 4096 PBR maps)
 * and <prop>-preview.png (git-ignored).
 *
 * --model trellis2|pixal3d (default trellis2), --quality standard|high (high),
 * --no-textured, --max-faces N (500000), --min-memory GB (48),
 * --max-price $/h (1.5), --minutes N (--up: 180; a batch: 15 + 5 a model),
 * --budget $ (15), --no-preview.
 *
 * Every pod ends at its deadline at the latest: a detached watchdog here and
 * the pod's own timer. `npx btkulka-runpod pods` shows what's running;
 * `npx btkulka-runpod sweep` ends strays. The key: Benhäus › Settings ›
 * Credentials › runpod/shared, RUNPOD_API_KEY, or ~/.runpod/config.toml.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  BOOT_CMD,
  COMFY_REV,
  RENT_IMAGE,
  RENT_PORT,
  RENT_TORCH,
  bootScript,
  generate,
  rentAndGenerate,
  rentPlan,
} from '@btkulka/trellis-client';
import { createRunPodClient, loadRunPodKey, rent, waitForPodHttp } from '@btkulka/runpod-client';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../../..');
const CONCEPT = path.join(here, 'concept');
const OUT = path.join(here, 'out');
const EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
/** The GPU left up by --up: its pod, address, per-rental token and deadline. */
const SESSION = path.join(os.tmpdir(), 'tome-minis-pod.json');

const { values } = parseArgs({
  options: {
    yes: { type: 'boolean' },
    up: { type: 'boolean' },
    next: { type: 'boolean' },
    down: { type: 'boolean' },
    names: { type: 'string' },
    redo: { type: 'boolean' },
    model: { type: 'string', default: 'trellis2' },
    quality: { type: 'string', default: 'high' },
    'no-textured': { type: 'boolean' },
    'no-preview': { type: 'boolean' },
    'max-faces': { type: 'string', default: '500000' },
    'min-memory': { type: 'string', default: '48' },
    'max-price': { type: 'string', default: '1.5' },
    minutes: { type: 'string' },
    budget: { type: 'string', default: '15' },
  },
});

/** The prop names, read from the catalog so the two never disagree. */
function modelNames() {
  const src = fs.readFileSync(path.join(ROOT, 'src/features/maps/render/catalog.ts'), 'utf8');
  const list = src.match(/MODEL_NAMES = \[([\s\S]*?)\] as const/)?.[1];
  if (!list) throw new Error('No MODEL_NAMES in src/features/maps/render/catalog.ts');
  return [...list.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

const rel = (p) => path.relative(ROOT, p).replaceAll('\\', '/');
const imageOf = (name) => EXTS.map((x) => path.join(CONCEPT, name + x)).find((p) => fs.existsSync(p));
const done = (name) => fs.existsSync(path.join(OUT, `${name}.glb`));

function readSession() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
    return s.deadline > Date.now() ? s : null;
  } catch {
    return null;
  }
}

async function sessionUp(s) {
  try {
    const res = await fetch(`${s.url}/system_stats`, { headers: { Authorization: `Bearer ${s.token}` }, signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function apiKeyOrExit() {
  const key = await loadRunPodKey({ app: 'tome' });
  if (key) return key;
  console.error('No RunPod key: add it in Benhäus › Settings › Credentials as runpod/shared, or set RUNPOD_API_KEY.');
  process.exit(1);
}

/** Ends the watchdog a rental left running for this pod (its command line carries the pod id). */
function killWatchdog(podId) {
  if (process.platform !== 'win32') return;
  spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*${podId}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`], { stdio: 'ignore' });
}

const model = values.model === 'pixal3d' ? 'pixal3d' : 'trellis2';
const jobSettings = {
  quality: values.quality === 'standard' ? 'standard' : 'high',
  model,
  textured: !values['no-textured'],
  maxFaces: Number(values['max-faces']),
};
const planOpts = (apiKey, jobs, maxMinutes) => ({
  apiKey,
  jobs,
  outDir: OUT,
  minMemoryGb: Number(values['min-memory']),
  maxPricePerHour: Number(values['max-price']),
  maxMinutes,
  budgetUsd: Number(values.budget),
  onLog: (line) => console.log(line),
});

function printPlan(plan) {
  for (const c of plan.candidates.slice(0, 6)) console.log(`  $${c.pricePerHour.toFixed(2)}/h  ${c.memory} GB  ${c.cloud.toLowerCase()}  ${c.name}`);
  if (!plan.ok) {
    console.error(`Not renting: ${plan.reason}`);
    process.exit(1);
  }
}

// -- --down ---------------------------------------------------------------------

if (values.down) {
  let s;
  try {
    s = JSON.parse(fs.readFileSync(SESSION, 'utf8'));
  } catch {
    console.log('No minis GPU is up.');
    process.exit(0);
  }
  const client = createRunPodClient({ apiKey: await apiKeyOrExit() });
  await client.terminate(s.podId).catch((e) => console.log(`RunPod: ${e.message}`));
  killWatchdog(s.podId);
  fs.rmSync(SESSION, { force: true });
  const mins = Math.round((Date.now() - s.startedAt) / 60_000);
  console.log(`Terminated ${s.podId} (${s.gpu}) after ${mins} min, about $${((mins / 60) * s.rate).toFixed(2)}.`);
  process.exit(0);
}

// -- --up -------------------------------------------------------------------------

if (values.up) {
  const live = readSession();
  if (live && (await sessionUp(live))) {
    console.log(`A minis GPU is already up: ${live.gpu}, until ${new Date(live.deadline).toLocaleTimeString()}.`);
    process.exit(0);
  }
  const apiKey = await apiKeyOrExit();
  const client = createRunPodClient({ apiKey });
  const minutes = Number(values.minutes ?? 180);
  const plan = await rentPlan({ ...planOpts(apiKey, [], minutes), client });
  printPlan(plan);
  console.log(`One GPU for up to ${minutes} min: $${plan.minCostUsd.toFixed(2)} on the cheapest card, $${plan.maxCostUsd.toFixed(2)} at worst, billed by the second until --down.`);
  if (!values.yes) {
    console.log('Nothing rented. Run again with --yes to rent.');
    process.exit(0);
  }
  const token = crypto.randomBytes(24).toString('base64url');
  const rental = await rent(client, {
    name: 'tome-minis',
    plan,
    apiKey,
    image: RENT_IMAGE,
    disk: 60,
    ports: [`${RENT_PORT}/http`],
    minCudaVersion: RENT_TORCH.minCuda,
    entrypoint: ['bash', '-c'],
    cmd: [BOOT_CMD],
    env: { BOOT_B64: Buffer.from(bootScript()).toString('base64'), RENT_TOKEN: token, RENT_DEADLINE_S: String(minutes * 60), COMFY_REV },
    onLog: (line) => console.log(line),
  });
  const url = rental.url(RENT_PORT);
  const headers = { Authorization: `Bearer ${token}` };
  console.log(`Pod ${rental.id} on ${rental.candidate.name} at $${rental.candidate.pricePerHour.toFixed(2)}/h; setting up…`);
  let seen = '';
  let failed = '';
  const ready = await waitForPodHttp(`${url}/system_stats`, {
    headers,
    // Setup took 13 min for the requirements alone on one A40 host (Nov 16), so allow a slow host.
    timeoutMs: 45 * 60_000,
    onWait: async (secs) => {
      const text = await client.logs(rental.id, { tail: 40 }).catch(() => '');
      const steps = text.split(/\r?\n/).filter((l) => l.includes('[rent]'));
      const last = steps.at(-1) ?? '';
      if (last && last !== seen) {
        seen = last;
        console.log(`  ${Math.round(secs / 60)} min: ${last.replace(/^.*\[rent\]\s*/, '')}`);
      }
      const f = steps.find((l) => l.includes('FAILED'));
      if (f) throw new Error(`setup failed on the pod: ${f.replace(/^.*FAILED:\s*/, '')}`);
      // No boot step yet: a pull error in the system log, or nothing after 15 min, means the container never started.
      const pull = text.split(/\r?\n/).find((l) => /error creating container|failed to pull|pull access denied|ErrImagePull/i.test(l));
      if (!seen && (pull || secs >= 15 * 60)) throw new Error(`the pod's container never started${pull ? `: ${pull.trim()}` : ` in ${Math.round(secs / 60)} min`}; run --up again for another host`);
    },
  }).catch((e) => {
    failed = e.message;
    return false;
  });
  if (!ready) {
    await rental.terminate();
    console.error(`The GPU didn't come up (${failed || 'timed out'}); terminated, about $${rental.spentUsd().toFixed(2)}.`);
    process.exit(1);
  }
  fs.writeFileSync(SESSION, JSON.stringify({ podId: rental.id, gpu: rental.candidate.name, rate: rental.candidate.pricePerHour, url, token, startedAt: rental.startedAt, deadline: rental.deadline }));
  console.log(`Up after ${Math.round((Date.now() - rental.startedAt) / 60_000)} min: ${rental.candidate.name}, until ${new Date(rental.deadline).toLocaleTimeString()} at the latest. --next models a prop; --down ends it.`);
  // The pod outlives this process; its watchdog ends it at the deadline if --down never comes.
  process.exit(0);
}

// -- which props --------------------------------------------------------------------

const all = modelNames();
const wanted = values.names ? values.names.split(',').map((s) => s.trim()).filter(Boolean) : [...all];
const unknown = wanted.filter((n) => !all.includes(n));
if (unknown.length) {
  console.error(`Not props: ${unknown.join(', ')}`);
  process.exit(2);
}
/** Complex models first (Ben, Nov 16): cities and castles, towns, villages, landmarks, then trees and ground cover. */
const rank = (n) => {
  const i = ['city-', 'castle-', 'town-', 'village-'].findIndex((p) => n.startsWith(p));
  if (i >= 0) return i;
  return all.indexOf(n) >= all.indexOf('stones-1') ? 4 : all.indexOf(n) < all.indexOf('shrub-1') ? 5 : 6;
};
wanted.sort((a, b) => rank(a) - rank(b) || all.indexOf(a) - all.indexOf(b));
const noArt = wanted.filter((n) => !imageOf(n));
const skipped = values.redo ? [] : wanted.filter((n) => imageOf(n) && done(n));
let todo = wanted.filter((n) => imageOf(n) && !skipped.includes(n));
if (values.next) todo = todo.slice(0, 1);

console.log(`${wanted.length} props: ${todo.length} to model, ${skipped.length} already modelled, ${noArt.length} without concept art.`);
if (noArt.length && !values.next) console.log(`  No art yet (${rel(CONCEPT)}/<prop>.png): ${noArt.join(', ')}`);
if (!todo.length) process.exit(0);

function preview(name) {
  if (values['no-preview']) return null;
  const textured = path.join(OUT, `${name}-textured.glb`);
  const glb = fs.existsSync(textured) ? textured : path.join(OUT, `${name}.glb`);
  const png = path.join(OUT, `${name}-preview.png`);
  const r = spawnSync(process.execPath, [path.join(here, '..', 'run.mjs'), 'script', path.join(here, 'preview.py'), glb, png], { stdio: 'inherit' });
  return r.status === 0 && fs.existsSync(png) ? png : null;
}

// -- on the GPU left up by --up -------------------------------------------------------

const session = readSession();
if (session) {
  if (!(await sessionUp(session))) {
    console.error(`The minis GPU (${session.podId}) doesn't answer. --down, then --up again.`);
    process.exit(1);
  }
  const left = Math.round((session.deadline - Date.now()) / 60_000);
  console.log(`On ${session.gpu} (up ${Math.round((Date.now() - session.startedAt) / 60_000)} min, ${left} min left).`);
  if (left < 8) {
    console.error('Too close to its deadline for another model: --down, then --up.');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const env = { comfyDir: '', url: session.url, headers: { Authorization: `Bearer ${session.token}` }, remote: true };
  let failures = 0;
  for (const name of todo) {
    console.log(`Modelling ${name}…`);
    try {
      const r = await generate(env, { image: imageOf(name), name, outDir: OUT, ...jobSettings, onProgress: (stage, secs) => console.log(`  ${name}: ${stage}… ${secs}s`) });
      console.log(`  ${rel(r.glb)}${r.textured ? ` and ${path.basename(r.textured)}` : ''} in ${r.secs}s (seed ${r.seed})`);
      const png = preview(name);
      if (png) console.log(`  preview ${png}`);
    } catch (e) {
      failures++;
      console.log(`  ${name} failed: ${e.message}`);
    }
  }
  process.exit(failures === todo.length ? 1 : 0);
}

// -- a batch: rent, model everything, terminate ------------------------------------------

if (values.next) {
  console.error('No minis GPU is up: npm run minis -- --up --yes');
  process.exit(1);
}
const apiKey = await apiKeyOrExit();
const opts = planOpts(apiKey, todo.map((name) => ({ image: imageOf(name), name, ...jobSettings })), values.minutes ? Number(values.minutes) : undefined);
const plan = await rentPlan(opts);
printPlan(plan);
console.log(`${todo.length} models (${model}, ${jobSettings.quality}${jobSettings.textured ? ', textured' : ''}), deadline ${plan.maxMinutes} min: $${plan.minCostUsd.toFixed(2)} on the cheapest card, $${plan.maxCostUsd.toFixed(2)} at worst (budget $${plan.budgetUsd.toFixed(2)}).`);
if (!values.yes) {
  console.log('Nothing rented. Run again with --yes to rent all of them, or --up --yes to go one at a time.');
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
const abort = new AbortController();
process.once('SIGINT', () => {
  console.log('Stopping: terminating the pod…');
  abort.abort();
});
const r = await rentAndGenerate(opts, abort.signal);
const summary = {
  made: new Date().toISOString(),
  pod: r.podId ?? null,
  gpu: r.gpu ?? null,
  minutes: r.minutes,
  spentUsd: Number(r.spentUsd.toFixed(2)),
  settings: jobSettings,
  models: r.results.map((x) => ({ glb: path.basename(x.glb), textured: x.textured ? path.basename(x.textured) : null, seed: x.seed, secs: x.secs })),
  failures: r.failures,
};
fs.writeFileSync(path.join(OUT, `run-${summary.made.replace(/[:.]/g, '-')}.json`), JSON.stringify(summary, null, 1));
for (const x of r.results) preview(path.basename(x.glb, '.glb'));
console.log(`${r.results.length} modelled, ${r.failures.length} failed, ${r.minutes} min on ${r.gpu ?? 'no GPU'}, about $${r.spentUsd.toFixed(2)}.`);
for (const f of r.failures) console.log(`  ${f.name}: ${f.error}`);
process.exit(r.failures.length && !r.results.length ? 1 : 0);
