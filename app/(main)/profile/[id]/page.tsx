import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  flagEmoji,
  getProfileAnswers,
  getProfilePosts,
  getPostTitles,
  getPublicProfile,
} from "@/lib/queries/profiles";
import { getRegions, regionName } from "@/lib/queries/regions";
import { relativeTime } from "@/components/posts/post-card";
import { SignOutButton } from "@/app/(main)/sign-out-button";
import { AddToHomeScreen } from "@/components/add-to-home-screen";
import { BlockButton } from "@/components/block-button";
import { AccountSettings } from "@/components/account-settings";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { ViewTabs } from "@/components/view-tabs";

const TYPE_LABEL = {
  question: "Question",
  recommendation: "Recommendation",
  announcement: "Announcement",
} as const;

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const showAnswers = tab === "answers";

  const supabase = await createClient();
  const profile = await getPublicProfile(supabase, id);
  if (!profile) notFound();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  const [regions, posts, answers] = await Promise.all([
    getRegions(supabase),
    getProfilePosts(supabase, id),
    getProfileAnswers(supabase, id),
  ]);

  const titles = showAnswers
    ? await getPostTitles(
        supabase,
        answers.map((a) => a.post_id)
      )
    : {};

  return (
    <main className="min-h-dvh bg-stone-50 px-4 py-6">
      <div className="max-w-md mx-auto">
        <BackLink />

        <section className="mt-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1
                className="text-xl font-semibold text-stone-900"
                dir="auto"
              >
                {flagEmoji(profile.country_flag)} {profile.display_name}
              </h1>
              <p className="mt-1 text-stone-600">
                {regionName(regions, profile.region)}
                {profile.city ? ` · ${profile.city}` : ""}
              </p>
              {profile.role !== "member" && (
                <span className="mt-2 inline-block rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 capitalize">
                  {profile.role}
                </span>
              )}
            </div>

            {profile.is_self ? (
              <Link
                href="/profile/edit"
                className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
              >
                Edit
              </Link>
            ) : (
              viewer && (
                <div className="shrink-0">
                  <BlockButton
                    viewerId={viewer.id}
                    targetId={profile.id}
                    targetName={profile.display_name}
                  />
                </div>
              )
            )}
          </div>

          {/* SPEC 8.1 — raw counts only. No levels, no badges, no leaderboard. */}
          <dl className="mt-5 flex gap-8">
            <div>
              <dt className="text-sm text-stone-500">Contributions</dt>
              <dd className="text-2xl font-semibold text-stone-900">
                {profile.contribution_count}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-500">Helpful answers</dt>
              <dd className="text-2xl font-semibold text-stone-900">
                {profile.helpful_count}
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-6 mb-3">
          <ViewTabs
            activeKey={showAnswers ? "answers" : "posts"}
            tabs={[
              {
                key: "posts",
                label: `Posts (${posts.length})`,
                href: `/profile/${id}?tab=posts`,
              },
              {
                key: "answers",
                label: `Answers (${answers.length})`,
                href: `/profile/${id}?tab=answers`,
              },
            ]}
          />
        </div>

        {showAnswers ? (
          answers.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
              {profile.is_self
                ? "You haven't answered anything yet."
                : "No answers yet."}
            </p>
          ) : (
            <ul className="space-y-2">
              {answers.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/posts/${a.post_id}`}
                    className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-4 hover:border-stone-300"
                  >
                    <p className="text-sm text-stone-500" dir="auto">
                      on {titles[a.post_id] ?? "a post"}
                    </p>
                    <p
                      className="mt-1.5 line-clamp-3 text-stone-900"
                      dir="auto"
                    >
                      {a.body}
                    </p>
                    <p className="mt-2 text-sm text-stone-500">
                      {relativeTime(a.created_at)}
                      {a.helpful_count > 0
                        ? ` · ${a.helpful_count} helpful`
                        : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : posts.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
            {profile.is_self
              ? "You haven't posted anything yet."
              : "No posts yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/posts/${p.id}`}
                  className="block rounded-lg border border-stone-200 bg-stone-0 px-4 py-4 hover:border-stone-300"
                >
                  <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
                    {TYPE_LABEL[p.type]}
                  </span>
                  <h2
                    className="mt-2 font-medium leading-snug text-stone-900"
                    dir="auto"
                  >
                    {p.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-stone-500">
                    {p.region ? regionName(regions, p.region) : "All regions"} ·{" "}
                    {relativeTime(p.created_at)} · {p.answer_count}{" "}
                    {p.answer_count === 1 ? "answer" : "answers"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {profile.is_self && (
          <>
            <p className="mt-6 text-xs leading-relaxed text-stone-500">
              Anonymous posts and answers never appear on your profile.
            </p>
            <div className="mt-6 border-t border-stone-200 pt-5">
              <AccountSettings userId={profile.id} />
            </div>

            <div className="mt-5 flex flex-col items-center gap-3 border-t border-stone-200 pt-5">
              <Link
                href="/support"
                className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
              >
                Support
              </Link>
              {/* Renders nothing when already installed or when the
                  browser can't install, so it never offers a dead end. */}
              <AddToHomeScreen />
              <SignOutButton />
            </div>
          </>
        )}
        <div className="mt-8 flex justify-center gap-4 border-t border-stone-200 pt-5 text-xs">
          <Link
            href="/terms"
            className="text-stone-500 underline underline-offset-4"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-stone-500 underline underline-offset-4"
          >
            Privacy
          </Link>
          <Link
            href="/guidelines"
            className="text-stone-500 underline underline-offset-4"
          >
            Guidelines
          </Link>
        </div>
      </div>
    </main>
  );
}
