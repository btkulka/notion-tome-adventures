/**
 * Guards for jobs that can swamp this machine (Blender bakes, ComfyUI/TRELLIS):
 * a 4-core CPU and 16 GB of RAM shared with the editor, browsers and other
 * Claude sessions. Every heavy launcher goes through these:
 *
 *   - one job at a time per kind, across every session (a lock file in the temp dir);
 *   - refuse to start when free memory is too low, warn when it's tight;
 *   - half the logical cores at most;
 *   - below-normal priority, so the desktop stays responsive.
 *
 * TOME_FORCE=1 skips the memory refusal (not the lock).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const GB = 1024 ** 3;

/** Threads a heavy job may use: half the logical cores, at least two. */
export const threadBudget = () => Math.max(2, Math.floor(os.cpus().length / 2));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/**
 * Take the lock for `name` or exit explaining who holds it. A lock whose
 * process has died is stale and taken over. Released when this process exits.
 */
export function acquireLock(name) {
  const file = path.join(os.tmpdir(), `tome-${name}.lock`);
  try {
    const held = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (held.pid !== process.pid && alive(held.pid)) {
      console.error(`Another ${name} job is running (pid ${held.pid}, started ${held.at}: ${held.what}).`);
      console.error('Wait for it to finish; heavy jobs run one at a time so the machine stays usable.');
      process.exit(3);
    }
  } catch {
    // No lock, or an unreadable one: take it.
  }
  fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), what: process.argv.slice(2).join(' ') || name }));
  const release = () => {
    try {
      if (JSON.parse(fs.readFileSync(file, 'utf8')).pid === process.pid) fs.unlinkSync(file);
    } catch {
      // Already gone.
    }
  };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(sig, () => process.exit(130));
}

/** Exit if free memory is under `refuseGB` (unless TOME_FORCE=1); warn if under `warnGB`. */
export function checkMemory(name, { warnGB, refuseGB }) {
  const free = os.freemem() / GB;
  const total = os.totalmem() / GB;
  if (free < refuseGB && process.env.TOME_FORCE !== '1') {
    console.error(`Only ${free.toFixed(1)} of ${total.toFixed(0)} GB free; ${name} needs at least ${refuseGB} GB.`);
    console.error('Close something heavy first (duplicate dev servers, browser tabs), or set TOME_FORCE=1 to run anyway.');
    process.exit(4);
  }
  if (free < warnGB) console.warn(`Warning: ${free.toFixed(1)} GB free; ${name} may push the machine into swap.`);
}

/** Lower a child's priority so it yields to the desktop. */
export function lowerPriority(pid) {
  try {
    os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    // Not permitted; it runs at normal priority.
  }
}
