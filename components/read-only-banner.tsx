import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/queries/safety";

/**
 * Shown when the kill switch is on. Silence would read as the app being
 * broken; saying so plainly reads as someone being in control of it.
 */
export async function ReadOnlyBanner() {
  const supabase = await createClient();
  const settings = await getSiteSettings(supabase);

  if (!settings.read_only) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-amber-300 bg-amber-100 px-4 py-2.5 text-center">
      <p className="text-sm font-medium text-stone-900">
        {settings.notice ?? "Wasif Lay is read-only for a moment. You can still read everything."}
      </p>
    </div>
  );
}
