"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type VoteControlsProps = {
  captionId: string;
  processedCaptionIds: string[];
  onVote: (payload: {
    captionId: string;
    voteValue: number;
    processedCaptionIds: string[];
  }) => Promise<{
    nextProcessedCaptionIds: string[];
  }>;
};

export default function VoteControls({
  captionId,
  processedCaptionIds,
  onVote,
}: VoteControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleVote(voteValue: number) {
    startTransition(async () => {
      const result = await onVote({
        captionId,
        voteValue,
        processedCaptionIds,
      });

      const nextProcessedCaptionIdsParam = encodeURIComponent(
        result.nextProcessedCaptionIds.join(","),
      );

      router.replace(`/?processed_caption_ids=${nextProcessedCaptionIdsParam}`, {
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
