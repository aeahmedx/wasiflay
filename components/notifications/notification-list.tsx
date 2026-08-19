"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  getMyNotifications,
  markRead,
  type Notification,
} from "@/lib/queries/notifications";
import { relativeTime } from "@/components/posts/post-card";

const COPY: Record<
  string,
  (n: Notification) => { line: string; muted: boolean }
> = {
  answer_received: (n) => ({
    line: `${n.actor_name} answered your question`,
    muted: false,
  }),
  helpful_received: () => ({
    line: "Someone found your answer helpful",
    muted: false,
  }),
  content_removed: () => ({
    line: "A moderator removed something you posted",
    muted: true,
  }),
};

export function NotificationList({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await getMyNotifications(supabase));
    } catch (e) {
      setError(
        `Couldn't load: ${e instanceof Error ? e.message : "unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: a badge that appears the moment someone answers is the whole
  // point. Waiting for a reload defeats it.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => void load()
      )
      .subscribe();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  async function readAll() {
    setItems((current) => current.map((n) => ({ ...n, is_read: true })));
    try {
      await markRead(supabase);
    } catch {
      void load(); // put the true state back
    }
  }

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div>
      {unread > 0 && (
        <button
          onClick={readAll}
          className="mb-4 text-sm text-emerald-800 underline underline-offset-4"
        >
          Mark all read
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center">
          <p className="text-stone-600 mb-4">
            Nothing yet. Ask something and we&apos;ll tell you when someone
            answers.
          </p>
          <Link
            href="/create"
            className="inline-block rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
          >
            Ask a question
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.post_id ? `/posts/${n.post_id}` : "/"}
                className={`block rounded-lg border px-4 py-3.5 ${
                  n.is_read
                    ? "border-stone-200 bg-stone-0"
                    : "border-emerald-200 bg-emerald-50/50"
                }`}
              >
                <p
                  className={
                    COPY[n.kind]?.(n).muted
                      ? "text-stone-600"
                      : "text-stone-900"
                  }
                  dir="auto"
                >
                  {COPY[n.kind]?.(n).line ?? "Something happened"}
                </p>
                {n.post_title && (
                  <p
                    className="mt-0.5 line-clamp-2 text-sm text-stone-600"
                    dir="auto"
                  >
                    {n.post_title}
                  </p>
                )}
                <p className="mt-1 text-xs text-stone-500">
                  {relativeTime(n.created_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
