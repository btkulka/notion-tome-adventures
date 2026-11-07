/**
 * Every model in public/models/world-props.glb, built in Blender by
 * scripts/models (npm run models). Names are '<group>-<variant>'; each also has
 * a far-zoom version '<name>_lo'. The catalog test checks the GLB against this
 * list, so a model renamed on one side fails the build instead of vanishing.
 */
export const MODELS_URL = '/models/world-props.glb';

export const MODEL_NAMES = [
  // Trees
  'fir-1', 'fir-2', 'fir-3', 'elderfir-1', 'snowfir-1', 'snowfir-2', 'pine-1', 'pine-2',
  'oak-1', 'oak-2', 'oak-3', 'elderoak-1', 'jungle-1', 'jungle-2', 'palm-1', 'palm-2',
  'cypress-1', 'cypress-2', 'snag-1', 'snag-2', 'thorn-1', 'thorn-2',
  // Ground cover and rocks
  'shrub-1', 'shrub-2', 'shrub-3', 'scrub-1', 'scrub-2', 'reeds-1', 'reeds-2', 'fern-1', 'fern-2',
  'boulder-1', 'boulder-2', 'boulder-3', 'mossrock-1', 'mossrock-2', 'crag-1', 'crag-2', 'crag-3',
  'hoodoo-1', 'hoodoo-2', 'searock-1', 'searock-2', 'icerock-1', 'icerock-2',
  // Settlements: <size>-<culture>
  'village-temperate', 'town-temperate', 'city-temperate', 'castle-temperate',
  'village-north', 'town-north', 'city-north', 'castle-north',
  'village-desert', 'town-desert', 'city-desert', 'castle-desert',
  'village-marsh', 'town-marsh', 'city-marsh', 'castle-marsh',
  // Landmarks and pin markers
  'stones-1', 'stones-2', 'monolith-1', 'ruin-colonnade', 'ruin-arch', 'ruin-head', 'ruin-tower',
  'dwarfgate-1', 'elfspire-1', 'bones-1', 'waystone-1', 'shrine-1', 'dungeon-1', 'cave-1',
  'wizardtower-1', 'camp-1', 'temple-1', 'banner-1',
] as const;

export type ModelName = (typeof MODEL_NAMES)[number];

const byGroup = new Map<string, ModelName[]>();
for (const name of MODEL_NAMES) {
  const group = name.slice(0, name.lastIndexOf('-'));
  byGroup.set(group, [...(byGroup.get(group) ?? []), name]);
}

/** All variants of a group, e.g. 'fir' → fir-1, fir-2, fir-3. */
export function variantsOf(group: string): ModelName[] {
  const variants = byGroup.get(group);
  if (!variants) throw new Error(`No models in group '${group}'`);
  return variants;
}

/** Far-zoom version of a model inside the GLB. */
export const farName = (name: ModelName) => `${name}_lo`;
