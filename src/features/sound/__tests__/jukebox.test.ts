import { describe, expect, it } from 'vitest';
import {
  emptyJukebox,
  layerPosition,
  mixOf,
  normalizeJukebox,
  reduce,
  trackPosition,
  type JukeboxCommand,
  type JukeboxState,
  type SoundRef,
} from '../jukebox';
import { isPlaylistOnly, parseTimestamp, parseYouTube } from '../youtube';

const track = (id: string, duration: number | null = 180): SoundRef => ({ id, name: id.toUpperCase(), source: { kind: 'file' }, duration });
const yt = (id: string, videoId = 'dQw4w9WgXcQ'): SoundRef => ({ id, name: id, source: { kind: 'youtube', videoId, start: 0 }, duration: null });

let ids = 0;
const makeId = () => `layer-${++ids}`;
const run = (s: JukeboxState, cmd: JukeboxCommand, now = 0) => reduce(s, cmd, now, { makeId });

const playing = (queue = [track('a'), track('b'), track('c')], now = 1000) => run(emptyJukebox(), { op: 'play', queue }, now);

describe('music deck', () => {
  it('plays a queue from the top and stamps the start', () => {
    const s = playing();
    expect(s.music).toMatchObject({ index: 0, status: 'playing', startedAt: 1000 });
    expect(s.rev).toBe(1);
  });

  it('returns the same state for a command that changes nothing', () => {
    const s = playing();
    expect(run(s, { op: 'resume' })).toBe(s);
    expect(run(s, { op: 'musicVolume', volume: s.music.volume })).toBe(s);
    expect(run(emptyJukebox(), { op: 'play' })).toEqual(emptyJukebox());
  });

  it('pauses at the right spot and resumes from it', () => {
    const paused = run(playing(), { op: 'pause' }, 31_000);
    expect(paused.music).toMatchObject({ status: 'paused', position: 30 });
    const resumed = run(paused, { op: 'resume' }, 100_000);
    expect(trackPosition(resumed.music, 100_000)).toBe(30);
    expect(trackPosition(resumed.music, 105_000)).toBe(35);
  });

  it('skips forward, wraps the queue, and stops at the end when not looping', () => {
    let s = playing();
    s = run(s, { op: 'skip', by: 1 }, 2000);
    expect(s.music).toMatchObject({ index: 1, startedAt: 2000, status: 'playing' });
    s = run(run(s, { op: 'skip', by: 1 }), { op: 'skip', by: 1 }, 3000);
    expect(s.music).toMatchObject({ index: 0, status: 'playing' });
    const off = run(run(playing(), { op: 'loop', mode: 'off' }), { op: 'skip', by: 1 });
    expect(run(run(off, { op: 'skip', by: 1 }), { op: 'skip', by: 1 }).music.status).toBe('stopped');
  });

  it('goes back a track early on, and restarts the track later on', () => {
    const s = run(playing(), { op: 'skip', by: 1 }, 2000);
    expect(run(s, { op: 'skip', by: -1 }, 3000).music.index).toBe(0);
    const restarted = run(s, { op: 'skip', by: -1 }, 60_000);
    expect(restarted.music).toMatchObject({ index: 1, startedAt: 60_000 });
  });

  it('moves on when a track ends, once, however many windows report it', () => {
    const s = playing();
    const next = run(s, { op: 'ended', startedAt: 1000 }, 181_000);
    expect(next.music).toMatchObject({ index: 1, startedAt: 181_000 });
    expect(run(next, { op: 'ended', startedAt: 1000 }, 181_050)).toBe(next);
  });

  it('repeats a track that loops, and positions wrap within it', () => {
    const s = run(playing([track('a', 100)]), { op: 'loop', mode: 'track' });
    expect(trackPosition(s.music, 1000 + 250_000)).toBe(50);
    expect(run(s, { op: 'ended', startedAt: 1000 }, 101_000).music.startedAt).toBe(101_000);
    // Leaving the repeat keeps the spot in the track.
    const off = run(s, { op: 'loop', mode: 'queue' }, 1000 + 250_000);
    expect(trackPosition(off.music, 1000 + 250_000)).toBe(50);
  });

  it('seeks within the track, clamped to its length', () => {
    const s = run(playing(), { op: 'seek', position: 9999 }, 5000);
    expect(trackPosition(s.music, 5000)).toBe(180);
    const paused = run(run(playing(), { op: 'pause' }, 2000), { op: 'seek', position: 42 });
    expect(paused.music.position).toBe(42);
  });

  it('queues after the current track or at the end, keeping the current track current', () => {
    let s = playing([track('a'), track('b')]);
    s = run(s, { op: 'enqueue', sounds: [track('x')], next: true });
    expect(s.music.queue.map((t) => t.id)).toEqual(['a', 'x', 'b']);
    s = run(s, { op: 'move', from: 0, to: 2 });
    expect(s.music.queue.map((t) => t.id)).toEqual(['x', 'b', 'a']);
    expect(s.music.index).toBe(2);
  });

  it('removing the current track plays the one after it', () => {
    const s = run(run(playing(), { op: 'skip', by: 1 }, 2000), { op: 'dequeue', index: 1 }, 9000);
    expect(s.music.queue.map((t) => t.id)).toEqual(['a', 'c']);
    expect(s.music).toMatchObject({ index: 1, startedAt: 9000, status: 'playing' });
  });

  it('fills in a measured length everywhere the sound appears', () => {
    let s = run(emptyJukebox(), { op: 'play', queue: [yt('v')] });
    s = run(s, { op: 'addLayer', sound: yt('v') });
    s = run(s, { op: 'duration', soundId: 'v', duration: 212 });
    expect(s.music.queue[0].duration).toBe(212);
    expect(s.layers[0].sound.duration).toBe(212);
    expect(run(s, { op: 'duration', soundId: 'v', duration: 212.4 })).toBe(s);
  });

  it('refuses malformed sounds', () => {
    const bad = { id: 'x', name: 'x', source: { kind: 'youtube', videoId: 'not-an-id' }, duration: null } as unknown as SoundRef;
    expect(run(emptyJukebox(), { op: 'play', queue: [bad] })).toEqual(emptyJukebox());
    expect(run(emptyJukebox(), { op: 'addLayer', sound: bad }).layers).toHaveLength(0);
  });
});

describe('layers', () => {
  it('adds up to eight, each looping from when it began', () => {
    let s = emptyJukebox();
    for (let i = 0; i < 10; i++) s = run(s, { op: 'addLayer', sound: track(`l${i}`, 60) }, 5000);
    expect(s.layers).toHaveLength(8);
    expect(layerPosition(s.layers[0], 5000 + 90_000)).toBe(30);
  });

  it('mutes, unmutes from the top, and removes', () => {
    let s = run(emptyJukebox(), { op: 'addLayer', sound: track('rain', 60), volume: 0.4 }, 0);
    const id = s.layers[0].id;
    s = run(s, { op: 'layerPlaying', id, playing: false });
    expect(s.layers[0].playing).toBe(false);
    s = run(s, { op: 'layerPlaying', id, playing: true }, 7000);
    expect(s.layers[0]).toMatchObject({ playing: true, startedAt: 7000, volume: 0.4 });
    expect(run(s, { op: 'removeLayer', id }).layers).toHaveLength(0);
  });

  it('stop all silences everything but keeps the layers to bring back', () => {
    let s = run(playing(), { op: 'addLayer', sound: track('fire') });
    s = run(s, { op: 'stopAll' });
    expect(s.music.status).toBe('stopped');
    expect(s.layers).toHaveLength(1);
    expect(s.layers[0].playing).toBe(false);
  });
});

describe('scenes', () => {
  it('a scene replaces the mix, and what already plays carries on', () => {
    let s = run(playing([track('tavern')], 1000), { op: 'addLayer', sound: track('fire') }, 1000);
    const fireId = s.layers[0].id;
    s = run(s, {
      op: 'scene',
      mix: { music: { queue: [track('tavern'), track('jig')], loop: 'queue', volume: 0.5 }, layers: [{ sound: track('fire'), volume: 0.3 }, { sound: track('crowd'), volume: 0.6 }] },
    }, 50_000);
    expect(s.music).toMatchObject({ startedAt: 1000, volume: 0.5, index: 0 });
    expect(s.music.queue).toHaveLength(2);
    expect(s.layers.map((l) => l.sound.id)).toEqual(['fire', 'crowd']);
    expect(s.layers[0]).toMatchObject({ id: fireId, volume: 0.3, startedAt: 1000 });
    expect(s.layers[1].startedAt).toBe(50_000);
  });

  it('a scene without music stops the music', () => {
    const s = run(playing(), { op: 'scene', mix: { music: null, layers: [{ sound: track('wind'), volume: 0.5 }] } });
    expect(s.music.status).toBe('stopped');
    expect(s.layers).toHaveLength(1);
  });

  it('saves the mix starting from the current track', () => {
    let s = run(playing(), { op: 'skip', by: 1 });
    s = run(s, { op: 'addLayer', sound: track('rain') });
    const mix = mixOf(s);
    expect(mix.music?.queue.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(mix.layers.map((l) => l.sound.id)).toEqual(['rain']);
  });
});

describe('normalizeJukebox', () => {
  it('makes stored junk whole', () => {
    expect(normalizeJukebox(null)).toEqual(emptyJukebox());
    const s = normalizeJukebox({ master: 7, music: { queue: [track('a')], index: 4, status: 'playing' }, layers: [{ nope: true }] });
    expect(s.master).toBe(1);
    expect(s.music.index).toBe(0);
    expect(s.music.status).toBe('playing');
    expect(s.layers).toEqual([]);
  });
});

describe('YouTube links', () => {
  it('reads the usual link shapes', () => {
    expect(parseYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('youtu.be/dQw4w9WgXcQ?t=1m30s')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 90 });
    expect(parseYouTube('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD123')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 0 });
    expect(parseYouTube('https://www.youtube.com/embed/dQw4w9WgXcQ?start=42')).toEqual({ videoId: 'dQw4w9WgXcQ', start: 42 });
    expect(parseYouTube('https://youtube.com/shorts/dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
    expect(parseYouTube('https://www.youtube.com/live/dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
    expect(parseYouTube('dQw4w9WgXcQ')?.videoId).toBe('dQw4w9WgXcQ');
  });

  it('rejects what is not a video', () => {
    expect(parseYouTube('https://vimeo.com/123')).toBeNull();
    expect(parseYouTube('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseYouTube('hello there')).toBeNull();
    expect(isPlaylistOnly('https://www.youtube.com/playlist?list=PL123')).toBe(true);
    expect(isPlaylistOnly('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123')).toBe(false);
  });

  it('reads timestamps', () => {
    expect(parseTimestamp('1h2m3s')).toBe(3723);
    expect(parseTimestamp('75')).toBe(75);
    expect(parseTimestamp('45s')).toBe(45);
    expect(parseTimestamp('bogus')).toBe(0);
  });
});
