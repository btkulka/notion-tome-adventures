/**
 * Runs a script from scripts/models inside Blender, passing every argument through.
 *
 *   npm run models -- --only trees --sheet out.png       (build.py)
 *   npm run models:conform -- raw.glb --name ruin-keep  (conform.py)
 *
 * A first argument of `build` or `conform` picks the script, and
 * `script <file.py>` runs any other Blender script under the same guards;
 * otherwise it's build.py. Finds Blender (5.2 LTS) from $BLENDER, then PATH, then the usual
 * install folders, D:/tools/blender included.
 *
 * Blender runs one job at a time, on half the cores, at below-normal priority
 * (see heavy.mjs): the AO bake would otherwise take every core.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, checkMemory, lowerPriority, threadBudget } from './heavy.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const exe = process.platform === 'win32' ? 'blender.exe' : 'blender';
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    const candidate = path.join(dir, exe);
    if (dir && fs.existsSync(candidate)) return candidate;
  }
  const roots = ['C:/Program Files/Blender Foundation', 'D:/tools', 'D:/Program Files/Blender Foundation', '/Applications/Blender.app/Contents/MacOS'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      const candidate = path.join(dir, exe);
      if (fs.existsSync(candidate)) return candidate;
      if (dir.split(/[\\/]/).length - root.split(/[\\/]/).length > 2) continue;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && /blender/i.test(entry.name)) stack.push(path.join(dir, entry.name));
      }
    }
  }
  return null;
}

const blender = findBlender();
if (!blender) {
  console.error('Blender not found. Set BLENDER to the blender executable (5.2 LTS).');
  process.exit(1);
}

let args = process.argv.slice(2);
let script = path.join(here, 'build.py');
if (['build', 'conform'].includes(args[0])) {
  script = path.join(here, `${args[0]}.py`);
  args = args.slice(1);
} else if (args[0] === 'script' && args[1]?.endsWith('.py')) {
  // A one-off Blender script (a test asset, an experiment) under the same guards.
  script = path.resolve(args[1]);
  args = args.slice(2);
}

// One Blender at a time across every session, enough memory to run it, half the cores.
acquireLock('blender');
checkMemory('Blender', { warnGB: 2, refuseGB: 0.8 });
const threads = threadBudget();

const child = spawn(
  blender,
  ['--background', '--factory-startup', '--threads', String(threads), '--python-exit-code', '1', '--python', script, '--', ...args],
  { stdio: 'inherit' }
);
lowerPriority(child.pid);

// A runaway job (a pathological mesh, an endless loop) is stopped rather than left grinding.
const minutes = Number(process.env.TOME_TIMEOUT_MIN) || (script.endsWith('build.py') ? 30 : 10);
const watchdog = setTimeout(() => {
  console.error(`Blender ran past ${minutes} minutes; stopping it (TOME_TIMEOUT_MIN raises the limit).`);
  child.kill();
}, minutes * 60_000);
watchdog.unref();

child.on('error', (err) => {
  console.error(`Could not start Blender: ${err.message}`);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 1));
