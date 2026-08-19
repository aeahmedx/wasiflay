"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  adminHardDelete,
  modRestore,
  type ReportTarget,
} from "@/lib/queries/moderation";
import { deleteStoredImage } from "@/lib/queries/images";

export type RemovedItem = {
  target_type: ReportTarget;
  target_id: string;
  preview: string | null;
  image_url: string | null;
  author_id: string | null;
  author_name: string | null;
  removed_by: string | null;
  removed_name: string | null;
  by_author: boolean;
  removed_at: string | null;
  created_at: string;
};

type Kind = "all" | "moderator" | "author";

const KINDS: { key: Kind; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "moderator", label: "By moderators" },
  { key: "author", label: "By authors" },
];

const TARGET_LABEL: Record<string, string> = {
  post: "Post",
  answer: "Answer",
  message: "Chat message",
  listing: "Listing",
};

function when(iso: string | null) {
  if (!iso) return "unknown time";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Everything currently removed, reported or not. Without this, a
 * proactive removal from the ⋯ menu leaves no reviewable trace, which
 * defeats the purpose of removal being reversible.
 */
export function RemovedContent({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);

  const [kind, setKind] = useState<Kind>("all");
  const [items, setItems] = useState<RemovedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(
    async (k: Kind) => {
      try {
        const { data, error } = await supabase.rpc("mod_removed_content", {
          p_limit: 100,
          p_kind: k,
        });
        if (error) throw error;
        setItems((data ?? []) as RemovedItem[]);
      } catch (e) {
        setNotice(
          `Couldn't load: ${e instanceof Error ? e.message : "unknown error"}`
        );
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void load("all");
  }, [load]);

  function switchKind(next: Kind) {
    if (next === kind) return;
    setKind(next);
    setLoading(true);
    void load(next);
  }

  const key = (i: RemovedItem) => `${i.target_type}:${i.target_id}`;

  async function restore(item: RemovedItem) {
    setBusy(key(item));
    setNotice(null);
    try {
      await modRestore(supabase, item.target_type, item.target_id);
      await load(kind);
    } catch (e) {
      setNotice(
        `Couldn't restore: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setBusy(null);
    }
  }

  async function purge(item: RemovedItem) {
    setBusy(key(item));
    setNotice(null);
    try {
      if (item.image_url) await deleteStoredImage(supabase, item.image_url);
      await adminHardDelete(supabase, item.target_type, item.target_id);
      setConfirmDelete(null);
      await load(kind);
    } catch (e) {
      setNotice(
        `Couldn't delete: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-stone-500">
        Everything currently hidden, whether it was reported or not.
        Restoring puts it back where it was.
      </p>

      <div className="mb-4 flex gap-1">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => switchKind(k.key)}
            aria-pressed={kind === k.key}
            className={`rounded-full px-3.5 py-1.5 text-sm ${
              kind === k.key
                ? "bg-stone-900 text-white"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {k.label}
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
        <p className="rounded-lg border border-stone-200 bg-white px-4 py-8 text-center text-stone-600">
          Nothing is removed right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const k = key(item);
            return (
              <li
                key={k}
                className="rounded-lg border border-stone-200 bg-white px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700">
                    {TARGET_LABEL[item.target_type] ?? item.target_type}
                  </span>
                  <span className="shrink-0 text-xs text-stone-500">
                    {when(item.removed_at)}
                  </span>
                </div>

                <p
                  className="mt-2 whitespace-pre-wrap wrap-break-word rounded bg-stone-50 px-3 py-2 text-sm text-stone-800"
                  dir="auto"
                >
                  {item.preview || "(no text)"}
                  {item.image_url && (
                    <span className="ml-1 text-stone-500">[photo]</span>
                  )}
                </p>

                <p className="mt-2 text-xs text-stone-500">
                  Written by{" "}
                  <span dir="auto">{item.author_name ?? "Unknown"}</span>
                  {" · "}
                  {item.by_author ? (
                    <span>deleted by the author</span>
                  ) : (
                    <span>
                      removed by{" "}
                      <span dir="auto">
                        {item.removed_name ?? "a moderator"}
                      </span>
                    </span>
                  )}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => restore(item)}
                    disabled={busy === k}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                  >
                    Restore
                  </button>

                  {isAdmin &&
                    (confirmDelete === k ? (
                      <>
                        <button
                          onClick={() => purge(item)}
                          disabled={busy === k}
                          className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
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
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
                      >
                        Delete permanently
                      </button>
                    ))}

                  {item.target_type === "post" && (
                    <a
                      href={`/posts/${item.target_id}`}
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
