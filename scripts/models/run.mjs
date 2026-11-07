/**
 * Runs scripts/models/build.py inside Blender, passing every argument through.
 *
 *   npm run models -- --only trees --sheet out.png
 *
 * Finds Blender from $BLENDER, then PATH, then the usual install folders.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  console.error('Blender not found. Set BLENDER to the blender executable (4.2 LTS or newer).');
  process.exit(1);
}

const result = spawnSync(
  blender,
  ['--background', '--factory-startup', '--python-exit-code', '1', '--python', path.join(here, 'build.py'), '--', ...process.argv.slice(2)],
  { stdio: 'inherit' }
);
process.exit(result.status ?? 1);
