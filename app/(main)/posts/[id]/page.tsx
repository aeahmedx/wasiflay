import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getAnswers,
  getAuthorsFor,
  getMyVotes,
  getPost,
} from "@/lib/queries/posts";
import { HelpfulButton } from "@/components/posts/helpful-button";
import { AnswerComposer } from "@/components/posts/answer-composer";
import { relativeTime } from "@/components/posts/post-card";
import { ErrorBoundary } from "@/components/error-boundary";
import { getRegions, regionName } from "@/lib/queries/regions";

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

  return (
    <div className="min-h-dvh bg-stone-50 flex flex-col">
      <div className="flex-1 max-w-md w-full mx-auto px-4 pt-5 pb-6">
        <Link
          href="/"
          className="text-sm text-stone-600 underline underline-offset-4"
        >
          Back
        </Link>

        <article className="mt-4 rounded-lg border border-stone-200 bg-white px-4 py-4">
          <span className="inline-block rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
            {TYPE_LABEL[post.type]}
          </span>

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
            <span dir="auto">
              {post.is_anonymous
                ? "Anonymous"
                : authors[post.author_id]?.display_name ?? "Someone"}
            </span>
            {` · ${regionName(regions, post.region)}`} ·{" "}
            {relativeTime(post.created_at)}
          </p>
        </article>

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
              <li
                key={answer.id}
                className="rounded-lg border border-stone-200 bg-white px-4 py-4"
              >
                <p className="text-sm text-stone-500 mb-1.5">
                  <span dir="auto">
                    {answer.is_anonymous
                      ? "Anonymous"
                      : authors[answer.author_id]?.display_name ?? "Someone"}
                  </span>{" "}
                  · {relativeTime(answer.created_at)}
                </p>

                <p
                  className="whitespace-pre-wrap break-words text-stone-900"
                  dir="auto"
                >
                  {answer.body}
                </p>

                <div className="mt-3">
                  <HelpfulButton
                    target="answer"
                    targetId={answer.id}
                    initialCount={answer.helpful_count}
                    initiallyVoted={votedAnswers.has(answer.id)}
                    canVote={Boolean(userId) && answer.author_id !== userId}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ErrorBoundary label="The answer box">
        <AnswerComposer postId={post.id} userId={userId} />
      </ErrorBoundary>
    </div>
  );
}
