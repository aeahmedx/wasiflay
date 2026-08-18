import Link from "next/link";
import type { Post } from "@/lib/queries/posts";
import type { Author } from "@/lib/queries/messages";

const TYPE_LABEL: Record<Post["type"], string> = {
  question: "Question",
  recommendation: "Recommendation",
  announcement: "Announcement",
};

const TYPE_STYLE: Record<Post["type"], string> = {
  question: "bg-emerald-50 text-emerald-900",
  recommendation: "bg-amber-50 text-amber-900",
  announcement: "bg-stone-100 text-stone-700",
};

export function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** SPEC 3.4 — the whole card is the tap target. */
export function PostCard({
  post,
  author,
  regionLabel,
}: {
  post: Post;
  author: Author | undefined;
  regionLabel: string;
}) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="block rounded-lg border border-stone-200 bg-white px-4 py-4 hover:border-stone-300"
    >
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
          TYPE_STYLE[post.type]
        }`}
      >
        {TYPE_LABEL[post.type]}
      </span>

      <h2 className="mt-2 font-medium text-stone-900 leading-snug" dir="auto">
        {post.title}
      </h2>

      <p className="mt-2 text-sm text-stone-500">
        <span dir="auto">
          {post.is_anonymous ? "Anonymous" : author?.display_name ?? "Someone"}
        </span>
        {regionLabel ? ` · ${regionLabel}` : ""} ·{" "}
        {relativeTime(post.created_at)}
      </p>

      <p className="mt-1.5 text-sm text-stone-600">
        {post.answer_count} {post.answer_count === 1 ? "answer" : "answers"}
        {post.helpful_count > 0 ? ` · ${post.helpful_count} helpful` : ""}
      </p>
    </Link>
  );
}
