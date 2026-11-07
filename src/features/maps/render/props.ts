/**
 * Where trees, rocks, settlements and landmarks stand. Derived from the terrain,
 * the pins and the roads with a seeded hash rather than stored, so every client
 * places them identically and editing a biome reflows its props for free.
 *
 * Models come from the catalog (Blender-built, see scripts/models); a group like
 * 'oak' picks one of its variants per prop.
 */
import { hash2 } from '../gen/prng';
import { STEP_HEIGHT } from '../constants';
import { Biome, isWater, type BiomeId } from '../terrain/biomes';
import { DIRECTIONS } from '../terrain/roads';
import type { PinType, TerrainGrid } from '../types';
import { variantsOf, type ModelName } from './catalog';
import { groundHeight, type TileBounds } from './geometry';

export interface Placement {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  /** Tile whose fog hides the prop. */
  tile: number;
}

export type PropPlacements = Partial<Record<ModelName, Placement[]>>;

/** A pin that stands on the map as a model. */
export interface Site {
  x: number;
  y: number;
  pinType: PinType;
}

interface Scatter {
  group: string;
  /** Expected count per tile; the fraction is a chance. */
  perTile: number;
  /** Only on tiles where this holds. */
  when?: (near: (biome: BiomeId) => boolean) => boolean;
}

const SCATTER: Partial<Record<BiomeId, Scatter[]>> = {
  [Biome.Grassland]: [{ group: 'shrub', perTile: 0.6 }, { group: 'oak', perTile: 0.22 }, { group: 'boulder', perTile: 0.1 }],
  [Biome.Forest]: [
    { group: 'oak', perTile: 2.6 }, { group: 'fir', perTile: 0.4 }, { group: 'fern', perTile: 0.5 },
    { group: 'shrub', perTile: 0.4 }, { group: 'mossrock', perTile: 0.1 },
  ],
  [Biome.Taiga]: [{ group: 'fir', perTile: 3 }, { group: 'mossrock', perTile: 0.3 }, { group: 'shrub', perTile: 0.2 }],
  [Biome.Jungle]: [{ group: 'jungle', perTile: 1.6 }, { group: 'palm', perTile: 1.2 }, { group: 'fern', perTile: 1.6 }],
  [Biome.Swamp]: [{ group: 'cypress', perTile: 0.9 }, { group: 'snag', perTile: 0.35 }, { group: 'reeds', perTile: 2 }],
  [Biome.Desert]: [{ group: 'scrub', perTile: 0.45 }, { group: 'thorn', perTile: 0.12 }, { group: 'hoodoo', perTile: 0.1 }],
  [Biome.Beach]: [
    { group: 'searock', perTile: 0.18 },
    // Palms only on warm coasts.
    { group: 'palm', perTile: 0.3, when: (near) => near(Biome.Jungle) || near(Biome.Desert) },
  ],
  [Biome.Hills]: [{ group: 'boulder', perTile: 0.5 }, { group: 'shrub', perTile: 0.5 }, { group: 'oak', perTile: 0.18 }],
  [Biome.Mountain]: [{ group: 'crag', perTile: 0.7 }, { group: 'pine', perTile: 0.45 }],
  [Biome.Snow]: [{ group: 'snowfir', perTile: 0.35 }, { group: 'icerock', perTile: 0.3 }],
};

/** Ancient giants: a rare tile holds one alone, with only undergrowth around it. */
const ELDER: Partial<Record<BiomeId, { group: string; chance: number }>> = {
  [Biome.Forest]: { group: 'elderoak', chance: 0.012 },
  [Biome.Taiga]: { group: 'elderfir', chance: 0.012 },
};

/** Groups big enough to share out a tile's space; the rest scatter freely beneath them. */
const LARGE = new Set(['oak', 'fir', 'snowfir', 'pine', 'jungle', 'palm', 'cypress', 'snag', 'thorn', 'hoodoo', 'crag', 'elderoak', 'elderfir']);

/** Settlement architecture by the biome it stands in. */
const CULTURE: Partial<Record<BiomeId, string>> = {
  [Biome.Taiga]: 'north',
  [Biome.Snow]: 'north',
  [Biome.Mountain]: 'north',
  [Biome.Desert]: 'desert',
  [Biome.Swamp]: 'marsh',
  [Biome.Jungle]: 'marsh',
};

const SETTLEMENT_TYPES: ReadonlySet<PinType> = new Set(['village', 'town', 'city', 'castle']);

export const isSettlement = (pinType: PinType) => SETTLEMENT_TYPES.has(pinType);

/** Scenery landmarks by biome, in order of preference when a spot doesn't suit the first. */
const LANDMARKS: Partial<Record<BiomeId, ModelName[]>> = {
  [Biome.Grassland]: ['stones-1', 'ruin-colonnade', 'monolith-1'],
  [Biome.Forest]: ['elfspire-1', 'ruin-colonnade', 'stones-2'],
  [Biome.Taiga]: ['stones-2', 'ruin-tower'],
  [Biome.Jungle]: ['temple-1', 'ruin-head'],
  [Biome.Swamp]: ['ruin-tower', 'stones-2'],
  [Biome.Desert]: ['bones-1', 'ruin-arch', 'ruin-head'],
  [Biome.Beach]: ['bones-1'],
  [Biome.Hills]: ['stones-1', 'stones-2', 'ruin-tower'],
  [Biome.Mountain]: ['dwarfgate-1', 'bones-1'],
  [Biome.Snow]: ['bones-1', 'stones-2'],
};

/** One landmark chance per cell of this many tiles a side keeps them spread out. */
const LANDMARK_CELL = 11;
const LANDMARK_CHANCE = 0.55;

/** The dwarven gate's flat back sits this far behind its origin (see scripts/models/landmarks.py). */
const GATE_BACK = 0.12;

/** Model a pin stands as, or null for pins that are only labels. */
export function modelForSite(pinType: PinType, biome: number, pick: number): ModelName | null {
  if (isSettlement(pinType)) return `${pinType}-${CULTURE[biome as BiomeId] ?? 'temperate'}` as ModelName;
  const choose = (names: ModelName[]) => names[Math.floor(pick * names.length)];
  switch (pinType) {
    case 'ruin':
      return biome === Biome.Desert ? choose(['ruin-arch', 'ruin-head']) : biome === Biome.Jungle ? 'ruin-head' : choose(['ruin-tower', 'ruin-colonnade']);
    case 'dungeon':
      return 'dungeon-1';
    case 'cave':
      return 'cave-1';
    case 'tower':
      return 'wizardtower-1';
    case 'shrine':
      return 'shrine-1';
    case 'camp':
      return 'camp-1';
    case 'landmark':
      return 'monolith-1';
    default:
      return null;
  }
}

export interface PropOptions {
  roads?: Uint8Array;
  rivers?: Uint8Array;
  sites?: Site[];
}

export function placeProps(terrain: TerrainGrid, seed: number, options: PropOptions = {}): PropPlacements {
  return placePropsInBlocks(terrain, seed, options, [{ x0: 0, y0: 0, x1: terrain.width, y1: terrain.height }])[0];
}

/**
 * Props for some blocks of tiles (render chunks), one result per block. Pins,
 * landmarks and waystones are sited across the whole map first, since they
 * claim tiles the scatter then avoids; only the scatter is limited to the blocks.
 */
export function placePropsInBlocks(terrain: TerrainGrid, seed: number, options: PropOptions, blocks: TileBounds[]): PropPlacements[] {
  const results: PropPlacements[] = blocks.map(() => ({}));
  const { width: W, height: H, biomes, heights } = terrain;
  const roads = options.roads;
  const rivers = options.rivers;
  const occupied = new Set<number>();
  const rnd = (x: number, y: number, salt: number) => hash2(x, y, seed + salt);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  // Which block (if any) each tile belongs to.
  const blockOf = new Int16Array(W * H).fill(-1);
  blocks.forEach((b, n) => {
    for (let y = Math.max(0, b.y0); y < Math.min(H, b.y1); y++) for (let x = Math.max(0, b.x0); x < Math.min(W, b.x1); x++) blockOf[y * W + x] = n;
  });

  const put = (name: ModelName, fx: number, fy: number, tile: number, scale: number, rotation: number) => {
    const n = blockOf[tile];
    if (n < 0) return;
    (results[n][name] ??= []).push({ x: fx, y: fy, z: groundHeight(terrain, fx, fy), scale, rotation, tile });
  };

  // 1. Pins that stand as models: settlements, ruins, towers, camps...
  for (const site of options.sites ?? []) {
    const { x, y } = site;
    if (!inside(x, y)) continue;
    const i = y * W + x;
    const name = modelForSite(site.pinType, biomes[i], rnd(x, y, 3));
    if (!name || occupied.has(i)) continue;
    occupied.add(i);
    put(name, x + 0.5, y + 0.5, i, 1, (Math.PI / 2) * Math.floor(rnd(x, y, 5) * 4));
  }

  // 2. Scenery landmarks, one chance per cell.
  for (let cy = 0; cy < H; cy += LANDMARK_CELL) {
    for (let cx = 0; cx < W; cx += LANDMARK_CELL) {
      if (rnd(cx, cy, 101) >= LANDMARK_CHANCE) continue;
      const x = Math.min(W - 1, cx + Math.floor(rnd(cx, cy, 103) * LANDMARK_CELL));
      const y = Math.min(H - 1, cy + Math.floor(rnd(cx, cy, 107) * LANDMARK_CELL));
      const i = y * W + x;
      if (isWater(biomes[i]) || occupied.has(i) || roads?.[i] || rivers?.[i]) continue;
      for (const name of LANDMARKS[biomes[i] as BiomeId] ?? []) {
        if (name === 'dwarfgate-1') {
          if (placeGate(x, y)) break;
          continue;
        }
        if (name === 'elfspire-1' && !surrounded(x, y, [Biome.Forest])) continue;
        occupied.add(i);
        put(name, x + 0.5, y + 0.5, i, 1, (Math.PI / 2) * Math.floor(rnd(x, y, 109) * 4));
        break;
      }
    }
  }

  // 3. Waystones and shrines beside the roads.
  if (roads) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!roads[i] || rivers?.[i] || occupied.has(i)) continue;
        const roll = rnd(x, y, 211);
        const name: ModelName | null = roll < 0.012 ? 'shrine-1' : roll < 0.06 ? 'waystone-1' : null;
        if (!name) continue;
        // Stand on a side of the tile the road doesn't leave by, facing the road.
        const start = Math.floor(rnd(x, y, 213) * 8);
        for (let k = 0; k < 8; k++) {
          const d = (start + k) % 8;
          if (roads[i] & (1 << d)) continue;
          const [dx, dy] = DIRECTIONS[d];
          const len = Math.hypot(dx, dy);
          put(name, x + 0.5 + (dx / len) * 0.32, y + 0.5 + (dy / len) * 0.32, i, 1, Math.atan2(-dx, -dy));
          break;
        }
      }
    }
  }

  // 4. Trees, rocks and undergrowth, inside the blocks only.
  for (const block of blocks) {
    for (let y = Math.max(0, block.y0); y < Math.min(H, block.y1); y++) for (let x = Math.max(0, block.x0); x < Math.min(W, block.x1); x++) {
      const i = y * W + x;
      const biome = biomes[i] as BiomeId;
      if (isWater(biome) || occupied.has(i) || roads?.[i] || rivers?.[i]) continue;
      const near = (b: BiomeId) => DIRECTIONS.some(([dx, dy]) => inside(x + dx, y + dy) && biomes[(y + dy) * W + x + dx] === b);
      let salt = 0;
      const items: string[] = [];
      const elder = ELDER[biome];
      const isElder = elder !== undefined && rnd(x, y, 307) < elder.chance;
      for (const s of SCATTER[biome] ?? []) {
        if (s.when && !s.when(near)) continue;
        if (isElder && LARGE.has(s.group)) continue;
        const whole = Math.floor(s.perTile);
        const count = whole + (rnd(x, y, 97 * ++salt) < s.perTile - whole ? 1 : 0);
        for (let n = 0; n < count; n++) items.push(s.group);
      }

      const large = items.filter((g) => LARGE.has(g));
      const grid = Math.max(1, Math.ceil(Math.sqrt(large.length)));
      const cells = Array.from({ length: grid * grid }, (_, k) => k).sort((a, b) => rnd(x, y, 401 + a) - rnd(x, y, 401 + b));
      let cell = 0;
      const place = (group: string, fx: number, fy: number) => {
        const variants = variantsOf(group);
        const name = variants[Math.floor(rnd(x, y, 13 * ++salt) * variants.length)];
        const scale = (LARGE.has(group) ? 0.85 + rnd(x, y, 19 * ++salt) * 0.3 : 0.8 + rnd(x, y, 19 * ++salt) * 0.45);
        put(name, x + fx, y + fy, i, scale, rnd(x, y, 23 * ++salt) * Math.PI * 2);
      };
      if (isElder) place(elder.group, 0.5 + (rnd(x, y, 311) - 0.5) * 0.15, 0.5 + (rnd(x, y, 313) - 0.5) * 0.15);
      for (const group of items) {
        if (LARGE.has(group)) {
          const c = cells[cell++ % cells.length];
          const span = 0.84 / grid;
          place(group, 0.08 + ((c % grid) + 0.2 + rnd(x, y, 17 * ++salt) * 0.6) * span, 0.08 + (Math.floor(c / grid) + 0.2 + rnd(x, y, 29 * ++salt) * 0.6) * span);
        } else {
          place(group, 0.12 + rnd(x, y, 31 * ++salt) * 0.76, 0.12 + rnd(x, y, 37 * ++salt) * 0.76);
        }
      }
    }
  }
  return results;

  function surrounded(x: number, y: number, allowed: BiomeId[]) {
    return DIRECTIONS.every(([dx, dy]) => inside(x + dx, y + dy) && allowed.includes(biomes[(y + dy) * W + x + dx] as BiomeId));
  }

  /**
   * A dwarven gate at the foot of a cliff: on the lower neighbour of mountain
   * tile (x, y), its back against the shared edge, facing away from the peak.
   */
  function placeGate(x: number, y: number): boolean {
    for (const d of [0, 2, 4, 6]) {
      const [dx, dy] = DIRECTIONS[d];
      const nx = x - dx;
      const ny = y - dy;
      if (!inside(nx, ny)) continue;
      const n = ny * W + nx;
      if (isWater(biomes[n]) || occupied.has(n) || roads?.[n] || rivers?.[n]) continue;
      // Two steps of cliff (0.6) hide the gate's rock mass.
      if ((heights[y * W + x] - heights[n]) * STEP_HEIGHT < 0.55) continue;
      occupied.add(n);
      put('dwarfgate-1', nx + 0.5 + dx * (0.5 - GATE_BACK), ny + 0.5 + dy * (0.5 - GATE_BACK), n, 1, Math.atan2(-dx, -dy));
      return true;
    }
    return false;
  }
}
