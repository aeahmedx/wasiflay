import type { SupabaseClient } from "@supabase/supabase-js";

export type Room = {
  id: string;
  slug: string;
  name: string;
  type: "general" | "match" | "event";
  is_open: boolean;
  is_archived: boolean;
  sort_order: number;
};

export type Message = {
  id: string;
  room_id: string;
  author_id: string;
  body: string | null;
  image_url: string | null;
  image_width: number | null;
  image_height: number | null;
  edited_at: string | null;
  created_at: string;
};

export type Author = {
  id: string;
  display_name: string;
  country_flag: string | null;
};

export const MESSAGE_PAGE_SIZE = 60;

const MESSAGE_FIELDS =
  "id, room_id, author_id, body, image_url, image_width, image_height, edited_at, created_at";

/** Raised by the DB trigger at >5 messages per 10s. */
export class RateLimitError extends Error {
  constructor() {
    super("RATE_LIMIT");
    this.name = "RateLimitError";
  }
}

function isRateLimit(error: { message?: string } | null): boolean {
  return Boolean(error?.message?.includes("RATE_LIMIT"));
}

export async function listRooms(client: SupabaseClient): Promise<Room[]> {
  const { data, error } = await client
    .from("rooms")
    .select("id, slug, name, type, is_open, is_archived, sort_order")
    .eq("is_open", true)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Room[];
}

export async function getRoomBySlug(
  client: SupabaseClient,
  slug: string
): Promise<Room | null> {
  const { data, error } = await client
    .from("rooms")
    .select("id, slug, name, type, is_open, is_archived, sort_order")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as Room | null;
}

/** Newest page, returned oldest-first for rendering. */
export async function getRecentMessages(
  client: SupabaseClient,
  roomId: string
): Promise<Message[]> {
  const { data, error } = await client
    .from("public_messages")
    .select(MESSAGE_FIELDS)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

/** Earlier messages, for scrolling back through a room's history. */
export async function getOlderMessages(
  client: SupabaseClient,
  roomId: string,
  beforeIso: string
): Promise<Message[]> {
  const { data, error } = await client
    .from("public_messages")
    .select(MESSAGE_FIELDS)
    .eq("room_id", roomId)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;
  // Reversed so callers can prepend without re-sorting.
  return ((data ?? []) as Message[]).reverse();
}

/** Polling fallback: anything newer than the last message we hold. */
export async function getMessagesSince(
  client: SupabaseClient,
  roomId: string,
  sinceIso: string
): Promise<Message[]> {
  const { data, error } = await client
    .from("public_messages")
    .select(MESSAGE_FIELDS)
    .eq("room_id", roomId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(MESSAGE_PAGE_SIZE);

  if (error) throw error;
  return (data ?? []) as Message[];
}

/**
 * Authors are fetched separately rather than embedded. public_profiles is
 * a view, and PostgREST relationship inference on views is not something
 * to depend on. Two deterministic queries beat one clever one.
 */
export async function getAuthors(
  client: SupabaseClient,
  ids: string[]
): Promise<Author[]> {
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("public_profiles")
    .select("id, display_name, country_flag")
    .in("id", ids);

  if (error) throw error;
  return (data ?? []) as Author[];
}

export async function sendMessage(
  client: SupabaseClient,
  input: {
    room_id: string;
    author_id: string;
    body: string;
    image_url?: string | null;
    image_width?: number | null;
    image_height?: number | null;
  }
): Promise<Message> {
  const { data, error } = await client
    .from("messages")
    .insert(input)
    .select(MESSAGE_FIELDS)
    .single();

  if (error) {
    if (isRateLimit(error)) throw new RateLimitError();
    throw error;
  }
  return data as Message;
}


/** Edits your own message. RLS restricts this to the author. */
export async function updateMessage(
  client: SupabaseClient,
  id: string,
  body: string
): Promise<void> {
  const { error } = await client.from("messages").update({ body }).eq("id", id);
  if (error) throw error;
}
