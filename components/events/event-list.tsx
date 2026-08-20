"use client";

import Link from "next/link";
import type { WasifEvent } from "@/lib/queries/events";
import type { Region } from "@/lib/queries/regions";
import { EventCard } from "@/components/events/event-card";

export function EventList({
  events,
  regions,
  signedIn,
}: {
  events: WasifEvent[];
  regions: Region[];
  signedIn: boolean;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">What&apos;s coming up.</p>
        <Link
          href={signedIn ? "/events/new" : "/signup?next=%2Fevents%2Fnew"}
          className="shrink-0 rounded-full bg-emerald-800 px-3.5 py-1.5 text-sm font-medium text-stone-0"
        >
          Add an event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
          <p className="mb-4 text-stone-600">
            Nothing coming up yet. Know of something?
          </p>
          <Link
            href={signedIn ? "/events/new" : "/signup?next=%2Fevents%2Fnew"}
            className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
          >
            Add the first one
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <EventCard event={e} regions={regions} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
