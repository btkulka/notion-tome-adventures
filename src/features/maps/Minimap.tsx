import React, { useEffect, useRef } from 'react';
import { paintMinimap } from './paintMinimap';
import type { TerrainGrid } from './types';

/** A top-down painting of a region, cheap enough for library cards and generator previews. */
export function Minimap({ terrain, className, fade }: { terrain: TerrainGrid; className?: string; fade?: Float32Array | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) paintMinimap(ref.current, terrain, fade);
  }, [terrain, fade]);

  return <canvas ref={ref} className={className} style={{ imageRendering: 'pixelated' }} aria-hidden="true" />;
}
