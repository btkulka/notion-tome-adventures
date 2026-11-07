import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { LabelObject, PinObject, PinType, TerrainGrid, TilePoint } from '../types';
import { groundHeight } from './geometry';
import { dragHandlers, type DragOptions, type Picker } from './drag';
import { propMaterial, usePropGeometry } from './models';

const GILT = '#C4A35A';
const GILT_HI = '#DEC27F';

const surfaceAt = (terrain: TerrainGrid, x: number, y: number) => groundHeight(terrain, x, y);

export type { DragOptions, Picker } from './drag';

/** Label height above the ground per pin type: just clear of the tallest model it can stand as (see props.ts). */
const LABEL_LIFT: Partial<Record<PinType, number>> = {
  village: 0.55,
  town: 0.65,
  city: 0.9,
  castle: 0.82,
  ruin: 0.8,
  dungeon: 0.42,
  cave: 0.55,
  tower: 1.1,
  shrine: 0.42,
  camp: 0.42,
  landmark: 0.6,
};

/** Square label plates over pins, in the Tome style. In the editor they drag to move the pin. */
export function PinLabels({
  terrain,
  pins,
  selectedId,
  isDm,
  onSelect,
  pick,
  onPinMove,
  onPinDrop,
}: {
  terrain: TerrainGrid;
  pins: PinObject[];
  selectedId?: string | null;
  isDm: boolean;
  onSelect?: (pin: PinObject) => void;
  pick?: Picker | null;
  onPinMove?: (pin: PinObject, tile: TilePoint) => void;
  onPinDrop?: (pin: PinObject, tile: TilePoint) => void;
}) {
  const interactive = Boolean(onSelect || onPinDrop);
  return (
    <group>
      {pins.map((pin) => {
        const h = surfaceAt(terrain, pin.x + 0.5, pin.y + 0.5);
        const selected = pin.id === selectedId;
        const handlers = dragHandlers({
          pick,
          onClick: () => onSelect?.(pin),
          onMove: onPinMove && ((tile) => onPinMove(pin, tile)),
          onDrop: onPinDrop && ((tile) => onPinDrop(pin, tile)),
        });
        return (
          <Html key={pin.id} position={[pin.x + 0.5, h + (LABEL_LIFT[pin.data.pinType] ?? 0.5), pin.y + 0.5]} center zIndexRange={[20, 0]} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
            <button
              type="button"
              {...handlers}
              title={onPinDrop ? 'Click to select · drag to move' : undefined}
              className="t-map-label flex items-center gap-2 whitespace-nowrap px-2.5 h-[24px] bg-[rgba(14,13,15,0.92)] font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-bone"
              style={{
                border: `1px solid ${selected ? GILT_HI : pin.hidden ? '#4E3E6E' : '#6E5A31'}`,
                opacity: pin.hidden ? 0.75 : 1,
                cursor: onPinDrop ? 'grab' : onSelect ? 'pointer' : 'default',
                touchAction: 'none',
              }}
            >
              <span className="t-diamond" style={{ width: 7, height: 7, background: selected ? GILT_HI : pin.hidden ? '#6D5A93' : GILT }} />
              {pin.data.name}
              {isDm && pin.hidden && <span className="font-text normal-case tracking-normal text-[11px] text-bone-3">hidden</span>}
            </button>
          </Html>
        );
      })}
    </group>
  );
}

/**
 * Region names lettered across the land, old-map style. They fade as the
 * camera closes in, where they would only crowd the view.
 */
export function RegionLabels({
  terrain,
  labels,
  sizes,
  selectedId,
  isDm,
  pick,
  onSelect,
  onLabelMove,
  onLabelDrop,
}: {
  terrain: TerrainGrid;
  labels: LabelObject[];
  /** Tiles in the region each label names, by label id; bigger regions letter larger. */
  sizes?: Map<string, number>;
  selectedId?: string | null;
  isDm: boolean;
  pick?: Picker | null;
  onSelect?: (label: LabelObject) => void;
  onLabelMove?: (label: LabelObject, tile: TilePoint) => void;
  onLabelDrop?: (label: LabelObject, tile: TilePoint) => void;
}) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const shown = useRef(-1);
  const layout = useRef({ at: 0, key: '' });
  const interactive = Boolean(onSelect || onLabelDrop);
  // Bigger regions claim their spot first.
  const order = useMemo(() => [...labels].sort((a, b) => (sizes?.get(b.id) ?? 0) - (sizes?.get(a.id) ?? 0)).map((l) => l.id), [labels, sizes]);
  useFrame(({ camera, clock }) => {
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    const opacity = Math.max(interactive ? 0.4 : 0, Math.min(1, (90 - zoom) / 40));
    if (Math.abs(opacity - shown.current) >= 0.01) {
      shown.current = opacity;
      nodes.current.forEach((el) => (el.style.opacity = String(opacity)));
    }
    // A few times a second while the view moves: names that would overlap a
    // place label or a bigger region's name step aside.
    const e = camera.matrixWorld.elements;
    const key = `${zoom.toFixed(2)}|${e[12].toFixed(2)}|${e[14].toFixed(2)}|${e[0].toFixed(3)}|${order.length}`;
    if (key === layout.current.key && clock.elapsedTime - layout.current.at < 1) return;
    if (clock.elapsedTime - layout.current.at < 0.12) return;
    layout.current = { at: clock.elapsedTime, key };
    const first = nodes.current.values().next().value as HTMLElement | undefined;
    const container = first?.closest('.t-map');
    const pad = 6;
    const taken: DOMRect[] = container ? [...container.querySelectorAll('.t-map-label')].map((n) => n.getBoundingClientRect()) : [];
    const clear = (r: DOMRect) => taken.every((t) => r.right + pad < t.left || r.left - pad > t.right || r.bottom + pad < t.top || r.top - pad > t.bottom);
    for (const id of order) {
      const el = nodes.current.get(id);
      const button = el?.querySelector('button');
      if (!el || !button) continue;
      const rect = button.getBoundingClientRect();
      const fits = opacity > 0 && (id === selectedId || clear(rect));
      el.style.visibility = fits ? 'visible' : 'hidden';
      if (fits) taken.push(rect);
    }
  });
  return (
    <group>
      {labels.map((label) => {
        const x = label.x + 0.5;
        const z = label.y + 0.5;
        const tiles = sizes?.get(label.id) ?? 30;
        const px = Math.round(Math.min(19, 11 + Math.sqrt(tiles) * 0.55) * (label.data.size || 1));
        const selected = label.id === selectedId;
        const handlers = dragHandlers({
          pick,
          onClick: () => onSelect?.(label),
          onMove: onLabelMove && ((tile) => onLabelMove(label, tile)),
          onDrop: onLabelDrop && ((tile) => onLabelDrop(label, tile)),
        });
        return (
          <Html key={label.id} position={[x, surfaceAt(terrain, x, z) + 0.15, z]} center zIndexRange={[10, 0]} style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
            <div
              ref={(el) => {
                if (el) {
                  nodes.current.set(label.id, el);
                  if (shown.current >= 0) el.style.opacity = String(shown.current);
                } else nodes.current.delete(label.id);
              }}
              className="flex flex-col items-center"
            >
              <button
                type="button"
                {...handlers}
                title={onLabelDrop ? 'Click to rename · drag onto the region it names' : undefined}
                className="t-region-label whitespace-nowrap font-display font-semibold uppercase bg-transparent border-0 p-0"
                style={{
                  fontSize: px,
                  letterSpacing: '0.3em',
                  color: selected ? GILT_HI : label.hidden ? '#A897C9' : 'rgba(236,228,210,0.9)',
                  textShadow: '0 1px 1px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.85)',
                  cursor: onLabelDrop ? 'grab' : onSelect ? 'pointer' : 'default',
                  touchAction: 'none',
                }}
              >
                {label.data.text}
              </button>
              {isDm && (selected || label.hidden) && (
                <span className="font-text text-[11px] tracking-normal normal-case" style={{ color: selected ? GILT : '#A897C9', textShadow: '0 1px 2px #000' }}>
                  {label.hidden ? 'hidden from players' : 'region name'}
                </span>
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
}

/** The company's banner (a Blender model, see scripts/models/landmarks.py) with a slow pulse. */
export function PartyBanner({ terrain, at, drag }: { terrain: TerrainGrid; at: TilePoint; drag?: DragOptions }) {
  const ring = useRef<THREE.LineLoop>(null);
  const banner = usePropGeometry()('banner-1');
  const x = at[0] + 0.5;
  const z = at[1] + 0.5;
  const y = surfaceAt(terrain, x, z);
  const ringGeometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0, 0, -0.5)]),
    []
  );
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const t = (clock.elapsedTime % 2.6) / 2.6;
    ring.current.scale.setScalar(0.6 + t * 1.1);
    (ring.current.material as THREE.LineBasicMaterial).opacity = 0.9 * (1 - t);
  });
  return (
    <group position={[x, y, z]}>
      <lineLoop ref={ring} geometry={ringGeometry} position={[0, 0.03, 0]}>
        <lineBasicMaterial color={GILT_HI} transparent />
      </lineLoop>
      {banner && <mesh geometry={banner} material={propMaterial} raycast={() => null} />}
      {/* Screen-sized marker so the company is findable at any zoom. */}
      <Html position={[0, 1.15, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: drag?.onDrop ? 'auto' : 'none' }}>
        <div className="flex flex-col items-center">
          <span
            {...(drag?.onDrop ? dragHandlers(drag) : {})}
            title={drag?.onDrop ? 'Drag to move the company' : undefined}
            className="t-map-label flex items-center gap-2 whitespace-nowrap px-2.5 h-[24px] bg-[rgba(14,13,15,0.94)] font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-gilt-hi"
            style={{ border: `1px solid ${GILT}`, cursor: drag?.onDrop ? 'grab' : undefined, touchAction: 'none' }}
          >
            <svg width="11" height="12" viewBox="0 0 24 24" fill="none" stroke={GILT_HI} strokeWidth="2.4" strokeLinecap="square" aria-hidden="true"><path d="M6 21V4 M6 4h11l-3 4 3 4H6" /></svg>
            The company
          </span>
          <span className="w-px h-2.5" style={{ background: GILT }} />
        </div>
      </Html>
    </group>
  );
}

const routePoints = (terrain: TerrainGrid, path: TilePoint[], lift: number) =>
  path.map(([x, y]) => new THREE.Vector3(x + 0.5, surfaceAt(terrain, x + 0.5, y + 0.5) + lift, y + 0.5));

/** Planned route: a dashed line through tile centres, with diamonds at camps and the destination. */
export function RouteLine({ terrain, path, stops = [], color = GILT_HI }: { terrain: TerrainGrid; path: TilePoint[]; stops?: number[]; color?: string }) {
  const points = useMemo(() => routePoints(terrain, path, 0.06), [terrain, path]);
  if (points.length < 2) return null;
  const marks = [...stops, path.length - 1].map((i) => points[i]).filter(Boolean);
  return (
    <group>
      <Line points={points} color={color} lineWidth={2.5} dashed dashSize={0.25} gapSize={0.18} />
      {marks.map((p, n) => (
        <mesh key={n} position={[p.x, p.y + 0.02, p.z]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
          <planeGeometry args={[0.22, 0.22]} />
          <meshBasicMaterial color={n === marks.length - 1 ? color : GILT} />
        </mesh>
      ))}
    </group>
  );
}

export interface PathTrace {
  points: TilePoint[];
  color: string;
}

/** Roads or rivers drawn over in a solid line: the one under the cursor, or the one selected. */
export function PathTraces({ terrain, traces }: { terrain: TerrainGrid; traces: PathTrace[] }) {
  return (
    <group>
      {traces.map((t, n) => (t.points.length > 1 ? <Line key={n} points={routePoints(terrain, t.points, 0.08)} color={t.color} lineWidth={3} /> : null))}
    </group>
  );
}

export interface Ping {
  id: string;
  x: number;
  y: number;
  color: string;
  /** performance.now() when it arrived. */
  at: number;
}

const PING_SECONDS = 2.6;

function PingMark({ terrain, ping }: { terrain: TerrainGrid; ping: Ping }) {
  const ref = useRef<THREE.LineLoop>(null);
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.5, 0, 0), new THREE.Vector3(0, 0, 0.5), new THREE.Vector3(-0.5, 0, 0), new THREE.Vector3(0, 0, -0.5)]),
    []
  );
  useFrame(() => {
    if (!ref.current) return;
    const t = ((performance.now() - ping.at) / 1000) % 1.3 / 1.3;
    ref.current.scale.setScalar(0.4 + t * 1.6);
    (ref.current.material as THREE.LineBasicMaterial).opacity = 1 - t;
  });
  const y = surfaceAt(terrain, ping.x + 0.5, ping.y + 0.5) + 0.05;
  return (
    <group position={[ping.x + 0.5, y, ping.y + 0.5]}>
      <lineLoop ref={ref} geometry={geometry}>
        <lineBasicMaterial color={ping.color} transparent />
      </lineLoop>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.14, 0.14]} />
        <meshBasicMaterial color={ping.color} />
      </mesh>
    </group>
  );
}

export function Pings({ terrain, pings }: { terrain: TerrainGrid; pings: Ping[] }) {
  const now = performance.now();
  return (
    <group>
      {pings.filter((p) => now - p.at < PING_SECONDS * 1000).map((p) => (
        <PingMark key={p.id} terrain={terrain} ping={p} />
      ))}
    </group>
  );
}
