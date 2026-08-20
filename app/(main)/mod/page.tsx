import { notFound } from "next/navigation";
import { ViewTabs } from "@/components/view-tabs";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { ReportQueue } from "@/components/mod/report-queue";
import { UserSearch } from "@/components/mod/user-search";
import { RemovedContent } from "@/components/mod/removed-content";
import { KillSwitch } from "@/components/mod/kill-switch";
import { EventReview } from "@/components/mod/event-review";
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
  const isAdmin = profile.role === "admin";

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
            ]}
          />
        </div>

        <ErrorBoundary label="The moderation panel">
          {onUsers ? (
            <UserSearch isAdmin={isAdmin} viewerId={profile.id} />
          ) : onEvents ? (
            <EventReview />
          ) : onRemoved ? (
            <RemovedContent isAdmin={isAdmin} />
          ) : (
            <ReportQueue isAdmin={isAdmin} viewerId={profile.id} />
          )}
        </ErrorBoundary>

        {isAdmin && (
          <div className="mt-8 border-t border-stone-200 pt-6">
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
