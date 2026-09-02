import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { BackLink } from "@/components/back-link";
import { PromoterDashboard } from "@/components/mod/promoter-dashboard";

export const metadata: Metadata = { title: "Signups" };

/**
 * The booth dashboard, on its own URL so it can be opened directly on a
 * phone rather than found through the moderation panel.
 */
export default async function PromotersPage() {
  const profile = await getCurrentProfile();

  const isStaff =
    profile?.role === "moderator" || profile?.role === "admin";

  if (!isStaff) redirect("/");

  return (
    <main className="min-h-dvh bg-stone-50 px-4 pt-6 pb-safe-page">
      <div className="mx-auto max-w-md">
        <BackLink />
        <div className="mt-4">
          <PromoterDashboard />
        </div>
      </div>
    </main>
  );
}
