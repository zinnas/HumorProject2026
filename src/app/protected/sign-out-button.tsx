"use client";

import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

import { createClient } from "@/utils/supabase/client";

type SignOutButtonProps = ComponentPropsWithoutRef<"button">;

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={
        className ??
        "rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface)] px-4 py-2 text-sm font-medium text-[var(--theme-text)] shadow-[0_0_18px_var(--theme-shadow)] transition hover:-translate-y-0.5"
      }
    >
      Logout
    </button>
  );
}
