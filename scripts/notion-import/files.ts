/**
 * Makes the images export.ts downloaded from Notion servable: a web-sized copy and
 * a square thumbnail of each, in public/notion-files/ (gitignored). Vite serves
 * that folder in development and the Worker deploys it as static assets; the
 * content routes point at it (worker/content/values.ts, imagesOf). It stands in
 * for R2 until that is enabled, so a build on a machine without the export ships
 * without these pictures.
 *
 *   npm run notion:files            # images not converted yet
 *   npm run notion:files -- --redo  # all of them again
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { EXPORT_DIR } from './tables';

const SOURCE = path.join(EXPORT_DIR, 'files');
const OUT = path.join('public', 'notion-files');
const IMAGE = /\.(png|jpe?g|gif|webp|avif)$/i;
/** Banners and cards never show wider than this. */
const FULL_WIDTH = 1600;
/** Thumbnails show at 40–64 CSS pixels; this covers high-density screens. */
const THUMB = 192;
const CONCURRENCY = 4;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

async function main() {
  const redo = process.argv.includes('--redo');
  const images = walk(SOURCE).filter((f) => IMAGE.test(f));
  if (!images.length) throw new Error(`No images in ${SOURCE}; run npm run notion:export first.`);

  let made = 0;
  let skipped = 0;
  let bytes = 0;
  const failed: string[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < images.length) {
        const file = images[next++];
        const rel = path.relative(SOURCE, file);
        const full = path.join(OUT, `${rel}.full.webp`);
        const thumb = path.join(OUT, `${rel}.thumb.webp`);
        if (!redo && fs.existsSync(full) && fs.existsSync(thumb)) {
          skipped++;
          continue;
        }
        try {
          fs.mkdirSync(path.dirname(full), { recursive: true });
          await sharp(file).rotate().resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toFile(full);
          await sharp(file).rotate().resize(THUMB, THUMB, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 78 }).toFile(thumb);
          bytes += fs.statSync(full).size + fs.statSync(thumb).size;
          made++;
        } catch (err) {
          failed.push(`${rel}: ${(err as Error).message}`);
        }
      }
    })
  );

  console.log(`${made} images converted (${Math.round(bytes / 1024 / 1024)} MB), ${skipped} already done, into ${OUT}`);
  if (failed.length) {
    console.error(`Could not convert ${failed.length}:\n  ${failed.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
