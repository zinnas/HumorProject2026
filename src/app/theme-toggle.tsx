"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "humor-project-theme";

type ThemeMode = "dark" | "light";

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return storedTheme === "light" || storedTheme === "dark"
      ? (storedTheme as ThemeMode)
      : "dark";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--theme-text)] shadow-[0_0_18px_var(--theme-shadow)] transition hover:-translate-y-0.5 disabled:opacity-70"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}
