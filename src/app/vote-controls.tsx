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
        className="rounded-full border border-[#1e293b] bg-[#020617] px-6 py-3 text-sm font-medium text-[#e5e7eb] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        No
      </button>
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={isPending}
        className="rounded-full bg-[#fbbf24] px-6 py-3 text-sm font-bold text-black transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Yes
      </button>
    </div>
  );
}
