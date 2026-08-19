"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  adminHardDelete,
  createReport,
  modRemove,
} from "@/lib/queries/moderation";
import { deleteStoredImage } from "@/lib/queries/images";
import { deleteOwnContent } from "@/lib/queries/own-content";
import { RadioOption } from "@/components/ui/toggle";

const REASONS = [
  "Harassment or abuse",
  "Political argument",
  "Spam or scam",
  "Sexual content",
  "Involves a minor",
  "Something else",
];

/**
 * Per-message actions. Staff can remove without waiting for a report —
 * during a live event, going through the queue for something happening
 * in front of you is too slow.
 */
export function MessageMenu({
  messageId,
  imageUrl,
  userId,
  isStaff,
  isAdmin,
  isMine,
  canEdit,
  onEditAction,
}: {
  messageId: string;
  imageUrl?: string | null;
  userId: string | null;
  isStaff: boolean;
  isAdmin?: boolean;
  isMine: boolean;
  canEdit?: boolean;
  // Next 16 requires an Action suffix on function props crossing a
  // "use client" boundary, even for ordinary callbacks.
  onEditAction?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<
    "menu" | "report" | "confirmDelete" | "confirmOwnDelete"
  >("menu");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    "idle"
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setMode("menu");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  if (!userId) return null;

  async function report() {
    if (!reason || !userId) return;
    setState("working");
    try {
      await createReport(createClient(), {
        reporter_id: userId,
        target_type: "message",
        target_id: messageId,
        reason,
      });
      setState("done");
      setOpen(false);
      setMode("menu");
    } catch {
      setState("error");
    }
  }

  async function deleteMine() {
    setState("working");
    try {
      const supabase = createClient();
      if (imageUrl) await deleteStoredImage(supabase, imageUrl);
      await deleteOwnContent(supabase, "message", messageId);
      setOpen(false);
      setMode("menu");
    } catch {
      setState("error");
    } finally {
      setState("idle");
    }
  }

  async function hardDelete() {
    setState("working");
    try {
      const supabase = createClient();
      // File first: deleting the row and then failing on storage leaves
      // the image reachable with nothing left pointing at it.
      if (imageUrl) await deleteStoredImage(supabase, imageUrl);
      await adminHardDelete(supabase, "message", messageId);
      setOpen(false);
      setMode("menu");
    } catch {
      setState("error");
    } finally {
      setState("idle");
    }
  }

  async function remove() {
    setState("working");
    try {
      await modRemove(createClient(), "message", messageId);
      // The room subscribes to UPDATE events, so it disappears everywhere.
      setOpen(false);
    } catch {
      setState("error");
    } finally {
      setState("idle");
    }
  }

  if (state === "done") {
    return <span className="text-xs text-stone-400">Reported</span>;
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        aria-expanded={open}
        className="px-1.5 py-0.5 text-stone-300 hover:text-stone-600"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-stone-300 bg-white p-2 shadow-lg">
          {mode === "menu" ? (
            <>
              {isMine && canEdit && onEditAction && (
                <button
                  type="button"
                  onClick={() => {
                    onEditAction();
                    setOpen(false);
                  }}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-stone-800 hover:bg-stone-100"
                >
                  Edit message
                </button>
              )}
              {isMine && (
                <button
                  type="button"
                  onClick={() => setMode("confirmOwnDelete")}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-stone-800 hover:bg-stone-100"
                >
                  Delete message
                </button>
              )}
              {!isMine && (
                <button
                  type="button"
                  onClick={() => setMode("report")}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-stone-800 hover:bg-stone-100"
                >
                  Report this message
                </button>
              )}
              {isStaff && (
                <button
                  type="button"
                  onClick={remove}
                  disabled={state === "working"}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-red-800 hover:bg-red-50 disabled:opacity-40"
                >
                  {state === "working" ? "Removing…" : "Remove message"}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setMode("confirmDelete")}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-red-900 hover:bg-red-50"
                >
                  Delete permanently
                </button>
              )}

            </>
          ) : mode === "confirmOwnDelete" ? (
            <>
              <p className="px-2 pb-2 text-sm text-stone-800">
                Delete your message?
              </p>
              <div className="flex gap-2 px-2">
                <button
                  type="button"
                  onClick={deleteMine}
                  disabled={state === "working"}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {state === "working" ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : mode === "confirmDelete" ? (
            <>
              <p className="px-2 pb-2 text-sm text-stone-800">
                Delete this message and its image for good? This can&apos;t
                be undone.
              </p>
              <div className="flex gap-2 px-2">
                <button
                  type="button"
                  onClick={hardDelete}
                  disabled={state === "working"}
                  className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {state === "working" ? "Deleting…" : "Delete forever"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="px-2 pb-1.5 text-sm font-medium text-stone-800">
                What&apos;s wrong?
              </p>
              <div role="radiogroup" aria-label="Reason">
                {REASONS.map((r) => (
                  <RadioOption
                    key={r}
                    name={`msg-reason-${messageId}`}
                    value={r}
                    selected={reason === r}
                    onSelectAction={setReason}
                  >
                    {r}
                  </RadioOption>
                ))}
              </div>
              <div className="mt-2 flex gap-2 px-2">
                <button
                  type="button"
                  onClick={report}
                  disabled={!reason || state === "working"}
                  className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Send
                </button>
                <button
                  type="button"
                  onClick={() => setMode("menu")}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {state === "error" && (
            <p className="mt-1.5 px-2 text-xs text-red-700">
              That didn&apos;t work. Try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
