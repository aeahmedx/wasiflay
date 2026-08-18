"use client";

import { useRouter } from "next/navigation";

/**
 * Goes to the actual previous screen rather than a hardcoded destination.
 *
 * Falls back to `fallback` when there's no history to go back to — someone
 * opening a shared link lands with a single history entry, and back()
 * would do nothing at all.
 */
export function BackLink({
  fallback = "/",
  label = "Back",
  className = "text-sm text-stone-600 underline underline-offset-4",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button type="button" onClick={goBack} className={className}>
      {label}
    </button>
  );
}
