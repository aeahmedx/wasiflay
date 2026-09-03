import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { BackLink } from "@/components/back-link";
import { PhotoForm } from "@/components/posts/photo-form";

export const metadata: Metadata = { title: "Add a photo" };

export default async function CreatePhotoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?next=${encodeURIComponent("/create/photo")}`);
  }

  const profile = await getCurrentProfile();

  // A banned account could otherwise pick a photo, wait for the upload,
  // and get a generic failure on submit. Say it before they choose.
  if (profile?.is_banned) {
    return (
      <main className="min-h-dvh bg-stone-50 px-4 py-6">
        <div className="mx-auto max-w-md">
          <BackLink />
          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-0 px-4 py-6">
            <h1 className="text-lg font-medium text-stone-900">
              You can&apos;t post right now
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Your account has been restricted. Email wasiflay@gmail.com if
              you think that&apos;s a mistake.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Add a photo
        </h1>
        <p className="mt-1 mb-5 text-sm text-stone-600">
          It goes straight to the wall and the feed.
        </p>
        <PhotoForm userId={user.id} />
      </div>
    </main>
  );
}
