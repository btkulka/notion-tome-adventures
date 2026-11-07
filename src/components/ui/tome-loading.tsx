import React, { useState } from 'react';

/** Matches .t-diamond--busy in styles/tome.css. */
const WANE_MS = 1400;

/**
 * The waning diamond, in step with every other one on the page. A loader that
 * replaces another (a route's, then the page's own) picks up the same beat
 * rather than restarting it, so the handover doesn't blink.
 */
export function BusyDiamond({ style }: { style?: React.CSSProperties }) {
  const [delay] = useState(() => -(performance.now() % WANE_MS));
  return <i className="t-diamond t-diamond--busy" style={{ ...style, animationDelay: `${delay}ms` }} />;
}

/** A waning diamond and a line saying what is on its way. */
export function Loading({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span role="status" className={`t-loading ${className}`}>
      <BusyDiamond />
      {label}
    </span>
  );
}

/** A block standing in for content that hasn't arrived; size it with classes. */
export function Shimmer({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <span aria-hidden="true" className={`t-skel ${className}`} style={style} />;
}
