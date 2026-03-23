"use client";

import Image from "next/image";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";

type PresignedUrlResponse = {
  presignedUrl?: string;
  cdnUrl?: string;
};

type RegisterImageResponse = {
  imageId?: string;
  id?: string;
  image?: { id?: string };
  data?: { id?: string };
};

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
]);

const ACCEPT_ATTR = "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic";

function parseErrorMessage(defaultMessage: string, payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return defaultMessage;
  }

  const errorValue = (payload as { error?: unknown }).error;
  if (typeof errorValue === "string" && errorValue.trim().length > 0) {
    return errorValue;
  }

  return defaultMessage;
}

function extractCaptionStrings(payload: unknown): string[] {
  const captions = new Set<string>();

  function addValue(value: unknown) {
    if (typeof value !== "string") {
      return;
    }

    const cleaned = value.trim();
    if (!cleaned) {
      return;
    }

    captions.add(cleaned);
  }

  function walk(node: unknown) {
    if (!node) {
      return;
    }

    if (typeof node === "string") {
      addValue(node);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const record = node as Record<string, unknown>;
    addValue(record.caption);
    addValue(record.content);
    addValue(record.text);

    if (record.captions) {
      walk(record.captions);
    }
    if (record.results) {
      walk(record.results);
    }
    if (record.items) {
      walk(record.items);
    }
    if (record.data) {
      walk(record.data);
    }
  }

  walk(payload);

  return Array.from(captions);
}

export default function UploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedCaptions, setGeneratedCaptions] = useState<string[]>([]);
  const [fileInputResetKey, setFileInputResetKey] = useState(0);

  const selectedTypeLabel = useMemo(() => selectedFile?.type ?? "unknown", [selectedFile]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function resetModalState() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(null);
    setStatusText(null);
    setGeneratedCaptions([]);
    setFileInputResetKey((current) => current + 1);
  }

  function closeModal() {
    if (isSubmitting) {
      return;
    }

    resetModalState();
    setIsOpen(false);
  }

  function openModal() {
    resetModalState();
    setIsOpen(true);
  }

  function discardSelection() {
    if (isSubmitting) {
      return;
    }

    resetModalState();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(null);
    setStatusText(null);
    setGeneratedCaptions([]);

    if (!nextFile) {
      setSelectedFile(null);
      return;
    }

    if (!ACCEPTED_MIME_TYPES.has(nextFile.type)) {
      setSelectedFile(null);
      setError("Please choose a JPG, JPEG, PNG, WEBP, GIF, or HEIC image.");
      return;
    }

    setSelectedFile(nextFile);
  }

  async function parseResponseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { error: text };
    }
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setError("Please select an image before submitting.");
      return;
    }

    setIsSubmitting(true);
    setStatusText("Preparing upload...");
    setError(null);
    setSuccess(null);
    setGeneratedCaptions([]);

    try {
      const presignedRes = await fetch("/api/caption-pipeline/presigned-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: selectedFile.type,
        }),
      });

      const presignedPayload = (await parseResponseBody(presignedRes)) as PresignedUrlResponse | null;

      if (!presignedRes.ok) {
        setError(parseErrorMessage("Could not start the upload.", presignedPayload));
        return;
      }

      const presignedUrl = presignedPayload?.presignedUrl;
      const cdnUrl = presignedPayload?.cdnUrl;

      if (!presignedUrl || !cdnUrl) {
        setError("Upload setup is incomplete. Please try again.");
        return;
      }

      setStatusText("Uploading image...");
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        setError("Could not upload this image. Please try another file.");
        return;
      }

      setStatusText("Registering image...");
      const registerRes = await fetch("/api/caption-pipeline/register-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: cdnUrl,
          isCommonUse: false,
        }),
      });

      const registerPayload = (await parseResponseBody(registerRes)) as RegisterImageResponse | null;

      if (!registerRes.ok) {
        setError(parseErrorMessage("Could not process this upload.", registerPayload));
        return;
      }

      const imageId =
        registerPayload?.imageId ??
        registerPayload?.id ??
        registerPayload?.image?.id ??
        registerPayload?.data?.id;

      if (!imageId) {
        setError("Could not process this upload. Please try again.");
        return;
      }

      setStatusText("Generating captions...");
      const captionsRes = await fetch("/api/caption-pipeline/generate-captions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId,
        }),
      });

      const captionsPayload = await parseResponseBody(captionsRes);

      if (!captionsRes.ok) {
        setError(parseErrorMessage("Caption generation failed.", captionsPayload));
        return;
      }

      const captions = extractCaptionStrings(captionsPayload);

      if (captions.length === 0) {
        setError("No captions were generated. Please try another image.");
        return;
      }

      setGeneratedCaptions(captions);
      setSuccess("Your captions are ready.");
      setStatusText(null);
    } catch (submitError) {
      console.error("upload modal submit error:", submitError);
      setError("Something went wrong while generating captions. Please try again.");
    } finally {
      setIsSubmitting(false);
      setStatusText(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-full border border-[#1e293b] bg-[#020617] px-5 py-2 text-sm font-semibold text-[#e5e7eb] transition-transform duration-200 hover:-translate-y-0.5"
      >
        Upload
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="w-full max-w-xl rounded-[24px] border border-slate-900 bg-[#08122F] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(34,197,94,0.08),0_0_24px_rgba(124,58,237,0.12)]">
            <h2 className="text-xl font-semibold text-[#F8FAFC]">Upload Image</h2>
            <p className="mt-1 text-sm text-[#CBD5E1]">
              Select an image to upload and create your own Humor Content.
            </p>

            <label className="mt-4 block text-sm text-[#CBD5E1]" htmlFor="caption-upload-file">
              Image File (JPG, JPEG, PNG, WEBP, GIF, HEIC)
            </label>
            <input
              key={fileInputResetKey}
              id="caption-upload-file"
              type="file"
              accept={ACCEPT_ATTR}
              onChange={handleFileChange}
              className="mt-2 block w-full rounded-lg border border-slate-700 bg-[#020617] p-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-[#fbbf24] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-black"
            />

            {selectedFile ? (
              <p className="mt-2 text-xs text-slate-400">
                Selected: {selectedFile.name} ({selectedTypeLabel})
              </p>
            ) : null}

            {previewUrl ? (
              <div className="mt-4 overflow-hidden rounded-[16px] border border-slate-800">
                <Image
                  src={previewUrl}
                  alt="Selected image preview"
                  width={960}
                  height={540}
                  unoptimized
                  className="h-[260px] w-full object-contain bg-[#020617]"
                />
              </div>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            {success ? (
              <p className="mt-4 rounded-md border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200">
                {success}
              </p>
            ) : null}

            {generatedCaptions.length > 0 ? (
              <section className="mt-4 rounded-2xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.9),rgba(2,6,23,0.65))] p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
                <h3 className="px-1 text-sm font-semibold text-slate-100">Generated Captions</h3>
                <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {generatedCaptions.map((captionText, index) => (
                    <article
                      key={`${captionText}-${index}`}
                      className="rounded-xl border border-slate-700/60 bg-[#0A1226] px-3 py-2 text-sm text-slate-200 shadow-[0_6px_18px_rgba(2,6,23,0.4)]"
                    >
                      {captionText}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="min-h-[20px] text-xs text-slate-400">{isSubmitting ? statusText : ""}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-full border border-[#1e293b] bg-[#020617] px-4 py-2 text-sm font-medium text-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Close
                </button>

                {selectedFile && !success ? (
                  <button
                    type="button"
                    onClick={discardSelection}
                    disabled={isSubmitting}
                    className="rounded-full border border-slate-700 bg-[#0B1328] px-4 py-2 text-sm font-medium text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Discard
                  </button>
                ) : null}

                {selectedFile && !success ? (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-full bg-[#fbbf24] px-5 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? statusText ?? "Uploading..." : "Submit"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
