"use client";

import { useEffect } from "react";

const STORAGE_KEY_PREFIX = "humor-project-seen-captions";
const LAST_IMAGE_STORAGE_KEY_PREFIX = "humor-project-last-image";
const MAX_STORED_CAPTION_IDS = 160;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

function parseIdList(rawValue: string | null): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function mergeCaptionIds(existingIds: string[], nextCaptionId: string): string[] {
  const mergedIds = Array.from(
    new Set(existingIds.concat(nextCaptionId).map((value) => value.trim()).filter(Boolean)),
  );

  return mergedIds.slice(-MAX_STORED_CAPTION_IDS);
}

type ReviewSeenTrackerProps = {
  captionId: string;
  imageId: string;
  weekKey: string;
  seenCaptionCookieName: string;
  lastImageCookieName: string;
};

export default function ReviewSeenTracker({
  captionId,
  imageId,
  weekKey,
  seenCaptionCookieName,
  lastImageCookieName,
}: ReviewSeenTrackerProps) {
  useEffect(() => {
    if (!captionId || !imageId) {
      return;
    }

    const seenCaptionStorageKey = `${STORAGE_KEY_PREFIX}:${weekKey}`;
    const lastImageStorageKey = `${LAST_IMAGE_STORAGE_KEY_PREFIX}:${weekKey}`;
    const storedCaptionIds = parseIdList(window.localStorage.getItem(seenCaptionStorageKey));
    const nextCaptionIds = mergeCaptionIds(storedCaptionIds, captionId);
    const nextCaptionValue = nextCaptionIds.join(",");

    window.localStorage.setItem(seenCaptionStorageKey, nextCaptionValue);
    window.localStorage.setItem(lastImageStorageKey, imageId);
    document.cookie = `${seenCaptionCookieName}=${encodeURIComponent(nextCaptionValue)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    document.cookie = `${lastImageCookieName}=${encodeURIComponent(imageId)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, [captionId, imageId, lastImageCookieName, seenCaptionCookieName, weekKey]);

  return null;
}
