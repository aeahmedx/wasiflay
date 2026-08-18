import type { SupabaseClient } from "@supabase/supabase-js";

export const EMOJI = ["🔥", "😂", "⚽", "👏", "❤️", "😮"] as const;
export type Emoji = (typeof EMOJI)[number];

export type Reaction = {
  id: string;
  message_id: string;
  room_id: string;
  user_id: string;
  emoji: Emoji;
};

/** messageId -> emoji -> { count, mine } */
export type ReactionMap = Record<
  string,
  Partial<Record<Emoji, { count: number; mine: boolean }>>
>;

export function buildReactionMap(
  rows: Reaction[],
  userId: string | null
): ReactionMap {
  const map: ReactionMap = {};
  for (const r of rows) {
    const byEmoji = (map[r.message_id] ??= {});
    const entry = (byEmoji[r.emoji] ??= { count: 0, mine: false });
    entry.count += 1;
    if (userId && r.user_id === userId) entry.mine = true;
  }
  return map;
}

export async function getRoomReactions(
  client: SupabaseClient,
  roomId: string,
  limit = 500
): Promise<Reaction[]> {
  const { data, error } = await client
    .from("message_reactions")
    .select("id, message_id, room_id, user_id, emoji")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Reaction[];
}

export async function addReaction(
  client: SupabaseClient,
  messageId: string,
  userId: string,
  emoji: Emoji
): Promise<void> {
  // room_id is omitted deliberately — a trigger sets it from the message.
  const { error } = await client.from("message_reactions").insert({
    message_id: messageId,
    user_id: userId,
    emoji,
  });
  // 23505 = already reacted. Idempotent by design.
  if (error && error.code !== "23505") throw error;
}

export async function removeReaction(
  client: SupabaseClient,
  messageId: string,
  userId: string,
  emoji: Emoji
): Promise<void> {
  const { error } = await client
    .from("message_reactions")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (error) throw error;
}
