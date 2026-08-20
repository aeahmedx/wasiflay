"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getPendingEvents,
  reviewEvent,
  eventWhen,
  type PendingEvent,
} from "@/lib/queries/events";

/**
 * Approving an event is what unlocks contact collection on it, so this
 * queue is a gate rather than a formality. The organiser's details are
 * visible here and nowhere else — checking that a real, reachable person
 * is behind an event is the entire point of the review.
 */
export function EventReview() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setEvents(await getPendingEvents(supabase));
    } catch (e) {
      setNotice(
        `Couldn't load: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setNotice(null);
    try {
      await reviewEvent(
        supabase,
        id,
        approve ? "approved" : "rejected",
        approve ? null : note.trim() || null
      );
      setRejecting(null);
      setNote("");
      await load();
    } catch {
      setNotice("That didn't go through.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-stone-500">
        Approving an event is what lets it collect attendees&apos; contact
        details. Check the organiser is real and reachable before you do.
      </p>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-800"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : events.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
          Nothing waiting.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-stone-300 bg-stone-0 px-4 py-4"
            >
              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                {e.kind === "physical"
                  ? "In person"
                  : e.kind === "online"
                  ? "Online"
                  : "Ask for details"}
              </span>

              <h3 className="mt-2 font-medium text-stone-900" dir="auto">
                {e.title}
              </h3>
              <p className="mt-1 text-sm text-stone-700">
                {eventWhen(e.starts_at, null)}
              </p>

              {e.description && (
                <p
                  className="mt-2 whitespace-pre-wrap wrap-break-word rounded bg-stone-50 px-3 py-2 text-sm text-stone-800"
                  dir="auto"
                >
                  {e.description}
                </p>
              )}

              {e.address && (
                <p className="mt-2 text-sm text-stone-700" dir="auto">
                  {e.venue_name ? `${e.venue_name} — ` : ""}
                  {e.address}
                </p>
              )}

              {e.join_url && (
                <p className="mt-2 break-all text-sm text-stone-700">
                  {e.join_url}
                </p>
              )}

              <div className="mt-3 rounded bg-stone-50 px-3 py-2 text-sm text-stone-700">
                <p className="font-medium text-stone-900">Organiser</p>
                <p dir="auto">
                  {e.organizer_name}
                  {e.organizer_org ? ` — ${e.organizer_org}` : ""}
                </p>
                {e.organizer_phone && <p>{e.organizer_phone}</p>}
                {e.organizer_email && <p>{e.organizer_email}</p>}
                <p className="mt-1 text-xs text-stone-500" dir="auto">
                  Posted by {e.creator_name ?? "Unknown"}
                </p>
              </div>

              {rejecting === e.id ? (
                <div className="mt-3">
                  <label
                    htmlFor={`note-${e.id}`}
                    className="block text-sm text-stone-800"
                  >
                    Why? The organiser sees this.
                  </label>
                  <textarea
                    id={`note-${e.id}`}
                    value={note}
                    onChange={(ev) => setNote(ev.target.value)}
                    rows={2}
                    maxLength={300}
                    className="mt-1 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => decide(e.id, false)}
                      disabled={busy === e.id}
                      className="rounded-lg bg-red-800 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setRejecting(null)}
                      className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => decide(e.id, true)}
                    disabled={busy === e.id}
                    className="rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
                  >
                    {busy === e.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => setRejecting(e.id)}
                    disabled={busy === e.id}
                    className="rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-800 disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <a
                    href={`/events/${e.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
                  >
                    Open
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
