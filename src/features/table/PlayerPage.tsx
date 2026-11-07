import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loading, Shimmer } from '@/components/ui/tome-loading';
import { useAuth } from '@/features/auth/useAuth';
import { FullScreenSpinner, Notice } from '@/features/auth/guards';
import { locationsApi, type NotionLocation } from '@/features/suite/campaign';
import { BringCharacter } from '@/features/characters/BringCharacter';
import { charactersApi, classAndLevel, initials, tierFor, type Character } from '@/features/characters/api';
import { api } from '@/lib/api';
import { mapsApi } from '@/features/maps/api';
import { MapView } from '@/features/maps/render/MapView';
import type { CameraApi } from '@/features/maps/render/CameraRig';
import type { Ping } from '@/features/maps/render/Overlays';
import { decodeBytes } from '@/features/maps/terrain/codec';
import { dayFraction, formatWorldTime } from '@/features/maps/travel/travel';
import { exploredBits, useFog } from '@/features/maps/useFog';
import { useTable, type Seat, type TableMessage } from '@/features/maps/useTable';
import type { LiveSession, MapDoc, MapObject, PinObject, TilePoint } from '@/features/maps/types';
import hero from '@/assets/dnd-hero-banner.jpg';

const PING_COLORS = ['#557FBF', '#5A9A6A', '#8D6FBF', '#C27838', '#D6CFBE'];
const colorFor = (userId: string) => PING_COLORS[[...userId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PING_COLORS.length];

/** "Not now" on the character prompt lasts until the tab closes. */
const skipKey = (campaignId: string) => `tome.noCharacter.${campaignId}`;
function readSkip(campaignId: string): boolean {
  try {
    return sessionStorage.getItem(skipKey(campaignId)) === '1';
  } catch {
    return false;
  }
}

const WEATHER_NOTE: Record<string, string> = {
  clear: 'Clear skies', overcast: 'Overcast', rain: 'Rain', storm: 'A storm', snow: 'Snow', fog: 'Thick fog',
};

/** The place card: a pin, and its location entry once it arrives. */
interface ShownLocation {
  pin: PinObject;
  info: NotionLocation | null;
  here: boolean;
  loading: boolean;
}

/** /play/:campaignId — what the company can see, kept live by the DM's table. */
export default function PlayerPage() {
  const { campaignId = '' } = useParams();
  const { profile } = useAuth();
  const [live, setLive] = useState<LiveSession | null>(null);
  const [doc, setDoc] = useState<MapDoc | null>(null);
  const [objects, setObjects] = useState<MapObject[]>([]);
  const [explored, setExplored] = useState<Uint8Array | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pings, setPings] = useState<Ping[]>([]);
  const [marking, setMarking] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [lastMark, setLastMark] = useState<string | null>(null);
  const [location, setLocation] = useState<ShownLocation | null>(null);
  // The map being fetched, while it is.
  const [loadingMap, setLoadingMap] = useState<string | null>(null);
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [myCharacterId, setMyCharacterId] = useState<string | null | undefined>(undefined);
  const [skipped, setSkipped] = useState(() => readSkip(campaignId));
  const camera = useRef<CameraApi | null>(null);
  const mapId = useRef<string | null>(null);

  const loadMap = useCallback(async (id: string | null) => {
    mapId.current = id;
    if (!id) {
      setDoc(null);
      setObjects([]);
      setExplored(null);
      return;
    }
    setLoadingMap(id);
    try {
      const [d, objs, fog] = await Promise.all([mapsApi.get(id), mapsApi.objects(id), mapsApi.fog(id)]);
      if (mapId.current !== id) return;
      setDoc(d);
      setObjects(objs);
      setExplored(exploredBits(d.terrain, fog));
    } finally {
      setLoadingMap((current) => (current === id ? null : current));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [session, mine] = await Promise.all([
          mapsApi.live(campaignId),
          api<{ campaigns: { campaignId: string; characterId: string | null }[] }>('/api/campaigns/mine'),
        ]);
        if (cancelled) return;
        setLive(session);
        setMyCharacterId(mine.campaigns.find((c) => c.campaignId === campaignId)?.characterId ?? null);
        await loadMap(session?.activeMapId ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not reach the table');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    charactersApi.list(campaignId).then(setCharacters).catch(() => setCharacters([]));
    return () => {
      cancelled = true;
    };
  }, [campaignId, loadMap]);

  const onMessage = useCallback((msg: TableMessage) => {
    switch (msg.type) {
      case 'live':
        setLive(msg.live);
        if (msg.live.activeMapId !== mapId.current) loadMap(msg.live.activeMapId ?? null);
        break;
      case 'objects':
        if (msg.mapId !== mapId.current) break;
        setObjects((prev) => {
          const gone = new Set([...msg.remove, ...msg.upsert.filter((o) => o.hidden).map((o) => o.id)]);
          const next = prev.filter((o) => !gone.has(o.id));
          for (const o of msg.upsert) {
            if (o.hidden) continue;
            const i = next.findIndex((p) => p.id === o.id);
            if (i >= 0) next[i] = o;
            else next.push(o);
          }
          return next;
        });
        break;
      case 'fog':
        if (msg.mapId === mapId.current) setExplored(decodeBytes(msg.explored));
        break;
      case 'map':
        if (msg.mapId === mapId.current) loadMap(msg.mapId);
        break;
      case 'ping':
        setPings((p) => [...p.slice(-8), { id: `${msg.userId}-${performance.now()}`, x: msg.x, y: msg.y, color: colorFor(msg.userId), at: performance.now() }]);
        setLastMark(msg.by);
        break;
      case 'pull':
        camera.current?.setPose(msg.camera);
        setPulled(true);
        break;
    }
  }, [loadMap]);
  const table = useTable(campaignId, onMessage);

  const partyX = doc && live?.partyMapId === doc.id ? Math.round(live.partyX) : null;
  const partyY = doc && live?.partyMapId === doc.id ? Math.round(live.partyY) : null;
  const party = useMemo<TilePoint | null>(() => (partyX === null || partyY === null ? null : [partyX, partyY]), [partyX, partyY]);
  const minutes = live?.worldMinutes ?? 480;
  const weather = live?.weather ?? 'clear';
  const { fade } = useFog(doc?.terrain ?? null, explored, party, minutes, weather);

  const pins = useMemo(() => objects.filter((o): o is PinObject => o.type === 'pin'), [objects]);
  const pinHere = party ? pins.find((p) => Math.floor(p.x) === party[0] && Math.floor(p.y) === party[1]) : undefined;

  // Where the company stands is the default card.
  useEffect(() => {
    if (!pinHere) return;
    showPin(pinHere, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinHere?.id, pinHere?.data.notionLocationId]);

  const showPin = (pin: PinObject, here = false) => {
    setLocation({ pin, info: null, here, loading: Boolean(pin.data.notionLocationId) });
    if (!pin.data.notionLocationId) return;
    locationsApi.get(campaignId, pin.data.notionLocationId)
      .then((info) => setLocation((cur) => (cur?.pin.id === pin.id ? { ...cur, info, loading: false } : cur)))
      .catch(() => setLocation((cur) => (cur?.pin.id === pin.id ? { ...cur, loading: false } : cur)));
  };

  useEffect(() => {
    if (!pulled) return;
    const timer = setTimeout(() => setPulled(false), 8000);
    return () => clearTimeout(timer);
  }, [pulled]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'p' || e.key === 'P') setMarking((m) => !m);
      if (e.key === 'Escape') setMarking(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!loaded) return <FullScreenSpinner label="Finding your seat…" />;
  if (error) return <Notice title="Couldn't reach the table" action={<Link to="/" className="t-btn self-start">Back</Link>}><p className="m-0">{error}</p></Notice>;
  // Without a character, wait for the list before choosing between the map and the character prompt.
  if (myCharacterId === null && characters === null) return <FullScreenSpinner label="Finding your seat…" />;

  const me = characters?.find((c) => c.id === myCharacterId) ?? null;
  if (characters && myCharacterId === null && !skipped && profile) {
    return (
      <BringCharacter
        campaignId={campaignId}
        characters={characters}
        userId={profile.id}
        onSeated={(c) => {
          setCharacters((list) => [...(list ?? []).filter((x) => x.id !== c.id), c]);
          setMyCharacterId(c.id);
        }}
        onSkip={() => {
          try {
            sessionStorage.setItem(skipKey(campaignId), '1');
          } catch {
            // Private mode: the prompt just comes back next visit.
          }
          setSkipped(true);
        }}
      />
    );
  }

  const others = table.people.filter((p) => p.userId !== profile?.id);
  const hour = dayFraction(minutes) * 24;

  return (
    <div className="t-root relative h-svh overflow-hidden" style={{ backgroundImage: 'radial-gradient(ellipse at 50% 42%, #18161B, #0A0A0B 72%)' }}>
      {doc && explored ? (
        <MapView
          terrain={doc.terrain}
          seed={doc.seed}
          objects={objects}
          fade={fade}
          fogMode="player"
          party={party}
          worldMinutes={minutes}
          pings={pings}
          panButton={0}
          cameraRef={camera}
          selectedPinId={location?.pin.id ?? null}
          onTileClick={(tile) => {
            if (!marking) return;
            table.send({ type: 'ping', x: tile[0], y: tile[1] });
            setMarking(false);
          }}
          onPinSelect={(pin) => showPin(pin, pin.id === pinHere?.id)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="t-frame max-w-md p-8 flex flex-col gap-3">
            <span className="t-label">{live?.status === 'live' ? 'The session has begun' : 'Between sessions'}</span>
            {loadingMap ? (
              <>
                <h1 className="t-h2">The DM is laying out a map</h1>
                <Loading label="Unrolling it now…" />
              </>
            ) : (
              <>
                <h1 className="t-h2">The DM hasn't laid out a map yet</h1>
                <p className="t-body m-0">Stay here. The map appears the moment the DM opens one.</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="t-overlay absolute top-3.5 left-3.5 sm:top-5 sm:left-5 flex flex-col gap-2 px-4 py-3 w-[min(250px,calc(100%-28px))]">
        {doc && <span className="t-label">{doc.name}</span>}
        <span className="t-h2 text-[19px]">{formatWorldTime(minutes)}</span>
        <div className="relative h-[5px] bg-[#1B1E2B]" aria-label="Daylight and the current hour">
          <span className="absolute inset-y-0 bg-gilt-deep" style={{ left: '25%', width: '58.3%' }} />
          <span className="absolute -top-1 w-0.5 h-[13px] bg-gilt-hi" style={{ left: `${(hour / 24) * 100}%` }} />
        </div>
        <span className="t-small text-[14px]">{WEATHER_NOTE[weather] ?? weather}{table.connected ? '' : table.connecting ? ' · connecting…' : ' · reconnecting…'}</span>
      </div>

      <div className="t-overlay absolute top-3.5 right-3.5 sm:top-5 sm:right-5 flex items-center gap-3.5 py-2.5 pl-4 pr-3">
        <Link
          to={`/play/${encodeURIComponent(campaignId)}/characters`}
          className="group flex items-center gap-3.5"
          title="Your characters"
          aria-label={me ? `You play ${me.name}. Your characters` : 'Choose a character'}
        >
          <span className="hidden sm:flex flex-col items-end gap-0.5">
            <span className="t-h3 text-bone group-hover:text-gilt-hi transition-colors">{me?.name ?? profile?.displayName ?? profile?.username}</span>
            <span className="t-small text-[13px]">{me ? `You · ${classAndLevel(me).toLowerCase()}` : 'Choose a character'}</span>
          </span>
          <Portrait name={me?.name ?? profile?.username ?? '?'} image={me?.portraitUrl ?? profile?.avatarUrl ?? null} tier={me ? tierFor(me.id) : 'bone'} own />
        </Link>
        {others.length > 0 && <span className="w-px h-[30px] bg-rule" />}
        <div className="flex gap-1.5" aria-label={`Also here: ${others.map((p) => p.name).join(', ') || 'no one'}`}>
          {others.map((p) => <SeatPortrait key={p.userId} seat={p} />)}
        </div>
      </div>

      {pulled && (
        <div className="t-overlay absolute left-1/2 top-[104px] -translate-x-1/2 flex items-center gap-3.5 py-2.5 pl-4 pr-3 border-gilt-deep">
          <i className="t-diamond" />
          <span className="text-[15px]">The DM is showing you something</span>
          <button type="button" className="t-btn t-btn--quiet h-[34px] px-3 text-gilt" onClick={() => setPulled(false)}>Look around</button>
        </div>
      )}

      {location && <LocationCard location={location} onClose={() => setLocation(null)} />}

      {doc && (
        <div role="toolbar" aria-label="Map controls" className="t-overlay absolute left-1/2 bottom-6 -translate-x-1/2 hidden md:flex items-center gap-2 p-2">
          <button type="button" className={`t-btn tier-azure h-12 ${marking ? 'text-gilt-hi' : ''}`} style={{ borderColor: 'var(--tier)' }} aria-pressed={marking} onClick={() => setMarking((m) => !m)}>
            <i className="t-diamond" />{marking ? 'Click a spot' : 'Mark a spot'}
            <kbd className="font-text text-[12px] tracking-normal text-bone-3 border border-rule px-1.5">P</kbd>
          </button>
          <button type="button" className="t-btn h-12" disabled={!party} onClick={() => party && camera.current?.focus(party)}>Find the company</button>
          <span className="w-px h-7 bg-rule" />
          <IconButton label="Rotate left" onClick={() => camera.current?.rotate(-1)} path="M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5" />
          <IconButton label="Rotate right" onClick={() => camera.current?.rotate(1)} path="M21 12a9 9 0 1 1-3-6.7L21 8 M21 3v5h-5" />
          <IconButton label="Zoom out" onClick={() => camera.current?.zoomBy(1 / 1.25)} path="M5 12h14" />
          <IconButton label="Zoom in" onClick={() => camera.current?.zoomBy(1.25)} path="M5 12h14M12 5v14" />
        </div>
      )}

      {doc && (
        <div className="md:hidden absolute right-3.5 top-1/2 -translate-y-[62%] flex flex-col gap-3">
          <button type="button" aria-label="Mark a spot" aria-pressed={marking} className="t-btn t-btn--icon t-overlay tier-azure w-[60px] h-[60px]" style={{ borderColor: 'var(--tier)' }} onClick={() => setMarking((m) => !m)}>
            <i className="t-diamond" style={{ width: 12, height: 12 }} />
          </button>
          <button type="button" aria-label="Find the company" disabled={!party} className="t-btn t-btn--icon t-overlay w-[60px] h-[60px] border-gilt-deep text-gilt" onClick={() => party && camera.current?.focus(party)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" aria-hidden="true"><path d="M6 21V4 M6 4h11l-3 4 3 4H6" /></svg>
          </button>
        </div>
      )}

      {marking && <div className="t-overlay absolute left-1/2 top-[104px] -translate-x-1/2 px-4 py-2.5 text-[15px]">Click the spot to mark it for everyone</div>}
      {doc && loadingMap && loadingMap !== doc.id && (
        <div className="t-overlay absolute left-1/2 bottom-[104px] -translate-x-1/2 px-4 py-2.5">
          <Loading label="The DM is unrolling another map…" />
        </div>
      )}
      {lastMark && !location && (
        <div className="t-overlay absolute left-5 bottom-6 hidden md:flex items-center gap-2.5 px-3.5 py-2 text-[15px]">
          <i className="t-diamond tier-azure" /><span><strong className="font-semibold">{lastMark}</strong> marked a spot</span>
        </div>
      )}
    </div>
  );
}

function LocationCard({ location, onClose }: { location: ShownLocation; onClose: () => void }) {
  const { pin, info, here, loading } = location;
  const kind = info?.type?.toLowerCase() || pin.data.pinType;
  return (
    <aside aria-label="Location" className="t-frame absolute flex flex-col shadow-[0_30px_60px_-24px_rgba(0,0,0,0.95)] left-0 right-0 bottom-0 md:left-auto md:bottom-auto md:right-5 md:top-[104px] md:w-[350px] max-h-[60svh] md:max-h-[calc(100svh-200px)] overflow-y-auto">
      {loading ? (
        <Shimmer className="hidden md:block w-full h-[150px] border-b border-gilt-deep" />
      ) : (
        <img src={info?.image ?? hero} alt="" className="hidden md:block w-full h-[150px] object-cover border-b border-gilt-deep" style={{ filter: 'saturate(0.55) brightness(0.85)' }} />
      )}
      <div className="flex flex-col gap-3 px-6 pt-5 pb-6">
        <div className="flex justify-between items-start gap-3">
          <span className="t-label text-gilt">{here ? 'The company is here' : 'On the map'} · {kind}</span>
          <button type="button" aria-label="Close" className="t-btn t-btn--quiet t-btn--icon h-7 w-7 -mt-1" onClick={onClose}>×</button>
        </div>
        <h2 className="t-h1 text-[26px]">{info?.name ?? pin.data.name}</h2>
        {loading ? (
          <div className="flex flex-col gap-2.5">
            <Loading label="Reading about this place…" />
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-4/5" />
          </div>
        ) : info?.playerDescription ? (
          <p className="t-lore m-0">{info.playerDescription}</p>
        ) : (
          <p className="t-small m-0">Nothing written about this place yet.</p>
        )}
      </div>
    </aside>
  );
}

function Portrait({ name, image, tier, own }: { name: string; image: string | null; tier: string; own?: boolean }) {
  // A portrait link can go stale (a sheet's avatar changed); fall back to initials.
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`t-portrait tier-${tier}`} style={own ? { borderColor: 'var(--gilt)' } : undefined}>
      {image && image !== failed ? <img src={image} alt="" className="h-full w-full object-cover" onError={() => setFailed(image)} /> : initials(name)}
    </span>
  );
}

function SeatPortrait({ seat }: { seat: Seat }) {
  return (
    <span className="t-portrait t-portrait--sm" title={seat.role === 'dm' ? `${seat.name} (DM)` : seat.name} style={seat.role === 'dm' ? { borderColor: 'var(--gilt)' } : undefined}>
      {seat.avatarUrl ? <img src={seat.avatarUrl} alt={seat.name} className="h-full w-full object-cover" /> : initials(seat.name)}
    </span>
  );
}

function IconButton({ label, path, onClick }: { label: string; path: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} className="t-btn t-btn--icon h-12 w-12 border-rule" onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d={path} /></svg>
    </button>
  );
}
