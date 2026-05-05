"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BackgroundGrid from "./background-grid";
import DecorativeOrbitals from "./decorative-orbitals";
import NeonWordmark from "./neon-wordmark";
import StarField from "./star-field";
import ThemeToggle from "./theme-toggle";

export default function Hero() {
  const router = useRouter();
  const [showStart, setShowStart] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowStart(true);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  function handleStart() {
    window.localStorage.setItem("hasSeenIntro", "true");
    window.dispatchEvent(
      new CustomEvent("humorproject:start-audio", {
        detail: {
          fromBeginning: true,
        },
      }),
    );
    router.push("/login");
  }

  return (
    <main className="landing-shell relative min-h-screen overflow-hidden px-4 py-6 text-[var(--theme-text)] sm:px-6">
      <BackgroundGrid />
      <StarField />
      <DecorativeOrbitals />

      <div className="relative z-20 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.5em] text-[var(--theme-muted)]">
          Research Platform
        </div>
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-2 z-20 hidden items-center md:flex">
        <div className="landing-side-text">[Zin Narin Nas]</div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-2 z-20 hidden items-center md:flex">
        <div className="landing-side-text landing-side-text-right">
          <span>[2026] Humor Project</span>
          <span>[Columbia University]</span>
        </div>
      </div>

      <section className="relative z-20 flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.65em] text-[var(--theme-accent-soft)] sm:text-sm">
            The Humor Project
          </p>
          <NeonWordmark text="Welcome" />
          <p className="mt-6 max-w-xl text-sm leading-7 text-[var(--theme-muted)] sm:text-base">
            A neon gateway into The Humor Project&apos;s caption evaluation workflow.
          </p>

          <div
            className={`mt-10 transition-all duration-700 ${
              showStart
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-4 opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={handleStart}
              className="landing-start-button rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em] sm:px-10 sm:py-4"
            >
              Start
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
