"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { MessageMenu } from "@/components/rooms/message-menu";
import { ReactionBar } from "@/components/rooms/reaction-bar";
import { useReactions } from "@/lib/hooks/use-reactions";
import { MessageImage } from "@/components/rooms/message-image";
import {
  compressImage,
  ImageDecodeError,
  ImageTooLargeError,
  measure,
  uploadRoomImage,
} from "@/lib/queries/images";
import { createClient } from "@/lib/supabase/client";
import { useRoomMessages } from "@/lib/hooks/use-room-messages";
import { usePresenceCount } from "@/lib/hooks/use-presence";
import {
  RateLimitError,
  sendMessage,
  updateMessage,
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
  isStaff = false,
  isAdmin = false,
  isBanned = false,
}: {
  room: Room;
  initialMessages: Message[];
  userId: string | null;
  isStaff?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
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
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function sendPhoto(file: File) {
    if (!userId || uploading) return;

    setUploading(true);
    setNotice(null);

    try {
      const blob = await compressImage(file);
      const { w, h } = await measure(blob);
      const url = await uploadRoomImage(supabase, userId, room.id, blob);

      const sent = await sendMessage(supabase, {
        room_id: room.id,
        author_id: userId,
        body: draft.trim(),
        image_url: url,
        image_width: w,
        image_height: h,
      });

      mergeMessages([sent]);
      setDraft("");
    } catch (e) {
      setNotice(
        e instanceof ImageTooLargeError
          ? "That photo is too big. Try a smaller one."
          : e instanceof ImageDecodeError
          ? "Couldn't read that image."
          : e instanceof RateLimitError
          ? "Slow down a second."
          : "Photo didn't send. Check your connection."
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveEdit(id: string) {
    const next = editDraft.trim();
    if (!next || savingEdit) return;

    setSavingEdit(true);
    setNotice(null);
    try {
      await updateMessage(supabase, id, next);
      // The room's UPDATE subscription applies the change everywhere,
      // including here.
      setEditingId(null);
    } catch {
      setNotice("Couldn't save that edit.");
    } finally {
      setSavingEdit(false);
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
      <header className="flex items-center justify-between border-b border-stone-200 bg-stone-0 px-4 py-3">
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
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span
                    className={`text-sm font-medium truncate ${
                      mine ? "text-emerald-800" : "text-stone-800"
                    }`}
                    dir="auto"
                  >
                    {author?.display_name ?? "Someone"}
                  </span>
                  <span className="shrink-0 text-xs text-stone-400">
                    {timeLabel(m.created_at)}
                  </span>
                </div>
                <MessageMenu
                  messageId={m.id}
                  imageUrl={m.image_url}
                  userId={userId}
                  isStaff={isStaff}
                  isAdmin={isAdmin}
                  isMine={mine}
                  canEdit={Boolean(m.body)}
                  onEditAction={() => {
                    setEditingId(m.id);
                    setEditDraft(m.body ?? "");
                  }}
                />
              </div>
              {editingId === m.id ? (
                <div className="mt-1">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    rows={2}
                    dir="auto"
                    maxLength={1000}
                    className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
                  />
                  <div className="mt-1.5 flex gap-2">
                    <button
                      onClick={() => void saveEdit(m.id)}
                      disabled={!editDraft.trim() || savingEdit}
                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      {savingEdit ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                m.body && (
                  <p
                    className="text-stone-900 whitespace-pre-wrap wrap-break-word"
                    dir="auto"
                  >
                    {m.body}
                    {m.edited_at && (
                      <span className="ml-1.5 text-xs text-stone-400">
                        edited
                      </span>
                    )}
                  </p>
                )
              )}
              {m.image_url && (
                <MessageImage
                  url={m.image_url}
                  width={m.image_width}
                  height={m.image_height}
                  alt={`Photo from ${author?.display_name ?? "someone"}`}
                />
              )}
              <ReactionBar
                messageId={m.id}
                reactions={reactions}
                onToggleAction={toggle}
                canReact={Boolean(userId)}
              />
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

      <div className="border-t border-stone-200 bg-stone-0 px-3 py-3">
        {isBanned ? (
          <p className="text-center text-sm text-stone-600">
            Your account is suspended, so you can&apos;t post right now. You
            can still read the room.
          </p>
        ) : userId ? (
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void sendPhoto(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              aria-label="Add a photo"
              className="shrink-0 rounded-lg border border-stone-300 px-3 py-2.5 text-stone-600 disabled:opacity-40"
            >
              {uploading ? "…" : "+"}
            </button>
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
              className="rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        ) : (
          <Link
            href={`/signup?next=${encodeURIComponent(`/rooms/${room.slug}`)}`}
            className="block text-center rounded-lg bg-emerald-800 px-4 py-2.5 font-medium text-stone-0"
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
