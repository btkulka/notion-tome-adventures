// Reading YouTube links. Pure: the Worker checks links with it before saving them.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'youtube-nocookie.com', 'youtu.be']);

export interface YouTubeLink {
  videoId: string;
  /** Seconds to start at, from `t=` or `start=`. */
  start: number;
}

/** "90", "90s", "1m30s", "1h2m3s" → seconds. */
export function parseTimestamp(t: string | null | undefined): number {
  if (!t) return 0;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.floor(Number(t));
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || !t) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function toUrl(input: string): URL | null {
  try {
    return new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
}

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
}

/** A single video from a link (or a bare video id), or null if the text isn't one. */
export function parseYouTube(input: string): YouTubeLink | null {
  const text = input.trim();
  if (VIDEO_ID.test(text)) return { videoId: text, start: 0 };
  const url = toUrl(text);
  if (!url || !HOSTS.has(hostOf(url))) return null;

  let id: string | null = null;
  if (hostOf(url) === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (url.pathname === '/watch') id = url.searchParams.get('v');
  else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1] ?? null;

  if (!id || !VIDEO_ID.test(id)) return null;
  return { videoId: id, start: parseTimestamp(url.searchParams.get('t') ?? url.searchParams.get('start')) };
}

/** True for a playlist link that names no particular video. */
export function isPlaylistOnly(input: string): boolean {
  const url = toUrl(input.trim());
  return Boolean(url && HOSTS.has(hostOf(url)) && url.searchParams.get('list') && !parseYouTube(input));
}

export const youTubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
export const youTubeWatchUrl = (videoId: string, start = 0) => `https://www.youtube.com/watch?v=${videoId}${start ? `&t=${Math.floor(start)}s` : ''}`;
