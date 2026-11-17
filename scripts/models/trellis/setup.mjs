/**
 * One-time setup for local image-to-3D: puts the TRELLIS.2 weights into a
 * dedicated ComfyUI (default D:/tools/comfyui-3d, a plain clone of ComfyUI
 * 0.45+, whose TRELLIS.2 nodes are built in) and points it at the main
 * ComfyUI's models for the SDXL checkpoint that draws concept images.
 *
 *   node scripts/models/trellis/setup.mjs            # download what's missing (resumes)
 *   node scripts/models/trellis/setup.mjs --check    # just report
 *
 * COMFY3D_DIR and COMFY_MODELS override the two folders.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const COMFY = process.env.COMFY3D_DIR ?? 'D:/tools/comfyui-3d';
const SHARED = process.env.COMFY_MODELS ?? 'D:/source/comfyui/models';

/** [folder under models/, file, Hugging Face repo, path in repo, approximate bytes] */
const FILES = [
  ['diffusion_models', 'trellis_2_int8_convrot.safetensors', 'Comfy-Org/TRELLIS.2', 'diffusion_models/trellis_2_int8_convrot.safetensors', 5.25e9],
  ['vae', 'trellis_2_shape_vae_bf16.safetensors', 'Comfy-Org/TRELLIS.2', 'vae/trellis_2_shape_vae_bf16.safetensors', 1.1e9],
  ['vae', 'trellis_2_texture_vae_bf16.safetensors', 'Comfy-Org/TRELLIS.2', 'vae/trellis_2_texture_vae_bf16.safetensors', 0.95e9],
  ['clip_vision', 'dino_v3_L_naf_fp32.safetensors', 'Comfy-Org/Pixal3D', 'clip_vision/dino_v3_L_naf_fp32.safetensors', 1.22e9],
  ['background_removal', 'birefnet.safetensors', 'Comfy-Org/BiRefNet', 'background_removal/birefnet.safetensors', 0.44e9],
];

const check = process.argv.includes('--check');
if (!fs.existsSync(path.join(COMFY, 'main.py'))) {
  console.error(`No ComfyUI at ${COMFY}. Clone it first: git clone https://github.com/comfyanonymous/ComfyUI ${COMFY}`);
  process.exit(1);
}

// Reuse the main install's checkpoints rather than copying gigabytes.
const extra = path.join(COMFY, 'extra_model_paths.yaml');
if (!check && !fs.existsSync(extra) && fs.existsSync(SHARED)) {
  fs.writeFileSync(extra, `# Written by notion-tome-adventures/scripts/models/trellis/setup.mjs\nshared:\n  base_path: ${SHARED}\n  checkpoints: checkpoints\n  vae: vae\n  loras: loras\n`);
  console.log(`Wrote ${extra} (shares ${SHARED})`);
}

const aria = spawnSync('aria2c', ['--version'], { stdio: 'ignore' }).status === 0;
let missing = 0;
for (const [folder, file, repo, inRepo, bytes] of FILES) {
  const dir = path.join(COMFY, 'models', folder);
  const dest = path.join(dir, file);
  const partial = fs.existsSync(`${dest}.aria2`) || fs.existsSync(`${dest}.part`);
  const have = fs.existsSync(dest) && !partial ? fs.statSync(dest).size : 0;
  if (have > bytes * 0.98) {
    console.log(`ok       ${folder}/${file}`);
    continue;
  }
  missing++;
  console.log(`${partial ? 'partial ' : 'missing '} ${folder}/${file} (${(bytes / 1e9).toFixed(2)} GB)`);
  if (check) continue;
  fs.mkdirSync(dir, { recursive: true });
  const url = `https://huggingface.co/${repo}/resolve/main/${inRepo}`;
  // Hugging Face's signed CDN links expire and the line here drops out, so retry
  // from the top (a fresh redirect) a few times; every attempt resumes.
  let status = 1;
  for (let attempt = 1; attempt <= 12 && status !== 0; attempt++) {
    if (attempt > 1) {
      console.log(`  retrying (${attempt}/12) in 20 s…`);
      spawnSync(process.execPath, ['-e', 'setTimeout(()=>{}, 20000)']);
    }
    const run = aria
      ? spawnSync('aria2c', ['-c', '-x', '2', '-s', '2', '--max-tries=5', '--retry-wait=10', '--file-allocation=none', '--summary-interval=120', '--console-log-level=warn', '-d', dir, '-o', file, url], { stdio: 'inherit' })
      : spawnSync('curl', ['-L', '-C', '-', '--retry', '20', '--retry-delay', '5', '-o', dest, url], { stdio: 'inherit' });
    status = run.status ?? 1;
  }
  if (status !== 0) {
    console.error(`Download of ${file} kept failing (exit ${status}); run again to resume.`);
    process.exit(status);
  }
  missing--;
}
console.log(missing ? `${missing} file(s) still missing.` : 'All TRELLIS.2 weights are in place.');
