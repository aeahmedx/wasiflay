import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAnswers,
  getAuthorsFor,
  getMyVotes,
  getPost,
} from "@/lib/queries/posts";
import { AnswerComposer } from "@/components/posts/answer-composer";
import { AnswerItem } from "@/components/posts/answer-item";
import { relativeTime } from "@/components/posts/post-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { BackLink } from "@/components/back-link";
import { SmsOptInCard } from "@/components/notifications/sms-opt-in-card";
import { ReportButton } from "@/components/report-button";
import { AdminDeleteButton } from "@/components/mod/admin-delete-button";
import { DeleteOwnButton } from "@/components/posts/delete-own-button";
import { getRegions, regionName } from "@/lib/queries/regions";
import { getCurrentProfile } from "@/lib/queries/profiles.server";

const TYPE_LABEL = {
  question: "Question",
  recommendation: "Recommendation",
  announcement: "Announcement",
} as const;

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const post = await getPost(supabase, id);
  if (!post) notFound();

  const [answers, { data: auth }, regions] = await Promise.all([
    getAnswers(supabase, post.id),
    supabase.auth.getUser(),
    getRegions(supabase),
  ]);

  const userId = auth.user?.id ?? null;
  const authors = await getAuthorsFor(supabase, [post, ...answers]);

  const votedAnswers = userId
    ? await getMyVotes(
        supabase,
        userId,
        "answer",
        answers.map((a) => a.id)
      )
    : new Set<string>();

  const isMine = Boolean(userId) && post.author_id === userId;
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col">
      <div className="flex-1 max-w-md w-full mx-auto px-4 pt-5 pb-6">
        <BackLink />

        <article className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
              {TYPE_LABEL[post.type]}
            </span>
            <span className="flex shrink-0 items-center gap-3">
              {isMine && (
                <>
                  <Link
                    href={`/posts/${post.id}/edit`}
                    className="text-sm text-stone-600 underline underline-offset-4"
                  >
                    Edit
                  </Link>
                  <DeleteOwnButton
                    targetType="post"
                    targetId={post.id}
                    redirectTo="/"
                  />
                </>
              )}
              {isAdmin && !isMine && (
                <AdminDeleteButton
                  targetType="post"
                  targetId={post.id}
                  redirectTo="/"
                />
              )}
            </span>
          </div>

          <div className="mt-1">
            {!isMine && (
              <ReportButton
                targetType="post"
                targetId={post.id}
                userId={userId}
              />
            )}

          </div>

          <h1
            className="mt-2 text-xl font-semibold leading-snug text-stone-900"
            dir="auto"
          >
            {post.title}
          </h1>

          {post.body && (
            <p
              className="mt-3 whitespace-pre-wrap break-words text-stone-800"
              dir="auto"
            >
              {post.body}
            </p>
          )}

          <p className="mt-3 text-sm text-stone-500">
            {post.is_anonymous || !post.author_id ? (
              <span dir="auto">Anonymous</span>
            ) : (
              <Link
                href={`/profile/${post.author_id}`}
                className="text-stone-700 underline underline-offset-2"
                dir="auto"
              >
                {authors[post.author_id]?.display_name ?? "Someone"}
              </Link>
            )}
            {` · ${post.region ? regionName(regions, post.region) : "All regions"}`} ·{" "}
            {relativeTime(post.created_at)}
          </p>
        </article>

        {/* Offered here, not at signup: this is the moment someone
            actually wants to know when their question gets answered. */}
        {isMine && profile && !profile.sms_opt_in && (
          <div className="mt-4">
            <SmsOptInCard userId={profile.id} />
          </div>
        )}

        <h2 className="mt-6 mb-3 text-sm font-medium text-stone-700">
          {post.answer_count === 0
            ? "No answers yet"
            : `${post.answer_count} ${
                post.answer_count === 1 ? "answer" : "answers"
              }`}
        </h2>

        {answers.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-white px-4 py-6 text-center text-stone-600">
            Be the first to answer this.
          </p>
        ) : (
          <ul className="space-y-2">
            {answers.map((answer) => (
              <AnswerItem
                key={answer.id}
                answer={answer}
                authorName={
                  (answer.author_id &&
                    authors[answer.author_id]?.display_name) ||
                  "Someone"
                }
                userId={userId}
                initiallyVoted={votedAnswers.has(answer.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <ErrorBoundary label="The answer box">
        <AnswerComposer
          postId={post.id}
          userId={userId}
          isBanned={profile?.is_banned ?? false}
        />
      </ErrorBoundary>
    </div>
  );
}
