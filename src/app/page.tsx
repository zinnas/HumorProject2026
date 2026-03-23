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
  caption_id: string;
};

type ExistingVoteRow = {
  id: number;
  vote_value: number;
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

    const captionIdRaw = formData.get("caption_id");
    const nextVoteRaw = formData.get("vote_value");

    if (typeof captionIdRaw !== "string" || typeof nextVoteRaw !== "string") {
      throw new Error("Missing vote payload.");
    }

    const captionId = captionIdRaw.trim();
    const nextVote = Number(nextVoteRaw);

    if (!captionId || (nextVote !== 1 && nextVote !== -1)) {
      throw new Error("Invalid vote payload.");
    }

    const { data: existingVote, error: existingVoteError } = await actionSupabase
      .from("caption_votes")
      .select("id,vote_value")
      .eq("caption_id", captionId)
      .eq("profile_id", actionUser.id)
      .maybeSingle<ExistingVoteRow>();

    if (existingVoteError) {
      throw new Error(existingVoteError.message);
    }

    if (existingVote?.vote_value === nextVote) {
      return;
    }

    if (existingVote) {
      const { error: updateError } = await actionSupabase
        .from("caption_votes")
        .update({
          vote_value: nextVote,
        })
        .eq("id", existingVote.id)
        .eq("profile_id", actionUser.id)
        .eq("caption_id", captionId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return;
    }

    const { error: insertError } = await actionSupabase
      .from("caption_votes")
      .insert({
        caption_id: captionId,
        profile_id: actionUser.id,
        vote_value: nextVote,
        created_datetime_utc: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  const { data: downvotedVotes, error: voteError } = await supabase
    .from("caption_votes")
    .select("caption_id")
    .eq("vote_value", -1)
    .order("caption_id", { ascending: true })
    .returns<DownvotedVoteRow[]>();

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

  const distinctCaptionIds = Array.from(
    new Set((downvotedVotes ?? []).map((vote) => vote.caption_id)),
  );

  const selectedCaptionId = distinctCaptionIds[0];

  if (!selectedCaptionId) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-2xl space-y-2 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Re-evaluate Content</h1>
          <p className="text-sm text-zinc-600">No globally downvoted items were found.</p>
        </div>
      </main>
    );
  }

  const { data: caption, error: captionError } = await supabase
    .from("captions")
    .select(
      "id,content,image_id,images(id,created_datetime_utc,modified_datetime_utc,url,is_common_use,profile_id,additional_context,is_public,image_description,celebrity_recognition)",
    )
    .eq("id", selectedCaptionId)
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
              <input type="hidden" name="caption_id" value={caption.id} />
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
