/**
 * Procedural terrain textures for the overworld diorama.
 *
 *   npx vite-node scripts/textures/generate-terrain-textures.ts [outDir]
 *
 * Every texture tiles seamlessly: noise is sampled on a 4D torus and Voronoi
 * cells wrap, so the left edge continues the right and the top the bottom.
 * Each recipe returns colour plus a height value; a shared lighting pass turns
 * the height into painted relief. Output is deterministic for the seeds below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createNoise4D } from 'simplex-noise';
import { mulberry32 } from '../../src/features/maps/gen/prng';
import { encodePng } from './png';

const SIZE = 256;
const TAU = Math.PI * 2;

type RGB = [number, number, number];

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (a: number, b: number, t: number) => {
  const x = clamp01((t - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function ramp(stops: string[]): (t: number) => RGB {
  const cols = stops.map(hex);
  return (t) => {
    const x = clamp01(t) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(x));
    return mix(cols[i], cols[i + 1], x - i);
  };
}

function hash1(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Periodic noise fields. `fu`/`fv` are features across the tile; unequal values stretch the grain. */
class Field {
  private noise: ReturnType<typeof createNoise4D>;
  constructor(seed: number) {
    this.noise = createNoise4D(mulberry32(seed));
  }
  n(u: number, v: number, fu: number, fv = fu, o = 0): number {
    const a = u * TAU;
    const b = v * TAU;
    const ru = fu / TAU;
    const rv = fv / TAU;
    return this.noise(ru * Math.cos(a) + o * 7.1, ru * Math.sin(a) + o * 3.3, rv * Math.cos(b) + o * 5.7, rv * Math.sin(b) + o * 1.9);
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
  ridged(u: number, v: number, f: number, octaves = 4, fv = f): number {
    return 1 - Math.abs(this.fbm(u, v, f, octaves, fv));
  }
}

/** Wrapping Voronoi cells. Distances are in cell units. */
class Cells {
  private pts: Float32Array;
  constructor(seed: number, private count: number) {
    const rand = mulberry32(seed);
    this.pts = new Float32Array(count * count * 2);
    for (let i = 0; i < this.pts.length; i++) this.pts[i] = 0.15 + rand() * 0.7;
  }
  at(u: number, v: number): { f1: number; f2: number; id: number; r: number } {
    const n = this.count;
    const gx = u * n;
    const gy = v * n;
    const cx = Math.floor(gx);
    const cy = Math.floor(gy);
    let f1 = Infinity;
    let f2 = Infinity;
    let id = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx;
        const iy = cy + dy;
        const wx = ((ix % n) + n) % n;
        const wy = ((iy % n) + n) % n;
        const k = (wy * n + wx) * 2;
        const d = Math.hypot(gx - (ix + this.pts[k]), gy - (iy + this.pts[k + 1]));
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = wy * n + wx;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }
    return { f1, f2, id, r: hash1(id + n * 7919) };
  }
}

interface Sample {
  c: RGB;
  h: number;
}

interface Recipe {
  name: string;
  /** Strength of the relief lighting. */
  relief: number;
  /** Colour applied in shadowed relief (snow wants blue shadows). */
  shadowTint?: RGB;
  sample: (u: number, v: number) => Sample;
}

// --- Recipes --------------------------------------------------------------

function grass(): Recipe {
  const f = new Field(101);
  const flowers = new Cells(102, 22);
  const base = ramp(['#3A5330', '#4B6636', '#5D773D', '#718A48', '#869C55']);
  return {
    name: 'grass',
    relief: 1.2,
    sample(u, v) {
      const broad = f.fbm(u, v, 3, 3);
      const mid = f.fbm(u, v, 9, 3);
      const blade = Math.pow(f.ridged(u, v, 18, 2, 6), 7);
      const blade2 = Math.pow(f.ridged(u, v, 6, 2, 18), 7);
      let c = base(0.5 + broad * 0.45 + mid * 0.18);
      c = mix(c, hex('#9DAE62'), (blade + blade2) * 0.2);
      c = mix(c, hex('#2A3F22'), smoothstep(0.35, 0.75, -mid) * 0.35);
      const cell = flowers.at(u, v);
      if (cell.r < 0.1 && cell.f1 < 0.11) c = mix(c, hex(cell.r < 0.05 ? '#E6DDB0' : '#B9A0C9'), 0.85);
      return { c, h: broad * 0.5 + mid * 0.25 + (blade + blade2) * 0.15 };
    },
  };
}

function forestFloor(): Recipe {
  const f = new Field(201);
  const leaves = new Cells(202, 30);
  const base = ramp(['#1F2C18', '#2B3B1E', '#384B24', '#47592B']);
  const litter = [hex('#5A3E20'), hex('#6B4A24'), hex('#4E3519'), hex('#7A5A2A')];
  return {
    name: 'forest',
    relief: 2.6,
    sample(u, v) {
      const broad = f.fbm(u, v, 3, 4);
      const moss = smoothstep(0.05, 0.45, f.fbm(u, v, 4, 3));
      let c = base(0.5 + broad * 0.5);
      c = mix(c, hex('#4F6B2C'), moss * 0.55);
      const cell = leaves.at(u, v);
      let h = broad * 0.5 + moss * 0.3;
      if (cell.f1 < 0.32 && cell.r < 0.55) {
        c = mix(c, litter[Math.floor(cell.r * 7.27) % 4], 0.75 * (1 - cell.f1 / 0.32));
        h += 0.35 * (1 - cell.f1 / 0.32);
      }
      return { c: scale(c, 0.92), h };
    },
  };
}

function taiga(): Recipe {
  const f = new Field(301);
  const lichen = new Cells(302, 26);
  const base = ramp(['#28372C', '#33443A', '#3F5244', '#4E6150']);
  return {
    name: 'taiga',
    relief: 1.4,
    sample(u, v) {
      const broad = f.fbm(u, v, 3, 4);
      const needles = Math.pow(f.ridged(u, v, 20, 2, 7), 8) + Math.pow(f.ridged(u, v, 7, 2, 20), 8);
      let c = base(0.5 + broad * 0.5);
      c = mix(c, hex('#5E4632'), needles * 0.3);
      const cell = lichen.at(u, v);
      if (cell.r < 0.18 && cell.f1 < 0.16) c = mix(c, hex('#8F9A7C'), 0.6);
      return { c, h: broad * 0.5 + needles * 0.3 };
    },
  };
}

function swamp(): Recipe {
  const f = new Field(401);
  const mud = ramp(['#2E2B1E', '#3B3725', '#4A4630', '#5A573A']);
  const water = ramp(['#1E302C', '#284038', '#355247']);
  return {
    name: 'swamp',
    relief: 2,
    sample(u, v) {
      const warp = f.fbm(u, v, 2, 2) * 0.12;
      const pools = f.fbm(u + warp, v - warp, 3, 4);
      const wet = smoothstep(0.12, 0.2, pools);
      const reeds = Math.pow(f.ridged(u, v, 30, 2, 6), 7);
      let c = mud(0.5 + f.fbm(u, v, 8, 3) * 0.5);
      c = mix(c, hex('#5E6B33'), smoothstep(0.0, 0.3, -pools) * 0.4);
      c = mix(c, water(0.5 + f.fbm(u, v, 10, 2) * 0.5), wet);
      const algae = smoothstep(0.35, 0.6, f.fbm(u, v, 14, 2)) * wet;
      c = mix(c, hex('#5C7533'), algae * 0.7);
      c = mix(c, hex('#7D7A45'), reeds * (1 - wet) * 0.5);
      return { c, h: (1 - wet) * 0.6 + reeds * 0.25 };
    },
  };
}

function desert(): Recipe {
  const f = new Field(501);
  const base = ramp(['#A97D48', '#BD9157', '#CDA466', '#DDB97C']);
  return {
    name: 'desert',
    relief: 1.4,
    sample(u, v) {
      const warp = f.fbm(u, v, 2, 3);
      const dunes = Math.sin((v * 3 + u * 1 + warp * 0.8) * TAU);
      const ripples = Math.sin((v * 22 + u * 3 + f.fbm(u, v, 5, 2) * 0.9) * TAU);
      const grain = f.n(u, v, 120);
      const c = base(0.5 + dunes * 0.1 + warp * 0.3 + grain * 0.05);
      return { c, h: dunes * 0.3 + ripples * 0.04 };
    },
  };
}

function beach(): Recipe {
  const f = new Field(601);
  const shells = new Cells(602, 28);
  const base = ramp(['#BCA474', '#CBB485', '#D9C497', '#E5D3AA']);
  return {
    name: 'beach',
    relief: 1.6,
    sample(u, v) {
      const broad = f.fbm(u, v, 3, 3);
      let c = base(0.5 + broad * 0.4 + f.n(u, v, 110) * 0.08);
      const cell = shells.at(u, v);
      let h = broad * 0.4;
      if (cell.r < 0.12 && cell.f1 < 0.14) {
        c = mix(c, hex(cell.r < 0.06 ? '#EFE6D6' : '#7E7363'), 0.8);
        h += 0.3;
      }
      return { c, h };
    },
  };
}

function hills(): Recipe {
  const f = new Field(701);
  const stones = new Cells(702, 6);
  const turf = ramp(['#4A5528', '#5E6A30', '#77803C', '#909548']);
  const rock = ramp(['#5A554D', '#6F6A61', '#878177']);
  return {
    name: 'hills',
    relief: 2,
    sample(u, v) {
      const broad = f.fbm(u, v, 3, 4);
      const blade = Math.pow(f.ridged(u, v, 16, 2, 6), 7);
      let c = mix(turf(0.5 + broad * 0.5), hex('#A3A563'), blade * 0.25);
      let h = broad * 0.4 + blade * 0.2;
      const outcrop = smoothstep(0.2, 0.35, f.fbm(u, v, 3, 3));
      if (outcrop > 0) {
        const cell = stones.at(u, v);
        const edge = smoothstep(0, 0.12, cell.f2 - cell.f1);
        const stone = mix(hex('#2F2B27'), rock(cell.r), edge);
        c = mix(c, stone, outcrop);
        h += outcrop * (0.5 + edge * 0.6);
      }
      return { c, h };
    },
  };
}

function rock(): Recipe {
  const f = new Field(801);
  const cracks = new Cells(802, 5);
  const base = ramp(['#46423D', '#58534C', '#6D675E', '#857E73', '#9C958A']);
  return {
    name: 'rock',
    relief: 2.4,
    sample(u, v) {
      const warp = f.fbm(u, v, 2, 3);
      const strata = Math.sin((v * 5 + warp * 0.6) * TAU) * 0.5 + 0.5;
      const broad = f.fbm(u, v, 5, 4);
      const cell = cracks.at(u + f.fbm(u, v, 3, 3) * 0.09, v + f.fbm(v, u, 3, 3) * 0.09);
      const crack = (1 - smoothstep(0, 0.05, cell.f2 - cell.f1)) * smoothstep(-0.2, 0.3, f.fbm(u, v, 4, 2));
      let c = base(0.45 + broad * 0.35 + strata * 0.2 + (cell.r - 0.5) * 0.15);
      c = mix(c, hex('#24211E'), crack * 0.6);
      const lichen = smoothstep(0.35, 0.6, f.fbm(u, v, 7, 3));
      c = mix(c, hex('#7E8253'), lichen * 0.35);
      return { c, h: broad * 0.5 + strata * 0.2 - crack * 0.5 };
    },
  };
}

function snow(): Recipe {
  const f = new Field(901);
  const glints = new Cells(902, 40);
  const base = ramp(['#C3CDD8', '#D3DCE5', '#E3E9EF', '#F1F4F7']);
  return {
    name: 'snow',
    relief: 3.2,
    shadowTint: hex('#7E93AE'),
    sample(u, v) {
      const warp = f.fbm(u, v, 2, 2) * 0.15;
      const drifts = f.fbm(u + warp, v, 3, 4);
      let c = base(0.6 + drifts * 0.4);
      const cell = glints.at(u, v);
      if (cell.r < 0.06 && cell.f1 < 0.07) c = hex('#FFFFFF');
      return { c, h: drifts * 0.8 + f.fbm(u, v, 16, 2) * 0.08 };
    },
  };
}

function water(name: string, seed: number, stops: string[], highlight: string): Recipe {
  const f = new Field(seed);
  const base = ramp(stops);
  return {
    name,
    relief: 0.8,
    sample(u, v) {
      const warp = f.fbm(u, v, 2, 2) * 0.2;
      const swell = f.fbm(u + warp, v - warp, 3, 3);
      const caustic = Math.pow(f.ridged(u + warp, v, 7, 3), 7);
      let c = base(0.5 + swell * 0.45);
      c = mix(c, hex(highlight), caustic * 0.45);
      return { c, h: swell * 0.3 };
    },
  };
}

function road(): Recipe {
  const f = new Field(1101);
  const pebbles = new Cells(1102, 24);
  const base = ramp(['#5E4830', '#6F5639', '#816543', '#92754E']);
  return {
    name: 'road',
    relief: 2.4,
    sample(u, v) {
      const broad = f.fbm(u, v, 4, 4);
      let c = base(0.5 + broad * 0.45 + f.n(u, v, 90) * 0.06);
      const cell = pebbles.at(u, v);
      let h = broad * 0.3;
      if (cell.r < 0.35 && cell.f1 < 0.2) {
        c = mix(c, hex(cell.r < 0.15 ? '#9A9080' : '#6C6457'), 0.8 * (1 - cell.f1 / 0.2));
        h += 0.4 * (1 - cell.f1 / 0.2);
      }
      return { c, h };
    },
  };
}

function cobble(): Recipe {
  const f = new Field(1201);
  const stones = new Cells(1202, 9);
  const palette = [hex('#6A655D'), hex('#777167'), hex('#837D72'), hex('#5D5850'), hex('#8E877B')];
  return {
    name: 'cobble',
    relief: 3.6,
    sample(u, v) {
      const cell = stones.at(u, v);
      const gap = cell.f2 - cell.f1;
      const mortar = 1 - smoothstep(0.04, 0.1, gap);
      let c = scale(palette[Math.floor(cell.r * 4.99)], 0.9 + f.fbm(u, v, 12, 2) * 0.12);
      c = mix(c, hex('#3A3530'), mortar);
      c = mix(c, hex('#4F6230'), mortar * smoothstep(0.2, 0.5, f.fbm(u, v, 5, 2)) * 0.6);
      return { c, h: smoothstep(0.02, 0.3, gap) * 0.9 };
    },
  };
}

function earthSide(): Recipe {
  const f = new Field(1301);
  const stones = new Cells(1302, 14);
  const layers = ramp(['#33261A', '#3F2F20', '#4C3926', '#58432C', '#463423']);
  return {
    name: 'side-earth',
    relief: 2.6,
    sample(u, v) {
      const bands = f.fbm(u, v, 2, 3, 10);
      let c = layers(0.5 + bands * 0.6 + f.n(u, v, 60) * 0.05);
      const cell = stones.at(u, v);
      let h = bands * 0.4;
      if (cell.r < 0.3 && cell.f1 < 0.25) {
        c = mix(c, hex('#6E665B'), 0.8 * (1 - cell.f1 / 0.25));
        h += 0.5 * (1 - cell.f1 / 0.25);
      }
      const roots = Math.pow(f.ridged(u, v, 6, 2, 3), 12);
      c = mix(c, hex('#1E1610'), roots * 0.6);
      return { c, h };
    },
  };
}

function rockSide(): Recipe {
  const f = new Field(1401);
  const cracks = new Cells(1402, 6);
  const layers = ramp(['#3B3834', '#4B4741', '#5D5850', '#6F6960', '#55504A']);
  return {
    name: 'side-rock',
    relief: 3.4,
    sample(u, v) {
      const bands = f.fbm(u, v, 2, 3, 12);
      const cell = cracks.at(u + f.fbm(u, v, 3, 2) * 0.1, v);
      const crack = (1 - smoothstep(0, 0.05, cell.f2 - cell.f1)) * smoothstep(-0.1, 0.35, f.fbm(u, v, 3, 2));
      let c = layers(0.5 + bands * 0.7 + (cell.r - 0.5) * 0.2);
      c = mix(c, hex('#1E1C1A'), crack * 0.85);
      return { c, h: bands * 0.5 - crack * 0.6 };
    },
  };
}

// --- Render ---------------------------------------------------------------

const LIGHT = (() => {
  const l = [-0.55, -0.65, 0.75];
  const len = Math.hypot(l[0], l[1], l[2]);
  return l.map((x) => x / len);
})();

function render(recipe: Recipe): Uint8Array {
  const colours: RGB[] = new Array(SIZE * SIZE);
  const heights = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const s = recipe.sample(x / SIZE, y / SIZE);
      colours[y * SIZE + x] = s.c;
      heights[y * SIZE + x] = s.h;
    }
  }
  const out = new Uint8Array(SIZE * SIZE * 3);
  const at = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];
  const k = recipe.relief * (SIZE / 256) * 3;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * k;
      const dy = (at(x, y + 1) - at(x, y - 1)) * k;
      const len = Math.hypot(dx, dy, 1);
      const nx = -dx / len;
      const ny = -dy / len;
      const nz = 1 / len;
      const shade = Math.min(1.35, Math.max(0.55, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / LIGHT[2]));
      let c = scale(colours[y * SIZE + x], shade);
      if (recipe.shadowTint && shade < 1) c = mix(c, recipe.shadowTint, (1 - shade) * 0.9);
      const i = (y * SIZE + x) * 3;
      out[i] = Math.round(Math.min(255, Math.max(0, c[0])));
      out[i + 1] = Math.round(Math.min(255, Math.max(0, c[1])));
      out[i + 2] = Math.round(Math.min(255, Math.max(0, c[2])));
    }
  }
  return out;
}

/** Each texture tiled 2×2 at half resolution, so any seam would show in the sheet. */
function contactSheet(textures: Uint8Array[], cols: number): { width: number; height: number; rgb: Uint8Array } {
  const rows = Math.ceil(textures.length / cols);
  const width = cols * SIZE;
  const height = rows * SIZE;
  const rgb = new Uint8Array(width * height * 3);
  textures.forEach((tex, t) => {
    const ox = (t % cols) * SIZE;
    const oy = Math.floor(t / cols) * SIZE;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const sx = (x * 2) % SIZE;
        const sy = (y * 2) % SIZE;
        const src = (sy * SIZE + sx) * 3;
        const dst = ((oy + y) * width + ox + x) * 3;
        rgb[dst] = tex[src];
        rgb[dst + 1] = tex[src + 1];
        rgb[dst + 2] = tex[src + 2];
      }
    }
  });
  return { width, height, rgb };
}

const RECIPES: Recipe[] = [
  grass(),
  forestFloor(),
  taiga(),
  swamp(),
  desert(),
  beach(),
  hills(),
  rock(),
  snow(),
  water('ocean', 1001, ['#10283D', '#163552', '#1D4566', '#255579'], '#5C93B8'),
  water('shallows', 1002, ['#2A5868', '#336879', '#3F7A89', '#4E8C98'], '#8EC0C6'),
  water('lake', 1003, ['#1F4659', '#28576B', '#336980', '#427C92'], '#7FB2C6'),
  road(),
  cobble(),
  earthSide(),
  rockSide(),
];

const outDir = path.resolve(process.argv[2] ?? 'public/textures/terrain');
fs.mkdirSync(outDir, { recursive: true });
const rendered: Uint8Array[] = [];
for (const recipe of RECIPES) {
  const started = Date.now();
  const rgb = render(recipe);
  rendered.push(rgb);
  fs.writeFileSync(path.join(outDir, `${recipe.name}.png`), encodePng(SIZE, SIZE, rgb));
  console.log(`${recipe.name.padEnd(12)} ${Date.now() - started} ms`);
}
const sheetPath = process.env.TEXTURE_SHEET;
if (sheetPath) {
  const sheet = contactSheet(rendered, 4);
  fs.writeFileSync(sheetPath, encodePng(sheet.width, sheet.height, sheet.rgb));
  console.log(`contact sheet → ${sheetPath}`);
}
