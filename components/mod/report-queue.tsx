"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  adminHardDelete,
  claimTarget,
  getReportQueue,
  modRemove,
  modRestore,
  modSetBan,
  releaseTarget,
  resolveTarget,
  type QueueItem,
  type ReportStatus,
} from "@/lib/queries/moderation";
import { deleteStoredImage } from "@/lib/queries/images";

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

export function ReportQueue({
  isAdmin,
  viewerId,
}: {
  isAdmin: boolean;
  viewerId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [status, setStatus] = useState<ReportStatus>("open");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmBan, setConfirmBan] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const itemKey = (i: QueueItem) => `${i.target_type}:${i.target_id}`;

  const load = useCallback(
    async (s: ReportStatus) => {
      try {
        setItems(await getReportQueue(supabase, s));
      } catch (e) {
        setNotice(
          `Couldn't load reports: ${e instanceof Error ? e.message : "unknown"}`
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // Initial load only. Tab switches go through switchTab so that no
  // setState happens synchronously inside an effect.
  useEffect(() => {
    void load("open");
  }, [load]);

  function switchTab(next: ReportStatus) {
    if (next === status) return;
    setStatus(next);
    setLoading(true);
    void load(next);
  }

  // Live queue: with several moderators on shift, a stale list means two
  // people working the same thing and a third seeing items already handled.
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    channel = supabase
      .channel("mod-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          // Coalesce bursts — a flood of reports shouldn't mean a refetch
          // per row.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void load(status), 400);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, load, status]);

  function banBlocked(item: QueueItem): string | null {
    if (!item.author_id) return null;
    if (item.author_id === viewerId) return "That's you";
    if (item.author_role === "admin") return "Admins can't be banned";
    if (item.author_role === "moderator" && !isAdmin)
      return "Only an admin can ban a moderator";
    return null;
  }

  async function act(
    item: QueueItem,
    action:
      | "claim"
      | "release"
      | "remove"
      | "restore"
      | "ban"
      | "resolve"
      | "dismiss"
      | "delete"
  ) {
    setBusy(itemKey(item));
    setNotice(null);

    try {
      if (action === "claim") {
        const won = await claimTarget(supabase, item.target_type, item.target_id);
        if (!won) setNotice("Someone else got to that one first.");
      } else if (action === "release") {
        await releaseTarget(supabase, item.target_type, item.target_id);
      } else if (action === "remove") {
        await modRemove(supabase, item.target_type, item.target_id);
      } else if (action === "restore") {
        await modRestore(supabase, item.target_type, item.target_id);
      } else if (action === "ban" && item.author_id) {
        await modSetBan(supabase, item.author_id, true);
        setConfirmBan(null);
      } else if (action === "delete") {
        // Remove the file first: if the row goes and the storage call
        // then fails, the image stays reachable with nothing pointing at
        // it to find later.
        if (item.image_url) {
          await deleteStoredImage(supabase, item.image_url);
        }
        await adminHardDelete(supabase, item.target_type, item.target_id);
        setConfirmDelete(null);
      } else if (action === "resolve" || action === "dismiss") {
        const n = await resolveTarget(
          supabase,
          item.target_type,
          item.target_id,
          action === "resolve" ? "actioned" : "dismissed"
        );
        if (n > 1) setNotice(`Closed ${n} reports on that item.`);
      }
      await load(status);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setNotice(
        msg.includes("ADMIN_ONLY")
          ? "Only an admin can delete permanently."
          : msg.includes("CANNOT_DELETE_PROFILE")
          ? "Accounts can't be deleted from here."
          : msg.includes("CANNOT_BAN_ADMIN")
          ? "Admins can't be banned."
          : msg.includes("CANNOT_BAN_SELF")
          ? "You can't ban yourself."
          : msg.includes("CANNOT_BAN_MODERATOR")
          ? "Only an admin can ban a moderator."
          : msg.includes("FORBIDDEN")
          ? "You don't have permission for that."
          : `That didn't go through: ${msg || "unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-stone-500">
        One entry per reported item, however many people reported it.
        Claim an item to unlock its actions — nobody else can work it
        while you hold it, and claims expire after 10 minutes. Removing
        content and banning are separate decisions; close the item with
        Resolve or Dismiss when you&apos;re done.
      </p>

      <div className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            aria-pressed={status === t.key}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              status === t.key
                ? "bg-stone-900 text-stone-0"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-800"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
          {status === "open"
            ? "Nothing waiting. The queue is clear."
            : `No ${status} items.`}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const k = itemKey(item);
            const mine = item.claimed_by === viewerId && item.claim_fresh;
            const theirs =
              item.claim_fresh && item.claimed_by !== viewerId;
            const blocked = banBlocked(item);

            return (
              <li
                key={`${item.target_type}:${item.target_id}`}
                className={`rounded-lg border bg-stone-0 px-4 py-4 ${
                  theirs ? "border-stone-200 opacity-60" : "border-stone-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                    {TARGET_LABEL[item.target_type] ?? item.target_type}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.report_count > 1 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-800">
                        {item.report_count} reports
                      </span>
                    )}
                    <span className="text-xs text-stone-500">
                      {timeLabel(item.last_reported)}
                    </span>
                  </div>
                </div>

                {theirs && (
                  <p className="mt-2 text-sm text-stone-600" dir="auto">
                    {item.claimed_name ?? "Another moderator"} is on this.
                  </p>
                )}
                {mine && (
                  <p className="mt-2 text-sm text-emerald-800">
                    You claimed this.
                  </p>
                )}

                <p className="mt-2 text-sm font-medium text-red-800">
                  {item.reasons}
                </p>

                <p
                  className="mt-2 whitespace-pre-wrap wrap-break-word rounded bg-stone-50 px-3 py-2 text-sm text-stone-800"
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
                  {item.is_removed && (
                    <span className="ml-1.5 rounded bg-stone-200 px-1.5 py-0.5">
                      removed
                    </span>
                  )}
                  {item.reporter_names && (
                    <>
                      {" · reported by "}
                      <span dir="auto">{item.reporter_names}</span>
                    </>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {/*
                    Actions are gated behind the claim. An unclaimed item
                    offers only Claim, so two moderators can't both be
                    part-way through handling the same thing, and anyone
                    scanning the queue can see at a glance what is being
                    worked and by whom.
                  */}
                  {status !== "open" ? (
                    // Closed items are review-only; nothing to claim.
                    item.is_removed ? (
                      <button
                        onClick={() => act(item, "restore")}
                        disabled={busy === k}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => act(item, "remove")}
                        disabled={busy === k}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    )
                  ) : !mine ? (
                    <button
                      onClick={() => act(item, "claim")}
                      disabled={busy === k}
                      className="rounded-lg bg-emerald-800 px-3.5 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      {theirs ? "Take over" : "Claim to handle"}
                    </button>
                  ) : (
                    <>
                      {item.is_removed ? (
                        <button
                          onClick={() => act(item, "restore")}
                          disabled={busy === k}
                          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                        >
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => act(item, "remove")}
                          disabled={busy === k}
                          className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      )}

                      <button
                        onClick={() => act(item, "resolve")}
                        disabled={busy === k}
                        className="rounded-lg border border-emerald-700 px-3 py-1.5 text-sm text-emerald-900 disabled:opacity-40"
                      >
                        Resolve
                      </button>

                      <button
                        onClick={() => act(item, "dismiss")}
                        disabled={busy === k}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                      >
                        Dismiss
                      </button>

                      {item.author_id &&
                        !item.author_banned &&
                        (blocked ? (
                          <span className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-400">
                            {blocked}
                          </span>
                        ) : confirmBan === k ? (
                          <>
                            <button
                              onClick={() => act(item, "ban")}
                              disabled={busy === k}
                              className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                            >
                              Confirm ban
                            </button>
                            <button
                              onClick={() => setConfirmBan(null)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmBan(k)}
                            disabled={busy === k}
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
                          >
                            Ban author
                          </button>
                        ))}

                      {isAdmin &&
                        item.target_type !== "profile" &&
                        (confirmDelete === k ? (
                          <>
                            <button
                              onClick={() => act(item, "delete")}
                              disabled={busy === k}
                              className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                            >
                              Confirm: delete forever
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(k)}
                            disabled={busy === k}
                            className="rounded-lg border border-red-400 px-3 py-1.5 text-sm text-red-900 disabled:opacity-40"
                          >
                            Delete permanently
                          </button>
                        ))}

                      <button
                        onClick={() => act(item, "release")}
                        disabled={busy === k}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-500 disabled:opacity-40"
                      >
                        Release
                      </button>
                    </>
                  )}

                  {(item.target_type === "post" ||
                    item.target_type === "profile") && (
                    <a
                      href={
                        item.target_type === "post"
                          ? `/posts/${item.target_id}`
                          : `/profile/${item.target_id}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                    >
                      Open
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
