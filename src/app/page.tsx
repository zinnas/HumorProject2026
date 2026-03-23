import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type ImageRow = {
  id: string;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
  url: string | null;
  is_common_use: boolean | null;
  profile_id: string | null;
  additional_context: string | null;
  is_public: boolean | null;
  image_description: string | null;
  celebrity_recognition: string | null;
};

type CaptionRow = {
  id: string;
  content: string | null;
  image_id: string;
  images: ImageRow | null;
};

type DownvotedVoteRow = {
  id: number;
  vote_value: number;
  caption_id: string;
  profile_id: string;
};

function renderImage(url: string | null, alt: string): ReactElement {
  if (!url) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-100 text-sm text-zinc-500">
        No image URL
      </div>
    );
  }

  return <img src={url} alt={alt} className="h-48 w-full rounded-md object-cover" />;
}

async function hasCaptionVotesColumn(
  columnName: "modified_by_user_id",
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("caption_votes")
    .select(columnName)
    .limit(1);

  if (!error) {
    return true;
  }

  if (error.code === "42703" || /does not exist/i.test(error.message)) {
    return false;
  }

  throw new Error(error.message);
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function handleVote(formData: FormData): Promise<void> {
    "use server";

    const actionSupabase = await createClient();
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const voteIdRaw = formData.get("vote_id");
    const nextVoteRaw = formData.get("vote_value");

    if (typeof voteIdRaw !== "string" || typeof nextVoteRaw !== "string") {
      throw new Error("Missing vote payload.");
    }

    const voteId = Number(voteIdRaw);
    const nextVote = Number(nextVoteRaw);

    if (!Number.isInteger(voteId) || (nextVote !== 1 && nextVote !== -1)) {
      throw new Error("Invalid vote payload.");
    }

    const { data: existingVote, error: existingVoteError } = await actionSupabase
      .from("caption_votes")
      .select("id,vote_value")
      .eq("id", voteId)
      .eq("profile_id", actionUser.id)
      .single<Pick<DownvotedVoteRow, "id" | "vote_value">>();

    if (existingVoteError) {
      throw new Error(existingVoteError.message);
    }

    if (existingVote.vote_value === nextVote) {
      return;
    }

    const updatePayload: {
      vote_value: number;
      modified_datetime_utc: string;
      modified_by_user_id?: string;
    } = {
      vote_value: nextVote,
      modified_datetime_utc: new Date().toISOString(),
    };

    if (await hasCaptionVotesColumn("modified_by_user_id")) {
      updatePayload.modified_by_user_id = actionUser.id;
    }

    const { error: updateError } = await actionSupabase
      .from("caption_votes")
      .update(updatePayload)
      .eq("id", voteId)
      .eq("profile_id", actionUser.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  const { data: downvotedVote, error: voteError } = await supabase
    .from("caption_votes")
    .select("id,vote_value,caption_id,profile_id")
    .eq("vote_value", -1)
    .eq("profile_id", user.id)
    .order("modified_datetime_utc", { ascending: false, nullsFirst: false })
    .order("created_datetime_utc", { ascending: false })
    .limit(1)
    .maybeSingle<DownvotedVoteRow>();

  if (voteError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-300 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Could not load downvoted content</h1>
          <p className="mt-2 text-sm text-red-800">{voteError.message}</p>
        </div>
      </main>
    );
  }

  if (!downvotedVote) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-2xl space-y-2 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Re-evaluate Content</h1>
          <p className="text-sm text-zinc-600">No previously downvoted items were found for your account.</p>
        </div>
      </main>
    );
  }

  const { data: caption, error: captionError } = await supabase
    .from("captions")
    .select(
      "id,content,image_id,images(id,created_datetime_utc,modified_datetime_utc,url,is_common_use,profile_id,additional_context,is_public,image_description,celebrity_recognition)",
    )
    .eq("id", downvotedVote.caption_id)
    .single<CaptionRow>();

  if (captionError) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-300 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Could not load caption for vote</h1>
          <p className="mt-2 text-sm text-red-800">{captionError.message}</p>
        </div>
      </main>
    );
  }

  const linkedImage = caption.images;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Re-evaluate Content</h1>
          <p className="text-sm text-zinc-600">Do you find this image weird?</p>
        </header>

        <section>
          <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            {renderImage(linkedImage?.url ?? null, linkedImage?.image_description ?? "Image")}
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-semibold">{caption.content ?? "No caption text available."}</p>
              {linkedImage?.image_description ? (
                <p className="text-zinc-600">{linkedImage.image_description}</p>
              ) : null}
            </div>

            <form action={handleVote} className="mt-6 flex gap-3">
              <input type="hidden" name="vote_id" value={String(downvotedVote.id)} />
              <button
                type="submit"
                name="vote_value"
                value="1"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Yes
              </button>
              <button
                type="submit"
                name="vote_value"
                value="-1"
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
              >
                No
              </button>
            </form>
          </article>
        </section>
      </div>
    </main>
  );
}
