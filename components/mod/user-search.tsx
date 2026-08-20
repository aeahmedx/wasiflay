"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Toggle } from "@/components/ui/toggle";
import { RoleControl } from "@/components/mod/role-control";
import {
  findUsers,
  modSetBan,
  purgeUser,
  type ModUser,
  type UserRole,
} from "@/lib/queries/moderation";

const DEBOUNCE_MS = 300;

export function UserSearch({
  isAdmin,
  viewerId,
}: {
  isAdmin: boolean;
  viewerId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [query, setQuery] = useState("");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [users, setUsers] = useState<ModUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);

  const requestId = useRef(0);

  const load = useCallback(
    async (q: string, banned: boolean) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const found = await findUsers(supabase, q, banned);
        if (id !== requestId.current) return;
        setUsers(found);
      } catch (e) {
        if (id !== requestId.current) return;
        setError(
          `Couldn't load users: ${e instanceof Error ? e.message : "unknown error"}`
        );
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(query, bannedOnly), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, bannedOnly, load]);

  async function setBan(user: ModUser, banned: boolean) {
    setBusy(user.id);
    setError(null);
    try {
      await modSetBan(supabase, user.id, banned);
      await load(query, bannedOnly);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("CANNOT_BAN_ADMIN")
          ? "Admins can't be banned."
          : msg.includes("CANNOT_BAN_SELF")
          ? "You can't ban yourself."
          : msg.includes("CANNOT_BAN_MODERATOR")
          ? "Only an admin can ban a moderator."
          : `That didn't go through: ${msg || "unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  }

  async function purge(user: ModUser) {
    setBusy(user.id);
    setError(null);
    try {
      const count = await purgeUser(supabase, user.id);
      setConfirmPurge(null);
      setError(
        count === 0
          ? "Nothing to remove."
          : `Removed ${count} item${count === 1 ? "" : "s"}.`
      );
      await load(query, bannedOnly);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        msg.includes("CANNOT_PURGE_ADMIN")
          ? "Admins can't be purged."
          : msg.includes("CANNOT_PURGE_SELF")
          ? "You can't purge your own content here."
          : msg.includes("CANNOT_PURGE_MODERATOR")
          ? "Only an admin can purge a moderator."
          : `That didn't go through: ${msg || "unknown error"}`
      );
    } finally {
      setBusy(null);
    }
  }

  /** Mirrors the database rules in 0013. */
  function banBlocked(u: ModUser): string | null {
    if (u.id === viewerId) return "That's you";
    if (u.role === "admin") return "Admins can't be banned";
    if (u.role === "moderator" && !isAdmin)
      return "Only an admin can ban a moderator";
    return null;
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        dir="auto"
        type="search"
        placeholder="Search by name or town"
        aria-label="Search users"
        className="w-full rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-2.5 text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
      />

      {/* Sits under a live search field; a plain checkbox would close
          the keyboard mid-search. */}
      <div className="mt-3">
        <Toggle
          compact
          checked={bannedOnly}
          onChangeAction={setBannedOnly}
          label="Banned accounts only"
        />
      </div>

      {error && (
        <div
          role="status"
          className="mt-3 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-800"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="mt-4 text-stone-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="mt-4 rounded-lg border border-stone-200 bg-stone-0 px-4 py-8 text-center text-stone-600">
          No accounts match that.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900" dir="auto">
                    {u.display_name}
                  </p>
                  <p className="text-sm text-stone-500">
                    {u.region ?? "—"}
                    {u.city ? ` · ${u.city}` : ""} · {u.contribution_count}{" "}
                    contributions
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {u.is_banned && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                      banned
                    </span>
                  )}
                  {u.role !== "member" && (
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs capitalize text-stone-700">
                      {u.role}
                    </span>
                  )}
                  {u.is_minor && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                      under 18
                    </span>
                  )}
                  {u.open_reports > 0 && (
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800">
                      {u.open_reports} open
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <RoleControl
                  userId={u.id}
                  currentRole={u.role}
                  viewerId={viewerId}
                  onChangedAction={(role: UserRole) => {
                    // Optimistic: the row re-renders with the new badge
                    // and the correct ban rules straight away.
                    setUsers((current) =>
                      current.map((x) =>
                        x.id === u.id ? { ...x, role } : x
                      )
                    );
                    void load(query, bannedOnly);
                  }}
                />
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/profile/${u.id}`}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                >
                  Profile
                </Link>

                {banBlocked(u) ? (
                  <span className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-400">
                    {banBlocked(u)}
                  </span>
                ) : u.is_banned ? (
                  <button
                    onClick={() => setBan(u, false)}
                    disabled={busy === u.id}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                  >
                    Unban
                  </button>
                ) : (
                  <button
                    onClick={() => setBan(u, true)}
                    disabled={busy === u.id}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
                  >
                    Ban
                  </button>
                )}

                {confirmPurge === u.id ? (
                  <>
                    <button
                      onClick={() => purge(u)}
                      disabled={busy === u.id}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-stone-0 disabled:opacity-40"
                    >
                      Confirm: remove everything
                    </button>
                    <button
                      onClick={() => setConfirmPurge(null)}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmPurge(u.id)}
                    disabled={busy === u.id || banBlocked(u) !== null}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 disabled:opacity-40"
                  >
                    Remove all content
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!isAdmin && (
        <p className="mt-6 text-xs text-stone-500">
          Moderator access. Only an admin can change roles.
        </p>
      )}
    </div>
  );
}
