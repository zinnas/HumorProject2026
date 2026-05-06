"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type VoteControlsProps = {
  captionId: string;
  imageId: string;
  processedCaptionIds: string[];
  onVote: (payload: {
    captionId: string;
    imageId: string;
    voteValue: number;
    processedCaptionIds: string[];
  }) => Promise<{
    nextProcessedCaptionIds: string[];
    lastImageId: string;
  }>;
};

export default function VoteControls({
  captionId,
  imageId,
  processedCaptionIds,
  onVote,
}: VoteControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleVote(voteValue: number) {
    startTransition(async () => {
      const result = await onVote({
        captionId,
        imageId,
        voteValue,
        processedCaptionIds,
      });

      const params = new URLSearchParams();
      params.set(
        "processed_caption_ids",
        result.nextProcessedCaptionIds.join(","),
      );
      params.set("last_image_id", result.lastImageId);

      router.replace(`/protected?${params.toString()}`, {
        scroll: false,
      });
    });
  }

  return (
    <div className="flex justify-center gap-4">
      <button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={isPending}
        className="theme-ghost-button rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-60"
      >
        No
      </button>
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={isPending}
        className="theme-accent-button rounded-full px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Yes
      </button>
    </div>
  );
}
