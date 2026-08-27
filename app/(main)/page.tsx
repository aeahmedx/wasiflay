import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions, regionName } from "@/lib/queries/regions";
import {
  getAuthorsFor,
  getLatestPosts,
  getTrendingPosts,
  getUnansweredCount,
  getUnansweredPosts,
} from "@/lib/queries/posts";
import { PostFeed } from "@/components/posts/post-feed";
import { EventList } from "@/components/events/event-list";
import { Wordmark } from "@/components/wordmark";
import { cookies } from "next/headers";
import { getUpcomingEvents } from "@/lib/queries/events";
import { RegionPicker } from "@/components/region-picker";
import { ViewTabs } from "@/components/view-tabs";
import { getOpenReportCount } from "@/lib/queries/moderation";
import { ModBadge } from "@/components/mod-badge";

type Search = { tab?: string; region?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;

  // Region survives moving between pages. The picker writes a cookie so
  // the choice isn't lost the moment someone opens a post and comes
  // back — an explicit ?region= in the URL still wins, so a shared link
  // still points where it says.
  const jar = await cookies();
  const savedRegion = jar.get("wl_region")?.value ?? null;
  const tab =
    params.tab === "trending"
      ? "trending"
      : params.tab === "needs"
      ? "needs"
      : params.tab === "events"
      ? "events"
      : "latest";

  const supabase = await createClient();
  const [profile, regions] = await Promise.all([
    getCurrentProfile(),
    getRegions(supabase),
  ]);

  const isStaff = profile?.role === "moderator" || profile?.role === "admin";
  const openReports = isStaff ? await getOpenReportCount(supabase) : 0;

  /**
   * One feed, for now.
   *
   * Regions split a community that is barely a few hundred people into
   * pieces, and each piece then looks empty. The machinery stays — the
   * cookie, the query parameter, the filtering, the picker component —
   * because it's right for a year from now and wrong for this month.
   *
   * Turning it back on is deleting this constant and restoring the two
   * lines below it. Nothing else has to change.
   */
  const REGIONS_ENABLED = false;

  const chosenRegion = REGIONS_ENABLED
    ? params.region ?? savedRegion ?? profile?.region ?? null
    : null;
  const region = chosenRegion === "all" ? null : chosenRegion;

  const events =
    tab === "events" ? await getUpcomingEvents(supabase, region) : [];

  const [posts, unanswered] = await Promise.all([
    tab === "events"
      ? Promise.resolve([])
      : tab === "trending"
      ? getTrendingPosts(supabase, region)
      : tab === "needs"
      ? getUnansweredPosts(supabase, region)
      : getLatestPosts(supabase, region),
    getUnansweredCount(supabase, region),
  ]);
  const authors = await getAuthorsFor(supabase, posts);

  // Carry the current region choice across tab switches, including "all".
  const regionQuery = `&region=${chosenRegion ?? "all"}`;

  return (
    <main className="min-h-dvh bg-stone-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-baseline justify-between mb-5">
          <h1>
            <Wordmark size="md" />
          </h1>
          <span className="flex items-center gap-4">
            {profile ? (
              <>
                {/* Rooms and Activity moved to the tab bar; what's left
                    is the account and, for staff, the queue. */}
                <ModBadge isStaff={isStaff} initialReports={openReports} />
                <Link
                  href={`/profile/${profile.id}`}
                  className="text-sm text-emerald-800 underline underline-offset-4"
                >
                  Profile
                </Link>
              </>
            ) : (
              <Link
                href="/signup"
                className="text-sm text-emerald-800 underline underline-offset-4"
              >
                Sign in
              </Link>
            )}
          </span>
        </div>

        {/* SPEC 3.1 — search is the centrepiece. */}
        <Link
          href="/search"
          className="flex items-center gap-2 rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-stone-500 mb-5"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden>
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="m13.5 13.5 3 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          What do you need?
        </Link>

        <div className="mb-3 flex items-center justify-between gap-2">
          <ViewTabs
            activeKey={tab}
            tabs={[
              {
                key: "latest",
                label: "Latest",
                href: `/?tab=latest${regionQuery}`,
              },
              {
                key: "trending",
                label: "Trending",
                href: `/?tab=trending${regionQuery}`,
              },
              {
                // Count lives on the tab rather than becoming another
                // badge — one signal reads, two is noise. Capped at 99+
                // so the label can't stretch the row.
                key: "needs",
                label:
                  unanswered > 0
                    ? `Needs answers (${unanswered > 99 ? "99+" : unanswered})`
                    : "Needs answers",
                href: `/?tab=needs${regionQuery}`,
              },
            ]}
          />

          {/* Pushed to the right on purpose: events aren't another way
              of sorting posts, they're a different thing entirely. */}
          <Link
            href={`/?tab=events${regionQuery}`}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition ${
              tab === "events"
                ? "bg-stone-900 text-stone-0"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            Events
          </Link>
        </div>

        {/* Own row: three tabs and a region name competing for one line
            is what forced the scroll. The picker carries the active tab
            through, so switching region keeps you where you were. */}
        <div className="mb-4">
          {REGIONS_ENABLED && (
            <RegionPicker regions={regions} current={region} tab={tab} />
          )}
        </div>

        {tab === "events" ? (
          <EventList
            key={`events:${region ?? "all"}`}
            events={events}
            regions={regions}
            signedIn={Boolean(profile)}
          />
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
            {/* An empty needs-queue is good news, so "nothing here yet"
                would be exactly the wrong message. */}
            {tab === "needs" ? (
              <>
                <p className="text-stone-600 mb-4">
                  Every question here has an answer. Nice.
                </p>
                <Link
                  href={`/?tab=latest${regionQuery}`}
                  className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
                >
                  Back to the feed
                </Link>
              </>
            ) : (
              <>
                <p className="text-stone-600 mb-4">
                  {region
                    ? `Nothing in ${regionName(regions, region)} yet.`
                    : "Nothing here yet."}
                </p>
                <Link
                  href="/create"
                  className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
                >
                  Ask the first question
                </Link>
              </>
            )}
          </div>
        ) : (
          <PostFeed
            // Remounts when the tab or region changes. Without a key,
            // the list is seeded into useState once and never updates —
            // the server sends the right posts and the component keeps
            // showing the old ones, which is exactly what "switching
            // tabs does nothing" looked like.
            key={`${tab}:${region ?? "all"}`}
            initialPosts={posts}
            initialAuthors={authors}
            regions={regions}
            region={region}
            tab={tab}
          />
        )}
      </div>

    </main>
  );
}
