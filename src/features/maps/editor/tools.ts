// The editor's tools, their keys and their cursors.
import { Biome, BIOMES, type BiomeId } from '../terrain/biomes';
import type { HeightMode } from '../editing';
import type { PinType } from '../types';

export type Tool = 'select' | 'height' | 'biome' | 'road' | 'river' | 'pin' | 'fog' | 'party' | 'measure';

/** Road and river tools: route or flow on their own, draw by hand, or erase. */
export type PathMode = 'auto' | 'draw' | 'erase';

export interface ToolDef {
  key: Tool;
  label: string;
  short: string;
  /** SVG path in a 24×24 box. */
  icon: string;
  /** Number key that picks it. */
  hotkey: string;
}

export const TOOLS: ToolDef[] = [
  { key: 'select', label: 'Select and move', short: 'Select', icon: 'M5 3l13 8-6 1.5L9 19z', hotkey: '1' },
  { key: 'height', label: 'Raise and lower ground', short: 'Height', icon: 'M3 20h18 M5 20l5-8 3 4 2-3 4 7', hotkey: '2' },
  { key: 'biome', label: 'Paint biome', short: 'Biome', icon: 'M4 20l4-12 4 6 3-4 5 10z', hotkey: '3' },
  { key: 'road', label: 'Lay a road', short: 'Road', icon: 'M8 3 5 21 M16 3l3 18 M12 5v2 M12 11v2 M12 17v2', hotkey: '4' },
  { key: 'river', label: 'Run a river', short: 'River', icon: 'M4 6c3 0 3 3 6 3s3-3 6-3 4 3 4 3 M4 13c3 0 3 3 6 3s3-3 6-3 4 3 4 3', hotkey: '5' },
  { key: 'pin', label: 'Place a pin', short: 'Pin', icon: 'M12 2l7 7-7 13-7-13z M12 6v6 M9 9h6', hotkey: '6' },
  { key: 'fog', label: 'Reveal or hide fog', short: 'Fog', icon: 'M4 14h16 M6 18h12 M5 10h7 M15 10h4 M8 6h8', hotkey: '7' },
  { key: 'party', label: 'Move the company', short: 'Party', icon: 'M6 21V4 M6 4h11l-3 4 3 4H6', hotkey: '8' },
  { key: 'measure', label: 'Measure distance', short: 'Measure', icon: 'M3 17 17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2', hotkey: '9' },
];

export const BRUSH_TOOLS: ReadonlySet<Tool> = new Set(['height', 'biome', 'fog']);

export const MAX_BRUSH = 8;

export const PAINTABLE: BiomeId[] = [
  Biome.Grassland, Biome.Forest, Biome.Taiga, Biome.Jungle, Biome.Swamp, Biome.Desert, Biome.Beach,
  Biome.Hills, Biome.Mountain, Biome.Snow, Biome.Lake, Biome.Shallows, Biome.Ocean,
];

/** Pins the DM places by hand (encounters are rolled at the table). */
export const PIN_TYPES: PinType[] = ['village', 'town', 'city', 'castle', 'ruin', 'dungeon', 'cave', 'tower', 'shrine', 'camp', 'landmark'];

/** Drag-and-drop payload type for a pin from the palette. */
export const PIN_DRAG_TYPE = 'application/x-tome-pin';

export const COLORS = {
  gilt: '#C4A35A',
  giltHi: '#DEC27F',
  bone: '#E6DDC8',
  road: '#DEC27F',
  river: '#8FC3E8',
  lower: '#7FA6D9',
  smooth: '#D6CFBE',
  flatten: '#C27838',
  reveal: '#E6DDC8',
  hide: '#8D6FBF',
  erase: '#D7766F',
};

/** What a brush does with Shift held: the opposite. */
export const invertHeight = (mode: HeightMode, shift: boolean): HeightMode => (!shift ? mode : mode === 'raise' ? 'lower' : mode === 'lower' ? 'raise' : mode);

export function brushColor(tool: Tool, opts: { heightMode: HeightMode; biome: BiomeId; fogMode: 'reveal' | 'hide'; shift: boolean }): string {
  if (tool === 'height') {
    const mode = invertHeight(opts.heightMode, opts.shift);
    return mode === 'raise' ? COLORS.giltHi : mode === 'lower' ? COLORS.lower : mode === 'smooth' ? COLORS.smooth : COLORS.flatten;
  }
  if (tool === 'biome') return BIOMES[opts.biome].top;
  if (tool === 'fog') return (opts.fogMode === 'reveal') !== opts.shift ? COLORS.reveal : COLORS.hide;
  return COLORS.giltHi;
}

// --- Cursors ----------------------------------------------------------------

const svgCursor = (svg: string, x: number, y: number, fallback: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>${svg}</svg>`)}") ${x} ${y}, ${fallback}`;

/** Traced twice, dark under light, so the mark reads on any ground. */
const inked = (d: string, color: string, width = 1.5) =>
  `<path d='${d}' fill='none' stroke='#0A0A0B' stroke-width='${width + 2.2}' stroke-linecap='square' stroke-linejoin='miter'/><path d='${d}' fill='none' stroke='${color}' stroke-width='${width}' stroke-linecap='square' stroke-linejoin='miter'/>`;

const reticle = (color: string) =>
  svgCursor(`${inked('M14 7 21 14 14 21 7 14Z', color)}${inked('M14 2v3 M14 23v3 M2 14h3 M23 14h3', color, 1.2)}<rect x='13' y='13' width='2' height='2' fill='${color}'/>`, 14, 14, 'crosshair');

export const CURSORS = {
  brush: (color: string) => reticle(color),
  pin: svgCursor(`${inked('M11 4 17 10 11 16 5 10Z M11 16v9', '#DEC27F')}${inked('M21 3v6 M18 6h6', '#E6DDC8', 1.4)}`, 11, 25, 'copy'),
  party: svgCursor(inked('M7 25V4 M7 4h14l-4 5 4 5H7', '#DEC27F'), 7, 25, 'pointer'),
  dropper: svgCursor(inked('M5 23l2-5 9-9 3 3-9 9z M16 9l2-2a2 2 0 0 1 3 3l-2 2', '#E6DDC8'), 5, 23, 'crosshair'),
  measure: 'crosshair',
};
