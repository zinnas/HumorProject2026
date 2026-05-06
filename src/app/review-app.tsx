import type { ReactElement } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ReviewSeenTracker from "./review-seen-tracker";
import VoteControls from "./vote-controls";

const SEEN_CAPTION_COOKIE_PREFIX = "humor-project-seen-captions";
const LAST_IMAGE_COOKIE_PREFIX = "humor-project-last-image";

type ImageRow = {
  id: string;
  url: string | null;
  is_common_use?: boolean | null;
};

type CaptionRow = {
  id: string;
  content: string | null;
  image_id: string;
  images: ImageRow | null;
};

type VoteCaptionRow = {
  id: string;
  content: string | null;
  image_id: string;
  images: ImageRow | null;
};

type DownvotedVoteRow = {
  caption_id: string;
  created_datetime_utc: string;
  captions: VoteCaptionRow | null;
};

type UserVoteHistoryRow = {
  caption_id: string;
};

type ExistingVoteRow = {
  id: number;
  vote_value: number;
};

type SearchParams = {
  processed_caption_ids?: string;
  last_image_id?: string;
};

type ReviewAppProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

type QueueCandidate = {
  captionId: string;
  captionContent: string | null;
  imageId: string;
  imageUrl: string | null;
  downvoteCount: number;
};

type CaptionAggregate = {
  captionId: string;
  captionContent: string | null;
  imageId: string;
  imageUrl: string | null;
  downvoteCount: number;
  tieBreaker: number;
};

function parseIdList(rawValue: string | null | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function uniqueIds(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

function getWeekWindow(now = new Date()) {
  const currentUtcDay = now.getUTCDay();
  const daysSinceMonday = (currentUtcDay + 6) % 7;
  const weekStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday),
  );
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setUTCDate(weekStart.getUTCDate() + 7);
  const weekKey = `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, "0")}-${String(weekStart.getUTCDate()).padStart(2, "0")}`;

  return {
    weekKey,
    weekStartIso: weekStart.toISOString(),
    nextWeekStartIso: nextWeekStart.toISOString(),
  };
}

function hashString(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function rotateToAvoidImageRepeat(
  candidates: QueueCandidate[],
  previousImageId: string | null,
): QueueCandidate[] {
  if (!previousImageId || candidates.length < 2) {
    return candidates;
  }

  if (candidates[0]?.imageId !== previousImageId) {
    return candidates;
  }

  const nextIndex = candidates.findIndex((candidate) => candidate.imageId !== previousImageId);

  if (nextIndex <= 0) {
    return candidates;
  }

  return candidates.slice(nextIndex).concat(candidates.slice(0, nextIndex));
}

function buildWeeklyQueue({
  votes,
  excludedCaptionIds,
  seed,
}: {
  votes: DownvotedVoteRow[];
  excludedCaptionIds: Set<string>;
  seed: string;
}): QueueCandidate[] {
  const aggregateByCaptionId = new Map<string, CaptionAggregate>();

  for (const vote of votes) {
    const caption = vote.captions;
    const image = caption?.images;

    if (!caption || !image?.id || image.is_common_use !== true) {
      continue;
    }

    if (excludedCaptionIds.has(caption.id)) {
      continue;
    }

    const existing = aggregateByCaptionId.get(caption.id);

    if (existing) {
      existing.downvoteCount += 1;
      continue;
    }

    aggregateByCaptionId.set(caption.id, {
      captionId: caption.id,
      captionContent: caption.content,
      imageId: image.id,
      imageUrl: image.url ?? null,
      downvoteCount: 1,
      tieBreaker: hashString(`${seed}:${image.id}:${caption.id}`),
    });
  }

  const groupedByImage = new Map<string, CaptionAggregate[]>();

  for (const aggregate of aggregateByCaptionId.values()) {
    const imageQueue = groupedByImage.get(aggregate.imageId);

    if (imageQueue) {
      imageQueue.push(aggregate);
    } else {
      groupedByImage.set(aggregate.imageId, [aggregate]);
    }
  }

  const imageGroups = Array.from(groupedByImage.entries()).map(([imageId, captions]) => {
    const sortedCaptions = captions.sort((left, right) => {
      if (right.downvoteCount !== left.downvoteCount) {
        return right.downvoteCount - left.downvoteCount;
      }

      if (left.tieBreaker !== right.tieBreaker) {
        return left.tieBreaker - right.tieBreaker;
      }

      return left.captionId.localeCompare(right.captionId);
    });

    return {
      imageId,
      tieBreaker: hashString(`${seed}:image:${imageId}`),
      captions: sortedCaptions,
    };
  });

  imageGroups.sort((left, right) => {
    const leftTopCount = left.captions[0]?.downvoteCount ?? 0;
    const rightTopCount = right.captions[0]?.downvoteCount ?? 0;

    if (rightTopCount !== leftTopCount) {
      return rightTopCount - leftTopCount;
    }

    if (left.tieBreaker !== right.tieBreaker) {
      return left.tieBreaker - right.tieBreaker;
    }

    return left.imageId.localeCompare(right.imageId);
  });

  const maxDepth = imageGroups.reduce((maxDepthValue, imageGroup) => {
    return Math.max(maxDepthValue, imageGroup.captions.length);
  }, 0);

  const queue: QueueCandidate[] = [];
  let previousImageId: string | null = null;

  for (let roundIndex = 0; roundIndex < maxDepth; roundIndex += 1) {
    let roundCandidates = imageGroups
      .map((imageGroup) => imageGroup.captions[roundIndex] ?? null)
      .filter((candidate): candidate is CaptionAggregate => candidate !== null)
      .sort((left, right) => {
        if (right.downvoteCount !== left.downvoteCount) {
          return right.downvoteCount - left.downvoteCount;
        }

        const leftRoundTieBreaker = hashString(`${seed}:round:${roundIndex}:${left.imageId}:${left.captionId}`);
        const rightRoundTieBreaker = hashString(`${seed}:round:${roundIndex}:${right.imageId}:${right.captionId}`);

        if (leftRoundTieBreaker !== rightRoundTieBreaker) {
          return leftRoundTieBreaker - rightRoundTieBreaker;
        }

        return left.captionId.localeCompare(right.captionId);
      })
      .map((candidate) => ({
        captionId: candidate.captionId,
        captionContent: candidate.captionContent,
        imageId: candidate.imageId,
        imageUrl: candidate.imageUrl,
        downvoteCount: candidate.downvoteCount,
      }));

    roundCandidates = rotateToAvoidImageRepeat(roundCandidates, previousImageId);

    if (roundCandidates.length > 0) {
      previousImageId = roundCandidates[roundCandidates.length - 1]?.imageId ?? previousImageId;
      queue.push(...roundCandidates);
    }
  }

  return queue;
}

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
  const processedCaptionIds = uniqueIds(parseIdList(resolvedSearchParams.processed_caption_ids));
  const processedCaptionIdSet = new Set(processedCaptionIds);
  const requestedLastImageId = resolvedSearchParams.last_image_id?.trim() || null;
  const { weekKey, weekStartIso, nextWeekStartIso } = getWeekWindow();
  const seenCaptionCookieName = `${SEEN_CAPTION_COOKIE_PREFIX}-${weekKey}`;
  const lastImageCookieName = `${LAST_IMAGE_COOKIE_PREFIX}-${weekKey}`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  async function handleVote({
    captionId,
    imageId,
    voteValue,
    processedCaptionIds: processedIds,
  }: {
    captionId: string;
    imageId: string;
    voteValue: number;
    processedCaptionIds: string[];
  }): Promise<{ nextProcessedCaptionIds: string[]; lastImageId: string }> {
    "use server";

    const actionSupabase = await createClient();
    const {
      data: { user: actionUser },
    } = await actionSupabase.auth.getUser();

    if (!actionUser) {
      redirect("/login");
    }

    const normalizedCaptionId = captionId.trim();
    const normalizedImageId = imageId.trim();
    const nextProcessedCaptionIds = uniqueIds(processedIds.concat(normalizedCaptionId));

    if (!normalizedCaptionId || !normalizedImageId || (voteValue !== 1 && voteValue !== -1)) {
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
      return { nextProcessedCaptionIds, lastImageId: normalizedImageId };
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

      return { nextProcessedCaptionIds, lastImageId: normalizedImageId };
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

    return { nextProcessedCaptionIds, lastImageId: normalizedImageId };
  }

  const [{ data: downvotedVotes, error: voteError }, { data: userVoteHistory, error: userVoteError }] =
    await Promise.all([
      supabase
        .from("caption_votes")
        .select("caption_id,created_datetime_utc,captions(id,content,image_id,images(id,url,is_common_use))")
        .eq("vote_value", -1)
        .gte("created_datetime_utc", weekStartIso)
        .lt("created_datetime_utc", nextWeekStartIso)
        .returns<DownvotedVoteRow[]>(),
      supabase
        .from("caption_votes")
        .select("caption_id")
        .eq("profile_id", user.id)
        .returns<UserVoteHistoryRow[]>(),
    ]);

  if (voteError) {
    return <ErrorState title="Could not load this week's review queue" message={voteError.message} />;
  }

  if (userVoteError) {
    return <ErrorState title="Could not load your voting history" message={userVoteError.message} />;
  }

  const cookieStore = await cookies();
  const seenCaptionIds = uniqueIds(parseIdList(cookieStore.get(seenCaptionCookieName)?.value));
  const previousImageId =
    requestedLastImageId ??
    cookieStore.get(lastImageCookieName)?.value?.trim() ??
    null;
  const votedCaptionIds = uniqueIds((userVoteHistory ?? []).map((vote) => vote.caption_id ?? ""));
  const excludedCaptionIds = new Set<string>([
    ...processedCaptionIdSet,
    ...seenCaptionIds,
    ...votedCaptionIds,
  ]);

  let queue = buildWeeklyQueue({
    votes: downvotedVotes ?? [],
    excludedCaptionIds,
    seed: `${user.id}:${weekKey}`,
  });

  queue = rotateToAvoidImageRepeat(queue, previousImageId);

  const selectedCandidate = queue[0];

  if (!selectedCandidate) {
    return (
      <section className="app-card rounded-[28px] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <h2 className="text-2xl font-semibold text-[var(--theme-text)]">Re-evaluate Content</h2>
        <p className="mt-2 text-sm text-[var(--theme-muted)]">
          You&apos;re caught up on this week&apos;s unseen caption and image combinations.
        </p>
      </section>
    );
  }

  const { data: caption, error: captionError } = await supabase
    .from("captions")
    .select("id,content,image_id,images(id,url)")
    .eq("id", selectedCandidate.captionId)
    .single<CaptionRow>();

  if (captionError) {
    return <ErrorState title="Could not load caption for vote" message={captionError.message} />;
  }

  const linkedImage = caption.images;

  return (
    <div className="space-y-6">
      <ReviewSeenTracker
        captionId={caption.id}
        imageId={caption.image_id}
        weekKey={weekKey}
        seenCaptionCookieName={seenCaptionCookieName}
        lastImageCookieName={lastImageCookieName}
      />

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
        imageId={caption.image_id}
        processedCaptionIds={processedCaptionIds}
        onVote={handleVote}
      />

      <section>
        <article className="app-card reval-card-enter rounded-[28px] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-1.5">
          {renderImage(linkedImage?.url ?? null, "Image")}
          <div className="mt-5 space-y-2 text-sm">
            <p className="text-center text-[20px] font-semibold text-[var(--theme-text)]">
              {caption.content ?? selectedCandidate.captionContent ?? "No caption text available."}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
