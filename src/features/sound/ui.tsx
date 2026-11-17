// Small pieces the jukebox screens share: icons, the equaliser, sliders, a switch, artwork.
import React, { useEffect, useRef, useState } from 'react';
import type { SoundRef } from './jukebox';
import { youTubeThumb } from './youtube';

/** Square-capped strokes, like the suite's rail icons. Filled shapes pass `fill`. */
export const ICONS = {
  play: 'M7 4.5 19.5 12 7 19.5z',
  pause: 'M6.5 4.5h3.8v15H6.5z M13.7 4.5h3.8v15h-3.8z',
  next: 'M5 5l9.5 7L5 19z M16.5 5h2.5v14h-2.5z',
  prev: 'M19 5l-9.5 7L19 19z M5 5h2.5v14H5z',
  stop: 'M6 6h12v12H6z',
  loop: 'M4 10V7h14l-3-3 M20 14v3H6l3 3',
  speaker: 'M4 9h4l5-4v14l-5-4H4z M16.5 9.5a3.5 3.5 0 0 1 0 5 M19 7a7 7 0 0 1 0 10',
  muted: 'M4 9h4l5-4v14l-5-4H4z M16 9.5l5 5 M21 9.5l-5 5',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6 6 18',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
  note: 'M9 17V5l10-2v12 M6 14.5l3 3-3 3-3-3z M16 12.5l3 3-3 3-3-3z',
  audition: 'M8 5l11 7-11 7z',
  more: 'M5 10.5l1.5 1.5L5 13.5 3.5 12z M12 10.5l1.5 1.5-1.5 1.5-1.5-1.5z M19 10.5l1.5 1.5-1.5 1.5-1.5-1.5z',
  chevron: 'M6 9l6 6 6-6',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  save: 'M5 3h11l3 3v15H5z M8 3v6h8V3 M8 21v-6h8v6',
  shuffle: 'M3 7h4l9 10h5 M3 17h4l2.6-3 M13.4 10 16 7h5 M18.5 4.5 21 7l-2.5 2.5 M18.5 14.5 21 17l-2.5 2.5',
  library: 'M4 4h4v16H4z M10 4h4v16h-4z M16.2 5.2l3.4-.9 3.4 14.6-3.4.9z',
  queue: 'M4 6h12 M4 11h12 M4 16h7 M17 14v6 M14 17h6',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
} as const;

const FILLED = new Set<keyof typeof ICONS>(['play', 'pause', 'next', 'prev', 'stop', 'more', 'bolt']);

export function Icon({ name, size = 18, className }: { name: keyof typeof ICONS; size?: number; className?: string }) {
  const filled = FILLED.has(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Eq({ on, className = '' }: { on: boolean; className?: string }) {
  return (
    <span className={`ts-eq ${on ? 'ts-eq--on' : ''} ${className}`} aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

/** A sound's picture: the video still for YouTube, a gilt note for a file. */
export function SoundArt({ sound, className = 'ts-thumb', size = 18 }: { sound: SoundRef; className?: string; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (sound.source.kind === 'youtube' && !broken) {
    return (
      <span className={className}>
        <img key={sound.source.videoId} src={youTubeThumb(sound.source.videoId)} alt="" loading="lazy" onError={() => setBroken(true)} />
      </span>
    );
  }
  return <span className={className}><Icon name="note" size={size} /></span>;
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="ts-switch" onClick={() => onChange(!checked)} />;
}

/**
 * A 0–1 slider that answers at once under the finger and tells the table at a
 * steady trickle, then keeps showing the value it sent until the table's echo
 * catches up (so it never snaps back mid-drag).
 */
export function Slider({ value, onChange, label, className = '', disabled, every = 90 }: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  className?: string;
  disabled?: boolean;
  every?: number;
}) {
  const [local, setLocal] = useState<number | null>(null);
  const lastSent = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout>>();
  const release = useRef<ReturnType<typeof setTimeout>>();
  const send = useRef(onChange);
  send.current = onChange;

  useEffect(() => {
    if (local !== null && Math.abs(value - local) < 0.006) setLocal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => {
    clearTimeout(trailing.current);
    clearTimeout(release.current);
  }, []);

  const change = (v: number) => {
    setLocal(v);
    clearTimeout(trailing.current);
    clearTimeout(release.current);
    const wait = every - (performance.now() - lastSent.current);
    const go = () => {
      lastSent.current = performance.now();
      send.current(v);
    };
    if (wait <= 0) go();
    else trailing.current = setTimeout(go, wait);
    // If the echo never matches (someone else moved it too), stop overriding after a moment.
    release.current = setTimeout(() => setLocal(null), 1500);
  };

  const shown = local ?? value;
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={shown}
      disabled={disabled}
      aria-label={label}
      aria-valuetext={`${Math.round(shown * 100)}%`}
      className={`ts-range ${className}`}
      style={{ '--fill': `${shown * 100}%` } as React.CSSProperties}
      onChange={(e) => change(Number(e.target.value))}
    />
  );
}
