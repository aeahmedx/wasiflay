import type { SupabaseClient } from "@supabase/supabase-js";

export type EventKind = "physical" | "online" | "contact";
export type EventStatus = "pending" | "approved" | "rejected";
export type RsvpKind = "interested" | "attending";

export type WasifEvent = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  region: string | null;
  venue_name: string | null;
  address: string | null;
  /** Null unless you're attending, or you created it, or you're staff. */
  join_url: string | null;
  status: EventStatus;
  review_note: string | null;
  is_mine: boolean;
  interested_count: number;
  attending_count: number;
  my_rsvp: RsvpKind | null;
  created_at: string;
};

/**
 * One string literal, not a concatenation. Supabase parses this at
 * compile time to type the result — a built-up string types as
 * GenericStringError instead, which is what the errors were.
 */
const FIELDS =
  "id, creator_id, title, description, kind, starts_at, ends_at, region, venue_name, address, join_url, status, review_note, is_mine, interested_count, attending_count, my_rsvp, created_at";

/**
 * Upcoming events. Past ones drop out six hours after they start unless
 * an end time says otherwise — they stay reachable by direct link, so a
 * shared link to yesterday's event still opens.
 */
export async function getUpcomingEvents(
  client: SupabaseClient,
  region: string | null,
  limit = 30,
  after?: string
): Promise<WasifEvent[]> {
  let query = client
    .from("public_events")
    .select(FIELDS)
    .eq("status", "approved")
    .gt("starts_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (region) query = query.or(`region.eq.${region},region.is.null`);
  if (after) query = query.gt("starts_at", after);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as WasifEvent[];
}

/** Your own events, including ones still awaiting review. */
export async function getMyEvents(
  client: SupabaseClient,
  userId: string
): Promise<WasifEvent[]> {
  const { data, error } = await client
    .from("public_events")
    .select(FIELDS)
    .eq("creator_id", userId)
    .order("starts_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as WasifEvent[];
}

export async function getEvent(
  client: SupabaseClient,
  id: string
): Promise<WasifEvent | null> {
  const { data, error } = await client
    .from("public_events")
    .select(FIELDS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as WasifEvent | null;
}

export type NewEvent = {
  creator_id: string;
  title: string;
  description: string;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  region: string | null;
  venue_name: string | null;
  address: string | null;
  join_url: string | null;
  organizer_name: string;
  organizer_phone: string | null;
  organizer_email: string | null;
  organizer_org: string | null;
};

export async function createEvent(
  client: SupabaseClient,
  input: NewEvent
): Promise<{ id: string }> {
  const { data, error } = await client
    .from("events")
    .insert(input)
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

// ---- RSVP -------------------------------------------------------------

export async function rsvp(
  client: SupabaseClient,
  eventId: string,
  kind: RsvpKind,
  consent = false
): Promise<void> {
  const { error } = await client.rpc("rsvp_event", {
    p_event: eventId,
    p_kind: kind,
    p_consent: consent,
  });
  if (error) throw error;
}

export async function cancelRsvp(
  client: SupabaseClient,
  eventId: string
): Promise<void> {
  const { error } = await client.rpc("cancel_rsvp", { p_event: eventId });
  if (error) throw error;
}

export type Attendee = {
  display_name: string | null;
  phone: string | null;
  email: string | null;
  /** True for under-18 attendees, whose details are never released. */
  withheld: boolean;
};

export async function getAttendees(
  client: SupabaseClient,
  eventId: string
): Promise<Attendee[]> {
  const { data, error } = await client.rpc("event_attendees", {
    p_event: eventId,
  });
  if (error) throw error;
  return (data ?? []) as Attendee[];
}

// ---- moderation -------------------------------------------------------

export type PendingEvent = {
  id: string;
  title: string;
  description: string;
  kind: EventKind;
  starts_at: string;
  region: string | null;
  venue_name: string | null;
  address: string | null;
  join_url: string | null;
  organizer_name: string;
  organizer_phone: string | null;
  organizer_email: string | null;
  organizer_org: string | null;
  creator_id: string;
  creator_name: string | null;
  created_at: string;
};

export async function getPendingEvents(
  client: SupabaseClient
): Promise<PendingEvent[]> {
  const { data, error } = await client.rpc("mod_pending_events", {
    p_limit: 50,
  });
  if (error) throw error;
  return (data ?? []) as PendingEvent[];
}

export async function getPendingEventCount(
  client: SupabaseClient
): Promise<number> {
  const { data, error } = await client.rpc("mod_pending_event_count");
  if (error) return 0;
  return (data as number) ?? 0;
}

export async function reviewEvent(
  client: SupabaseClient,
  eventId: string,
  status: EventStatus,
  note: string | null
): Promise<void> {
  const { error } = await client.rpc("mod_review_event", {
    p_event: eventId,
    p_status: status,
    p_note: note,
  });
  if (error) throw error;
}

// ---- display helpers --------------------------------------------------

export function eventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  // Rendered in the reader's own timezone, with the zone named — someone
  // in Toronto looking at a Philadelphia event should see their time and
  // know that's what they're seeing.
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

  if (!endsAt) return `${date}, ${time}`;

  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  const endTime = end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return sameDay
    ? `${date}, ${time.replace(/\s\w+$/, "")}–${endTime}`
    : `${date}, ${time}`;
}

export function isPast(e: WasifEvent): boolean {
  const end = e.ends_at
    ? new Date(e.ends_at)
    : new Date(new Date(e.starts_at).getTime() + 6 * 60 * 60 * 1000);
  return end < new Date();
}

export function eventErrorMessage(raw: string): string {
  if (raw.includes("EVENT_NOT_APPROVED"))
    return "This event is still being reviewed. Check back shortly.";
  if (raw.includes("ATTENDING_ONLINE_ONLY"))
    return "Just turn up — there's nothing to sign up for.";
  if (raw.includes("CONSENT_REQUIRED"))
    return "You'll need to agree to your details being shared first.";
  if (raw.includes("RATE_LIMIT"))
    return "That's a lot of events at once. Try again later.";
  if (raw.includes("FORBIDDEN")) return "You can't do that.";
  return "That didn't go through. Try again.";
}
