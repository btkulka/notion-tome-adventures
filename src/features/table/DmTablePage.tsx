import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { FullScreenSpinner, Notice } from '@/features/auth/guards';
import { CampaignGate } from '@/features/suite/CampaignGate';
import type { SelectedCampaign } from '@/features/suite/campaign';
import { SessionSelect } from '@/components/ui/session-select';
import { mapsApi } from '@/features/maps/api';
import { collectEdges, edgeKey } from '@/features/maps/gen/pathfind';
import { MapView } from '@/features/maps/render/MapView';
import type { CameraApi } from '@/features/maps/render/CameraRig';
import type { Ping } from '@/features/maps/render/Overlays';
import { BIOMES, type BiomeId } from '@/features/maps/terrain/biomes';
import { encodeBytes, getBit, setBit } from '@/features/maps/terrain/codec';
import {
  dayFraction,
  formatDuration,
  formatWorldTime,
  isNight,
  nextMorning,
  PACE_MPH,
  planRoute,
  rollCheck,
  scheduleTravel,
  type Route,
} from '@/features/maps/travel/travel';
import { exploredBits, useFog } from '@/features/maps/useFog';
import { sameVersion, useCached } from '@/lib/cached';
import { useTable, type TableMessage } from '@/features/maps/useTable';
import { computeVisibility } from '@/features/maps/vision/overworld';
import type { MapDoc, MapObject, PathObject, PinObject, TilePoint, TravelPace, Weather } from '@/features/maps/types';
import { crTier, DIFFICULTY_TIER, EncounterSetupError, rollEncounter, type RolledEncounter } from './encounters';

const WEATHER: Weather[] = ['clear', 'overcast', 'rain', 'storm', 'snow', 'fog'];
const STEP_MS = 220;
const NO_OBJECTS: MapObject[] = [];

interface Board {
  doc: MapDoc;
  objects: MapObject[];
  explored: Uint8Array;
}

async function loadBoard(mapId: string): Promise<Board> {
  const [doc, objects, fog] = await Promise.all([mapsApi.get(mapId), mapsApi.objects(mapId), mapsApi.fog(mapId)]);
  return { doc, objects, explored: exploredBits(doc.terrain, fog) };
}

const sameBits = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

/** A refresh that brings the same map and fog back keeps the old ones, so the map doesn't rebuild. */
const keepBoard = (old: Board, next: Board): Board => ({
  ...next,
  doc: sameVersion(old.doc, next.doc),
  explored: sameBits(old.explored, next.explored) ? old.explored : next.explored,
});

export default function DmTablePage() {
  return <CampaignGate>{(campaign) => <Table campaign={campaign} />}</CampaignGate>;
}

interface Interrupt {
  atIndex: number;
  at: number;
  tile: TilePoint;
  night: boolean;
  encounter: RolledEncounter | null;
  error: string | null;
  rolling: boolean;
}

function Table({ campaign }: { campaign: SelectedCampaign }) {
  const [params] = useSearchParams();
  const [pings, setPings] = useState<Ping[]>([]);
  const [marking, setMarking] = useState(false);
  // Header and planner actions in flight, and the last one that failed.
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const [destination, setDestination] = useState<TilePoint | null>(null);
  const [pace, setPace] = useState<TravelPace>('normal');
  const [travelling, setTravelling] = useState<{ step: number; party: TilePoint; minutes: number } | null>(null);
  const [interrupt, setInterrupt] = useState<Interrupt | null>(null);
  const decision = useRef<((d: 'continue' | 'halt') => void) | null>(null);
  const camera = useRef<CameraApi | null>(null);
  const interruptRef = useRef<Interrupt | null>(null);
  interruptRef.current = interrupt;

  // Which map: ?map=, else the live session's, else the newest. Kept across visits
  // (lib/cached.ts), so coming back to the table shows it at once and refreshes quietly.
  const liveQuery = useCached(['live', campaign.id], () => mapsApi.live(campaign.id));
  const listQuery = useCached(['maps', campaign.id], () => mapsApi.list(campaign.id));
  const chosen = liveQuery.data !== undefined && listQuery.data !== undefined;
  const mapId = chosen ? params.get('map') ?? liveQuery.data?.activeMapId ?? listQuery.data?.[0]?.id ?? null : null;
  const boardQuery = useCached(['table', mapId], () => loadBoard(mapId!), { enabled: mapId !== null, keep: keepBoard });

  const live = liveQuery.data ?? null;
  const setLive = liveQuery.set;
  const doc = boardQuery.data?.doc ?? null;
  const objects = boardQuery.data?.objects ?? NO_OBJECTS;
  const explored = boardQuery.data?.explored ?? null;
  const exploredRef = useRef<Uint8Array | null>(null);
  exploredRef.current = explored;
  const setBoard = boardQuery.set;
  const setObjects = useCallback(
    (next: React.SetStateAction<MapObject[]>) => setBoard((b) => ({ ...b, objects: typeof next === 'function' ? next(b.objects) : next })),
    [setBoard]
  );
  const setExplored = useCallback((bits: Uint8Array | null) => bits && setBoard((b) => ({ ...b, explored: bits })), [setBoard]);
  const noMaps = chosen && mapId === null;
  const failed = liveQuery.error ?? listQuery.error ?? boardQuery.error;
  const error = failed ? failed.message || 'Could not open the table' : null;

  const onMessage = useCallback((msg: TableMessage) => {
    if (msg.type === 'ping') setPings((p) => [...p.slice(-8), { id: `${msg.userId}-${performance.now()}`, x: msg.x, y: msg.y, color: '#557FBF', at: performance.now() }]);
  }, []);
  const table = useTable(campaign.id, onMessage);

  const placedX = doc && live?.partyMapId === doc.id ? Math.round(live.partyX) : null;
  const placedY = doc && live?.partyMapId === doc.id ? Math.round(live.partyY) : null;
  const placed = useMemo<TilePoint | null>(() => (placedX === null || placedY === null ? null : [placedX, placedY]), [placedX, placedY]);
  const party: TilePoint | null = travelling?.party ?? placed;
  const minutes = travelling?.minutes ?? live?.worldMinutes ?? 480;
  const weather = live?.weather ?? 'clear';
  const { fade } = useFog(doc?.terrain ?? null, explored, party, minutes, weather);

  const roadEdges = useMemo(() => {
    const roads = objects.filter((o): o is PathObject => o.type === 'path' && o.data.kind === 'road').map((o) => o.data.points);
    return collectEdges(roads, doc?.terrain.width ?? 1);
  }, [objects, doc]);

  const planned: Route | null = useMemo(() => {
    if (!doc || !placed || !destination) return null;
    return planRoute({ terrain: doc.terrain, milesPerTile: doc.scale, roadEdges, pace }, placed, destination);
  }, [doc, placed, destination, roadEdges, pace]);

  const plannedSchedule = useMemo(
    () => (planned && doc ? scheduleTravel(planned, live?.worldMinutes ?? 480, doc.settings.encounters) : null),
    [planned, doc, live?.worldMinutes]
  );

  // Once the company sets out, the leg is fixed until it arrives or halts.
  const [trip, setTrip] = useState<{ route: Route; schedule: NonNullable<typeof plannedSchedule> } | null>(null);
  const route = trip?.route ?? planned;
  const schedule = trip?.schedule ?? plannedSchedule;

  const pinAt = (tile: TilePoint | null) => (tile ? objects.find((o): o is PinObject => o.type === 'pin' && Math.floor(o.x) === tile[0] && Math.floor(o.y) === tile[1]) : undefined);

  const breakdown = useMemo(() => {
    if (!doc || !route) return [];
    const totals = new Map<string, { miles: number; color: string }>();
    for (let i = 1; i < route.path.length; i++) {
      const [ax, ay] = route.path[i - 1];
      const [bx, by] = route.path[i];
      const miles = doc.scale * (ax !== bx && ay !== by ? Math.SQRT2 : 1);
      const onRoad = roadEdges.has(edgeKey(route.path[i - 1], route.path[i], doc.terrain.width));
      const biome = BIOMES[doc.terrain.biomes[by * doc.terrain.width + bx] as BiomeId];
      const key = onRoad ? 'Road' : biome.name;
      const entry = totals.get(key) ?? { miles: 0, color: onRoad ? '#8A7148' : biome.top };
      entry.miles += miles;
      totals.set(key, entry);
    }
    return [...totals.entries()].sort((a, b) => b[1].miles - a[1].miles);
  }, [doc, route, roadEdges]);

  const nightFallsAt = useMemo(() => {
    if (!route || !schedule) return null;
    const i = schedule.arrival.findIndex((m) => isNight(m));
    return i > 0 ? route.elapsed[i] / 60 * PACE_MPH[pace] : null;
  }, [route, schedule, pace]);

  // Reveal ground the party sees from a tile; auto-reveal pins it sights.
  const sight = (tile: TilePoint, atMinutes: number) => {
    if (!doc || !exploredRef.current) return { bits: exploredRef.current, newlySeen: [] as number[] };
    const visible = computeVisibility(doc.terrain, tile, { night: isNight(atMinutes), weather });
    const bits = exploredRef.current.slice();
    const newlySeen: number[] = [];
    for (let i = 0; i < visible.length; i++) {
      if (visible[i] && !getBit(bits, i)) {
        setBit(bits, i, true);
        newlySeen.push(i);
      }
    }
    return { bits, newlySeen };
  };

  const persist = async (tile: TilePoint, atMinutes: number, bits: Uint8Array | null) => {
    if (!doc) return;
    const next = await mapsApi.updateLive(campaign.id, { partyMapId: doc.id, partyX: tile[0], partyY: tile[1], worldMinutes: Math.round(atMinutes), activeMapId: live?.activeMapId ?? doc.id });
    setLive(next);
    if (bits) await mapsApi.saveFog(doc.id, encodeBytes(bits));
    const W = doc.terrain.width;
    const reveal = objects.filter((o): o is PinObject => o.type === 'pin' && o.hidden && o.data.autoReveal && bits !== null && getBit(bits, Math.floor(o.y) * W + Math.floor(o.x)));
    if (reveal.length) {
      const saved = await mapsApi.saveObjects(doc.id, reveal.map((p) => ({ ...p, hidden: false })));
      setObjects((prev) => prev.map((o) => saved.find((s) => s.id === o.id) ?? o));
    }
  };

  const askEncounter = async (atIndex: number, at: number, tile: TilePoint, night: boolean): Promise<'continue' | 'halt'> => {
    if (!doc) return 'continue';
    const biome = doc.terrain.biomes[tile[1] * doc.terrain.width + tile[0]];
    const base: Interrupt = { atIndex, at, tile, night, encounter: null, error: null, rolling: true };
    setInterrupt(base);
    try {
      const encounter = await rollEncounter(campaign.id, doc.settings, biome);
      setInterrupt({ ...base, encounter, rolling: false });
    } catch (err) {
      const message = err instanceof EncounterSetupError || err instanceof Error ? err.message : 'Could not roll the encounter';
      setInterrupt({ ...base, error: message, rolling: false });
    }
    return new Promise((resolve) => {
      decision.current = resolve;
    });
  };

  const setOut = async () => {
    if (!doc || !route || !schedule || !party) return;
    setTrip({ route, schedule });
    const startedAt = live?.worldMinutes ?? 480;
    let bits = exploredRef.current;
    let haltedAt = route.path.length - 1;
    let encounterNote: { atIndex: number; biome: string; summary: string } | null = null;
    for (let step = 1; step < route.path.length; step++) {
      await new Promise((r) => setTimeout(r, STEP_MS));
      const tile = route.path[step];
      const at = schedule.arrival[step];
      const seen = sight(tile, at);
      bits = seen.bits;
      setExplored(bits);
      setTravelling({ step, party: tile, minutes: at });
      if (step % 4 === 0) await persist(tile, at, bits);

      const checks = schedule.checks.filter((c) => c.atIndex === step);
      for (const check of checks) {
        if (!rollCheck(doc.settings.encounters.chancePercent)) continue;
        await persist(tile, check.at, bits);
        const choice = await askEncounter(step, check.at, tile, check.night);
        if (choice === 'halt') {
          haltedAt = step;
          const rolled = interruptRef.current?.encounter;
          if (rolled) {
            encounterNote = { atIndex: step, biome: rolled.biome, summary: rolled.creatures.map((c) => `${c.quantity}× ${c.name}`).join(', ') };
            await mapsApi.saveObjects(doc.id, [{
              type: 'pin', x: tile[0], y: tile[1], hidden: true,
              data: { pinType: 'encounter', name: rolled.creatures[0]?.name ?? 'Encounter', notionLocationId: null, childMapId: null, autoReveal: false },
            }]).then((saved) => setObjects((prev) => [...prev, ...saved]));
          }
          break;
        }
      }
      if (haltedAt === step) break;
    }
    const end = route.path[haltedAt];
    const endMinutes = schedule.arrival[haltedAt];
    await persist(end, endMinutes, bits);
    await mapsApi.logTravel(campaign.id, {
      mapId: doc.id, from: route.path[0], to: end, path: route.path.slice(0, haltedAt + 1),
      minutes: endMinutes - startedAt, miles: route.miles * (haltedAt / (route.path.length - 1)), pace, startedAt, encounter: encounterNote,
    }).catch(() => undefined);
    setTravelling(null);
    setTrip(null);
    setDestination(null);
    setInterrupt(null);
  };

  const decide = (d: 'continue' | 'halt') => {
    decision.current?.(d);
    decision.current = null;
    if (d === 'continue') setInterrupt(null);
  };

  const reroll = async () => {
    if (!interrupt || !doc) return;
    setInterrupt({ ...interrupt, rolling: true, error: null });
    try {
      const encounter = await rollEncounter(campaign.id, doc.settings, doc.terrain.biomes[interrupt.tile[1] * doc.terrain.width + interrupt.tile[0]]);
      setInterrupt({ ...interrupt, encounter, rolling: false, error: null });
    } catch (err) {
      setInterrupt({ ...interrupt, rolling: false, error: err instanceof Error ? err.message : 'Could not roll' });
    }
  };

  const makeCamp = async () => {
    if (!doc || !party || !live) return;
    const start = live.worldMinutes;
    const morning = nextMorning(start);
    if (doc.settings.encounters.checkAtNight && rollCheck(doc.settings.encounters.chancePercent)) {
      const at = start + (morning - start) / 2;
      const choice = await askEncounter(0, at, party, true);
      setInterrupt(null);
      if (choice === 'halt') {
        setLive(await mapsApi.updateLive(campaign.id, { worldMinutes: Math.round(at) }));
        return;
      }
    }
    setLive(await mapsApi.updateLive(campaign.id, { worldMinutes: morning }));
  };

  const startSession = async () => {
    if (!doc) return;
    setLive(await mapsApi.updateLive(campaign.id, { status: 'live', activeMapId: doc.id }));
  };

  const act = async (key: string, work: () => Promise<unknown>) => {
    setPending((keys) => new Set(keys).add(key));
    setActionError(null);
    try {
      await work();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reach the table');
    } finally {
      setPending((keys) => {
        const next = new Set(keys);
        next.delete(key);
        return next;
      });
    }
  };

  // A failed save mid-journey stops the company where it last saved, rather than leaving it travelling.
  const travel = async () => {
    setActionError(null);
    try {
      await setOut();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The journey could not be saved');
      setTravelling(null);
      setTrip(null);
      setInterrupt(null);
    }
  };

  if (error) return <Notice title="Couldn't open the table"><p className="m-0">{error}</p></Notice>;
  if (noMaps) return <Notice title="No map to play on" action={<Link to="/maps" className="t-btn self-start">Open the atlas</Link>}><p className="m-0">Generate a region in the atlas first.</p></Notice>;
  if (!doc || !explored) return <FullScreenSpinner label="Setting the table…" />;

  const isLive = live?.status === 'live';
  const hour = dayFraction(minutes) * 24;
  const fromPin = pinAt(party);
  const toPin = pinAt(destination);

  return (
    <div className="flex h-svh flex-col bg-ink-0 text-bone font-text">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-2.5 border-b border-rule bg-ink-1">
        {isLive ? (
          <span className="t-chip" style={{ borderColor: 'rgba(166,58,53,0.6)', color: 'var(--blood-text)' }}><i className="t-diamond" style={{ background: 'var(--blood)' }} />Live</span>
        ) : (
          <span className="t-chip">Not live</span>
        )}
        <div className="flex flex-col">
          <span className="t-h3 text-[17px]">{doc.name}</span>
          <span className="t-small text-[13px]">{campaign.name}{table.connected ? '' : table.connecting ? ' · connecting…' : ' · reconnecting…'}</span>
        </div>
        <div className="flex gap-1.5" aria-label={`${table.people.length} at the table`}>
          {table.people.map((p) => (
            p.avatarUrl
              ? <img key={p.userId} src={p.avatarUrl} alt={p.name} title={p.name} className="h-[34px] w-[34px] border border-gilt-deep" />
              : <span key={p.userId} className="t-portrait t-portrait--sm" title={p.name}>{p.name.slice(0, 2).toUpperCase()}</span>
          ))}
        </div>
        {actionError && <span role="alert" className="text-blood-text text-[14px]">{actionError}</span>}

        <div className="t-raised ml-auto flex items-center gap-3.5 px-3.5 py-2">
          <div className="flex flex-col gap-1.5 w-[168px]">
            <div className="flex justify-between items-baseline"><span className="t-h3 text-[15px]">{formatWorldTime(minutes)}</span></div>
            <div className="relative h-1.5 bg-[#1B1E2B]" aria-label="Daylight and the current hour">
              <span className="absolute inset-y-0 bg-gilt-deep" style={{ left: '25%', width: '58.3%' }} />
              <span className="absolute -top-1 w-0.5 h-3.5 bg-gilt-hi" style={{ left: `${(hour / 24) * 100}%` }} />
            </div>
          </div>
          <select
            aria-label="Weather"
            aria-busy={pending.has('weather')}
            className="t-input h-9 w-auto text-[14px] disabled:opacity-60"
            value={weather}
            disabled={pending.has('weather')}
            onChange={(e) => {
              const next = e.target.value as Weather;
              act('weather', async () => setLive(await mapsApi.updateLive(campaign.id, { weather: next })));
            }}
          >
            {WEATHER.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <button type="button" className="t-btn h-10" onClick={() => camera.current && table.send({ type: 'pull', camera: camera.current.getPose() })}>Pull everyone to my view</button>
        {isLive ? (
          <button type="button" className="t-btn t-btn--danger h-10" disabled={pending.has('session')} onClick={() => act('session', async () => setLive(await mapsApi.updateLive(campaign.id, { status: 'ended' })))}>
            {pending.has('session') ? 'Ending…' : 'End session'}
          </button>
        ) : (
          <button type="button" className="t-btn t-btn--primary h-10" disabled={pending.has('session')} onClick={() => act('session', startSession)}>
            {pending.has('session') ? 'Starting…' : 'Start session'}
          </button>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="relative flex-1 min-w-0">
          <MapView
            terrain={doc.terrain}
            seed={doc.seed}
            objects={objects}
            fade={fade}
            fogMode="dm"
            isDm
            party={party}
            route={route?.path ?? null}
            routeStops={schedule?.camps.map((c) => c.atIndex)}
            worldMinutes={minutes}
            pings={pings}
            panButton={0}
            cameraRef={camera}
            onTileClick={(tile) => {
              if (marking) {
                table.send({ type: 'ping', x: tile[0], y: tile[1] });
                setMarking(false);
              } else if (!party) {
                if (!pending.has('place')) act('place', async () => setLive(await mapsApi.updateLive(campaign.id, { partyMapId: doc.id, partyX: tile[0], partyY: tile[1], activeMapId: doc.id })));
              } else if (!travelling) setDestination(tile);
            }}
          />
          <div className="absolute top-4 left-4 flex gap-2">
            <button type="button" className={`t-btn t-overlay h-10 ${marking ? 'text-gilt-hi' : ''}`} aria-pressed={marking} onClick={() => setMarking((m) => !m)}>
              <i className="t-diamond tier-azure" />{marking ? 'Click a spot' : 'Mark a spot'}
            </button>
          </div>
          {!party && (
            <div className="t-overlay absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2.5">
              {pending.has('place') ? <Loading label="Placing the company…" /> : 'Click a tile to place the company on this map.'}
            </div>
          )}

          {interrupt && <EncounterPanel interrupt={interrupt} onHalt={() => decide('halt')} onContinue={() => decide('continue')} onReroll={reroll} />}
        </div>

        <aside aria-label="Travel planner" className="t-panel w-[360px] shrink-0 border-y-0 border-r-0 flex flex-col gap-5 p-5 overflow-y-auto">
          <h2 className="t-h2">Travel</h2>
          <div className="t-raised flex flex-col">
            <div className="flex items-center gap-3.5 px-3.5 py-3"><i className="t-diamond" /><span className="flex flex-col"><span className="t-label text-[10px]">From</span><span className="font-semibold">{fromPin?.data.name ?? (party ? `Tile ${party[0]}, ${party[1]}` : 'Place the company')}</span></span></div>
            <div className="flex items-center gap-3.5 px-3.5 py-3 border-t border-rule"><i className="t-diamond t-diamond--hollow" /><span className="flex flex-col"><span className="t-label text-[10px]">To · click the map</span><span className="font-semibold">{toPin?.data.name ?? (destination ? `Tile ${destination[0]}, ${destination[1]}` : 'Choose a destination')}</span></span></div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="t-label">Pace</span>
            <div role="radiogroup" aria-label="Pace" className="t-seg" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {(['slow', 'normal', 'fast'] as TravelPace[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={pace === p} onClick={() => setPace(p)} style={{ height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                  {p}
                  <span className="font-text normal-case tracking-normal text-[12px]">{PACE_MPH[p]} mph{p === 'slow' ? ' · stealth' : p === 'fast' ? ' · −5 PP' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {route && schedule ? (
            <>
              <dl className="m-0 grid grid-cols-2 gap-4">
                <div className="t-stat"><dt>Distance</dt><dd>{route.miles.toFixed(1)} mi</dd></div>
                <div className="t-stat"><dt>On the road</dt><dd>{formatDuration(route.minutes)}</dd></div>
                <div className="t-stat col-span-2"><dt>Arrives</dt><dd className="t-num">{formatWorldTime(schedule.arrivesAt)}{isNight(schedule.arrivesAt) && <span className="t-small font-normal"> after dark</span>}</dd></div>
              </dl>
              <div className="flex flex-col gap-2.5">
                <span className="t-label">Ground covered</span>
                <div className="flex h-2" aria-hidden="true">{breakdown.map(([name, b]) => <span key={name} style={{ flex: b.miles, background: b.color }} />)}</div>
                <div className="flex flex-wrap gap-3.5 t-small">
                  {breakdown.map(([name, b]) => <span key={name} className="inline-flex items-center gap-2"><i className="t-diamond" style={{ background: b.color }} />{name} {b.miles.toFixed(1)} mi</span>)}
                </div>
              </div>
              <div className="t-raised flex flex-col px-3.5 py-1 text-[15px]">
                <div className="flex justify-between py-2"><span className="t-body">Encounter checks</span><span>{schedule.checks.length}{schedule.camps.length ? ` · ${schedule.camps.length} camp${schedule.camps.length > 1 ? 's' : ''}` : ''}</span></div>
                <div className="flex justify-between py-2 border-t border-rule"><span className="t-body">Chance each</span><span>{doc.settings.encounters.chancePercent}%</span></div>
                <div className="flex justify-between py-2 border-t border-rule"><span className="t-body">Night falls at</span><span>{nightFallsAt === null ? 'not on this leg' : `mile ${nightFallsAt.toFixed(0)}`}</span></div>
              </div>
            </>
          ) : (
            <p className="t-body m-0">{destination && !route ? 'No way there on foot from here.' : 'Click the map to choose where the company goes.'}</p>
          )}

          <div className="mt-auto flex flex-col gap-2">
            <button type="button" className="t-btn t-btn--primary t-btn--lg" disabled={!route || Boolean(travelling) || pending.has('camp')} onClick={travel}>
              {travelling ? `Travelling… ${travelling.step} of ${(route?.path.length ?? 1) - 1}` : 'Set out'}
            </button>
            <button type="button" className="t-btn t-btn--quiet" disabled={Boolean(travelling) || !party || pending.has('camp')} onClick={() => act('camp', makeCamp)}>
              {pending.has('camp') ? 'Making camp…' : 'Make camp until morning'}
            </button>
            {!isLive && (
              <div className="t-field pt-3 border-t border-rule">
                <span className="t-label">Session</span>
                <SessionSelect
                  value={null}
                  campaignId={campaign.id}
                  onValueChange={(s) => s && act('link', async () => setLive(await mapsApi.updateLive(campaign.id, { notionSessionId: s.id })))}
                  placeholder="Link this table to a session…"
                />
                {pending.has('link') && <Loading label="Linking the session…" />}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EncounterPanel({ interrupt, onHalt, onContinue, onReroll }: { interrupt: Interrupt; onHalt: () => void; onContinue: () => void; onReroll: () => void }) {
  // A re-roll hides the old encounter so it can't be fought while the new one arrives.
  const enc = interrupt.rolling ? null : interrupt.encounter;
  const tier = DIFFICULTY_TIER[(enc?.difficulty ?? '').toLowerCase()] ?? 'bone';
  return (
    <section aria-label="Travel halted" className="t-frame absolute left-1/2 bottom-5 -translate-x-1/2 w-[min(660px,calc(100%-32px))] flex flex-col gap-4 p-6 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)]">
      <div className="flex flex-wrap justify-between items-start gap-2.5">
        <div className="flex flex-col gap-2">
          <span className="t-label">{interrupt.night ? 'In the night' : 'On the road'} · {formatWorldTime(interrupt.at)}{enc ? ` · ${enc.biome}` : ''}</span>
          <h2 className="t-h1 text-[26px]">{interrupt.rolling ? 'Something stirs…' : enc ? 'An encounter' : 'Travel paused'}</h2>
        </div>
        {enc && <span className={`t-chip t-chip--tier tier-${tier}`}><i className="t-diamond" />{enc.difficulty} · {enc.totalXp.toLocaleString()} XP</span>}
      </div>
      {interrupt.error && <p className="m-0 text-blood-text">{interrupt.error}</p>}
      {interrupt.rolling && (
        <div className="flex flex-col gap-2.5">
          <Loading label="Rolling on the encounter table…" />
          {[62, 48, 55].map((w) => <Shimmer key={w} className="h-5" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {enc && (
        <div className="flex flex-col text-[15px]">
          {enc.creatures.map((c, i) => (
            <div key={i} className={`tier-${crTier(c.cr)} grid grid-cols-[22px_minmax(0,1fr)_80px_90px] items-center py-2 border-t border-rule ${i === enc.creatures.length - 1 ? 'border-b' : ''}`}>
              <i className="t-diamond" />
              <span><strong className="font-semibold">{c.name}</strong>{c.quantity > 1 && <span className="t-small"> × {c.quantity}</span>}</span>
              <span className="t-small">CR {c.cr}</span>
              <span className="t-num text-right">{(c.xp * c.quantity).toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2.5">
        {enc && <button type="button" className="t-btn t-btn--primary" onClick={onHalt}>Halt and fight</button>}
        <button type="button" className="t-btn t-btn--quiet" disabled={interrupt.rolling} onClick={onReroll}>Re-roll</button>
        <button type="button" className="t-btn t-btn--quiet" onClick={onContinue}>{enc ? 'They pass unseen' : 'Keep travelling'}</button>
      </div>
    </section>
  );
}
