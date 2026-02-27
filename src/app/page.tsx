import type { ReactElement } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type ImageRow = {
  id: string;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
  url: string | null;
  is_common_use: boolean | null;
  profile_id: string | null;
  additional_context: string | null;
  is_public: boolean | null;
  image_description: string | null;
  celebrity_recognition: string | null;
};

function renderImage(url: string | null, alt: string): ReactElement {
  if (!url) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-100 text-sm text-zinc-500">
        No image URL
      </div>
    );
  }

  return <img src={url} alt={alt} className="h-48 w-full rounded-md object-cover" />;
}

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: images, error } = await supabase
    .from("images")
    .select(
      "id,created_datetime_utc,modified_datetime_utc,url,is_common_use,profile_id,additional_context,is_public,image_description,celebrity_recognition",
    );

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-3xl rounded-xl border border-red-300 bg-red-50 p-6">
          <h1 className="text-xl font-semibold text-red-900">Could not load images</h1>
          <p className="mt-2 text-sm text-red-800">{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Images</h1>
          <p className="text-sm text-zinc-600">Loaded {(images ?? []).length} rows from Supabase table `public.images`.</p>
        </header>

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(images ?? []).map((image: ImageRow) => (
            <article key={image.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              {renderImage(image.url, image.image_description ?? "Image")}
              <div className="mt-4 space-y-2 text-sm">
                <p className="line-clamp-2 font-semibold" title={image.image_description ?? undefined}>
                  {image.image_description ?? "No description"}
                </p>
                <p className="line-clamp-2 text-zinc-600" title={image.additional_context ?? undefined}>
                  {image.additional_context ?? "No additional context"}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-zinc-100 px-2 py-1">{image.is_public ? "Public" : "Private"}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-1">
                    {image.is_common_use ? "Common Use" : "Not Common Use"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
