"use client";

import { type PropsWithChildren, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const MUTE_STORAGE_KEY = "isMuted";
const PLAYBACK_STATE_KEY = "introAudioPlaybackState";

type PlaybackState = {
  currentTime: number;
  wasPlaying: boolean;
};

declare global {
  interface Window {
    __introAudio__?: HTMLAudioElement;
  }
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
      typeof parsedState.wasPlaying !== "boolean"
    ) {
      return null;
    }

    return parsedState;
  } catch {
    return null;
  }
}

function writePlaybackState(audio: HTMLAudioElement): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PLAYBACK_STATE_KEY,
    JSON.stringify({
      currentTime: audio.currentTime,
      wasPlaying: !audio.paused && !audio.ended,
    } satisfies PlaybackState),
  );
}

export default function IntroAudioShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);
  const shouldShowControls = pathname === "/" || pathname === "/protected";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audio = window.__introAudio__ ?? new Audio("/make-it-weirder.mp3");
    const playbackState = readPlaybackState();

    audio.loop = true;
    audio.volume = 0.3;
    window.__introAudio__ = audio;
    audioRef.current = audio;

    if (playbackState) {
      try {
        audio.currentTime = playbackState.currentTime;
      } catch {
        audio.currentTime = 0;
      }
      hasStartedRef.current = playbackState.wasPlaying;
    } else {
      hasStartedRef.current = audio.dataset.started === "true";
    }

    const persistPlaybackState = (): void => {
      writePlaybackState(audio);
    };

    const handleStartAudio = async (event: Event): Promise<void> => {
      const customEvent = event as CustomEvent<{ fromBeginning?: boolean }>;
      const fromBeginning = customEvent.detail?.fromBeginning === true;

      if (fromBeginning) {
        audio.currentTime = 0;
      }

      try {
        await audio.play();
        hasStartedRef.current = true;
        audio.dataset.started = "true";
        writePlaybackState(audio);
      } catch {
        // Ignore browser autoplay failures.
      }
    };

    const resumeAudioIfNeeded = async (): Promise<void> => {
      if (!playbackState?.wasPlaying) {
        return;
      }

      try {
        await audio.play();
        hasStartedRef.current = true;
        audio.dataset.started = "true";
        writePlaybackState(audio);
      } catch {
        // Ignore browser autoplay failures after a hard navigation.
      }
    };

    audio.addEventListener("play", persistPlaybackState);
    audio.addEventListener("pause", persistPlaybackState);
    audio.addEventListener("timeupdate", persistPlaybackState);
    window.addEventListener("pagehide", persistPlaybackState);
    window.addEventListener("humorproject:start-audio", handleStartAudio as EventListener);
    void resumeAudioIfNeeded();

    return () => {
      persistPlaybackState();
      audio.removeEventListener("play", persistPlaybackState);
      audio.removeEventListener("pause", persistPlaybackState);
      audio.removeEventListener("timeupdate", persistPlaybackState);
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
    writePlaybackState(audioRef.current);
  }, [isMuted]);

  const startAudio = async (fromBeginning = false): Promise<void> => {
    if (!audioRef.current) {
      return;
    }

    if (!fromBeginning && hasStartedRef.current) {
      return;
    }

    if (fromBeginning) {
      audioRef.current.currentTime = 0;
    }

    try {
      await audioRef.current.play();
      hasStartedRef.current = true;
      audioRef.current.dataset.started = "true";
      writePlaybackState(audioRef.current);
    } catch {
      // Ignore browser autoplay failures.
    }
  };

  const onToggleMute = (): void => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted));
    }
    if (!nextMuted && audioRef.current && hasStartedRef.current && audioRef.current.paused) {
      void startAudio();
    }
  };

  return (
    <div>
      {children}

      {shouldShowControls ? (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] text-sm font-semibold text-[var(--theme-text)] shadow-[0_0_18px_var(--theme-shadow)] transition hover:scale-105"
        >
          {isMuted ? "Off" : "On"}
        </button>
      ) : null}
    </div>
  );
}
