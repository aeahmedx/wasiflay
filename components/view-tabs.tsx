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
    <div className="flex gap-1">
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => router.replace(tab.href, { scroll: false })}
            aria-pressed={active}
            className={`rounded-full px-3.5 py-1.5 text-sm transition ${
              active
                ? "bg-stone-900 text-white"
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
