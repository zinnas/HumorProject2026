import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VoteControls from "./vote-controls";

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

type SearchParams = {
  processed_caption_ids?: string;
};

type ReviewAppProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

function renderImage(url: string | null, alt: string): ReactElement {
  if (!url) {
    return (
      <div className="app-card flex h-[60vh] max-h-[70vh] w-full items-center justify-center rounded-[16px] text-sm text-[var(--theme-muted)]">
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

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <section className="app-card rounded-[28px] border border-red-500/30 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
      <h2 className="text-xl font-semibold text-red-300">{title}</h2>
      <p className="mt-2 text-sm text-red-200">{message}</p>
    </section>
  );
}

export default async function ReviewApp({ searchParams }: ReviewAppProps) {
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

  async function handleVote({
    captionId,
    voteValue,
    processedCaptionIds: processedIds,
  }: {
    captionId: string;
    voteValue: number;
    processedCaptionIds: string[];
  }): Promise<{ nextProcessedCaptionIds: string[] }> {
    "use server";

    const actionSupabase = await createClient();
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const normalizedCaptionId = captionId.trim();
    const nextProcessedCaptionIds = Array.from(
      new Set(
        processedIds
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
          .concat(normalizedCaptionId),
      ),
    );

    if (!normalizedCaptionId || (voteValue !== 1 && voteValue !== -1)) {
      throw new Error("Invalid vote payload.");
    }

    const { data: existingVotes, error: existingVoteError } = await actionSupabase
      .from("caption_votes")
      .select("id,vote_value")
      .eq("caption_id", normalizedCaptionId)
      .eq("profile_id", actionUser.id)
      .order("id", { ascending: true })
      .limit(1)
      .returns<ExistingVoteRow[]>();

    if (existingVoteError) {
      throw new Error(existingVoteError.message);
    }

    const existingVote = existingVotes?.[0] ?? null;

    if (existingVote?.vote_value === voteValue) {
      return { nextProcessedCaptionIds };
    }

    if (existingVote) {
      const { error: updateError } = await actionSupabase
        .from("caption_votes")
        .update({
          vote_value: voteValue,
        })
        .eq("profile_id", actionUser.id)
        .eq("caption_id", normalizedCaptionId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return { nextProcessedCaptionIds };
    }

    const { error: insertError } = await actionSupabase
      .from("caption_votes")
      .insert({
        caption_id: normalizedCaptionId,
        profile_id: actionUser.id,
        vote_value: voteValue,
        created_datetime_utc: new Date().toISOString(),
      });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return { nextProcessedCaptionIds };
  }

  const { data: downvotedVotes, error: voteError } = await supabase
    .from("caption_votes")
    .select("caption_id")
    .eq("vote_value", -1)
    .order("caption_id", { ascending: true })
    .returns<DownvotedVoteRow[]>();

  if (voteError) {
    return <ErrorState title="Could not load downvoted content" message={voteError.message} />;
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
      <section className="app-card rounded-[28px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <h2 className="text-2xl font-semibold text-[var(--theme-text)]">Re-evaluate Content</h2>
        <p className="mt-2 text-sm text-[var(--theme-muted)]">You&apos;re done for now.</p>
      </section>
    );
  }

  const { data: caption, error: captionError } = await supabase
    .from("captions")
    .select("id,content,image_id,images(id,url)")
    .eq("id", selectedCaptionId)
    .single<CaptionRow>();

  if (captionError) {
    return <ErrorState title="Could not load caption for vote" message={captionError.message} />;
  }

  const linkedImage = caption.images;

  return (
    <div className="space-y-6">
      <header className="space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.45em] text-[var(--theme-accent-soft)]">
          The Humor Project
        </p>
        <h1 className="text-3xl font-semibold text-[var(--theme-text)] sm:text-4xl">
          Re-evaluate Content
        </h1>
        <p className="text-sm text-[var(--theme-muted)] sm:text-base">
          Do you find this image weird?
        </p>
      </header>

      <VoteControls
        captionId={caption.id}
        processedCaptionIds={processedCaptionIds}
        onVote={handleVote}
      />

      <section>
        <article className="app-card reval-card-enter rounded-[28px] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-1.5">
          {renderImage(linkedImage?.url ?? null, "Image")}
          <div className="mt-5 space-y-2 text-sm">
            <p className="text-center text-[20px] font-semibold text-[var(--theme-text)]">
              {caption.content ?? "No caption text available."}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
