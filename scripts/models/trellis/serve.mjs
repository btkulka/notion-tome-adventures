/**
 * Starts the 3D ComfyUI (TRELLIS.2 image-to-3D) on 127.0.0.1:8190, guarded for
 * this machine (see scripts/models/heavy.mjs and CLAUDE.md):
 *
 *   node scripts/models/trellis/serve.mjs      # foreground; Ctrl+C stops it
 *
 * It refuses to start when:
 *   - another TRELLIS server holds the lock;
 *   - the main ComfyUI (:8188) is up, since two would fight over 8 GB of VRAM;
 *   - less than 6 GB of RAM is free: in low-VRAM mode the 5 GB int8 model and
 *     its VAEs live in system memory between steps.
 * It runs with --lowvram, keeps 1 GB of VRAM spare for the desktop, caches
 * nothing between runs, uses half the cores and runs below normal priority.
 * If free RAM stays under 0.7 GB for 30 s it stops ComfyUI itself.
 *
 * COMFY3D_DIR overrides the install folder (default D:/tools/comfyui-3d).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireLock, checkMemory, lowerPriority, threadBudget } from '../heavy.mjs';

const COMFY = process.env.COMFY3D_DIR ?? 'D:/tools/comfyui-3d';
const PORT = 8190;
const python = path.join(COMFY, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

if (!fs.existsSync(python)) {
  console.error(`No ComfyUI venv at ${python}. See scripts/models/trellis/setup.mjs.`);
  process.exit(1);
}

async function answering(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

if (await answering('http://127.0.0.1:8188/system_stats')) {
  console.error('The main ComfyUI is running on :8188. Stop it first: two ComfyUIs on one 8 GB card will both crawl or run out of memory.');
  process.exit(5);
}
if (await answering(`http://127.0.0.1:${PORT}/system_stats`)) {
  console.log(`The 3D ComfyUI is already up on :${PORT}.`);
  process.exit(0);
}

acquireLock('trellis');
checkMemory('TRELLIS.2', { warnGB: 8, refuseGB: 6 });

const threads = String(threadBudget());
const child = spawn(
  python,
  ['main.py', '--listen', '127.0.0.1', '--port', String(PORT), '--lowvram', '--reserve-vram', '1.0', '--cache-none', '--disable-auto-launch'],
  {
    cwd: COMFY,
    stdio: 'inherit',
    env: { ...process.env, OMP_NUM_THREADS: threads, MKL_NUM_THREADS: threads, PYTORCH_CUDA_ALLOC_CONF: 'expandable_segments:True' },
  }
);
lowerPriority(child.pid);
console.log(`3D ComfyUI starting on http://127.0.0.1:${PORT} (pid ${child.pid}, ${threads} threads, low priority).`);

// Memory floor: free RAM under FLOOR_GB for 30 s straight means the machine is
// thrashing. Stop ComfyUI rather than let the desktop freeze.
const FLOOR_GB = 0.7;
let lowFor = 0;
const floor = setInterval(() => {
  lowFor = os.freemem() / 1024 ** 3 < FLOOR_GB ? lowFor + 1 : 0;
  if (lowFor >= 3) {
    console.error(`Free RAM stayed under ${FLOOR_GB} GB for 30 s; stopping ComfyUI so the machine stays usable.`);
    clearInterval(floor);
    child.kill();
  }
}, 10_000);
floor.unref();
const stop = () => child.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
