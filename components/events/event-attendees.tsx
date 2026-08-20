"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAttendees, type Attendee } from "@/lib/queries/events";

/**
 * The organiser's list. Under-18 attendees are counted but never named
 * — that's enforced in the database, so this can only ever display what
 * it's allowed to.
 */
export function EventAttendees({ eventId }: { eventId: string }) {
  const [rows, setRows] = useState<Attendee[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      setRows(await getAttendees(createClient(), eventId));
    } catch {
      setError("Couldn't load the list.");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!rows) return;
    const text = rows
      .filter((r) => !r.withheld)
      .map((r) => [r.display_name, r.phone, r.email].filter(Boolean).join(" · "))
      .join("\n");
    void navigator.clipboard.writeText(text);
  }

  const withheld = rows?.filter((r) => r.withheld).length ?? 0;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-4">
      <p className="font-medium text-stone-900">Who&apos;s signed up</p>

      {rows === null ? (
        <button
          onClick={load}
          disabled={busy}
          className="mt-2 text-sm text-emerald-800 underline underline-offset-4 disabled:opacity-40"
        >
          {busy ? "Loading…" : "Show the list"}
        </button>
      ) : rows.length === 0 ? (
        <p className="mt-1.5 text-sm text-stone-600">Nobody yet.</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className="text-sm text-stone-700">
                {r.withheld ? (
                  <span className="text-stone-500">
                    Attending — under 18, details withheld
                  </span>
                ) : (
                  <span dir="auto">
                    {r.display_name}
                    {r.phone ? ` · ${r.phone}` : ""}
                    {r.email ? ` · ${r.email}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {withheld > 0 && (
            <p className="mt-2 text-xs text-stone-500">
              {withheld === 1
                ? "One attendee is under 18, so their details aren't shared."
                : `${withheld} attendees are under 18, so their details aren't shared.`}
            </p>
          )}

          <button
            onClick={copy}
            className="mt-3 text-sm text-emerald-800 underline underline-offset-4"
          >
            Copy the list
          </button>
        </>
      )}

      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}

      <p className="mt-3 text-xs leading-relaxed text-stone-500">
        These details are deleted 30 days after the event. Don&apos;t use
        them for anything else.
      </p>
    </div>
  );
}
