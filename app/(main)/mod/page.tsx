import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { ReportQueue } from "@/components/mod/report-queue";
import { BackLink } from "@/components/back-link";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function ModPage() {
  const profile = await getCurrentProfile();

  // notFound rather than redirect: don't confirm the route exists to
  // someone who isn't staff.
  if (!profile || profile.role === "member") notFound();

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <BackLink />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
          Moderation
        </h1>
        <p className="mt-1 mb-6 text-stone-600">
          Wasif Lay is for coordination, not conflict. Apply the rules the
          same way for everyone.
        </p>

        <ErrorBoundary label="The moderation queue">
          <ReportQueue isAdmin={profile.role === "admin"} />
        </ErrorBoundary>
      </div>
    </main>
  );
}
