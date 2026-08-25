import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRecentMessages, getRoomBySlug } from "@/lib/queries/messages";
import { getCurrentProfile } from "@/lib/queries/profiles.server";
import { blockedIds } from "@/lib/queries/safety";
import { getNextFixture } from "@/lib/queries/room-match";
import { LiveRefresh } from "@/components/live-refresh";
import { RoomView } from "@/components/rooms/room-view";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const room = await getRoomBySlug(supabase, slug);
  if (!room || room.is_archived) notFound();

  const [messages, { data: auth }, profile] = await Promise.all([
    getRecentMessages(supabase, room.id),
    supabase.auth.getUser(),
    getCurrentProfile(),
  ]);

  const blocked = auth.user ? await blockedIds(supabase, auth.user.id) : [];

  /**
   * The room row already carries its match — public_rooms joins it — so
   * there's no second fetch. Only the closed state needs anything more:
   * somewhere to send people next.
   */
  const nextFixture =
    room.chat_state === "closed" && room.match_id
      ? await getNextFixture(supabase, room.match_id)
      : null;

  return (
    <ErrorBoundary label="Chat">
      {/*
        A room has no way to know its match finished — the state that
        closes it is computed, not stored on the room, so nothing about
        the room row itself changes. Watching the match row means a
        result entered at the side of a pitch closes every open room
        immediately, instead of leaving people typing into a
        conversation the database has already shut.
      */}
      {room.match_id && (
        <LiveRefresh
          watch={[{ table: "matches", filter: `id=eq.${room.match_id}` }]}
        />
      )}

      <RoomView
        room={room}
        initialMessages={messages}
        userId={auth.user?.id ?? null}
        isStaff={profile?.role === "moderator" || profile?.role === "admin"}
        isAdmin={profile?.role === "admin"}
        isBanned={profile?.is_banned ?? false}
        blockedIds={blocked}
        nextFixture={nextFixture}
      />
    </ErrorBoundary>
  );
}
