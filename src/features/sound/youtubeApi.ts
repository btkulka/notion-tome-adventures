// Loads YouTube's IFrame Player API once, and types the little of it the jukebox uses.

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData?(): { isLive?: boolean; title?: string };
  destroy(): void;
}

interface YTEvent {
  target: YTPlayer;
  data: number;
}

interface YTPlayerOptions {
  width: number;
  height: number;
  videoId: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTEvent) => void;
    onStateChange?: (e: YTEvent) => void;
    onError?: (e: YTEvent) => void;
  };
}

interface YTNamespace {
  Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** What YouTube's error codes mean for the table. */
export function youTubeError(code: number): string {
  if (code === 101 || code === 150 || code === 153) return "The video's owner doesn't allow it to play outside YouTube";
  if (code === 100) return 'The video is gone or private';
  if (code === 2) return 'That is not a YouTube video';
  return 'YouTube could not play this video';
}

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  loading ??= new Promise<YTNamespace>((resolve, reject) => {
    const before = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      before?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error('Could not reach YouTube'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
