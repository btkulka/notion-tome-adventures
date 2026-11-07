// Client for the Worker's map routes (worker/api/maps.ts).
import { api } from '@/lib/api';
import type { GeneratedOverworld } from './gen/overworld';
import { decodeTerrain, encodeTerrain } from './terrain/codec';
import type {
  EncounterRules,
  LiveSession,
  MapDoc,
  MapObject,
  MapSettings,
  MapSummary,
  OverworldGenParams,
  StoredTerrain,
  TravelLogEntry,
} from './types';

export const DEFAULT_ENCOUNTER_RULES: EncounterRules = {
  checkEveryHours: 4,
  chancePercent: 15,
  checkAtNight: true,
  difficulty: 'medium',
  maxMonsters: 6,
};

export const emptySettings = (): MapSettings => ({ biomeEnvironments: {}, encounters: { ...DEFAULT_ENCOUNTER_RULES } });

interface MapWire extends Omit<MapDoc, 'terrain' | 'settings'> {
  terrain: StoredTerrain;
  settings: Partial<MapSettings>;
}

const fromWire = (m: MapWire): MapDoc => ({
  ...m,
  terrain: decodeTerrain(m.terrain, m.width, m.height),
  settings: { ...emptySettings(), ...m.settings, encounters: { ...DEFAULT_ENCOUNTER_RULES, ...m.settings?.encounters } },
});

const campaign = (id: string) => `/api/campaigns/${encodeURIComponent(id)}`;
const map = (id: string) => `/api/maps/${encodeURIComponent(id)}`;

export const mapsApi = {
  list: async (campaignId: string) => (await api<{ maps: MapSummary[] }>(`${campaign(campaignId)}/maps`)).maps,

  get: async (mapId: string) => fromWire((await api<{ map: MapWire }>(map(mapId))).map),

  /** A new overworld from a generated region: terrain plus named rivers and regions, roads and hidden settlement pins. */
  createOverworld: async (campaignId: string, name: string, params: OverworldGenParams, region: GeneratedOverworld) => {
    const objects: Omit<MapObject, 'id' | 'mapId'>[] = [
      ...region.rivers.map((points, n) => ({
        type: 'path' as const, x: points[0][0], y: points[0][1], z: 0, rot: 0, hidden: false,
        data: { kind: 'river' as const, points, name: region.riverNames[n] },
      })),
      ...region.labels.map((l) => ({ type: 'label' as const, x: l.x, y: l.y, z: 0, rot: 0, hidden: false, data: { text: l.text, size: 1 } })),
      ...region.roads.map((points) => ({ type: 'path' as const, x: points[0][0], y: points[0][1], z: 0, rot: 0, hidden: false, data: { kind: 'road' as const, points } })),
      ...region.settlements.map((s) => ({
        type: 'pin' as const, x: s.x, y: s.y, z: 0, rot: 0, hidden: true,
        data: { pinType: s.pinType, name: s.name, notionLocationId: null, childMapId: null, autoReveal: true },
      })),
    ];
    const { id } = await api<{ id: string }>(`${campaign(campaignId)}/maps`, {
      method: 'POST',
      body: {
        name, kind: 'overworld', width: params.width, height: params.height, scale: 1, seed: params.seed,
        genParams: params, terrain: encodeTerrain(region.terrain), settings: emptySettings(), objects,
      },
    });
    return id;
  },

  /** Saves changed fields; fails with 409 if someone saved in between. Returns the new version. */
  save: async (doc: Pick<MapDoc, 'id' | 'version'>, fields: Partial<Pick<MapDoc, 'name' | 'terrain' | 'settings' | 'genParams'>>) => {
    const body: Record<string, unknown> = { version: doc.version };
    if (fields.name !== undefined) body.name = fields.name;
    if (fields.terrain) body.terrain = encodeTerrain(fields.terrain);
    if (fields.settings) body.settings = fields.settings;
    if (fields.genParams !== undefined) body.genParams = fields.genParams;
    return (await api<{ version: number }>(map(doc.id), { method: 'PUT', body })).version;
  },

  remove: (mapId: string) => api(map(mapId), { method: 'DELETE' }),

  objects: async (mapId: string) => (await api<{ objects: MapObject[] }>(`${map(mapId)}/objects`)).objects,

  saveObjects: async (mapId: string, objects: (Partial<MapObject> & Pick<MapObject, 'type'>)[]) =>
    (await api<{ objects: MapObject[] }>(`${map(mapId)}/objects`, { method: 'PUT', body: { objects } })).objects,

  removeObject: (mapId: string, objectId: string) => api(`${map(mapId)}/objects/${encodeURIComponent(objectId)}`, { method: 'DELETE' }),

  fog: async (mapId: string) => (await api<{ explored: string | null }>(`${map(mapId)}/fog`)).explored,

  saveFog: (mapId: string, explored: string) => api(`${map(mapId)}/fog`, { method: 'PUT', body: { explored } }),

  live: async (campaignId: string) => (await api<{ live: LiveSession | null }>(`${campaign(campaignId)}/live`)).live,

  updateLive: async (campaignId: string, fields: Partial<Omit<LiveSession, 'campaignId' | 'updatedAt'>>) =>
    (await api<{ live: LiveSession }>(`${campaign(campaignId)}/live`, { method: 'PUT', body: fields })).live,

  logTravel: (campaignId: string, entry: Omit<TravelLogEntry, 'id' | 'campaignId' | 'createdAt'>) =>
    api<{ id: string }>(`${campaign(campaignId)}/travel`, { method: 'POST', body: entry }),

  travelLog: async (campaignId: string) => (await api<{ log: TravelLogEntry[] }>(`${campaign(campaignId)}/travel`)).log,
};
