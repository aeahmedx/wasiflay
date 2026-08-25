import { NextResponse, type NextRequest } from "next/server";
import { PREVIEW_COOKIE } from "@/lib/gate-guard";

/**
 * A way past the gate, for showing someone the app before it opens.
 *
 * Visiting /preview sets a cookie and drops you on the feed; /preview?off
 * clears it. Deliberately not a secret — the gate protects the moment,
 * not the data, and everything behind it is readable by anyone once the
 * app opens anyway.
 */
export async function GET(request: NextRequest) {
  const off = request.nextUrl.searchParams.has("off");
  const response = NextResponse.redirect(new URL(off ? "/gate" : "/", request.url));

  if (off) {
    response.cookies.set(PREVIEW_COOKIE, "", { path: "/", maxAge: 0 });
  } else {
    response.cookies.set(PREVIEW_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  return response;
}
