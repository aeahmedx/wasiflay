"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createReport, type ReportTarget } from "@/lib/queries/moderation";

const REASONS = [
  "Harassment or abuse",
  "Political argument",
  "Spam or scam",
  "Sexual content",
  "Involves a minor",
  "Something else",
];

/**
 * Works on posts, answers, messages, listings and profiles — the target
 * type is just an enum value. SPEC 11.1 requires this on every piece of
 * user content.
 */
export function ReportButton({
  targetType,
  targetId,
  userId,
  compact = false,
}: {
  targetType: ReportTarget;
  targetId: string;
  userId: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  if (!userId) return null;

  if (state === "sent") {
    return (
      <span className="text-xs text-stone-500">Reported. Thank you.</span>
    );
  }

  async function submit() {
    if (!reason || state === "sending" || !userId) return;
    setState("sending");
    try {
      const supabase = createClient();
      await createReport(supabase, {
        reporter_id: userId,
        target_type: targetType,
        target_id: targetId,
        reason: detail.trim() ? `${reason} — ${detail.trim()}` : reason,
      });
      setState("sent");
      setOpen(false);
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? "text-xs text-stone-400 hover:text-stone-700"
            : "text-sm text-stone-500 underline underline-offset-4 hover:text-stone-800"
        }
        aria-expanded={open}
      >
        Report
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-stone-300 bg-stone-0 p-3">
          <p className="text-sm font-medium text-stone-800 mb-2">
            What&apos;s wrong with this?
          </p>

          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer"
              >
                <input
                  type="radio"
                  name={`reason-${targetId}`}
                  value={r}
                  checked={reason === r}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-3.5 h-3.5 accent-emerald-800"
                />
                {r}
              </label>
            ))}
          </div>

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            dir="auto"
            maxLength={400}
            placeholder="Anything else we should know? (optional)"
            className="mt-2 w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
          />

          {state === "error" && (
            <p className="mt-1.5 text-sm text-red-700">
              Couldn&apos;t send that. Try again.
            </p>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={!reason || state === "sending"}
              className="rounded-lg bg-stone-900 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
            >
              {state === "sending" ? "Sending…" : "Send report"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
