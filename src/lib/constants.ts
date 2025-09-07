import { 
  Globe, Trees, Mountain, Sun, Waves, Building, Castle, Landmark, Home,
  Crown, Shield, Sword, Heart, Scale, Skull, Star, Zap, Target, User, Users,
  Minimize, Maximize, Sparkles
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

// D&D Game Constants
export const DND_CONSTANTS = {
  ALIGNMENTS: [
    'Any', 'Lawful Good', 'Neutral Good', 'Chaotic Good', 
    'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
    'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
  ] as const,

  CREATURE_TYPES: [
    'Any', 'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 
    'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 
    'Ooze', 'Plant', 'Undead'
  ] as const,

  SIZES: ['Any', 'Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const,

  DEFAULT_ENVIRONMENTS: [
    { id: '1', name: 'Forest' },
    { id: '2', name: 'Dungeon' },
    { id: '3', name: 'Mountains' },
    { id: '4', name: 'Desert' },
    { id: '5', name: 'Swamp' },
    { id: '6', name: 'City' },
    { id: '7', name: 'Ruins' },
    { id: '8', name: 'Cave' }
  ] as const,

  SPELL_SCHOOLS: [
    'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 
    'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
  ] as const,

  DAMAGE_TYPES: [
    'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 
    'Slashing', 'Thunder'
  ] as const,

  ABILITY_SCORES: [
    'strength', 'dexterity', 'constitution', 
    'intelligence', 'wisdom', 'charisma'
  ] as const,

  ENCOUNTER_DIFFICULTIES: ['Easy', 'Medium', 'Hard', 'Deadly'] as const,

  DEFAULT_ENCOUNTER_PARAMS: {
    environment: 'Any',
    xpThreshold: 1000,
    maxMonsters: 6,
    alignment: 'Any',
    creatureType: 'Any',
    size: 'Any',
    minCR: 0,
    maxCR: 20
  } as const
} as const;

// Icon mappings for consistent UI
export const ICON_MAPPINGS = {
  environment: (name: string): LucideIcon => {
    const normalized = name.toLowerCase();
    if (normalized.includes('forest') || normalized.includes('wood')) return Trees;
    if (normalized.includes('mountain') || normalized.includes('hill')) return Mountain;
    if (normalized.includes('desert') || normalized.includes('sand')) return Sun;
    if (normalized.includes('swamp') || normalized.includes('marsh') || normalized.includes('bog')) return Waves;
    if (normalized.includes('city') || normalized.includes('town') || normalized.includes('urban')) return Building;
    if (normalized.includes('dungeon') || normalized.includes('castle') || normalized.includes('fortress')) return Castle;
    if (normalized.includes('ruin') || normalized.includes('ancient')) return Landmark;
    if (normalized.includes('cave') || normalized.includes('cavern') || normalized.includes('underground')) return Mountain;
    if (normalized === 'any') return Globe;
    return Home;
  },

  alignment: (name: string): LucideIcon => {
    const normalized = name.toLowerCase();
    if (normalized.includes('lawful good') || normalized === 'lg') return Crown;
    if (normalized.includes('lawful neutral') || normalized === 'ln') return Shield;
    if (normalized.includes('lawful evil') || normalized === 'le') return Sword;
    if (normalized.includes('neutral good') || normalized === 'ng') return Heart;
    if (normalized.includes('true neutral') || normalized === 'tn' || normalized === 'neutral') return Scale;
    if (normalized.includes('neutral evil') || normalized === 'ne') return Skull;
    if (normalized.includes('chaotic good') || normalized === 'cg') return Star;
    if (normalized.includes('chaotic neutral') || normalized === 'cn') return Zap;
    if (normalized.includes('chaotic evil') || normalized === 'ce') return Target;
    if (normalized === 'any') return Globe;
    return User;
  },

  creatureType: (name: string): LucideIcon => {
    const normalized = name.toLowerCase();
    if (normalized.includes('humanoid')) return Users;
    if (normalized.includes('beast')) return Heart;
    if (normalized.includes('dragon')) return Zap;
    if (normalized.includes('undead')) return Skull;
    if (normalized.includes('fiend')) return Target;
    if (normalized.includes('celestial')) return Star;
    if (normalized.includes('fey')) return Sparkles;
    if (normalized.includes('elemental')) return Mountain;
    if (normalized.includes('aberration')) return Zap;
    if (normalized.includes('construct')) return Shield;
    if (normalized.includes('giant')) return Crown;
    if (normalized.includes('monstrosity')) return Sword;
    if (normalized.includes('ooze')) return Waves;
    if (normalized.includes('plant')) return Trees;
    if (normalized === 'any') return Globe;
    return User;
  },

  size: (name: string): LucideIcon => {
    const normalized = name.toLowerCase();
    if (normalized.includes('tiny')) return Minimize;
    if (normalized.includes('small')) return User;
    if (normalized.includes('medium')) return Users;
    if (normalized.includes('large')) return Crown;
    if (normalized.includes('huge')) return Mountain;
    if (normalized.includes('gargantuan')) return Maximize;
    if (normalized === 'any') return Globe;
    return Users;
  }
} as const;

// UI Constants
export const UI_CONSTANTS = {
  FIELD_STYLES: "bg-transparent border-0 border-b-2 border-border rounded-none px-0 py-3 focus:border-primary focus:ring-0 focus:outline-none hover:bg-primary/5 focus:bg-primary/10 transition-all duration-200",
  
  SECTION_TITLE_STYLES: "text-sm font-semibold text-foreground uppercase tracking-wide border-b border-border pb-2",
  
  FIELD_LABEL_STYLES: "text-sm font-semibold text-foreground",

  LOADING_MESSAGES: {
    ENVIRONMENTS: "Loading environments...",
    CREATURES: "Loading creatures...",
    GENERATING: "Rolling the Dice...",
    DISCOVERING: "Discovering..."
  } as const,

  ERROR_MESSAGES: {
    NOTION_CONFIG: "Configure Notion integration for custom data.",
    MISSING_PARAMS: "Please select an environment and set a valid XP threshold.",
    GENERATION_FAILED: "Failed to generate encounter. Check your Notion configuration."
  } as const
} as const;

// Type helpers
export type Alignment = typeof DND_CONSTANTS.ALIGNMENTS[number];
export type CreatureType = typeof DND_CONSTANTS.CREATURE_TYPES[number];
export type Size = typeof DND_CONSTANTS.SIZES[number];
export type EncounterDifficulty = typeof DND_CONSTANTS.ENCOUNTER_DIFFICULTIES[number];
export type AbilityScore = typeof DND_CONSTANTS.ABILITY_SCORES[number];
export type DamageType = typeof DND_CONSTANTS.DAMAGE_TYPES[number];
export type SpellSchool = typeof DND_CONSTANTS.SPELL_SCHOOLS[number];
