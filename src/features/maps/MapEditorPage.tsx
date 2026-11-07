import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import { Loading } from '@/components/ui/tome-loading';
import { FullScreenSpinner } from '@/features/auth/guards';
import { CampaignGate } from '@/features/suite/CampaignGate';
import type { SelectedCampaign } from '@/features/suite/campaign';
import { mapsApi } from './api';
import { applyBiome, applyHeight, brushTiles, stepsBetween, type HeightMode } from './editing';
import { CameraControls } from './editor/CameraControls';
import { History, objectSteps } from './editor/history';
import { PathInspector, TileInspector } from './editor/Inspectors';
import { MapTooltip } from './editor/MapTooltip';
import { Navigator } from './editor/Navigator';
import { cutPaths, flowRiver, routeRoad } from './editor/paths';
import { ToolOptions } from './editor/ToolOptions';
import { BRUSH_TOOLS, brushColor, COLORS, CURSORS, invertHeight, MAX_BRUSH, PIN_DRAG_TYPE, PIN_TYPES, TOOLS, type PathMode, type Tool } from './editor/tools';
import { ShortcutsMenu, ViewMenu } from './editor/ViewMenu';
import { useViewSettings } from './editor/viewSettings';
import { pinName, regionName, riverName, roadName } from './gen/names';
import { collectEdges } from './gen/pathfind';
import { mulberry32 } from './gen/prng';
import { describeTile, pathsThrough, pinsAt, regionNameIndex, sameTile, type FogState } from './inspect';
import { MapSettingsPanel } from './MapSettingsPanel';
import { PinInspector } from './PinInspector';
import type { CameraApi } from './render/CameraRig';
import { MapView, type TileEventInfo, type TileMark } from './render/MapView';
import type { PathTrace } from './render/Overlays';
import { Biome, type BiomeId } from './terrain/biomes';
import { cloneTerrain, encodeBytes, getBit, setBit } from './terrain/codec';
import { labelRegions, labelSpot, regionTiles } from './terrain/regions';
import { connectionMasks } from './terrain/roads';
import { formatDuration, planRoute } from './travel/travel';
import { exploredBits, useFog } from './useFog';
import type { LabelObject, LiveSession, MapDoc, MapObject, PathObject, PinObject, PinType, TerrainGrid, TilePoint } from './types';

type Selection = { kind: 'pin' | 'path' | 'label'; id: string } | { kind: 'tile'; tile: TilePoint } | null;

/** A road or river being laid: its tiles, and where each leg began (for Backspace). */
interface Draft {
  kind: 'road' | 'river';
  points: TilePoint[];
  legs: number[];
}

interface Stroke {
  before: TerrainGrid;
  touched: Set<number>;
  flattenTo: number;
  last: TilePoint;
  label: string;
  erased: Set<number>;
}

const STROKE_LABEL: Record<string, string> = { raise: 'Raise ground', lower: 'Lower ground', smooth: 'Smooth ground', flatten: 'Flatten ground' };

const newId = () => crypto.randomUUID();
/** 'Move Elilhall' → 'move Elilhall', for "Undo move Elilhall". */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const freshRand = () => mulberry32((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);

export default function MapEditorPage() {
  return <CampaignGate>{(campaign) => <Editor campaign={campaign} />}</CampaignGate>;
}

function Editor({ campaign }: { campaign: SelectedCampaign }) {
  const { mapId = '' } = useParams();
  const navigate = useNavigate();

  // Doc and objects keep refs in step so handlers fired between renders see the latest.
  const [doc, setDocState] = useState<MapDoc | null>(null);
  const docRef = useRef<MapDoc | null>(null);
  const setDoc = useCallback((next: MapDoc) => {
    docRef.current = next;
    setDocState(next);
  }, []);
  const [objects, setObjectsState] = useState<MapObject[]>([]);
  const objectsRef = useRef<MapObject[]>([]);
  const setObjects = useCallback((fn: (prev: MapObject[]) => MapObject[]) => {
    objectsRef.current = fn(objectsRef.current);
    setObjectsState(objectsRef.current);
  }, []);
  const [explored, setExploredState] = useState<Uint8Array | null>(null);
  const exploredRef = useRef<Uint8Array | null>(null);
  const setExplored = useCallback((bits: Uint8Array) => {
    exploredRef.current = bits;
    setExploredState(bits);
  }, []);
  const [live, setLive] = useState<LiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('Loading…');
  // Writes in flight; while any are, the header says so instead of the status.
  const [saving, setSaving] = useState(0);

  const [tool, setToolState] = useState<Tool>('select');
  const [brush, setBrush] = useState(2);
  const [heightMode, setHeightMode] = useState<HeightMode>('raise');
  const [paintBiome, setPaintBiome] = useState<BiomeId>(Biome.Forest);
  const [fogMode, setFogMode] = useState<'reveal' | 'hide'>('reveal');
  const [pathMode, setPathMode] = useState<PathMode>('auto');
  const [pinType, setPinType] = useState<PinType>('village');
  const [viewAs, setViewAs] = useState<'dm' | 'player'>('dm');
  const [view, setView] = useViewSettings();
  const [hover, setHover] = useState<TilePoint | null>(null);
  const [mods, setMods] = useState({ shift: false, alt: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [measure, setMeasure] = useState<TilePoint[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [panel, setPanel] = useState<'inspect' | 'settings'>('inspect');
  const [stroking, setStroking] = useState(false);
  const [panning, setPanning] = useState(false);
  const [erasing, setErasing] = useState<number[]>([]);
  // Something being dragged across the map: a label (pin or region name), the company, or a pin from the palette.
  const [moving, setMoving] = useState<{ id: string; tile: TilePoint } | null>(null);
  const [partyMoving, setPartyMoving] = useState<TilePoint | null>(null);
  const [dropTile, setDropTile] = useState<TilePoint | null>(null);
  const [, setHistoryTick] = useState(0);

  const camera = useRef<CameraApi | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const history = useRef(new History());
  const stroke = useRef<Stroke | null>(null);
  const drawing = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const fogTimer = useRef<ReturnType<typeof setTimeout>>();
  const pendingFog = useRef<Uint8Array | null>(null);
  const versionRef = useRef(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const bump = () => setHistoryTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([mapsApi.get(mapId), mapsApi.objects(mapId), mapsApi.fog(mapId), mapsApi.live(campaign.id)])
      .then(([d, objs, fog, session]) => {
        if (cancelled) return;
        versionRef.current = d.version;
        setDoc(d);
        setObjects(() => objs);
        setExplored(exploredBits(d.terrain, fog));
        setLive(session);
        setStatus(`Saved · seed ${d.seed}`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load this map'));
    return () => {
      cancelled = true;
    };
  }, [mapId, campaign.id, setDoc, setObjects, setExplored]);

  const track = useCallback(async <T,>(write: Promise<T>): Promise<T> => {
    setSaving((n) => n + 1);
    try {
      return await write;
    } finally {
      setSaving((n) => n - 1);
    }
  }, []);

  // --- Saving ----------------------------------------------------------------

  // Saves run one at a time, each with the version the last one returned; a 409 means another window saved first.
  const saveNow = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    saveChain.current = saveChain.current.then(async () => {
      const current = docRef.current;
      if (!current) return;
      try {
        versionRef.current = await track(mapsApi.save({ id: current.id, version: versionRef.current }, { terrain: current.terrain, settings: current.settings, name: current.name }));
        setStatus(`Saved · seed ${current.seed}`);
      } catch (err) {
        setStatus(err instanceof ApiError && err.status === 409 ? 'Changed elsewhere. Reload to continue.' : 'Save failed');
      }
    });
  }, [track]);

  const scheduleSave = useCallback(() => {
    setStatus('Unsaved changes');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(saveNow, 900);
  }, [saveNow]);

  const saveFogNow = useCallback(() => {
    clearTimeout(fogTimer.current);
    const bits = pendingFog.current;
    pendingFog.current = null;
    if (bits) track(mapsApi.saveFog(mapId, encodeBytes(bits))).catch(() => setStatus('Fog save failed'));
  }, [mapId, track]);

  const scheduleFogSave = useCallback((bits: Uint8Array) => {
    pendingFog.current = bits;
    clearTimeout(fogTimer.current);
    fogTimer.current = setTimeout(saveFogNow, 700);
  }, [saveFogNow]);

  // Leaving the page doesn't drop an edit still waiting for its debounce.
  const flush = useRef(() => {});
  flush.current = () => {
    if (saveTimer.current) saveNow();
    if (pendingFog.current) saveFogNow();
  };
  useEffect(() => () => flush.current(), []);

  // --- Objects, with undo ----------------------------------------------------

  const applyLocal = useCallback((upsert: MapObject[], remove: string[]) => {
    setObjects((prev) => {
      const byId = new Map(prev.map((o) => [o.id, o]));
      for (const id of remove) byId.delete(id);
      for (const o of upsert) byId.set(o.id, o);
      return [...byId.values()];
    });
  }, [setObjects]);

  /** Turns the objects in `from` into `to`, here and on the server. */
  const persist = useCallback(async (from: MapObject[], to: MapObject[]) => {
    const { upsert, remove } = objectSteps(from, to);
    applyLocal(upsert, remove);
    try {
      if (upsert.length) await track(mapsApi.saveObjects(mapId, upsert));
      for (const id of remove) await track(mapsApi.removeObject(mapId, id));
      return true;
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save');
      return false;
    }
  }, [applyLocal, mapId, track]);

  const commit = useCallback((label: string, before: MapObject[], after: MapObject[]) => {
    history.current.push({ kind: 'objects', label, before, after });
    bump();
    return persist(before, after);
  }, [persist]);

  const step = (direction: 'undo' | 'redo') => {
    if (stroke.current) return;
    const change = direction === 'undo' ? history.current.undo() : history.current.redo();
    if (!change) return;
    bump();
    setStatus(`${direction === 'undo' ? 'Undid' : 'Redid'}: ${lowerFirst(change.label)}`);
    if (change.kind === 'terrain') {
      const d = docRef.current;
      if (!d) return;
      setDoc({ ...d, terrain: direction === 'undo' ? change.before : change.after });
      scheduleSave();
    } else if (direction === 'undo') persist(change.after, change.before);
    else persist(change.before, change.after);
  };

  // --- Terrain ---------------------------------------------------------------

  const editTerrain = (mutate: (t: TerrainGrid) => number) => {
    const current = docRef.current;
    if (!current) return;
    const next = cloneTerrain(current.terrain);
    if (mutate(next) === 0) return;
    setDoc({ ...current, terrain: next });
    scheduleSave();
  };

  /** One brush step: every tile the brush passes over since the last step, each touched once per stroke. */
  const brushTo = (tile: TilePoint, info: TileEventInfo) => {
    const d = docRef.current;
    const s = stroke.current;
    if (!d || !s) return;
    const centres = sameTile(s.last, tile) ? [tile] : stepsBetween(s.last, tile);
    s.last = tile;
    const tiles: TilePoint[] = [];
    for (const c of centres) {
      for (const t of brushTiles(d.terrain, c, brush)) {
        const i = t[1] * d.terrain.width + t[0];
        if (s.touched.has(i)) continue;
        s.touched.add(i);
        tiles.push(t);
      }
    }
    if (tiles.length === 0) return;
    if (tool === 'height') editTerrain((t) => applyHeight(t, tiles, invertHeight(heightMode, info.shift), s.flattenTo));
    else if (tool === 'biome') editTerrain((t) => applyBiome(t, tiles, paintBiome));
    else if (tool === 'fog' && exploredRef.current) {
      const reveal = (fogMode === 'reveal') !== info.shift;
      const next = exploredRef.current.slice();
      for (const [x, y] of tiles) setBit(next, y * d.terrain.width + x, reveal);
      setExplored(next);
      scheduleFogSave(next);
    } else if (tool === 'road' || tool === 'river') {
      for (const [x, y] of tiles) s.erased.add(y * d.terrain.width + x);
      setErasing([...s.erased]);
    }
  };

  // --- Derived ---------------------------------------------------------------

  const pins = useMemo(() => objects.filter((o): o is PinObject => o.type === 'pin'), [objects]);
  const paths = useMemo(() => objects.filter((o): o is PathObject => o.type === 'path'), [objects]);
  const labels = useMemo(() => objects.filter((o): o is LabelObject => o.type === 'label'), [objects]);
  const terrain = doc?.terrain ?? null;
  const regions = useMemo(() => (terrain ? labelRegions(terrain) : null), [terrain]);
  const regionNames = useMemo(() => (regions ? regionNameIndex(regions, labels) : new Map<number, LabelObject>()), [regions, labels]);
  const masks = useMemo(() => {
    if (!terrain) return {};
    const of = (kind: 'road' | 'river') => connectionMasks(paths.filter((p) => p.data.kind === kind).map((p) => p.data.points), terrain.width, terrain.height);
    return { roads: of('road'), rivers: of('river') };
  }, [terrain, paths]);

  const realParty: TilePoint | null = live && live.partyMapId === mapId ? [Math.round(live.partyX), Math.round(live.partyY)] : null;
  const party = partyMoving ?? realParty;
  const { fade, visible } = useFog(terrain, explored, realParty, live?.worldMinutes ?? 480, live?.weather ?? 'clear');
  const fogState = useCallback((i: number): FogState => (visible?.[i] ? 'visible' : explored && getBit(explored, i) ? 'remembered' : 'unknown'), [visible, explored]);

  const selectedPin = selection?.kind === 'pin' ? pins.find((p) => p.id === selection.id) ?? null : null;
  const selectedPath = selection?.kind === 'path' ? paths.find((p) => p.id === selection.id) ?? null : null;
  const selectedLabel = selection?.kind === 'label' ? labels.find((l) => l.id === selection.id) ?? null : null;
  const selectedTile = useMemo<TilePoint | null>(
    () => (selection?.kind === 'tile' ? selection.tile : selectedLabel ? [Math.floor(selectedLabel.x), Math.floor(selectedLabel.y)] : null),
    [selection, selectedLabel]
  );

  const strokeTool = BRUSH_TOOLS.has(tool) || ((tool === 'road' || tool === 'river') && pathMode !== 'auto');
  const hoverPaths = useMemo(() => (hover && !draft ? pathsThrough(paths, hover) : []), [hover, paths, draft]);

  const measured = useMemo(() => {
    if (!doc || measure.length !== 2) return null;
    const roads = paths.filter((o) => o.data.kind === 'road').map((o) => o.data.points);
    return planRoute({ terrain: doc.terrain, milesPerTile: doc.scale, roadEdges: collectEdges(roads, doc.terrain.width), pace: 'normal' }, measure[0], measure[1]);
  }, [doc, measure, paths]);

  // The next leg of a road or river, under the cursor.
  const preview = useMemo(() => {
    if (!terrain || !hover || (tool !== 'road' && tool !== 'river') || pathMode === 'erase') return null;
    const last = draft?.kind === tool ? draft.points[draft.points.length - 1] : null;
    if (tool === 'river' && pathMode === 'auto' && !last) return flowRiver(terrain, hover, masks);
    if (!last) return null;
    if (tool === 'road' && pathMode === 'auto') return routeRoad(terrain, last, hover, masks);
    return [last, ...stepsBetween(last, hover)];
  }, [terrain, hover, tool, pathMode, draft, masks]);

  // --- Actions ---------------------------------------------------------------

  const setTool = (t: Tool) => {
    setToolState(t);
    setDraft(null);
    setMeasure([]);
    setErasing([]);
  };

  const selectAt = (tile: TilePoint) => {
    const here = pinsAt(pins, tile);
    if (here.length) {
      setSelection({ kind: 'pin', id: here[0].id });
      setPanel('inspect');
      return;
    }
    // Clicking the same tile again steps through what crosses it, then the ground itself.
    const through = pathsThrough(paths, tile);
    const at = selection?.kind === 'path' ? through.findIndex((p) => p.id === selection.id) : selection?.kind === 'tile' && sameTile(selection.tile, tile) ? through.length : -1;
    const next = (at + 1) % (through.length + 1);
    setSelection(next < through.length ? { kind: 'path', id: through[next].id } : { kind: 'tile', tile });
    setPanel('inspect');
  };

  const createPin = (type: PinType, tile: TilePoint) => {
    const pin: PinObject = {
      id: newId(), mapId, type: 'pin', x: tile[0], y: tile[1], z: 0, rot: 0, hidden: true,
      data: { pinType: type, name: pinName(type, freshRand(), new Set(pins.map((p) => p.data.name))), notionLocationId: null, childMapId: null, autoReveal: true },
    };
    commit(`Place a ${type}`, [], [pin]);
    setSelection({ kind: 'pin', id: pin.id });
    setPanel('inspect');
  };

  const createPath = (kind: 'road' | 'river', points: TilePoint[]) => {
    if (points.length < 2) return;
    const name = kind === 'river' ? riverName(freshRand(), new Set(paths.map((p) => p.data.name ?? ''))) : undefined;
    const path: PathObject = { id: newId(), mapId, type: 'path', x: points[0][0], y: points[0][1], z: 0, rot: 0, hidden: false, data: { kind, points, ...(name ? { name } : {}) } };
    commit(kind === 'road' ? 'Lay a road' : 'Run a river', [], [path]);
    setSelection({ kind: 'path', id: path.id });
    setPanel('inspect');
  };

  const finishDraft = () => {
    if (draft && draft.points.length >= 2) createPath(draft.kind, draft.points);
    setDraft(null);
  };

  const undoLeg = () =>
    setDraft((d) => {
      if (!d || d.legs.length <= 1) return null;
      return { ...d, points: d.points.slice(0, d.legs[d.legs.length - 1] || 1), legs: d.legs.slice(0, -1) };
    });

  const addWaypoint = (tile: TilePoint) => {
    if (!terrain) return;
    if (!draft || draft.kind !== 'road') {
      setDraft({ kind: 'road', points: [tile], legs: [0] });
      return;
    }
    const last = draft.points[draft.points.length - 1];
    if (sameTile(last, tile)) {
      finishDraft();
      return;
    }
    const leg = routeRoad(terrain, last, tile, masks);
    if (!leg) {
      setStatus('No way over land between those tiles');
      return;
    }
    setDraft({ ...draft, legs: [...draft.legs, draft.points.length], points: [...draft.points, ...leg.slice(1)] });
  };

  const eraseNow = (erased: Set<number>) => {
    if (!terrain || erased.size === 0) return;
    const kind = tool === 'river' ? 'river' : 'road';
    const candidates = paths.filter((p) => p.data.kind === kind);
    const { updated, created, removed } = cutPaths(candidates, erased, terrain.width);
    const before = [...updated.map((u) => candidates.find((c) => c.id === u.id)!), ...removed];
    const after: MapObject[] = [...updated, ...created.map((c) => ({ ...c, id: newId(), mapId, z: 0, rot: 0 }) as PathObject)];
    if (before.length) commit(`Erase ${kind === 'road' ? 'a road' : 'a river'}`, before, after);
  };

  const moveParty = async (tile: TilePoint) => {
    if (!doc) return;
    try {
      setLive(await track(mapsApi.updateLive(campaign.id, { partyMapId: doc.id, partyX: tile[0], partyY: tile[1], activeMapId: live?.activeMapId ?? doc.id, status: live?.status ?? 'ended' })));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not move the company');
    }
  };

  const removeSelected = () => {
    const target = selectedPin ?? selectedPath ?? selectedLabel;
    if (!target) return;
    const name = target.type === 'pin' ? target.data.name : target.type === 'path' ? (target.data.name ?? `the ${target.data.kind}`) : target.data.text;
    commit(`Remove ${name}`, [target], []);
    setSelection(null);
  };

  const nameRegion = (regionId: number, text: string) => {
    if (!regions) return;
    const existing = regionNames.get(regionId);
    if (existing) {
      commit('Rename a region', [existing], [{ ...existing, data: { ...existing.data, text } }]);
      return;
    }
    const spot = labelSpot(regions, regionId);
    const label: LabelObject = { id: newId(), mapId, type: 'label', x: spot % regions.width, y: Math.floor(spot / regions.width), z: 0, rot: 0, hidden: false, data: { text, size: 1 } };
    commit('Name a region', [], [label]);
  };

  // --- Map events ------------------------------------------------------------

  const onTileDown = (tile: TilePoint, info: TileEventInfo) => {
    const d = docRef.current;
    if (!d) return;
    if (tool === 'biome' && info.alt) {
      setPaintBiome(d.terrain.biomes[tile[1] * d.terrain.width + tile[0]] as BiomeId);
      return;
    }
    if (BRUSH_TOOLS.has(tool) || ((tool === 'road' || tool === 'river') && pathMode === 'erase')) {
      const label = tool === 'height' ? STROKE_LABEL[invertHeight(heightMode, info.shift)] : tool === 'biome' ? 'Paint biome' : tool === 'fog' ? 'Fog' : 'Erase';
      stroke.current = { before: d.terrain, touched: new Set(), flattenTo: d.terrain.heights[tile[1] * d.terrain.width + tile[0]], last: tile, label, erased: new Set() };
      setStroking(true);
      brushTo(tile, info);
    } else if ((tool === 'road' || tool === 'river') && pathMode === 'draw') {
      drawing.current = true;
      setStroking(true);
      setDraft((prev) => {
        if (!prev || prev.kind !== tool) return { kind: tool, points: [tile], legs: [0] };
        const last = prev.points[prev.points.length - 1];
        return { ...prev, legs: [...prev.legs, prev.points.length], points: [...prev.points, ...stepsBetween(last, tile)] };
      });
    }
  };

  const onTileDrag = (tile: TilePoint, info: TileEventInfo) => {
    if (stroke.current) brushTo(tile, info);
    else if (drawing.current) {
      setDraft((prev) => (prev ? { ...prev, points: [...prev.points, ...stepsBetween(prev.points[prev.points.length - 1], tile)] } : prev));
    }
  };

  const onTileUp = () => {
    const s = stroke.current;
    stroke.current = null;
    drawing.current = false;
    setStroking(false);
    if (!s) return;
    if (tool === 'road' || tool === 'river') {
      eraseNow(s.erased);
      setErasing([]);
      return;
    }
    const after = docRef.current?.terrain;
    if (after && after !== s.before && tool !== 'fog') {
      history.current.push({ kind: 'terrain', label: s.label, before: s.before, after });
      bump();
    }
  };

  const onTileClick = (tile: TilePoint) => {
    if (!doc) return;
    if (tool === 'select') selectAt(tile);
    else if (tool === 'road' && pathMode === 'auto') addWaypoint(tile);
    else if (tool === 'river' && pathMode === 'auto') {
      const river = flowRiver(doc.terrain, tile, masks);
      if (river) createPath('river', river);
      else setStatus('Water can’t run from there');
    } else if (tool === 'pin') createPin(pinType, tile);
    else if (tool === 'party') moveParty(tile);
    else if (tool === 'measure') setMeasure((m) => (m.length >= 2 ? [tile] : [...m, tile]));
  };

  // --- Keyboard --------------------------------------------------------------

  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
      e.preventDefault();
      step(key === 'y' || e.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const toolKey = TOOLS.find((d) => d.hotkey === e.key);
    if (toolKey) setTool(toolKey.key);
    else if (e.key === '[') setBrush((b) => Math.max(1, b - 1));
    else if (e.key === ']') setBrush((b) => Math.min(MAX_BRUSH, b + 1));
    else if (key === 'g') setView({ grid: !view.grid });
    else if (e.key === 'Enter') finishDraft();
    else if (e.key === 'Escape') {
      if (draft) setDraft(null);
      else if (measure.length) setMeasure([]);
      else setSelection(null);
    } else if (e.key === 'Backspace' && draft) {
      e.preventDefault();
      undoLeg();
    } else if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
  };
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current(e);
      if (e.key === 'Shift' || e.key === 'Alt') {
        if (e.key === 'Alt') e.preventDefault();
        setMods((m) => ({ ...m, [e.key.toLowerCase()]: true }));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'Shift' || e.key === 'Alt') setMods((m) => ({ ...m, [e.key.toLowerCase()]: false }));
    };
    const blur = () => setMods({ shift: false, alt: false });
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // --- What the map shows ----------------------------------------------------

  const shownObjects = useMemo(
    () => (moving ? objects.map((o) => (o.id === moving.id ? { ...o, x: moving.tile[0], y: moving.tile[1] } : o)) : objects),
    [objects, moving]
  );

  const marks = useMemo<TileMark[]>(() => {
    if (!terrain || !regions) return [];
    const out: TileMark[] = [];
    const W = terrain.width;
    if (selectedTile) {
      out.push({ tiles: regionTiles(regions, regions.ids[selectedTile[1] * W + selectedTile[0]]), color: COLORS.gilt, fill: 0.07 });
      if (selection?.kind === 'tile') out.push({ tiles: [selectedTile], color: COLORS.giltHi, fill: 0.3 });
    }
    if (hover && tool === 'select' && !hoverPaths.length && !moving) {
      const id = regions.ids[hover[1] * W + hover[0]];
      if (!selectedTile || regions.ids[selectedTile[1] * W + selectedTile[0]] !== id) out.push({ tiles: regionTiles(regions, id), color: COLORS.bone, fill: 0.05 });
    }
    if (hover && !moving) {
      if (BRUSH_TOOLS.has(tool) && !(tool === 'biome' && mods.alt)) {
        out.push({ tiles: brushTiles(terrain, hover, brush), color: brushColor(tool, { heightMode, biome: paintBiome, fogMode, shift: mods.shift }), fill: 0.3 });
      } else if ((tool === 'road' || tool === 'river') && pathMode === 'erase') out.push({ tiles: brushTiles(terrain, hover, brush), color: COLORS.erase, fill: 0.3 });
      else if (tool !== 'select') out.push({ tiles: [hover], color: COLORS.giltHi, fill: 0.25 });
    }
    if (erasing.length) out.push({ tiles: erasing, color: COLORS.erase, fill: 0.45 });
    if (measure.length) out.push({ tiles: measure, color: COLORS.giltHi, fill: 0.35 });
    if (moving) out.push({ tiles: [moving.tile], color: COLORS.giltHi, fill: 0.4 });
    if (partyMoving) out.push({ tiles: [partyMoving], color: COLORS.giltHi, fill: 0.4 });
    if (dropTile) out.push({ tiles: [dropTile], color: COLORS.giltHi, fill: 0.45 });
    return out;
  }, [terrain, regions, selectedTile, selection, hover, tool, hoverPaths.length, moving, brush, heightMode, paintBiome, fogMode, mods, pathMode, erasing, measure, partyMoving, dropTile]);

  const traces = useMemo<PathTrace[]>(() => {
    const out: PathTrace[] = [];
    const colour = (p: PathObject) => (p.data.kind === 'road' ? COLORS.road : COLORS.river);
    if (tool === 'select' || ((tool === 'road' || tool === 'river') && pathMode === 'erase')) {
      for (const p of hoverPaths) if (p.id !== selectedPath?.id) out.push({ points: p.data.points, color: colour(p) });
    }
    if (selectedPath) out.push({ points: selectedPath.data.points, color: colour(selectedPath) });
    return out;
  }, [tool, pathMode, hoverPaths, selectedPath]);

  const route = tool === 'measure'
    ? measured?.path ?? null
    : draft
      ? [...draft.points, ...(preview ? preview.slice(1) : [])]
      : preview;

  const cursor = (() => {
    if (tool === 'select') return hover && (pinsAt(pins, hover).length || hoverPaths.length) ? 'pointer' : 'grab';
    if (BRUSH_TOOLS.has(tool)) return tool === 'biome' && mods.alt ? CURSORS.dropper : CURSORS.brush(brushColor(tool, { heightMode, biome: paintBiome, fogMode, shift: mods.shift }));
    if (tool === 'road' || tool === 'river') return CURSORS.brush(pathMode === 'erase' ? COLORS.erase : tool === 'road' ? COLORS.road : COLORS.river);
    if (tool === 'pin') return CURSORS.pin;
    if (tool === 'party') return CURSORS.party;
    return CURSORS.measure;
  })();

  const inspectCtx = useMemo(
    () => (terrain && regions ? { terrain, scale: doc?.scale ?? 1, regions, regionNames, pins, paths, fog: fogState, forPlayers: viewAs === 'player' } : null),
    [terrain, doc?.scale, regions, regionNames, pins, paths, fogState, viewAs]
  );
  const tooltip = useMemo(
    () => (view.tooltips && hover && inspectCtx && !stroking && !panning && !moving && !partyMoving && !dropTile ? describeTile(inspectCtx, hover) : null),
    [view.tooltips, hover, inspectCtx, stroking, panning, moving, partyMoving, dropTile]
  );

  if (error) {
    return (
      <div className="t-root min-h-svh flex items-center justify-center p-6">
        <div className="t-frame p-8 max-w-md flex flex-col gap-4">
          <h1 className="t-h2">Couldn't open this map</h1>
          <p className="t-body m-0">{error}</p>
          <Link to="/maps" className="t-btn self-start">Back to the atlas</Link>
        </div>
      </div>
    );
  }
  if (!doc || !regions || !inspectCtx) return <FullScreenSpinner label="Unrolling the map…" />;

  const selectedRegion = selectedTile ? regions.regions[regions.ids[selectedTile[1] * doc.terrain.width + selectedTile[0]]] ?? null : null;
  const undoLabel = history.current.nextUndo;
  const redoLabel = history.current.nextRedo;
  // Painting tools see straight through labels; select and pin tools can pick them up.
  const canDragLabels = tool === 'select' || tool === 'pin';
  const labelsLive = tool === 'select';

  return (
    <div className="t-editor flex h-svh flex-col bg-ink-0 text-bone font-text">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-2.5 border-b border-rule bg-ink-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2.5">
          <Link to="/maps" className="t-label" style={{ color: 'var(--bone-3)' }}>Atlas</Link>
          <i className="t-diamond t-diamond--hollow" style={{ width: 6, height: 6, ['--tier' as string]: 'var(--rule)' }} />
          <input
            aria-label="Map name"
            className="bg-transparent font-display text-[18px] font-semibold tracking-[0.05em] text-bone outline-none border-b border-transparent focus:border-gilt"
            value={doc.name}
            onChange={(e) => setDoc({ ...doc, name: e.target.value })}
            onBlur={scheduleSave}
          />
        </nav>
        {saving > 0 ? <Loading label="Saving…" /> : <span className="t-small">{status}</span>}
        <div className="flex gap-1">
          <button type="button" aria-label="Undo" title={undoLabel ? `Undo ${lowerFirst(undoLabel)} (Ctrl+Z)` : 'Nothing to undo'} disabled={!undoLabel} className="t-btn t-btn--icon h-10 w-10" style={{ borderColor: 'var(--rule)' }} onClick={() => step('undo')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-2" /></svg>
          </button>
          <button type="button" aria-label="Redo" title={redoLabel ? `Redo ${lowerFirst(redoLabel)} (Ctrl+Shift+Z)` : 'Nothing to redo'} disabled={!redoLabel} className="t-btn t-btn--icon h-10 w-10" style={{ borderColor: 'var(--rule)' }} onClick={() => step('redo')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="m15 14 5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h2" /></svg>
          </button>
        </div>
        <div role="radiogroup" aria-label="View as" className="t-seg ml-auto" style={{ gridTemplateColumns: 'repeat(2, auto)' }}>
          <button type="button" role="radio" aria-checked={viewAs === 'dm'} className="px-3.5 h-[38px]" onClick={() => setViewAs('dm')}>DM view</button>
          <button type="button" role="radio" aria-checked={viewAs === 'player'} className="px-3.5 h-[38px]" onClick={() => setViewAs('player')}>As players see it</button>
        </div>
        <button type="button" className="t-btn t-btn--primary h-10" onClick={() => navigate(`/table?map=${doc.id}`)}>Run the table</button>
      </header>

      <div className="flex flex-1 min-h-0">
        <div role="toolbar" aria-label="Map tools" aria-orientation="vertical" className="w-[68px] shrink-0 flex flex-col items-center gap-1 py-3 border-r border-rule bg-ink-1">
          {TOOLS.map((t, n) => (
            <button
              key={t.key}
              type="button"
              aria-label={t.label}
              title={`${t.label} (${t.hotkey})`}
              aria-pressed={tool === t.key}
              onClick={() => setTool(t.key)}
              className={`t-rail-btn ${tool === t.key ? 't-rail-btn--on' : ''}`}
              style={{ ['--i' as string]: n }}
            >
              <span className="t-rail-key" aria-hidden="true">{t.hotkey}</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true"><path d={t.icon} /></svg>
              <span className="font-display font-semibold text-[8.5px] tracking-[0.12em] uppercase">{t.short}</span>
            </button>
          ))}
          <div className="mt-auto flex flex-col gap-1 pt-3 border-t border-rule">
            <ViewMenu settings={view} onChange={setView} />
            <ShortcutsMenu />
          </div>
        </div>

        <div ref={viewport} className="relative flex-1 min-w-0 overflow-hidden">
          <MapView
            terrain={doc.terrain}
            seed={doc.seed}
            objects={shownObjects}
            regions={regions}
            fade={fade}
            fogMode={viewAs}
            isDm={viewAs === 'dm'}
            party={party}
            worldMinutes={live?.worldMinutes ?? null}
            route={route}
            routeColor={tool === 'river' ? COLORS.river : undefined}
            selectedPinId={selectedPin?.id ?? null}
            selectedLabelId={selectedLabel?.id ?? null}
            marks={marks}
            traces={traces}
            grid={view.grid ? view.gridOpacity : 0}
            showProps={view.scenery}
            showRegionNames={view.regionNames}
            showPinLabels={view.pinLabels}
            cursor={cursor}
            panButton={strokeTool ? 2 : 0}
            cameraRef={camera}
            onPanChange={setPanning}
            onTileHover={setHover}
            onTileDown={onTileDown}
            onTileDrag={onTileDrag}
            onTileUp={onTileUp}
            onTileClick={onTileClick}
            onPinSelect={canDragLabels ? (pin) => {
              setSelection({ kind: 'pin', id: pin.id });
              setPanel('inspect');
            } : undefined}
            onPinMove={canDragLabels ? (pin, tile) => setMoving({ id: pin.id, tile }) : undefined}
            onPinDrop={canDragLabels ? (pin, tile) => {
              setMoving(null);
              if (pin.x !== tile[0] || pin.y !== tile[1]) commit(`Move ${pin.data.name}`, [pin], [{ ...pin, x: tile[0], y: tile[1] }]);
            } : undefined}
            onLabelSelect={labelsLive ? (label) => {
              setSelection({ kind: 'label', id: label.id });
              setPanel('inspect');
            } : undefined}
            onLabelMove={labelsLive ? (label, tile) => setMoving({ id: label.id, tile }) : undefined}
            onLabelDrop={labelsLive ? (label, tile) => {
              setMoving(null);
              if (label.x !== tile[0] || label.y !== tile[1]) commit(`Move ${label.data.text}`, [label], [{ ...label, x: tile[0], y: tile[1] }]);
            } : undefined}
            partyDrag={tool === 'select' || tool === 'party' ? {
              onMove: setPartyMoving,
              onDrop: async (tile) => {
                await moveParty(tile);
                setPartyMoving(null);
              },
            } : undefined}
            onDragOverTile={(tile, e) => setDropTile(tile && e.dataTransfer.types.includes(PIN_DRAG_TYPE) ? tile : null)}
            onDropTile={(tile, e) => {
              setDropTile(null);
              const type = e.dataTransfer.getData(PIN_DRAG_TYPE) as PinType;
              if (PIN_TYPES.includes(type)) createPin(type, tile);
            }}
          />

          <ToolOptions
            key={tool}
            tool={tool}
            brush={brush}
            setBrush={setBrush}
            heightMode={heightMode}
            setHeightMode={setHeightMode}
            paintBiome={paintBiome}
            setPaintBiome={setPaintBiome}
            fogMode={fogMode}
            setFogMode={setFogMode}
            pathMode={pathMode}
            setPathMode={(m) => {
              setPathMode(m);
              setDraft(null);
            }}
            draftLength={draft?.points.length ?? 0}
            onFinish={finishDraft}
            onCancel={() => setDraft(null)}
            onUndoLeg={undoLeg}
            pinType={pinType}
            setPinType={setPinType}
            measured={measured ? `${measured.miles.toFixed(1)} miles · ${formatDuration(measured.minutes)} at a normal pace` : null}
            hasParty={Boolean(realParty)}
          />

          {view.minimap && (
            <div className="t-hud absolute left-4 bottom-4 z-10">
              <Navigator terrain={doc.terrain} fade={viewAs === 'player' ? fade : null} pins={viewAs === 'player' ? pins.filter((p) => !p.hidden && (!fade || fade[Math.floor(p.y) * doc.terrain.width + Math.floor(p.x)] < 0.75)) : pins} party={party} camera={camera} />
            </div>
          )}
          <div className="t-hud absolute right-4 bottom-4 z-10">
            <CameraControls camera={camera} />
          </div>
          <MapTooltip container={viewport} info={tooltip} compact={BRUSH_TOOLS.has(tool)} />
        </div>

        <aside aria-label="Inspector" className="t-panel w-[340px] shrink-0 border-y-0 border-r-0 flex flex-col overflow-y-auto">
          <div role="tablist" className="t-tabs border-b border-rule">
            <button type="button" role="tab" aria-selected={panel === 'inspect'} className="t-tab flex-1 justify-center" onClick={() => setPanel('inspect')}>Inspect</button>
            <button type="button" role="tab" aria-selected={panel === 'settings'} className="t-tab flex-1 justify-center" onClick={() => setPanel('settings')}>Encounters</button>
          </div>
          <div className="p-5">
            {panel === 'settings' ? (
              <MapSettingsPanel
                terrain={doc.terrain}
                settings={doc.settings}
                onChange={(settings) => {
                  setDoc({ ...doc, settings });
                  scheduleSave();
                }}
              />
            ) : selectedPin ? (
              <PinInspector
                pin={selectedPin}
                campaignId={campaign.id}
                onChange={(patch) => commit(`Edit ${selectedPin.data.name}`, [selectedPin], [{ ...selectedPin, hidden: patch.hidden ?? selectedPin.hidden, data: { ...selectedPin.data, ...patch.data } }])}
                onDelete={async () => {
                  await commit(`Remove ${selectedPin.data.name}`, [selectedPin], []);
                  setSelection(null);
                }}
              />
            ) : selectedPath ? (
              <PathInspector
                path={selectedPath}
                pins={pins}
                scale={doc.scale}
                onChange={(patch) => commit(`Edit the ${selectedPath.data.kind}`, [selectedPath], [{ ...selectedPath, hidden: patch.hidden ?? selectedPath.hidden, data: { ...selectedPath.data, ...patch.data } }])}
                onDelete={removeSelected}
                onFocus={() => camera.current?.focus(selectedPath.data.points[Math.floor(selectedPath.data.points.length / 2)])}
                onSuggest={() => (selectedPath.data.kind === 'river' ? riverName : roadName)(freshRand(), new Set(paths.map((p) => p.data.name ?? '')))}
              />
            ) : selectedTile ? (
              <TileInspector
                info={describeTile(inspectCtx, selectedTile)}
                tile={selectedTile}
                region={selectedRegion}
                label={selectedRegion ? regionNames.get(selectedRegion.id) ?? null : null}
                onName={(text) => selectedRegion && nameRegion(selectedRegion.id, text)}
                onLabelChange={(patch) => {
                  const label = selectedRegion && regionNames.get(selectedRegion.id);
                  if (label) commit('Edit a region name', [label], [{ ...label, hidden: patch.hidden ?? label.hidden }]);
                }}
                onRemoveName={() => {
                  const label = selectedRegion && regionNames.get(selectedRegion.id);
                  if (label) commit(`Remove ${label.data.text}`, [label], []);
                  if (selection?.kind === 'label') setSelection(selectedTile ? { kind: 'tile', tile: selectedTile } : null);
                }}
                onSuggest={() => (selectedRegion ? regionName(selectedRegion.biome, freshRand(), new Set(labels.map((l) => l.data.text))) : '')}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <span className="t-label">Nothing selected</span>
                <p className="t-body m-0">Pick the select tool (1) and click a place, a road, a river or any stretch of land to inspect and name it.</p>
                <p className="t-small m-0">{pins.length} places · {paths.filter((p) => p.data.kind === 'road').length} roads · {paths.filter((p) => p.data.kind === 'river').length} rivers · {labels.length} named regions</p>
                <div className="t-raised p-4 flex flex-col gap-2 text-[14px] text-bone-2">
                  <span className="t-label">Getting around</span>
                  <span>Wheel zooms toward the cursor. Drag with the right or middle button, or hold Space, to pan. W A S D pans too; Q and E turn the view.</span>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
