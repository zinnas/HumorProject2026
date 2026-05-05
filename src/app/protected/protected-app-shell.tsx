"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import UploadModal from "../upload-modal";
import ThemeToggle from "../theme-toggle";
import SignOutButton from "./sign-out-button";

const ONBOARDING_STORAGE_KEY = "humor-project-onboarding-complete";

const ONBOARDING_PAGES = [
  "Humor Project is a research platform. We study what people actually find funny by collecting large quantities of votes on AI-generated captions. Our system is designed to leverage specific community context and \"insider lore,\" especially Columbia student culture, because humor is contextual and audience-dependent.",
  "This application identifies the weekly most downvoted content where the associated image is used frequently. Its purpose is to surface disliked content and prompt users to re-evaluate it. Specifically, we aim to determine whether an image's perceived \"weirdness\" contributes to the content being disliked.",
  "Additionally, you can generate your own caption by uploading images.",
];

type ProtectedAppShellProps = {
  children: ReactNode;
  userEmail: string;
};

function TypewriterText({ text }: { text: string }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      const frameId = window.requestAnimationFrame(() => {
        setVisibleText(text);
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    let nextIndex = 0;
    let intervalId: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      intervalId = window.setInterval(() => {
        nextIndex += 1;
        setVisibleText(text.slice(0, nextIndex));
        if (nextIndex >= text.length) {
          if (intervalId !== null) {
            window.clearInterval(intervalId);
          }
        }
      }, 14);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [text]);

  return (
    <>
      {visibleText}
      <span className="typewriter-caret" aria-hidden="true" />
    </>
  );
}

function OnboardingOverlay({
  currentPage,
  isClosing,
  onBack,
  onNext,
  onFinish,
}: {
  currentPage: number;
  isClosing: boolean;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage === ONBOARDING_PAGES.length - 1;
  const currentText = ONBOARDING_PAGES[currentPage];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <div
        className={`onboarding-card app-card relative w-full max-w-3xl overflow-hidden rounded-[32px] px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-700 sm:px-8 sm:py-10 ${
          isClosing ? "onboarding-card-closing" : "opacity-100"
        }`}
      >
        <p className="text-xs uppercase tracking-[0.5em] text-[var(--theme-accent-soft)]">
          Onboarding {currentPage + 1}
        </p>
        <div className="mt-6 min-h-[240px] pb-24 text-lg leading-8 text-[var(--theme-text)] sm:min-h-[220px] sm:text-[1.35rem]">
          {isClosing ? (
            currentText
          ) : (
            <TypewriterText key={currentPage} text={currentText} />
          )}
        </div>

        <div className="absolute inset-x-6 bottom-6 flex items-center justify-between sm:inset-x-8">
          <button
            type="button"
            onClick={onBack}
            disabled={isFirstPage}
            className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] transition ${
              isFirstPage
                ? "pointer-events-none opacity-0"
                : "border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:-translate-y-0.5"
            }`}
          >
            Back
          </button>

          <button
            type="button"
            onClick={isLastPage ? onFinish : onNext}
            className="rounded-full border border-[var(--theme-accent)] bg-[var(--theme-accent)] px-5 py-2 text-sm font-semibold uppercase tracking-[0.24em] text-black shadow-[0_0_22px_rgba(255,78,197,0.32)] transition hover:-translate-y-0.5"
          >
            {isLastPage ? "Start" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

function readOnboardingCompletion() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
}

export default function ProtectedAppShell({
  children,
  userEmail,
}: ProtectedAppShellProps) {
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
  const [isOnboardingClosing, setIsOnboardingClosing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsOnboardingVisible(!readOnboardingCompletion());
      setHasInitialized(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  function handleFinishOnboarding() {
    setIsOnboardingClosing(true);

    window.setTimeout(() => {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
      setIsOnboardingVisible(false);
      setIsOnboardingClosing(false);
    }, 680);
  }

  const showHelpButton = hasInitialized && !isOnboardingVisible && !isOnboardingClosing;
  const subtitle = useMemo(() => {
    return userEmail === "No email on profile" ? userEmail : `Signed in as ${userEmail}`;
  }, [userEmail]);

  return (
    <main className="app-shell relative min-h-screen overflow-hidden px-4 py-6 text-[var(--theme-text)] sm:px-6 sm:py-8">
      <div className="background-grid absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="background-rings absolute left-1/2 top-1/2 h-[90vmax] w-[90vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40" aria-hidden="true" />

      <div className="relative z-20 mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.45em] text-[var(--theme-accent-soft)]">
              Columbia University
            </p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Humor Project</h1>
            <p className="text-sm text-[var(--theme-muted)]">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <UploadModal />
            {showHelpButton ? (
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(0);
                  setIsOnboardingVisible(true);
                }}
                className="rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-4 py-2 text-sm font-semibold text-[var(--theme-text)] shadow-[0_0_18px_var(--theme-shadow)] transition hover:-translate-y-0.5"
                aria-label="Open onboarding help"
              >
                ?
              </button>
            ) : null}
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>

        <div className="relative z-10">{children}</div>
      </div>

      {isOnboardingVisible ? (
        <OnboardingOverlay
          currentPage={currentPage}
          isClosing={isOnboardingClosing}
          onBack={() => setCurrentPage((page) => Math.max(0, page - 1))}
          onNext={() =>
            setCurrentPage((page) => Math.min(ONBOARDING_PAGES.length - 1, page + 1))
          }
          onFinish={handleFinishOnboarding}
        />
      ) : null}
    </main>
  );
}
