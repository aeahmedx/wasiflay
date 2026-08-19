"use client";

import { useRouter } from "next/navigation";

export type ViewTab = {
  key: string;
  label: string;
  href: string;
};

/**
 * Tabs and filters are view state, not navigation.
 *
 * Rendering them as <Link> pushes a history entry per switch, so Back
 * walks backwards through every tab and filter change instead of
 * returning to the previous screen. router.replace swaps the current
 * entry, keeping the URL shareable without polluting history.
 */
export function ViewTabs({
  tabs,
  activeKey,
}: {
  tabs: ViewTab[];
  activeKey: string;
}) {
  const router = useRouter();

  return (
    // All three tabs sit on one row at natural width. Measured at 13px
    // with px-3 padding, the longest set — Latest, Trending, Needs
    // answers (99) — comes to roughly 320px, inside a 360px phone. The
    // count is capped at 99+ so it can never grow past that.
    <div className="flex gap-1.5">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.replace(tab.href, { scroll: false })}
            aria-pressed={active}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition ${
              active
                ? "bg-stone-900 text-stone-0"
                : "text-stone-600 hover:bg-stone-200"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
