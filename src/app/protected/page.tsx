import { redirect } from "next/navigation";

import SignOutButton from "./sign-out-button";
import { createClient } from "@/utils/supabase/server";

export default async function ProtectedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Protected</h1>
          <p className="text-sm text-zinc-600">You are authenticated and can access this page.</p>
        </div>

        <div className="rounded-md bg-zinc-100 p-4 text-sm">
          <p>
            Signed in as: <span className="font-medium">{user.email ?? "No email on profile"}</span>
          </p>
        </div>

        <SignOutButton />
      </div>
    </main>
  );
}
