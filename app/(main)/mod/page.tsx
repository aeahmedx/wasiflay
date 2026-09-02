import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTabs } from "@/components/view-tabs";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { ReportQueue } from "@/components/mod/report-queue";
import { UserSearch } from "@/components/mod/user-search";
import { RemovedContent } from "@/components/mod/removed-content";
import { KillSwitch } from "@/components/mod/kill-switch";
import { GateControls } from "@/components/mod/gate-controls";
import { getGateReveal, getGateState } from "@/lib/queries/gate";
import { EventReview } from "@/components/mod/event-review";
import { MatchAdmin } from "@/components/mod/match-admin";
import { getPendingEventCount } from "@/lib/queries/events";
import { getSiteSettings } from "@/lib/queries/safety";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function ModPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const profile = await getCurrentProfile();

  // notFound rather than redirect: don't confirm the route exists to
  // someone who isn't staff.
  if (!profile || profile.role === "member") notFound();

  const supabase = await createClient();
  const settings = await getSiteSettings(supabase);

  const pendingEvents = await getPendingEventCount(supabase);

  const onUsers = view === "users";
  const onRemoved = view === "removed";
  const onEvents = view === "events";
  const onMatches = view === "matches";
  const isAdmin = profile.role === "admin";

  // Only an admin can change the gate, so only an admin needs its state.
  const gate = isAdmin ? await getGateState(supabase) : null;
  const reveal = isAdmin ? await getGateReveal(supabase) : null;

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Moderation
        </h1>
        <p className="mt-1 mb-5 text-stone-600">
          Wasif Lay is for coordination, not conflict. Apply the rules the
          same way for everyone.
        </p>

        <div className="mb-5">
          <ViewTabs
            activeKey={
              onUsers
                ? "users"
                : onRemoved
                ? "removed"
                : onEvents
                ? "events"
                : onMatches
                ? "matches"
                : "reports"
            }
            tabs={[
              { key: "reports", label: "Reports", href: "/mod" },
              { key: "users", label: "People", href: "/mod?view=users" },
              {
                key: "removed",
                label: "Removed",
                href: "/mod?view=removed",
              },
              {
                key: "events",
                label:
                  pendingEvents > 0 ? `Events (${pendingEvents})` : "Events",
                href: "/mod?view=events",
              },
              {
                key: "matches",
                label: "Matches",
                href: "/mod?view=matches",
              },
            ]}
          />
        </div>

        <ErrorBoundary label="The moderation panel">
          {onUsers ? (
            <UserSearch isAdmin={isAdmin} viewerId={profile.id} />
          ) : onMatches ? (
            <MatchAdmin isAdmin={isAdmin} />
          ) : onEvents ? (
            <EventReview />
          ) : onRemoved ? (
            <RemovedContent isAdmin={isAdmin} />
          ) : (
            <ReportQueue isAdmin={isAdmin} viewerId={profile.id} />
          )}
        </ErrorBoundary>

        {/* The booth dashboard, on its own URL so it opens directly on
            a phone rather than being found through here. */}
        <div className="mt-6">
          <Link
            href="/mod/promoters"
            className="block rounded-lg border border-stone-300 bg-stone-0 px-4 py-3"
          >
            <span className="block text-sm font-medium text-stone-900">
              Signups
            </span>
            <span className="block text-xs text-stone-600">
              Totals, per card, per hour. Built for a phone at the booth.
            </span>
          </Link>
        </div>

        {isAdmin && gate && reveal && (
          <div className="mt-8 border-t border-stone-200 pt-6">
            <GateControls initial={gate} reveal={reveal} />
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 border-t border-stone-200 pt-6">
            <KillSwitch
              initialReadOnly={settings.read_only}
              initialNotice={settings.notice}
            />
          </div>
        )}
      </div>
    </main>
  );
}
