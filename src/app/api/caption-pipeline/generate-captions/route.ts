import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type GenerateCaptionsRequestBody = {
  imageId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;

    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const { imageId } = (await request.json()) as GenerateCaptionsRequestBody;

    if (!imageId) {
      return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
    }

    const upstreamRes = await fetch("https://api.almostcrackd.ai/pipeline/generate-captions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageId,
      }),
    });

    const data = await upstreamRes.json();

    return NextResponse.json(data, { status: upstreamRes.status });
  } catch (error) {
    console.error("generate-captions route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
