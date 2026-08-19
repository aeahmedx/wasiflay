import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { getRegions, regionName } from "@/lib/queries/regions";
import {
  getAuthorsFor,
  getLatestPosts,
  getTrendingPosts,
} from "@/lib/queries/posts";
import { PostCard } from "@/components/posts/post-card";
import { RegionPicker } from "@/components/region-picker";
import { ViewTabs } from "@/components/view-tabs";
import { getOpenReportCount } from "@/lib/queries/moderation";

type Search = { tab?: string; region?: string };

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const trending = params.tab === "trending";
  const tab = trending ? "trending" : "latest";

  const supabase = await createClient();
  const [profile, regions] = await Promise.all([
    getCurrentProfile(),
    getRegions(supabase),
  ]);

  const isStaff = profile?.role === "moderator" || profile?.role === "admin";
  const openReports = isStaff ? await getOpenReportCount(supabase) : 0;

  // No ?region= means "my region". An explicit ?region=all means everything.
  const region =
    params.region === "all"
      ? null
      : params.region ?? profile?.region ?? null;

  const posts = trending
    ? await getTrendingPosts(supabase, region)
    : await getLatestPosts(supabase, region);
  const authors = await getAuthorsFor(supabase, posts);

  // Carry the current region choice across tab switches, including "all".
  const regionQuery = params.region
    ? `&region=${params.region}`
    : region
    ? `&region=${region}`
    : "&region=all";

  return (
    <main className="min-h-dvh bg-stone-50 pb-24">
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-baseline justify-between mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Wasif Lay
          </h1>
          <span className="flex items-center gap-4">
            {/* Rooms is readable signed out — it's the liveliest thing on
                the site and the best reason to sign up. Hiding it behind
                auth loses people who would have joined for it. */}
            <Link
              href="/rooms"
              className="text-sm text-emerald-800 underline underline-offset-4"
            >
              Rooms
            </Link>
            {profile ? (
              <>
                <Link
                  href={`/profile/${profile.id}`}
                  className="text-sm text-emerald-800 underline underline-offset-4"
                >
                  Profile
                </Link>
                {isStaff && (
                  <Link
                    href="/mod"
                    className="text-sm text-emerald-800 underline underline-offset-4"
                  >
                    Mod{openReports > 0 ? ` (${openReports})` : ""}
                  </Link>
                )}
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
          className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3.5 py-3 text-stone-500 mb-5"
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

        <div className="flex items-center justify-between gap-2 mb-4">
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
            ]}
          />

          <RegionPicker regions={regions} current={region} tab={tab} />
        </div>

        {posts.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center">
            <p className="text-stone-600 mb-4">
              {region
                ? `Nothing in ${regionName(regions, region)} yet.`
                : "Nothing here yet."}
            </p>
            <Link
              href="/create"
              className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white"
            >
              Ask the first question
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard
                  post={post}
                  author={post.author_id ? authors[post.author_id] : undefined}
                  regionLabel={
                    post.region
                      ? regionName(regions, post.region)
                      : "All regions"
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={profile ? "/create" : "/signup?next=%2Fcreate"}
        className="fixed bottom-6 right-6 rounded-full bg-emerald-800 px-5 py-3.5 font-medium text-white shadow-lg"
      >
        Post
      </Link>
    </main>
  );
}
