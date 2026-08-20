import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getEvent, eventWhen, isPast } from "@/lib/queries/events";
import { getRegions, regionName } from "@/lib/queries/regions";
import { BackLink } from "@/components/back-link";
import { EventRsvp } from "@/components/events/event-rsvp";
import { EventAttendees } from "@/components/events/event-attendees";
import { ReportButton } from "@/components/report-button";

const KIND_LABEL = {
  physical: "In person",
  online: "Online",
  contact: "Ask for details",
} as const;

export default async function EventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [event, regions, profile] = await Promise.all([
    getEvent(supabase, id),
    getRegions(supabase),
    getCurrentProfile(),
  ]);

  if (!event) notFound();

  const past = isPast(event);

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <BackLink />

        {event.status === "pending" && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-stone-800">
            {event.is_mine
              ? "A moderator is checking this. It isn't public yet."
              : "This event hasn't been reviewed yet."}
          </p>
        )}

        {event.status === "rejected" && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            This event wasn&apos;t approved.
            {event.review_note ? ` ${event.review_note}` : ""}
          </p>
        )}

        {past && (
          <p className="mt-4 rounded-lg border border-stone-200 bg-stone-100 px-4 py-2.5 text-sm text-stone-700">
            This one has already happened.
          </p>
        )}

        <article className="mt-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
            {KIND_LABEL[event.kind]}
          </span>

          <h1
            className="mt-2 text-xl font-semibold leading-snug text-stone-900"
            dir="auto"
          >
            {event.title}
          </h1>

          <p className="mt-2 font-medium text-stone-800">
            {eventWhen(event.starts_at, event.ends_at)}
          </p>

          <p className="mt-1 text-sm text-stone-600">
            {event.region ? regionName(regions, event.region) : "All regions"}
          </p>

          {event.kind === "physical" && event.address && (
            <p className="mt-3 text-stone-800" dir="auto">
              {event.venue_name && (
                <span className="block font-medium">{event.venue_name}</span>
              )}
              {event.address}
            </p>
          )}

          {event.kind === "online" &&
            (event.join_url ? (
              <a
                href={event.join_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block break-all rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 underline underline-offset-4"
              >
                {event.join_url}
              </a>
            ) : (
              <p className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                The joining link is shown once you sign up.
              </p>
            ))}

          {event.description && (
            <p
              className="mt-3 whitespace-pre-wrap wrap-break-word text-stone-800"
              dir="auto"
            >
              {event.description}
            </p>
          )}

          <p className="mt-3 text-sm text-stone-500">
            {event.interested_count} interested
            {event.kind === "online"
              ? ` · ${event.attending_count} signed up`
              : ""}
          </p>
        </article>

        {!past && event.status === "approved" && (
          <div className="mt-4">
            <EventRsvp
              event={event}
              signedIn={Boolean(profile)}
              isMinor={profile?.is_minor ?? false}
            />
          </div>
        )}

        {event.is_mine && event.kind === "online" && (
          <div className="mt-4">
            <EventAttendees eventId={event.id} />
          </div>
        )}

        {/*
          Organiser contact details are never shown. Asking becomes a
          post instead, which the whole community can answer — and means
          nobody's phone number sits on a public page.
        */}
        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
          <p className="font-medium text-stone-900">
            Got a question about this?
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Ask publicly — the organiser or anyone who knows can answer.
          </p>
          <Link
            href={`/create?q=${encodeURIComponent(
              `About "${event.title}": `
            )}&event=${event.id}`}
            className="mt-3 inline-block rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-800"
          >
            Ask about this event
          </Link>
        </div>

        {profile && !event.is_mine && (
          <div className="mt-4 text-center">
            <ReportButton
              targetType="event"
              targetId={event.id}
              userId={profile.id}
            />
          </div>
        )}

        {event.is_mine && (
          <div className="mt-4 text-center">
            <Link
              href={`/events/${event.id}/edit`}
              className="text-sm text-stone-600 underline underline-offset-4"
            >
              Edit this event
            </Link>
            <p className="mt-1.5 text-xs text-stone-500">
              Changing the time, link or details sends it back for review.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
