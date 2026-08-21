import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getEvent, getOrganizerContact } from "@/lib/queries/events";
import { getRegions } from "@/lib/queries/regions";
import { EventForm } from "@/components/events/event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/signup?next=${encodeURIComponent(`/events/${id}/edit`)}`);
  }

  const [event, regions, profile] = await Promise.all([
    getEvent(supabase, id),
    getRegions(supabase),
    getCurrentProfile(),
  ]);

  if (!event) notFound();

  // Only the organiser edits their own event. Staff moderate through
  // /mod rather than by editing someone else's words.
  if (event.creator_id !== user.id) redirect(`/events/${id}`);

  const organizer = await getOrganizerContact(supabase, id);

  return (
    <EventForm
      userId={user.id}
      regions={regions}
      defaultOrganizer={profile?.display_name ?? ""}
      existing={event}
      organizer={organizer}
    />
  );
}
