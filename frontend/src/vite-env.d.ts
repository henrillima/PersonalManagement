/// <reference types="vite/client" />

interface Window {
  YT: {
    Player: new (elementId: string, options: Record<string, unknown>) => void;
    PlayerState: {
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  };
  onYouTubeIframeAPIReady: (() => void) | null;
}