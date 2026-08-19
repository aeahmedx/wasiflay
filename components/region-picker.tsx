"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Region } from "@/lib/queries/regions";

/**
 * Replaces the old two-state city toggle. Someone in Conshohocken and
 * someone in Camden both belong to Philadelphia Metro.
 *
 * "All regions" must send region=all explicitly. Sending no parameter
 * falls back to the profile's own region, which made the option look
 * broken — you selected All and landed back in your own region.
 */
export function RegionPicker({
  regions,
  current,
  tab,
}: {
  regions: Region[];
  current: string | null; // null = all regions
  tab: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function change(value: string) {
    setPending(true);
    // replace, not push: changing the region filter is view state and
    // must not add a history entry for Back to walk through.
    router.replace(`/?tab=${tab}&region=${value}`, { scroll: false });
    setPending(false);
  }

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Region</span>
      <select
        value={current ?? "all"}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        // appearance-none strips the native control, but browsers keep a
        // sliver of internal padding on top of ours — that was the nudge
        // to the right. text-indent pulls the label back onto the edge
        // the padding intends.
        style={{ textIndent: "-1px" }}
        className="appearance-none rounded-full border border-stone-300 bg-stone-0 py-1.5 pl-3 pr-8 text-sm text-stone-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-800"
      >
        <option value="all">All regions</option>
        {regions.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.name}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2.5 w-3 h-3 text-stone-500"
        fill="none"
        aria-hidden
      >
        <path
          d="m2.5 4.5 3.5 3.5 3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  );
}
