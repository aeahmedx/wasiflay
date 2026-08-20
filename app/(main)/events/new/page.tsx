import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions } from "@/lib/queries/regions";
import { EventForm } from "@/components/events/event-form";
import { BackLink } from "@/components/back-link";

export default async function NewEventPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signup?next=%2Fevents%2Fnew");

  const [profile, regions] = await Promise.all([
    getCurrentProfile(),
    getRegions(supabase),
  ]);

  if (profile?.is_banned) {
    return (
      <main className="min-h-dvh bg-stone-50 px-4 py-6">
        <div className="mx-auto max-w-md">
          <BackLink />
          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-0 px-4 py-6">
            <h1 className="text-lg font-medium text-stone-900">
              Your account is suspended
            </h1>
            <p className="mt-2 text-stone-600">
              You can still read everything, but you can&apos;t add events
              while the suspension is in place.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <EventForm
      userId={user.id}
      regions={regions}
      defaultOrganizer={profile?.display_name ?? ""}
    />
  );
}
