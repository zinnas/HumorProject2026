"use client";

import {
  type PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

const INTRO_STORAGE_KEY = "hasSeenIntro";
const MUTE_STORAGE_KEY = "isMuted";

const INTRO_TEXT =
  "This application identifies downvoted content where the associated image is labeled as is_common_use = TRUE. Its purpose is to surface disliked content and prompt users to re-evaluate it. Specifically, we aim to determine whether an image’s perceived “weirdness” contributes to the content being disliked.";

export default function IntroAudioShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return window.localStorage.getItem(INTRO_STORAGE_KEY) === "true";
  });
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === "true";
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasStartedRef = useRef(false);
  const isHomeRoute = pathname === "/";

  const shouldShowIntro = useMemo(() => isHomeRoute && hasSeenIntro === false, [hasSeenIntro, isHomeRoute]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const audio = new Audio("/make-it-weirder.mp3");
    audio.loop = true;
    audio.volume = 0.3;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.muted = isMuted;
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
    } catch {
      // Ignore browser autoplay failures.
    }
  };

  const onContinue = async (): Promise<void> => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    }
    setHasSeenIntro(true);
    await startAudio(true);
  };

  const onToggleMute = (): void => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTE_STORAGE_KEY, String(nextMuted));
    }
  };

  return (
    <div>
      {children}

      {hasSeenIntro !== null && isHomeRoute && (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={isMuted ? "Unmute background audio" : "Mute background audio"}
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-slate-600 bg-slate-900/90 text-xl text-slate-100 shadow-[0_0_14px_rgba(56,189,248,0.22)] transition hover:scale-105 hover:border-slate-400"
        >
          {isMuted ? "🔇" : "🔊"}
        </button>
      )}

      {shouldShowIntro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900/95 p-7 shadow-[0_18px_40px_rgba(0,0,0,0.65)]">
            <h2 className="text-2xl font-semibold text-slate-100">Welcome</h2>
            <p className="mt-4 text-sm leading-7 text-slate-200">{INTRO_TEXT}</p>
            <button
              type="button"
              onClick={onContinue}
              className="mt-6 rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-300"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
