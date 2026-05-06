"use client";

import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MUTE_STORAGE_KEY = "isMuted";
const PLAYBACK_STATE_KEY = "introAudioPlaybackState";
const PLAYLIST = [
  "feeling-good.mp3",
  "make-it-weirder.mp3",
  "Chum Drum Bedrum.mp3",
  "Grandayy - Lil Globglogabgalab.mp3",
  "Hilarious Chinese Song!.mp3",
  "Lush Life _ Funny Indian Remix _ Vindaloo Singh.mp3",
];

type PlaybackState = {
  currentTime: number;
  trackIndex: number;
  wasPlaying: boolean;
};

type StartAudioDetail = {
  fromBeginning?: boolean;
  advanceTrack?: boolean;
};

declare global {
  interface Window {
    __introAudio__?: HTMLAudioElement;
  }
}

function clampTrackIndex(trackIndex: number): number {
  if (!Number.isFinite(trackIndex) || trackIndex < 0) {
    return 0;
  }

  return trackIndex % PLAYLIST.length;
}

function buildTrackUrl(trackName: string): string {
  return `/${encodeURIComponent(trackName)}`;
}

function formatTrackLabel(trackName: string): string {
  return trackName.replace(/\.mp3$/i, "");
}

function readPlaybackState(): PlaybackState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.localStorage.getItem(PLAYBACK_STATE_KEY);

  if (!rawState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(rawState) as PlaybackState;

    if (
      typeof parsedState.currentTime !== "number" ||
      typeof parsedState.trackIndex !== "number" ||
      typeof parsedState.wasPlaying !== "boolean"
    ) {
      return null;
    }

    return {
      currentTime: parsedState.currentTime,
      trackIndex: clampTrackIndex(parsedState.trackIndex),
      wasPlaying: parsedState.wasPlaying,
    };
  } catch {
    return null;
  }
}

function writePlaybackState(audio: HTMLAudioElement, trackIndex: number): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PLAYBACK_STATE_KEY,
    JSON.stringify({
      currentTime: audio.currentTime,
      trackIndex: clampTrackIndex(trackIndex),
      wasPlaying: !audio.paused && !audio.ended,
    } satisfies PlaybackState),
  );
}

function setTrack(audio: HTMLAudioElement, trackIndex: number, currentTime = 0): void {
  const normalizedTrackIndex = clampTrackIndex(trackIndex);
  const nextSrc = buildTrackUrl(PLAYLIST[normalizedTrackIndex]);

  if (audio.src.endsWith(nextSrc)) {
    audio.currentTime = currentTime;
    return;
  }

  audio.src = nextSrc;
  audio.currentTime = currentTime;
}

export default function IntroAudioShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  });
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 0;
    }

    return readPlaybackState()?.trackIndex ?? 0;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return readPlaybackState()?.wasPlaying ?? false;
  });
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackIndexRef = useRef(0);
  const hasStartedRef = useRef(false);
  const shouldShowControls = pathname === "/" || pathname === "/protected";

  useEffect(() => {
    currentTrackIndexRef.current = currentTrackIndex;
  }, [currentTrackIndex]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const playbackState = readPlaybackState();
    const initialTrackIndex = playbackState?.trackIndex ?? 0;
    const audio = window.__introAudio__ ?? new Audio(buildTrackUrl(PLAYLIST[initialTrackIndex]));

    audio.loop = false;
    audio.preload = "auto";
    audio.volume = 0.3;
    setTrack(audio, initialTrackIndex, playbackState?.currentTime ?? 0);

    window.__introAudio__ = audio;
    audioRef.current = audio;
    currentTrackIndexRef.current = initialTrackIndex;

    if (playbackState) {
      hasStartedRef.current = playbackState.wasPlaying;
    } else {
      hasStartedRef.current = audio.dataset.started === "true";
    }

    const persistPlaybackState = (): void => {
      writePlaybackState(audio, currentTrackIndexRef.current);
      setIsPlaying(!audio.paused && !audio.ended);
    };

    const playTrack = async ({
      trackIndex,
      fromBeginning = false,
      shouldAdvanceTrack = false,
    }: {
      trackIndex?: number;
      fromBeginning?: boolean;
      shouldAdvanceTrack?: boolean;
    }) => {
      const baseTrackIndex = trackIndex ?? currentTrackIndexRef.current;
      const nextTrackIndex = shouldAdvanceTrack
        ? clampTrackIndex(baseTrackIndex + 1)
        : clampTrackIndex(baseTrackIndex);
      const nextCurrentTime = fromBeginning || shouldAdvanceTrack ? 0 : audio.currentTime;

      setTrack(audio, nextTrackIndex, nextCurrentTime);
      currentTrackIndexRef.current = nextTrackIndex;
      setCurrentTrackIndex(nextTrackIndex);

      try {
        await audio.play();
        hasStartedRef.current = true;
        audio.dataset.started = "true";
        writePlaybackState(audio, nextTrackIndex);
        setIsPlaying(true);
      } catch {
        // Ignore browser autoplay failures.
      }
    };

    const handleStartAudio = async (event: Event): Promise<void> => {
      const customEvent = event as CustomEvent<StartAudioDetail>;

      await playTrack({
        fromBeginning: customEvent.detail?.fromBeginning === true,
        shouldAdvanceTrack: customEvent.detail?.advanceTrack === true,
      });
    };

    const handleEnded = async (): Promise<void> => {
      await playTrack({
        shouldAdvanceTrack: true,
        fromBeginning: true,
      });
    };

    const resumeAudioIfNeeded = async (): Promise<void> => {
      if (!playbackState?.wasPlaying) {
        return;
      }

      await playTrack({
        trackIndex: playbackState.trackIndex,
        fromBeginning: false,
        shouldAdvanceTrack: false,
      });
    };

    audio.addEventListener("play", persistPlaybackState);
    audio.addEventListener("pause", persistPlaybackState);
    audio.addEventListener("timeupdate", persistPlaybackState);
    audio.addEventListener("ended", handleEnded);
    window.addEventListener("pagehide", persistPlaybackState);
    window.addEventListener("humorproject:start-audio", handleStartAudio as EventListener);
    void resumeAudioIfNeeded();

    return () => {
      persistPlaybackState();
      audio.removeEventListener("play", persistPlaybackState);
      audio.removeEventListener("pause", persistPlaybackState);
      audio.removeEventListener("timeupdate", persistPlaybackState);
      audio.removeEventListener("ended", handleEnded);
      window.removeEventListener("pagehide", persistPlaybackState);
      window.removeEventListener("humorproject:start-audio", handleStartAudio as EventListener);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.muted = isMuted;
    writePlaybackState(audioRef.current, currentTrackIndexRef.current);
  }, [isMuted]);

  const playTrackAtIndex = async (trackIndex: number): Promise<void> => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const normalizedTrackIndex = clampTrackIndex(trackIndex);
    setTrack(audio, normalizedTrackIndex, 0);
    currentTrackIndexRef.current = normalizedTrackIndex;
    setCurrentTrackIndex(normalizedTrackIndex);

    try {
      await audio.play();
      hasStartedRef.current = true;
      audio.dataset.started = "true";
      writePlaybackState(audio, normalizedTrackIndex);
      setIsPlaying(true);
    } catch {
      // Ignore browser autoplay failures.
    }
  };

  const togglePlayback = async (): Promise<void> => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused || audio.ended) {
      try {
        await audio.play();
        hasStartedRef.current = true;
        audio.dataset.started = "true";
        writePlaybackState(audio, currentTrackIndexRef.current);
        setIsPlaying(true);
      } catch {
        // Ignore browser autoplay failures.
      }
      return;
    }

    audio.pause();
    writePlaybackState(audio, currentTrackIndexRef.current);
    setIsPlaying(false);
  };

  const onPreviousTrack = (): void => {
    void playTrackAtIndex(currentTrackIndexRef.current - 1 + PLAYLIST.length);
  };

  const onNextTrack = (): void => {
    void playTrackAtIndex(currentTrackIndexRef.current + 1);
  };

  const onToggleMute = (): void => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted));
    }
  };

  const currentTrackLabel = formatTrackLabel(PLAYLIST[currentTrackIndex] ?? PLAYLIST[0]);

  return (
    <div>
      {children}

      {shouldShowControls ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-end gap-2">
          {isPlayerOpen ? (
            <div className="app-card flex items-center gap-2 rounded-2xl px-3 py-2 shadow-[0_0_18px_var(--theme-shadow)]">
              <div className="mr-1 max-w-[170px] text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--theme-accent-soft)]">
                  Playlist
                </p>
                <p className="truncate text-xs font-semibold text-[var(--theme-text)]">
                  {currentTrackLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={onPreviousTrack}
                className="theme-ghost-button flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                aria-label="Previous track"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => {
                  void togglePlayback();
                }}
                className="theme-accent-button flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                aria-label={isPlaying ? "Pause audio" : "Play audio"}
              >
                {isPlaying ? "❚❚" : "▶"}
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                className="theme-ghost-button flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
                aria-label="Next track"
              >
                ▶
              </button>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setIsPlayerOpen((currentValue) => !currentValue)}
              className="theme-ghost-button flex h-12 w-12 items-center justify-center rounded-full text-lg"
              aria-label={isPlayerOpen ? "Hide music controls" : "Show music controls"}
            >
              ♪
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}
              className="theme-ghost-button flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
            >
              {isMuted ? "Off" : "On"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
