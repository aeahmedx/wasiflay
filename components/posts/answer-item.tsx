"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { updateAnswer, type Answer } from "@/lib/queries/posts";
import { HelpfulButton } from "@/components/posts/helpful-button";
import { relativeTime } from "@/components/posts/post-card";
import { ReportButton } from "@/components/report-button";

export function AnswerItem({
                             answer,
                             authorName,
                             userId,
                             initiallyVoted,
                           }: {
  answer: Answer;
  authorName: string;
  userId: string | null;
  initiallyVoted: boolean;
}) {
  const router = useRouter();
  const isMine = Boolean(userId) && answer.author_id === userId;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      await updateAnswer(supabase, answer.id, trimmed);
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save your edit. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
      <li className="rounded-lg border border-stone-200 bg-white px-4 py-4">
        <p className="text-sm text-stone-500 mb-1.5">
          {answer.is_anonymous || !answer.author_id ? (
              <span dir="auto">Anonymous</span>
          ) : (
              <Link
                  href={`/profile/${answer.author_id}`}
                  className="text-stone-700 underline underline-offset-2"
                  dir="auto"
              >
                {authorName}
              </Link>
          )}{" "}
          · {relativeTime(answer.created_at)}
        </p>

        {editing ? (
            <>
          <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              dir="auto"
              maxLength={10000}
              className="w-full resize-none rounded-lg border border-stone-300 px-3.5 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          />
              {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
              <div className="mt-2 flex gap-2">
                <button
                    onClick={save}
                    disabled={!draft.trim() || saving}
                    className="rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                    onClick={() => {
                      setDraft(answer.body);
                      setEditing(false);
                      setError(null);
                    }}
                    className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </>
        ) : (
            <p
                className="whitespace-pre-wrap break-words text-stone-900"
                dir="auto"
            >
              {answer.body}
            </p>
        )}

        {!editing && (
            <div className="mt-3 flex items-center gap-3">
              <HelpfulButton
                  target="answer"
                  targetId={answer.id}
                  initialCount={answer.helpful_count}
                  initiallyVoted={initiallyVoted}
                  canVote={Boolean(userId) && !isMine}
              />
              {isMine ? (
                  <button
                      onClick={() => setEditing(true)}
                      className="text-sm text-stone-600 underline underline-offset-4"
                  >
                    Edit
                  </button>
              ) : (
                  <ReportButton
                      targetType="answer"
                      targetId={answer.id}
                      userId={userId}
                  />
              )}
            </div>
        )}
      </li>
  );
}