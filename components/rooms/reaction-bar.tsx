"use client";

import { useState } from "react";
import { EMOJI, type Emoji, type ReactionMap } from "@/lib/queries/reactions";

/**
 * Existing reactions render as pills; a "+" opens the fixed set. One tap
 * to participate is the whole point — never put this behind a long-press
 * or a menu.
 */
export function ReactionBar({
  messageId,
  reactions,
  onToggleAction,
  canReact,
}: {
  messageId: string;
  reactions: ReactionMap;
  // Next 16 requires function props on a "use client" entry file to
  // carry an Action suffix, even when they are ordinary callbacks.
  onToggleAction: (messageId: string, emoji: Emoji) => void;
  canReact: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const forMessage = reactions[messageId] ?? {};
  const active = EMOJI.filter((e) => (forMessage[e]?.count ?? 0) > 0);

  if (!canReact && active.length === 0) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {active.map((emoji) => {
        const entry = forMessage[emoji]!;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => canReact && onToggleAction(messageId, emoji)}
            disabled={!canReact}
            aria-pressed={entry.mine}
            aria-label={`${emoji} ${entry.count}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
              entry.mine
                ? "border-emerald-700 bg-emerald-50"
                : "border-stone-300 bg-stone-0"
            } ${canReact ? "hover:border-stone-400" : "opacity-70"}`}
          >
            <span aria-hidden>{emoji}</span>
            <span className="text-stone-600">{entry.count}</span>
          </button>
        );
      })}

      {canReact && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            aria-label="Add reaction"
            aria-expanded={picking}
            className="rounded-full border border-stone-300 bg-stone-0 px-2 py-0.5 text-xs text-stone-500 hover:border-stone-400"
          >
            +
          </button>

          {picking && (
            <div className="absolute bottom-full left-0 z-10 mb-1 flex gap-0.5 rounded-full border border-stone-300 bg-stone-0 px-1.5 py-1 shadow-sm">
              {EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onToggleAction(messageId, emoji);
                    setPicking(false);
                  }}
                  aria-label={`React ${emoji}`}
                  className="rounded-full px-1.5 py-0.5 text-base hover:bg-stone-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
