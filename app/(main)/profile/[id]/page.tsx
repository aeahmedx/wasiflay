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
        <Link
          href="/"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          Back
        </Link>

        <section className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-5">
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

            {profile.is_self && (
              <Link
                href="/profile/edit"
                className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
              >
                Edit
              </Link>
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

        <div className="mt-6 mb-3 flex gap-1">
          {[
            { key: "posts", label: `Posts (${posts.length})` },
            { key: "answers", label: `Answers (${answers.length})` },
          ].map((t) => {
            const active = (t.key === "answers") === showAnswers;
            return (
              <Link
                key={t.key}
                href={`/profile/${id}?tab=${t.key}`}
                className={`rounded-full px-3.5 py-1.5 text-sm ${
                  active
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {showAnswers ? (
          answers.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center text-stone-600">
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
                    className="block rounded-lg border border-stone-200 bg-white px-4 py-4 hover:border-stone-300"
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
          <p className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center text-stone-600">
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
                  className="block rounded-lg border border-stone-200 bg-white px-4 py-4 hover:border-stone-300"
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
              <SignOutButton />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
