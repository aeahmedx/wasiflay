"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createEvent,
  eventErrorMessage,
  updateEvent,
  type EventKind,
  type WasifEvent,
} from "@/lib/queries/events";
import type { Region } from "@/lib/queries/regions";
import { BackLink } from "@/components/back-link";
import { ContentNotice } from "@/components/content-notice";
import { checkContent } from "@/lib/content-safety";

const KINDS: { value: EventKind; label: string; hint: string }[] = [
  {
    value: "physical",
    label: "In person",
    hint: "Somewhere people turn up. The address is shown publicly.",
  },
  {
    value: "online",
    label: "Online",
    hint: "The joining link is only shown to people who sign up.",
  },
  {
    value: "contact",
    label: "Ask for details",
    hint: "No location shown. People ask about it on the event page.",
  },
];

const input =
  "w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800";
const label = "block text-sm font-medium text-stone-800 mb-1.5";

/** datetime-local wants local wall-clock time, not an ISO string. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function EventForm({
  userId,
  regions,
  defaultOrganizer,
  existing = null,
  organizer = null,
}: {
  userId: string;
  regions: Region[];
  defaultOrganizer: string;
  /** Set when editing. Create and edit share this form so the two can't
   *  drift apart in validation or wording. */
  existing?: WasifEvent | null;
  /** Organiser contact isn't in the public view, so it's loaded
   *  separately and passed in when editing. */
  organizer?: {
    name: string;
    phone: string | null;
    email: string | null;
    org: string | null;
  } | null;
}) {
  const router = useRouter();

  const [kind, setKind] = useState<EventKind>(existing?.kind ?? "physical");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalInput(existing?.starts_at ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(existing?.ends_at ?? null));
  const [region, setRegion] = useState(existing?.region ?? "__all__");

  const [venueName, setVenueName] = useState(existing?.venue_name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [joinUrl, setJoinUrl] = useState(existing?.join_url ?? "");

  const [orgName, setOrgName] = useState(organizer?.name ?? defaultOrganizer);
  const [orgPhone, setOrgPhone] = useState(organizer?.phone ?? "");
  const [orgEmail, setOrgEmail] = useState(organizer?.email ?? "");
  const [orgOrg, setOrgOrg] = useState(organizer?.org ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = checkContent(`${title} ${description}`).hasCardNumber;

  const valid =
    title.trim().length >= 5 &&
    startsAt.length > 0 &&
    orgName.trim().length > 0 &&
    (kind !== "physical" || address.trim().length > 0) &&
    (kind !== "online" || joinUrl.trim().length > 0) &&
    !blocked;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);

    const payload = {
        creator_id: userId,
        title: title.trim(),
        description: description.trim(),
        kind,
        // datetime-local has no timezone, so it's read as local time —
        // which is what the organiser meant when they typed it.
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        region: region === "__all__" ? null : region,
        venue_name: kind === "physical" ? venueName.trim() || null : null,
        address: kind === "physical" ? address.trim() : null,
        join_url: kind === "online" ? joinUrl.trim() : null,
        organizer_name: orgName.trim(),
        organizer_phone: orgPhone.trim() || null,
        organizer_email: orgEmail.trim() || null,
        organizer_org: orgOrg.trim() || null,
    };

    try {
      if (existing) {
        await updateEvent(createClient(), existing.id, payload);
        router.replace(`/events/${existing.id}`);
      } else {
        const created = await createEvent(createClient(), payload);
        router.replace(`/events/${created.id}`);
      }
      router.refresh();
    } catch (e) {
      setError(eventErrorMessage(e instanceof Error ? e.message : ""));
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          {existing ? "Edit event" : "Add an event"}
        </h1>
        <p className="mt-1 mb-6 text-stone-600">
          {existing
            ? "Changing the time, link or details sends it back for review."
            : "A moderator checks it before it appears. Usually quick."}
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <fieldset className="mb-5">
          <legend className={label}>What kind</legend>
          <div className="grid grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => setKind(k.value)}
                aria-pressed={kind === k.value}
                className={`rounded-lg border px-2 py-2.5 text-sm transition ${
                  kind === k.value
                    ? "border-emerald-800 bg-emerald-50 font-medium text-emerald-900"
                    : "border-stone-300 bg-stone-0 text-stone-700"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-stone-500">
            {KINDS.find((k) => k.value === kind)?.hint}
          </p>
        </fieldset>

        <div className="space-y-5">
          <div>
            <label htmlFor="title" className={label}>
              Name of the event
            </label>
            <input
              id="title"
              dir="auto"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              className={input}
            />
          </div>

          <div>
            <label htmlFor="starts" className={label}>
              Starts
            </label>
            <input
              id="starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={input}
            />
            <p className="mt-1.5 text-xs text-stone-500">
              In your own time zone. Everyone sees it in theirs.
            </p>
          </div>

          <div>
            <label htmlFor="ends" className={label}>
              Ends <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <input
              id="ends"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={input}
            />
            <p className="mt-1.5 text-xs text-stone-500">
              Without this it drops off the list six hours after it starts.
            </p>
          </div>

          {kind === "physical" && (
            <>
              <div>
                <label htmlFor="venue" className={label}>
                  Venue{" "}
                  <span className="font-normal text-stone-500">(optional)</span>
                </label>
                <input
                  id="venue"
                  dir="auto"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="address" className={label}>
                  Address
                </label>
                <input
                  id="address"
                  dir="auto"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={input}
                />
                <p className="mt-1.5 text-xs text-stone-500">
                  Shown publicly — people need it to turn up.
                </p>
              </div>
            </>
          )}

          {kind === "online" && (
            <div>
              <label htmlFor="join" className={label}>
                Joining link
              </label>
              <input
                id="join"
                type="url"
                inputMode="url"
                value={joinUrl}
                onChange={(e) => setJoinUrl(e.target.value)}
                placeholder="https://zoom.us/j/…"
                className={input}
              />
              <p className="mt-1.5 text-xs text-stone-500">
                Only shown to people who sign up, so it doesn&apos;t get
                passed around.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="region" className={label}>
              Region
            </label>
            <select
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className={input}
            >
              <option value="__all__">All regions</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="desc" className={label}>
              Details{" "}
              <span className="font-normal text-stone-500">(optional)</span>
            </label>
            <textarea
              id="desc"
              dir="auto"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={4000}
              className={input}
            />
          </div>

          <ContentNotice text={`${title} ${description}`} />

          {/* Organiser details are for moderators and for reaching the
              person behind an event. They are never shown publicly, and
              saying so plainly is the difference between someone filling
              this in honestly and leaving it blank. */}
          <div className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-4">
            <p className="font-medium text-stone-900">Your contact details</p>
            <p className="mt-1 text-sm text-stone-600">
              Never shown publicly. Moderators use them to check the event
              is real and to reach you if something changes.
            </p>

            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="orgname" className={label}>
                  Your name
                </label>
                <input
                  id="orgname"
                  dir="auto"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="orgphone" className={label}>
                  Phone
                </label>
                <input
                  id="orgphone"
                  type="tel"
                  inputMode="tel"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="orgemail" className={label}>
                  Email
                </label>
                <input
                  id="orgemail"
                  type="email"
                  inputMode="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="orgorg" className={label}>
                  Organisation{" "}
                  <span className="font-normal text-stone-500">(optional)</span>
                </label>
                <input
                  id="orgorg"
                  dir="auto"
                  value={orgOrg}
                  onChange={(e) => setOrgOrg(e.target.value)}
                  className={input}
                />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3.5 font-medium text-stone-0 disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : existing
            ? "Save changes"
            : "Submit for review"}
        </button>
      </div>
    </main>
  );
}
