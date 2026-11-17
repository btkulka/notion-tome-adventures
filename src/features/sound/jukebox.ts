// The table jukebox: one music deck (a queue played in order) with up to
// MAX_LAYERS looping layers of ambience and effects under it. One-shot effects
// are fired, not kept, so they aren't part of this state.
//
// The DM's browser sends commands. The campaign's TableRoom (worker/table.ts)
// applies them with `reduce` against its own clock and sends everyone the
// result, so every browser plays the same sound at the same point in it.
// Pure: imported by both the Worker and the app.

export type SoundCategory = 'music' | 'ambience' | 'effect';
export const SOUND_CATEGORIES: SoundCategory[] = ['music', 'ambience', 'effect'];

export type SoundSource = { kind: 'file' } | { kind: 'youtube'; videoId: string; start: number };

/** A sound as the table plays it: enough to fetch and label it without the library. */
export interface SoundRef {
  id: string;
  name: string;
  source: SoundSource;
  /** Playable seconds; null until something measures it (a YouTube video's first player). */
  duration: number | null;
}

/** queue: play on and wrap round · track: repeat the current track · off: stop after the last. */
export type LoopMode = 'queue' | 'track' | 'off';

export interface MusicDeck {
  queue: SoundRef[];
  index: number;
  status: 'stopped' | 'playing' | 'paused';
  /** Server ms at which the current track stood at 0:00. Meaningful while playing. */
  startedAt: number;
  /** Seconds into the track while paused. */
  position: number;
  volume: number;
  loop: LoopMode;
}

export interface Layer {
  id: string;
  sound: SoundRef;
  volume: number;
  playing: boolean;
  /** Server ms the loop started at, so a late arrival joins it mid-loop. */
  startedAt: number;
}

export interface JukeboxState {
  rev: number;
  /** Everything, for everyone. */
  master: number;
  /** One-shot effects fired from the soundboard. */
  effects: number;
  /** Off at a table where everyone sits in one room: only the DM's speakers play. */
  playersHear: boolean;
  music: MusicDeck;
  layers: Layer[];
}

/** A saved mix: the music and layers a scene brings in. No music means the scene is music-free. */
export interface SceneMix {
  music: { queue: SoundRef[]; loop: LoopMode; volume: number } | null;
  layers: { sound: SoundRef; volume: number }[];
}

export type JukeboxCommand =
  | { op: 'play'; queue?: SoundRef[]; index?: number }
  | { op: 'enqueue'; sounds: SoundRef[]; next?: boolean }
  | { op: 'dequeue'; index: number }
  | { op: 'move'; from: number; to: number }
  | { op: 'pause' }
  | { op: 'resume' }
  | { op: 'stop' }
  | { op: 'skip'; by: 1 | -1 }
  | { op: 'seek'; position: number }
  /** A DM's player reached the end of the track that started at `startedAt`. */
  | { op: 'ended'; startedAt: number }
  | { op: 'musicVolume'; volume: number }
  | { op: 'loop'; mode: LoopMode }
  /** A player measured a sound (YouTube lengths are only known once one loads). */
  | { op: 'duration'; soundId: string; duration: number }
  | { op: 'addLayer'; sound: SoundRef; volume?: number }
  | { op: 'removeLayer'; id: string }
  | { op: 'layerVolume'; id: string; volume: number }
  | { op: 'layerPlaying'; id: string; playing: boolean }
  | { op: 'master'; volume: number }
  | { op: 'effectsVolume'; volume: number }
  | { op: 'playersHear'; on: boolean }
  | { op: 'scene'; mix: SceneMix }
  | { op: 'stopAll' };

export const MAX_LAYERS = 8;
export const MAX_QUEUE = 200;
/** Back past this far into a track restarts it rather than going to the one before. */
const RESTART_AFTER = 3;

export const emptyJukebox = (): JukeboxState => ({
  rev: 0,
  master: 0.8,
  effects: 0.8,
  playersHear: true,
  music: { queue: [], index: 0, status: 'stopped', startedAt: 0, position: 0, volume: 0.7, loop: 'queue' },
  layers: [],
});

/** Where a sound's bytes are served (worker/api/sounds.ts). */
export const soundFileUrl = (id: string) => `/api/sounds/${encodeURIComponent(id)}/file`;

/** Seconds into the current track at server time `now`, before any wrap at its end. */
export function trackElapsed(deck: MusicDeck, now: number): number {
  if (deck.status === 'paused') return deck.position;
  if (deck.status !== 'playing') return 0;
  return Math.max(0, (now - deck.startedAt) / 1000);
}

/** Seconds into the current track, wrapped when it repeats. */
export function trackPosition(deck: MusicDeck, now: number, duration = deck.queue[deck.index]?.duration ?? null): number {
  const t = trackElapsed(deck, now);
  return deck.loop === 'track' && duration ? t % duration : t;
}

/** Seconds into a layer's loop, or null while its length is unknown. */
export function layerPosition(layer: Layer, now: number, duration = layer.sound.duration): number | null {
  if (!duration) return null;
  return (Math.max(0, now - layer.startedAt) / 1000) % duration;
}

export const currentTrack = (s: JukeboxState): SoundRef | null =>
  s.music.status === 'stopped' ? null : s.music.queue[s.music.index] ?? null;

/** True when anything would come out of the speakers. */
export const isSounding = (s: JukeboxState | null): boolean =>
  Boolean(s && ((s.music.status === 'playing' && s.music.queue[s.music.index]) || s.layers.some((l) => l.playing)));

/** The mix playing now, to save as a scene. */
export function mixOf(s: JukeboxState): SceneMix {
  const m = s.music;
  return {
    music: m.queue.length && m.status !== 'stopped'
      ? { queue: [...m.queue.slice(m.index), ...m.queue.slice(0, m.index)], loop: m.loop, volume: m.volume }
      : null,
    layers: s.layers.filter((l) => l.playing).map((l) => ({ sound: l.sound, volume: l.volume })),
  };
}

// --- Cleaning what comes off the wire ----------------------------------------

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export function clampVolume(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/** A SoundRef from untrusted JSON, or null if it isn't one. */
export function cleanRef(x: unknown): SoundRef | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 64) return null;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 200) : 'Untitled';
  const s = r.source as Record<string, unknown> | undefined;
  let source: SoundSource;
  if (s?.kind === 'file') source = { kind: 'file' };
  else if (s?.kind === 'youtube' && typeof s.videoId === 'string' && YT_ID.test(s.videoId)) {
    source = { kind: 'youtube', videoId: s.videoId, start: typeof s.start === 'number' && s.start > 0 && Number.isFinite(s.start) ? s.start : 0 };
  } else return null;
  const duration = typeof r.duration === 'number' && Number.isFinite(r.duration) && r.duration > 0 ? r.duration : null;
  return { id: r.id, name, source, duration };
}

const cleanRefs = (x: unknown, max: number): SoundRef[] =>
  Array.isArray(x) ? x.slice(0, max).map(cleanRef).filter((r): r is SoundRef => r !== null) : [];

const LOOPS: LoopMode[] = ['queue', 'track', 'off'];

/** Stored or received state, made whole. Anything unusable falls back to the empty jukebox. */
export function normalizeJukebox(x: unknown): JukeboxState {
  const base = emptyJukebox();
  if (!x || typeof x !== 'object') return base;
  const s = x as Record<string, unknown>;
  const m = (s.music ?? {}) as Record<string, unknown>;
  const queue = cleanRefs(m.queue, MAX_QUEUE);
  const index = typeof m.index === 'number' && m.index >= 0 && m.index < queue.length ? Math.floor(m.index) : 0;
  const status = m.status === 'playing' || m.status === 'paused' ? m.status : 'stopped';
  return {
    rev: typeof s.rev === 'number' ? s.rev : 0,
    master: clampVolume(s.master, base.master),
    effects: clampVolume(s.effects, base.effects),
    playersHear: typeof s.playersHear === 'boolean' ? s.playersHear : true,
    music: {
      queue,
      index,
      status: queue.length ? status : 'stopped',
      startedAt: typeof m.startedAt === 'number' ? m.startedAt : 0,
      position: typeof m.position === 'number' && m.position >= 0 ? m.position : 0,
      volume: clampVolume(m.volume, base.music.volume),
      loop: LOOPS.includes(m.loop as LoopMode) ? (m.loop as LoopMode) : 'queue',
    },
    layers: (Array.isArray(s.layers) ? s.layers : []).slice(0, MAX_LAYERS).flatMap((l) => {
      const layer = l as Record<string, unknown>;
      const sound = cleanRef(layer?.sound);
      if (!sound || typeof layer.id !== 'string') return [];
      return [{
        id: layer.id,
        sound,
        volume: clampVolume(layer.volume, 0.6),
        playing: layer.playing !== false,
        startedAt: typeof layer.startedAt === 'number' ? layer.startedAt : 0,
      }];
    }),
  };
}

// --- The reducer ---------------------------------------------------------------

export interface ReduceOptions {
  makeId?: () => string;
}

/**
 * Applies a command at server time `now`. Returns `state` itself when the
 * command changes nothing (or makes no sense), so the caller knows not to save
 * or send anything.
 */
export function reduce(state: JukeboxState, command: JukeboxCommand, now: number, { makeId = () => crypto.randomUUID() }: ReduceOptions = {}): JukeboxState {
  const next = apply(state, command, now, makeId);
  return next === state ? state : { ...next, rev: state.rev + 1 };
}

function withMusic(s: JukeboxState, music: Partial<MusicDeck>): JukeboxState {
  return { ...s, music: { ...s.music, ...music } };
}

/** The deck moved to `index`, keeping it playing (from 0:00), paused (at 0:00) or stopped. */
function jumpTo(s: JukeboxState, index: number, now: number, status = s.music.status): JukeboxState {
  return withMusic(s, { index, status, startedAt: now, position: 0 });
}

function updateLayer(s: JukeboxState, id: string, change: (l: Layer) => Layer): JukeboxState {
  const i = s.layers.findIndex((l) => l.id === id);
  if (i < 0) return s;
  const layers = s.layers.slice();
  layers[i] = change(layers[i]);
  return { ...s, layers };
}

function apply(s: JukeboxState, cmd: JukeboxCommand, now: number, makeId: () => string): JukeboxState {
  const m = s.music;
  switch (cmd?.op) {
    case 'play': {
      const queue = cmd.queue === undefined ? m.queue : cleanRefs(cmd.queue, MAX_QUEUE);
      if (!queue.length) return s;
      const index = typeof cmd.index === 'number' && cmd.index >= 0 && cmd.index < queue.length ? Math.floor(cmd.index) : 0;
      return withMusic(s, { queue, index, status: 'playing', startedAt: now, position: 0 });
    }

    case 'enqueue': {
      const sounds = cleanRefs(cmd.sounds, MAX_QUEUE - m.queue.length);
      if (!sounds.length) return s;
      if (!m.queue.length) return withMusic(s, { queue: sounds, index: 0 });
      const at = cmd.next ? m.index + 1 : m.queue.length;
      return withMusic(s, { queue: [...m.queue.slice(0, at), ...sounds, ...m.queue.slice(at)] });
    }

    case 'dequeue': {
      const i = cmd.index;
      if (typeof i !== 'number' || i < 0 || i >= m.queue.length) return s;
      const queue = m.queue.filter((_, n) => n !== i);
      if (!queue.length) return withMusic(s, { queue, index: 0, status: 'stopped', position: 0 });
      if (i < m.index) return withMusic(s, { queue, index: m.index - 1 });
      if (i > m.index) return withMusic(s, { queue });
      // The current track went: the one after it takes its place.
      const index = m.index < queue.length ? m.index : 0;
      const status = m.index < queue.length || m.loop === 'queue' ? m.status : 'stopped';
      return withMusic(s, { queue, index, status, startedAt: now, position: 0 });
    }

    case 'move': {
      const { from, to } = cmd;
      const n = m.queue.length;
      if (typeof from !== 'number' || typeof to !== 'number' || from < 0 || from >= n || to < 0 || to >= n || from === to) return s;
      const queue = m.queue.slice();
      const [moved] = queue.splice(from, 1);
      queue.splice(to, 0, moved);
      let index = m.index;
      if (from === m.index) index = to;
      else if (from < m.index && to >= m.index) index--;
      else if (from > m.index && to <= m.index) index++;
      return withMusic(s, { queue, index });
    }

    case 'pause':
      if (m.status !== 'playing') return s;
      return withMusic(s, { status: 'paused', position: trackPosition(m, now) });

    case 'resume':
      if (m.status === 'paused') return withMusic(s, { status: 'playing', startedAt: now - m.position * 1000 });
      if (m.status === 'stopped' && m.queue.length) return jumpTo(s, m.index, now, 'playing');
      return s;

    case 'stop':
      if (m.status === 'stopped') return s;
      return withMusic(s, { status: 'stopped', position: 0 });

    case 'skip': {
      if (!m.queue.length) return s;
      if (cmd.by === -1) {
        if (m.status !== 'stopped' && trackPosition(m, now) > RESTART_AFTER) return jumpTo(s, m.index, now);
        if (m.index > 0) return jumpTo(s, m.index - 1, now);
        return jumpTo(s, m.loop === 'queue' ? m.queue.length - 1 : 0, now);
      }
      if (cmd.by !== 1) return s;
      if (m.index + 1 < m.queue.length) return jumpTo(s, m.index + 1, now);
      return m.loop === 'queue' ? jumpTo(s, 0, now) : jumpTo(s, 0, now, 'stopped');
    }

    case 'seek': {
      if (m.status === 'stopped' || typeof cmd.position !== 'number' || !Number.isFinite(cmd.position)) return s;
      const d = m.queue[m.index]?.duration;
      const position = Math.max(0, d ? Math.min(cmd.position, d) : cmd.position);
      return m.status === 'playing' ? withMusic(s, { startedAt: now - position * 1000 }) : withMusic(s, { position });
    }

    case 'ended': {
      // Two DM windows both report the end; only the first moves the deck on.
      if (m.status !== 'playing' || cmd.startedAt !== m.startedAt) return s;
      if (m.loop === 'track') return withMusic(s, { startedAt: now });
      if (m.index + 1 < m.queue.length) return jumpTo(s, m.index + 1, now);
      return m.loop === 'queue' ? jumpTo(s, 0, now) : jumpTo(s, 0, now, 'stopped');
    }

    case 'musicVolume': {
      const volume = clampVolume(cmd.volume, m.volume);
      return volume === m.volume ? s : withMusic(s, { volume });
    }

    case 'loop':
      if (!LOOPS.includes(cmd.mode) || cmd.mode === m.loop) return s;
      // Leaving a repeat keeps the spot in the track rather than the time since it first began.
      if (m.loop === 'track' && m.status === 'playing') {
        return withMusic(s, { loop: cmd.mode, startedAt: now - trackPosition(m, now) * 1000 });
      }
      return withMusic(s, { loop: cmd.mode });

    case 'duration': {
      const d = cmd.duration;
      if (typeof cmd.soundId !== 'string' || typeof d !== 'number' || !Number.isFinite(d) || d <= 0) return s;
      const fill = (r: SoundRef) => (r.id === cmd.soundId && (r.duration === null || Math.abs(r.duration - d) > 1) ? { ...r, duration: d } : r);
      const queue = m.queue.map(fill);
      const layers = s.layers.map((l) => {
        const sound = fill(l.sound);
        return sound === l.sound ? l : { ...l, sound };
      });
      if (queue.every((r, i) => r === m.queue[i]) && layers.every((l, i) => l === s.layers[i])) return s;
      return { ...s, music: { ...m, queue }, layers };
    }

    case 'addLayer': {
      const sound = cleanRef(cmd.sound);
      if (!sound || s.layers.length >= MAX_LAYERS) return s;
      return { ...s, layers: [...s.layers, { id: makeId(), sound, volume: clampVolume(cmd.volume, 0.6), playing: true, startedAt: now }] };
    }

    case 'removeLayer': {
      const layers = s.layers.filter((l) => l.id !== cmd.id);
      return layers.length === s.layers.length ? s : { ...s, layers };
    }

    case 'layerVolume':
      return updateLayer(s, cmd.id, (l) => ({ ...l, volume: clampVolume(cmd.volume, l.volume) }));

    case 'layerPlaying':
      if (typeof cmd.playing !== 'boolean') return s;
      return updateLayer(s, cmd.id, (l) => (l.playing === cmd.playing ? l : { ...l, playing: cmd.playing, startedAt: cmd.playing ? now : l.startedAt }));

    case 'master': {
      const master = clampVolume(cmd.volume, s.master);
      return master === s.master ? s : { ...s, master };
    }

    case 'effectsVolume': {
      const effects = clampVolume(cmd.volume, s.effects);
      return effects === s.effects ? s : { ...s, effects };
    }

    case 'playersHear':
      return typeof cmd.on !== 'boolean' || cmd.on === s.playersHear ? s : { ...s, playersHear: cmd.on };

    case 'scene':
      return applyScene(s, cmd.mix, now, makeId);

    case 'stopAll':
      if (m.status === 'stopped' && !s.layers.some((l) => l.playing)) return s;
      return { ...s, music: { ...m, status: 'stopped', position: 0 }, layers: s.layers.map((l) => (l.playing ? { ...l, playing: false } : l)) };

    default:
      return s;
  }
}

/** A scene replaces the mix. Sounds already playing carry on rather than restarting. */
function applyScene(s: JukeboxState, mix: SceneMix | undefined, now: number, makeId: () => string): JukeboxState {
  if (!mix || typeof mix !== 'object') return s;
  const m = s.music;

  let music: MusicDeck;
  const queue = cleanRefs(mix.music?.queue, MAX_QUEUE);
  if (!mix.music || !queue.length) {
    music = { ...m, status: 'stopped', position: 0 };
  } else {
    const loop = LOOPS.includes(mix.music.loop) ? mix.music.loop : m.loop;
    const volume = clampVolume(mix.music.volume, m.volume);
    const carryOn = m.status === 'playing' && m.queue[m.index]?.id === queue[0].id;
    music = carryOn
      ? { ...m, queue, index: 0, loop, volume }
      : { ...m, queue, index: 0, loop, volume, status: 'playing', startedAt: now, position: 0 };
  }

  const wanted = (Array.isArray(mix.layers) ? mix.layers : []).slice(0, MAX_LAYERS);
  const layers: Layer[] = [];
  const reused = new Set<string>();
  for (const w of wanted) {
    const sound = cleanRef(w?.sound);
    if (!sound) continue;
    const volume = clampVolume(w.volume, 0.6);
    const same = s.layers.find((l) => l.playing && l.sound.id === sound.id && !reused.has(l.id));
    if (same) {
      reused.add(same.id);
      layers.push({ ...same, volume });
    } else {
      layers.push({ id: makeId(), sound, volume, playing: true, startedAt: now });
    }
  }
  return { ...s, music, layers };
}
