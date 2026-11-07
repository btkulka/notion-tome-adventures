import React, { useState } from 'react';
import { GLYPHS } from './glyphs';

/** An engraved line glyph (glyphs.ts). `draw` strokes it in when it mounts. */
export function Glyph({ name, size = 20, stroke = 1.6, draw = false, className = '' }: { name: string; size?: number; stroke?: number; draw?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" className={className}>
      <path d={GLYPHS[name] ?? GLYPHS.diamond} pathLength={1} className={draw ? 'db-draw' : undefined} />
    </svg>
  );
}

/**
 * A square picture for a row: the image when there is one and it loads, else the
 * row's glyph in a tier-tinted frame. Sized by the parent through `className`.
 */
export function Thumb({ src, glyph, tier, className = 'h-10 w-10' }: { src: string | null; glyph: string; tier?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const showImage = src && failed !== src;
  return (
    <span className={`db-thumb ${tier ? `tier-${tier}` : ''} ${className}`}>
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={loaded ? 'is-loaded' : ''}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(src)}
        />
      ) : (
        <Glyph name={glyph} size={18} draw />
      )}
    </span>
  );
}
