import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ReviewApp from "../review-app";
import ProtectedAppShell from "./protected-app-shell";

type ProtectedPageProps = {
  searchParams?: Promise<{
    processed_caption_ids?: string;
  }>;
};

export default async function ProtectedPage({ searchParams }: ProtectedPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ProtectedAppShell userEmail={user.email ?? "No email on profile"}>
      <ReviewApp searchParams={searchParams} />
    </ProtectedAppShell>
  );
}
