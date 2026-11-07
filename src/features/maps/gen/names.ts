/**
 * Seeded name generators for places, regions and rivers. The DM renames
 * anything freely, and linking a pin to a Notion Location uses that name.
 */
import { Biome, type BiomeId } from '../terrain/biomes';
import type { PinType } from '../types';

const STARTS = [
  'Ash', 'Bar', 'Bel', 'Bram', 'Cal', 'Dun', 'El', 'Fen', 'Gar', 'Hal', 'Har', 'Kel', 'Lor', 'Mar',
  'Mor', 'Nor', 'Oak', 'Pen', 'Quel', 'Raven', 'Red', 'Ros', 'Stone', 'Thorn', 'Tor', 'Val', 'Wil', 'Wyn',
];
const MIDDLES = ['', '', '', 'a', 'e', 'i', 'o', 'an', 'en', 'er', 'il', 'or'];
const ENDS = [
  'bury', 'brook', 'by', 'dale', 'den', 'ford', 'gate', 'hall', 'ham', 'helm', 'hold', 'holm', 'mere',
  'moor', 'mouth', 'reach', 'ridge', 'stead', 'ton', 'vale', 'wick', 'wood', 'watch', 'well',
];

/** First halves of compound names: the Gloamwood, the Greyspine. */
const COMPOUND = [
  'Ash', 'Black', 'Bone', 'Briar', 'Dark', 'Dusk', 'Elder', 'Ember', 'Frost', 'Gloam', 'Gold', 'Grey',
  'Hollow', 'Iron', 'Mirk', 'Mist', 'Pale', 'Raven', 'Red', 'Shadow', 'Silver', 'Storm', 'Thorn', 'Witch', 'Wolf', 'Wyrm',
];

/** Adjectives that stand alone: the Whispering Fen, the Sunken Sea. */
const ADJECTIVES = [
  'Ashen', 'Bitter', 'Broken', 'Drowned', 'Fallen', 'Forgotten', 'Golden', 'Grey', 'Hollow', 'Howling', 'Pale',
  'Red', 'Shattered', 'Shrouded', 'Silent', 'Sunken', 'Whispering', 'Withered', 'Black', 'Weeping',
];

type Form = (c: string, a: string, n: string) => string;

const REGION_FORMS: Record<BiomeId, Form[]> = {
  [Biome.Ocean]: [(_c, a) => `the ${a} Sea`, (_c, _a, n) => `the Sea of ${n}`, (c) => `the ${c}water Sea`],
  [Biome.Shallows]: [(_c, _a, n) => `${n} Bay`, (_c, a) => `the ${a} Shoals`],
  [Biome.Lake]: [(_c, _a, n) => `Lake ${n}`, (_c, _a, n) => `${n} Mere`, (c) => `the ${c}water`],
  [Biome.Beach]: [(_c, a) => `the ${a} Strand`, (_c, _a, n) => `${n} Shore`],
  [Biome.Grassland]: [(_c, _a, n) => `the ${n} Plains`, (_c, a) => `the ${a} Steppe`, (_c, _a, n) => `the ${n} Downs`, (_c, a) => `the ${a} Fields`],
  [Biome.Forest]: [(c) => `the ${c}wood`, (_c, a) => `the ${a} Wood`, (_c, _a, n) => `${n} Forest`, (_c, a) => `the ${a} Weald`],
  [Biome.Taiga]: [(c) => `the ${c}pines`, (_c, a) => `the ${a} Pinewood`, (_c, _a, n) => `${n} Firwood`],
  [Biome.Jungle]: [(_c, a) => `the ${a} Tangle`, (_c, _a, n) => `the ${n} Jungle`, (c) => `the ${c}vine Wilds`],
  [Biome.Swamp]: [(_c, a) => `the ${a} Fen`, (_c, _a, n) => `${n} Mire`, (c) => `the ${c}marsh`, (_c, a) => `the ${a} Bogs`],
  [Biome.Desert]: [(_c, a) => `the ${a} Waste`, (_c, _a, n) => `the ${n} Sands`, (_c, a) => `the ${a} Expanse`, (c) => `the ${c}sand Barrens`],
  [Biome.Hills]: [(_c, _a, n) => `the ${n} Hills`, (c) => `the ${c}barrow Downs`, (_c, a) => `the ${a} Tors`],
  [Biome.Mountain]: [(c) => `the ${c}spine Mountains`, (_c, a) => `the ${a} Peaks`, (_c, _a, n) => `the ${n} Range`, (c) => `the ${c}crown Mountains`],
  [Biome.Snow]: [(_c, a) => `the ${a} Tundra`, (c) => `the ${c}frost Wastes`, (_c, a) => `the ${a} Snows`],
};

const RIVER_FORMS: Form[] = [
  (_c, _a, n) => `the River ${n}`,
  (c) => `the ${c}water`,
  (c) => `the ${c}brook`,
  (_c, _a, n) => `the ${n} Run`,
  (c) => `the ${c}rush`,
];

const ROAD_FORMS: Form[] = [
  (_c, _a, n) => `the ${n} Road`,
  (c) => `the ${c}stone Way`,
  (_c, _a, n) => `the Old ${n} Road`,
  (_c, a) => `the ${a} Road`,
  (_c, _a, n) => `${n} Way`,
];

/** Wrappers for pins that aren't settlements: Ruins of Ashford, Kelmere Tower. */
const PIN_FORMS: Partial<Record<PinType, ((n: string) => string)[]>> = {
  ruin: [(n) => `Ruins of ${n}`, (n) => `Old ${n}`],
  dungeon: [(n) => `the ${n} Deeps`, (n) => `Vaults of ${n}`],
  cave: [(n) => `${n} Caves`, (n) => `the ${n} Hollow`],
  tower: [(n) => `${n} Tower`, (n) => `the Spire of ${n}`],
  shrine: [(n) => `Shrine of ${n}`, (n) => `${n} Chapel`],
  camp: [(n) => `${n} Camp`],
  landmark: [(n) => `the ${n} Stone`, (n) => `${n} Cairn`],
};

export function placeName(rand: () => number, taken: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = pick(STARTS, rand) + pick(MIDDLES, rand) + pick(ENDS, rand);
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const numbered = `${pick(STARTS, rand)}${pick(ENDS, rand)} ${taken.size + 1}`;
  taken.add(numbered);
  return numbered;
}

/** A name for a new pin of this kind. */
export function pinName(pinType: PinType, rand: () => number, taken: Set<string>): string {
  const forms = PIN_FORMS[pinType];
  const base = placeName(rand, taken);
  if (!forms) return base;
  const name = pick(forms, rand)(base);
  taken.add(name);
  return name;
}

/** A name for a region whose main biome is `biome`. */
export function regionName(biome: BiomeId, rand: () => number, taken: Set<string>): string {
  return fromForms(REGION_FORMS[biome] ?? REGION_FORMS[Biome.Grassland], rand, taken);
}

export function riverName(rand: () => number, taken: Set<string>): string {
  return fromForms(RIVER_FORMS, rand, taken);
}

export function roadName(rand: () => number, taken: Set<string>): string {
  return fromForms(ROAD_FORMS, rand, taken);
}

function fromForms(forms: Form[], rand: () => number, taken: Set<string>): string {
  let name = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    const n = pick(STARTS, rand) + pick(MIDDLES, rand) + pick(ENDS, rand);
    name = pick(forms, rand)(pick(COMPOUND, rand), pick(ADJECTIVES, rand), n);
    if (!taken.has(name)) break;
  }
  taken.add(name);
  return name;
}

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}
