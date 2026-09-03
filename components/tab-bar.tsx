"use client";

import type { ReactNode } from "react";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreateChoice } from "@/components/posts/create-choice";
import { usePathname } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getUnreadCount } from "@/lib/queries/notifications";

/**
 * Hidden on screens that anchor something else to the bottom — a chat
 * composer and a tab bar fighting over the same 60px is worse than
 * losing navigation for one screen. Detail and task screens have a Back
 * control instead.
 */
const HIDE_ON = [
  /^\/rooms\/[^/]+$/, // a room: composer owns the bottom
  /^\/posts\//, // post detail: answer composer owns the bottom
  /^\/create$/,
  /^\/profile\/edit$/,
  /^\/mod/,
];

type Tab = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: (active: boolean) => ReactNode;
};

const stroke = (active: boolean) => (active ? 2.1 : 1.6);

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    match: (p) => p === "/",
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/hub",
    label: "Tourney",
    match: (p) => p.startsWith("/hub"),
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <path
          d="M7 4h10v3a5 5 0 0 1-10 0z"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinejoin="round"
        />
        <path
          d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinecap="round"
        />
        <path
          d="M12 12v4m-3 4h6"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "Search",
    match: (p) => p.startsWith("/search"),
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth={stroke(a)} />
        <path
          d="m16 16 4 4"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/create",
    label: "Post",
    match: (p) => p === "/create",
    icon: () => null, // rendered as the raised action below
  },
  {
    href: "/photos",
    label: "Photos",
    match: (p) => p.startsWith("/photos"),
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <rect
          x="3"
          y="5"
          width="18"
          height="14"
          rx="2"
          stroke="currentColor"
          strokeWidth={stroke(a)}
        />
        <circle cx="8.5" cy="10" r="1.6" stroke="currentColor" strokeWidth={stroke(a)} />
        <path
          d="m4 17 5-4 4 3 3-2 4 3"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/rooms",
    label: "Rooms",
    match: (p) => p.startsWith("/rooms"),
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <path
          d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.4A7 7 0 0 1 11 5h2a7 7 0 0 1 7 7z"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/notifications",
    label: "Activity",
    match: (p) => p.startsWith("/notifications"),
    icon: (a) => (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden>
        <path
          d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinejoin="round"
        />
        <path
          d="M10.5 19a2 2 0 0 0 3 0"
          stroke="currentColor"
          strokeWidth={stroke(a)}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function TabBar({
  userId,
  initialUnread,
}: {
  userId: string | null;
  initialUnread: number;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(initialUnread);

  const refresh = useCallback(async () => {
    setUnread(await getUnreadCount(supabase));
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    let channel: RealtimeChannel | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    channel = supabase
      .channel(`tabbar:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void refresh(), 400);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refresh]);

  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  return (
    <>
      {/*
        Fixed elements reserve no space, so this keeps the last row of
        content clear of the bar.

        It has to include the safe-area inset, because the bar itself
        adds that as padding — a fixed 4.5rem spacer left content hidden
        underneath by exactly the inset height on a notched phone, which
        is why the last line sprang back under the bar when you let go
        of a scroll.
      */}
      <div
        aria-hidden
        style={{ height: "calc(4.5rem + env(safe-area-inset-bottom))" }}
      />

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-stone-0"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const isPost = tab.href === "/create";
            const href =
              userId || !["/create", "/notifications"].includes(tab.href)
                ? tab.href
                : `/signup?next=${encodeURIComponent(tab.href)}`;

            if (isPost) {
              return (
                <li key={tab.href} className="flex-1">
                  {userId ? (
                    <CreateChoice />
                  ) : (
                    <Link
                      href={href}
                      aria-label="Write a post"
                      className="flex h-[4.5rem] flex-col items-center justify-center gap-1"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-800 text-stone-0 shadow-sm">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M12 5v14M5 12h14"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </Link>
                  )}
                </li>
              );
            }

            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex h-[4.5rem] flex-col items-center justify-center gap-1 ${
                    active ? "text-emerald-800" : "text-stone-500"
                  }`}
                >
                  {tab.icon(active)}
                  <span
                    className={`text-[11px] ${active ? "font-medium" : ""}`}
                  >
                    {tab.label}
                  </span>

                  {tab.href === "/notifications" && unread > 0 && (
                    <span className="absolute right-1/2 top-2 translate-x-4 rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-semibold text-on-brand">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
