import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions } from "@/lib/queries/regions";
import { CreatePostForm } from "@/components/posts/create-post-form";
import { BackLink } from "@/components/back-link";

export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Carry the query through the sign-in detour, so someone who
    // searched, found nothing, and signed up still lands on a prefilled
    // form rather than an empty one.
    const next = q ? `/create?q=${encodeURIComponent(q)}` : "/create";
    redirect(`/signup?next=${encodeURIComponent(next)}`);
  }

  const [profile, regions] = await Promise.all([
    getCurrentProfile(),
    getRegions(supabase),
  ]);

  // A banned account could previously open the form, write a whole post,
  // and get a generic failure on submit. Say it before they type.
  if (profile?.is_banned) {
    return (
      <main className="min-h-dvh bg-stone-50 px-4 py-6">
        <div className="max-w-md mx-auto">
          <BackLink />
          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-0 px-4 py-6">
            <h1 className="text-lg font-medium text-stone-900">
              Your account is suspended
            </h1>
            <p className="mt-2 text-stone-600">
              You can still read everything on Wasif Lay, but you can&apos;t
              post while the suspension is in place.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <CreatePostForm
      userId={user.id}
      regions={regions}
      initialTitle={(q ?? "").slice(0, 200)}
    />
  );
}
