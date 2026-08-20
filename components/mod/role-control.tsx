"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/queries/moderation";

/**
 * Promoting a second admin is the fix for the single worst operational
 * risk in the project: one account holds every privilege, and if it's
 * unreachable during an event nobody can act.
 */
export function RoleControl({
  userId,
  currentRole,
  viewerId,
  onChangedAction,
}: {
  userId: string;
  currentRole: UserRole;
  viewerId: string;
  /**
   * The user list is client state loaded once — router.refresh() only
   * re-runs server components, so without this the badge and the ban
   * button stayed stale until a full reload.
   */
  onChangedAction: (role: UserRole) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState(false);

  // Changing your own role is how an admin accidentally locks
  // themselves out of the panel they're standing in.
  if (userId === viewerId) return null;

  async function setRole(role: UserRole) {
    setBusy(true);
    setError(null);
    try {
      const { error: rpcError } = await createClient().rpc("admin_set_role", {
        p_user: userId,
        p_role: role,
      });
      if (rpcError) {
        setError(
          rpcError.message.includes("FORBIDDEN")
            ? "Admins only."
            : "That didn't go through."
        );
        return;
      }
      setConfirmAdmin(false);
      // Update the list first so the badge and the ban button react
      // immediately, then refresh the server-rendered pieces.
      onChangedAction(role);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {currentRole === "member" && (
        <button
          onClick={() => setRole("moderator")}
          disabled={busy}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
        >
          Make moderator
        </button>
      )}

      {currentRole === "moderator" && (
        <>
          <button
            onClick={() => setRole("member")}
            disabled={busy}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
          >
            Remove moderator
          </button>
          {confirmAdmin ? (
            <>
              <button
                onClick={() => setRole("admin")}
                disabled={busy}
                className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
              >
                Confirm: full admin
              </button>
              <button
                onClick={() => setConfirmAdmin(false)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmAdmin(true)}
              disabled={busy}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
            >
              Make admin
            </button>
          )}
        </>
      )}

      {currentRole === "admin" && (
        <span className="text-sm text-stone-500">
          Admin — change this in the database if needed
        </span>
      )}

      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}
