import { NextResponse, type NextRequest } from "next/server";
import { PROMO_COOKIE, PROMO_MAX_AGE, normalisePromoCode } from "@/lib/promo-code";

/**
 * wasiflay.com/t/NY07 — the link printed on a card.
 *
 * Stores the code and sends the person to the app. They should never
 * know this happened: no interstitial, no message, no delay.
 *
 * An unrecognised code is still stored rather than rejected. Validating
 * here would mean a typo on a card turns into a dead link, and a
 * mis-attributed sign-up is infinitely better than a lost one — the
 * dashboard surfaces unknown codes so a bad card can be spotted.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const clean = normalisePromoCode(code);

  const response = NextResponse.redirect(new URL("/", request.url));

  if (clean) {
    response.cookies.set(PROMO_COOKIE, clean, {
      path: "/",
      maxAge: PROMO_MAX_AGE,
      sameSite: "lax",
    });
  }

  return response;
}
