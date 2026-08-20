"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  deleteOwnAccount,
  exportMyData,
  listBlocked,
  unblockUser,
  type BlockedPerson,
} from "@/lib/queries/safety";

/**
 * The account controls people are legally entitled to and practically
 * need: see who you've blocked, take your data with you, and leave.
 */
export function AccountSettings({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [openBlocks, setOpenBlocks] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  const loadBlocks = useCallback(async () => {
    try {
      setBlocked(await listBlocked(supabase, userId));
    } catch {
      setNotice("Couldn't load your blocked list.");
    }
  }, [supabase, userId]);

  /**
   * Loaded when the panel is opened, not by an effect watching whether
   * it's open. Fetching in response to a tap is what's actually
   * happening, and setting state inside an effect costs an extra render
   * pass before paint for no benefit.
   */
  function toggleBlocks() {
    const next = !openBlocks;
    setOpenBlocks(next);
    if (next) void loadBlocks();
  }

  async function unblock(id: string) {
    setBusy(id);
    try {
      await unblockUser(supabase, userId, id);
      await loadBlocks();
      router.refresh();
    } catch {
      setNotice("Couldn't unblock. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("export");
    setNotice(null);
    try {
      const data = await exportMyData(supabase);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wasiflay-my-data-${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice("Couldn't build your export. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (typed !== "DELETE") return;
    setBusy("delete");
    try {
      await deleteOwnAccount(supabase);
      await supabase.auth.signOut();

      // Cached pages were rendered for this account; leaving them on the
      // device after a deletion request defeats the point of it.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.controller?.postMessage("wl:clear-cache");
      }

      router.replace("/signup");
      router.refresh();
    } catch {
      setNotice("Couldn't delete the account. Email support and we'll do it.");
      setBusy(null);
    }
  }

  return (
      <div className="w-full space-y-3 text-left">
        {notice && (
            <p
                role="status"
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-stone-800"
            >
              {notice}
            </p>
        )}

        <button
            type="button"
            onClick={toggleBlocks}
            aria-expanded={openBlocks}
            className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
        >
          Blocked people{blocked.length > 0 ? ` (${blocked.length})` : ""}
        </button>

        {openBlocks && (
            <div className="rounded-lg border border-stone-200 bg-stone-0 px-3 py-2.5">
              {blocked.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    You haven&apos;t blocked anyone.
                  </p>
              ) : (
                  <ul className="space-y-2">
                    {blocked.map((b) => (
                        <li
                            key={b.blocked_id}
                            className="flex items-center justify-between gap-3"
                        >
                          {/* Blocked people are hidden from public_profiles, so
                      their name can't be read back — by design. */}
                          <span className="truncate text-sm text-stone-700">
                    Blocked member
                  </span>
                          <button
                              onClick={() => unblock(b.blocked_id)}
                              disabled={busy === b.blocked_id}
                              className="shrink-0 text-sm text-emerald-800 underline underline-offset-4 disabled:opacity-40"
                          >
                            Unblock
                          </button>
                        </li>
                    ))}
                  </ul>
              )}
            </div>
        )}

        <div>
          <button
              type="button"
              onClick={download}
              disabled={busy === "export"}
              className="text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900 disabled:opacity-40"
          >
            {busy === "export" ? "Preparing…" : "Download my data"}
          </button>
        </div>

        <div>
          {!confirmDelete ? (
              <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm text-stone-500 underline underline-offset-4 transition-colors hover:text-red-700"
              >
                Delete my account
              </button>
          ) : (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                <p className="text-sm text-stone-900">
                  This removes your name, town, and personal details, and signs
                  you out for good.
                </p>
                <p className="mt-1.5 text-sm text-stone-700">
                  Posts and answers you wrote stay, with your name detached, so
                  conversations other people took part in still make sense.
                </p>
                <label
                    htmlFor="confirm-delete"
                    className="mt-3 block text-sm text-stone-800"
                >
                  Type DELETE to confirm
                </label>
                <input
                    id="confirm-delete"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-stone-900"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                      onClick={remove}
                      disabled={typed !== "DELETE" || busy === "delete"}
                      className="rounded-lg bg-red-800 px-3.5 py-2 text-sm font-medium text-stone-0 disabled:opacity-40"
                  >
                    {busy === "delete" ? "Deleting…" : "Delete forever"}
                  </button>
                  <button
                      onClick={() => {
                        setConfirmDelete(false);
                        setTyped("");
                      }}
                      className="rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2 text-sm text-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
          )}
        </div>
      </div>
  );
}