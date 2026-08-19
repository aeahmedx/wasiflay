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
    // Scrollable rather than wrapping: with three tabs and a count on
    // one of them, "Needs answers (12)" can exceed a narrow phone. A
    // wrapped second row would shove the feed down on every screen;
    // this just slides.
    <div className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.replace(tab.href, { scroll: false })}
            aria-pressed={active}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
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
