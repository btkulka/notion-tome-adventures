// Client for the jukebox library and scenes (worker/api/sounds.ts).
import { api, ApiError } from '@/lib/api';
import type { SceneMix, SoundCategory, SoundRef } from './jukebox';

export interface LibrarySound extends SoundRef {
  campaignId: string;
  category: SoundCategory;
  size: number | null;
  mime: string | null;
  createdAt: string;
}

export interface SoundScene {
  id: string;
  campaignId: string;
  name: string;
  mix: SceneMix;
  updatedAt: string;
}

export interface Library {
  sounds: LibrarySound[];
  /** False until R2 is bound to the Worker; YouTube still works. */
  uploads: boolean;
}

/** What the table needs of a library sound. */
export const toRef = (s: LibrarySound): SoundRef => ({ id: s.id, name: s.name, source: s.source, duration: s.duration });

const campaign = (id: string) => `/api/campaigns/${encodeURIComponent(id)}`;
const sound = (id: string) => `/api/sounds/${encodeURIComponent(id)}`;

const EXTENSION_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac',
  m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', mp4: 'audio/mp4',
};

/** A file's audio type, from the browser or its extension (Windows leaves some blank). */
export function audioType(file: File): string | null {
  if (/^audio\//.test(file.type) || /^video\/(mp4|webm|ogg)$/.test(file.type)) return file.type;
  return EXTENSION_TYPES[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? null;
}

/** "Rain_on_tent-loop (final).mp3" → "Rain on tent loop (final)". */
export function nameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+-\s+|-(?=\S)/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled';
}

/** How long an audio file plays, read from its metadata here before it uploads. */
export function measureDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = new Audio();
    const done = (value: number | null) => {
      clearTimeout(timer);
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), 8000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) && el.duration > 0 ? el.duration : null);
    el.onerror = () => done(null);
    el.src = url;
  });
}

export const soundsApi = {
  list: (campaignId: string) => api<Library>(`${campaign(campaignId)}/sounds`),

  addYouTube: (campaignId: string, url: string, category: SoundCategory) =>
    api<{ sound: LibrarySound; existing: boolean }>(`${campaign(campaignId)}/sounds/youtube`, { body: { url, category } }),

  /** Uploads with progress (0–1), which fetch can't report. */
  upload(campaignId: string, file: File, category: SoundCategory, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<LibrarySound> {
    return measureDuration(file).then(
      (duration) =>
        new Promise<LibrarySound>((resolve, reject) => {
          const type = audioType(file);
          if (!type) return reject(new ApiError(`${file.name} isn't an audio file Tome can play`, 400));
          const query = new URLSearchParams({ name: nameFromFile(file), category });
          if (duration) query.set('duration', String(duration));
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', `${campaign(campaignId)}/sounds/upload?${query}`);
          xhr.setRequestHeader('Content-Type', type);
          xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
          xhr.onload = () => {
            let body: { sound?: LibrarySound; error?: string } = {};
            try {
              body = JSON.parse(xhr.responseText);
            } catch {
              // Not JSON: fall through to the status.
            }
            if (xhr.status >= 200 && xhr.status < 300 && body.sound) resolve(body.sound);
            else reject(new ApiError(body.error || `Upload failed (HTTP ${xhr.status})`, xhr.status));
          };
          xhr.onerror = () => reject(new ApiError('The upload was cut off', 0));
          xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
          signal?.addEventListener('abort', () => xhr.abort(), { once: true });
          xhr.send(file);
        })
    );
  },

  update: (id: string, change: { name?: string; category?: SoundCategory; duration?: number }) =>
    api<{ sound: LibrarySound }>(sound(id), { method: 'PATCH', body: change }).then((r) => r.sound),

  remove: (id: string) => api(sound(id), { method: 'DELETE' }),

  scenes: (campaignId: string) => api<{ scenes: SoundScene[] }>(`${campaign(campaignId)}/sound-scenes`).then((r) => r.scenes),

  saveScene: (campaignId: string, name: string, mix: SceneMix) =>
    api<{ scene: SoundScene }>(`${campaign(campaignId)}/sound-scenes`, { body: { name, mix } }).then((r) => r.scene),

  updateScene: (id: string, change: { name?: string; mix?: SceneMix }) =>
    api<{ scene: SoundScene }>(`/api/sound-scenes/${encodeURIComponent(id)}`, { method: 'PUT', body: change }).then((r) => r.scene),

  removeScene: (id: string) => api(`/api/sound-scenes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/** A sound's length for lists: tenths for a short effect ("0.8s"), clock time otherwise. */
export function formatLength(seconds: number | null | undefined): string | null {
  if (!seconds) return null;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : formatTime(seconds);
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '–:––';
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
