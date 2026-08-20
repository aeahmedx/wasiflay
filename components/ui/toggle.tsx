"use client";

import type { ReactNode } from "react";

/**
 * A checkbox that doesn't dismiss the keyboard.
 *
 * On iOS, Safari closes the keyboard the moment focus leaves a text
 * field. Tapping a normal checkbox next to a textarea does exactly that
 * — the keyboard drops, the page reflows, and getting back to typing
 * takes another tap and a scroll. It reads as a bug.
 *
 * Preventing the default on pointer-down stops the control taking
 * focus, so the caret stays where it was and the keyboard stays up. The
 * click still fires, so the toggle still works — and because it's a real
 * button with role="switch", Space and Enter still operate it for
 * keyboard and screen reader users.
 *
 * This is the same technique rich text editors use to keep the caret
 * alive while you press their toolbar buttons.
 */
export function Toggle({
  checked,
  onChangeAction,
  label,
  description,
  compact = false,
}: {
  checked: boolean;
  // Next 16 requires an Action suffix on function props that cross a
  // "use client" boundary, even for ordinary callbacks.
  onChangeAction: (next: boolean) => void;
  label: string;
  description?: string;
  compact?: boolean;
}) {
  const box = (
    <span
      aria-hidden
      className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition ${
        checked
          ? "border-emerald-800 bg-emerald-800"
          : "border-stone-400 bg-stone-0"
      }`}
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-stone-0" fill="none">
          <path
            d="m2.5 6.2 2.4 2.4 4.6-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onChangeAction(!checked)}
        className="flex items-center gap-2 text-sm text-stone-600"
      >
        {box}
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onChangeAction(!checked)}
      className="flex w-full items-start gap-3 rounded-lg border border-stone-300 bg-stone-0 px-3.5 py-3 text-left"
    >
      <span className="mt-0.5">{box}</span>
      <span>
        <span className="block font-medium text-stone-900">{label}</span>
        {description && (
          <span className="block text-sm text-stone-600">{description}</span>
        )}
      </span>
    </button>
  );
}

/**
 * Same idea for a group of radio options — used by the report flows,
 * where a reason is picked with a detail box open below it.
 */
export function RadioOption({
  name,
  value,
  selected,
  onSelectAction,
  children,
}: {
  name: string;
  value: string;
  selected: boolean;
  onSelectAction: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-labelledby={`${name}-${value}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelectAction(value)}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100"
    >
      <span
        aria-hidden
        className={`flex h-3.75 w-3.75 shrink-0 items-center justify-center rounded-full border ${
          selected ? "border-emerald-800" : "border-stone-400"
        }`}
      >
        {selected && (
          <span className="h-1.75 w-1.75 rounded-full bg-emerald-800" />
        )}
      </span>
      <span id={`${name}-${value}`}>{children}</span>
    </button>
  );
}
