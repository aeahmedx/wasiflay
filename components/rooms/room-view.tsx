"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ReportButton } from "@/components/report-button";
import { ReactionBar } from "@/components/rooms/reaction-bar";
import { useReactions } from "@/lib/hooks/use-reactions";
import { createClient } from "@/lib/supabase/client";
import { useRoomMessages } from "@/lib/hooks/use-room-messages";
import { usePresenceCount } from "@/lib/hooks/use-presence";
import {
  RateLimitError,
  sendMessage,
  type Message,
  type Room,
} from "@/lib/queries/messages";

type Pending = { tempId: string; body: string; failed: boolean };

const MAX_LENGTH = 1000;

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RoomView({
                           room,
                           initialMessages,
                           userId,
                         }: {
  room: Room;
  initialMessages: Message[];
  userId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { messages, authors, connection, mergeMessages } = useRoomMessages(
      room.id,
      initialMessages
  );
  const presence = usePresenceCount(room.id, userId);
  const { reactions, toggle } = useReactions(room.id, userId);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Only auto-scroll when the reader is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToBottom.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function send() {
    const body = draft.trim();
    if (!body || !userId) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setPending((c) => [...c, { tempId, body, failed: false }]);
    setNotice(null);

    try {
      const sent = await sendMessage(supabase, {
        room_id: room.id,
        author_id: userId,
        body,
      });
      // Insert the real row and drop the placeholder here, rather than
      // reconciling in an effect — synchronous setState inside an effect
      // triggers cascading renders. This also avoids a flicker while
      // waiting for the realtime echo.
      mergeMessages([sent]);
      setPending((c) => c.filter((p) => p.tempId !== tempId));
      setDraft("");
    } catch (e) {
      // Keep the text. Losing what someone typed is worse than any error.
      setPending((c) =>
          c.map((p) => (p.tempId === tempId ? { ...p, failed: true } : p))
      );
      setNotice(
          e instanceof RateLimitError
              ? "Slow down a second."
              : "Message didn't send. Tap to retry."
      );
    }
  }

  function retry(tempId: string) {
    const item = pending.find((p) => p.tempId === tempId);
    if (!item) return;
    setPending((c) => c.filter((p) => p.tempId !== tempId));
    setDraft(item.body);
  }

  const overLimit = draft.length > MAX_LENGTH;

  return (
      <div className="flex flex-col h-dvh bg-stone-50">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <BackLink fallback="/rooms" label="←" className="text-lg text-stone-600 leading-none" />
            <div className="min-w-0">
              <h1 className="font-semibold text-stone-900 truncate">{room.name}</h1>
              {presence !== null && (
                  <p className="text-sm text-stone-500">{presence} here now</p>
              )}
            </div>
          </div>
          {connection !== "live" && (
              <span className="text-xs text-stone-500">
            {connection === "connecting" ? "Connecting…" : "Reconnecting…"}
          </span>
          )}
        </header>

        <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.length === 0 && pending.length === 0 && (
              <p className="text-stone-500 text-center py-12">
                Nothing here yet. Say something.
              </p>
          )}

          {messages.map((m) => {
            const author = authors[m.author_id];
            const mine = m.author_id === userId;
            return (
                <div key={m.id} className="flex flex-col">
                  <div className="flex items-baseline gap-2">
                <span
                    className={`text-sm font-medium ${
                        mine ? "text-emerald-800" : "text-stone-800"
                    }`}
                    dir="auto"
                >
                  {author?.display_name ?? "Someone"}
                </span>
                    <span className="text-xs text-stone-400">
                  {timeLabel(m.created_at)}
                </span>
                  </div>
                  <p
                      className="text-stone-900 whitespace-pre-wrap wrap-break-word"
                      dir="auto"
                  >
                    {m.body}
                  </p>
                  <ReactionBar
                      messageId={m.id}
                      reactions={reactions}
                      onToggleAction={toggle}
                      canReact={Boolean(userId)}
                  />
                  {!mine && (
                      <div className="mt-0.5">
                        <ReportButton
                            targetType="message"
                            targetId={m.id}
                            userId={userId}
                            compact
                        />
                      </div>
                  )}
                </div>
            );
          })}

          {pending.map((p) => (
              <div key={p.tempId} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-emerald-800">You</span>
                  <span className="text-xs text-stone-400">
                {p.failed ? "Not sent" : "Sending…"}
              </span>
                </div>
                <p
                    className={`whitespace-pre-wrap wrap-break-word ${
                        p.failed ? "text-red-700" : "text-stone-400"
                    }`}
                    dir="auto"
                >
                  {p.body}
                </p>
                {p.failed && (
                    <button
                        onClick={() => retry(p.tempId)}
                        className="self-start text-xs text-emerald-800 underline underline-offset-2"
                    >
                      Retry
                    </button>
                )}
              </div>
          ))}
        </div>

        {notice && (
            <p
                role="status"
                className="px-4 py-2 text-sm text-stone-700 bg-amber-50 border-t border-amber-200"
            >
              {notice}
            </p>
        )}

        <div className="border-t border-stone-200 bg-white px-3 py-3">
          {userId ? (
              <div className="flex items-end gap-2">
            <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                dir="auto"
                placeholder="Message"
                className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
            />
                <button
                    onClick={() => void send()}
                    disabled={!draft.trim() || overLimit}
                    className="rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
          ) : (
              <Link
                  href={`/signup?next=${encodeURIComponent(`/rooms/${room.slug}`)}`}
                  className="block text-center rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-white"
              >
                Sign in to join the conversation
              </Link>
          )}
          {overLimit && (
              <p className="mt-1.5 text-xs text-red-700">
                {draft.length} of {MAX_LENGTH} characters. Trim it down.
              </p>
          )}
        </div>
      </div>
  );
}