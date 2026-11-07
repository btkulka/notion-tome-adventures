import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Loading } from '@/components/ui/tome-loading';
import '../maps.css';
import { connectionMasks } from '../terrain/roads';
import { labelRegions, type RegionMap } from '../terrain/regions';
import { dayFraction } from '../travel/travel';
import type { LabelObject, MapObject, PathObject, PinObject, TerrainGrid, TilePoint } from '../types';
import { CameraRig, type CameraApi, type CameraPose, type GrabState } from './CameraRig';
import { groundHeight } from './geometry';
import { applyMarks, createOverlay, type TileMark } from './overlay';
import type { DragOptions, Picker } from './drag';
import { PartyBanner, PathTraces, PinLabels, Pings, RegionLabels, RouteLine, type PathTrace, type Ping } from './Overlays';
import { pickTile } from './pick';
import { isSettlement, type Site } from './props';
import { Props3D } from './Props3D';
import { Terrain } from './Terrain';
import type { FogMode } from './tint';

export type { Picker } from './drag';
export type { TileMark } from './overlay';

/** Modifier keys and where the pointer was, for tools that care. */
export interface TileEventInfo {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  clientX: number;
  clientY: number;
}

export interface MapViewProps {
  terrain: TerrainGrid;
  seed: number;
  objects: MapObject[];
  /** Per-tile fog fade (see vision/fog.ts); null shows everything. */
  fade?: Float32Array | null;
  fogMode?: FogMode;
  isDm?: boolean;
  party?: TilePoint | null;
  route?: TilePoint[] | null;
  routeStops?: number[];
  routeColor?: string;
  worldMinutes?: number | null;
  pings?: Ping[];
  selectedPinId?: string | null;
  selectedLabelId?: string | null;
  /** Tiles outlined in gilt. */
  highlight?: TilePoint[];
  /** Coloured tile sets washed and outlined on the ground; later marks win. */
  marks?: TileMark[];
  /** Roads or rivers drawn over in a solid line. */
  traces?: PathTrace[];
  /** Grid line strength, 0 (off) to 1. */
  grid?: number;
  showProps?: boolean;
  showRegionNames?: boolean;
  showPinLabels?: boolean;
  /** Regions, if the page already has them; otherwise worked out here. */
  regions?: RegionMap;
  /** CSS cursor over the map while not panning. */
  cursor?: string;
  /** 0: left-drag pans (players). 2: right-drag pans, left belongs to tools (editor). */
  panButton?: 0 | 2;
  cameraRef?: MutableRefObject<CameraApi | null>;
  /** Receives the screen → tile picker once the canvas is up. */
  pickRef?: MutableRefObject<Picker | null>;
  initialCamera?: Partial<CameraPose>;
  onCameraChange?: (pose: CameraPose) => void;
  /** The camera started or stopped being dragged. */
  onPanChange?: (panning: boolean) => void;
  /** A left-button stroke: down, drags across tiles, up. Only when the left button belongs to tools. */
  onTileDown?: (tile: TilePoint, info: TileEventInfo) => void;
  onTileDrag?: (tile: TilePoint, info: TileEventInfo) => void;
  onTileUp?: () => void;
  /** The tile under the pointer changed (null: off the map). */
  onTileHover?: (tile: TilePoint | null, info: TileEventInfo | null) => void;
  /** A left click that wasn't a drag. */
  onTileClick?: (tile: TilePoint, info: TileEventInfo) => void;
  onPinSelect?: (pin: PinObject) => void;
  onPinMove?: (pin: PinObject, tile: TilePoint) => void;
  onPinDrop?: (pin: PinObject, tile: TilePoint) => void;
  onLabelSelect?: (label: LabelObject) => void;
  onLabelMove?: (label: LabelObject, tile: TilePoint) => void;
  onLabelDrop?: (label: LabelObject, tile: TilePoint) => void;
  /** Lets the company's banner be dragged. */
  partyDrag?: Omit<DragOptions, 'pick'>;
  /** HTML drag and drop onto the map (e.g. a pin from a palette). */
  onDragOverTile?: (tile: TilePoint | null, e: DragEvent) => void;
  onDropTile?: (tile: TilePoint, e: DragEvent) => void;
  className?: string;
}

/** Light for the hour: warm day, amber low sun, cold moonlight. */
function lightFor(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return { sun: '#FFF1DA', sunIntensity: 1.7, sky: '#C9D3E0', ground: '#3B3024', ambient: 0.85, night: false };
  const hour = dayFraction(minutes) * 24;
  const height = Math.sin((Math.PI * (hour - 6)) / 14);
  if (hour < 5 || hour >= 21) return { sun: '#7A8DC4', sunIntensity: 0.45, sky: '#3A4466', ground: '#121018', ambient: 0.35, night: true };
  if (height < 0.35) return { sun: '#F0A660', sunIntensity: 1.05, sky: '#8C7F96', ground: '#2E2218', ambient: 0.55, night: false };
  return { sun: '#FFF1DA', sunIntensity: 1.7, sky: '#C9D3E0', ground: '#3B3024', ambient: 0.85, night: false };
}

/** Set once a map has finished loading its textures and models in this tab. */
let landLoaded = false;

/** Mounts only once the rest of its Suspense boundary has loaded, and says so. */
function Loaded({ onLoad }: { onLoad: () => void }) {
  useEffect(onLoad, [onLoad]);
  return null;
}

const info = (e: { shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean; clientX: number; clientY: number }): TileEventInfo => ({
  shift: e.shiftKey,
  alt: e.altKey,
  ctrl: e.ctrlKey || e.metaKey,
  clientX: e.clientX,
  clientY: e.clientY,
});

const sameTile = (a: TilePoint | null, b: TilePoint | null) => a === b || (a !== null && b !== null && a[0] === b[0] && a[1] === b[1]);

/**
 * Inside the canvas: turns screen points into tiles by walking the
 * heightfield (see pick.ts), and re-reports the hovered tile when the camera
 * moves under a still pointer.
 */
function TilePicker({ terrain, pickRef, pointer, onRepick }: { terrain: TerrainGrid; pickRef: MutableRefObject<Picker | null>; pointer: MutableRefObject<{ x: number; y: number } | null>; onRepick: () => void }) {
  const { camera, gl } = useThree();
  const origin = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const last = useMemo(() => ({ matrix: new THREE.Matrix4(), zoom: 0 }), []);
  useEffect(() => {
    pickRef.current = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;
      origin.set(nx, ny, -1).unproject(camera);
      camera.getWorldDirection(dir);
      return pickTile(terrain, [origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z])?.tile ?? null;
    };
  }, [terrain, camera, gl, pickRef, origin, dir]);
  useFrame(() => {
    const zoom = (camera as THREE.OrthographicCamera).zoom;
    if (!pointer.current || (last.zoom === zoom && last.matrix.equals(camera.matrixWorld))) return;
    last.matrix.copy(camera.matrixWorld);
    last.zoom = zoom;
    onRepick();
  });
  return null;
}

export function MapView(props: MapViewProps) {
  const {
    terrain, seed, objects, fade = null, fogMode = 'dm', isDm = false, party, route, routeStops, routeColor, worldMinutes,
    pings = [], selectedPinId, selectedLabelId, highlight, marks, traces, grid = 0, showProps = true, showRegionNames = true, showPinLabels = true,
    panButton = 2, cameraRef, initialCamera, onCameraChange, className,
  } = props;

  const pins = useMemo(() => objects.filter((o): o is PinObject => o.type === 'pin'), [objects]);
  const paths = useMemo(() => objects.filter((o): o is PathObject => o.type === 'path'), [objects]);
  const labels = useMemo(() => objects.filter((o): o is LabelObject => o.type === 'label'), [objects]);

  const extras = useMemo(() => {
    const W = terrain.width;
    // Players don't see what stands at pins the DM hasn't revealed.
    const sites: Site[] = pins
      .filter((p) => !(fogMode === 'player' && p.hidden))
      .map((p) => ({ x: Math.floor(p.x), y: Math.floor(p.y), pinType: p.data.pinType }));
    return {
      roads: connectionMasks(paths.filter((p) => p.data.kind === 'road').map((p) => p.data.points), W, terrain.height),
      rivers: connectionMasks(paths.filter((p) => p.data.kind === 'river').map((p) => p.data.points), W, terrain.height),
      paved: new Set(sites.filter((s) => isSettlement(s.pinType)).map((s) => s.y * W + s.x)),
      sites,
    };
  }, [terrain, pins, paths, fogMode]);

  // Players only see pins and names on ground they know.
  const known = useCallback((x: number, y: number) => !fade || fogMode !== 'player' || fade[Math.floor(y) * terrain.width + Math.floor(x)] < 0.75, [fade, fogMode, terrain.width]);
  const visiblePins = useMemo(() => pins.filter((p) => known(p.x, p.y)), [pins, known]);
  const ownRegions = useMemo(() => (props.regions || !showRegionNames || labels.length === 0 ? null : labelRegions(terrain)), [props.regions, showRegionNames, labels.length, terrain]);
  const regions = props.regions ?? ownRegions;
  const visibleLabels = useMemo(() => labels.filter((l) => known(l.x, l.y)), [labels, known]);
  const labelSizes = useMemo(() => {
    const out = new Map<string, number>();
    if (!regions) return out;
    for (const l of labels) {
      const x = Math.floor(l.x);
      const y = Math.floor(l.y);
      if (x >= 0 && y >= 0 && x < terrain.width && y < terrain.height) out.set(l.id, regions.regions[regions.ids[y * terrain.width + x]]?.size ?? 30);
    }
    return out;
  }, [labels, regions, terrain.width, terrain.height]);

  // The ground's grid and tile marks.
  const overlay = useMemo(() => createOverlay(terrain.width, terrain.height), [terrain.width, terrain.height]);
  useEffect(() => () => overlay.uMask.value.dispose(), [overlay]);
  useEffect(() => {
    overlay.uGrid.value = grid;
  }, [overlay, grid]);
  useEffect(() => {
    const all: TileMark[] = [];
    if (highlight?.length) all.push({ tiles: highlight, color: '#DEC27F', fill: 0.12 });
    if (marks) all.push(...marks);
    applyMarks(overlay, all);
  }, [overlay, highlight, marks]);

  const light = lightFor(worldMinutes);
  // Terrain textures and prop models suspend; until they arrive the canvas is empty.
  // They stay cached once they have, so only the first map in a tab says it's loading.
  const [loaded, setLoaded] = useState(landLoaded);
  const markLoaded = useCallback(() => {
    landLoaded = true;
    setLoaded(true);
  }, []);
  const [grab, setGrab] = useState<GrabState>('idle');
  const onPanChange = props.onPanChange;
  useEffect(() => onPanChange?.(grab === 'panning'), [grab, onPanChange]);

  // Pointer handling, in DOM space: the picker turns screen points into tiles.
  const ownPick = useRef<Picker | null>(null);
  const pick = useCallback<Picker>((x, y) => ownPick.current?.(x, y) ?? null, []);
  useEffect(() => {
    if (props.pickRef) props.pickRef.current = pick;
  }, [props.pickRef, pick]);
  const pointer = useRef<{ x: number; y: number; shift: boolean; alt: boolean; ctrl: boolean } | null>(null);
  const hovered = useRef<TilePoint | null>(null);
  const press = useRef<{ id: number; x: number; y: number; button: number; stroke: 'armed' | 'active' | null; panning: boolean } | null>(null);
  const handlers = useRef(props);
  handlers.current = props;

  const hover = useCallback((tile: TilePoint | null, e: TileEventInfo | null) => {
    if (sameTile(tile, hovered.current)) return;
    hovered.current = tile;
    handlers.current.onTileHover?.(tile, e);
  }, []);

  const repick = useCallback(() => {
    const p = pointer.current;
    if (!p) return;
    hover(pick(p.x, p.y), { shift: p.shift, alt: p.alt, ctrl: p.ctrl, clientX: p.x, clientY: p.y });
  }, [hover, pick]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    const panning = e.button !== 0 || Boolean(cameraRef?.current?.spaceHeld());
    const stroke = !panning && panButton !== 0 && e.isPrimary ? 'armed' : null;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, button: e.button, stroke, panning };
    if (!stroke) return;
    e.target.setPointerCapture(e.pointerId);
    const tile = pick(e.clientX, e.clientY);
    if (tile) {
      press.current.stroke = 'active';
      props.onTileDown?.(tile, info(e));
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    const stroking = p && p.id === e.pointerId && p.stroke;
    if (!(e.target instanceof HTMLCanvasElement) && !stroking) return;
    pointer.current = { x: e.clientX, y: e.clientY, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey || e.metaKey };
    const tile = pick(e.clientX, e.clientY);
    hover(tile, info(e));
    if (!stroking || !tile) return;
    if (p.stroke === 'armed') {
      p.stroke = 'active';
      props.onTileDown?.(tile, info(e));
    } else props.onTileDrag?.(tile, info(e));
  };

  const finishPress = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (p.stroke === 'active') props.onTileUp?.();
    if (cancelled || p.panning || p.button !== 0 || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) return;
    const tile = pick(e.clientX, e.clientY);
    if (tile) props.onTileClick?.(tile, info(e));
  };

  const onPointerLeave = () => {
    if (press.current?.stroke) return;
    pointer.current = null;
    hover(null, null);
  };

  const dragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!props.onDropTile) return;
    const tile = pick(e.clientX, e.clientY);
    props.onDragOverTile?.(tile, e);
    if (tile) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const drop = (e: DragEvent<HTMLDivElement>) => {
    if (!props.onDropTile) return;
    e.preventDefault();
    const tile = pick(e.clientX, e.clientY);
    props.onDragOverTile?.(null, e);
    if (tile) props.onDropTile(tile, e);
  };
  const dragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    props.onDragOverTile?.(null, e);
  };

  const cursor = grab === 'panning' ? 'grabbing' : grab === 'ready' ? 'grab' : props.cursor ?? (panButton === 0 ? 'grab' : 'default');

  return (
    <div
      className={`t-map ${className ?? ''}`}
      style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 40%, #18161B, #0A0A0B 72%)', cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishPress(e, false)}
      onPointerCancel={(e) => finishPress(e, true)}
      onPointerLeave={onPointerLeave}
      onDragOver={dragOver}
      onDrop={drop}
      onDragLeave={dragLeave}
    >
      <Canvas orthographic camera={{ zoom: 20, near: 0.1, far: 1000, position: [100, 100, 100] }} dpr={[1, 2]} gl={{ antialias: true }}>
        <CameraRig width={terrain.width} height={terrain.height} panButton={panButton} apiRef={cameraRef} initial={initialCamera} onPoseChange={onCameraChange} onGrab={setGrab} />
        <TilePicker terrain={terrain} pickRef={ownPick} pointer={pointer} onRepick={repick} />
        <hemisphereLight args={[light.sky, light.ground, light.ambient]} />
        <directionalLight color={light.sun} intensity={light.sunIntensity} position={[-36, 48, -14]} />
        {light.night && party && (
          <pointLight color="#F2B45A" intensity={2.2} distance={5} decay={1.5} position={[party[0] + 0.5, groundHeight(terrain, party[0] + 0.5, party[1] + 0.5) + 0.9, party[1] + 0.5]} />
        )}
        <Suspense fallback={null}>
          <Terrain terrain={terrain} extras={extras} fade={fade} fogMode={fogMode} overlay={overlay} />
          <Props3D terrain={terrain} seed={seed} options={extras} fade={fade} fogMode={fogMode} visible={showProps} />
          {party && <PartyBanner terrain={terrain} at={party} drag={props.partyDrag && { ...props.partyDrag, pick }} />}
          <Loaded onLoad={markLoaded} />
        </Suspense>
        {showRegionNames && (
          <RegionLabels
            terrain={terrain}
            labels={visibleLabels}
            sizes={labelSizes}
            selectedId={selectedLabelId}
            isDm={isDm}
            pick={pick}
            onSelect={props.onLabelSelect}
            onLabelMove={props.onLabelMove}
            onLabelDrop={props.onLabelDrop}
          />
        )}
        {showPinLabels && (
          <PinLabels terrain={terrain} pins={visiblePins} selectedId={selectedPinId} isDm={isDm} onSelect={props.onPinSelect} pick={pick} onPinMove={props.onPinMove} onPinDrop={props.onPinDrop} />
        )}
        {traces && <PathTraces terrain={terrain} traces={traces} />}
        {route && <RouteLine terrain={terrain} path={route} stops={routeStops} color={routeColor} />}
        <Pings terrain={terrain} pings={pings} />
      </Canvas>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="t-overlay px-4 py-2.5"><Loading label="Laying out the land…" /></div>
        </div>
      )}
    </div>
  );
}
