import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { NotificationList } from "@/components/notifications/notification-list";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/signup?next=%2Fnotifications");

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="max-w-md mx-auto">
        <h1 className="mb-5 text-2xl font-semibold tracking-tight text-stone-900">
          Activity
        </h1>

        <ErrorBoundary label="Activity">
          <NotificationList userId={profile.id} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
