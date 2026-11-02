/** World units per tile edge. An overworld tile is one mile; a local cell is 5 ft. */
export const TILE_SIZE = 1;

/** World height of one elevation step. */
export const STEP_HEIGHT = 0.2;

/** Highest elevation step a tile can have. */
export const MAX_STEP = 20;

/** Ocean surface step. The lowest land sits one step above it. */
export const SEA_STEP = 4;

/** Overworld default size, in tiles. */
export const DEFAULT_OVERWORLD_SIZE = 64;

/** Largest overworld either side, in tiles. Keeps instanced draws and payloads small. */
export const MAX_OVERWORLD_SIZE = 128;
