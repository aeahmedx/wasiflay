"use client";

import { useHydrated } from "@/lib/hooks/use-now";
import { kickoffLabel } from "@/lib/queries/predictions";

/**
 * A timestamp in the reader's own timezone.
 *
 * Formatting a date inside a server component uses the server's
 * timezone, which is UTC — a 10:16pm kickoff renders as 2:16am and
 * everyone in the Americas sees tomorrow's date. The value is correct;
 * the place it was formatted was wrong.
 *
 * So nothing is rendered until hydration, then the browser formats it
 * with the reader's own locale and offset. The gap is one frame, and
 * the reserved space stops the layout jumping.
 */
export function LocalTime({
  iso,
  className = "",
}: {
  iso: string;
  className?: string;
}) {
  const hydrated = useHydrated();

  if (!hydrated) {
    // Holds the space so nothing shifts when the real value lands.
    return (
      <span aria-hidden className={`inline-block opacity-0 ${className}`}>
        00:00
      </span>
    );
  }

  return (
    <time dateTime={iso} className={className}>
      {kickoffLabel(iso)}
    </time>
  );
}

/**
 * A date and time range, for events. Same reasoning as above, plus the
 * timezone name — someone in Toronto looking at a Philadelphia event
 * should see their own time and know that's what they're seeing.
 */
export function LocalEventTime({
  startsAt,
  endsAt,
  className = "",
}: {
  startsAt: string;
  endsAt: string | null;
  className?: string;
}) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <span aria-hidden className={`inline-block opacity-0 ${className}`}>
        Sat, Jan 1, 00:00
      </span>
    );
  }

  const start = new Date(startsAt);
  const date = start.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  if (!endsAt) {
    return (
      <time dateTime={startsAt} className={className}>
        {date}, {time}
      </time>
    );
  }

  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endTime = end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <time dateTime={startsAt} className={className}>
      {sameDay ? `${date}, ${time.replace(/\s\w+$/, "")}–${endTime}` : `${date}, ${time}`}
    </time>
  );
}
