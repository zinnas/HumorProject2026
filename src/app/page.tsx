import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type ImageRow = {
  id: string;
  url: string | null;
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
      <div className="flex h-[60vh] max-h-[70vh] w-full items-center justify-center rounded-[16px] border border-slate-700 bg-slate-950 text-sm text-slate-400">
        No image URL
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className="h-[60vh] max-h-[70vh] w-full rounded-[16px] object-contain"
    />
  );
}

type SearchParams = {
  processed_caption_ids?: string;
};

type HomeProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function Home({ searchParams }: HomeProps) {
  const supabase = await createClient();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const processedCaptionIdsParam = resolvedSearchParams.processed_caption_ids ?? "";
  const processedCaptionIds = processedCaptionIdsParam
    .split(",")
    .map((captionId) => captionId.trim())
    .filter((captionId) => captionId.length > 0);
  const processedCaptionIdSet = new Set(processedCaptionIds);

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
    const processedIdsRaw = formData.get("processed_caption_ids");

    if (
      typeof captionIdRaw !== "string" ||
      typeof nextVoteRaw !== "string" ||
      typeof processedIdsRaw !== "string"
    ) {
      throw new Error("Missing vote payload.");
    }

    const captionId = captionIdRaw.trim();
    const nextVote = Number(nextVoteRaw);
    const nextProcessedCaptionIds = Array.from(
      new Set(
        processedIdsRaw
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
          .concat(captionId),
      ),
    );
    const nextProcessedCaptionIdsParam = encodeURIComponent(nextProcessedCaptionIds.join(","));

    if (!captionId || (nextVote !== 1 && nextVote !== -1)) {
      throw new Error("Invalid vote payload.");
    }

    const { data: existingVotes, error: existingVoteError } = await actionSupabase
      .from("caption_votes")
      .select("id,vote_value")
      .eq("caption_id", captionId)
      .eq("profile_id", actionUser.id)
      .order("id", { ascending: true })
      .limit(1)
      .returns<ExistingVoteRow[]>();

    if (existingVoteError) {
      throw new Error(existingVoteError.message);
    }

    const existingVote = existingVotes?.[0] ?? null;

    if (existingVote?.vote_value === nextVote) {
      redirect(`/?processed_caption_ids=${nextProcessedCaptionIdsParam}`);
    }

    if (existingVote) {
      const { error: updateError } = await actionSupabase
        .from("caption_votes")
        .update({
          vote_value: nextVote,
        })
        .eq("profile_id", actionUser.id)
        .eq("caption_id", captionId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      redirect(`/?processed_caption_ids=${nextProcessedCaptionIdsParam}`);
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

    redirect(`/?processed_caption_ids=${nextProcessedCaptionIdsParam}`);
  }

  const { data: downvotedVotes, error: voteError } = await supabase
    .from("caption_votes")
    .select("caption_id")
    .eq("vote_value", -1)
    .order("caption_id", { ascending: true })
    .returns<DownvotedVoteRow[]>();

  if (voteError) {
    return (
      <main className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_35%),linear-gradient(180deg,#050816_0%,#0B1020_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-[700px] rounded-[24px] border border-red-900/60 bg-[#08122F] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_24px_rgba(124,58,237,0.12)]">
          <h1 className="text-xl font-semibold text-red-300">Could not load downvoted content</h1>
          <p className="mt-2 text-sm text-red-200">{voteError.message}</p>
        </div>
      </main>
    );
  }

  const distinctCaptionIds = Array.from(
    new Set((downvotedVotes ?? []).map((vote) => vote.caption_id)),
  );

  const eligibleCaptionIds = distinctCaptionIds.filter(
    (captionId) => !processedCaptionIdSet.has(captionId),
  );

  const selectedCaptionId = eligibleCaptionIds[0];

  if (!selectedCaptionId) {
    return (
      <main className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_35%),linear-gradient(180deg,#050816_0%,#0B1020_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-[700px] space-y-2 rounded-[24px] border border-slate-900 bg-[#08122F] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(34,197,94,0.08),0_0_24px_rgba(124,58,237,0.12)]">
          <h1 className="text-2xl font-semibold">Re-evaluate Content</h1>
          <p className="text-sm text-slate-300">You&apos;re done for now.</p>
        </div>
      </main>
    );
  }

  const { data: caption, error: captionError } = await supabase
    .from("captions")
    .select(
      "id,content,image_id,images(id,url)",
    )
    .eq("id", selectedCaptionId)
    .single<CaptionRow>();

  if (captionError) {
    return (
      <main className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_35%),linear-gradient(180deg,#050816_0%,#0B1020_100%)] px-6 py-10 text-slate-100">
        <div className="mx-auto max-w-[700px] rounded-[24px] border border-red-900/60 bg-[#08122F] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_24px_rgba(124,58,237,0.12)]">
          <h1 className="text-xl font-semibold text-red-300">Could not load caption for vote</h1>
          <p className="mt-2 text-sm text-red-200">{captionError.message}</p>
        </div>
      </main>
    );
  }

  const linkedImage = caption.images;

  return (
    <main className="min-h-screen bg-[#050816] bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.10),transparent_35%),linear-gradient(180deg,#050816_0%,#0B1020_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[700px] space-y-6">
        <header className="space-y-2">
          <h1 className="text-center text-3xl font-bold">Re-evaluate Content</h1>
          <p className="text-center text-sm text-[#CBD5E1]">Do you find this image weird?</p>
        </header>

        <form action={handleVote} className="flex justify-center gap-4">
          <input type="hidden" name="caption_id" value={caption.id} />
          <input
            type="hidden"
            name="processed_caption_ids"
            value={processedCaptionIds.join(",")}
          />
          <button
            type="submit"
            name="vote_value"
            value="-1"
            className="rounded-full border border-[#1e293b] bg-[#020617] px-6 py-3 text-sm font-medium text-[#e5e7eb] transition-transform duration-200 hover:-translate-y-0.5"
          >
            No
          </button>
          <button
            type="submit"
            name="vote_value"
            value="1"
            className="rounded-full bg-[#fbbf24] px-6 py-3 text-sm font-bold text-black transition-transform duration-200 hover:-translate-y-0.5"
          >
            Yes
          </button>
        </form>

        <section>
          <article
            className="reval-card-enter rounded-[24px] border border-slate-900 bg-[#08122F] p-5 transition-transform duration-250 ease-in-out translate-y-[-7px] hover:translate-y-[-12px]"
            style={{
              transformStyle: "preserve-3d",
              willChange: "transform",
              boxShadow:
                "0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.08), 0 0 24px rgba(124,58,237,0.12)",
            }}
          >
            {renderImage(linkedImage?.url ?? null, "Image")}
            <div className="mt-5 space-y-2 text-sm">
              <p className="text-center text-[20px] font-semibold text-[#F8FAFC]">
                {caption.content ?? "No caption text available."}
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
