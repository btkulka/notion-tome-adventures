/** World units per tile edge. A region cell is a quarter mile (MILES_PER_CELL); a local cell is 5 ft. */
export const TILE_SIZE = 1;

/** Miles per cell on a region map. Stored per map as `MapDoc.scale`, so logic reads the map's own value. */
export const MILES_PER_CELL = 0.25;

/** World height of one elevation step. */
export const STEP_HEIGHT = 0.4;

/** Highest elevation step a tile can have. */
export const MAX_STEP = 20;

/** Ocean surface step. The lowest land sits one step above it. */
export const SEA_STEP = 4;

/**
 * Fine elevation units per step (`TerrainGrid.elevation`). The ground is drawn
 * from the fine value; travel, sight and editing read the whole step.
 */
export const ELEVATION_PER_STEP = 256;

/** Region default size, in cells (32 miles at a quarter mile each). */
export const DEFAULT_OVERWORLD_SIZE = 128;

/** Largest region either side, in cells (64 miles). Keeps instanced draws and payloads small. */
export const MAX_OVERWORLD_SIZE = 256;
