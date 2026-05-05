import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Hero from "./hero";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/protected");
  }

  return <Hero />;
}
