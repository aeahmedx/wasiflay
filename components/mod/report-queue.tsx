"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getReportQueue,
  modRemove,
  modResolveReport,
  modRestore,
  modSetBan,
  type QueueItem,
  type ReportStatus,
} from "@/lib/queries/moderation";

const TABS: { key: ReportStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "actioned", label: "Actioned" },
  { key: "dismissed", label: "Dismissed" },
];

const TARGET_LABEL: Record<string, string> = {
  post: "Post",
  answer: "Answer",
  message: "Chat message",
  listing: "Listing",
  profile: "Profile",
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ReportQueue({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<ReportStatus>("open");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (s: ReportStatus) => {
      setLoading(true);
      setError(null);
      try {
        setItems(await getReportQueue(supabase, s));
      } catch {
        setError("Couldn't load reports. Reload the page.");
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void load(status);
  }, [status, load]);

  async function act(
    item: QueueItem,
    action: "remove" | "restore" | "dismiss" | "ban" | "unban"
  ) {
    setBusy(item.report_id);
    setError(null);

    try {
      if (action === "remove") {
        await modRemove(supabase, item.target_type, item.target_id);
        await modResolveReport(supabase, item.report_id, "actioned");
      } else if (action === "restore") {
        await modRestore(supabase, item.target_type, item.target_id);
      } else if (action === "dismiss") {
        await modResolveReport(supabase, item.report_id, "dismissed");
      } else if (action === "ban" && item.author_id) {
        await modSetBan(supabase, item.author_id, true);
        await modResolveReport(supabase, item.report_id, "actioned");
      } else if (action === "unban" && item.author_id) {
        await modSetBan(supabase, item.author_id, false);
      }
      await load(status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("CANNOT_BAN_ADMIN")
          ? "You can't ban an admin."
          : msg.includes("FORBIDDEN")
          ? "You don't have permission for that."
          : "That didn't go through. Try again."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            aria-pressed={status === t.key}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              status === t.key
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center text-stone-600">
          {status === "open"
            ? "Nothing waiting. The queue is clear."
            : `No ${status} reports.`}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.report_id}
              className="rounded-lg border border-stone-200 bg-white px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                  {TARGET_LABEL[item.target_type] ?? item.target_type}
                </span>
                <span className="shrink-0 text-xs text-stone-500">
                  {timeLabel(item.reported_at)}
                </span>
              </div>

              <p className="mt-2 text-sm font-medium text-red-800">
                {item.reason}
              </p>

              <p
                className="mt-2 whitespace-pre-wrap break-words rounded bg-stone-50 px-3 py-2 text-sm text-stone-800"
                dir="auto"
              >
                {item.preview || "(no content)"}
              </p>

              <p className="mt-2 text-xs text-stone-500">
                By{" "}
                <span dir="auto">
                  {item.is_anonymous
                    ? `${item.author_name ?? "Unknown"} (posted anonymously)`
                    : item.author_name ?? "Unknown"}
                </span>
                {item.author_banned && (
                  <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-red-800">
                    banned
                  </span>
                )}
                {" · reported by "}
                <span dir="auto">{item.reporter_name ?? "Unknown"}</span>
                {item.is_removed && (
                  <span className="ml-1.5 rounded bg-stone-200 px-1.5 py-0.5">
                    removed
                  </span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.is_removed ? (
                  <button
                    onClick={() => act(item, "restore")}
                    disabled={busy === item.report_id}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    onClick={() => act(item, "remove")}
                    disabled={busy === item.report_id}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Remove
                  </button>
                )}

                {status === "open" && (
                  <button
                    onClick={() => act(item, "dismiss")}
                    disabled={busy === item.report_id}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                )}

                {item.author_id &&
                  (item.author_banned ? (
                    <button
                      onClick={() => act(item, "unban")}
                      disabled={busy === item.report_id}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      onClick={() => act(item, "ban")}
                      disabled={busy === item.report_id}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
                    >
                      Ban author
                    </button>
                  ))}

                <a
                  href={
                    item.target_type === "post"
                      ? `/posts/${item.target_id}`
                      : item.target_type === "profile"
                      ? `/profile/${item.target_id}`
                      : "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 ${
                    item.target_type === "post" || item.target_type === "profile"
                      ? ""
                      : "pointer-events-none opacity-30"
                  }`}
                >
                  Open
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isAdmin && (
        <p className="mt-6 text-xs text-stone-500">
          Moderator access. Role changes require an admin.
        </p>
      )}
    </div>
  );
}
