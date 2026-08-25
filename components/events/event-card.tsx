import Link from "next/link";
import type { WasifEvent } from "@/lib/queries/events";
import { LocalEventTime } from "@/components/matches/local-time";
import { regionName } from "@/lib/queries/regions";
import type { Region } from "@/lib/queries/regions";

const KIND_LABEL: Record<WasifEvent["kind"], string> = {
  physical: "In person",
  online: "Online",
  contact: "Ask for details",
};

export function EventCard({
  event,
  regions,
}: {
  event: WasifEvent;
  regions: Region[];
}) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-4 hover:border-stone-300"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
          {KIND_LABEL[event.kind]}
        </span>
        {event.status !== "approved" && (
          <span className="shrink-0 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
            {event.status === "pending" ? "Being reviewed" : "Not approved"}
          </span>
        )}
      </div>

      <h2 className="mt-2 font-medium leading-snug text-stone-900" dir="auto">
        {event.title}
      </h2>

      <LocalEventTime
        startsAt={event.starts_at}
        endsAt={event.ends_at}
        className="mt-1 block text-sm text-stone-700"
      />

      <p className="mt-1 text-sm text-stone-500" dir="auto">
        {event.kind === "physical" && event.venue_name
          ? `${event.venue_name} · `
          : ""}
        {event.region ? regionName(regions, event.region) : "All regions"}
        {event.interested_count > 0 ? ` · ${event.interested_count} interested` : ""}
      </p>
    </Link>
  );
}
