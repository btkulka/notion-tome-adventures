/**
 * Surface patterns for the world-map props: one tileable greyscale detail map
 * per material, packed into public/textures/props/patterns.png.
 *
 *   npm run textures:props
 *
 * The prop shader (src/features/maps/render/models.ts) multiplies each face's
 * palette colour by its material's pattern, projected in the model's own axes,
 * so a prop keeps its colours and gains stone courses, bark, slates or leaves.
 * Every pattern averages exactly mid-grey (no net change in brightness) and
 * tiles seamlessly, using the same torus noise and wrapping cells as the terrain
 * textures. Cells are laid out in kit.MATERIALS order (scripts/models/kit.py),
 * four to a row, each with a wrapped gutter so mipmaps don't bleed between them.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createNoise4D } from 'simplex-noise';
import { mulberry32 } from '../../src/features/maps/gen/prng';
import { encodePng } from './png';

/** Pattern pixels per side; the gutter wraps each pattern's own edges around it. */
export const CELL = 512;
export const GUTTER = 16;
export const COLS = 4;
/** In kit.MATERIALS order. */
export const MATERIALS = ['none', 'masonry', 'rock', 'plaster', 'wood', 'bark', 'slate', 'thatch', 'tile', 'foliage', 'cloth', 'window', 'arcane'];

const TAU = Math.PI * 2;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const fract = (x: number) => x - Math.floor(x);

function hash1(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Periodic noise: `fu`/`fv` features across the tile; unequal values stretch the grain. */
class Field {
  private noise: ReturnType<typeof createNoise4D>;
  constructor(seed: number) {
    this.noise = createNoise4D(mulberry32(seed));
  }
  n(u: number, v: number, fu: number, fv = fu, o = 0): number {
    const a = u * TAU;
    const b = v * TAU;
    return this.noise((fu / TAU) * Math.cos(a) + o * 7.1, (fu / TAU) * Math.sin(a) + o * 3.3, (fv / TAU) * Math.cos(b) + o * 5.7, (fv / TAU) * Math.sin(b) + o * 1.9);
  }
  fbm(u: number, v: number, f: number, octaves = 4, fv = f): number {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.n(u, v, f * 2 ** o, fv * 2 ** o, o);
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  }
}

/** Wrapping Voronoi cells. */
class Cells {
  private pts: Float32Array;
  constructor(seed: number, private count: number) {
    const rand = mulberry32(seed);
    this.pts = new Float32Array(count * count * 2);
    for (let i = 0; i < this.pts.length; i++) this.pts[i] = 0.15 + rand() * 0.7;
  }
  at(u: number, v: number): { f1: number; f2: number; id: number; dx: number; dy: number } {
    const n = this.count;
    const gx = u * n;
    const gy = v * n;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    let f1 = Infinity;
    let f2 = Infinity;
    let id = 0;
    let bx = 0;
    let by = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const ix = cx + ox;
        const iy = cy + oy;
        const wx = ((ix % n) + n) % n;
        const wy = ((iy % n) + n) % n;
        const k = (wy * n + wx) * 2;
        const px = ix + this.pts[k];
        const py = iy + this.pts[k + 1];
        const d = Math.hypot(gx - px, gy - py);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = wy * n + wx;
          bx = gx - px;
          by = gy - py;
        } else if (d < f2) f2 = d;
      }
    }
    return { f1, f2, id, dx: bx, dy: by };
  }
}

/** A pattern: brightness around 0.5 and a height for painted relief, at (u, v) with v up. */
type Pattern = { relief: number; sample: (u: number, v: number) => { b: number; h: number } };

/** Bricks or slates in rows: which block (u, v) falls in, and how far it is from the block's edges. */
function courses(u: number, v: number, rows: number, perRow: number, stagger = 0.5) {
  const ry = v * rows;
  const row = Math.floor(ry);
  const fy = ry - row;
  const rx = u * perRow + (row % 2) * stagger;
  const col = Math.floor(rx);
  const fx = rx - col;
  return { row, col: ((col % perRow) + perRow) % perRow, fx, fy };
}

const PATTERNS: Record<string, () => Pattern> = {
  none: () => ({ relief: 0, sample: () => ({ b: 0.5, h: 0 }) }),
  window: () => ({ relief: 0, sample: () => ({ b: 0.5, h: 0 }) }),
  arcane: () => ({ relief: 0, sample: () => ({ b: 0.5, h: 0 }) }),

  // Dressed stone in running bond: five courses, chipped arrises, recessed mortar.
  masonry: () => {
    const f = new Field(201);
    return {
      relief: 2.2,
      sample: (u, v) => {
        const c = courses(u, v, 5, 3);
        const chip = f.fbm(u, v, 14, 3) * 0.05;
        const edge = Math.min(c.fx * 3, (1 - c.fx) * 3, c.fy, 1 - c.fy) * 1 + chip;
        const mortar = smoothstep(0.03, 0.075, edge);
        const tone = (hash1(c.row * 31 + c.col * 7 + 3) - 0.5) * 0.22 + f.fbm(u, v, 9, 3) * 0.08;
        return { b: 0.3 + mortar * (0.22 + tone + 0.5) * 0.66, h: mortar * (0.8 + f.fbm(u, v, 6, 2) * 0.2) };
      },
    };
  },

  // Natural rock: broken into plates by cracks, weathered within.
  rock: () => {
    const f = new Field(202);
    const cells = new Cells(203, 5);
    return {
      relief: 2.6,
      sample: (u, v) => {
        const c = cells.at(u, v);
        const crack = smoothstep(0.02, 0.09, c.f2 - c.f1 + f.fbm(u, v, 18, 2) * 0.03);
        const tone = f.fbm(u, v, 5, 4) * 0.16 + (hash1(c.id + 11) - 0.5) * 0.12;
        return { b: 0.5 + tone - (1 - crack) * 0.22, h: f.fbm(u, v, 4, 4) * 0.6 + crack * 0.4 };
      },
    };
  },

  // Lime plaster: soft mottling, fine grit, a few stains running down.
  plaster: () => {
    const f = new Field(204);
    return {
      relief: 0.8,
      sample: (u, v) => {
        const mottle = f.fbm(u, v, 3, 3) * 0.07;
        const grit = f.n(u, v, 60, 60, 2) * 0.025;
        const stain = smoothstep(0.35, 0.75, f.fbm(u, v, 2, 3, 0.7)) * smoothstep(0.6, 0.0, fract(v + f.n(u, v, 3, 3, 4) * 0.2)) * -0.08;
        return { b: 0.5 + mottle + grit + stain, h: f.fbm(u, v, 8, 3) * 0.3 };
      },
    };
  },

  // Boards running up the face, with grain, gaps and the odd knot.
  wood: () => {
    const f = new Field(205);
    const knots = new Cells(206, 4);
    return {
      relief: 1.4,
      sample: (u, v) => {
        const planks = 4;
        const px = u * planks;
        const plank = Math.floor(px);
        const fx = px - plank;
        const gap = smoothstep(0.0, 0.06, Math.min(fx, 1 - fx));
        const grain = f.n(u, v, 48, 3, plank) * 0.07 + f.fbm(u, v, 12, 2, 2) * 0.04;
        const k = knots.at(u, v);
        const knot = k.f1 < 0.18 && hash1(k.id) > 0.55 ? (0.18 - k.f1) * -0.9 : 0;
        const tone = (hash1(plank * 13 + 5) - 0.5) * 0.14;
        return { b: 0.5 + tone + grain + knot - (1 - gap) * 0.25, h: gap * 0.7 + grain };
      },
    };
  },

  // Bark: deep vertical fissures between ridged plates.
  bark: () => {
    const f = new Field(207);
    return {
      relief: 2.8,
      sample: (u, v) => {
        const ridge = 1 - Math.abs(f.fbm(u, v, 7, 4, 1.6));
        const fissure = smoothstep(0.55, 0.9, ridge);
        const plates = f.fbm(u, v, 3, 2, 6) * 0.08;
        return { b: 0.36 + fissure * 0.28 + plates, h: fissure };
      },
    };
  },

  // Slates in staggered courses, each darker at its lower lip where it overlaps the next.
  slate: () => {
    const f = new Field(208);
    return {
      relief: 1.8,
      sample: (u, v) => {
        const c = courses(u, v, 7, 5);
        const lip = smoothstep(0.0, 0.25, c.fy);
        const seam = smoothstep(0.0, 0.05, Math.min(c.fx, 1 - c.fx));
        const tone = (hash1(c.row * 17 + c.col * 3 + 1) - 0.5) * 0.18 + f.fbm(u, v, 10, 2) * 0.05;
        return { b: 0.5 + tone + (lip - 0.6) * 0.22 - (1 - seam) * 0.18, h: c.fy * 0.6 + seam * 0.3 };
      },
    };
  },

  // Thatch: fine straw running down, in layered bands with a shadow under each.
  thatch: () => {
    const f = new Field(209);
    return {
      relief: 1.6,
      sample: (u, v) => {
        const band = fract(v * 4 + f.n(u, v, 3, 2, 1) * 0.15);
        const under = smoothstep(0.0, 0.3, band);
        const straw = f.n(u, v, 70, 5, 2) * 0.1 + f.n(u, v, 140, 9, 3) * 0.05;
        return { b: 0.5 + straw + (under - 0.7) * 0.2, h: band * 0.6 + straw };
      },
    };
  },

  // Barrel tiles: rounded columns of tiles in courses.
  tile: () => {
    const f = new Field(210);
    return {
      relief: 2.0,
      sample: (u, v) => {
        const c = courses(u, v, 6, 6, 0.0);
        const barrel = Math.cos((c.fx - 0.5) * Math.PI);
        const lip = smoothstep(0.0, 0.22, c.fy);
        const tone = (hash1(c.row * 23 + c.col) - 0.5) * 0.12 + f.fbm(u, v, 8, 2) * 0.04;
        return { b: 0.36 + barrel * 0.22 + (lip - 0.5) * 0.14 + tone, h: barrel * 0.7 + lip * 0.3 };
      },
    };
  },

  // Foliage: overlapping leaf clumps, lit from above with dark gaps between.
  foliage: () => {
    const f = new Field(211);
    const leaves = new Cells(212, 9);
    return {
      relief: 2.4,
      sample: (u, v) => {
        const c = leaves.at(u, v);
        const body = smoothstep(0.62, 0.15, c.f1);
        const lit = clamp01(0.5 + c.dy * 0.9 - c.dx * 0.3);
        const tone = (hash1(c.id + 41) - 0.5) * 0.16 + f.fbm(u, v, 20, 2) * 0.05;
        return { b: 0.3 + body * (0.25 + lit * 0.25) + tone, h: body };
      },
    };
  },

  // Cloth: a faint weave and soft folds.
  cloth: () => {
    const f = new Field(213);
    return {
      relief: 0.6,
      sample: (u, v) => {
        const weave = Math.sin(u * TAU * 64) * Math.sin(v * TAU * 64) * 0.03;
        const folds = f.fbm(u, v, 2, 3, 4) * 0.1;
        return { b: 0.5 + weave + folds, h: folds };
      },
    };
  },
};

const LIGHT = (() => {
  const l = [-0.5, 0.65, 0.6];
  const n = Math.hypot(l[0], l[1], l[2]);
  return l.map((x) => x / n);
})();

/** One pattern rendered to CELL² greyscale, its mean pinned to mid-grey. */
function render(p: Pattern): Float32Array {
  const b = new Float32Array(CELL * CELL);
  const h = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      // Image rows run down; v runs up the face.
      const s = p.sample(x / CELL, 1 - y / CELL);
      b[y * CELL + x] = s.b;
      h[y * CELL + x] = s.h;
    }
  }
  const at = (x: number, y: number) => h[((y + CELL) % CELL) * CELL + ((x + CELL) % CELL)];
  const k = p.relief * (CELL / 256) * 1.5;
  const out = new Float32Array(CELL * CELL);
  let sum = 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y - 1) - at(x, y + 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const shade = Math.min(1.3, Math.max(0.6, ((-dx / len) * LIGHT[0] + (-dy / len) * LIGHT[1] + (1 / len) * LIGHT[2]) / LIGHT[2]));
      const v = b[y * CELL + x] * (p.relief ? shade : 1);
      out[y * CELL + x] = v;
      sum += v;
    }
  }
  const gain = 0.5 / (sum / out.length || 0.5);
  for (let i = 0; i < out.length; i++) out[i] = clamp01(out[i] * gain);
  return out;
}

const SIDE = CELL + GUTTER * 2;
const rows = Math.ceil(MATERIALS.length / COLS);
const width = COLS * SIDE;
const height = rows * SIDE;
const atlas = new Uint8Array(width * height * 3).fill(128);
for (const [i, name] of MATERIALS.entries()) {
  const started = Date.now();
  const grey = render(PATTERNS[name]());
  const ox = (i % COLS) * SIDE;
  const oy = Math.floor(i / COLS) * SIDE;
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const sx = (((x - GUTTER) % CELL) + CELL) % CELL;
      const sy = (((y - GUTTER) % CELL) + CELL) % CELL;
      const g = Math.round(grey[sy * CELL + sx] * 255);
      const d = ((oy + y) * width + ox + x) * 3;
      atlas[d] = atlas[d + 1] = atlas[d + 2] = g;
    }
  }
  console.log(`${name.padEnd(9)} ${Date.now() - started} ms`);
}
const out = path.resolve(process.argv[2] ?? 'public/textures/props/patterns.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, encodePng(width, height, atlas));
console.log(`Wrote ${path.relative(process.cwd(), out)} (${width}×${height})`);
