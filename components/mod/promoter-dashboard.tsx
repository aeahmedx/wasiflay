"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Totals = {
  total: number;
  today: number;
  last_hour: number;
  attributed: number;
  with_a_pick: number;
};

type Promoter = {
  code: string;
  label: string;
  signups: number;
  signups_today: number;
  last_signup: string | null;
};

type Hour = { hour: string; signups: number };

/** Often enough to feel live, rare enough to run all day on one phone. */
const POLL_MS = 20000;

/**
 * The dashboard you hold at the booth.
 *
 * Built for a phone in one hand at a pitch, not a laptop: big numbers,
 * one column, no charts that need pinching. It answers three questions
 * and nothing else — how many total, which card is working, and is it
 * still happening right now.
 *
 * Polls rather than subscribes. A signup is a profile insert, and
 * putting the profiles table into realtime for one dashboard would be a
 * larger change than this deserves the week of a launch.
 */
export function PromoterDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [promoters, setPromoters] = useState<Promoter[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [t, p, h] = await Promise.all([
        supabase.rpc("signup_totals"),
        supabase.rpc("promoter_stats"),
        supabase.rpc("signups_by_hour", { p_hours: 12 }),
      ]);

      if (t.error || p.error || h.error) {
        setError("Couldn't refresh.");
        return;
      }

      setTotals(((t.data ?? []) as Totals[])[0] ?? null);
      setPromoters((p.data ?? []) as Promoter[]);
      setHours((h.data ?? []) as Hour[]);
      setError(null);
      setUpdatedAt(
        new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch {
      setError("Couldn't refresh.");
    }
  }, [supabase]);

  useEffect(() => {
    // Deferred so the first fetch doesn't update state during mount.
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);

    function onVisible() {
      if (document.visibilityState === "visible") void load();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const peak = Math.max(1, ...hours.map((h) => h.signups));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Signups
        </h1>
        <button
          onClick={() => void load()}
          className="text-sm text-stone-500 underline underline-offset-4"
        >
          {updatedAt ? `Updated ${updatedAt}` : "Refresh"}
        </button>
      </div>

      {error && (
        <p
          role="status"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {/* --- the three numbers that matter ------------------------- */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total" value={totals?.total} big />
        <Stat label="Today" value={totals?.today} big />
        <Stat label="Last hour" value={totals?.last_hour} big />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="From a card" value={totals?.attributed} />
        <Stat label="Made a pick" value={totals?.with_a_pick} />
      </div>

      {/* --- is it still happening --------------------------------- */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-stone-800">
          Last 12 hours
        </h2>
        <div className="flex items-end gap-1 rounded-lg border border-stone-200 bg-stone-0 px-3 py-3">
          {hours.map((h) => {
            const label = new Date(h.hour).toLocaleTimeString([], {
              hour: "numeric",
            });
            return (
              <div key={h.hour} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-stone-600">
                  {h.signups > 0 ? h.signups : ""}
                </span>
                <div
                  className={`w-full rounded-sm ${
                    h.signups > 0 ? "bg-emerald-800" : "bg-stone-200"
                  }`}
                  style={{
                    height: `${Math.max(4, (h.signups / peak) * 56)}px`,
                  }}
                />
                <span className="text-[9px] text-stone-400">{label}</span>
              </div>
            );
          })}
          {hours.length === 0 && (
            <p className="w-full py-4 text-center text-sm text-stone-500">
              Nothing yet.
            </p>
          )}
        </div>
      </section>

      {/* --- which card is working --------------------------------- */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-stone-800">By card</h2>

        {promoters.length === 0 ? (
          <p className="rounded-lg border border-stone-200 bg-stone-0 px-4 py-6 text-center text-sm text-stone-500">
            No codes yet.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 overflow-hidden rounded-lg border border-stone-200 bg-stone-0">
            {promoters.map((p) => (
              <li
                key={p.code}
                className="flex items-center gap-3 px-3.5 py-2.5"
              >
                <span className="w-16 shrink-0 font-mono text-sm font-semibold text-stone-900">
                  {p.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-stone-600">
                  {p.label}
                </span>
                {p.signups_today > 0 && (
                  <span className="shrink-0 text-xs font-medium text-emerald-800">
                    +{p.signups_today} today
                  </span>
                )}
                <span className="w-8 shrink-0 text-right text-lg font-bold tabular-nums text-stone-900">
                  {p.signups}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-2 text-center text-xs leading-relaxed text-stone-500">
        Cards link to wasiflay.com/t/CODE. Refreshes every 20 seconds
        while this screen is open.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: number | undefined;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-0 px-3 py-3 text-center">
      <p
        className={`font-bold tabular-nums leading-none text-stone-900 ${
          big ? "text-3xl" : "text-xl"
        }`}
      >
        {value ?? "—"}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-stone-500">{label}</p>
    </div>
  );
}
