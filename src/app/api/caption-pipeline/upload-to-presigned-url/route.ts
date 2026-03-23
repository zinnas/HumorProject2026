import { NextResponse } from "next/server";

type UploadRequestBody = {
  sourceImageUrl: string;
  presignedUrl: string;
  contentType: string;
};

export async function POST(request: Request) {
  try {
    const { sourceImageUrl, presignedUrl, contentType } =
      (await request.json()) as UploadRequestBody;

    if (!sourceImageUrl || !presignedUrl || !contentType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sourceRes = await fetch(sourceImageUrl);

    if (!sourceRes.ok) {
      const errorBody = await sourceRes.text();
      return NextResponse.json(
        {
          error: "Failed to fetch sourceImageUrl",
          status: sourceRes.status,
          body: errorBody,
        },
        { status: sourceRes.status }
      );
    }

    const imageBytes = await sourceRes.arrayBuffer();

    const uploadRes = await fetch(presignedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: imageBytes,
    });

    if (!uploadRes.ok) {
      const errorBody = await uploadRes.text();
      return NextResponse.json(
        {
          error: "Failed to PUT to presignedUrl",
          status: uploadRes.status,
          body: errorBody,
        },
        { status: uploadRes.status }
      );
    }

    return NextResponse.json({ ok: true, uploadStatus: uploadRes.status });
  } catch (error) {
    console.error("upload-to-presigned-url route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
