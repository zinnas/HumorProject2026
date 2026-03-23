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

export default function UploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatedCaptions, setGeneratedCaptions] = useState<unknown>(null);

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

  function closeModal() {
    if (isSubmitting) {
      return;
    }
    setIsOpen(false);
    setError(null);
    setSuccess(null);
  }

  function openModal() {
    setIsOpen(true);
    setError(null);
    setSuccess(null);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setError(null);
    setSuccess(null);

    if (!nextFile) {
      setSelectedFile(null);
      return;
    }

    if (!ACCEPTED_MIME_TYPES.has(nextFile.type)) {
      setSelectedFile(null);
      setError(`Unsupported file type: ${nextFile.type || "unknown"}`);
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
    setError(null);
    setSuccess(null);

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
        setError(parseErrorMessage("Could not create upload URL.", presignedPayload));
        return;
      }

      const presignedUrl = presignedPayload?.presignedUrl;
      const cdnUrl = presignedPayload?.cdnUrl;

      if (!presignedUrl || !cdnUrl) {
        setError("Upload URL response is missing required fields.");
        return;
      }

      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadRes.ok) {
        const uploadErrorText = await uploadRes.text();
        setError(uploadErrorText || "Could not upload the image bytes.");
        return;
      }

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
        setError(parseErrorMessage("Could not register uploaded image.", registerPayload));
        return;
      }

      const imageId =
        registerPayload?.imageId ??
        registerPayload?.id ??
        registerPayload?.image?.id ??
        registerPayload?.data?.id;

      if (!imageId) {
        setError("Image registration response did not include imageId.");
        return;
      }

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

      setGeneratedCaptions(captionsPayload);
      console.log("Generated captions payload:", captionsPayload);
      setSuccess("Upload complete and captions generated.");
    } catch (submitError) {
      console.error("upload modal submit error:", submitError);
      setError("Unexpected error while processing upload.");
    } finally {
      setIsSubmitting(false);
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
              Select an image and run the caption pipeline.
            </p>

            <label className="mt-4 block text-sm text-[#CBD5E1]" htmlFor="caption-upload-file">
              Image file
            </label>
            <input
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

            {generatedCaptions ? (
              <pre className="mt-4 max-h-40 overflow-auto rounded-md border border-slate-800 bg-[#020617] p-3 text-xs text-slate-300">
                {JSON.stringify(generatedCaptions, null, 2)}
              </pre>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-full border border-[#1e293b] bg-[#020617] px-4 py-2 text-sm font-medium text-[#e5e7eb] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !selectedFile}
                className="rounded-full bg-[#fbbf24] px-5 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
