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
import { contentErrorMessage } from "@/lib/content-safety";
import { GoalButton } from "@/components/rooms/goal-button";
import { MatchRoomBanner } from "@/components/rooms/match-room-banner";
import type { NextFixture, RoomMatch } from "@/lib/queries/room-match";
import {
  RateLimitError,
  sendMessage,
  updateMessage,
  type Message,
  type Room,
} from "@/lib/queries/messages";

type Pending = {
  tempId: string;
  body: string;
  failed: boolean;
  /** False when the server rejected it on its merits — rate limit,
   *  content rule — so retrying would only fail again. */
  resendable: boolean;
};

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
  blockedIds = [],
  match = null,
  nextFixture = null,
}: {
  room: Room;
  initialMessages: Message[];
  userId: string | null;
  isStaff?: boolean;
  isAdmin?: boolean;
  isBanned?: boolean;
  blockedIds?: string[];
  /** Set for a match room. General and city rooms pass nothing and
   *  behave exactly as before. */
  match?: RoomMatch | null;
  nextFixture?: NextFixture | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const {
    messages,
    authors,
    connection,
    mergeMessages,
    loadOlder,
    loadingOlder,
    hasOlder,
  } = useRoomMessages(room.id, initialMessages, blockedIds);
  const presence = usePresenceCount(room.id, userId);
  const { reactions, toggle } = useReactions(room.id, userId);

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  // The online listener is registered once, so it reads through a ref
  // rather than closing over a stale array.
  const pendingRef = useRef<Pending[]>([]);
  pendingRef.current = pending;
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

  /**
   * Prepending history moves everything down, so the reader would end up
   * looking at a different part of the conversation. Measuring the
   * scroll height before and after and adding the difference keeps the
   * message they were reading exactly where it was.
   */
  async function showEarlier() {
    const el = scrollRef.current;
    const before = el?.scrollHeight ?? 0;

    const added = await loadOlder();
    if (added === 0 || !el) return;

    requestAnimationFrame(() => {
      el.scrollTop += el.scrollHeight - before;
    });
  }

  /**
   * @param override Text to send instead of the composer's contents.
   *        The GOAL button uses this so a shouted goal queues, retries
   *        and reconciles exactly like anything typed — rather than
   *        being a second, subtly different send path.
   */
  async function send(override?: string) {
    const body = (override ?? draft).trim();
    if (!body || !userId) return;

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setPending((c) => [...c, { tempId, body, failed: false, resendable: true }]);
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
      if (override === undefined) setDraft("");
    } catch (e) {
      // Keep the text. Losing what someone typed is worse than any error.
      const rejected =
        e instanceof RateLimitError ||
        contentErrorMessage(e instanceof Error ? e.message : "") !== null;

      setPending((c) =>
        c.map((p) =>
          p.tempId === tempId
            ? { ...p, failed: true, resendable: !rejected }
            : p
        )
      );
      const raw = e instanceof Error ? e.message : "";
      setNotice(
        e instanceof RateLimitError
          ? "Slow down a second."
          : contentErrorMessage(raw) ?? "Message didn't send. Tap to retry."
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
          : contentErrorMessage(e instanceof Error ? e.message : "") ??
            "Photo didn't send. Check your connection."
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

  /**
   * A message that failed because the signal dropped shouldn't need a
   * tap to recover. When the connection returns, anything still marked
   * failed is sent again on its own — the text was already typed, and
   * asking someone to retype or re-tap is how you lose them.
   *
   * Rate-limit and content rejections are left alone: those failed for
   * a reason and resending would just fail again.
   */
  useEffect(() => {
    function onOnline() {
      const stuck = pendingRef.current.filter((p) => p.failed && p.resendable);
      if (stuck.length === 0) return;
      stuck.forEach((p) => void resend(p.tempId));
    }

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resend(tempId: string) {
    const item = pendingRef.current.find((p) => p.tempId === tempId);
    if (!item || !userId) return;

    setPending((c) =>
      c.map((p) => (p.tempId === tempId ? { ...p, failed: false } : p))
    );

    try {
      const sent = await sendMessage(supabase, {
        room_id: room.id,
        author_id: userId,
        body: item.body,
      });
      mergeMessages([sent]);
      setPending((c) => c.filter((p) => p.tempId !== tempId));
    } catch {
      setPending((c) =>
        c.map((p) => (p.tempId === tempId ? { ...p, failed: true } : p))
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
      <header
        className="flex items-center justify-between border-b border-stone-200 bg-stone-0 px-4 py-3"
        // Installed to the home screen there's no browser chrome, so
        // without this the header sits under the notch.
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
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

      {match && <MatchRoomBanner match={match} nextFixture={nextFixture} />}

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-3"
      >
        {hasOlder && messages.length > 0 && (
          <button
            onClick={showEarlier}
            disabled={loadingOlder}
            className="mx-auto mb-2 block rounded-full border border-stone-300 bg-stone-0 px-4 py-1.5 text-sm text-stone-600 disabled:opacity-40"
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        )}

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
                {p.failed
                ? p.resendable
                  ? "Waiting for signal"
                  : "Not sent"
                : "Sending…"}
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
                onClick={() =>
                  p.resendable ? void resend(p.tempId) : retry(p.tempId)
                }
                className="self-start text-xs text-emerald-800 underline underline-offset-2"
              >
                {p.resendable ? "Send now" : "Edit and try again"}
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

      {/*
        Any time the room is open.

        This was gated on the match being locked, which meant the button
        didn't exist until a moderator closed picks — so in a room that
        had just been created it simply wasn't there, and tapping where
        it should be did nothing.

        Rooms close themselves when a result is entered, so "open" is
        already the right answer: before kickoff people shout at the
        team sheet, during the match they shout at the match, and after
        full time there is nothing to shout at because the room is
        closed.
      */}
      {room.type === "match" && room.is_open && !isBanned && (
          <div className="border-t border-stone-200 bg-stone-0 pt-2">
            {/* Sends through the room's own send path, so a GOAL that
                fails queues and retries exactly like any other
                message. */}
            <GoalButton
              onGoalAction={(body) => void send(body)}
              canPost={Boolean(userId) && !isBanned}
            />
          </div>
        )}

      <div
        className="border-t border-stone-200 bg-stone-0 px-3 py-3"
        // The iPhone home indicator covers the bottom ~34px. Without
        // this the send and photo buttons sit underneath it.
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
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
