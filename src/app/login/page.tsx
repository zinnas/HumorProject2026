"use client";

import { createClient } from "@/utils/supabase/client";

const PLAYBACK_STATE_KEY = "introAudioPlaybackState";

declare global {
  interface Window {
    __introAudio__?: HTMLAudioElement;
  }
}

export default function LoginPage() {
  const handleSignIn = async () => {
    const supabase = createClient();
    const existingAudio = window.__introAudio__;

    window.localStorage.setItem(
      PLAYBACK_STATE_KEY,
      JSON.stringify({
        currentTime: existingAudio?.currentTime ?? 0,
        wasPlaying: true,
      }),
    );

    window.dispatchEvent(
      new CustomEvent("humorproject:start-audio", {
        detail: {
          fromBeginning: !existingAudio || existingAudio.currentTime <= 0,
        },
      }),
    );

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-10 text-zinc-900">
      <section className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-2 text-sm text-zinc-600">Sign in to continue to protected content.</p>
        <button
          type="button"
          onClick={handleSignIn}
          className="mt-6 w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Continue with Google
        </button>
      </section>
    </main>
  );
}
