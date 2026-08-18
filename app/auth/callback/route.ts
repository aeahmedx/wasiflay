import { createClient } from "@/lib/supabase/server";
import { profileExists } from "@/lib/queries/profiles";
import { safeNext } from "@/lib/safe-next";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/signup?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/signup?error=exchange_failed`);
  }

  // Behind a proxy, the forwarded host is the real one.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  // First-time users must complete onboarding, but they should still land
  // where they started once they're done.
  const hasProfile = await profileExists(supabase, data.user.id);
  if (!hasProfile) {
    return NextResponse.redirect(
      `${base}/onboarding?next=${encodeURIComponent(next)}`
    );
  }

  return NextResponse.redirect(`${base}${next}`);
}
